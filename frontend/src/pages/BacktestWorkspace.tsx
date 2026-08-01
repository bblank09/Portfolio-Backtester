import { useEffect, useState } from "react";
import { fetchFunds, runBacktest } from "../api/client";
import { AssumptionsStep } from "../components/AssumptionsStep";
import { PortfolioStep } from "../components/PortfolioStep";
import { RunOverlay } from "../components/RunOverlay";
import { RunSummary } from "../components/RunSummary";
import { Stepper } from "../components/Stepper";
import type { BacktestRequest, BacktestResult, SecFund, SecFundAllocation } from "../types/backtest";

const initialRequest: BacktestRequest = {
  assets: [],
  start_date: "2020-01-31",
  end_date: "2024-06-30",
  initial_capital: 100000,
  benchmark_proj_id: "",
  risk_free_rate_pct: 0,
  cashflow: { enabled: false, type: "contribution", amount: 0, frequency: "monthly", timing: "end" },
  rebalancing: { mode: "annual", threshold_pct: 5 },
  costs: { transaction_bps: 0, slippage_bps: 0, annual_drag_pct: 0 },
  data: { source: "sec_open_data", price_field: "nav_per_unit", frequency: "monthly" }
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
      advanceTo(2);
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
          <img alt="Portfolio Backtester" className="mark" src="/brand/topbar-mark.png" />
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
        <AssumptionsStep
          active={currentStep === 1}
          request={request}
          funds={funds}
          validationErrors={validationErrors}
          error={error}
          loading={loading}
          onChange={updateRequest}
          onBack={() => goToStep(0)}
          onRun={submit}
        />
        <div className={currentStep === 2 ? "page active" : "page"}>
          <RunSummary result={result} />
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => goToStep(1)} type="button">&larr; Adjust assumptions</button>
            <button className="btn btn-ghost" onClick={startOver} type="button">Start a new portfolio</button>
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <img alt="Supachok Julaupay signature mark" className="app-footer-mark" src={theme === "dark" ? "/brand/author-logo-dark.png" : "/brand/author-logo-light.png"} />
        <div className="app-footer-text">
          <span className="app-footer-name">Supachok Julaupay</span>
          <a href="https://github.com/bblank09" rel="noreferrer" target="_blank">github.com/bblank09</a>
        </div>
      </footer>

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
  if (request.cashflow.enabled && !(request.cashflow.amount > 0)) {
    errors.push("Cashflow amount must be greater than zero when cashflow is enabled.");
  }
  return errors;
}
