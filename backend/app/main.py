from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.backtests import router as backtests_router
from backend.app.api.funds import router as funds_router

app = FastAPI(title="SEC Open Data Portfolio Backtester", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(funds_router)
app.include_router(backtests_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "data_source": "sec_open_data"}
