from datetime import date

import pandas as pd

from backend.app.sec.cache import load_nav_panel


def align_nav_panel(panel: pd.DataFrame, frequency: str = "monthly") -> pd.DataFrame:
    sorted_panel = panel.sort_index()
    if frequency == "monthly":
        return cap_incomplete_period_label(sorted_panel.resample("ME").last(), sorted_panel)
    if frequency == "weekly":
        return cap_incomplete_period_label(sorted_panel.resample("W-FRI").last(), sorted_panel)
    if frequency == "daily":
        return sorted_panel.dropna(how="all")
    raise ValueError(f"Unsupported NAV alignment frequency: {frequency}")


def cap_incomplete_period_label(aligned: pd.DataFrame, source_panel: pd.DataFrame) -> pd.DataFrame:
    if aligned.empty or source_panel.empty:
        return aligned
    latest_source_date = source_panel.dropna(how="all").index.max()
    if pd.isna(latest_source_date) or aligned.index[-1] <= latest_source_date:
        return aligned
    capped = aligned.copy()
    index_values = list(capped.index)
    index_values[-1] = latest_source_date
    capped.index = pd.DatetimeIndex(index_values)
    return capped


def validate_nav_panel(
    panel: pd.DataFrame,
    *,
    min_complete_observations: int = 12,
    stale_after_days: int = 45,
    as_of: date | pd.Timestamp | None = None,
) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if panel.empty:
        return [
            {
                "code": "empty_nav_panel",
                "message": "No NAV records available for the selected funds/date range.",
                "severity": "error",
            }
        ]

    sorted_panel = panel.sort_index()
    if sorted_panel.isna().any().any():
        missing_columns = sorted_panel.columns[sorted_panel.isna().any()].tolist()
        issues.append(
            {
                "code": "missing_nav",
                "message": f"Some funds have missing NAV values after alignment: {missing_columns}.",
                "severity": "warning",
            }
        )

    complete = sorted_panel.dropna(how="any")
    if len(complete) < min_complete_observations:
        issues.append(
            {
                "code": "short_history",
                "message": f"Only {len(complete)} complete observations are available; expected at least {min_complete_observations}.",
                "severity": "warning",
            }
        )

    if (sorted_panel <= 0).any().any():
        issues.append(
            {
                "code": "non_positive_nav",
                "message": "NAV contains zero or negative values.",
                "severity": "error",
            }
        )

    reference_date = pd.Timestamp(as_of) if as_of is not None else pd.Timestamp.today().normalize()
    last_observed = sorted_panel.apply(lambda col: col.dropna().index.max())
    stale_columns = [
        column
        for column, last_date in last_observed.items()
        if pd.notna(last_date) and (reference_date - pd.Timestamp(last_date)).days > stale_after_days
    ]
    if stale_columns:
        issues.append(
            {
                "code": "stale_nav",
                "message": f"Some funds have stale latest NAV observations: {stale_columns}.",
                "severity": "warning",
            }
        )

    return issues


def load_aligned_nav_returns(
    proj_ids: list[str],
    start_date: str | date,
    end_date: str | date,
    frequency: str = "monthly",
) -> pd.DataFrame:
    panel = load_nav_panel(proj_ids)
    filtered = panel.loc[pd.Timestamp(start_date) : pd.Timestamp(end_date)]
    aligned = align_nav_panel(filtered, frequency=frequency)
    return aligned.pct_change(fill_method=None).dropna(how="all")
