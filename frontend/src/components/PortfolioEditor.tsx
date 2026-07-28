import { Trash2 } from "lucide-react";
import type { SecFundAllocation } from "../types/backtest";

interface Props {
  assets: SecFundAllocation[];
  onWeightChange: (projId: string, weight: number) => void;
  onRemove: (projId: string) => void;
}

export function PortfolioEditor({ assets, onWeightChange, onRemove }: Props) {
  const totalWeight = assets.reduce((sum, asset) => sum + asset.weight, 0);
  const valid = Math.abs(totalWeight - 100) <= 0.01 && assets.length > 0;

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h2>Portfolio</h2>
        </div>
        <span className={valid ? "badge success" : "badge warn"}>{totalWeight.toFixed(1)}%</span>
      </div>
      <div className="boundedList">
        <div className="allocationList">
          {assets.length === 0 ? <div className="emptyState">Select SEC funds to build a portfolio.</div> : null}
          {assets.map((asset) => (
            <div className="allocationRow" key={asset.proj_id}>
              <div>
                <strong>{asset.display_name}</strong>
                <small>{asset.proj_id}</small>
              </div>
              <input
                min={0}
                max={100}
                step={1}
                type="number"
                value={asset.weight}
                onChange={(event) => onWeightChange(asset.proj_id, Number(event.target.value))}
              />
              <button aria-label={`Remove ${asset.display_name}`} className="iconButton" onClick={() => onRemove(asset.proj_id)} type="button">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
