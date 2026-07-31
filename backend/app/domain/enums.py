from enum import StrEnum


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
    threshold = "threshold"


class DataSource(StrEnum):
    sec_open_data = "sec_open_data"


class PriceField(StrEnum):
    nav_per_unit = "nav_per_unit"


class AlignmentFrequency(StrEnum):
    monthly = "monthly"
    daily = "daily"
