import pandas as pd
import pytest

from backend.app.data import quality
from backend.app.data.quality import (
    align_nav_panel,
    load_aligned_nav_returns,
    validate_nav_panel,
)


def test_align_nav_panel_monthly_last_value():
    panel = pd.DataFrame(
        {"FUND_A": [10.0, 11.0, 12.0], "FUND_B": [20.0, 22.0, 24.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-31", "2024-02-29"]),
    )
    aligned = align_nav_panel(panel, frequency="monthly")
    assert list(aligned.index.strftime("%Y-%m-%d")) == ["2024-01-31", "2024-02-29"]
    assert aligned.loc[pd.Timestamp("2024-01-31"), "FUND_A"] == 11.0


def test_align_nav_panel_weekly_last_value():
    panel = pd.DataFrame(
        {"FUND_A": [10.0, 11.0, 12.0]},
        index=pd.to_datetime(["2024-01-02", "2024-01-04", "2024-01-08"]),
    )
    aligned = align_nav_panel(panel, frequency="weekly")
    assert list(aligned.index.strftime("%Y-%m-%d")) == ["2024-01-05", "2024-01-08"]
    assert aligned.iloc[0]["FUND_A"] == 11.0


def test_align_nav_panel_caps_incomplete_month_to_latest_observation():
    panel = pd.DataFrame(
        {"FUND_A": [10.0, 11.0]},
        index=pd.to_datetime(["2024-07-01", "2024-07-24"]),
    )
    aligned = align_nav_panel(panel, frequency="monthly")
    assert list(aligned.index.strftime("%Y-%m-%d")) == ["2024-07-24"]
    assert aligned.iloc[0]["FUND_A"] == 11.0


def test_align_nav_panel_rejects_unknown_frequency():
    panel = pd.DataFrame({"FUND_A": [10.0]}, index=pd.to_datetime(["2024-01-02"]))
    with pytest.raises(ValueError, match="Unsupported NAV alignment frequency"):
        align_nav_panel(panel, frequency="hourly")


def test_validate_nav_panel_flags_missing_values():
    panel = pd.DataFrame({"FUND_A": [10.0, None]}, index=pd.to_datetime(["2024-01-31", "2024-02-29"]))
    issues = validate_nav_panel(panel, as_of=pd.Timestamp("2024-03-15"))
    assert any(issue["code"] == "missing_nav" for issue in issues)


def test_validate_nav_panel_flags_short_history():
    panel = pd.DataFrame({"FUND_A": [10.0, 11.0]}, index=pd.to_datetime(["2024-01-31", "2024-02-29"]))
    issues = validate_nav_panel(panel, min_complete_observations=3, as_of=pd.Timestamp("2024-03-15"))
    assert any(issue["code"] == "short_history" for issue in issues)


def test_validate_nav_panel_flags_stale_nav():
    panel = pd.DataFrame({"FUND_A": [10.0]}, index=pd.to_datetime(["2024-01-31"]))
    issues = validate_nav_panel(panel, stale_after_days=30, as_of=pd.Timestamp("2024-03-15"))
    assert any(issue["code"] == "stale_nav" for issue in issues)


def test_load_aligned_nav_returns_from_cached_sec_data():
    returns = load_aligned_nav_returns(["M0209_2548", "M0337_2550"], "2020-01-01", "2021-12-31")
    assert not returns.empty
    assert {"M0209_2548", "M0337_2550"}.issubset(set(returns.columns))


def test_load_aligned_nav_returns_does_not_forward_fill_missing_nav(monkeypatch):
    panel = pd.DataFrame(
        {"FUND_A": [10.0, None, 12.0]},
        index=pd.to_datetime(["2024-01-31", "2024-02-29", "2024-03-31"]),
    )
    monkeypatch.setattr(quality, "load_nav_panel", lambda proj_ids: panel)

    returns = load_aligned_nav_returns(["FUND_A"], "2024-01-01", "2024-03-31")

    assert returns.empty
