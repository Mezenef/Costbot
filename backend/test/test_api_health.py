from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_security_headers_present():
    response = client.get("/health")
    assert "x-request-id" in response.headers
    assert response.headers.get("x-content-type-options") == "nosniff"