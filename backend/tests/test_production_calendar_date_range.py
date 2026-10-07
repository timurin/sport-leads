from datetime import date

import pytest

from app.models.calendar_assignment import CalendarAssignment
from tests.test_production_calendar_entry import entry_client, create, URL


def test_single_day_create_and_legacy_edit(entry_client):
    client, factory, _ = entry_client
    row = create(client)
    assert row["planned_date"] == row["planned_start_date"] == row["planned_end_date"] == "2026-10-05"
    with factory() as db:
        db.add(CalendarAssignment(technical_card_id=2, production_stage_id=2,
                                  planned_date=date(2026, 10, 6), position=9))
        db.commit()
    legacy = client.get("/production-calendar/board?from=2026-10-06&to=2026-10-06").json()["assignments"][0]
    assert legacy["planned_end_date"] == legacy["planned_start_date"] == "2026-10-06"
    moved = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 2, "planned_date": "2026-10-12"})
    assert moved.status_code == 200
    assert moved.json()["planned_end_date"] == moved.json()["planned_start_date"] == "2026-10-12"


def test_multiday_edit_overlap_reload_and_stage_filter(entry_client):
    client, factory, _ = entry_client
    row = create(client)
    response = client.put(f"{URL}/{row['id']}", json={
        "production_stage_id": 2, "planned_start_date": "2026-10-03",
        "planned_end_date": "2026-10-08", "position": 7, "note": "Span",
    })
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["planned_date"] == saved["planned_start_date"] == "2026-10-03"
    assert saved["planned_end_date"] == "2026-10-08"
    with factory() as db:
        persisted = db.get(CalendarAssignment, row["id"])
        assert persisted.planned_start_date == date(2026, 10, 3)
        assert persisted.planned_end_date == date(2026, 10, 8)
        assert persisted.position == 7 and persisted.note == "Span"
    for start, end, included in [
        ("2026-10-05", "2026-10-11", True),
        ("2026-10-08", "2026-10-08", True),
        ("2026-10-03", "2026-10-03", True),
        ("2026-10-04", "2026-10-06", True),
        ("2026-09-28", "2026-10-04", True),
        ("2026-10-09", "2026-10-15", False),
        ("2026-09-26", "2026-10-02", False),
    ]:
        result = client.get(f"/production-calendar/board?from={start}&to={end}&stage_id=2").json()
        assert result["assignments"] == ([saved] if included else [])
    assert client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11&stage_id=1").json()["assignments"] == []


@pytest.mark.parametrize("dates", [
    {"planned_start_date": "2026-10-08", "planned_end_date": "2026-10-03"},
    {"planned_date": "2026-10-08", "planned_start_date": "2026-10-03"},
    {"planned_start_date": "bad-date"}, {"planned_start_date": "2026-02-30"},
    {"planned_date": None}, {"planned_start_date": "2026-10-05", "planned_end_date": None}, {},
])
def test_invalid_range_never_mutates_assignment(entry_client, dates):
    client, _, _ = entry_client
    row = create(client)
    response = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 2, **dates})
    assert response.status_code == 422
    assert client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11").json()["assignments"] == [row]


def test_legacy_alias_with_end_and_subsequent_single_day_move(entry_client):
    client, _, _ = entry_client
    row = create(client)
    response = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 2,
        "planned_date": "2026-10-05", "planned_end_date": "2026-10-09"})
    assert response.status_code == 200 and response.json()["planned_end_date"] == "2026-10-09"
    response = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 2, "planned_date": "2026-10-12"})
    assert response.status_code == 200
    assert response.json()["planned_end_date"] == "2026-10-12"
