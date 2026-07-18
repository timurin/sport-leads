import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadStage


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def stage_payload(stages: list[dict[str, object]]) -> dict[str, object]:
    return {
        "stages": [
            {
                "id": stage["id"],
                "title": stage["title"],
                "accent_class": stage["accent_class"],
                "is_active": stage["is_active"],
                "sort_order": stage["sort_order"],
            }
            for stage in stages
        ],
        "transfers": {},
    }


def test_custom_stage_configuration_move_reload_and_transfer(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    defaults = client.get("/lead-stages")
    assert defaults.status_code == 200
    stages = defaults.json()
    assert [stage["id"] for stage in stages] == [
        "new",
        "contact",
        "qualification",
        "proposal",
        "waiting",
    ]

    stages[0]["title"] = "Новые обращения"
    stages[0]["sort_order"] = 1
    stages[1]["sort_order"] = 0
    stages.append(
        {
            "id": "custom-1",
            "title": "Тестовая стадия",
            "accent_class": "bg-slate-500",
            "is_active": True,
            "sort_order": 5,
        }
    )
    saved = client.put("/lead-stages", json=stage_payload(stages))
    assert saved.status_code == 200
    assert [stage["id"] for stage in saved.json()][:2] == ["contact", "new"]
    assert next(stage for stage in saved.json() if stage["id"] == "new")["title"] == "Новые обращения"

    with session_factory() as db:
        lead = Lead(contact_name="Тест", status="new")
        db.add(lead)
        db.commit()
        lead_id = lead.id

    moved = client.patch(f"/leads/{lead_id}", json={"status": "custom-1"})
    assert moved.status_code == 200
    assert moved.json()["status"] == "custom-1"
    assert client.get(f"/leads/{lead_id}").json()["status"] == "custom-1"

    updated_stages = client.get("/lead-stages").json()
    custom = next(stage for stage in updated_stages if stage["id"] == "custom-1")
    custom["is_active"] = False
    transfer_payload = stage_payload(updated_stages)
    transfer_payload["transfers"] = {"custom-1": "new"}
    transferred = client.put("/lead-stages", json=transfer_payload)
    assert transferred.status_code == 200
    assert client.get(f"/leads/{lead_id}").json()["status"] == "new"

    with session_factory() as db:
        custom_stage = db.get(LeadStage, "custom-1")
        assert custom_stage is not None and custom_stage.is_active is False
        events = list(
            db.scalars(
                select(LeadEvent).where(
                    LeadEvent.lead_id == lead_id,
                    LeadEvent.event_type == LeadEventType.LEAD_STATUS_CHANGED,
                )
            ).all()
        )
        assert len(events) == 2


def test_stage_configuration_rejects_invalid_transfers_and_reserved_ids(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    stages = client.get("/lead-stages").json()
    stages.append(
        {
            "id": "custom-1",
            "title": "Тестовая стадия",
            "accent_class": "bg-slate-500",
            "is_active": True,
            "sort_order": 5,
        }
    )
    assert client.put("/lead-stages", json=stage_payload(stages)).status_code == 200
    with session_factory() as db:
        db.add(Lead(contact_name="Тест", status="custom-1"))
        db.commit()

    stages[-1]["is_active"] = False
    assert client.put("/lead-stages", json=stage_payload(stages)).status_code == 409
    stages[-1]["id"] = "completed"
    assert client.put("/lead-stages", json=stage_payload(stages)).status_code == 409
