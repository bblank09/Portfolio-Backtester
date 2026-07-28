import csv
import json
import time
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import pandas as pd

from backend.app.sec.cache import write_manifest, write_parquet
from backend.app.sec.client import SecOpenDataClient
from backend.app.sec.endpoints import FUND_DAILY_NAV
from backend.app.sec.normalizers import normalize_daily_nav_record, records

START_DATE = date(2015, 1, 1)
MAX_RETRIES = 4
BASE_SLEEP_SECONDS = 0.25
PAGE_SIZE = 100


def classify_http_status(status_code: int) -> str:
    if status_code == 429:
        return "rate_limited"
    if status_code in (401, 403):
        return "auth_error"
    if 500 <= status_code <= 599:
        return "server_error"
    return "http_error"


def fetch_with_retry(client: SecOpenDataClient, params: dict) -> tuple[str, object | None, int | None, str]:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            payload = client.get(FUND_DAILY_NAV, params)
            if not records(payload):
                return "empty_response", payload, 200, ""
            return "success", payload, 200, ""
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            classification = classify_http_status(status_code)
            retry_after = exc.response.headers.get("Retry-After")
            if classification in ("rate_limited", "server_error") and attempt < MAX_RETRIES:
                sleep_for = float(retry_after) if retry_after else BASE_SLEEP_SECONDS * (2 ** attempt)
                time.sleep(sleep_for)
                continue
            return classification, None, status_code, str(exc)
        except httpx.RequestError as exc:
            if attempt < MAX_RETRIES:
                time.sleep(BASE_SLEEP_SECONDS * (2 ** attempt))
                continue
            return "network_error", None, None, str(exc)
    return "network_error", None, None, "Retry loop exhausted without a terminal response."


def raw_file_for(raw_dir: Path, proj_id: str, page_no: int) -> Path:
    safe_proj_id = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in proj_id)
    return raw_dir / f"{safe_proj_id}_{page_no:04d}.json"


def main():
    universe_path = Path("data/sec/mvp_fund_universe.csv")
    if not universe_path.exists():
        raise SystemExit("Run scripts/sec_build_mvp_universe.py and verify the generated universe before downloading NAV.")
    funds = list(csv.DictReader(universe_path.open(encoding="utf-8")))
    if not funds:
        raise SystemExit("MVP universe is empty. Rebuild data/sec/mvp_fund_universe.csv before downloading NAV.")

    snapshot_time = datetime.now(UTC)
    run_id = snapshot_time.strftime("%Y%m%d_%H%M%S")
    raw_dir = Path("data/sec/raw/daily_nav") / run_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    nav_rows = []
    ledger_rows = []
    end_date = snapshot_time.date()
    client = SecOpenDataClient()

    for fund in funds:
        proj_id = fund["proj_id"]
        next_cursor = ""
        page_no = 0
        while True:
            page_no += 1
            params = {
                "proj_id": proj_id,
                "start_nav_date": START_DATE.isoformat(),
                "end_nav_date": end_date.isoformat(),
                "page_size": PAGE_SIZE,
            }
            if next_cursor:
                params["next_cursor"] = next_cursor
            classification, payload, status_code, error = fetch_with_retry(client=client, params=params)
            record_count = len(records(payload)) if payload is not None else 0
            ledger_rows.append(
                {
                    "proj_id": proj_id,
                    "page_no": page_no,
                    "status": classification,
                    "http_status": status_code,
                    "record_count": record_count,
                    "error": error,
                    "next_cursor_present": bool(payload.get("next_cursor")) if isinstance(payload, dict) else False,
                }
            )
            if payload is not None:
                raw_file_for(raw_dir, proj_id, page_no).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            if classification != "success":
                break
            for record in records(payload):
                nav_rows.append(normalize_daily_nav_record(record, proj_id=proj_id))
            next_cursor = payload.get("next_cursor") if isinstance(payload, dict) else ""
            if not next_cursor:
                break
            time.sleep(BASE_SLEEP_SECONDS)

    write_parquet("daily_nav", nav_rows)
    write_parquet("fund_classes", funds)
    write_parquet("nav_request_ledger", ledger_rows)
    blocking_statuses = {"rate_limited", "auth_error", "server_error", "network_error", "http_error"}
    blocking = [row for row in ledger_rows if row["status"] in blocking_statuses]
    status_counts = pd.Series([row["status"] for row in ledger_rows]).value_counts().to_dict() if ledger_rows else {}
    manifest = {
        "source": "SEC Open Data",
        "endpoint": FUND_DAILY_NAV,
        "start": START_DATE.isoformat(),
        "end": end_date.isoformat(),
        "raw_dir": str(raw_dir),
        "fund_count": len(funds),
        "nav_rows": len(nav_rows),
        "request_count": len(ledger_rows),
        "status_counts": status_counts,
        "valid_for_backtest": len(blocking) == 0 and len(nav_rows) > 0,
    }
    write_manifest(manifest)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    if blocking:
        raise SystemExit("SEC NAV download has blocking request failures. Inspect data/sec/normalized/nav_request_ledger.parquet before continuing.")


if __name__ == "__main__":
    main()
