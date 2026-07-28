import type { BacktestRequest, Objective } from "../types/backtest";

export interface ObjectiveConfig {
  id: Objective;
  label: string;
  subtitle: string;
  description: string;
  required: string[];
  optional: string[];
  presetSummary: string[];
  apply: (request: BacktestRequest) => BacktestRequest;
}

const baseCashflow = {
  enabled: false,
  type: "contribution" as const,
  amount: 0,
  frequency: "monthly" as const,
  timing: "end" as const
};

export const objectives: ObjectiveConfig[] = [
  {
    id: "past_performance",
    label: "Past Performance",
    subtitle: "Historical return and risk",
    description: "Static allocation history: what happened if this portfolio was held through the selected period.",
    required: ["SEC funds and weights", "Start date", "End date", "Initial capital", "Benchmark fund"],
    optional: ["Costs", "Rebalancing mode"],
    presetSummary: ["No recurring cashflow", "Annual rebalancing", "0 bps transaction cost"],
    apply: (request) => ({
      ...request,
      objective: "past_performance",
      cashflow: baseCashflow,
      rebalancing: { mode: "annual" },
      costs: { transaction_bps: 0, slippage_bps: 0, annual_drag_pct: 0 }
    })
  },
  {
    id: "monthly_dca",
    label: "Monthly DCA",
    subtitle: "Invest every month",
    description: "Contribution plan: invest a fixed amount every month while tracking both time-weighted and investor experience.",
    required: ["SEC funds and weights", "Monthly contribution", "Start date", "End date", "Initial capital"],
    optional: ["Costs", "Benchmark fund", "Rebalancing mode"],
    presetSummary: ["Contribution enabled", "500 monthly", "Period-end timing", "Annual rebalancing"],
    apply: (request) => ({
      ...request,
      objective: "monthly_dca",
      cashflow: { enabled: true, type: "contribution", amount: 500, frequency: "monthly", timing: "end" },
      rebalancing: { mode: "annual" }
    })
  },
  {
    id: "monthly_withdrawal",
    label: "Monthly Withdrawal",
    subtitle: "Withdraw every month",
    description: "Decumulation plan: test whether a portfolio can fund recurring withdrawals through market stress.",
    required: ["SEC funds and weights", "Monthly withdrawal", "Start date", "End date", "Starting capital"],
    optional: ["Costs", "Benchmark fund", "Rebalancing mode"],
    presetSummary: ["Withdrawal enabled", "1,000 monthly", "Starting capital at least 100,000", "Annual rebalancing"],
    apply: (request) => ({
      ...request,
      objective: "monthly_withdrawal",
      initial_capital: Math.max(request.initial_capital, 100000),
      cashflow: { enabled: true, type: "withdrawal", amount: 1000, frequency: "monthly", timing: "end" },
      rebalancing: { mode: "annual" }
    })
  },
  {
    id: "rebalancing_impact",
    label: "Rebalancing Impact",
    subtitle: "Turnover and cost drag",
    description: "Turnover study: compare the realized path after rebalancing, turnover, and trading cost assumptions.",
    required: ["SEC funds and weights", "Start date", "End date", "Rebalancing mode"],
    optional: ["Costs", "Benchmark fund"],
    presetSummary: ["No recurring cashflow", "Annual rebalancing", "5 bps transaction cost"],
    apply: (request) => ({
      ...request,
      objective: "rebalancing_impact",
      cashflow: baseCashflow,
      rebalancing: { mode: "annual" },
      costs: { transaction_bps: 5, slippage_bps: 0, annual_drag_pct: 0 }
    })
  }
];
