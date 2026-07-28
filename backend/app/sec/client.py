import httpx

from backend.app.core.config import settings


class SecOpenDataClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key if api_key is not None else settings.sec_api_key
        self.base_url = (base_url or settings.sec_api_base_url).rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "Cache-Control": "no-cache",
            "Accept": "application/json",
        }

    def get(self, path: str, params: dict | None = None):
        url = f"{self.base_url}{path}"
        response = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        response.raise_for_status()
        if response.status_code == 204 or not response.content.strip():
            return {}
        return response.json()

    def post(self, path: str, payload: dict | list | None = None):
        url = f"{self.base_url}{path}"
        response = httpx.post(url, headers=self._headers(), json=payload or {}, timeout=30)
        response.raise_for_status()
        if response.status_code == 204 or not response.content.strip():
            return {}
        return response.json()
