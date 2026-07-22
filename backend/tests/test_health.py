import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_liveness() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_health_ready() -> None:
    response = client.get("/health/ready")

    if response.status_code == 503:
        pytest.skip("database not available for readiness check")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["database"] == "ok"
