import httpx

from backend.app.sec.client import SecOpenDataClient


def test_sec_client_builds_configured_headers():
    client = SecOpenDataClient(api_key="abc123", base_url="https://api.sec.or.th")
    headers = client._headers()
    assert headers["Ocp-Apim-Subscription-Key"] == "abc123"
    assert headers["Accept"] == "application/json"


def test_sec_client_treats_204_as_empty_payload(monkeypatch):
    def fake_get(*args, **kwargs):
        request = httpx.Request("GET", "https://api.sec.or.th/empty")
        return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx, "get", fake_get)
    client = SecOpenDataClient(api_key="abc123", base_url="https://api.sec.or.th")
    assert client.get("/empty") == {}
