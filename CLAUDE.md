# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A full-stack historical portfolio backtester for Thai mutual funds: a FastAPI engine computing returns/risk/drawdown against a locally cached SEC Thailand Open Data NAV series, and a React/TypeScript dashboard for building portfolios and inspecting results. Scope is deliberately backtesting-only — **no Monte Carlo simulation, portfolio optimization, efficient frontier, or live trading/broker execution.** Don't add these.

## Commands

**Setup** (the project directory's name contains `:`, so the venv must live outside it):
```bash
python3 -m venv /private/tmp/sec_open_data_portfolio_backtester_venv
source /private/tmp/sec_open_data_portfolio_backtester_venv/bin/activate
python3 -m pip install -e ".[dev]"
npm --prefix frontend install
```

**Backend**
```bash
pytest                                    # full suite (backend/tests/), pythonpath="." set in pyproject.toml
pytest backend/tests/test_backtest_engine.py::test_name -v   # single test
ruff check .                              # lint
mypy backend                              # type-check (explicit_package_bases = true)
uvicorn backend.app.main:app --reload --port 8000
```

**Frontend** (from `frontend/`, or via root `package.json` proxies `frontend:dev`/`frontend:build`)
```bash
npm run dev        # Vite dev server, port 5173, proxies /api to VITE_API_PROXY_TARGET (default http://127.0.0.1:8001)
npm run build      # tsc -b && vite build — this IS the frontend's type-check; there's no separate typecheck script
npm run test:e2e   # Playwright, needs the prod build served first (see playwright.config.ts)
```

**Docker**: `docker compose up -d --build` serves the built frontend + API from one FastAPI process on port 8000. Uses a **named volume** (`pb-data:/app/data`), not a bind mount — bind-mount path parsing breaks on this project's directory name.

**Refreshing the SEC NAV cache** (only needed to update data, not to run/test the app):
```bash
python -m scripts.sec_build_mvp_universe        # rebuild data/sec/mvp_fund_universe.csv from SEC's fund-profiles API
python -m scripts.sec_download_mvp              # download NAV for that universe
python -m scripts.sec_annotate_universe_coverage # recompute nav_start/nav_end/gap columns on the universe CSV
```
Requires `SEC_API_KEY` in `.env` (copy from `.env.example`). Running/testing the app does **not** need this — it reads the already-committed parquet cache. A GitHub Actions workflow (`.github/workflows/refresh-sec-data.yml`) refreshes it daily, only committing if both the download and the full test suite pass.

## Architecture

**Data flow is one-directional and cache-centered:** SEC Open Data API → `backend/app/sec/` (fetch + normalize) → `data/sec/normalized/*.parquet` → `backend/app/engine/` (pure computation over the cached panel) → `backend/app/api/` (FastAPI) → `frontend/src/`. **`run_backtest()` never calls the SEC API** — every result is reproducible from the parquet cache alone, and the app works fully offline once the cache is populated. When changing anything in `backend/app/engine/` or `backend/app/data/quality.py`, verify against the real cached data (not just synthetic fixtures) — several past bugs here only reproduced at real data scale (see "Known landmines" below).

**Backend structure** (`backend/app/`):
- `sec/` — `client.py` (SEC API client, retries transient errors via `tenacity`), `cache.py` (parquet read/write, `load_nav_panel()`, additive schema migration via `migrate_schema()`), `normalizers.py` (raw SEC JSON → normalized rows), `endpoints.py`.
- `data/quality.py` — NAV panel alignment (`align_nav_panel()`, daily/weekly/monthly), completeness/gap detection (`compute_month_coverage()`, `find_longest_complete_window()`), validation (`validate_nav_panel()`). This is where "is this date range usable" logic lives — the backend is the single source of truth for that, not the frontend (see "Known landmines").
- `engine/` — `backtest.py` orchestrates; `returns.py` (simple/time-weighted/money-weighted return), `metrics.py` (Sharpe, Sortino, Calmar, VaR, beta/alpha, tracking error, information ratio, correlation), `cashflows.py`, `rebalancing.py`. Every formula is documented in `docs/formula-reference.md` with a citation — keep that file in sync with any formula change.
- `api/` — `funds.py` (`GET /api/funds`, `GET /api/funds/testable-range`), `backtests.py` (`POST /api/backtests`, persists `request.json`+`result.json` per run under `data/runs/<run_id>/`), `data_status.py`.
- `domain/` — `schemas.py` (Pydantic request/response models), `enums.py` (`ErrorCode` — every API error carries a machine-readable code alongside the human message).
- `core/` — `config.py` (env-driven settings), `errors.py` (`AppHTTPException` + handler), `limiter.py` (`slowapi` rate limiting on `/api/backtests`).

Routes are mounted twice — `/api/v1/*` and an unversioned `/api/*` alias — via `app.include_router()` called twice in `main.py`. The current frontend still calls the unversioned paths; don't remove the alias without checking all clients.

**Frontend structure** (`frontend/src/`): `pages/BacktestWorkspace.tsx` owns all top-level state and is the **4-step flow**: Portfolio → Objective → Assumptions → Results (`components/PortfolioStep.tsx`, `ObjectiveStep.tsx`, `AssumptionsStep.tsx`, `RunSummary.tsx`). `RunSummary.tsx` renders an **8-tab** result view: Summary, Growth, Drawdown, Returns, Metrics, Cashflows, Rebalancing, Report — hand-built SVG charting, no charting library dependency. `api/client.ts` is the only fetch layer; `types/backtest.ts` mirrors the backend Pydantic schemas by hand (no codegen — keep them in sync manually when either side changes).

**scripts/** are one-off or periodic data-pipeline tools (build universe, download NAV, repair failed downloads, dedupe cross-class contamination, migrate schema, verify reproducibility), not part of the request-serving path. Run as `python -m scripts.<name>` (they import from `backend.app.*`, so need the package importable, not run as a bare script).

## Known landmines (read before touching data/engine code)

- **pandas floor is `>=3.0` deliberately** (see the comment in `pyproject.toml`). pandas 2.2.3 has a confirmed silent data-corruption bug in `pivot_table`/`groupby+unstack` at wide-panel scale (~2,700 rows × 800+ columns) — the resulting index collapses to a handful of duplicate labels with **no error**. Don't lower this floor without re-verifying at real fund-universe scale, not just unit tests with small fixtures.
- **A `proj_id` alone does not uniquely identify a NAV series.** SEC's `daily-info/nav` endpoint returns *every* share class registered under a `proj_id`; different classes can have genuinely different NAV on the same date. `scripts/sec_download_mvp.py` filters to one designated class per `proj_id` at download time — if you write new code that reads `daily_nav.parquet` directly, don't assume `(proj_id, nav_date)` is unique without this filter already applied.
- **"Is this date range usable" is computed server-side, not client-side.** An earlier frontend-only heuristic (intersecting each fund's own `nav_start`/`nav_end`) looked reasonable but still let the UI's "Max" date preset select a range containing a real internal gap (e.g. a market-wide NAV reporting gap), because outer-bound intersection doesn't detect gaps *inside* the range. `GET /api/funds/testable-range` uses the identical `align_nav_panel` + completeness logic the engine applies to validate a request — reuse it rather than re-deriving range logic in the frontend.
- **Never forward-fill or interpolate a missing NAV observation.** A gap in the requested range is a hard error (`INSUFFICIENT_NAV_HISTORY`), by design — see `docs/methodology.md`.
- **A shared `?run=` link race, formerly misdiagnosed as an unfixable Playwright flake.** Opening a shared link fires two independent fetches (the full funds list and the one saved run); `PortfolioStep`'s auto-seed-example-portfolio effect fired as soon as the funds list resolved regardless of an already-loaded shared run, and its `onAssetsChange` → `updateRequest` call unconditionally cleared `result`. Fixed via a `skipAutoSeed` prop set whenever the page was opened with `?run=` (see `BacktestWorkspace.tsx` / `PortfolioStep.tsx`, and the history in `frontend/playwright.config.ts`'s comment). If a similarly-shaped "works standalone, fails intermittently in e2e" report shows up again, suspect a real state race before assuming automation-environment flakiness.
