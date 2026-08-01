from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.backtests import router as backtests_router
from backend.app.api.funds import router as funds_router
from backend.app.core.config import settings

app = FastAPI(title="SEC Open Data Portfolio Backtester", version="0.1.0")
_allowed_origins = settings.allowed_origins_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    # Credentials + wildcard origin is invalid per the CORS spec (browsers
    # reject it); this API has no cookies/sessions anyway, so only allow
    # credentials when the deployer has configured specific origins.
    allow_credentials=_allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(funds_router)
app.include_router(backtests_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "data_source": "sec_open_data"}


# Production convenience: when a built frontend is present (Docker image, or
# `npm run build` run locally), serve it from the same FastAPI process/port so
# there is nothing extra to host or CORS-configure. In dev, the frontend runs
# under its own Vite server instead and frontend/dist never exists, so none of
# this registers -- `npm run dev` is completely unaffected.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str) -> FileResponse:
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
