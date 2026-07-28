import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchFunds, runBacktest } from "../api/client";
import { AssumptionPanel } from "../components/AssumptionPanel";
import { FundSelector } from "../components/FundSelector";
import { PortfolioEditor } from "../components/PortfolioEditor";
import { RunSummary } from "../components/RunSummary";
import { objectives } from "../objectives/objectives";
import type { BacktestRequest, BacktestResult, Objective, SecFund } from "../types/backtest";

const initialRequest: BacktestRequest = {
  objective: "past_performance",
  assets: [],
  start_date: "2020-01-31",
  end_date: "2024-12-31",
  initial_capital: 100000,
  benchmark_proj_id: "",
  risk_free_rate_pct: 0,
  cashflow: { enabled: false, type: "contribution", amount: 0, frequency: "monthly", timing: "end" },
  rebalancing: { mode: "annual" },
  costs: { transaction_bps: 0, slippage_bps: 0, annual_drag_pct: 0 },
  data: { source: "sec_open_data", price_field: "nav_per_unit" }
};

export function BacktestWorkspace() {
  const [funds, setFunds] = useState<SecFund[]>([]);
  const [request, setRequest] = useState<BacktestRequest>(initialRequest);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFunds()
      .then((loadedFunds) => {
        setFunds(loadedFunds);
        setRequest((current) => {
          const defaults = loadedFunds.slice(0, 2);
          if (current.assets.length || defaults.length < 2) return current;
          return {
            ...current,
            benchmark_proj_id: defaults[0].proj_id,
            assets: defaults.map((fund) => ({
              proj_id: fund.proj_id,
              display_name: fund.display_name,
              weight: 50
            }))
          };
        });
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  const selectedIds = request.assets.map((asset) => asset.proj_id);
  const totalWeight = request.assets.reduce((sum, asset) => sum + asset.weight, 0);
  const activeObjective = useMemo(
    () => objectives.find((objective) => objective.id === request.objective) ?? objectives[0],
    [request.objective]
  );
  const validationErrors = validateRequest(request, totalWeight);
  const canRun = validationErrors.length === 0 && !loading;

  function updateRequest(next: BacktestRequest | ((current: BacktestRequest) => BacktestRequest)) {
    setResult(null);
    setError("");
    setRequest(next);
  }

  function applyObjective(id: Objective) {
    const config = objectives.find((objective) => objective.id === id);
    if (!config) return;
    updateRequest((current) => config.apply(current));
  }

  function addFund(fund: SecFund) {
    updateRequest((current) => {
      const nextAssets = [...current.assets, { proj_id: fund.proj_id, display_name: fund.display_name, weight: 0 }];
      const equalWeight = Number((100 / nextAssets.length).toFixed(2));
      return {
        ...current,
        benchmark_proj_id: current.benchmark_proj_id || fund.proj_id,
        assets: nextAssets.map((asset) => ({ ...asset, weight: equalWeight }))
      };
    });
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await runBacktest(request);
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspace">
      <header className="topBar">
        <div className="topBarTitle">
          <h1>Portfolio Backtester</h1>
          <span className="topBarSubtitle">Historical portfolio backtesting</span>
        </div>
        <div className="topActions">
          {validationErrors.length ? (
            <span className="runStatus" title={validationErrors[0]}>
              {validationErrors.length} to fix
            </span>
          ) : null}
          <button className="primaryButton" disabled={!canRun} onClick={submit} type="button">
            <Play size={16} /> {loading ? "Running" : "Run backtest"}
          </button>
        </div>
      </header>

      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="mainGrid">
        <div className="leftRail">
          <section className="panel">
            <div className="panelHeader">
              <h2>Objective preset</h2>
            </div>
            <div className="objectiveGrid" aria-label="Objective presets">
              {objectives.map((objective) => (
                <button
                  className={request.objective === objective.id ? "objectiveCard active" : "objectiveCard"}
                  key={objective.id}
                  onClick={() => applyObjective(objective.id)}
                  type="button"
                >
                  <strong>{objective.label}</strong>
                </button>
              ))}
            </div>
          </section>
          <FundSelector funds={funds} query={query} onQueryChange={setQuery} onAdd={addFund} selectedIds={selectedIds} />
          <PortfolioEditor
            assets={request.assets}
            onRemove={(projId) => updateRequest((current) => {
              const assets = current.assets.filter((asset) => asset.proj_id !== projId);
              return {
                ...current,
                assets,
                benchmark_proj_id: current.benchmark_proj_id === projId ? assets[0]?.proj_id ?? "" : current.benchmark_proj_id
              };
            })}
            onWeightChange={(projId, weight) =>
              updateRequest((current) => ({
                ...current,
                assets: current.assets.map((asset) => (asset.proj_id === projId ? { ...asset, weight } : asset))
              }))
            }
          />
          <AssumptionPanel request={request} objectiveConfig={activeObjective} funds={funds} onChange={updateRequest} />
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Review and Run</h2>
              </div>
              <span className={validationErrors.length ? "badge warn" : "badge success"}>{validationErrors.length ? "Check" : "Ready"}</span>
            </div>
            {validationErrors.length ? (
              <div className="validationList">
                {validationErrors.map((item) => <div className="errorLine" key={item}>{item}</div>)}
              </div>
            ) : null}
          </section>
        </div>
        <RunSummary result={result} />
      </div>
    </main>
  );
}

function validateRequest(request: BacktestRequest, totalWeight: number) {
  const errors: string[] = [];
  if (!request.assets.length) errors.push("Add at least one SEC fund.");
  if (Math.abs(totalWeight - 100) > 0.01) errors.push(`Weights sum to ${totalWeight.toFixed(1)}%, not 100%.`);
  if (!request.benchmark_proj_id) errors.push("Select a benchmark SEC fund.");
  if (new Date(request.start_date) >= new Date(request.end_date)) errors.push("Start date must be before end date.");
  if (!(request.initial_capital > 0)) errors.push("Initial capital must be greater than zero.");
  if (request.objective === "past_performance" && request.cashflow.enabled) {
    errors.push("Past Performance requires cashflow disabled.");
  }
  if (request.objective === "monthly_dca") {
    if (!request.cashflow.enabled || request.cashflow.type !== "contribution" || request.cashflow.frequency !== "monthly") {
      errors.push("Monthly DCA requires enabled monthly contribution.");
    }
    if (!(request.cashflow.amount > 0)) errors.push("Monthly DCA requires contribution amount greater than zero.");
  }
  if (request.objective === "monthly_withdrawal") {
    if (!request.cashflow.enabled || request.cashflow.type !== "withdrawal" || request.cashflow.frequency !== "monthly") {
      errors.push("Monthly Withdrawal requires enabled monthly withdrawal.");
    }
    if (!(request.cashflow.amount > 0)) errors.push("Monthly Withdrawal requires withdrawal amount greater than zero.");
  }
  if (request.objective === "rebalancing_impact" && request.rebalancing.mode === "none") {
    errors.push("Rebalancing Impact requires a rebalancing mode other than None.");
  }
  return errors;
}
