"""Stage 25 — tech-card QR token, scan commands, WIP status, FG qty, sewing ledger."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.production_stage import ProductionStage
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.stock import StockDocument, StockDocumentType
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
)
from app.models.warehouse import Warehouse
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _bind_app(factory: sessionmaker[Session]):
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    return previous


def _seed_order_item(db: Session, number: str, quantity: Decimal = Decimal("2")) -> tuple[int, int]:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
        db.flush()
    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)
    db.flush()
    lead = Lead(
        contact_name="Иван",
        company_name="СК",
        phone="+79990000000",
        email="a@example.com",
        city="Казань",
        source="website",
        responsible_id=1,
        sport="Футбол",
        product_category="Форма",
        need_description="Форма",
        estimated_quantity=int(quantity),
        estimated_amount=Decimal("2000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number=number,
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ QR",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=quantity,
        unit_price=Decimal("100"),
        line_amount=quantity * Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()
    return order.id, item.id


def _seed_scan_card(
    db: Session,
    *,
    number: str,
    token: str,
    with_materials: bool = False,
    with_fg: bool = False,
) -> dict[str, int]:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    wto = ProductionStage(name="ВТО", code="wto", is_active=True, sort_order=50)
    stages = [print_stage, sewing, wto]
    if with_fg:
        packaging = ProductionStage(
            name="Упаковка", code="packaging", is_active=True, sort_order=70
        )
        ready = ProductionStage(
            name="Готовы к отгрузке", code="ready_to_ship", is_active=True, sort_order=80
        )
        shipped = ProductionStage(
            name="Отгружены", code="shipped", is_active=True, sort_order=90
        )
        stages.extend([packaging, ready, shipped])
    db.add_all(stages)
    db.flush()
    order_id, item_id = _seed_order_item(db, number)
    product_id = None
    if with_fg:
        warehouse = Warehouse(
            name="Основной", code="main", is_active=True, is_default=True
        )
        product = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add_all([warehouse, product])
        db.flush()
        product_id = product.id
    current = stages[0]
    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number=f"{number}-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_id=product_id,
        nomenclature_name="Футболка",
        assembly_variant_name="Базовый",
        assembly_variant_total_cost=Decimal("120.50"),
        current_stage_order=1,
        current_stage_label=current.name,
        qr_token=token,
    )
    db.add(card)
    db.flush()
    results = []
    for index, stage in enumerate(stages, start=1):
        results.append(
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=index,
                production_stage_id=stage.id,
                stage_label=stage.name,
                status=(
                    TechnicalCardStageResultStatus.IN_PROGRESS
                    if index == 1
                    else TechnicalCardStageResultStatus.PENDING
                ),
            )
        )
    db.add_all(results)
    units = [
        TechnicalCardUnitLine(
            technical_card_id=card.id,
            unit_index=1,
            size="M",
            production_stage_id=current.id,
        ),
        TechnicalCardUnitLine(
            technical_card_id=card.id,
            unit_index=2,
            size="L",
            production_stage_id=current.id,
        ),
    ]
    db.add_all(units)
    if with_materials:
        db.add(
            TechnicalCardCompositionLine(
                technical_card_id=card.id,
                sequence=1,
                line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                snapshot_name="Плёнка",
                planned_qty=Decimal("2"),
                production_stage_id=print_stage.id,
                unit="шт",
            )
        )
    db.commit()
    unit_ids = db.scalars(
        select(TechnicalCardUnitLine.id)
        .where(TechnicalCardUnitLine.technical_card_id == card.id)
        .order_by(TechnicalCardUnitLine.unit_index)
    ).all()
    return {
        "card_id": card.id,
        "print_id": print_stage.id,
        "sewing_id": sewing.id,
        "wto_id": wto.id,
        "unit_1": unit_ids[0],
        "unit_2": unit_ids[1],
        "packaging_id": stages[3].id if with_fg else 0,
        "ready_id": stages[4].id if with_fg else 0,
    }


def test_qr_token_is_opaque_not_card_id() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ids = _seed_scan_card(db, number="SO-QR-1", token="opaque-qr-token-aaa")

        with TestClient(app) as client:
            login_client(client, login="admin1")
            by_id = client.get(f"/technical-cards/{ids['card_id']}")
            assert by_id.status_code == 200, by_id.text
            body = by_id.json()
            assert body["qr_token"] == "opaque-qr-token-aaa"
            assert body["qr_token"] != str(ids["card_id"])
            assert "scan" in body["scan_url"]
            assert "opaque-qr-token-aaa" in body["scan_url"]
            assert "<svg" in (body["scan_qr_svg"] or "")
            assert body["wip_status"] == "in_work"

            missing = client.get("/tech-card-scan/no-such-token")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_scan_requires_session_and_rejects_skip() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ids = _seed_scan_card(db, number="SO-QR-2", token="opaque-qr-token-bbb")

        with TestClient(app) as client:
            anon = client.get("/tech-card-scan/opaque-qr-token-bbb")
            assert anon.status_code == 401

            login_client(client, login="admin1")
            scan = client.get("/tech-card-scan/opaque-qr-token-bbb")
            assert scan.status_code == 200, scan.text
            allowed = {row["stage_code"]: row for row in scan.json()["allowed_stages"]}
            assert "print" in allowed
            assert "sewing" not in allowed or allowed["sewing"]["relation"] == "next"
            assert allowed["print"]["relation"] == "current"

            skip = client.post(
                "/tech-card-scan/opaque-qr-token-bbb/complete-transfer",
                json={
                    "production_stage_id": ids["wto_id"],
                    "unit_line_ids": [ids["unit_1"]],
                    "performer_name": "Оператор",
                    "work_done": "Скан",
                },
            )
            assert skip.status_code == 422, skip.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_partial_transfer_return_status_and_material_gate() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ids = _seed_scan_card(
                db, number="SO-QR-3", token="opaque-qr-token-ccc", with_materials=True
            )

        with TestClient(app) as client:
            login_client(client, login="admin1")
            blocked = client.post(
                "/tech-card-scan/opaque-qr-token-ccc/complete-transfer",
                json={
                    "production_stage_id": ids["print_id"],
                    "unit_line_ids": [ids["unit_1"]],
                    "performer_name": "Печатник",
                    "work_done": "Печать",
                },
            )
            assert blocked.status_code == 422, blocked.text

            with factory() as db:
                line = db.scalars(select(TechnicalCardCompositionLine)).first()
                assert line is not None
                line_id = line.id

            moved = client.post(
                "/tech-card-scan/opaque-qr-token-ccc/complete-transfer",
                json={
                    "production_stage_id": ids["print_id"],
                    "unit_line_ids": [ids["unit_1"]],
                    "performer_name": "Печатник",
                    "work_done": "Печать",
                    "material_facts": [
                        {"composition_line_id": line_id, "fact_qty": "2"}
                    ],
                },
            )
            assert moved.status_code == 200, moved.text
            body = moved.json()
            by_id = {row["id"]: row for row in body["units"]}
            assert by_id[ids["unit_1"]]["production_stage_id"] == ids["sewing_id"]
            assert by_id[ids["unit_2"]]["production_stage_id"] == ids["print_id"]
            assert body["wip_status"] == "in_work"

            back = client.post(
                "/tech-card-scan/opaque-qr-token-ccc/return",
                json={
                    "production_stage_id": ids["sewing_id"],
                    "unit_line_ids": [ids["unit_1"]],
                    "performer_name": "Швея",
                    "work_done": "Возврат на печать",
                },
            )
            assert back.status_code == 200, back.text
            assert back.json()["wip_status"] == "return"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_sewing_scan_writes_ledger_and_restricted_shell() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ids = _seed_scan_card(db, number="SO-QR-4", token="opaque-qr-token-ddd")
            card = db.get(TechnicalCard, ids["card_id"])
            assert card is not None
            for unit in card.unit_lines:
                unit.production_stage_id = ids["sewing_id"]
            card.current_stage_order = 2
            card.current_stage_label = "Пошив"
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            scan = client.get("/tech-card-scan/opaque-qr-token-ddd")
            assert scan.status_code == 200, scan.text
            codes = {row["stage_code"] for row in scan.json()["allowed_stages"]}
            assert codes == {"sewing"}

            forbidden = client.post(
                "/tech-card-scan/opaque-qr-token-ddd/accept",
                json={
                    "production_stage_id": ids["print_id"],
                    "unit_line_ids": [ids["unit_1"]],
                },
            )
            assert forbidden.status_code in {403, 422}, forbidden.text

            taken = client.post(
                "/tech-card-scan/opaque-qr-token-ddd/accept",
                json={
                    "production_stage_id": ids["sewing_id"],
                    "unit_line_ids": [ids["unit_1"]],
                },
            )
            assert taken.status_code == 200, taken.text
            cabinet = client.get("/sewing-cabinet")
            assert cabinet.status_code == 200, cabinet.text
            reserved = cabinet.json()["reserved"]
            assert len(reserved) == 1
            assert Decimal(str(reserved[0]["qty"])) == Decimal("1")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_partial_fg_post_and_sewing_queue_by_units() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            ids = _seed_scan_card(
                db, number="SO-QR-5", token="opaque-qr-token-eee", with_fg=True
            )
            card = db.get(TechnicalCard, ids["card_id"])
            assert card is not None
            packaging_id = ids["packaging_id"]
            for unit in card.unit_lines:
                unit.production_stage_id = packaging_id
            card.current_stage_order = 4
            card.current_stage_label = "Упаковка"
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="admin1")
            moved = client.post(
                "/tech-card-scan/opaque-qr-token-eee/complete-transfer",
                json={
                    "production_stage_id": ids["packaging_id"],
                    "unit_line_ids": [ids["unit_1"]],
                    "performer_name": "Упаковщик",
                    "work_done": "Упакована одна штука",
                },
            )
            assert moved.status_code == 200, moved.text
            assert moved.json()["wip_status"] == "partial_ready"

        with factory() as db:
            docs = db.scalars(
                select(StockDocument).where(
                    StockDocument.technical_card_id == ids["card_id"],
                    StockDocument.doc_type == StockDocumentType.FG_RECEIPT.value,
                )
            ).all()
            assert len(docs) == 1
            qty = sum(abs(Decimal(str(line.quantity))) for line in docs[0].ledger_lines)
            assert qty == Decimal("1")

            unit = db.get(TechnicalCardUnitLine, ids["unit_2"])
            assert unit is not None
            unit.production_stage_id = ids["sewing_id"]
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            queue = client.get("/sewing-cabinet/queue")
            assert queue.status_code == 200, queue.text
            assert any(row["technical_card_id"] == ids["card_id"] for row in queue.json())
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous
