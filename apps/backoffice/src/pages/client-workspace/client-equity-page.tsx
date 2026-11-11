import { ApiError } from "@atomprive/api-client";
import {
  useGetClientEquity,
  type ClientEquity,
  type EquityHolding,
  type EquityKpi,
  type IpsAllocationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { ScatterChart } from "echarts/charts";
import { LabelLayout } from "echarts/features";
import * as echarts from "echarts/core";

// Names that would land on one another are left to the tooltip.
echarts.use([ScatterChart, LabelLayout]);

/**
 * A client's Equity Analytics, laid out section by section as the firm's 10 Nov design draws it. Every figure — each
 * portfolio-weighted fundamental, every active weight, the style box, contributions, concentration and the valuation
 * history — is worked out on the server and shown here as it comes. The fundamentals are demo figures, which the page
 * says. A client whose figures come only from their bank's files sees their equity lines as sent, and every other card
 * in its place, not in bank file. Read only.
 */
export function ClientEquityPage() {
  const { customerId = "" } = useParams();
  const [view, setView] = useState<"LOOK_THROUGH" | "DIRECT">("LOOK_THROUGH");
  const equity = useGetClientEquity<ClientEquity, ApiError>(customerId, { view }, { query: { placeholderData: keepPreviousData } });
  const data = equity.data;

  if (equity.isError) return <Alert tone="danger">{equity.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the equity sleeve…</p>;
  const file = data.bankFile;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Equity Analytics
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Equity Analytics</h1>
        <p className="mt-1 text-sm text-ink-muted">Portfolio-weighted fundamentals, positioning and contribution against MSCI ACWI</p>
      </header>

      <Strip data={data} view={view} setView={setView} />
      <Kpis data={data} />
      <Segments data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.03fr_1fr]">
        <Sectors data={data} />
        <RegionStyle data={data} />
      </div>
      <Holdings data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Scatter data={data} />
        <Contributions data={data} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <CapCard data={data} />
        <ConcentrationCard data={data} />
        <HistoryCard data={data} />
      </div>

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {file ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
          {!file && data.note && ` ${data.note}`}
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Strip({ data, view, setView }: { data: ClientEquity; view: string; setView: (next: "LOOK_THROUGH" | "DIRECT") => void }) {
  const s = data.strip;
  const file = data.bankFile;
  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-ink-muted">Equity sleeve</span>
          {file ? (
            s.fileValues.length === 0 ? <NotInFile /> : s.fileValues.map((one) => (
              <b key={one.currency} className="tabular-nums">{exact(one.amount, one.currency)}</b>
            ))
          ) : <b className="text-lg tabular-nums">{s.value == null ? "—" : compact(s.value, data.currency)}</b>}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-ink-muted">% of net worth</span>
          {file ? <NotInFile /> : <b className="tabular-nums">{s.netWorthPercent == null ? "—" : `${s.netWorthPercent.toFixed(1)}%`}</b>}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-ink-muted">YTD</span>
          {file ? <NotInFile /> : (
            <>
              <b className={cn("tabular-nums", toneOf(s.ytd))}>{signed(s.ytd)}</b>
              <span className="text-xs text-ink-muted">vs {signed(s.benchmarkYtd)}</span>
            </>
          )}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-ink-muted">Positions</span>
          <b className="tabular-nums">{s.positions}</b>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!file && (
          <div role="group" aria-label="Positions read" className="flex rounded-lg border border-line p-0.5">
            {([["DIRECT", "Direct only"], ["LOOK_THROUGH", "With fund look-through"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
                className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                  view === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <span className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">Benchmark: <b>{data.benchmark} (USD)</b></span>
        <span className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">Entity: <b>All</b></span>
      </div>
    </section>
  );
}

function Kpis({ data }: { data: ClientEquity }) {
  const labels = ["P/E · trailing", "P/E · forward 12M", "Price / Book", "Return on equity", "Dividend yield", "EPS growth · 3Y CAGR",
    "Net debt / EBITDA", "Beta (vs ACWI)", "Wtd. avg. market cap", "Active share", "Tracking error · ex-ante", "Holdings · coverage"];
  const kpis: (EquityKpi | null)[] = data.bankFile ? labels.map(() => null) : data.kpis;
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      {kpis.map((one, at) => (
        <div key={one?.key ?? labels[at]} className="rounded-2xl border border-line bg-white px-4 py-3.5">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one?.label ?? labels[at]}</p>
          {!one ? <div className="mt-2"><NotInFile /></div> : (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{one.value == null ? "—" : figure(one.value, one.unit)}</span>
                {one.delta != null && one.deltaUnit !== "NONE" && (
                  <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums", deltaTone(one))}>{delta(one)}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {one.reason && one.value == null ? <NotMeasured title={one.reason} /> : (
                  <>MSCI ACWI {one.benchmark == null ? "—" : figure(one.benchmark, one.unit)}</>
                )}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Segments({ data }: { data: ClientEquity }) {
  const rows = data.segments;
  const scale = Math.max(10, ...rows.map((one) => Math.max(one.max ?? 0, one.actual))) * 1.05;
  return (
    <Card title="Equity Segments · Target vs Actual" lead={data.bankFile ? undefined : data.segmentsNote ?? undefined} flush
      action={!data.bankFile && (
        <Link to={`/client-workspace/${data.customerId}/ips`} className="text-xs font-semibold text-primary-700 hover:underline">All asset classes</Link>
      )}>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : rows.length === 0 ? <Empty>No model to measure against yet.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3 pl-5">Asset class / sub-class</th>
                  <th scope="col" className="px-2 py-2 text-right">Min</th>
                  <th scope="col" className="px-2 py-2 text-right">Target</th>
                  <th scope="col" className="px-2 py-2 text-right">Max</th>
                  <th scope="col" className="px-2 py-2 text-right">Actual</th>
                  <th scope="col" className="px-2 py-2 text-right">Value</th>
                  <th scope="col" className="px-2 py-2 text-right">Deviation</th>
                  <th scope="col" className="px-2 py-2 text-right">Deviation {symbolOf(data.currency)}</th>
                  <th scope="col" className="w-48 px-2 py-2">Position in band</th>
                  <th scope="col" className="py-2 pr-5 pl-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((one) => <SegmentLine key={one.key} row={one} scale={scale} currency={data.currency} />)}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-5 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-primary-600" aria-hidden="true" />Actual</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-slate-100" aria-hidden="true" />Tolerance band</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-red-600" aria-hidden="true" />Target</li>
          </ul>
        </>
      )}
    </Card>
  );
}

const SEGMENT_STATUS: Record<string, [string, string]> = {
  DEVIATION: ["Deviation", "text-red-700"],
  NEAR_EDGE: ["Near edge", "text-amber-700"],
  WITHIN: ["Within band", "text-emerald-700"],
};

function SegmentLine({ row, scale, currency }: { row: IpsAllocationRow; scale: number; currency: string }) {
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const [label, tone] = SEGMENT_STATUS[row.status] ?? ["—", "text-ink-muted"];
  const pct = (value: number | null) => (value == null ? "—" : `${value.toFixed(row.assetClass ? 1 : 2)}%`);
  return (
    <tr className={cn(row.assetClass && "bg-slate-50 font-semibold")}>
      <th scope="row" className={cn("py-2 pr-3 text-left", row.assetClass ? "pl-5" : "pl-9 font-normal")}>{row.name}</th>
      <td className="px-2 py-2 text-right tabular-nums">{pct(row.min)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{pct(row.target)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{pct(row.max)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{pct(row.actual)}</td>
      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{compact(row.value, currency)}</td>
      <td className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums", toneOf(row.deviationPoints))}>
        {row.deviationPoints == null ? "—" : `${row.deviationPoints > 0 ? "+" : ""}${row.deviationPoints.toFixed(2)} pp`}
      </td>
      <td className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums", toneOf(row.deviationValue))}>
        {row.deviationValue == null ? "—" : `${row.deviationValue > 0 ? "+" : ""}${compact(row.deviationValue, currency)}`}
      </td>
      <td className="px-2 py-2">
        {row.min != null && row.max != null && row.target != null ? (
          <span className="relative block h-3" aria-hidden="true">
            <span className="absolute top-0 h-3 rounded-sm bg-slate-100" style={{ left: at(row.min), width: `calc(${at(row.max)} - ${at(row.min)})` }} />
            <span className="absolute top-1 left-0 h-1 rounded-full bg-primary-600" style={{ width: at(row.actual) }} />
            <span className="absolute -top-0.5 h-4 w-0.5 bg-red-600" style={{ left: at(row.target) }} />
          </span>
        ) : null}
      </td>
      <td className={cn("py-2 pr-5 pl-2 text-xs font-semibold whitespace-nowrap", tone)}>{label}</td>
    </tr>
  );
}

function Sectors({ data }: { data: ClientEquity }) {
  const largest = Math.max(1, ...data.sectors.flatMap((one) => [one.portfolio, one.benchmark ?? 0]));
  return (
    <Card title="Sector Allocation vs Benchmark"
      lead={data.view === "LOOK_THROUGH" ? "GICS level 1 · fund look-through applied" : "GICS level 1 · lines as held, funds not looked through"}>
      {data.bankFile ? <FileBlock /> : (
        <>
          <ul className="space-y-1.5">
            {data.sectors.map((one) => (
              <li key={one.key} className="grid grid-cols-[minmax(0,10rem)_1fr_5.5rem_2.5rem] items-center gap-2 text-xs">
                <span className="truncate">{one.name}</span>
                <span className="space-y-0.5" aria-hidden="true">
                  <span className="block h-1.5 rounded-full bg-slate-800" style={{ width: `${(one.portfolio / largest) * 100}%` }} />
                  <span className="block h-1.5 rounded-full bg-slate-300" style={{ width: `${((one.benchmark ?? 0) / largest) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums"><b>{one.portfolio.toFixed(1)}</b> / {one.benchmark == null ? "—" : one.benchmark.toFixed(1)}</span>
                <span className={cn("text-right tabular-nums", toneOf(one.active))}>{one.active == null ? "" : `${one.active > 0 ? "+" : ""}${one.active.toFixed(1)}`}</span>
              </li>
            ))}
          </ul>
          <Legend items={[["Portfolio %", "bg-slate-800"], ["MSCI ACWI %", "bg-slate-300"]]} />
        </>
      )}
    </Card>
  );
}

function RegionStyle({ data }: { data: ClientEquity }) {
  const cells = data.styleBox;
  const deepest = Math.max(1, ...cells.map((one) => one.portfolio));
  return (
    <Card title="Region & Style" lead="Domicile of risk · style by valuation & growth" flush>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Region</th>
                <th scope="col" className="px-2 py-2 text-right">Port.</th>
                <th scope="col" className="px-2 py-2 text-right">Bench</th>
                <th scope="col" className="px-2 py-2 text-right">Active</th>
                <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Active bar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.regions.map((one) => (
                <tr key={one.key}>
                  <th scope="row" className="py-1.5 pr-3 pl-5 text-left font-normal">{one.name}</th>
                  <td className="px-2 py-1.5 text-right tabular-nums">{one.portfolio.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-soft">{one.benchmark == null ? "—" : `${one.benchmark.toFixed(1)}%`}</td>
                  <td className={cn("px-2 py-1.5 text-right tabular-nums", toneOf(one.active))}>{one.active == null ? "—" : `${one.active > 0 ? "+" : ""}${one.active.toFixed(1)}`}</td>
                  <td className="py-1.5 pr-5 pl-2">
                    <span className="block h-1.5 w-24 rounded-full bg-slate-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-amber-600" style={{ width: `${Math.min(100, one.portfolio)}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 px-5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Morningstar-style box · % of equity</p>
          <div className="mt-2 grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] gap-1 px-5">
            {["Large", "Mid", "Small"].map((size) => (
              <div key={size} className="contents">
                <span className="self-center text-xs text-ink-muted">{size}</span>
                {["Value", "Blend", "Growth"].map((style) => {
                  const cell = cells.find((one) => one.size === size && one.style === style);
                  const depth = (cell?.portfolio ?? 0) / deepest;
                  return (
                    <div key={style} className={cn("rounded-sm py-3 text-center", depth > 0.6 ? "bg-slate-800 text-white" : depth > 0.25 ? "bg-slate-400 text-white" : "bg-slate-100")}>
                      <p className="text-base font-bold tabular-nums">{cell?.portfolio ?? 0}%</p>
                      <p className="text-3xs opacity-80">bm {cell?.benchmark ?? "—"}%</p>
                    </div>
                  );
                })}
              </div>
            ))}
            <span />
            {["Value", "Blend", "Growth"].map((style) => <span key={style} className="text-center text-xs text-ink-muted">{style}</span>)}
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const TABS = [["fundamentals", "Fundamentals"], ["performance", "Performance"], ["risk", "Risk"]] as const;
type Tab = (typeof TABS)[number][0];

function Holdings({ data }: { data: ClientEquity }) {
  const [tab, setTab] = useState<Tab>("fundamentals");
  const rows = [...data.holdings, ...(data.portfolio ? [data.portfolio] : []), ...(data.benchmarkRow ? [data.benchmarkRow] : [])];
  const cur = data.currency;
  const x = (value: number | null) => (value == null ? "—" : `${value.toFixed(1)}×`);
  const p = (value: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`);
  const columns: [string, (one: EquityHolding) => ReactNode][] = tab === "fundamentals" ? [
    ["Mkt cap", (one) => (one.marketCap == null ? "—" : `$${Math.round(one.marketCap).toLocaleString("en-US")}B`)],
    ["P/E", (one) => x(one.pe)], ["Fwd P/E", (one) => x(one.forwardPe)], ["P/B", (one) => x(one.pb)], ["ROE", (one) => p(one.roe)],
    ["Div. yld", (one) => p(one.dividendYield)], ["EPS g 3Y", (one) => <Toned value={one.epsGrowth} />], ["ND/EBITDA", (one) => x(one.netDebtEbitda)],
    ["Beta", (one) => (one.beta == null ? "—" : one.beta.toFixed(2))], ["YTD", (one) => <Toned value={one.ytd} />],
    ["Contrib.", (one) => (one.contribution == null ? "—" : `${one.contribution > 0 ? "+" : ""}${one.contribution} bp`)],
  ] : tab === "performance" ? [
    ["1D", (one) => <Toned value={one.oneDay} digits={2} />], ["YTD", (one) => <Toned value={one.ytd} />],
    ["Contrib.", (one) => (one.contribution == null ? "—" : `${one.contribution > 0 ? "+" : ""}${one.contribution} bp`)],
  ] : [
    ["Beta", (one) => (one.beta == null ? "—" : one.beta.toFixed(2))], ["ND/EBITDA", (one) => x(one.netDebtEbitda)],
    ["Mkt cap", (one) => (one.marketCap == null ? "—" : `$${Math.round(one.marketCap).toLocaleString("en-US")}B`)],
  ];
  return (
    <Card title="Equity Holdings · Fundamentals" lead="Demo fundamentals per security, seeded, not a market-data feed · ROE on average equity" flush
      action={
        <div role="tablist" aria-label="Columns shown" className="flex rounded-lg border border-line p-0.5">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", tab === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
              {label}
            </button>
          ))}
        </div>
      }>
      {data.bankFile ? <FileLines data={data} /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Company</th>
                <th scope="col" className="px-1.5 py-2">Sector</th>
                <th scope="col" className="px-1.5 py-2">Country</th>
                <th scope="col" className="px-1.5 py-2 text-right">Value</th>
                <th scope="col" className="px-1.5 py-2 text-right">Wt.</th>
                {columns.map(([label], at) => (
                  <th key={label} scope="col" className={cn("py-2 text-right", at === columns.length - 1 ? "pr-5 pl-1.5" : "px-1.5")}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one, at) => (
                <tr key={`${one.name}-${at}`} className={cn(one.kind === "PORTFOLIO" && "border-t-2 border-line font-bold", one.kind === "BENCHMARK" && "text-ink-soft")}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left font-normal">
                    <span className={cn(one.kind !== "BENCHMARK" && "font-semibold")}>{one.kind === "BENCHMARK" ? `${one.name} (benchmark)` : one.name}</span>
                    {one.ticker && <span className="block text-2xs text-ink-muted">{one.ticker}</span>}
                  </th>
                  <td className="px-1.5 py-2 text-xs">{short(one.sector)}</td>
                  <td className="px-1.5 py-2 text-xs">{one.country ?? "—"}</td>
                  <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">{one.value == null ? "" : compact(one.value, cur)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{one.weight == null ? "" : `${one.weight.toFixed(1)}%`}</td>
                  {columns.map(([label, cell], at) => (
                    <td key={label} className={cn("py-2 text-right whitespace-nowrap tabular-nums", at === columns.length - 1 ? "pr-5 pl-1.5" : "px-1.5")}>{cell(one)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.view === "LOOK_THROUGH" && (
            <p className="mt-2 px-5 text-3xs text-ink-muted italic">
              Fund rows are what each fund's factsheet does not name; 1D is the fund line's own, and is not kept per company.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function FileLines({ data }: { data: ClientEquity }) {
  if (data.fileLines.length === 0) return <div className="px-5"><FileBlock /></div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-5">Company</th>
            <th scope="col" className="px-1.5 py-2">Sector</th>
            <th scope="col" className="px-1.5 py-2">Country</th>
            <th scope="col" className="px-1.5 py-2 text-right">Value</th>
            {["Wt.", "Mkt cap", "P/E", "Fwd P/E", "P/B", "ROE", "YTD"].map((one) => (
              <th key={one} scope="col" className="px-1.5 py-2 text-right">{one}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.fileLines.map((one, at) => (
            <tr key={`${one.name}-${at}`}>
              <th scope="row" className="py-2 pr-2 pl-5 text-left font-semibold">
                {one.name}
                {one.identifier && <span className="block text-2xs font-normal text-ink-muted">{one.identifier}</span>}
              </th>
              <td className="px-1.5 py-2"><NotInFile tight /></td>
              <td className="px-1.5 py-2"><NotInFile tight /></td>
              <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">{exact(one.value, one.currency)}</td>
              {Array.from({ length: 7 }, (_, cell) => <td key={cell} className="px-1.5 py-2 text-right"><NotInFile tight /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-5 text-3xs text-ink-muted italic">His file's equity lines as the bank states them, by the bank's own class.</p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Scatter({ data }: { data: ClientEquity }) {
  const option = useMemo(() => {
    const colours = ink();
    const groups: [string, string, string][] = [["IT", "Info. Tech.", colours.text], ["FINANCIALS", "Financials", "#a16207"], ["OTHER", "Other sectors", "#d6c7a6"]];
    const largest = Math.max(1, ...data.scatter.map((one) => one.weight));
    return {
      textStyle: { fontFamily: colours.font },
      // Room above the plot for the benchmark P/E line's label.
      grid: { left: 8, right: 16, top: 28, bottom: 40, containLabel: true },
      legend: { bottom: 0, data: ["Info. Tech.", "Financials", "Other sectors", "Benchmark"], textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "item", formatter: (point: { data: [number, number, number, string, boolean] }) => point.data[4]
        ? `${point.data[3]}<br/>Fwd P/E ${point.data[0]}× · ROE above 78%, drawn at the cap`
        : `${point.data[3]}<br/>Fwd P/E ${point.data[0]}× · ROE ${point.data[1]}%` },
      xAxis: { type: "value", name: "Forward P/E", nameLocation: "middle", nameGap: 24, nameTextStyle: { color: colours.muted, fontSize: 10 }, scale: true,
        axisLabel: { color: colours.muted, formatter: "{value}×" }, splitLine: { lineStyle: { color: colours.line } } },
      yAxis: { type: "value", min: 0, max: 80, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        ...groups.map(([id, name, colour]) => ({
          type: "scatter", name, itemStyle: { color: colour, opacity: 0.9 },
          symbolSize: (value: [number, number, number]) => 8 + Math.sqrt(value[2] / largest) * 18,
          // A capped point carries only a small ↑ above it, its name in the tooltip; the rest are named beside them,
          // and a name that would land on another is left to the tooltip too.
          label: { show: true, position: "right", fontSize: 9, color: colours.muted,
            formatter: (point: { data: [number, number, number, string, boolean] }) => point.data[4] ? "" : point.data[3] },
          labelLayout: { hideOverlap: true },
          data: data.scatter.filter((one) => one.group === id).map((one) => [one.forwardPe, one.roe, one.weight, one.label, one.capped]),
        })),
        {
          type: "scatter", name: "Capped", silent: true, symbolSize: 1, itemStyle: { color: "transparent" }, z: 3, legendHoverLink: false,
          label: { show: true, position: "top", distance: 8, fontSize: 11, color: colours.muted, formatter: "↑" },
          data: data.scatter.filter((one) => one.capped).map((one) => [one.forwardPe, one.roe]),
        },
        { type: "line", name: "Benchmark", data: [], lineStyle: { color: colours.danger, type: "dashed" }, itemStyle: { color: colours.danger },
          markLine: { symbol: "none", silent: true, lineStyle: { color: colours.danger, type: "dashed", width: 1 },
            label: { color: colours.danger, fontSize: 9 },
            // Both labels inside the plot: the P/E one at the top of its line, the ROE one at the right end, above it.
            data: [
              ...(data.benchmarkForwardPe != null ? [{ xAxis: data.benchmarkForwardPe, label: { position: "end", formatter: `ACWI ${data.benchmarkForwardPe}×` } }] : []),
              ...(data.benchmarkRoe != null ? [{ yAxis: data.benchmarkRoe, label: { position: "insideEndTop", formatter: `ACWI ROE ${data.benchmarkRoe}%` } }] : []),
            ] } },
      ],
    };
  }, [data.scatter, data.benchmarkForwardPe, data.benchmarkRoe]);
  return (
    <Card title="Valuation vs Quality" lead="Forward P/E against ROE · bubble = position weight · ROE above 78% capped">
      {data.bankFile ? <FileBlock /> : data.scatter.length === 0 ? <Empty>No holding has fundamentals on file.</Empty> : (
        <Chart option={option} height={300} label="Each holding's forward P/E against its return on equity" />
      )}
    </Card>
  );
}

function Contributions({ data }: { data: ClientEquity }) {
  const largest = Math.max(1, ...data.contributions.map((one) => Math.abs(one.basisPoints)));
  return (
    <Card title="Contribution to Return · YTD"
      lead={data.bankFile ? undefined : `Basis points of equity sleeve return (${signed(data.strip.ytd)})`}>
      {data.bankFile ? <FileBlock /> : data.contributions.length === 0 ? <Empty>No return on file to attribute.</Empty> : (
        <ul className="space-y-1.5">
          {data.contributions.map((one) => (
            <li key={one.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_4.5rem] items-center gap-2 text-xs">
              <span className="leading-tight">{one.label}</span>
              <span className="relative block h-2.5" aria-hidden="true">
                <span className="absolute top-0 left-1/2 h-2.5 w-px bg-line" />
                <span className={cn("absolute top-0 h-2.5", one.basisPoints >= 0 ? "left-1/2 bg-emerald-700" : "right-1/2 bg-red-600")}
                  style={{ width: `${(Math.abs(one.basisPoints) / largest) * 50}%` }} />
              </span>
              <span className={cn("text-right tabular-nums", toneOf(one.basisPoints))}>{one.basisPoints > 0 ? "+" : ""}{one.basisPoints} bp</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CapCard({ data }: { data: ClientEquity }) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 16, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      // Their bucket names, each on two lines: the size, then its range.
      xAxis: { type: "category", data: data.capBuckets.map((one) => one.name),
        axisLabel: { color: colours.muted, fontSize: 9, interval: 0, lineHeight: 11, formatter: (value: string) => value.replace(" ", "\n") } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: "Portfolio", data: data.capBuckets.map((one) => one.portfolio), itemStyle: { color: colours.text },
          label: { show: true, position: "top", fontSize: 9, color: colours.muted } },
        { type: "bar", name: "MSCI ACWI", data: data.capBuckets.map((one) => one.benchmark), itemStyle: { color: colours.neutral },
          label: { show: true, position: "top", fontSize: 9, color: colours.muted } },
      ],
    };
  }, [data.capBuckets]);
  return (
    <Card title="Market-cap Distribution" lead="% of equity sleeve">
      {data.bankFile ? <FileBlock /> : <Chart option={option} height={210} label="The equity sleeve by company size against MSCI ACWI" />}
    </Card>
  );
}

function ConcentrationCard({ data }: { data: ClientEquity }) {
  const c = data.concentration;
  const option = useMemo(() => {
    const colours = ink();
    const points = c?.cumulative ?? [];
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: points.map((_, at) => at + 1), axisLabel: { color: colours.muted, fontSize: 9 }, boundaryGap: false },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Cumulative weight", data: points, showSymbol: false, lineStyle: { color: colours.text, width: 1.5 },
          areaStyle: { color: colours.canvas } },
        { type: "line", name: "Equal weight", data: points.map((_, at) => ((at + 1) / points.length) * 100), showSymbol: false,
          lineStyle: { color: colours.muted, type: "dashed", width: 1 } },
      ],
    };
  }, [c]);
  return (
    <Card title="Concentration" lead="Cumulative weight vs equal-weight line">
      {data.bankFile ? <FileBlock /> : !c ? <Empty>Nothing held.</Empty> : (
        <>
          <Chart option={option} height={160} label="Cumulative weight of holdings, largest first, against an equal-weight line" />
          <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <Stat label="Top 10 weight" value={`${c.topTen.toFixed(1)}%`} />
            <Stat label="Effective # names" value={c.effectiveNames.toFixed(1)} />
            <Stat label="Largest" value={`${c.largest} ${c.largestWeight.toFixed(1)}%`} />
            <Stat label="HHI" value={c.hhi.toFixed(3)} />
          </dl>
        </>
      )}
    </Card>
  );
}

function HistoryCard({ data }: { data: ClientEquity }) {
  const option = useMemo(() => {
    const colours = ink();
    const points = data.valuationHistory;
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => (value == null ? "—" : `${value}×`) },
      xAxis: { type: "category", boundaryGap: false, data: points.map((one) => one.on), axisLabel: { color: colours.muted, fontSize: 9, formatter: (value: string) => value.slice(0, 4) } },
      yAxis: { type: "value", scale: true, splitNumber: 4, axisLabel: { color: colours.muted, formatter: "{value}×" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Portfolio", data: points.map((one) => one.portfolio), showSymbol: false, lineStyle: { color: colours.text, width: 1.5 } },
        { type: "line", name: "MSCI ACWI", data: points.map((one) => one.benchmark), showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 } },
      ],
    };
  }, [data.valuationHistory]);
  return (
    <Card title="Valuation History · P/E" lead="Trailing 12M, quarterly">
      {data.bankFile ? <FileBlock /> : data.valuationHistory.length < 2 ? <Empty>No history on file.</Empty> : (
        <>
          <Chart option={option} height={180} label="The equity sleeve's trailing P/E each quarter, at today's weights, against MSCI ACWI" />
          <p className="mt-2 text-xs text-ink-muted">
            Premium to benchmark: <b className="text-ink">{signed(data.premiumNow)}</b> · 5Y average {signed(data.premiumAverage)}
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Card({ title, lead, action, flush, children }: { title: string; lead?: string; action?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-3", flush && "px-5")}>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map(([label, colour]) => (
        <li key={label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", colour)} aria-hidden="true" />{label}</li>
      ))}
    </ul>
  );
}

function Toned({ value, digits = 1 }: { value: number | null; digits?: number }) {
  return <span className={toneOf(value)}>{value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`}</span>;
}

function NotMeasured({ title }: { title: string }) {
  return (
    <span title={title} className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      not measured
    </span>
  );
}

/**
 * Where a bank-file client's files hold nothing. On one line wherever there is room; {@code tight} puts it on exactly
 * two short lines, for a narrow figure column that would otherwise be widened by it.
 */
function NotInFile({ tight }: { tight?: boolean }) {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-left text-3xs leading-tight font-medium whitespace-nowrap text-ink-muted">
      {tight ? <>not in<br />bank file</> : "not in bank file"}
    </span>
  );
}

function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

/** The server's figure in the unit it names. */
function figure(value: number, unit: string) {
  if (unit === "X") return `${value.toFixed(1)}×`;
  if (unit === "PERCENT") return `${value.toFixed(1)}%`;
  if (unit === "BILLIONS") return `$${Math.round(value).toLocaleString("en-US")}B`;
  if (unit === "NUMBER") return value.toFixed(2);
  return value.toLocaleString("en-US");
}

/** The server's delta against the benchmark, in the unit it names. */
function delta(one: EquityKpi) {
  const d = one.delta as number;
  const sign = d > 0 ? "+" : "";
  if (one.deltaUnit === "PERCENT") return `${sign}${d.toFixed(1)}% vs bench`;
  if (one.deltaUnit === "POINTS") return `${sign}${d.toFixed(1)} pp`;
  if (one.deltaUnit === "X") return `${sign}${d.toFixed(1)}×`;
  return `${sign}${d.toFixed(2)}`;
}

/** Cheaper, better or safer than the benchmark is green; a valuation or leverage premium is not. */
function deltaTone(one: EquityKpi) {
  const d = one.delta ?? 0;
  const higherIsBetter = ["ROE", "DIVIDEND_YIELD", "EPS_GROWTH"].includes(one.key);
  const good = higherIsBetter ? d > 0 : ["PE", "FORWARD_PE", "PB", "NET_DEBT_EBITDA"].includes(one.key) ? d < 0 : null;
  return good == null ? "bg-slate-100 text-ink-soft" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
}

const SHORT_SECTORS: Record<string, string> = {
  "Information Technology": "Info. Tech.", "Communication Services": "Comm. Services", "Consumer Discretionary": "Cons. Discr.",
  "Consumer Staples": "Cons. Staples",
};

function short(sector: string | null) {
  return sector == null ? "—" : SHORT_SECTORS[sector] ?? sector;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
  }
}

function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function symbolOf(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

function signed(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneOf(value: number | null | undefined) {
  if (value == null) return undefined;
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}
