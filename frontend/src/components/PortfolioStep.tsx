import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { SecFund, SecFundAllocation } from "../types/backtest";

interface Row {
  key: string;
  projId: string;
  weight: number;
  query: string;
}

interface Props {
  funds: SecFund[];
  active: boolean;
  onAssetsChange: (assets: SecFundAllocation[]) => void;
  onContinue: () => void;
}

const PALETTE = ["#5b21d6", "#34383e", "#92620a", "#9aa1ac", "#7c4ded"];

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

export function PortfolioStep({ funds, active, onAssetsChange, onContinue }: Props) {
  const [rows, setRows] = useState<Row[]>([{ key: nextKey(), projId: "", weight: 0, query: "" }]);
  const seededRef = useRef(false);

  const fundsById = useMemo(() => new Map(funds.map((fund) => [fund.proj_id, fund])), [funds]);

  useEffect(() => {
    if (seededRef.current || funds.length < 2) return;
    seededRef.current = true;
    seedRows(funds.slice(0, 2).map((fund, index) => ({ fund, weight: index === 0 ? 60 : 40 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds]);

  function commit(nextRows: Row[]) {
    setRows(nextRows);
    const assets: SecFundAllocation[] = nextRows
      .filter((row) => row.projId)
      .map((row) => ({
        proj_id: row.projId,
        display_name: fundsById.get(row.projId)?.display_name ?? row.query,
        weight: row.weight
      }));
    onAssetsChange(assets);
  }

  function seedRows(picks: { fund: SecFund; weight: number }[]) {
    commit(picks.map(({ fund, weight }) => ({ key: nextKey(), projId: fund.proj_id, weight, query: fund.display_name })));
  }

  function addRow() {
    commit([...rows, { key: nextKey(), projId: "", weight: 0, query: "" }]);
  }

  function removeRow(key: string) {
    if (rows.length <= 1) return;
    commit(rows.filter((row) => row.key !== key));
  }

  function selectFund(key: string, fund: SecFund) {
    commit(rows.map((row) => (row.key === key ? { ...row, projId: fund.proj_id, query: fund.display_name } : row)));
  }

  function setQuery(key: string, query: string) {
    commit(rows.map((row) => (row.key === key ? { ...row, projId: "", query } : row)));
  }

  function setWeight(key: string, weight: number) {
    commit(rows.map((row) => (row.key === key ? { ...row, weight } : row)));
  }

  function loadExample() {
    if (funds.length < 2) return;
    seedRows(funds.slice(0, 2).map((fund, index) => ({ fund, weight: index === 0 ? 60 : 40 })));
  }

  const committedRows = rows.filter((row) => row.projId);
  const total = rows.reduce((sum, row) => sum + (row.weight || 0), 0);
  const allNamed = rows.every((row) => row.projId || row.query.trim() !== "");
  const complete = allNamed && Math.abs(total - 100) < 0.05 && committedRows.length > 0;
  const selectedIds = new Set(rows.map((row) => row.projId));

  return (
    <div className={active ? "page active" : "page"}>
      <div className="page-head">
        <h1>Build your portfolio</h1>
        <p>Search SEC-registered mutual funds by name or class, set target weights, and confirm they sum to 100% before choosing an objective.</p>
      </div>

      <div className="card">
        <div className="example-row">
          <span className="footnote" style={{ margin: 0 }}>First time here?</span>
          <button className="link-btn" onClick={loadExample} type="button">Load an example portfolio</button>
        </div>

        <div className="holdings-table">
          <div className="holdings-head">
            <div>SEC Fund</div>
            <div>Weight %</div>
            <div />
          </div>
          {rows.map((row) => (
            <HoldingsRow
              key={row.key}
              row={row}
              funds={funds}
              selectedIds={selectedIds}
              canRemove={rows.length > 1}
              onSelect={(fund) => selectFund(row.key, fund)}
              onQueryChange={(query) => setQuery(row.key, query)}
              onWeightChange={(weight) => setWeight(row.key, weight)}
              onRemove={() => removeRow(row.key)}
            />
          ))}
        </div>

        <div className="holdings-foot">
          <button className="add-asset" onClick={addRow} type="button">+ Add fund</button>
          <div className="weight-total">
            Total <span>{formatPct(total)}</span>
            <span className={complete ? "pill ok" : "pill warn"}>{complete ? "ready" : "incomplete"}</span>
          </div>
        </div>

        {complete ? <AllocationDonut rows={committedRows} fundsById={fundsById} /> : null}
      </div>

      <div className="actions">
        <span className="footnote">Step 1 of 4 &mdash; portfolio weights must sum to 100%.</span>
        <button className="btn btn-primary" disabled={!complete} onClick={onContinue} type="button">Continue to Objective &rarr;</button>
      </div>
    </div>
  );
}

function HoldingsRow({
  row,
  funds,
  selectedIds,
  canRemove,
  onSelect,
  onQueryChange,
  onWeightChange,
  onRemove
}: {
  row: Row;
  funds: SecFund[];
  selectedIds: Set<string>;
  canRemove: boolean;
  onSelect: (fund: SecFund) => void;
  onQueryChange: (query: string) => void;
  onWeightChange: (weight: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fund = funds.find((item) => item.proj_id === row.projId);
  const displayValue = fund ? fund.display_name : row.query;

  const query = row.projId ? "" : row.query.trim().toLowerCase();
  const options = funds.filter((item) => {
    if (selectedIds.has(item.proj_id) && item.proj_id !== row.projId) return false;
    if (!query) return true;
    const haystack = `${item.proj_id} ${item.display_name} ${item.fund_class_name} ${item.search_term}`.toLowerCase();
    return haystack.includes(query);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(options.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && options[highlight]) {
      event.preventDefault();
      onSelect(options[highlight]);
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="holdings-row">
      <div className="fund-field">
        <input
          className="field fund-input"
          ref={inputRef}
          value={displayValue}
          placeholder="Search fund name, class, or proj_id..."
          onFocus={() => { setOpen(true); setHighlight(0); }}
          onChange={(event) => { onQueryChange(event.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        <div className={open ? "fund-suggest open" : "fund-suggest"}>
          {options.slice(0, 8).map((item, index) => (
            <button
              className={index === highlight ? "highlighted" : ""}
              key={`${item.proj_id}-${item.fund_class_name}`}
              onMouseDown={(event) => { event.preventDefault(); onSelect(item); setOpen(false); }}
              type="button"
            >
              {item.display_name}
              <span className="fid">{item.proj_id} &middot; {item.fund_class_name}</span>
            </button>
          ))}
          {!options.length ? <button disabled type="button">No matching funds</button> : null}
        </div>
      </div>
      <input
        className="field num weight-input"
        type="number"
        min={0}
        max={100}
        value={row.weight}
        onChange={(event) => onWeightChange(Number(event.target.value))}
      />
      <button aria-label="Remove fund row" className="icon-btn remove-row" disabled={!canRemove} onClick={onRemove} type="button">
        <X size={15} />
      </button>
    </div>
  );
}

function AllocationDonut({ rows, fundsById }: { rows: Row[]; fundsById: Map<string, SecFund> }) {
  const total = rows.reduce((sum, row) => sum + (row.weight || 0), 0) || 1;
  const cx = 60;
  const cy = 60;
  const r = 50;
  const inner = 30;
  let angle = -90;
  const arcs = rows.map((row, index) => {
    const share = (row.weight || 0) / total;
    const sweep = share * 360;
    const x1 = cx + r * Math.cos((angle * Math.PI) / 180);
    const y1 = cy + r * Math.sin((angle * Math.PI) / 180);
    const endAngle = angle + sweep;
    const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
    const large = sweep > 180 ? 1 : 0;
    const color = PALETTE[index % PALETTE.length];
    const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    angle = endAngle;
    return { d, color, label: fundsById.get(row.projId)?.display_name ?? row.projId, weight: row.weight };
  });

  return (
    <div id="allocationBlock">
      <div className="donut-wrap">
        <svg height="120" viewBox="0 0 120 120" width="120" role="img" aria-label="Allocation donut chart">
          {arcs.map((arc) => <path d={arc.d} fill={arc.color} key={arc.label} />)}
          <circle cx={cx} cy={cy} fill="var(--surface)" r={inner} />
        </svg>
        <div className="legend">
          {arcs.map((arc) => (
            <div className="row" key={arc.label}>
              <span className="swatch" style={{ background: arc.color }} />
              {arc.label} &mdash; {formatPct(arc.weight)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatPct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}
