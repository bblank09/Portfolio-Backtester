from enum import StrEnum


class Objective(StrEnum):
    past_performance = "past_performance"
    monthly_dca = "monthly_dca"
    monthly_withdrawal = "monthly_withdrawal"
    rebalancing_impact = "rebalancing_impact"


class Frequency(StrEnum):
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"


class CashflowType(StrEnum):
    contribution = "contribution"
    withdrawal = "withdrawal"


class CashflowTiming(StrEnum):
    beginning = "beginning"
    end = "end"


class RebalanceMode(StrEnum):
    none = "none"
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"


class DataSource(StrEnum):
    sec_open_data = "sec_open_data"


class PriceField(StrEnum):
    nav_per_unit = "nav_per_unit"
