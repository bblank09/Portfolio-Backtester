import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from backend.app.data.quality import align_nav_panel, validate_nav_panel
from backend.app.domain.schemas import BacktestRequest
from backend.app.engine.backtest import run_backtest
from backend.app.reports.artifacts import write_cqf_report
from backend.app.sec.cache import load_nav_panel

router = APIRouter(prefix="/api/backtests", tags=["backtests"])
RUNS_DIR = Path("data/runs")


@router.post("")
def create_backtest(request: BacktestRequest) -> dict[str, Any]:
    if request.data.source != "sec_open_data":
        raise HTTPException(status_code=400, detail="Production backtests only support SEC Open Data.")

    proj_ids = sorted({asset.proj_id for asset in request.assets} | {request.benchmark_proj_id})
    try:
        nav = align_nav_panel(load_nav_panel(proj_ids))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="SEC NAV cache is missing. Run scripts/sec_download_mvp.py.") from exc

    selected_nav = nav.loc[pd.Timestamp(request.start_date) : pd.Timestamp(request.end_date), proj_ids]
    quality_issues = validate_nav_panel(selected_nav, as_of=pd.Timestamp(request.end_date))
    try:
        result = run_backtest(request, nav)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result["quality_issues"] = quality_issues
    result["run_id"] = make_run_id()
    result["created_at"] = utc_now().isoformat(timespec="seconds").replace("+00:00", "Z")
    result["data_source"] = "sec_open_data"
    persist_run(result["run_id"], request, result)
    return to_jsonable(result)


@router.get("/{run_id}/report", response_class=PlainTextResponse)
def get_backtest_report(run_id: str) -> str:
    try:
        report_path = write_cqf_report(run_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Backtest run not found: {run_id}") from exc
    return report_path.read_text(encoding="utf-8")


def make_run_id() -> str:
    return f"run_{utc_now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"


def utc_now() -> datetime:
    return datetime.now(UTC)


def persist_run(run_id: str, request: BacktestRequest, result: dict[str, Any]) -> None:
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    (run_dir / "request.json").write_text(
        json.dumps(request.model_dump(mode="json"), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (run_dir / "result.json").write_text(
        json.dumps(to_jsonable(result), indent=2, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if hasattr(value, "item"):
        return to_jsonable(value.item())
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    return value
