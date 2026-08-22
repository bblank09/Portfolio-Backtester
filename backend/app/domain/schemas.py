import math
from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from .enums import (
    AlignmentFrequency,
    CashflowTiming,
    CashflowType,
    DataSource,
    Frequency,
    Objective,
    PriceField,
    RebalanceMode,
)


class FiniteNumberModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def reject_non_finite_numbers(cls, value: Any) -> Any:
        if value is None or isinstance(value, bool):
            return value
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return value
        if not math.isfinite(numeric):
            raise ValueError("numeric values must be finite")
        return value


class SecFundAllocation(FiniteNumberModel):
    proj_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    weight: float = Field(ge=0, le=100)


class CashflowRule(FiniteNumberModel):
    enabled: bool
    type: CashflowType = CashflowType.contribution
    amount: float = Field(ge=0)
    frequency: Frequency = Frequency.monthly
    timing: CashflowTiming = CashflowTiming.end


class RebalanceRule(FiniteNumberModel):
    mode: RebalanceMode = RebalanceMode.annual
    threshold_pct: float = Field(default=5.0, gt=0)


class CostAssumptions(FiniteNumberModel):
    transaction_bps: float = Field(ge=0)
    slippage_bps: float = Field(ge=0)
    annual_drag_pct: float = Field(ge=0)


class DataAssumptions(FiniteNumberModel):
    source: DataSource = DataSource.sec_open_data
    price_field: PriceField = PriceField.nav_per_unit
    frequency: AlignmentFrequency = AlignmentFrequency.monthly


class BacktestRequest(FiniteNumberModel):
    objective: Objective = Objective.past_performance
    assets: list[SecFundAllocation] = Field(min_length=1, max_length=20)
    start_date: date
    end_date: date
    initial_capital: float = Field(gt=0)
    benchmark_proj_id: str = Field(min_length=1)
    risk_free_rate_pct: float = Field(default=0.0, ge=0)
    cashflow: CashflowRule
    rebalancing: RebalanceRule
    costs: CostAssumptions
    data: DataAssumptions

    @model_validator(mode="after")
    def validate_request(self):
        asset_ids = [asset.proj_id for asset in self.assets]
        duplicate_ids = sorted({proj_id for proj_id in asset_ids if asset_ids.count(proj_id) > 1})
        if duplicate_ids:
            raise ValueError(f"duplicate asset proj_id values are not allowed: {duplicate_ids}")

        total = sum(asset.weight for asset in self.assets)
        if abs(total - 100) > 0.01:
            raise ValueError(f"weights must sum to 100, got {total:.4f}")
        scale = 100 / total
        for asset in self.assets:
            asset.weight *= scale
        self.assets[-1].weight += 100 - sum(asset.weight for asset in self.assets)

        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        if self.cashflow.enabled and self.cashflow.amount <= 0:
            raise ValueError("cashflow amount must be greater than zero when cashflow is enabled")
        return self


class MetricSummary(FiniteNumberModel):
    ending_value: float
    twrr: float
    irr: float | None = None
    twrr_cagr: float
    volatility: float
    sharpe: float | None = None
    sortino: float | None = None
    calmar: float | None = None
    var_95: float | None = None
    var_99: float | None = None
    max_drawdown: float
    benchmark_excess_return: float | None = None
    cashflow_count: int = 0
    rebalance_count: int = 0
    total_contributed: float = 0.0
    total_withdrawn: float = 0.0
    total_costs: float = 0.0


class RebalancingComparison(FiniteNumberModel):
    baseline_summary: MetricSummary
    deltas: dict[str, float]

    @field_validator("deltas")
    @classmethod
    def deltas_must_be_finite(cls, value: dict[str, float]) -> dict[str, float]:
        if any(not math.isfinite(number) for number in value.values()):
            raise ValueError("comparison deltas must be finite")
        return value


class TimeSeriesPoint(FiniteNumberModel):
    date: date
    value: float


class TableSection(FiniteNumberModel):
    title: str
    rows: list[dict[str, Any]]


class QualityIssue(FiniteNumberModel):
    code: str
    message: str
    severity: str = "warning"


class BacktestResult(FiniteNumberModel):
    run_id: str = ""
    created_at: str = ""
    data_source: DataSource = DataSource.sec_open_data
    request: BacktestRequest
    summary: MetricSummary
    equity_curve: list[TimeSeriesPoint]
    benchmark_curve: list[TimeSeriesPoint]
    drawdown_curve: list[TimeSeriesPoint]
    period_returns: TableSection | None = None
    # Compatibility with runs persisted before the frequency-neutral contract.
    monthly_returns: TableSection | None = None
    annual_returns: TableSection
    risk_metrics: TableSection
    diversification: TableSection
    asset_metrics: TableSection
    quality_issues: list[QualityIssue]
    cashflows: list[dict[str, Any]] = Field(default_factory=list)
    rebalances: list[dict[str, Any]] = Field(default_factory=list)
    rolling_correlation: list[dict[str, Any]] = Field(default_factory=list)
    rebalancing_comparison: RebalancingComparison | None = None
