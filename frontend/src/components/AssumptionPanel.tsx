import { useState } from "react";
import type { BacktestRequest, SecFund } from "../types/backtest";
import type { ObjectiveConfig } from "../objectives/objectives";

interface Props {
  request: BacktestRequest;
  objectiveConfig: ObjectiveConfig;
  funds: SecFund[];
  onChange: (request: BacktestRequest) => void;
}

export function AssumptionPanel({ request, objectiveConfig, funds, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const showCashflow = request.cashflow.enabled;
  const cashflowLabel = request.cashflow.type === "withdrawal" ? "Withdrawal amount" : "Contribution amount";
  const rebalanceRequired = request.objective === "rebalancing_impact";

  return (
    <div className="assumptionStack">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Required Inputs</h2>
            <p>{objectiveConfig.label}</p>
          </div>
          <span className="badge">Required</span>
        </div>
        <div className="formGrid">
          <label>
            Start date
            <input type="date" value={request.start_date} onChange={(event) => onChange({ ...request, start_date: event.target.value })} />
          </label>
          <label>
            End date
            <input type="date" value={request.end_date} onChange={(event) => onChange({ ...request, end_date: event.target.value })} />
          </label>
          <label>
            Initial capital
            <input type="number" min={1} value={request.initial_capital} onChange={(event) => onChange({ ...request, initial_capital: Number(event.target.value) })} />
          </label>
          <label>
            Benchmark
            <select value={request.benchmark_proj_id} onChange={(event) => onChange({ ...request, benchmark_proj_id: event.target.value })}>
              {funds.map((fund) => (
                <option key={`${fund.proj_id}-${fund.fund_class_name}`} value={fund.proj_id}>{fund.display_name}</option>
              ))}
            </select>
          </label>
          {showCashflow ? (
            <label>
              {cashflowLabel}
              <input
                type="number"
                min={0}
                value={request.cashflow.amount}
                onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, amount: Number(event.target.value) } })}
              />
            </label>
          ) : null}
          {rebalanceRequired ? (
            <label>
              Rebalancing
              <RebalanceSelect request={request} onChange={onChange} />
            </label>
          ) : null}
        </div>
        <div className="requirements">
          <strong>Required</strong>
          <span>{objectiveConfig.required.join(", ")}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Optional Inputs</h2>
            <p>Editable after auto-fill</p>
          </div>
          <span className="badge">Optional</span>
        </div>
        <div className="formGrid">
          <label>
            Cashflow enabled
            <select
              value={String(request.cashflow.enabled)}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, enabled: event.target.value === "true" } })}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <label>
            Cashflow type
            <select
              disabled={!request.cashflow.enabled}
              value={request.cashflow.type}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, type: event.target.value as BacktestRequest["cashflow"]["type"] } })}
            >
              <option value="contribution">Contribution</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </label>
          <label>
            Cashflow frequency
            <select
              disabled={!request.cashflow.enabled}
              value={request.cashflow.frequency}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, frequency: event.target.value as BacktestRequest["cashflow"]["frequency"] } })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
          <label>
            Cashflow timing
            <select
              disabled={!request.cashflow.enabled}
              value={request.cashflow.timing}
              onChange={(event) => onChange({ ...request, cashflow: { ...request.cashflow, timing: event.target.value as BacktestRequest["cashflow"]["timing"] } })}
            >
              <option value="beginning">Beginning</option>
              <option value="end">End</option>
            </select>
          </label>
          {!rebalanceRequired ? (
            <label>
              Rebalancing
              <RebalanceSelect request={request} onChange={onChange} />
            </label>
          ) : null}
        </div>
        <div className="requirements">
          <strong>Optional</strong>
          <span>{objectiveConfig.optional.join(", ")}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Advanced assumptions</h2>
          <button className="textButton" onClick={() => setAdvancedOpen((open) => !open)} type="button">
            {advancedOpen ? "Hide" : "Show"}
          </button>
        </div>
        <div className={advancedOpen ? "advancedGrid open" : "advancedGrid"}>
          <label>
            Risk-free rate (% / yr)
            <input
              min={0}
              step={0.1}
              type="number"
              value={request.risk_free_rate_pct}
              onChange={(event) => onChange({ ...request, risk_free_rate_pct: Number(event.target.value) })}
            />
          </label>
          <label>
            Annual drag / expense (%)
            <input type="number" min={0} step={0.01} value={request.costs.annual_drag_pct} onChange={(event) => onChange({ ...request, costs: { ...request.costs, annual_drag_pct: Number(event.target.value) } })} />
          </label>
          <label>
            Transaction cost (bps)
            <input type="number" min={0} value={request.costs.transaction_bps} onChange={(event) => onChange({ ...request, costs: { ...request.costs, transaction_bps: Number(event.target.value) } })} />
          </label>
          <label>
            Slippage (bps)
            <input type="number" min={0} value={request.costs.slippage_bps} onChange={(event) => onChange({ ...request, costs: { ...request.costs, slippage_bps: Number(event.target.value) } })} />
          </label>
          <label>
            Price basis
            <select value="sec_nav" disabled>
              <option value="sec_nav">SEC NAV per unit</option>
            </select>
          </label>
          <label>
            Dividend treatment
            <select value="fund_nav" disabled>
              <option value="fund_nav">Reflected through fund NAV only</option>
            </select>
          </label>
        </div>
        {!advancedOpen ? <p className="hintText">Risk-free rate, costs, slippage, SEC NAV basis.</p> : null}
      </section>
    </div>
  );
}

function RebalanceSelect({ request, onChange }: { request: BacktestRequest; onChange: (request: BacktestRequest) => void }) {
  return (
    <select value={request.rebalancing.mode} onChange={(event) => onChange({ ...request, rebalancing: { mode: event.target.value as BacktestRequest["rebalancing"]["mode"] } })}>
      <option value="none">None</option>
      <option value="monthly">Monthly</option>
      <option value="quarterly">Quarterly</option>
      <option value="annual">Annual</option>
    </select>
  );
}
