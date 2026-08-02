# Manual Verification Sample — Phase 4.3/4.4

This folder holds the real backtest run used for the manual Excel
cross-check in item 4.4 (calculate every metric independently in Excel,
compare to the app's output to 6 decimal places).

## The run

- **Portfolio**: K-SET50 (`M0209_2548`) 60%, M-S50 (`M0155_2547`) 40%
- **Benchmark**: K-SET50
- **Period**: 2023-01-31 to 2023-05-31 (4 monthly return periods — short on
  purpose, so every number in this folder can be traced back to 5 NAV points
  per fund by hand)
- **Initial capital**: 100,000
- **Risk-free rate**: 2%/yr
- **No cashflow, no rebalancing, no transaction costs** — kept off so the
  first manual pass isn't also debugging cashflow/rebalancing timing at the
  same time. Those get their own dedicated run once the base metrics check out.
- **Run ID**: `run_20260802_031617_66dd285d` (also persisted in
  `data/runs/run_20260802_031617_66dd285d/` by the real running app —
  these files are copies for convenience)
- Ran against the real running app (`uvicorn`) hitting the real cached SEC
  NAV data — not a synthetic fixture.

## Files

- `4.3-request.json` — the exact request body sent.
- `4.3-result.json` — the full result the app returned (every tab's data).
- `4.3-report.md` — the exported research-report markdown for this run
  (`GET /api/backtests/{run_id}/report`).
- `4.3-raw-nav-inputs.csv` — the 5 month-end NAV-per-unit points per fund
  (Jan 31 through May 31, 2023) pulled directly from
  `data/sec/normalized/daily_nav.parquet`, resampled to month-end. This is
  the ground-truth input data Excel formulas should start from.

## Known result (for reference while building the Excel sheet)

The app reports a `short_history` quality warning ("Only 5 complete
observations are available; expected at least 12") — expected and correct
for a deliberately short window; not an error.
