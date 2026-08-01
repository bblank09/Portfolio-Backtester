from pathlib import Path

import pandas as pd
from fastapi import APIRouter

from backend.app.core.errors import AppHTTPException
from backend.app.domain.enums import ErrorCode

router = APIRouter(prefix="/api/funds", tags=["funds"])
UNIVERSE_PATH = Path("data/sec/mvp_fund_universe.csv")


@router.get("")
def list_funds() -> dict:
    if not UNIVERSE_PATH.exists():
        raise AppHTTPException(
            status_code=503,
            detail="SEC fund universe cache is missing. Run scripts/sec_build_mvp_universe.py.",
            code=ErrorCode.FUND_UNIVERSE_CACHE_MISSING,
        )
    funds = pd.read_csv(UNIVERSE_PATH).fillna("")
    return {
        "data_source": "sec_open_data",
        "funds": funds.to_dict(orient="records"),
    }
