import { Search } from "lucide-react";
import type { SecFund } from "../types/backtest";

interface Props {
  funds: SecFund[];
  query: string;
  onQueryChange: (query: string) => void;
  onAdd: (fund: SecFund) => void;
  selectedIds: string[];
}

export function FundSelector({ funds, query, onQueryChange, onAdd, selectedIds }: Props) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = funds
    .filter((fund) => {
      const haystack = `${fund.proj_id} ${fund.display_name} ${fund.fund_class_name} ${fund.search_term}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h2>Fund Universe</h2>
        </div>
        <span className="badge">{funds.length} funds</span>
      </div>
      <label className="searchBox">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search proj_id, fund name, class"
        />
      </label>
      <div className="boundedList">
        <div className="fundList">
          {filtered.map((fund) => {
            const selected = selectedIds.includes(fund.proj_id);
            return (
              <button
                className="fundRow"
                disabled={selected}
                key={`${fund.proj_id}-${fund.fund_class_name}`}
                onClick={() => onAdd(fund)}
                type="button"
              >
                <span>
                  <strong>{fund.display_name}</strong>
                  <small>{fund.proj_id} · {fund.fund_class_name}</small>
                </span>
                {selected ? <span className="fundTag">Added</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
