from __future__ import annotations

from app.models.nomenclature import NomenclatureType
from app.models.technical_card_settings import TechnicalCardSettings
from app.schemas.technical_card import (
    TechnicalCardSettingsRead,
    TechnicalCardSettingsUpdate,
)


DEFAULT_ELIGIBLE_NOMENCLATURE_TYPES = [NomenclatureType.PRODUCT]
DEFAULT_NUMBERING_TEMPLATE = "{orderNo}-{cardSeq}"
DEFAULT_STAGE_LABEL_BINDING_MODE = "snapshot"


def _serialize_types(values: list[NomenclatureType | str]) -> str:
    ordered: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = raw.value if hasattr(raw, "value") else str(raw)
        normalized = value.strip().upper()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ",".join(ordered) or NomenclatureType.PRODUCT.value


def _deserialize_types(value: str) -> list[NomenclatureType]:
    result: list[NomenclatureType] = []
    for raw in value.split(","):
        normalized = raw.strip().upper()
        if not normalized:
            continue
        try:
            enum_value = NomenclatureType(normalized)
        except ValueError:
            continue
        if enum_value not in result:
            result.append(enum_value)
    return result or [NomenclatureType.PRODUCT]


def _default_row() -> TechnicalCardSettings:
    return TechnicalCardSettings(
        id=1,
        eligible_nomenclature_types=_serialize_types(DEFAULT_ELIGIBLE_NOMENCLATURE_TYPES),
        numbering_template=DEFAULT_NUMBERING_TEMPLATE,
        unit_field_size_type_enabled=True,
        unit_field_size_enabled=True,
        unit_field_personalization_enabled=True,
        unit_field_print_number_enabled=True,
        unit_field_notes_enabled=True,
        stage_label_binding_mode=DEFAULT_STAGE_LABEL_BINDING_MODE,
    )


def ensure_technical_card_settings(db) -> TechnicalCardSettings:
    row = db.get(TechnicalCardSettings, 1)
    if row is not None:
        return row
    row = _default_row()
    db.add(row)
    db.flush()
    return row


def get_technical_card_settings(db) -> TechnicalCardSettingsRead:
    row = ensure_technical_card_settings(db)
    return TechnicalCardSettingsRead(
        id=row.id,
        eligible_nomenclature_types=_deserialize_types(row.eligible_nomenclature_types),
        numbering_template=row.numbering_template,
        unit_field_size_type_enabled=row.unit_field_size_type_enabled,
        unit_field_size_enabled=row.unit_field_size_enabled,
        unit_field_personalization_enabled=row.unit_field_personalization_enabled,
        unit_field_print_number_enabled=row.unit_field_print_number_enabled,
        unit_field_notes_enabled=row.unit_field_notes_enabled,
        stage_label_binding_mode=row.stage_label_binding_mode,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def update_technical_card_settings(
    db, payload: TechnicalCardSettingsUpdate
) -> TechnicalCardSettingsRead:
    row = ensure_technical_card_settings(db)
    row.eligible_nomenclature_types = _serialize_types(payload.eligible_nomenclature_types)
    row.numbering_template = payload.numbering_template
    row.unit_field_size_type_enabled = payload.unit_field_size_type_enabled
    row.unit_field_size_enabled = payload.unit_field_size_enabled
    row.unit_field_personalization_enabled = (
        payload.unit_field_personalization_enabled
    )
    row.unit_field_print_number_enabled = payload.unit_field_print_number_enabled
    row.unit_field_notes_enabled = payload.unit_field_notes_enabled
    row.stage_label_binding_mode = payload.stage_label_binding_mode
    db.add(row)
    db.commit()
    db.refresh(row)
    return get_technical_card_settings(db)
