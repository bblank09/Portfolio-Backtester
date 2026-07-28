# Formula Reference

This project computes production outputs from cached SEC Open Data NAV observations. The current production frequency is month-end, so `m = 12` periods per year unless the engine configuration changes.

## Notation

| Symbol | Meaning |
| --- | --- |
| `NAV_t` | SEC NAV per unit at period `t` |
| `r_t` | Single-period return |
| `R_p,t` | Portfolio return at period `t` |
| `R_b,t` | Benchmark return at period `t` |
| `S_t` | Portfolio value at the start of period `t` |
| `E_t` | Portfolio value at the end of period `t` |
| `C_t` | Actual external cashflow applied in period `t` (positive contribution, negative withdrawal) |
| `V_t` | Portfolio value at period `t` |
| `n` | Number of observed return periods |
| `m` | Periods per year, currently `12` |
| `R_f` | Annual risk-free rate input |

## `simple_returns`

Purpose: convert SEC NAV observations into period returns for each selected fund and the benchmark.

```text
r_t = NAV_t / NAV_{t-1} - 1
```

Equivalent form:

```text
r_t = (NAV_t - NAV_{t-1}) / NAV_{t-1}
```

Implementation detail: the function uses pandas `pct_change(fill_method=None)` and drops rows with missing observations according to the configured `drop` rule. It never forward-fills a missing NAV into a fabricated return. In production backtesting, selected-asset periods must be complete; benchmark metrics use only periods with real matched returns.

Used in output:

- Monthly Returns.
- Equity Curve return path.
- Benchmark Risk calculations.
- Annual Returns aggregation.

## `time_weighted_return`

Purpose: measure compounded investment performance independent of cashflow size.

```text
TWRR = product_{t=1..n}(1 + R_p,t) - 1
```

Where:

- `R_p,t` is the cashflow-neutral portfolio return for period `t`. For beginning-of-period cashflows, `R_p,t = E_t / (S_t + C_t) - 1`; for end-of-period cashflows, `R_p,t = (E_t - C_t) / S_t - 1`.
- `C_t` is the amount actually applied. A withdrawal is capped at available portfolio value, so it can be smaller in magnitude than the requested withdrawal.
- `n` is the number of valid aligned periods.

Interpretation: TWRR answers "what did the strategy return over the selected period?" without treating a larger DCA deposit or withdrawal as skill. Market returns, modeled costs, and rebalancing effects remain in the performance return.

Used in output:

- Summary: `TWRR`.
- Benchmark excess return:

```text
benchmark_excess_return = TWRR_portfolio - TWRR_benchmark
```

For this metric, both TWRRs are calculated from the date-aligned portfolio and benchmark return observations.

## `annualized_return`

Purpose: convert compounded period return into an annualized growth rate.

```text
R_ann = product_{t=1..n}(1 + r_t)^(m / n) - 1
```

Equivalent using total return:

```text
R_ann = (1 + TWRR)^(m / n) - 1
```

Where:

- `m = 12` for month-end returns.
- `n` is the number of observed periods.

Used in output:

- Summary: `TWRR CAGR`.
- Sharpe ratio numerator.
- CAPM-style alpha calculation.
- Information ratio numerator.

## `annualized_volatility`

Purpose: annualize return dispersion from period returns.

```text
sigma_ann = std(r_t, ddof=0) * sqrt(m)
```

Where:

- `std(r_t, ddof=0)` is the population standard deviation used by the engine for deterministic reporting.
- `m = 12` for month-end returns.

Used in output:

- Summary: `Volatility`.
- Sharpe ratio denominator.

Related ratio:

```text
Sharpe = (R_ann - R_f) / sigma_ann
```

If volatility is zero, Sharpe is reported as unavailable instead of dividing by zero.

## `max_drawdown`

Purpose: measure the largest peak-to-trough loss in the simulated portfolio value path.

First calculate running peak:

```text
Peak_t = max(V_0, V_1, ..., V_t)
```

Then calculate drawdown:

```text
DD_t = V_t / Peak_t - 1
```

Maximum drawdown:

```text
MDD = min(DD_t)
```

Where:

- `V_t` is the simulated portfolio value after NAV returns, cashflows, costs, and rebalancing logic for period `t`. Drawdown is value-path based, so external cashflows can change it even though they are excluded from TWRR.
- Drawdown is negative or zero.

Used in output:

- Summary: `Maximum drawdown`.
- Drawdown Curve.
- Drawdown Stress: `Repeat max drawdown` scenario.

## `beta_alpha`

Purpose: measure benchmark-relative risk and CAPM-style excess performance.

Cashflow-neutral portfolio and benchmark returns are first aligned by date:

```text
Aligned_t = (R_p,t, R_b,t)
```

Beta:

```text
beta = cov(R_p, R_b) / var(R_b)
```

Implementation detail: beta uses pandas covariance and sample variance for benchmark returns (`ddof=1` through pandas `var()`).

Annualized portfolio and benchmark returns:

```text
R_p,ann = product_{t=1..n}(1 + R_p,t)^(m / n) - 1
R_b,ann = product_{t=1..n}(1 + R_b,t)^(m / n) - 1
```

CAPM-style alpha:

```text
alpha = R_p,ann - [R_f + beta * (R_b,ann - R_f)]
```

Where:

- `R_f` is the annual risk-free rate input.
- `R_p,ann` is portfolio annualized return.
- `R_b,ann` is benchmark annualized return.

Used in output:

- Benchmark Risk: `beta`.
- Benchmark Risk: `alpha`.

## Tracking Error and Information Ratio

These are additional benchmark-risk formulas used in the report.

Active return:

```text
active_t = R_p,t - R_b,t
```

Tracking error:

```text
tracking_error = std(active_t, ddof=0) * sqrt(m)
```

Information ratio:

```text
information_ratio = (R_p,ann - R_b,ann) / tracking_error
```

If tracking error is zero, information ratio is reported as unavailable.

## Cashflow Accounting

Recurring contribution and withdrawal amounts are accounted separately from TWRR.

```text
total_contributed = initial_capital + sum(contribution_cashflows)
total_withdrawn = sum(withdrawal_cashflows)
net_profit = ending_value + total_withdrawn - total_contributed
```

`total_contributed` starts with initial capital and adds applied positive cashflows. `total_withdrawn` sums the absolute value of applied withdrawals, including any cap when a requested withdrawal exceeds the available portfolio value.

Used in output:

- Objective Summary for Monthly DCA.
- Objective Summary for Monthly Withdrawal.
- Cashflows tab.

## Cost Accounting

Transaction cost and slippage are specified in basis points.

```text
cost_rate = (transaction_bps + slippage_bps) / 10,000
trade_cost = traded_value * cost_rate
```

Annual drag is specified as a percent input and applied as a recurring model assumption by the engine where configured.

```text
total_costs = sum(trade_costs + drag_costs)
```

Used in output:

- Summary: `Total costs`.
- Rebalancing tab cost impact.

## Source Mapping

| Engine function | Report section | Primary output |
| --- | --- | --- |
| `simple_returns` | Growth, Returns, Benchmark Risk | Period returns |
| `time_weighted_return` | Summary, Objective Summary | TWRR |
| `annualized_return` | Summary, Benchmark Risk | TWRR CAGR, alpha inputs |
| `annualized_volatility` | Summary, Metrics | Volatility |
| `max_drawdown` | Drawdown, Drawdown Stress | Maximum drawdown |
| `beta_alpha` | Benchmark Risk | Beta, alpha |
