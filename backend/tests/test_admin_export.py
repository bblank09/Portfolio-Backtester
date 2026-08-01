import io
import zipfile

from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app


def test_export_without_a_configured_token_is_refused():
    # No BACKUP_TOKEN set anywhere -- must fail closed, not open.
    settings.backup_token = ""
    client = TestClient(app)

    response = client.get("/api/admin/export-runs", params={"token": "anything"})

    assert response.status_code == 403


def test_export_with_the_wrong_token_is_refused():
    settings.backup_token = "correct-token"
    client = TestClient(app)

    try:
        response = client.get("/api/admin/export-runs", params={"token": "wrong-token"})
        assert response.status_code == 403
    finally:
        settings.backup_token = ""


def test_export_with_no_token_query_param_is_refused():
    settings.backup_token = "correct-token"
    client = TestClient(app)

    try:
        response = client.get("/api/admin/export-runs")
        assert response.status_code in (400, 403, 422)
    finally:
        settings.backup_token = ""


def test_export_with_the_correct_token_returns_a_zip_of_real_run_data():
    settings.backup_token = "correct-token"
    client = TestClient(app)

    try:
        response = client.get("/api/admin/export-runs", params={"token": "correct-token"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"

        archive = zipfile.ZipFile(io.BytesIO(response.content))
        names = archive.namelist()
        # data/runs has real prior backtest runs committed in this repo --
        # confirm the zip actually contains request/result artifacts, not an
        # empty archive.
        assert any(name.endswith("request.json") for name in names)
        assert any(name.endswith("result.json") for name in names)
    finally:
        settings.backup_token = ""
