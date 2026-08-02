import pandas as pd
import pytest

from backend.app.data import quality
from backend.app.data.quality import (
    align_nav_panel,
    load_aligned_nav_returns,
    validate_nav_panel,
)
from backend.app.sec import cache as sec_cache


def test_load_nav_panel_pushes_proj_id_filter_down_to_parquet_read(monkeypatch, tmp_path):
    # With the full SEC universe this file will be far too large to load
    # entirely into memory on every backtest request -- read_parquet must be
    # told which proj_ids to keep via `filters`, not asked for everything and
    # filtered in pandas afterward.
    captured = {}

    def fake_read_parquet(path, filters=None, **kwargs):
        captured["path"] = path
        captured["filters"] = filters
        return pd.DataFrame(
            {
                "proj_id": ["FUND_A", "FUND_A"],
                "nav_date": ["2024-01-31", "2024-02-29"],
                "nav_per_unit": [10.0, 11.0],
            }
        )

    monkeypatch.setattr(pd, "read_parquet", fake_read_parquet)

    sec_cache.load_nav_panel(["FUND_A", "FUND_B"])

    assert captured["filters"] == [("proj_id", "in", ["FUND_A", "FUND_B"])]


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


def test_align_nav_panel_keeps_the_index_ordered_when_trailing_months_are_empty():
    # A record whose NAV is null creates a bucket with no observation. Capping
    # that bucket's month-end label down to the latest observed date would place
    # it before the preceding row, leaving a non-monotonic index that breaks
    # date-range slicing.
    panel = pd.DataFrame(
        {"FUND_A": [10.0, 11.0, None, None]},
        index=pd.to_datetime(["2024-01-31", "2024-02-15", "2024-02-29", "2024-03-31"]),
    )

    aligned = align_nav_panel(panel)

    assert aligned.index.is_monotonic_increasing
    assert not aligned.index.has_duplicates
    # The last label is capped to the latest observation, not left at 2024-03-31.
    assert aligned.index[-1] == pd.Timestamp("2024-02-15")
    assert aligned["FUND_A"].tolist() == [10.0, 11.0]


def test_align_nav_panel_still_caps_a_partial_final_month():
    panel = pd.DataFrame(
        {"FUND_A": [10.0, 11.0]},
        index=pd.to_datetime(["2024-01-31", "2024-02-15"]),
    )

    aligned = align_nav_panel(panel)

    assert [str(stamp.date()) for stamp in aligned.index] == ["2024-01-31", "2024-02-15"]


def test_min_complete_observations_scales_with_daily_frequency():
    from backend.app.api.backtests import min_complete_observations_for

    # 12 monthly observations is a ~1 year bar; the same "about a year" bar for
    # daily data is ~252 business days, not 12 calendar days.
    assert min_complete_observations_for("monthly") == 12
    assert min_complete_observations_for("daily") == 252
