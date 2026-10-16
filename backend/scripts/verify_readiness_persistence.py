"""Verify PC-04.4Q against local PostgreSQL and the running API.

Temporary norms are restored even when a check fails. Scheduling is read-only.
Run from the repository root: python backend/scripts/verify_readiness_persistence.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # Register SQLAlchemy relationships.
from app.database.session import SessionLocal, engine
from app.models.tech_operation import TechOperation
from app.services.production_diagnostics import card_diagnostics
from app.services.production_demand import read_technical_card_demand
from app.services.production_scheduler import schedule_card
from app.services.routing_graph import read_card_graph, read_template_graph


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--operation-id", type=int, default=6)
    parser.add_argument("--routing-id", type=int, default=1)
    parser.add_argument("--card-id", type=int, default=2)
    parser.add_argument("--read-only", action="store_true", help="Verify saved norms without PATCH")
    args = parser.parse_args()
    if engine.url.host not in {"localhost", "127.0.0.1"} or engine.url.port != 5432:
        raise RuntimeError("Verification requires local PostgreSQL on port 5432")
    engine.echo = False
    output = Path("logs/pc-04-4q")
    output.mkdir(parents=True, exist_ok=True)
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30) as api:
        def get_operation():
            response = api.get(f"/tech-operations/{args.operation_id}")
            response.raise_for_status()
            return response.json()

        def patch(rule, seconds):
            response = api.patch(f"/tech-operations/{args.operation_id}", json={
                "demand_rule": rule, "demand_duration_seconds": seconds,
            })
            response.raise_for_status()

        def state():
            operation = get_operation()
            with SessionLocal() as db:
                stored = db.execute(select(TechOperation.demand_rule, TechOperation.demand_duration_seconds)
                    .where(TechOperation.id == args.operation_id)).one()
                routing = read_template_graph(db, args.routing_id).model_dump(mode="json")
                graph = read_card_graph(db, args.card_id).model_dump(mode="json")
                card = card_diagnostics(db, args.card_id).model_dump(mode="json")
                demand = read_technical_card_demand(db, args.card_id).model_dump(mode="json")
                preflight = schedule_card(db, args.card_id, persist=False).model_dump(mode="json")
            assert stored == (operation["demand_rule"], operation["demand_duration_seconds"])
            surfaces = (operation, routing, graph, card)
            issues = [[row for row in surface["diagnostics"]
                if row.get("operation_id") == args.operation_id and row["field"] in
                {"demand_rule", "demand_duration_seconds"}] for surface in surfaces]
            assert all(rows == issues[0] for rows in issues), "Demand diagnostics differ across surfaces"
            return dict(operation=operation, routing=routing, card_graph=graph,
                card=card, demand=demand, preflight=preflight, stored=list(stored))

        before = state()
        original = before["stored"]
        if args.read_only:
            print("DB/API/runtime reload verified:", original)
            return
        try:
            for rule, seconds in (("fixed_per_order", 3600), ("per_item", 120)):
                patch(rule, seconds)
                result = state()
                assert result["stored"] == [rule, seconds]
                for key in ("operation", "routing", "card_graph", "card"):
                    assert not any(row.get("operation_id") == args.operation_id and row["code"] ==
                        "missing_operator_norm" for row in result[key]["diagnostics"])
                demands = [row for step in result["demand"]["steps"] for row in step["demands"]
                    if row.get("operation_id") == args.operation_id]
                assert demands and all(row["status"] == "ready" for row in demands)
                assert all(row["details"]["demand_rule"] == rule for row in demands)
                assert not result["preflight"]["persisted"]
                output.joinpath(f"resumed-roundtrip-{rule}.json").write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                print(rule, "DB/API/diagnostics/Demand PASS; Scheduler:", result["preflight"]["status"])
        finally:
            patch(*original)
            assert state()["stored"] == original
            print("Original operation norm restored; no schedule persisted")


if __name__ == "__main__":
    main()
