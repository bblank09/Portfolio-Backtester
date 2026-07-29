import { useEffect, useMemo, useState } from "react";
import { fetchFunds, runBacktest } from "../api/client";
import { AssumptionsStep } from "../components/AssumptionsStep";
import { ObjectiveStep } from "../components/ObjectiveStep";
import { PortfolioStep } from "../components/PortfolioStep";
import { RunOverlay } from "../components/RunOverlay";
import { RunSummary } from "../components/RunSummary";
import { Stepper } from "../components/Stepper";
import { objectives } from "../objectives/objectives";
import type { BacktestRequest, BacktestResult, Objective, SecFund, SecFundAllocation } from "../types/backtest";

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
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [unlockedStep, setUnlockedStep] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("pb-theme") === "dark" ? "dark" : "light"));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pb-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchFunds()
      .then((loadedFunds) => setFunds(loadedFunds))
      .catch((caught: Error) => setError(caught.message));
  }, []);

  const activeObjective = useMemo(
    () => objectives.find((objective) => objective.id === request.objective) ?? objectives[0],
    [request.objective]
  );
  const totalWeight = request.assets.reduce((sum, asset) => sum + asset.weight, 0);
  const validationErrors = validateRequest(request, totalWeight);

  function updateRequest(next: BacktestRequest | ((current: BacktestRequest) => BacktestRequest)) {
    setResult(null);
    setError("");
    setRequest(next);
  }

  function handleAssetsChange(assets: SecFundAllocation[]) {
    updateRequest((current) => {
      const stillHasBenchmark = assets.some((asset) => asset.proj_id === current.benchmark_proj_id);
      return {
        ...current,
        assets,
        benchmark_proj_id: stillHasBenchmark ? current.benchmark_proj_id : (assets[0]?.proj_id ?? "")
      };
    });
  }

  function applyObjective(id: Objective) {
    const config = objectives.find((objective) => objective.id === id);
    if (!config) return;
    updateRequest((current) => config.apply(current));
  }

  function goToStep(index: number) {
    setCurrentStep(index);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function advanceTo(index: number) {
    setUnlockedStep((current) => Math.max(current, index));
    goToStep(index);
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await runBacktest(request);
      setResult(response);
      advanceTo(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setRequest(initialRequest);
    setResult(null);
    setError("");
    setUnlockedStep(0);
    goToStep(0);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">PB</div>
          <span>Portfolio Backtester</span>
          <span className="tag">Historical portfolio backtesting</span>
        </div>
        <Stepper currentStep={currentStep} unlockedStep={unlockedStep} onStepClick={goToStep} />
        <button className="theme-toggle" onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))} type="button">
          Toggle theme
        </button>
      </header>

      <div className="main">
        <PortfolioStep
          active={currentStep === 0}
          funds={funds}
          onAssetsChange={handleAssetsChange}
          onContinue={() => advanceTo(1)}
        />
        <ObjectiveStep
          active={currentStep === 1}
          selected={request.objective}
          onSelect={applyObjective}
          onBack={() => goToStep(0)}
          onContinue={() => advanceTo(2)}
        />
        <AssumptionsStep
          active={currentStep === 2}
          request={request}
          objectiveConfig={activeObjective}
          funds={funds}
          validationErrors={validationErrors}
          loading={loading}
          onChange={updateRequest}
          onBack={() => goToStep(1)}
          onRun={submit}
        />
        <div className={currentStep === 3 ? "page active" : "page"}>
          {error ? <div className="card"><div className="banner"><span className="ic">&#9888;</span><span>{error}</span></div></div> : null}
          <RunSummary result={result} />
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => goToStep(2)} type="button">&larr; Adjust assumptions</button>
            <button className="btn btn-ghost" onClick={startOver} type="button">Start a new portfolio</button>
          </div>
        </div>
      </div>

      <RunOverlay open={loading} />
    </div>
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
