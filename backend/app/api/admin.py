import io
import zipfile
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.app.core.config import settings
from backend.app.core.errors import AppHTTPException
from backend.app.domain.enums import ErrorCode

router = APIRouter(prefix="/admin", tags=["admin"])
RUNS_DIR = Path("data/runs")


@router.get("/export-runs")
def export_runs(token: str = "") -> StreamingResponse:
    # Fail closed: an unset BACKUP_TOKEN must refuse every request, not
    # accept an empty/missing token as "no auth required".
    if not settings.backup_token or token != settings.backup_token:
        raise AppHTTPException(
            status_code=403, detail="Invalid or missing backup token.", code=ErrorCode.INVALID_BACKUP_TOKEN
        )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        if RUNS_DIR.is_dir():
            for path in sorted(RUNS_DIR.rglob("*")):
                if path.is_file():
                    archive.write(path, arcname=path.relative_to(RUNS_DIR.parent))
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=runs-export.zip"},
    )
