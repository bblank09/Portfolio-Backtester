import pytest
from pydantic import ValidationError

from backend.app.domain.schemas import BacktestRequest


def valid_request():
    return {
        "objective": "monthly_dca",
        "assets": [
            {"proj_id": "M0209_2548", "display_name": "K-SET50", "weight": 60},
            {"proj_id": "M0337_2550", "display_name": "K-MONEY", "weight": 40},
        ],
        "start_date": "2020-01-31",
        "end_date": "2024-12-31",
        "initial_capital": 10000,
        "benchmark_proj_id": "M0209_2548",
        "cashflow": {"enabled": True, "type": "contribution", "amount": 500, "frequency": "monthly", "timing": "end"},
        "rebalancing": {"mode": "annual"},
        "costs": {"transaction_bps": 0, "slippage_bps": 0, "annual_drag_pct": 0},
        "data": {"source": "sec_open_data", "price_field": "nav_per_unit"},
    }


def test_valid_sec_backtest_request():
    request = BacktestRequest(**valid_request())
    assert request.assets[0].proj_id == "M0209_2548"
    assert request.data.source == "sec_open_data"


def test_weights_must_sum_to_100():
    payload = valid_request()
    payload["assets"][0]["weight"] = 50
    with pytest.raises(ValidationError, match="weights must sum to 100"):
        BacktestRequest(**payload)


def test_duplicate_asset_proj_ids_are_rejected():
    payload = valid_request()
    payload["assets"][1]["proj_id"] = payload["assets"][0]["proj_id"]

    with pytest.raises(ValidationError, match="duplicate asset proj_id"):
        BacktestRequest(**payload)


def test_accepted_weight_tolerance_is_normalized_to_100():
    payload = valid_request()
    payload["assets"][1]["weight"] = 39.995

    request = BacktestRequest(**payload)

    assert sum(asset.weight for asset in request.assets) == pytest.approx(100, abs=1e-12)


def test_data_source_must_be_sec_open_data():
    payload = valid_request()
    payload["data"]["source"] = "webull"
    with pytest.raises(ValidationError):
        BacktestRequest(**payload)


def test_monthly_withdrawal_requires_withdrawal_cashflow():
    payload = valid_request()
    payload["objective"] = "monthly_withdrawal"
    payload["cashflow"]["type"] = "contribution"
    with pytest.raises(ValidationError, match="monthly_withdrawal requires"):
        BacktestRequest(**payload)


def test_past_performance_disallows_recurring_cashflow():
    payload = valid_request()
    payload["objective"] = "past_performance"
    with pytest.raises(ValidationError, match="past_performance must not include"):
        BacktestRequest(**payload)


def test_start_date_must_be_before_end_date():
    payload = valid_request()
    payload["start_date"] = "2024-12-31"
    payload["end_date"] = "2024-12-31"
    with pytest.raises(ValidationError, match="start_date must be before end_date"):
        BacktestRequest(**payload)
