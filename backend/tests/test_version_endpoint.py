"""Public /version marker (v0.9.0 release line)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import APP_VERSION, app


def test_version_endpoint_reports_0_9_0() -> None:
    client = TestClient(app)
    response = client.get("/version")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "0.9.0"
    assert body["version"] == APP_VERSION
    assert body["roadmap"] == "v0.9.0"
    assert body["project"] == "Sport Leads"


def test_root_and_health_include_version() -> None:
    client = TestClient(app)
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["version"] == APP_VERSION
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["version"] == APP_VERSION
