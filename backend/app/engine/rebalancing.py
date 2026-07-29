import pandas as pd

from backend.app.domain.enums import RebalanceMode


def rebalance_due(current_date: pd.Timestamp, previous_date: pd.Timestamp | None, mode: RebalanceMode) -> bool:
    if previous_date is None or mode == RebalanceMode.none:
        return False
    if mode == RebalanceMode.monthly:
        return True
    if mode == RebalanceMode.quarterly:
        return current_date.to_period("Q") != previous_date.to_period("Q")
    if mode == RebalanceMode.annual:
        return current_date.year != previous_date.year
    return False


def rebalance_values(values: pd.Series, target_weights: pd.Series) -> tuple[pd.Series, float, float]:
    total = float(values.sum())
    target_values = target_weights * total
    money_turnover = float((target_values - values).abs().sum() / 2)
    turnover_ratio = money_turnover / total if total else 0.0
    return target_values, turnover_ratio, money_turnover
