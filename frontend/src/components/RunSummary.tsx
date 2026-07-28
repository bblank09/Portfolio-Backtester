import { AlertTriangle, BarChart3, Download, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { BacktestResult, TableSection, TimeSeriesPoint } from "../types/backtest";

interface Props {
  result: BacktestResult | null;
}

type OutputTab = "Summary" | "Overview" | "Growth" | "Drawdown" | "Returns" | "Metrics" | "Cashflows" | "Rebalancing" | "Report";

const outputTabs: OutputTab[] = ["Summary", "Overview", "Growth", "Drawdown", "Returns", "Metrics", "Cashflows", "Rebalancing", "Report"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

interface SummaryMetric {
  label: string;
  value: string;
  sub?: string;
}

export function RunSummary({ result }: Props) {
  const [activeTab, setActiveTab] = useState<OutputTab>("Summary");

  useEffect(() => {
    setActiveTab("Summary");
  }, [result?.run_id]);

  if (!result) {
    return (
      <section className="resultShell emptyResult">
        <span className="emptyResultIcon"><BarChart3 size={22} /></span>
        <h2>Run a backtest to see results.</h2>
        <p>Add funds, set weights to 100%, then run to see growth, drawdown, and the CQF report.</p>
      </section>
    );
  }

  return (
    <section className="resultShell" id="report-output">
      <div className="resultHeader">
        <div>
          <span className="sourceLine"><ShieldCheck size={16} /> Backtest result</span>
          <h2>{objectiveTitle(result)}</h2>
        </div>
        <button className="secondaryButton" onClick={() => downloadJson(result)} type="button">
          <Download size={16} /> Result JSON
        </button>
      </div>

      <nav className="resultTabs" aria-label="Backtest output tabs">
        {outputTabs.map((tab) => (
          <button className={activeTab === tab ? "resultTab active" : "resultTab"} key={tab} onClick={() => setActiveTab(tab)} type="button">
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Summary" ? <SummaryTab result={result} setActiveTab={setActiveTab} /> : null}
      {activeTab === "Overview" ? <OverviewTab result={result} /> : null}
      {activeTab === "Growth" ? <GrowthTab result={result} /> : null}
      {activeTab === "Drawdown" ? <DrawdownTab result={result} /> : null}
      {activeTab === "Returns" ? <ReturnsTab result={result} /> : null}
      {activeTab === "Metrics" ? <MetricsTab result={result} /> : null}
      {activeTab === "Cashflows" ? <CashflowsTab result={result} /> : null}
      {activeTab === "Rebalancing" ? <RebalancingTab result={result} /> : null}
      {activeTab === "Report" ? <ReportTab result={result} /> : null}
    </section>
  );
}

function SummaryTab({ result, setActiveTab }: { result: BacktestResult; setActiveTab: (tab: OutputTab) => void }) {
  const m = result.summary;
  const objectiveMetrics = summaryMetrics(result);
  return (
    <div className="tabStack">
      <section className="chartPanel">
        <h3>{objectiveTitle(result)} Summary</h3>
        <p className="summaryText">{objectiveNarrative(result)}</p>
      </section>
      <div className="metricGrid">
        {objectiveMetrics.map((metric) => <Metric key={metric.label} label={metric.label} value={metric.value} sub={metric.sub} />)}
      </div>
      <section className="chartPanel">
        <h3>Objective checklist</h3>
        <DataTable section={{ title: "", rows: objectiveChecklist(result) }} compact />
      </section>
      <section className="chartPanel">
        <h3>Always-on analysis</h3>
        <div className="alwaysOnGrid">
          <ClickableMetric label="Benchmark Risk" value={`Beta ${formatNumber(findRiskValue(result, "beta"))}`} sub={`Alpha ${formatPercentLike(findRiskValue(result, "alpha"))} · TE ${formatPercentLike(findRiskValue(result, "tracking_error"))}`} onClick={() => setActiveTab("Overview")} />
          <ClickableMetric label="Drawdown Stress" value={pct.format(m.max_drawdown)} sub="Worst historical loss and stress values" onClick={() => setActiveTab("Drawdown")} />
          <ClickableMetric label="Diversification" value={`${result.diversification.rows.length} rows`} sub="Correlation and concentration checks" onClick={() => setActiveTab("Metrics")} />
          <ClickableMetric label="CQF Report" value="Ready" sub="Method, formulas, caveats" onClick={() => setActiveTab("Report")} />
        </div>
      </section>
      <AxisCurve title="Portfolio vs Benchmark Growth" series={[
        { label: "Portfolio", points: result.equity_curve, color: "#5b21d6", valueFormat: money.format },
        { label: "Benchmark", points: result.benchmark_curve, color: "#7c3aed", valueFormat: money.format }
      ]} valueFormat={money.format} />
    </div>
  );
}

function OverviewTab({ result }: { result: BacktestResult }) {
  const m = result.summary;
  const derived = deriveResult(result);
  return (
    <div className="tabStack">
      <div className="metricGrid">
        <Metric label="Ending value" value={money.format(m.ending_value)} />
        <Metric label="Total return (TWRR)" value={pct.format(m.twrr)} />
        <Metric label="CAGR (TWRR)" value={pct.format(m.twrr_cagr)} />
        <Metric label="Volatility" value={pct.format(m.volatility)} />
        <Metric label="Sharpe" value={formatNumber(m.sharpe)} />
        <Metric label="Max drawdown" value={pct.format(m.max_drawdown)} />
        <Metric label="Benchmark excess" value={formatPercentLike(m.benchmark_excess_return)} />
        <Metric label="Total costs" value={money.format(m.total_costs)} />
        <Metric label="Contributed" value={money.format(m.total_contributed)} />
        <Metric label="Withdrawn" value={money.format(m.total_withdrawn)} />
        <Metric label="Cashflow events" value={String(m.cashflow_count)} />
        <Metric label="Rebalance events" value={String(m.rebalance_count)} />
      </div>
      <section className="chartPanel">
        <h3>Trailing performance</h3>
        <DataTable section={{ title: "", rows: derived.trailingReturns }} />
      </section>
      <div className="panelGrid">
        <section className="chartPanel">
        <h3>Run assumptions</h3>
        <DataTable section={{ title: "", rows: assumptionRows(result) }} compact />
        </section>
        <section className="chartPanel">
        <h3>Benchmark risk decomposition</h3>
          <DataTable section={{ title: "", rows: benchmarkDecompositionRows(result, derived) }} />
        </section>
      </div>
    </div>
  );
}

function GrowthTab({ result }: { result: BacktestResult }) {
  const netInvested = buildNetInvestedCurve(result);
  const derived = deriveResult(result);
  return (
    <div className="tabStack">
      <div className="metricGrid">
        <Metric label="Start value" value={money.format(result.equity_curve[0]?.value ?? 0)} sub={result.equity_curve[0]?.date} />
        <Metric label="Ending value" value={money.format(result.summary.ending_value)} sub={lastDate(result.equity_curve)} />
        <Metric label="Net invested" value={money.format(lastPoint(netInvested)?.value ?? result.request.initial_capital)} />
        <Metric label="Benchmark value" value={money.format(lastPoint(result.benchmark_curve)?.value ?? 0)} />
      </div>
      <AxisCurve title="Portfolio growth path" series={[
        { label: "Portfolio", points: result.equity_curve, color: "#5b21d6", valueFormat: money.format },
        { label: "Benchmark", points: result.benchmark_curve, color: "#7c3aed", valueFormat: money.format },
        { label: "Net invested", points: netInvested, color: "#637083", dashed: true, valueFormat: money.format }
      ]} valueFormat={money.format} />
      <section className="chartPanel">
        <h3>Value milestones</h3>
        <DataTable section={{ title: "", rows: milestoneRows(result, netInvested) }} />
      </section>
      <AxisCurve title="Rolling 12M return and volatility" series={[
        { label: "Rolling return", points: derived.rolling.map((row) => ({ date: row.date, value: row.return })), color: "#5b21d6", valueFormat: pct.format },
        { label: "Rolling volatility", points: derived.rolling.map((row) => ({ date: row.date, value: row.volatility })), color: "#7c3aed", valueFormat: pct.format }
      ]} valueFormat={pct.format} />
      <section className="chartPanel">
        <h3>Rolling 12M table</h3>
        <DataTable section={{ title: "", rows: derived.rolling }} />
      </section>
    </div>
  );
}

function DrawdownTab({ result }: { result: BacktestResult }) {
  const derived = deriveResult(result);
  return (
    <div className="tabStack">
      <div className="metricGrid">
        <Metric label="Worst drawdown" value={pct.format(result.summary.max_drawdown)} />
        <Metric label="Ulcer proxy" value={formatNumber(ulcerIndex(result.drawdown_curve))} sub="From SEC drawdown path" />
        <Metric label="Stress -10%" value={money.format(result.summary.ending_value * 0.9)} />
      </div>
      <AxisCurve title="Drawdown path" series={[
        { label: "Portfolio drawdown", points: result.drawdown_curve, color: "#b42318", valueFormat: pct.format }
      ]} valueFormat={pct.format} />
      <section className="chartPanel">
        <h3>Drawdown stress scenarios</h3>
        <DataTable section={{ title: "", rows: stressRows(result) }} />
      </section>
      <div className="panelGrid">
        <section className="chartPanel">
          <h3>Worst drawdown periods</h3>
          <DataTable section={{ title: "", rows: derived.drawdownPeriods }} />
        </section>
        <section className="chartPanel">
          <h3>Stress interpretation</h3>
          <DataTable section={{ title: "", rows: stressInterpretationRows(result, derived) }} />
        </section>
      </div>
    </div>
  );
}

function ReturnsTab({ result }: { result: BacktestResult }) {
  const derived = deriveResult(result);
  return (
    <div className="tables oneColumn">
      <DataTable section={{ title: "Annual returns", rows: derived.annualReturns }} />
      <MonthlyHeatmap rows={derived.monthlyGrid} />
      <section className="chartPanel">
        <h3>Monthly return distribution</h3>
        <Histogram rows={derived.histogram} />
        <DataTable section={{ title: "", rows: derived.histogram }} compact />
      </section>
      <div className="panelGrid">
        <section className="chartPanel">
          <h3>Best months</h3>
          <DataTable section={{ title: "", rows: derived.bestMonths }} />
        </section>
        <section className="chartPanel">
          <h3>Worst months</h3>
          <DataTable section={{ title: "", rows: derived.worstMonths }} />
        </section>
      </div>
    </div>
  );
}

function MetricsTab({ result }: { result: BacktestResult }) {
  const derived = deriveResult(result);
  return (
    <div className="tabStack">
      <section className="chartPanel">
        <h3>Metrics</h3>
        <DataTable section={{ title: "", rows: keyMetricRows(result) }} />
      </section>
      <section className="chartPanel">
        <h3>Asset risk and allocation</h3>
        <DataTable section={{ title: "", rows: assetRows(result, derived) }} />
      </section>
      <section className="chartPanel">
        <h3>Diversification Check</h3>
        <DataTable section={result.diversification} />
      </section>
      <section className="chartPanel">
        <h3>Rolling risk table</h3>
        <DataTable section={{ title: "", rows: derived.rolling }} />
      </section>
      <section className="chartPanel">
        <h3>Formula References</h3>
        <DataTable section={{ title: "", rows: result.formula_references.map((formula) => ({ formula })) }} compact />
      </section>
    </div>
  );
}

function CashflowsTab({ result }: { result: BacktestResult }) {
  if (!result.request.cashflow.enabled) {
    return <div className="emptyState">Cashflows are disabled for this objective/run.</div>;
  }
  return (
    <div className="tabStack">
      <div className="metricGrid">
        <Metric label="Total contributions" value={money.format(result.summary.total_contributed)} />
        <Metric label="Total withdrawals" value={money.format(result.summary.total_withdrawn)} />
        <Metric label="Net invested" value={money.format(lastPoint(buildNetInvestedCurve(result))?.value ?? result.request.initial_capital)} />
        <Metric label="Net profit" value={money.format(result.summary.ending_value + result.summary.total_withdrawn - result.summary.total_contributed)} />
        <Metric label="Events" value={String(result.summary.cashflow_count)} />
      </div>
      <DataTable section={{ title: "Yearly cashflow summary", rows: yearlyCashflowRows(result) }} />
      <DataTable section={{ title: "Cashflow events", rows: result.cashflows.map((row) => ({ date: row.date, amount: row.amount })) }} />
    </div>
  );
}

function RebalancingTab({ result }: { result: BacktestResult }) {
  if (result.request.rebalancing.mode === "none") {
    return <div className="emptyState">Rebalancing is set to None.</div>;
  }
  return (
    <div className="tabStack">
      <div className="metricGrid">
        <Metric label="Rebalance count" value={String(result.summary.rebalance_count)} />
        <Metric label="Average turnover" value={pct.format(mean(result.rebalances.map((row) => row.turnover)))} />
        <Metric label="Max turnover" value={pct.format(Math.max(...result.rebalances.map((row) => row.turnover), 0))} />
        <Metric label="Total costs" value={money.format(result.summary.total_costs)} />
        <Metric label="Mode" value={result.request.rebalancing.mode} />
        <Metric label="Max single cost" value={money.format(Math.max(...result.rebalances.map((row) => row.cost), 0))} />
      </div>
      <section className="chartPanel">
        <h3>Target allocation</h3>
        {result.request.assets.map((asset) => (
          <div className="allocationBarRow" key={asset.proj_id}>
            <span>{asset.display_name}: target {asset.weight.toFixed(1)}%</span>
            <div className="bar"><span style={{ width: `${asset.weight}%` }} /></div>
          </div>
        ))}
      </section>
      <DataTable section={{ title: "Rebalance events", rows: result.rebalances.map((row) => ({ ...row, turnover: pct.format(row.turnover), cost: money.format(row.cost) })) }} />
    </div>
  );
}

function ReportTab({ result }: { result: BacktestResult }) {
  const rows = reportRows(result);
  return (
    <div className="tabStack">
      <section className="chartPanel">
        <h3>Export</h3>
        <div className="exportActions">
          <button className="secondaryButton" onClick={() => downloadText("report.md", reportMarkdown(rows), "text/markdown")} type="button">report.md</button>
          <button className="secondaryButton" onClick={() => downloadText("run_config.json", JSON.stringify(result.request, null, 2), "application/json")} type="button">run_config.json</button>
          <button className="secondaryButton" onClick={() => downloadText("metrics.json", JSON.stringify(result.summary, null, 2), "application/json")} type="button">metrics.json</button>
        </div>
      </section>
      <section className="reportPanel">
        <h3>CQF Report Draft</h3>
        {rows.map((row) => (
          <section key={row.section}>
            <strong>{row.section}</strong>
            <p>{row.detail}</p>
          </section>
        ))}
      </section>
      <DataTable section={{ title: "CQF Report Audit Table", rows }} />
    </div>
  );
}

function Metric({ label, value, sub = "" }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function ClickableMetric(props: { label: string; value: string; sub: string; onClick: () => void }) {
  return (
    <button className="metricCard clickableMetric" onClick={props.onClick} type="button">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.sub}</small>
    </button>
  );
}

function AxisCurve({ title, series, valueFormat }: { title: string; series: ChartSeries[]; valueFormat: (value: number) => string }) {
  const prepared = useMemo(() => prepareSeries(series), [series]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  function handleMove(event: ReactMouseEvent<SVGRectElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relativeX = ((event.clientX - rect.left) / rect.width) * 880;
    const length = prepared.pointCount;
    const rawIndex = ((relativeX - 70) / 780) * (length - 1);
    const index = Math.min(length - 1, Math.max(0, Math.round(rawIndex)));
    setHover({ index, x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  const hoverRows = hover
    ? prepared.paths.map((path, seriesIndex) => ({
        label: path.label,
        color: path.color,
        value: series[seriesIndex]?.valueFormat(prepared.seriesValues[seriesIndex]?.[hover.index] ?? 0) ?? ""
      }))
    : [];
  const hoverDate = hover ? prepared.dates[hover.index] ?? "" : "";
  const hoverPlotX = hover ? xForIndex(hover.index, prepared.pointCount) : 0;

  return (
    <section className="chartPanel">
      <div className="panelHeader compact">
        <div>
          <h3>{title}</h3>
          <p>{prepared.startDate} to {prepared.endDate}</p>
        </div>
        <span className="badge">{valueFormat(prepared.latestValue)}</span>
      </div>
      <div className="chartLegend">
        {series.map((item) => (
          <span key={item.label}><i style={{ background: item.color }} />{item.label}: {item.valueFormat(lastPoint(item.points)?.value ?? 0)}</span>
        ))}
      </div>
      <div className="chartCanvas" ref={containerRef}>
        <svg className="axisChart" viewBox="0 0 880 320" role="img" aria-label={title} preserveAspectRatio="none">
          {prepared.yTicks.map((tick) => (
            <g key={tick.value}>
              <line className="gridLine" x1="70" x2="850" y1={tick.y} y2={tick.y} />
              <text className="axisText" x="62" y={tick.y + 4} textAnchor="end">{valueFormat(tick.value)}</text>
            </g>
          ))}
          {prepared.xTicks.map((tick) => (
            <g key={tick.x}>
              <line className="gridLine vertical" x1={tick.x} x2={tick.x} y1="24" y2="280" />
              <text className="axisText" x={tick.x} y="300" textAnchor="middle">{tick.date}</text>
            </g>
          ))}
          <line className="axisLine" x1="70" x2="850" y1="280" y2="280" />
          <line className="axisLine" x1="70" x2="70" y1="24" y2="280" />
          {prepared.paths.map((path) => (
            <path key={path.label} d={path.d} stroke={path.color} strokeDasharray={path.dashed ? "7 7" : undefined} />
          ))}
          {prepared.endpoints.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r="4" fill={point.color} />
          ))}
          {hover ? (
            <g>
              <line className="crosshairLine" x1={hoverPlotX} x2={hoverPlotX} y1="24" y2="280" />
              {prepared.seriesValues.map((values, seriesIndex) => {
                const value = values[hover.index];
                if (value == null) return null;
                return (
                  <circle
                    key={series[seriesIndex]?.label ?? seriesIndex}
                    cx={hoverPlotX}
                    cy={prepared.yFor(value)}
                    r="4.5"
                    fill="#ffffff"
                    stroke={series[seriesIndex]?.color}
                    strokeWidth="2.5"
                  />
                );
              })}
            </g>
          ) : null}
          <rect
            x="70"
            y="24"
            width="780"
            height="256"
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {hover ? (
          <div
            className="chartTooltip"
            style={{ left: Math.min(Math.max(hover.x, 84), (containerRef.current?.clientWidth ?? 880) - 84), top: 8 }}
          >
            <strong>{hoverDate}</strong>
            {hoverRows.map((row) => (
              <span key={row.label}><i style={{ background: row.color }} />{row.label}: {row.value}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="chartStats">
        <span>Min: {valueFormat(prepared.min)}</span>
        <span>Max: {valueFormat(prepared.max)}</span>
        <span>Latest: {valueFormat(prepared.latestValue)}</span>
      </div>
    </section>
  );
}

function xForIndex(index: number, length: number) {
  return 70 + (index / Math.max(1, length - 1)) * 780;
}

function DataTable({ section, compact = false }: { section: TableSection; compact?: boolean }) {
  const rows = section.rows;
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className={compact ? "tablePanel compactTable" : "tablePanel"}>
      {section.title ? <h3>{section.title}</h3> : null}
      <div className="tableScroller">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{humanize(column)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>{rows.length} row{rows.length === 1 ? "" : "s"}</small>
    </div>
  );
}

function MonthlyHeatmap({ rows }: { rows: MonthlyGridRow[] }) {
  return (
    <section className="chartPanel">
      <h3>Monthly returns heatmap</h3>
      <div className="monthHeaders">
        <span />
        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => <span key={month}>{month}</span>)}
      </div>
      {rows.map((row) => (
        <div className="heatRow" key={row.year}>
          <span className="heatYear">{row.year}</span>
          {row.months.map((value, index) => (
            <span
              className="heatCell"
              key={`${row.year}-${index}`}
              title={value == null ? "n/a" : pct.format(value)}
              style={{ background: value == null ? "#eef1f6" : heatColor(value) }}
            >
              {value == null ? "" : `${(value * 100).toFixed(1)}`}
            </span>
          ))}
        </div>
      ))}
    </section>
  );
}

function Histogram({ rows }: { rows: { bin: string; count: number; from: number }[] }) {
  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="hist">
      {rows.map((row) => (
        <span
          className="histBar"
          key={row.bin}
          title={`${row.bin}: ${row.count}`}
          style={{
            height: `${Math.max(5, (row.count / maxCount) * 92)}px`,
            background: row.from >= 0 ? "#137a4f" : "#b42318"
          }}
        />
      ))}
    </div>
  );
}

interface ChartSeries {
  label: string;
  points: TimeSeriesPoint[];
  color: string;
  dashed?: boolean;
  valueFormat: (value: number) => string;
}

interface MonthlyGridRow {
  year: number;
  months: (number | null)[];
}

function deriveResult(result: BacktestResult) {
  const portfolioReturns = returnsFromCurve(result.equity_curve);
  const benchmarkReturns = returnsFromCurve(result.benchmark_curve);
  const benchmarkReturnsByDate = new Map(benchmarkReturns.map((row) => [row.date, row.value]));
  const monthlyRows = result.monthly_returns.rows.map((row) => ({
    date: String(row.date),
    portfolio: asNumber(row.return),
    benchmark: benchmarkReturnsByDate.get(String(row.date)) ?? null
  }));
  const rolling = rollingRows(monthlyRows);
  return {
    portfolioReturns,
    benchmarkReturns,
    monthlyRows,
    trailingReturns: trailingRows(monthlyRows),
    rolling,
    annualReturns: annualRows(result, monthlyRows),
    monthlyGrid: monthlyGrid(monthlyRows),
    histogram: histogramRows(monthlyRows.map((row) => row.portfolio)),
    bestMonths: [...monthlyRows].sort((a, b) => b.portfolio - a.portfolio).slice(0, 10).map(monthRow),
    worstMonths: [...monthlyRows].sort((a, b) => a.portfolio - b.portfolio).slice(0, 10).map(monthRow),
    drawdownPeriods: worstDrawdownPeriods(result.drawdown_curve)
  };
}

function returnsFromCurve(points: TimeSeriesPoint[]) {
  const rows: { date: string; value: number }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]?.value ?? 0;
    const current = points[index]?.value ?? 0;
    rows.push({ date: points[index]?.date ?? "", value: previous ? current / previous - 1 : 0 });
  }
  return rows;
}

function trailingRows(rows: { date: string; portfolio: number; benchmark: number | null }[]) {
  return [
    { label: "1Y", months: 12 },
    { label: "3Y", months: 36 },
    { label: "5Y", months: 60 },
    { label: "Full", months: rows.length }
  ]
    .filter((window) => window.months > 0 && rows.length >= window.months)
    .map((window) => {
      const slice = rows.slice(-window.months);
      const portfolio = annualize(productReturn(slice.map((row) => row.portfolio)), slice.length);
      const benchmarkValues = slice.map((row) => row.benchmark);
      const benchmarkAligned = benchmarkValues.every((value): value is number => value != null);
      const benchmark = benchmarkAligned ? annualize(productReturn(benchmarkValues), benchmarkValues.length) : null;
      return {
        period: window.label,
        portfolio: pct.format(portfolio),
        benchmark: benchmark == null ? "n/a" : pct.format(benchmark),
        excess: benchmark == null ? "n/a" : pct.format(portfolio - benchmark),
        volatility: pct.format(std(slice.map((row) => row.portfolio)) * Math.sqrt(12))
      };
    });
}

function rollingRows(rows: { date: string; portfolio: number; benchmark: number | null }[]) {
  const output = [];
  for (let index = 12; index <= rows.length; index += 1) {
    const slice = rows.slice(index - 12, index);
    const portfolioValues = slice.map((row) => row.portfolio);
    const benchmarkValues = slice.map((row) => row.benchmark);
    if (!benchmarkValues.every((value): value is number => value != null)) continue;
    const active = portfolioValues.map((value, i) => value - benchmarkValues[i]);
    const volatility = std(portfolioValues) * Math.sqrt(12);
    output.push({
      date: rows[index - 1]?.date ?? "",
      return: productReturn(portfolioValues),
      benchmark: productReturn(benchmarkValues),
      volatility,
      sharpe: std(portfolioValues) ? mean(portfolioValues) / std(portfolioValues) * Math.sqrt(12) : null,
      tracking_error: std(active) * Math.sqrt(12)
    });
  }
  return output;
}

function annualRows(result: BacktestResult, monthlyRows: { date: string; portfolio: number; benchmark: number | null }[]) {
  return result.annual_returns.rows.map((row) => {
    const year = Number(row.year);
    const yearRows = monthlyRows.filter((item) => item.date.startsWith(String(year)));
    const benchmarkValues = yearRows.map((item) => item.benchmark);
    const benchmarkAligned = yearRows.length > 0 && benchmarkValues.every((value): value is number => value != null);
    const portfolio = asNumber(row.return);
    const benchmark = benchmarkAligned ? productReturn(benchmarkValues) : null;
    return {
      year,
      portfolio: pct.format(portfolio),
      benchmark: benchmark == null ? "n/a" : pct.format(benchmark),
      diff: benchmark == null ? "n/a" : pct.format(portfolio - benchmark)
    };
  });
}

function monthlyGrid(rows: { date: string; portfolio: number }[]): MonthlyGridRow[] {
  const byYear = new Map<number, (number | null)[]>();
  rows.forEach((row) => {
    const date = new Date(`${row.date}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth();
    if (!byYear.has(year)) byYear.set(year, Array.from({ length: 12 }, () => null));
    byYear.get(year)![month] = row.portfolio;
  });
  return [...byYear.entries()].map(([year, months]) => ({ year, months }));
}

function histogramRows(values: number[]) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / 10 || 0.01;
  const rows = Array.from({ length: 10 }, (_, index) => {
    const from = min + index * width;
    const to = from + width;
    return { from, to, bin: `${pct.format(from)} to ${pct.format(to)}`, count: 0 };
  });
  values.forEach((value) => {
    const index = Math.max(0, Math.min(rows.length - 1, Math.floor((value - min) / width)));
    rows[index].count += 1;
  });
  return rows;
}

function worstDrawdownPeriods(points: TimeSeriesPoint[]) {
  const periods: { peak: string; trough: string; recovery: string; depth: number; months: number }[] = [];
  let start: number | null = null;
  for (let index = 0; index < points.length; index += 1) {
    const value = points[index]?.value ?? 0;
    if (start == null && value < -0.0001) start = Math.max(0, index - 1);
    if (start != null && value >= -0.0001) {
      periods.push(drawdownPeriod(points, start, index));
      start = null;
    }
  }
  if (start != null) periods.push(drawdownPeriod(points, start, points.length - 1));
  return periods.sort((a, b) => a.depth - b.depth).slice(0, 5).map((row) => ({
    peak: row.peak,
    trough: row.trough,
    recovery: row.recovery,
    depth: pct.format(row.depth),
    months: row.months
  }));
}

function drawdownPeriod(points: TimeSeriesPoint[], start: number, end: number) {
  let trough = start;
  for (let index = start; index <= end; index += 1) {
    if ((points[index]?.value ?? 0) < (points[trough]?.value ?? 0)) trough = index;
  }
  return {
    peak: points[start]?.date ?? "",
    trough: points[trough]?.date ?? "",
    recovery: end === points.length - 1 ? "Ongoing" : points[end]?.date ?? "",
    depth: points[trough]?.value ?? 0,
    months: Math.max(0, end - start)
  };
}

function prepareSeries(series: ChartSeries[]) {
  const maxLength = Math.max(1, ...series.map((item) => item.points.length));
  const step = Math.max(1, Math.floor(maxLength / 140));
  const sampledSeries = series.map((item) => ({
    ...item,
    points: item.points.filter((_, index) => index % step === 0 || index === item.points.length - 1)
  }));
  const pointCount = Math.max(1, ...sampledSeries.map((item) => item.points.length));
  const allValues = sampledSeries.flatMap((item) => item.points.map((point) => point.value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const range = max - min || 1;
  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const value = min + (range * index) / 5;
    const y = 280 - ((value - min) / range) * 256;
    return { value, y };
  }).reverse();
  const xFor = (index: number, length: number) => 70 + (index / Math.max(1, length - 1)) * 780;
  const yFor = (value: number) => 280 - ((value - min) / range) * 256;
  const paths = sampledSeries.map((item) => ({
    label: item.label,
    color: item.color,
    dashed: item.dashed,
    d: item.points.map((point, index) => `${index ? "L" : "M"} ${xFor(index, item.points.length).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(" ")
  }));
  const endpoints = sampledSeries.map((item) => {
    const point = lastPoint(item.points) ?? { date: "", value: 0 };
    return {
      label: item.label,
      color: item.color,
      x: 850,
      y: yFor(point.value)
    };
  });
  const dateSource = sampledSeries.reduce((longest, item) => (item.points.length > longest.length ? item.points : longest), [] as TimeSeriesPoint[]);
  const dates = dateSource.map((point) => point.date);
  const tickCount = Math.min(6, pointCount);
  const xTicks = Array.from({ length: tickCount }, (_, index) => {
    const pointIndex = tickCount > 1 ? Math.round((index * (pointCount - 1)) / (tickCount - 1)) : 0;
    return { x: xFor(pointIndex, pointCount), date: dates[pointIndex] ?? "" };
  });
  const seriesValues = sampledSeries.map((item) => item.points.map((point) => point.value));
  return {
    paths,
    endpoints,
    yTicks,
    xTicks,
    dates,
    seriesValues,
    pointCount,
    yFor,
    min,
    max,
    latestValue: lastPoint(series[0]?.points ?? [])?.value ?? 0,
    startDate: series[0]?.points[0]?.date ?? "",
    endDate: lastPoint(series[0]?.points ?? [])?.date ?? ""
  };
}

function summaryMetrics(result: BacktestResult): SummaryMetric[] {
  const m = result.summary;
  if (result.request.objective === "monthly_dca") {
    return [
      { label: "Total contributed", value: money.format(m.total_contributed) },
      { label: "Ending value", value: money.format(m.ending_value) },
      { label: "Net profit", value: money.format(m.ending_value + m.total_withdrawn - m.total_contributed) },
      { label: "TWRR CAGR", value: pct.format(m.twrr_cagr) },
      { label: "Max drawdown", value: pct.format(m.max_drawdown) },
      { label: "Sharpe", value: formatNumber(m.sharpe) }
    ];
  }
  if (result.request.objective === "monthly_withdrawal") {
    return [
      { label: "Total withdrawn", value: money.format(m.total_withdrawn) },
      { label: "Ending value", value: money.format(m.ending_value) },
      { label: "Portfolio status", value: m.ending_value > 0 ? "Survived" : "Depleted" },
      { label: "Worst drawdown", value: pct.format(m.max_drawdown) },
      { label: "TWRR CAGR", value: pct.format(m.twrr_cagr) },
      { label: "Sharpe", value: formatNumber(m.sharpe) }
    ];
  }
  if (result.request.objective === "rebalancing_impact") {
    return [
      { label: "Rebalance count", value: String(m.rebalance_count) },
      { label: "Total costs", value: money.format(m.total_costs) },
      { label: "Ending value", value: money.format(m.ending_value) },
      { label: "TWRR CAGR", value: pct.format(m.twrr_cagr) },
      { label: "Max drawdown", value: pct.format(m.max_drawdown) },
      { label: "Sharpe", value: formatNumber(m.sharpe) }
    ];
  }
  return [
    { label: "Ending value", value: money.format(m.ending_value) },
    { label: "TWRR CAGR", value: pct.format(m.twrr_cagr) },
    { label: "Volatility", value: pct.format(m.volatility) },
    { label: "Sharpe", value: formatNumber(m.sharpe) },
    { label: "Max drawdown", value: pct.format(m.max_drawdown) },
    { label: "Excess vs benchmark", value: formatPercentLike(m.benchmark_excess_return) }
  ];
}

function objectiveNarrative(result: BacktestResult) {
  const m = result.summary;
  if (result.request.objective === "monthly_dca") {
    return `You contributed ${money.format(m.total_contributed)} through SEC fund NAV history. Ending value was ${money.format(m.ending_value)} with TWRR CAGR ${pct.format(m.twrr_cagr)}.`;
  }
  if (result.request.objective === "monthly_withdrawal") {
    return `You withdrew ${money.format(m.total_withdrawn)}. The portfolio ${m.ending_value > 0 ? "remained above zero" : "depleted"} with ending value ${money.format(m.ending_value)}.`;
  }
  if (result.request.objective === "rebalancing_impact") {
    return `The run produced ${m.rebalance_count} rebalance events with total modeled costs of ${money.format(m.total_costs)}.`;
  }
  return `Static allocation result: ending value ${money.format(m.ending_value)}, TWRR CAGR ${pct.format(m.twrr_cagr)}, max drawdown ${pct.format(m.max_drawdown)}.`;
}

function objectiveChecklist(result: BacktestResult) {
  const m = result.summary;
  const base = [
    { question: "Benchmark risk acceptable?", result: `Beta ${formatNumber(findRiskValue(result, "beta"))}, alpha ${formatPercentLike(findRiskValue(result, "alpha"))}`, evidence_tab: "Overview / Metrics" },
    { question: "Worst historical loss visible?", result: `Max drawdown ${pct.format(m.max_drawdown)}`, evidence_tab: "Drawdown" },
    { question: "Diversification visible?", result: `${result.diversification.rows.length} diversification rows`, evidence_tab: "Metrics" },
    { question: "CQF report ready?", result: "Objective, inputs, formulas, results, limitations", evidence_tab: "Report" }
  ];
  if (result.request.objective === "monthly_dca") {
    return [{ question: "How much did the investor put in?", result: money.format(m.total_contributed), evidence_tab: "Cashflows" }, ...base];
  }
  if (result.request.objective === "monthly_withdrawal") {
    return [{ question: "Did the portfolio survive withdrawals?", result: m.ending_value > 0 ? "Survived" : "Depleted", evidence_tab: "Summary" }, ...base];
  }
  if (result.request.objective === "rebalancing_impact") {
    return [{ question: "How often did the strategy trade?", result: `${m.rebalance_count} events`, evidence_tab: "Rebalancing" }, ...base];
  }
  return [{ question: "Did allocation outperform benchmark?", result: `Excess ${formatPercentLike(m.benchmark_excess_return)}`, evidence_tab: "Overview" }, ...base];
}

function assumptionRows(result: BacktestResult) {
  const request = result.request;
  return [
    { input: "Date range", value: `${request.start_date} to ${request.end_date}` },
    { input: "Portfolio", value: request.assets.map((asset) => `${asset.display_name} ${asset.weight}%`).join("; ") },
    { input: "Benchmark", value: request.benchmark_proj_id },
    { input: "Risk-free rate", value: `${request.risk_free_rate_pct}% / yr` },
    { input: "Cashflow", value: request.cashflow.enabled ? `${request.cashflow.type} ${money.format(request.cashflow.amount)} ${request.cashflow.frequency} ${request.cashflow.timing}` : "Disabled" },
    { input: "Rebalancing", value: request.rebalancing.mode },
    { input: "Costs", value: `${request.costs.transaction_bps} bps transaction, ${request.costs.slippage_bps} bps slippage, ${request.costs.annual_drag_pct}% annual drag` },
    { input: "Data source", value: "SEC Open Data cached NAV, nav_per_unit" },
    { input: "Price basis", value: "SEC NAV per unit; adjusted close and dividend switches are not stock-price assumptions in this project" }
  ];
}

function keyMetricRows(result: BacktestResult) {
  const m = result.summary;
  return [
    { metric: "Ending value", value: money.format(m.ending_value), formula: "Portfolio value after returns, cashflows, costs, and rebalancing" },
    { metric: "TWRR", value: pct.format(m.twrr), formula: "Product of linked sub-period returns minus 1" },
    { metric: "TWRR CAGR", value: pct.format(m.twrr_cagr), formula: "(1 + TWRR)^(1/years) - 1" },
    { metric: "Volatility", value: pct.format(m.volatility), formula: "Std(monthly returns) * sqrt(12)" },
    { metric: "Sharpe ratio", value: formatNumber(m.sharpe), formula: "Annualized excess return / annualized volatility" },
    { metric: "Maximum drawdown", value: pct.format(m.max_drawdown), formula: "Value / running peak - 1" },
    { metric: "Benchmark excess return", value: formatPercentLike(m.benchmark_excess_return), formula: "Cumulative portfolio TWRR - cumulative benchmark return over matched periods" },
    { metric: "Total contributed", value: money.format(m.total_contributed), formula: "Initial capital + sum of applied positive cashflows" },
    { metric: "Total withdrawn", value: money.format(m.total_withdrawn), formula: "Sum of withdrawal cashflow rules" },
    { metric: "Total costs", value: money.format(m.total_costs), formula: "Turnover * transaction/slippage assumptions plus drag where applicable" }
  ];
}

function buildNetInvestedCurve(result: BacktestResult) {
  let invested = result.request.initial_capital;
  const cashflowsByDate = new Map<string, number>();
  result.cashflows.forEach((cashflow) => cashflowsByDate.set(cashflow.date, (cashflowsByDate.get(cashflow.date) ?? 0) + cashflow.amount));
  return result.equity_curve.map((point) => {
    invested += cashflowsByDate.get(point.date) ?? 0;
    return { date: point.date, value: invested };
  });
}

function milestoneRows(result: BacktestResult, netInvested: TimeSeriesPoint[]) {
  const indexes = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.min(result.equity_curve.length - 1, Math.round((result.equity_curve.length - 1) * ratio)));
  const benchmarkByDate = new Map(result.benchmark_curve.map((point) => [point.date, point.value]));
  return indexes.map((index) => {
    const equityPoint = result.equity_curve[index];
    const benchmarkValue = equityPoint ? benchmarkByDate.get(equityPoint.date) : undefined;
    return {
      date: equityPoint?.date,
      portfolio: money.format(equityPoint?.value ?? 0),
      benchmark: benchmarkValue == null ? "n/a" : money.format(benchmarkValue),
      net_invested: money.format(netInvested[index]?.value ?? 0),
      profit_over_invested: money.format((equityPoint?.value ?? 0) - (netInvested[index]?.value ?? 0))
    };
  });
}

function stressRows(result: BacktestResult) {
  return [-0.1, -0.2, -0.35, result.summary.max_drawdown].map((shock) => ({
    scenario: shock === result.summary.max_drawdown ? "Repeat historical max drawdown" : `${pct.format(shock)} portfolio shock`,
    impact: pct.format(shock),
    value_after_stress: money.format(result.summary.ending_value * (1 + shock)),
    note: shock === result.summary.max_drawdown ? "Historical path stress from SEC NAV data" : "Deterministic shock applied to ending value"
  }));
}

function reportRows(result: BacktestResult) {
  return [
    { section: "Objective", detail: objectiveTitle(result) },
    { section: "Data", detail: "SEC Open Data cached fund NAV only; no mock market series in production output." },
    { section: "Inputs", detail: assumptionRows(result).map((row) => `${row.input}: ${row.value}`).join(" | ") },
    { section: "Performance Results", detail: `Ending value ${money.format(result.summary.ending_value)}, TWRR CAGR ${pct.format(result.summary.twrr_cagr)}, volatility ${pct.format(result.summary.volatility)}, Sharpe ${formatNumber(result.summary.sharpe)}.` },
    { section: "Benchmark Risk", detail: `Benchmark ${result.request.benchmark_proj_id}; beta ${formatNumber(findRiskValue(result, "beta"))}; alpha ${formatPercentLike(findRiskValue(result, "alpha"))}; tracking error ${formatPercentLike(findRiskValue(result, "tracking_error"))}.` },
    { section: "Drawdown Stress", detail: `Maximum drawdown ${pct.format(result.summary.max_drawdown)}; stress table is computed from ending value and historical drawdown.` },
    { section: "Diversification Check", detail: `${result.diversification.rows.length} diversification rows reviewed from aligned SEC return series.` },
    { section: "Rebalancing and Cashflows", detail: `Cashflow events ${result.summary.cashflow_count}; rebalance events ${result.summary.rebalance_count}; total costs ${money.format(result.summary.total_costs)}.` },
    { section: "CQF Formula Notes", detail: result.formula_references.join("; ") },
    { section: "Limitations", detail: "Historical NAV backtest; no forecast, tax, individual investor timing, or unmodeled fund-specific fee changes." }
  ];
}

function benchmarkDecompositionRows(result: BacktestResult, derived: ReturnType<typeof deriveResult>) {
  return [
    { metric: "CAGR", portfolio: pct.format(result.summary.twrr_cagr), benchmark_active_view: trailingBenchmarkFull(derived), interpretation: "Long-run compounded return" },
    { metric: "Volatility", portfolio: pct.format(result.summary.volatility), benchmark_active_view: `Correlation ${formatNumber(findRiskValue(result, "correlation"))}`, interpretation: "Total risk and market linkage" },
    { metric: "Beta", portfolio: formatNumber(findRiskValue(result, "beta")), benchmark_active_view: `Alpha ${formatPercentLike(findRiskValue(result, "alpha"))}`, interpretation: "Systematic exposure and residual return" },
    { metric: "Tracking error", portfolio: formatPercentLike(findRiskValue(result, "tracking_error")), benchmark_active_view: `Information ratio ${formatNumber(findRiskValue(result, "information_ratio"))}`, interpretation: "Active risk efficiency" }
  ];
}

function stressInterpretationRows(result: BacktestResult, derived: ReturnType<typeof deriveResult>) {
  const values = result.equity_curve.map((point) => point.value);
  return [
    { check: "Capital at risk", result: `${money.format(Math.max(...values) - Math.min(...values))} peak-to-trough path range in SEC NAV history` },
    { check: "Recovery pressure", result: `${derived.drawdownPeriods[0]?.months ?? 0} months in the deepest drawdown period` },
    { check: "Benchmark stress", result: `Portfolio beta ${formatNumber(findRiskValue(result, "beta"))}; benchmark shocks are translated through historical beta` }
  ];
}

function assetRows(result: BacktestResult, derived: ReturnType<typeof deriveResult>) {
  return result.request.assets.map((asset) => ({
    fund: asset.display_name,
    proj_id: asset.proj_id,
    target: `${asset.weight.toFixed(1)}%`,
    final: `${asset.weight.toFixed(1)}%`,
    drift: "0.0%",
    portfolio_window_cagr: pct.format(result.summary.twrr_cagr),
    portfolio_window_vol: pct.format(result.summary.volatility),
    benchmark_corr_source: `${result.diversification.rows.length} pair row(s)`,
    note: derived.monthlyRows.length ? "Asset-level final holdings are not returned by backend yet; target weights shown from submitted SEC request." : "No return rows"
  }));
}

function yearlyCashflowRows(result: BacktestResult) {
  const byYear = new Map<string, { year: string; contributions: number; withdrawals: number; events: number }>();
  result.cashflows.forEach((cashflow) => {
    const year = cashflow.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, { year, contributions: 0, withdrawals: 0, events: 0 });
    const row = byYear.get(year)!;
    if (cashflow.amount >= 0) row.contributions += cashflow.amount;
    else row.withdrawals += Math.abs(cashflow.amount);
    row.events += 1;
  });
  return [...byYear.values()].map((row) => ({
    year: row.year,
    contributions: money.format(row.contributions),
    withdrawals: money.format(row.withdrawals),
    events: row.events
  }));
}

function monthRow(row: { date: string; portfolio: number; benchmark: number | null }) {
  return {
    date: row.date,
    portfolio: pct.format(row.portfolio),
    benchmark: row.benchmark == null ? "n/a" : pct.format(row.benchmark),
    diff: row.benchmark == null ? "n/a" : pct.format(row.portfolio - row.benchmark)
  };
}

function trailingBenchmarkFull(derived: ReturnType<typeof deriveResult>) {
  const full = derived.trailingReturns.find((row) => row.period === "Full");
  return full?.benchmark ?? "n/a";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function std(values: number[]) {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function productReturn(values: number[]) {
  return values.reduce((total, value) => total * (1 + value), 1) - 1;
}

function annualize(totalReturn: number, months: number) {
  if (!months) return 0;
  return (1 + totalReturn) ** (12 / months) - 1;
}

function heatColor(value: number) {
  const opacity = Math.max(0.16, Math.min(0.9, Math.abs(value) / 0.08 + 0.12));
  return value >= 0 ? `rgb(19 122 79 / ${opacity})` : `rgb(180 35 24 / ${opacity})`;
}

function formatCell(value: unknown) {
  if (value == null) return "n/a";
  if (typeof value === "number") {
    if (Math.abs(value) <= 1) return value.toFixed(4);
    if (Number.isInteger(value) && value >= 1000 && value <= 9999) return String(value);
    return number.format(value);
  }
  return String(value);
}

function findRiskValue(result: BacktestResult, metric: string) {
  const row = result.risk_metrics.rows.find((item) => String(item.metric).toLowerCase() === metric);
  return typeof row?.value === "number" ? row.value : null;
}

function formatNumber(value: number | null) {
  return value == null || Number.isNaN(value) ? "n/a" : value.toFixed(2);
}

function formatPercentLike(value: number | null) {
  return value == null || Number.isNaN(value) ? "n/a" : pct.format(value);
}

function objectiveTitle(result: BacktestResult) {
  return String(result.objective_summary.objective ?? result.request.objective).replace(/_/g, " ");
}

function lastDate(points: TimeSeriesPoint[]) {
  return lastPoint(points)?.date ?? "";
}

function lastPoint<T>(items: T[]) {
  return items.length ? items[items.length - 1] : undefined;
}

function ulcerIndex(points: TimeSeriesPoint[]) {
  if (!points.length) return null;
  return Math.sqrt(points.reduce((sum, point) => sum + point.value ** 2, 0) / points.length);
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function downloadJson(result: BacktestResult) {
  downloadText(`${result.run_id}.json`, JSON.stringify(result, null, 2), "application/json");
}

function reportMarkdown(rows: { section: string; detail: string }[]) {
  return rows.map((row) => `## ${row.section}\n\n${row.detail}`).join("\n\n");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
