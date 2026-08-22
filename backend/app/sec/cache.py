import json
from functools import lru_cache
from itertools import pairwise
from pathlib import Path

import pandas as pd

NORMALIZED_DIR = Path("data/sec/normalized")


def write_parquet(name: str, rows: list[dict]) -> Path:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    path = NORMALIZED_DIR / f"{name}.parquet"
    frame = pd.DataFrame(rows)
    if name == "daily_nav":
        frame = deduplicate_nav_frame(frame)
    frame.to_parquet(path, index=False)
    return path


def write_manifest(manifest: dict) -> Path:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    path = NORMALIZED_DIR / "sec_data_manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def migrate_schema(name: str, defaults: dict[str, object]) -> list[str]:
    """Additively bring an existing cached parquet up to a target schema.

    Only ever *adds* columns (with the given default value) -- it never
    renames, drops, or overwrites an existing column's values, so a
    partially-migrated cache is always still readable by both old and new
    code, and re-running the migration is always a safe no-op. This is the
    strategy for schema changes driven by pulling more fields from SEC
    (e.g. fund_status/cancel_date on fund_classes once the full fund
    universe is fetched, checklist 8.8) without invalidating or having to
    re-download the whole cache.
    """
    path = NORMALIZED_DIR / f"{name}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"No cached parquet named {name!r} at {path}")
    df = pd.read_parquet(path)
    added = [column for column in defaults if column not in df.columns]
    if not added:
        return []
    for column in added:
        df[column] = defaults[column]  # type: ignore[call-overload]
    df.to_parquet(path, index=False)
    return added


def load_nav_panel(proj_ids: list[str]) -> pd.DataFrame:
    # `filters` is pushed down into the parquet read itself (row-group
    # pruning via pyarrow) so only the requested funds' rows are ever
    # materialized -- reading the whole file first and filtering in pandas
    # does not scale once the cache holds the full SEC fund universe.
    df = pd.read_parquet(NORMALIZED_DIR / "daily_nav.parquet", filters=[("proj_id", "in", proj_ids)])
    df = deduplicate_nav_frame(df)
    panel = df[df["proj_id"].isin(proj_ids)].pivot(
        index="nav_date",
        columns="proj_id",
        values="nav_per_unit",
    )
    panel.index = pd.to_datetime(panel.index)
    return panel.sort_index().dropna(how="all")


def complete_sec_calendar(observed_dates: pd.DatetimeIndex, *, max_closure_sessions: int = 5) -> pd.DatetimeIndex:
    """Build a session calendar without bridging a long data outage.

    SEC publishes at least one NAV on most open-market dates. Short weekday
    gaps are treated as closures/holidays; a long gap is retained as expected
    sessions so the engine reports it as missing data instead of silently
    treating an outage as a continuous daily run.
    """
    observed = pd.DatetimeIndex(observed_dates).normalize().unique().sort_values()
    if len(observed) < 2:
        return observed

    sessions = set(observed)
    for previous, following in pairwise(observed):
        gap = pd.bdate_range(previous, following)[1:-1]
        if len(gap) > max_closure_sessions:
            sessions.update(gap)
    return pd.DatetimeIndex(sorted(sessions))


def deduplicate_nav_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Validate and deterministically collapse duplicate NAV keys.

    A normalized NAV series is keyed by ``(proj_id, nav_date)``. Exact
    duplicate rows are harmless and can occur when a paginated SEC response
    is retried; conflicting values are a cache-integrity failure and must not
    be hidden by a pivot aggregation.
    """
    if frame.empty or not frame.duplicated(subset=["proj_id", "nav_date"]).any():
        return frame

    duplicate_rows = frame.loc[frame.duplicated(subset=["proj_id", "nav_date"], keep=False)].copy()
    value_columns = [column for column in frame.columns if column not in {"proj_id", "nav_date"}]
    if value_columns:
        distinct_values = duplicate_rows.groupby(["proj_id", "nav_date"], dropna=False)[value_columns].nunique(
            dropna=False
        )
        if bool((distinct_values > 1).any(axis=None)):
            raise ValueError("Conflicting duplicate NAV keys found in normalized SEC data.")

    return frame.drop_duplicates(subset=["proj_id", "nav_date"], keep="last").reset_index(drop=True)


@lru_cache(maxsize=4)
def _load_nav_calendar_cached(path: str, modified_ns: int, size: int) -> pd.DatetimeIndex:
    dates = pd.read_parquet(path, columns=["nav_date"])["nav_date"]
    observed = pd.DatetimeIndex(pd.to_datetime(dates).dropna().unique())
    return complete_sec_calendar(observed)


def load_nav_calendar() -> pd.DatetimeIndex:
    """Return the SEC-derived daily session calendar for completeness checks."""
    path = NORMALIZED_DIR / "daily_nav.parquet"
    stat = path.stat()
    return _load_nav_calendar_cached(str(path.resolve()), stat.st_mtime_ns, stat.st_size)
