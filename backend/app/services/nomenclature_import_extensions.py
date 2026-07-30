"""Apply extended import fields: characteristics, product models, photos."""

from __future__ import annotations

import mimetypes
import shutil
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.characteristics import CharacteristicDefinition, CharacteristicOption
from app.models.media import NomenclatureMedia
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import ProductModelStatus
from app.models.product_type import ProductType
from app.repositories import nomenclature_product_models as npm_repo
from app.repositories import product_models as product_model_repo
from app.schemas.characteristics import (
    NomenclatureCharacteristicAssignmentInput,
    NomenclatureCharacteristicValueInput,
)
from app.schemas.nomenclature import NomenclatureUpdate
from app.services.characteristics import (
    CharacteristicConflictError,
    CharacteristicNotFoundError,
    CharacteristicRuleError,
    assign_nomenclature_value,
    get_nomenclature_values,
    save_nomenclature_values,
)
from app.services.media import MEDIA_ROOT, list_media
from app.services.nomenclature import apply_nomenclature_update
from app.services.nomenclature_file_columns import parse_char_column_header


class NomenclatureImportExtensionError(RuntimeError):
    pass


def extract_import_extras(
    headers: list[str],
    raw_row: dict[str, str | None],
) -> dict[str, str | None]:
    """Collect extended columns (chars + product models + photos + type name)."""
    extras: dict[str, str | None] = {}
    by_lower = {str(k).strip().lower(): v for k, v in raw_row.items()}

    alias_to_canonical = {
        "product_type_name": "product_type_name",
        "вид_изделия": "product_type_name",
        "вид изделия": "product_type_name",
        "product_model_articles": "product_model_articles",
        "модели": "product_model_articles",
        "модели_изделия": "product_model_articles",
        "photo_paths": "photo_paths",
        "фото": "photo_paths",
        "путь_к_фото": "photo_paths",
        "photo_urls": "photo_urls",
    }
    for alias, canonical in alias_to_canonical.items():
        if alias in by_lower and canonical not in extras:
            extras[canonical] = by_lower[alias]

    for header in headers:
        code = parse_char_column_header(header)
        if code:
            extras[f"char:{code}"] = raw_row.get(header)
    return extras


def validate_import_extras(
    db: Session,
    item_type: NomenclatureType,
    product_type_id: int | None,
    extras: dict[str, str | None],
) -> None:
    """Dry-run friendly checks (no writes)."""
    if _has_value(extras.get("product_type_name")):
        _resolve_product_type(db, str(extras["product_type_name"]))
        if item_type != NomenclatureType.PRODUCT:
            raise NomenclatureImportExtensionError(
                "product_type_name allowed only for PRODUCT nomenclature"
            )

    articles_raw = extras.get("product_model_articles")
    if articles_raw is not None:
        articles = _split_list(str(articles_raw))
        if articles and item_type != NomenclatureType.PRODUCT:
            raise NomenclatureImportExtensionError(
                "product_model_articles allowed only for PRODUCT"
            )
        target_type_id = product_type_id
        if _has_value(extras.get("product_type_name")):
            target_type_id = _resolve_product_type(
                db, str(extras["product_type_name"])
            ).id
        if articles and target_type_id is None:
            raise NomenclatureImportExtensionError(
                "Set product_type_name before product_model_articles"
            )
        for article in articles:
            model = product_model_repo.get_product_model_by_article(db, article)
            if model is None:
                raise NomenclatureImportExtensionError(
                    f"product model article '{article}' not found"
                )
            if model.status != ProductModelStatus.ACTIVE:
                raise NomenclatureImportExtensionError(
                    f"product model article '{article}' is not active"
                )
            if target_type_id is not None and model.product_type_id != target_type_id:
                raise NomenclatureImportExtensionError(
                    f"product model '{article}' does not match product_type"
                )

    char_map = {
        key[5:]: value
        for key, value in extras.items()
        if key.startswith("char:") and _has_value(value)
    }
    if char_map:
        definitions = {
            row.code.casefold(): row
            for row in db.scalars(select(CharacteristicDefinition)).all()
        }
        for code, raw in char_map.items():
            definition = definitions.get(code.casefold())
            if definition is None:
                raise NomenclatureImportExtensionError(
                    f"characteristic code '{code}' not found"
                )
            _parse_characteristic_raw(db, definition, str(raw))

    if _has_value(extras.get("photo_paths")):
        for path_str in _split_list(str(extras["photo_paths"])):
            path = _resolve_photo_path(path_str)
            mime = _guess_image_mime(path)
            if mime not in {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}:
                raise NomenclatureImportExtensionError(
                    f"unsupported photo mime for {path.name}: {mime}"
                )


