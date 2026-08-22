import pandas as pd

from backend.app.domain.enums import (
    AlignmentFrequency,
    CashflowTiming,
    CashflowType,
    Frequency,
)
from backend.app.domain.schemas import BacktestRequest


def cashflow_due(
    index_position: int,
    request: BacktestRequest,
    *,
    current_date: pd.Timestamp | None = None,
    initial_date: pd.Timestamp | None = None,
    previous_date: pd.Timestamp | None = None,
    next_date: pd.Timestamp | None = None,
) -> bool:
    if not request.cashflow.enabled or index_position == 0:
        return False

    if (
        request.data.frequency == AlignmentFrequency.daily
        and current_date is not None
        and initial_date is not None
    ):
        # Daily NAV observations are irregular around weekends and holidays.
        # A recurring monthly/quarterly/annual rule must therefore be anchored
        # to calendar months, not to the number of observed rows.
        interval_months = {
            Frequency.monthly: 1,
            Frequency.quarterly: 3,
            Frequency.annual: 12,
        }[request.cashflow.frequency]
        initial_month = initial_date.year * 12 + initial_date.month
        current_month = current_date.year * 12 + current_date.month
        elapsed_months = current_month - initial_month
        if elapsed_months <= 0 or elapsed_months % interval_months:
            return False

        current_period = current_date.to_period("M")
        if request.cashflow.timing == CashflowTiming.beginning:
            return previous_date is None or previous_date.to_period("M") != current_period
        return next_date is None or next_date.to_period("M") != current_period

    if request.cashflow.frequency == Frequency.monthly:
        return True
    if request.cashflow.frequency == Frequency.quarterly:
        return index_position % 3 == 0
    if request.cashflow.frequency == Frequency.annual:
        return index_position % 12 == 0
    return False


def signed_cashflow_amount(request: BacktestRequest) -> float:
    if not request.cashflow.enabled:
        return 0.0
    if request.cashflow.type == CashflowType.withdrawal:
        return -request.cashflow.amount
    return request.cashflow.amount
