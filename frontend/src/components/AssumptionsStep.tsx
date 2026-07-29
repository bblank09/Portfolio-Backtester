import { useState } from "react";
import { Play } from "lucide-react";
import type { BacktestRequest, SecFund } from "../types/backtest";

interface Props {
  active: boolean;
  request: BacktestRequest;
  funds: SecFund[];
  validationErrors: string[];
  error: string;
  loading: boolean;
  onChange: (request: BacktestRequest) => void;
  onBack: () => void;
  onRun: () => void;
}

export function AssumptionsStep({ active, request, funds, validationErrors, error, loading, onChange, onBack, onRun }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const showCashflow = request.cashflow.enabled;
  const cashflowLabel = request.cashflow.type === "withdrawal" ? "Withdrawal amount" : "Contribution amount";
  const canRun = validationErrors.length === 0 && !loading;

  return (
    <div className={active ? "page active" : "page"}>
      <div className="page-head">
        <h1>Set your assumptions</h1>
        <p>Every parameter below is yours to set directly &mdash; grouped by topic so it stays easy to fill in.</p>
      </div>

      <div className="card">
        <div className="section-title">Date range &amp; capital</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="startDate">Start date</label>
            <input className="field" id="startDate" type="date" value={request.start_date} onChange={(event) => onChange({ ...request, start_date: event.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="endDate">End date</label>
            <input className="field" id="endDate" type="date" value={request.end_date} onChange={(event) => onChange({ ...request, end_date: event.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="initialCapital">Initial capital</label>
            <input className="field num" id="initialCapital" min={1} type="number" value={request.initial_capital} onChange={(event) => onChange({ ...request, initial_capital: Number(event.target.value) })} />
          </div>
          <div className="form-field">
            <label htmlFor="benchmark">Benchmark</label>
            <select className="field" id="benchmark" value={request.benchmark_proj_id} onChange={(event) => onChange({ ...request, benchmark_proj_id: event.target.value })}>
              {funds.map((fund) => (
                <option key={`${fund.proj_id}-${fund.fund_class_name}`} value={fund.proj_id}>{fund.display_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>Cashflow</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="cashflowEnabled">Recurring cashflow</label>
            <select
              className="field"
              id="cashflowEnabled"
              value={String(request.cashflow.enabled)}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, enabled: event.target.value === "true" } })}
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="cashflowType">Type</label>
            <select
              className="field"
              disabled={!showCashflow}
              id="cashflowType"
              value={request.cashflow.type}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, type: event.target.value as BacktestRequest["cashflow"]["type"] } })}
            >
              <option value="contribution">Contribution</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="cashflowAmount">{cashflowLabel}</label>
            <input
              className="field num"
              disabled={!showCashflow}
              id="cashflowAmount"
              min={0}
              type="number"
              value={request.cashflow.amount}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, amount: Number(event.target.value) } })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="cashflowFrequency">Frequency</label>
            <select
              className="field"
              disabled={!showCashflow}
              id="cashflowFrequency"
              value={request.cashflow.frequency}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, frequency: event.target.value as BacktestRequest["cashflow"]["frequency"] } })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="cashflowTiming">Timing</label>
            <select
              className="field"
              disabled={!showCashflow}
              id="cashflowTiming"
              value={request.cashflow.timing}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, timing: event.target.value as BacktestRequest["cashflow"]["timing"] } })}
            >
              <option value="beginning">Beginning of period</option>
              <option value="end">End of period</option>
            </select>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>Rebalancing</div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="rebalancing">Mode</label>
            <select className="field" id="rebalancing" value={request.rebalancing.mode} onChange={(event) => onChange({ ...request, rebalancing: { mode: event.target.value as BacktestRequest["rebalancing"]["mode"] } })}>
              <option value="none">None</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>

        <div className={advancedOpen ? "advanced-toggle open" : "advanced-toggle"} onClick={() => setAdvancedOpen((open) => !open)}>
          <span className="chev">&#9654;</span> Advanced settings
        </div>
        <div className={advancedOpen ? "advanced-body open" : "advanced-body"}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="riskFreeRate">Risk-free rate (% / yr)</label>
              <input
                className="field num"
                id="riskFreeRate"
                min={0}
                step={0.1}
                type="number"
                value={request.risk_free_rate_pct}
                onChange={(event) => onChange({ ...request, risk_free_rate_pct: Number(event.target.value) })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="annualDrag">Annual drag / expense (%)</label>
              <input className="field num" id="annualDrag" min={0} step={0.01} type="number" value={request.costs.annual_drag_pct} onChange={(event) => onChange({ ...request, costs: { ...request.costs, annual_drag_pct: Number(event.target.value) } })} />
            </div>
            <div className="form-field">
              <label htmlFor="transactionCost">Transaction cost (bps)</label>
              <input className="field num" id="transactionCost" min={0} type="number" value={request.costs.transaction_bps} onChange={(event) => onChange({ ...request, costs: { ...request.costs, transaction_bps: Number(event.target.value) } })} />
            </div>
            <div className="form-field">
              <label htmlFor="slippage">Slippage (bps)</label>
              <input className="field num" id="slippage" min={0} type="number" value={request.costs.slippage_bps} onChange={(event) => onChange({ ...request, costs: { ...request.costs, slippage_bps: Number(event.target.value) } })} />
            </div>
            <div className="form-field">
              <label htmlFor="priceBasis">Price basis</label>
              <select className="field" disabled id="priceBasis" value="sec_nav">
                <option value="sec_nav">SEC NAV per unit</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="dividendTreatment">Dividend treatment</label>
              <select className="field" disabled id="dividendTreatment" value="fund_nav">
                <option value="fund_nav">Reflected through fund NAV only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="review-box">
        Run a backtest for <b>{request.assets.map((asset) => `${asset.display_name} ${asset.weight}%`).join(", ")}</b> from <b>{request.start_date}</b> to <b>{request.end_date}</b>, starting capital <b>{request.initial_capital.toLocaleString()}</b>
        {showCashflow ? <> with <b>{request.cashflow.type}</b> of <b>{request.cashflow.amount.toLocaleString()}</b> {request.cashflow.frequency}</> : null}
        {request.rebalancing.mode !== "none" ? <>, rebalanced <b>{request.rebalancing.mode}</b></> : null}.
      </div>

      {validationErrors.length ? (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          {validationErrors.map((item) => <div className="errorLine" key={item}>{item}</div>)}
        </div>
      ) : null}

      {error ? (
        <div className="banner">
          <span className="ic">&#9888;</span>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack} type="button">&larr; Back</button>
        <button className="btn btn-primary" disabled={!canRun} onClick={onRun} type="button">
          <Play size={15} /> {loading ? "Running" : "Run backtest"}
        </button>
      </div>
    </div>
  );
}
