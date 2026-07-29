import { ArrowDownCircle, ArrowUpCircle, RefreshCw, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { objectives } from "../objectives/objectives";
import type { Objective } from "../types/backtest";

const ICONS: Record<Objective, ComponentType<{ size?: number }>> = {
  past_performance: TrendingUp,
  monthly_dca: ArrowUpCircle,
  monthly_withdrawal: ArrowDownCircle,
  rebalancing_impact: RefreshCw
};

interface Props {
  active: boolean;
  selected: Objective;
  onSelect: (id: Objective) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function ObjectiveStep({ active, selected, onSelect, onBack, onContinue }: Props) {
  return (
    <div className={active ? "page active" : "page"}>
      <div className="page-head">
        <h1>What do you want to know?</h1>
        <p>Pick the question closest to yours. This only changes the defaults below &mdash; every assumption stays fully editable afterward.</p>
      </div>

      <div className="obj-grid">
        {objectives.map((objective) => {
          const Icon = ICONS[objective.id];
          return (
            <button
              className={objective.id === selected ? "obj-card selected" : "obj-card"}
              key={objective.id}
              onClick={() => onSelect(objective.id)}
              type="button"
            >
              <div className="icon" aria-hidden="true"><Icon size={18} /></div>
              <h3>{objective.label}</h3>
              <p className="q">{objective.description}</p>
              <div className="preview">Requires: {objective.required.join(", ")}</div>
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack} type="button">&larr; Back</button>
        <button className="btn btn-primary" onClick={onContinue} type="button">Continue to Assumptions &rarr;</button>
      </div>
    </div>
  );
}
