"""Stage 9.2.1 — generate / preview / sync unit lines / cancel draft."""

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
from app.models.sales import Lead, LeadTask, SalesOrderItem, SalesUser
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def _add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def _seed_nomenclatures(db: Session) -> dict[str, int]:
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    service = Nomenclature(
        name="Доставка",
        category="Услуги",
        nomenclature_type=NomenclatureType.SERVICE,
        unit="шт",
        base_price=Decimal("500.00"),
    )
    db.add_all([product, service])
    db.commit()
    return {"product": product.id, "service": service.id}


def test_generate_preview_sync_cancel_and_revive() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            noms = _seed_nomenclatures(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            order_number = client.get(f"/orders/{order_id}").json()["number"]

            product_item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": noms["product"],
                    "snapshot_name": "Футболка PRO",
                    "size_range": "M",
                    "personalization": "Иванов",
                    "color": "Белый",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "1500",
                },
            )
            assert product_item.status_code == 201, product_item.text
            product_item_id = product_item.json()["id"]

            service_item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": noms["service"],
                    "snapshot_name": "Доставка",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "500",
                },
            )
            assert service_item.status_code == 201, service_item.text
            service_item_id = service_item.json()["id"]

            manual_item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "snapshot_name": "Ручная позиция",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "100",
                },
            )
            assert manual_item.status_code == 201, manual_item.text

            preview = client.post(f"/orders/{order_id}/technical-cards/preview")
            assert preview.status_code == 200, preview.text
            body = preview.json()
            assert body["create_count"] == 1
            assert body["revive_count"] == 0
            by_item = {row["sales_order_item_id"]: row for row in body["lines"]}
            assert by_item[product_item_id]["eligible"] is True
            assert by_item[product_item_id]["would_create"] is True
            assert by_item[product_item_id]["planned_unit_line_count"] == 2
            assert by_item[service_item_id]["eligible"] is False
            assert by_item[service_item_id]["skip_reason"] == "not_product"

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code == 201, generated.text
            gen = generated.json()
            assert len(gen["created"]) == 1
            assert gen["revived"] == []
            assert {row["reason"] for row in gen["skipped"]} >= {"not_product", "no_nomenclature"}
            card = gen["created"][0]
            card_id = card["id"]
            assert card["number"] == f"{order_number}-1"
            assert card["card_seq"] == 1
            assert card["status"] == "draft"
            assert card["nomenclature_type"] == "PRODUCT"
            assert len(card["unit_lines"]) == 2
            assert card["unit_lines"][0]["size"] == "M"
            assert card["unit_lines"][0]["personalization"] == "Иванов"
            assert card["operation_lines"] == []

            again = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert again.status_code == 201
            assert again.json()["created"] == []
            assert any(row["reason"] == "card_exists" for row in again.json()["skipped"])

            # Increase qty → sync adds unit line
            patched = client.patch(
                f"/orders/{order_id}/items/{product_item_id}",
                json={"quantity": "3"},
            )
            assert patched.status_code == 200, patched.text
            synced = client.post(f"/technical-cards/{card_id}/sync-unit-lines")
            assert synced.status_code == 200, synced.text
            assert len(synced.json()["unit_lines"]) == 3
            assert synced.json()["quantity"] == "3.000"

            # Decrease qty → sync removes from the end
            client.patch(
                f"/orders/{order_id}/items/{product_item_id}",
                json={"quantity": "1"},
            )
            synced_down = client.post(f"/technical-cards/{card_id}/sync-unit-lines")
            assert synced_down.status_code == 200
            assert [row["unit_index"] for row in synced_down.json()["unit_lines"]] == [1]

            cancelled = client.post(f"/technical-cards/{card_id}/cancel")
            assert cancelled.status_code == 200
            assert cancelled.json()["status"] == "cancelled"

            cancel_again = client.post(f"/technical-cards/{card_id}/cancel")
            assert cancel_again.status_code == 409

            preview_revive = client.post(f"/orders/{order_id}/technical-cards/preview")
            assert preview_revive.json()["revive_count"] == 1

            revived = client.post(
                f"/orders/{order_id}/technical-cards/generate",
                json={"sales_order_item_ids": [product_item_id]},
            )
            assert revived.status_code == 201, revived.text
            assert len(revived.json()["revived"]) == 1
            revived_card = revived.json()["revived"][0]
            assert revived_card["id"] == card_id
            assert revived_card["status"] == "draft"
            assert revived_card["number"] == f"{order_number}-1"
            assert len(revived_card["unit_lines"]) == 1

            listed = client.get(f"/orders/{order_id}/technical-cards")
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            fetched = client.get(f"/technical-cards/{card_id}")
            assert fetched.status_code == 200
            assert fetched.json()["sales_order_item_id"] == product_item_id
    finally:
        app.dependency_overrides.clear()


def test_generate_rejects_unknown_item_ids() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        lead_id = _add_lead(factory)
        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            bad = client.post(
                f"/orders/{order_id}/technical-cards/generate",
                json={"sales_order_item_ids": [999999]},
            )
            assert bad.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_one_card_per_eligible_item_persisted() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            noms = _seed_nomenclatures(db)
        lead_id = _add_lead(factory)
        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            first = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": noms["product"],
                    "snapshot_name": "А",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "10",
                },
            ).json()["id"]
            second = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": noms["product"],
                    "snapshot_name": "Б",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "10",
                },
            ).json()["id"]
            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code == 201
            assert len(generated.json()["created"]) == 2
            seqs = sorted(row["card_seq"] for row in generated.json()["created"])
            assert seqs == [1, 2]

        with factory() as db:
            cards = db.scalars(select(TechnicalCard)).all()
            assert len(cards) == 2
            assert {card.sales_order_item_id for card in cards} == {first, second}
            assert all(card.status == TechnicalCardStatus.DRAFT for card in cards)
            item_qty = {
                item.id: item.quantity
                for item in db.scalars(select(SalesOrderItem)).all()
            }
            for card in cards:
                assert len(card.unit_lines) == int(item_qty[card.sales_order_item_id])
    finally:
        app.dependency_overrides.clear()