def apply_import_extensions(
    db: Session,
    item: Nomenclature,
    extras: dict[str, str | None],
) -> None:
    """Apply product type / models / characteristics / photos after card upsert."""
    if _has_value(extras.get("product_type_name")):
        product_type = _resolve_product_type(db, str(extras["product_type_name"]))
        if item.nomenclature_type != NomenclatureType.PRODUCT:
            raise NomenclatureImportExtensionError(
                "product_type_name allowed only for PRODUCT nomenclature"
            )
        apply_nomenclature_update(
            db,
            item,
            NomenclatureUpdate(product_type_id=product_type.id),
            commit=True,
        )
        db.refresh(item)

    if extras.get("product_model_articles") is not None:
        _apply_product_model_articles(db, item, str(extras["product_model_articles"]))

    char_map = {
        key[5:]: value
        for key, value in extras.items()
        if key.startswith("char:") and _has_value(value)
    }
    if char_map:
        _apply_characteristics(db, item, char_map)

    if _has_value(extras.get("photo_paths")):
        _apply_photo_paths(db, item, str(extras["photo_paths"]))


def resolve_product_type_id_from_extras(
    db: Session, extras: dict[str, str | None]
) -> int | None:
    if not _has_value(extras.get("product_type_name")):
        return None
    return _resolve_product_type(db, str(extras["product_type_name"])).id


def _has_value(raw: str | None) -> bool:
    return raw is not None and str(raw).strip() != ""


def _split_list(raw: str) -> list[str]:
    return [part.strip() for part in raw.replace(",", ";").split(";") if part.strip()]


def _resolve_product_type(db: Session, name: str) -> ProductType:
    needle = name.strip()
    product_type = db.scalars(
        select(ProductType).where(func.lower(ProductType.name) == needle.casefold())
    ).first()
    if product_type is None:
        raise NomenclatureImportExtensionError(
            f"product_type_name '{needle}' not found"
        )
    return product_type


def _apply_product_model_articles(db: Session, item: Nomenclature, raw: str) -> None:
    articles = _split_list(raw)
    if item.nomenclature_type != NomenclatureType.PRODUCT:
        if articles:
            raise NomenclatureImportExtensionError(
                "product_model_articles allowed only for PRODUCT"
            )
        return

    existing = npm_repo.list_links_for_nomenclature(db, item.id)
    for link, _model in existing:
        npm_repo.delete_link(db, link)

    if not articles:
        return
    if item.product_type_id is None:
        raise NomenclatureImportExtensionError(
            "Set product_type_name before product_model_articles"
        )

    for index, article in enumerate(articles):
        model = product_model_repo.get_product_model_by_article(db, article)
        if model is None:
            raise NomenclatureImportExtensionError(
                f"product model article '{article}' not found"
            )
        if model.status != ProductModelStatus.ACTIVE:
            raise NomenclatureImportExtensionError(
                f"product model article '{article}' is not active"
            )
        if model.product_type_id != item.product_type_id:
            raise NomenclatureImportExtensionError(
                f"product model '{article}' does not match product_type"
            )
        npm_repo.add_link(
            db,
            nomenclature_id=item.id,
            product_model_id=model.id,
            sort_order=index,
        )


def _apply_characteristics(
    db: Session,
    item: Nomenclature,
    char_map: dict[str, str],
) -> None:
    definitions = {
        row.code.casefold(): row
        for row in db.scalars(select(CharacteristicDefinition)).all()
    }
    current_ids = {
        definition.id
        for _a, definition, _row, _s, _i in get_nomenclature_values(db, item.id)
    }
    for code in char_map:
        definition = definitions.get(code.casefold())
        if definition is None:
            raise NomenclatureImportExtensionError(
                f"characteristic code '{code}' not found"
            )
        if definition.id not in current_ids:
            try:
                assign_nomenclature_value(
                    db,
                    item.id,
                    NomenclatureCharacteristicAssignmentInput(
                        characteristic_id=definition.id
                    ),
                )
            except CharacteristicConflictError:
                pass
            current_ids.add(definition.id)

    payload: list[NomenclatureCharacteristicValueInput] = []
    for code, raw in char_map.items():
        definition = definitions[code.casefold()]
        value = _parse_characteristic_raw(db, definition, str(raw))
        payload.append(
            NomenclatureCharacteristicValueInput(
                characteristic_id=definition.id,
                value=value,
            )
        )
    try:
        save_nomenclature_values(db, item.id, payload)
    except (CharacteristicRuleError, CharacteristicNotFoundError) as error:
        raise NomenclatureImportExtensionError(str(error)) from error


def _parse_characteristic_raw(
    db: Session, definition: CharacteristicDefinition, raw: str
) -> object:
    text = raw.strip()
    kind = definition.kind
    if kind in ("STRING", "TEXT") or (
        kind == "COLOR" and not definition.is_variant_dimension
    ):
        return text
    if kind == "INTEGER":
        try:
            return int(text)
        except ValueError as error:
            raise NomenclatureImportExtensionError(
                f"invalid integer for characteristic {definition.code}"
            ) from error
    if kind == "DECIMAL":
        try:
            return Decimal(text.replace(",", "."))
        except InvalidOperation as error:
            raise NomenclatureImportExtensionError(
                f"invalid decimal for characteristic {definition.code}"
            ) from error
    if kind == "BOOLEAN":
        lower = text.casefold()
        if lower in {"1", "true", "yes", "y", "да"}:
            return True
        if lower in {"0", "false", "no", "n", "нет"}:
            return False
        raise NomenclatureImportExtensionError(
            f"invalid boolean for characteristic {definition.code}"
        )
    if kind == "DATE":
        try:
            return date.fromisoformat(text)
        except ValueError as error:
            raise NomenclatureImportExtensionError(
                f"invalid date for characteristic {definition.code}"
            ) from error
    if kind == "LIST" or (kind == "COLOR" and definition.is_variant_dimension):
        option = _find_option(db, definition.id, text)
        if option is None:
            raise NomenclatureImportExtensionError(
                f"option '{text}' not found for {definition.code}"
            )
        return option.id
    if kind == "MULTI_SELECT":
        parts = [
            part.strip()
            for part in text.replace(";", "|").split("|")
            if part.strip()
        ]
        ids: list[int] = []
        for part in parts:
            option = _find_option(db, definition.id, part)
            if option is None:
                raise NomenclatureImportExtensionError(
                    f"option '{part}' not found for {definition.code}"
                )
            ids.append(option.id)
        return ids
    return text


def _find_option(
    db: Session, characteristic_id: int, token: str
) -> CharacteristicOption | None:
    options = list(
        db.scalars(
            select(CharacteristicOption).where(
                CharacteristicOption.characteristic_id == characteristic_id
            )
        ).all()
    )
    needle = token.casefold()
    for option in options:
        if option.code.casefold() == needle or option.label.casefold() == needle:
            return option
    return None


def _guess_image_mime(path: Path) -> str | None:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    by_suffix = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    return by_suffix.get(path.suffix.lower())


def _resolve_photo_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_file():
        return path
    alt = MEDIA_ROOT / path_str
    if alt.is_file():
        return alt
    raise NomenclatureImportExtensionError(f"photo path not found: {path_str}")


def _apply_photo_paths(db: Session, item: Nomenclature, raw: str) -> None:
    paths = _split_list(raw)
    existing_names = {media.filename for media in list_media(db, item.id)}
    for path_str in paths:
        path = _resolve_photo_path(path_str)
        if path.name in existing_names:
            continue
        mime = _guess_image_mime(path)
        if mime not in {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}:
            raise NomenclatureImportExtensionError(
                f"unsupported photo mime for {path.name}: {mime}"
            )
        data = path.read_bytes()
        if not data:
            raise NomenclatureImportExtensionError(f"empty photo file: {path}")
        key = f"nomenclature/{item.id}/{uuid.uuid4().hex}-{path.name}"
        dest = MEDIA_ROOT / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, dest)
        is_primary = len(existing_names) == 0
        media = NomenclatureMedia(
            nomenclature_id=item.id,
            filename=path.name[:255],
            storage_key=key,
            mime_type=mime,
            file_size=len(data),
            alt_text=None,
            sort_order=len(existing_names),
            is_primary=is_primary,
        )
        db.add(media)
        existing_names.add(path.name)
    db.commit()
