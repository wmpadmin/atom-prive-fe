import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspaceFixedIncome,
  type ClientFixedIncome,
  type FiActive,
  type FiCurvePoint,
  type FiHolding,
  type FiIssuer,
  type FiKpi,
  type FiScenario,
  type FiSlice,
  type IpsAllocationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { FileViewToggle, inUsd, sumInUsd, type FileView } from "../../components/converted-usd";
import { TableColumns } from "../../components/table-columns";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";
import { CardMenu, CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { ReportButton } from "../layout/report";
import { FIGURE_KINDS, FigureRow, FigureStrip, useFiguresAsTable } from "../layout/figure-strip";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart } from "../layout/chart-kinds";
import { kpiFigures, seriesFigure, sharesFigure, type Figures } from "../layout/own-cards";
import { useDrill } from "./drill-panel";
import type { FigureDetail } from "./figure-panel";
import { useCurrencyParam, useInShownCurrency } from "../../components/shown-currency";

/**
 * A client's Fixed Income Analytics, laid out section by section as the firm's 10 Nov design draws it. Every figure —
 * the weighted yields, durations and ratings, DV01 and CS01, the ladder, credit quality, the scenarios, issuer
 * concentration and the coupon calendar — is worked out on the server and shown here as it comes. The bond, fund and
 * benchmark analytics are demo figures, which the page says. A client whose figures come only from their bank's files
 * sees their bond lines as sent, and every other card in its place, not in bank file. Read only.
 */
type FixedIncomeCard = "kpis" | "segments" | "ladder" | "quality" | "curve" | "sectors" | "holdings" | "key-rates"
  | "scenarios" | "issuers" | "calendar";

/** The screen's cards, in the firm's order: every card on by default. */
const CARDS: Record<FixedIncomeCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  segments: { title: "Fixed Income Segments · Target vs Actual", group: "Allocation", wide: true, charts: ["table", "grouped-bar", "horizontal-bar", "radar"] },
  ladder: { title: "Maturity Ladder", group: "Maturity & income", charts: ["stacked-bar", "grouped-bar", "line", "table"] },
  quality: { title: "Credit Quality", group: "Credit", charts: ["grouped-bar", "donut", "horizontal-bar", "table"] },
  curve: { title: "Holdings on the Curve", group: "Rates", charts: ["bubble", "scatter", "table"] },
  sectors: { title: "Sector Mix", group: "Credit", charts: ["donut", "horizontal-bar", "mindmap", "table"] },
  holdings: { title: "Bond & Fund Holdings", group: "Holdings", wide: true },
  "key-rates": { title: "Key Rate Durations", group: "Rates", charts: ["grouped-bar", "line", "radar", "table"] },
  scenarios: { title: "Rate & Spread Scenarios", group: "Rates", charts: ["horizontal-bar", "bar", "table"] },
  issuers: { title: "Issuer Concentration", group: "Credit", charts: ["horizontal-bar", "mindmap", "donut", "table"] },
  calendar: { title: "Coupon & Redemption Calendar", group: "Maturity & income", wide: true, charts: ["stacked-bar", "grouped-bar", "line", "table"] },
};

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as FixedIncomeCard[];

export function ClientFixedIncomePage() {
  const { customerId = "" } = useParams();
  const fi = useGetClientWorkspaceFixedIncome<ClientFixedIncome, ApiError>(customerId, useCurrencyParam());
  const data = useInShownCurrency(fi.data);
  const view = useViewLayout("workspace.fixed-income", CARDS, DEFAULT_CARDS);

  if (fi.isError) return <Alert tone="danger">{fi.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the fixed income sleeve…</p>;
  const file = data.bankFile;

  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="absolute top-0 right-0 flex items-start gap-2"><ReportButton /><CustomizeButton view={view} /></div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Fixed Income
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Fixed Income Analytics</h1>
        <p className="mt-1 text-sm text-ink-muted">Yield, duration, credit and cash-flow analytics against Bloomberg Global Aggregate (USD-hedged)</p>
        <p className="mt-3 inline-flex rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          Benchmark: Bloomberg Global Agg (USD-hedged)
        </p>
      </header>

      <LayoutGrid view={view} screen="Fixed Income Analytics" figures={data.bankFile ? undefined : incomeFigures(data)} render={{
        kpis: <Kpis data={data} />,
        segments: <Segments data={data} chart={cardChart(view, "segments")} />,
        ladder: <LadderCard data={data} chart={cardChart(view, "ladder")} />,
        quality: <QualityCard data={data} chart={cardChart(view, "quality")} />,
        curve: <CurveCard data={data} chart={cardChart(view, "curve")} />,
        sectors: <SectorCard data={data} chart={cardChart(view, "sectors")} />,
        holdings: <Holdings data={data} />,
        "key-rates": <KeyRateCard data={data} chart={cardChart(view, "key-rates")} />,
        scenarios: <ScenarioCard data={data} chart={cardChart(view, "scenarios")} />,
        issuers: <IssuerCard data={data} chart={cardChart(view, "issuers")} />,
        calendar: <CalendarCard data={data} chart={cardChart(view, "calendar")} />,
      }} />

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {file && data.converted ? `Values in ${data.converted.currency} at FX rates${data.converted.ratesOn ? ` of ${day(data.converted.ratesOn)}` : ""}; tables offer the bank's own view` : `Values in ${data.currency} unless stated`}; market data as of {day(data.asOf)} close.
          {!file && data.note && ` ${data.note}`}
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const KPI_LABELS = ["Yield to maturity", "Yield to worst", "Modified duration", "Effective duration", "Convexity", "Weighted avg. coupon (WAC)",
  "Average rating", "OAS · credit spread", "DV01", "Spread duration", "Weighted avg. maturity", "Income · next 12M"];

function Kpis({ data }: { data: ClientFixedIncome }) {
  const rows = useFiguresAsTable();
  // A bank-file client's bond lines added up in dollars at the latest FX rates; the analytics are not in his file.
  const conv = data.bankFile ? data.converted : null;
  const sleeve = conv ? sumInUsd(data.fileLines.map((one) => ({ amount: one.value, currency: one.currency })), conv) : null;
  const sleeveKpi: FiKpi | null = conv && sleeve && data.fileLines.length > 0 ? {
    key: "FILE_SLEEVE", label: "Bond lines · market value", value: sleeve.total, text: null, unit: "MONEY", delta: null,
    deltaUnit: "NONE", note: `${data.fileLines.length} line${data.fileLines.length === 1 ? "" : "s"} · ${conv.currency} at FX rates${conv.ratesOn ? ` of ${day(conv.ratesOn)}` : ""}${sleeve.missing.length ? ` · ${sleeve.missing.join(", ")} left out: no rate` : ""}`,
  } : null;
  const kpis: (FiKpi | null)[] = data.bankFile ? [...(sleeveKpi ? [sleeveKpi] : []), ...KPI_LABELS.map(() => null)] : data.kpis;
  const cur = conv ? conv.currency : data.currency;
  const drill = useDrill();
  const open = (one: FiKpi) => drill?.({ by: "figure", key: `fixed-income.kpi.${one.key}`, name: one.label, figure: kpiFigure(data, one, cur) });
  return (
    <FigureStrip className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      {kpis.map((one, at) => rows ? (
        <FigureRow key={one?.key ?? KPI_LABELS[sleeveKpi ? at - 1 : at]} label={!one ? KPI_LABELS[sleeveKpi ? at - 1 : at] : (
          <button type="button" className="text-left hover:text-primary-700 hover:underline" onClick={() => open(one)}>{one.label}</button>
        )} value={!one ? <NotInFile /> : <>{kpiValue(one, cur)}{one.delta != null && one.deltaUnit !== "NONE" && <span className={cn("ml-2 rounded-md px-1.5 py-0.5 text-2xs font-semibold", kpiTone(one))}>{kpiDelta(one)}</span>}</>} note={one?.note} />
      ) : (
        <div key={one?.key ?? KPI_LABELS[sleeveKpi ? at - 1 : at]} className={cn("rounded-2xl border border-line bg-white px-4 py-3.5", one && "cursor-pointer")}
          {...(one ? { role: "button", tabIndex: 0, onClick: () => open(one), onKeyDown: (event: ReactKeyboardEvent) => { if (event.key === "Enter") open(one); } } : {})}>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one?.label ?? KPI_LABELS[sleeveKpi ? at - 1 : at]}</p>
          {!one ? <div className="mt-2"><NotInFile /></div> : (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{kpiValue(one, cur)}</span>
                {one.delta != null && one.deltaUnit !== "NONE" && (
                  <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums", kpiTone(one))}>{kpiDelta(one)}</span>
                )}
              </div>
              {one.note && <p className="mt-1 text-xs text-ink-muted">{one.note}</p>}
            </>
          )}
        </div>
      ))}
    </FigureStrip>
  );
}

function Segments({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const rows = data.segments;
  const drill = useDrill();
  const scale = Math.max(10, ...rows.map((one) => Math.max(one.max ?? 0, one.actual))) * 1.05;
  return (
    <Card title="Fixed Income Segments · Target vs Actual" lead={data.bankFile ? undefined : data.segmentsNote ?? undefined} flush
      picker={!data.bankFile && rows.length > 0 && chart.picker}
      action={!data.bankFile && (
        <Link to={`/client-workspace/${data.customerId}/ips`} className="text-xs font-semibold text-primary-700 hover:underline">All asset classes</Link>
      )}>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : rows.length === 0 ? <Empty>No model to measure against yet.</Empty> : !chart.own ? (
        <div className="px-5">
          <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={260} label="Each fixed income segment's actual weight against its target"
            data={{ shape: "series", categories: rows.map((one) => one.name), series: [
              { name: "Actual", values: rows.map((one) => one.actual) },
              { name: "Target", values: rows.map((one) => one.target) },
            ] }}
            onPick={(at) => { const row = rows[at]; if (row) drill?.(row.assetClass ? { by: "class", key: row.key, name: row.name } : { by: "subClass", key: row.name, name: row.name }); }} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3 pl-5">Asset class / sub-class</th>
                  {["Min", "Target", "Max", "Actual", "Value", "Deviation", `Deviation ${symbolOf(data.currency)}`].map((one) => (
                    <th key={one} scope="col" className="px-2 py-2 text-right">{one}</th>
                  ))}
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
  const drill = useDrill();
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const [label, tone] = SEGMENT_STATUS[row.status] ?? ["—", "text-ink-muted"];
  const pct = (value: number | null) => (value == null ? "—" : `${value.toFixed(row.assetClass ? 1 : 2)}%`);
  return (
    <tr className={cn(row.assetClass && "bg-slate-50 font-semibold")}>
      <th scope="row" className={cn("py-2 pr-3 text-left", row.assetClass ? "pl-5" : "pl-9 font-normal")}>
        <button type="button" className="text-left hover:text-primary-700 hover:underline"
          onClick={() => drill?.(row.assetClass ? { by: "class", key: row.key, name: row.name } : { by: "subClass", key: row.name, name: row.name })}>
          {row.name}
        </button>
      </th>
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

function LadderCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.ladder.map((one) => one.year), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: "Government & agency", stack: "due", barMaxWidth: 40, data: data.ladder.map((one) => one.government), itemStyle: { color: colours.primary } },
        { type: "bar", name: "Credit & other", stack: "due", data: data.ladder.map((one) => one.credit), itemStyle: { color: "#d6c7a6" } },
      ],
    };
  }, [data.ladder, data.currency]);
  const s = data.ladderSummary;
  return (
    <Card title="Maturity Ladder" lead="Market value by final maturity (to call for callables) · funds looked through" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : (
        <>
          {chart.own ? (
            <Chart option={option} height={220} label="Market value falling due each year"
              onPick={(year) => drill?.({ by: "maturity", key: year, name: `Falling due ${year}` })} />
          ) : (
            <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={220} label="Market value falling due each year"
              data={{ shape: "series", categories: data.ladder.map((one) => String(one.year)), series: [
                { name: "Government & agency", values: data.ladder.map((one) => one.government), colour: ink().primary },
                { name: "Credit & other", values: data.ladder.map((one) => one.credit), colour: "#d6c7a6" },
              ] }}
              onPick={(at) => { const one = data.ladder[at]; if (one) drill?.({ by: "maturity", key: String(one.year), name: `Falling due ${one.year}` }); }} />
          )}
          {s && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Maturing ≤ 2Y" value={`${compact(s.shortValue, data.currency)} · ${s.shortPercent.toFixed(1)}%`} />
              <Stat label="Reinvestment risk" value={s.reinvestmentRisk} />
              <Stat label="Largest year" value={s.largestYear ? `${s.largestYear} · ${s.largestPercent?.toFixed(1)}%` : "—"} />
            </dl>
          )}
        </>
      )}
    </Card>
  );
}

function QualityCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 16, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      xAxis: { type: "category", data: data.quality.map((one) => one.key), axisLabel: { color: colours.muted, fontSize: 9, interval: 0 } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: "Portfolio", barMaxWidth: 40, data: data.quality.map((one) => one.portfolio), itemStyle: { color: colours.primary },
          label: { show: true, position: "top", fontSize: 9, color: colours.muted, formatter: (p: { value: number }) => (p.value ? Math.round(p.value) : "") } },
        { type: "bar", name: "Bloomberg Global Agg", data: data.quality.map((one) => one.benchmark), itemStyle: { color: colours.neutral },
          label: { show: true, position: "top", fontSize: 9, color: colours.muted, formatter: (p: { value: number }) => (p.value ? Math.round(p.value) : "") } },
      ],
    };
  }, [data.quality]);
  const q = data.qualitySummary;
  return (
    <Card title="Credit Quality" lead="Composite of S&P and Moody's (lower of the two)" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : (
        <>
          {chart.own ? (
            <Chart option={option} height={210} label="The sleeve by rating against the Bloomberg Global Agg"
              onPick={(rating) => drill?.({ by: "rating", key: rating, name: rating })} />
          ) : (
            <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={210} label="The sleeve by rating against the Bloomberg Global Agg"
              data={chart.kind === "donut"
                ? { shape: "shares", items: data.quality.filter((one) => one.portfolio > 0).map((one) => ({ name: one.key, value: one.portfolio })) }
                : { shape: "series", categories: data.quality.map((one) => one.key), series: [
                    { name: "Portfolio", values: data.quality.map((one) => one.portfolio), colour: ink().primary },
                    { name: "Bloomberg Global Agg", values: data.quality.map((one) => one.benchmark), colour: ink().neutral },
                  ] }}
              onPick={(at) => {
                const rows = chart.kind === "donut" ? data.quality.filter((one) => one.portfolio > 0) : data.quality;
                const one = rows[at];
                if (one) drill?.({ by: "rating", key: one.key, name: one.key });
              }} />
          )}
          {q && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone="bg-amber-50 text-amber-800">Investment grade {q.investmentGrade.toFixed(1)}%</Pill>
              <Pill tone="bg-emerald-50 text-emerald-700">High yield {q.highYield.toFixed(1)}%{q.highYieldLimit != null && ` · limit ${q.highYieldLimit}%`}</Pill>
              <Pill tone="bg-amber-50 text-amber-800">{q.negativeOutlooks} negative outlook{q.negativeOutlooks === 1 ? "" : "s"}</Pill>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CurveCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const open = (one: FiCurvePoint | undefined) => { if (one) drill?.({ by: "figure", key: `fixed-income.curve.${one.label}`, name: one.label, figure: curveFigure(data, one) }); };
  const option = useMemo(() => {
    const colours = ink();
    const largest = Math.max(1, ...data.curve.map((one) => one.value));
    const groups: [string, string, string][] = [["SOVEREIGN", "Sovereign", "#a16207"], ["IG", "IG credit", "#d6c7a6"], ["HIGH", "Yield > 5.5% (HY / EM)", colours.danger]];
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 12, bottom: 56, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "item" },
      xAxis: { type: "value", min: 0, max: 30, name: "Years to maturity", nameLocation: "middle", nameGap: 22, nameTextStyle: { color: colours.muted, fontSize: 9 },
        axisLabel: { color: colours.muted, formatter: "{value}Y" }, splitLine: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "UST curve · today", data: data.curveToday.map((one) => [one.tenor, one.yield]), showSymbol: false, smooth: true,
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
        { type: "line", name: "UST curve · 1 year ago", data: data.curveYearAgo.map((one) => [one.tenor, one.yield]), showSymbol: false, smooth: true,
          lineStyle: { color: colours.muted, type: "dashed", width: 1 }, itemStyle: { color: colours.muted } },
        ...groups.map(([id, name, colour]) => ({
          type: "scatter", name, itemStyle: { color: colour, opacity: 0.9 },
          symbolSize: (value: [number, number, number]) => 7 + Math.sqrt(value[2] / largest) * 14,
          label: { show: true, position: "right", fontSize: 8, color: colours.muted, formatter: (p: { value: [number, number, number, string] }) => p.value[3] },
          tooltip: { formatter: (p: { value: [number, number, number, string] }) => `${p.value[3]}<br/>${p.value[0]} yrs · YTM ${p.value[1]}%` },
          // Each point named by its bond, so a click finds it.
          data: data.curve.filter((one) => one.group === id).map((one) => ({ name: one.label, value: [one.years, one.ytm, one.value, one.label] })),
        })),
      ],
    };
  }, [data.curve, data.curveToday, data.curveYearAgo]);
  return (
    <Card title="Holdings on the Curve" lead="Yield to maturity (local currency) vs years to maturity · bubble = market value"
      picker={!data.bankFile && data.curve.length > 0 && chart.picker}>
      {data.bankFile ? <FileBlock /> : data.curve.length === 0 ? <Empty>No bonds held.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={280} label="Each bond's yield against its years to maturity"
          data={{ shape: "points", xName: "Years to maturity", yName: "YTM %", sizeName: "Market value", items: data.curve.map((one) => ({ name: one.label, x: one.years, y: one.ytm, size: one.value })) }}
          onPick={(at) => open(data.curve[at])} />
      ) : (
        // As tall as the card, which the Sector Mix beside it sets: no blank space under the legend.
        <div className="relative min-h-[280px] flex-1">
          <div className="absolute inset-0">
            <Chart option={option} label="Each bond's yield against its years to maturity, beside the UST curve"
              onPick={(name) => open(data.curve.find((one) => one.label === name))} />
          </div>
        </div>
      )}
    </Card>
  );
}

function SectorCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const open = (one: FiSlice | undefined) => { if (one) drill?.({ by: "figure", key: `fixed-income.sector.${one.key}`, name: one.key, figure: sectorFigure(data, one) }); };
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, data.currency) },
      series: [{ type: "pie", radius: ["62%", "86%"], label: { show: false }, itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: data.sectors.map((one, at) => ({ name: one.key, value: one.value, itemStyle: { color: INK[at % INK.length] } })) }],
    };
  }, [data.sectors, data.currency]);
  return (
    <Card title="Sector Mix" lead="By issuer type" picker={!data.bankFile && data.sectors.length > 0 && chart.picker}>
      {data.bankFile ? <FileBlock /> : data.sectors.length === 0 ? <Empty>Nothing held.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={240} label="The sleeve by issuer type"
          data={{ shape: "shares", items: data.sectors.map((one) => ({ name: one.key, value: one.value })) }}
          onPick={(at) => open(data.sectors[at])} />
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-48">
            <Chart option={option} height={180} label="The sleeve by issuer type" onPick={(name) => open(data.sectors.find((one) => one.key === name))} />
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{data.sleeve == null ? "—" : compact(data.sleeve, data.currency)}</p>
                <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Fixed income</p>
              </div>
            </div>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {data.sectors.map((one, at) => (
                <tr key={one.key} className="cursor-pointer hover:bg-canvas" onClick={() => open(one)}>
                  <td className="py-1.5"><span className="flex items-center gap-2"><span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                    <button type="button" className="text-left hover:text-primary-700 hover:underline" onClick={(event) => { event.stopPropagation(); open(one); }}>{one.key}</button></span></td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{compact(one.value, data.currency)}</td>
                  <td className="w-14 py-1.5 text-right text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Holdings({ data }: { data: ClientFixedIncome }) {
  const drill = useDrill();
  const [tab, setTab] = useState<"analytics" | "cashflows">("analytics");
  const [fileView, setFileView] = useState<FileView>("converted");
  const cur = data.currency;
  const rows = [...data.holdings, ...(data.total ? [data.total] : [])];
  const date = day;
  const columns: [string, (one: FiHolding) => ReactNode][] = tab === "analytics" ? [
    ["Coupon", (one) => (one.coupon == null ? "—" : `${one.coupon}%`)],
    ["Maturity", (one) => (one.kind === "TOTAL" ? (one.averageMaturity == null ? "—" : `${one.averageMaturity} yrs avg`) : one.perpetual ? "Perpetual" : date(one.maturity))],
    ["Next call", (one) => date(one.nextCall)],
    ["Price", (one) => (one.price == null ? "—" : one.price.toFixed(2))],
    ["Mkt value", (one) => compact(one.value, cur)],
    ["Wt.", (one) => (one.weight == null ? "—" : `${one.weight.toFixed(1)}%`)],
    ["YTM", (one) => (one.ytm == null ? "—" : `${one.ytm.toFixed(2)}%`)],
    ["YTW", (one) => (one.ytw == null ? "—" : `${one.ytw.toFixed(2)}%`)],
    ["Mod. dur.", (one) => (one.modifiedDuration == null ? "—" : one.modifiedDuration.toFixed(1))],
    ["OAS", (one) => (one.oas == null ? "—" : `${one.oas} bp`)],
    ["DV01", (one) => (one.dv01 == null ? "—" : compact(one.dv01, cur))],
  ] : [
    ["Next coupon", (one) => date(one.nextCoupon)],
    ["Frequency", (one) => (one.frequency == null ? "—" : one.frequency === 12 ? "Monthly" : one.frequency === 2 ? "Semi-annual" : one.frequency === 1 ? "Annual" : `${one.frequency}× a year`)],
    ["Coupons · 12M", (one) => (one.couponsNext12 == null ? "—" : compact(one.couponsNext12, cur))],
    ["Principal · 12M", (one) => (one.principalNext12 == null ? "—" : compact(one.principalNext12, cur))],
    ["Mkt value", (one) => compact(one.value, cur)],
    ["Wt.", (one) => (one.weight == null ? "—" : `${one.weight.toFixed(1)}%`)],
  ];
  return (
    <Card title="Bond & Fund Holdings" lead="Clean prices · yields in local currency · DV01 per 1 bp · demo security data, not a market-data feed" flush
      action={data.bankFile ? <FileViewToggle value={fileView} onChange={setFileView} /> :
        <div role="tablist" aria-label="Columns shown" className="flex rounded-lg border border-line p-0.5">
          {([["analytics", "Analytics"], ["cashflows", "Cash flows"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", tab === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
              {label}
            </button>
          ))}
        </div>
      }>
      {data.bankFile ? <FileLines data={data} view={fileView} /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Security</th>
                <th scope="col" className="px-1.5 py-2">Sector</th>
                <th scope="col" className="px-1.5 py-2">Rating</th>
                <th scope="col" className="px-1.5 py-2">Ccy</th>
                {columns.map(([label], at) => (
                  <th key={label} scope="col" className={cn("py-2 text-right", at === columns.length - 1 ? "pr-5 pl-1.5" : "px-1.5")}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one, at) => (
                <tr key={`${one.name}-${at}`} className={cn(one.kind === "TOTAL" && "border-t-2 border-line font-bold", one.kind === "OTHER" && "text-ink-soft")}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left font-normal">
                    {one.kind === "BOND" || one.kind === "FUND" ? (
                      <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline"
                        onClick={() => drill?.(one.kind === "BOND" ? { by: "bond", key: one.name, name: one.name } : { by: "subClass", key: one.name, name: one.name })}>
                        {one.name}
                      </button>
                    ) : (
                      <span className={cn(one.kind !== "OTHER" && "font-semibold")}>{one.name}</span>
                    )}
                    {one.isin && <span className="block text-2xs text-ink-muted">{one.isin}</span>}
                  </th>
                  <td className="px-1.5 py-2 text-xs">{one.sector ?? "—"}</td>
                  <td className="px-1.5 py-2">{one.rating ? <RatingTag rating={one.rating} /> : "—"}</td>
                  <td className="px-1.5 py-2 text-xs">{one.currency ?? ""}</td>
                  {columns.map(([label, cell], at) => (
                    <td key={label} className={cn("py-2 text-right text-xs whitespace-nowrap tabular-nums", at === columns.length - 1 ? "pr-5 pl-1.5" : "px-1.5")}>{cell(one)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RatingTag({ rating }: { rating: string }) {
  const high = /^(BB|B[+-]?\b|B\s|CCC|CC|C\b|D\b)/.test(rating) && !rating.startsWith("BBB");
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap", high ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>
      {rating}
    </span>
  );
}

function FileLines({ data, view }: { data: ClientFixedIncome; view: FileView }) {
  if (data.fileLines.length === 0) return <div className="px-5"><FileBlock /></div>;
  const conv = view === "converted" ? data.converted : null;
  const others = ["Rating", "Ccy", "Coupon", "Maturity", "YTM", "Mod. dur.", "DV01"];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-5">Security</th>
            <th scope="col" className="px-1.5 py-2">Sector</th>
            <th scope="col" className="px-1.5 py-2 text-right">Mkt value{conv ? ` · ${conv.currency}` : ""}</th>
            {others.map((one) => <th key={one} scope="col" className="px-1.5 py-2 text-right">{one}</th>)}
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
              <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">
                {!conv ? exact(one.value, one.currency) : inUsd(one.value, one.currency, conv) == null ? "no FX rate" : (
                  <>{exact(inUsd(one.value, one.currency, conv)!, conv.currency)}
                    {one.currency !== conv.currency && <span className="block text-2xs text-ink-muted">{exact(one.value, one.currency)}</span>}</>
                )}
              </td>
              {others.map((cell) => <td key={cell} className="px-1.5 py-2 text-right"><NotInFile tight /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-5 text-3xs text-ink-muted italic">
        {conv ? `His file's bond lines in ${conv.currency} at FX rates${conv.ratesOn ? ` of ${day(conv.ratesOn)}` : ""}, the bank's own amount beneath.`
          : "His file's bond lines as the bank states them, by the bank's own class."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function KeyRateCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const open = (one: FiActive | undefined) => { if (one) drill?.({ by: "figure", key: `fixed-income.krd.${one.key}`, name: `Key rate duration · ${one.key}`, figure: keyRateFigure(data, one) }); };
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 16, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      xAxis: { type: "category", data: data.keyRates.map((one) => one.key), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", axisLabel: { color: colours.muted }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: `Portfolio · ${data.portfolioDuration?.toFixed(2) ?? "—"}`, data: data.keyRates.map((one) => one.portfolio), barMaxWidth: 40,
          itemStyle: { color: colours.primary }, label: { show: true, position: "top", fontSize: 8, color: colours.muted } },
        { type: "bar", name: `Agg · ${data.benchmarkDuration?.toFixed(2) ?? "—"}`, data: data.keyRates.map((one) => one.benchmark),
          itemStyle: { color: colours.neutral }, label: { show: true, position: "top", fontSize: 8, color: colours.muted } },
      ],
    };
  }, [data.keyRates, data.portfolioDuration, data.benchmarkDuration]);
  return (
    <Card title="Key Rate Durations" lead="Years of duration by curve point" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : chart.own ? <Chart option={option} height={200} label="Duration at each curve point against the Agg" onPick={(_, at) => open(data.keyRates[at])} /> : (
        <KindChart kind={chart.kind!} format={(value) => value.toFixed(2)} height={200} label="Duration at each curve point against the Agg"
          data={{ shape: "series", categories: data.keyRates.map((one) => one.key), series: [
            { name: "Portfolio", values: data.keyRates.map((one) => one.portfolio), colour: ink().primary },
            { name: "Agg", values: data.keyRates.map((one) => one.benchmark), colour: ink().neutral },
          ] }}
          onPick={(at) => open(data.keyRates[at])} />
      )}
    </Card>
  );
}

function ScenarioCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const largest = Math.max(0.01, ...data.scenarios.map((one) => Math.abs(one.percent)));
  const drill = useDrill();
  const open = (one: FiScenario | undefined) => { if (one) drill?.({ by: "figure", key: `fixed-income.scenario.${one.name}`, name: one.name, figure: scenarioFigure(data, one) }); };
  return (
    <Card title="Rate & Spread Scenarios" lead="Instantaneous P&L incl. convexity · bar = % of sleeve" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value > 0 ? "+" : ""}${compact(value, data.currency)}`} height={60 + data.scenarios.length * 28}
          label="What each rate or spread move would do to the sleeve"
          data={{ shape: "series", categories: data.scenarios.map((one) => one.name), series: [{ name: "P&L", values: data.scenarios.map((one) => one.amount) }] }}
          onPick={(at) => open(data.scenarios[at])} />
      ) : (
        <ul className="space-y-1.5">
          {data.scenarios.map((one) => (
            <li key={one.name} className="grid cursor-pointer grid-cols-[minmax(0,9rem)_1fr_4.75rem] items-center gap-2 text-xs hover:bg-canvas" onClick={() => open(one)}>
              <button type="button" className="text-left leading-tight hover:text-primary-700 hover:underline" onClick={(event) => { event.stopPropagation(); open(one); }}>{one.name}</button>
              <span className="relative block h-2.5" aria-hidden="true">
                <span className="absolute top-0 left-1/2 h-2.5 w-px bg-line" />
                <span className={cn("absolute top-0 h-2.5", one.amount >= 0 ? "left-1/2 bg-emerald-700" : "right-1/2 bg-red-600")}
                  style={{ width: `${(Math.abs(one.percent) / largest) * 50}%` }} />
              </span>
              <span className={cn("text-right tabular-nums", toneOf(one.amount))} title={`${one.percent.toFixed(2)}% of the sleeve`}>
                {one.amount > 0 ? "+" : ""}{compact(one.amount, data.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IssuerCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const limit = data.issuerLimitOfSleeve;
  const scale = Math.max(1, limit ?? 0, ...data.issuers.map((one) => one.sharePercent)) * 1.05;
  const drill = useDrill();
  const open = (one: FiIssuer | undefined) => { if (one) drill?.({ by: "figure", key: `fixed-income.issuer.${one.issuer}`, name: one.issuer, figure: issuerFigure(data, one) }); };
  return (
    <Card title="Issuer Concentration" lead="% of fixed income sleeve" picker={!data.bankFile && data.issuers.length > 0 && chart.picker}>
      {data.bankFile ? <FileBlock /> : data.issuers.length === 0 ? <Empty>No bond names an issuer.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={260} label="Each issuer's share of the fixed income sleeve"
          data={{ shape: "shares", items: data.issuers.map((one) => ({ name: one.issuer, value: one.sharePercent })) }}
          onPick={(at) => open(data.issuers[at])} />
      ) : (
        <>
          {/* Roomy rows, names wrapping rather than cut; sovereigns in the app's blue (slate-800 vanished on dark). */}
          <ul className="divide-y divide-line">
            {data.issuers.map((one) => (
              <li key={one.issuer} className="grid min-h-9 cursor-pointer grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 py-1.5 text-xs hover:bg-canvas" onClick={() => open(one)}>
                <span className="leading-snug break-words">
                  <button type="button" className="text-left hover:text-primary-700 hover:underline" onClick={(event) => { event.stopPropagation(); open(one); }}>{one.issuer}</button>
                </span>
                <span className="relative block h-2.5 rounded-full bg-slate-100" aria-hidden="true">
                  <span className={cn("block h-full rounded-full", one.sovereign ? "bg-primary-600" : one.overLimit ? "bg-red-600" : "bg-amber-600")}
                    style={{ width: `${Math.min(100, (one.sharePercent / scale) * 100)}%` }} />
                  {limit != null && <span className="absolute -top-1 -bottom-1 w-0.5 bg-red-600" style={{ left: `${Math.min(100, (limit / scale) * 100)}%` }} />}
                </span>
                <span className={cn("text-right tabular-nums", one.overLimit && "font-semibold text-red-700")}>{one.sharePercent.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-xs text-ink-muted">
            <li className="flex flex-wrap gap-x-4">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-primary-600" aria-hidden="true" />Sovereign (no limit)</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-amber-600" aria-hidden="true" />Corporate / EM</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 bg-red-600" aria-hidden="true" />
              {data.issuerLimit == null ? "No single-issuer limit set"
                : `IPS limit ${data.issuerLimit}% of net worth per non-sovereign issuer${limit == null ? "" : ` (= ${limit.toFixed(1)}% of this sleeve)`}`}
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}

function CalendarCard({ data, chart }: { data: ClientFixedIncome; chart: CardChart }) {
  const drill = useDrill();
  const open = (at: number) => {
    const one = data.calendar[at];
    if (one) drill?.({ by: "month", key: one.month.slice(0, 7), name: new Date(one.month).toLocaleString("en-GB", { month: "long", year: "numeric" }) });
  };
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 16, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.calendar.map((one) => new Date(one.month).toLocaleString("en-GB", { month: "short" })),
        axisLabel: { color: colours.muted } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: `Coupons · ${data.couponsNext12 == null ? "—" : compact(data.couponsNext12, data.currency)}`, stack: "flow",
          data: data.calendar.map((one) => one.coupons), itemStyle: { color: "#d6c7a6" } },
        { type: "bar", name: `Principal · ${data.principalNext12 == null ? "—" : compact(data.principalNext12, data.currency)}`, stack: "flow",
          data: data.calendar.map((one) => one.principal), itemStyle: { color: colours.primary } },
      ],
    };
  }, [data.calendar, data.couponsNext12, data.principalNext12, data.currency]);
  return (
    <Card title="Coupon & Redemption Calendar" lead="Next 12 months · contractual, excl. fund distributions" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : chart.own ? <Chart option={option} height={240} label="Coupons and principal falling due each month for the next twelve" onPick={(_, at) => open(at)} /> : (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={240} label="Coupons and principal falling due each month for the next twelve"
          data={{ shape: "series", categories: data.calendar.map((one) => new Date(one.month).toLocaleString("en-GB", { month: "short" })), series: [
            { name: "Coupons", values: data.calendar.map((one) => one.coupons), colour: "#d6c7a6" },
            { name: "Principal", values: data.calendar.map((one) => one.principal), colour: ink().primary },
          ] }}
          onPick={open} />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/**
 * Each key figure's own column in the holdings table: how it is read off a line, and how the server adds the lines up
 * ("mean" weighted by value, "sum" added, "show" a column beside the figure only).
 */
const KPI_COLUMN: Record<string, [string, (line: FiHolding) => number | string | null, "mean" | "sum" | "show"]> = {
  YTM: ["YTM %", (line) => line.ytm, "mean"],
  YTW: ["YTW %", (line) => line.ytw, "mean"],
  MODIFIED_DURATION: ["Mod. dur. yrs", (line) => line.modifiedDuration, "mean"],
  COUPON: ["Coupon %", (line) => line.coupon, "mean"],
  OAS: ["OAS bp", (line) => line.oas, "mean"],
  DV01: ["DV01", (line) => line.dv01, "sum"],
  INCOME: ["Coupons · 12M", (line) => line.couponsNext12, "sum"],
  RATING: ["Rating", (line) => line.rating, "show"],
  WAM: ["Maturity", (line) => (line.perpetual ? "Perpetual" : line.maturity ? day(line.maturity) : null), "show"],
};

/** A key figure: each bond and fund line's own figure and weight, read from the holdings table, to the server's figure. */
function kpiFigure(data: ClientFixedIncome, one: FiKpi, currency: string): FigureDetail {
  const value = kpiValue(one, currency);
  const facts = one.delta != null && one.deltaUnit !== "NONE" ? [{ label: "Against benchmark", value: kpiDelta(one) }] : [];
  if (one.key === "FILE_SLEEVE") {
    return { label: "Fixed income", value, note: one.note ?? undefined,
      table: { title: "Bond lines in the bank file", columns: ["Security", "Currency", "Value"], rows: data.fileLines.map((line) => [line.name, line.currency, line.value]) } };
  }
  const column = KPI_COLUMN[one.key];
  if (!column) return { label: "Fixed income", value, note: one.note ?? undefined, facts };
  const [name, read, how] = column;
  const rows = data.holdings.map((line) => {
    const figure = read(line);
    return how === "mean"
      ? [line.name, line.weight, figure, line.weight == null || typeof figure !== "number" ? null : Number(((line.weight * figure) / 100).toFixed(3))]
      : [line.name, line.weight, figure];
  });
  return {
    label: "Fixed income",
    value,
    note: [one.note, how === "mean" ? "Weighted by market value: each line's figure, its weight in the sleeve, and weight × figure."
      : how === "sum" ? "Each line's own amount, added up across the sleeve." : "Each line's own reading, with its weight in the sleeve."].filter(Boolean).join(" · "),
    facts,
    table: {
      title: "By line",
      columns: how === "mean" ? ["Security", "Weight %", name, "Weight × figure"] : ["Security", "Weight %", name],
      rows,
      total: how === "mean" ? ["Fixed income sleeve", data.total?.weight ?? null, value, null] : ["Fixed income sleeve", data.total?.weight ?? null, value],
    },
  };
}

/** A bond on the curve: its own years, yield and market value. */
function curveFigure(data: ClientFixedIncome, one: FiCurvePoint): FigureDetail {
  const group: Record<string, string> = { SOVEREIGN: "Sovereign", IG: "IG credit", HIGH: "Yield > 5.5% (HY / EM)" };
  return {
    label: "Holdings on the curve",
    value: `${one.ytm.toFixed(2)}%`,
    note: "Yield to maturity in local currency, against years to maturity (to call for callables).",
    facts: [
      { label: "Years to maturity", value: `${one.years} yrs` },
      { label: "Market value", value: compact(one.value, data.currency) },
      ...(data.sleeve ? [{ label: "Share of sleeve", value: `${((one.value / data.sleeve) * 100).toFixed(1)}%` }] : []),
      { label: "Group", value: group[one.group] ?? one.group },
    ],
  };
}

/** An issuer type in the Sector Mix: its value and share of the sleeve. */
function sectorFigure(data: ClientFixedIncome, one: FiSlice): FigureDetail {
  return {
    label: "Sector mix",
    value: compact(one.value, data.currency),
    note: "Market value of the sleeve by issuer type, funds looked through. The holdings table carries each bond's sector label, not its issuer type, so the bonds behind it are not listed here.",
    facts: [{ label: "Share of sleeve", value: `${one.sharePercent.toFixed(1)}%` }],
  };
}

/** One curve point's key rate duration against the Agg's. */
function keyRateFigure(data: ClientFixedIncome, one: FiActive): FigureDetail {
  return {
    label: "Key rate durations",
    value: one.portfolio.toFixed(2),
    note: `Years of duration at the ${one.key} point of the curve, each bond's key rate duration weighted by its market value. The bond-level key rate durations are not on this screen.`,
    facts: [
      { label: "Agg", value: one.benchmark == null ? "—" : one.benchmark.toFixed(2) },
      ...(one.benchmark == null ? [] : [{ label: "Active", value: `${one.portfolio - one.benchmark > 0 ? "+" : ""}${(one.portfolio - one.benchmark).toFixed(2)}` }]),
      { label: "Portfolio duration", value: data.portfolioDuration == null ? "—" : data.portfolioDuration.toFixed(2) },
    ],
  };
}

/** A rate or spread scenario: what it would do to the sleeve. */
function scenarioFigure(data: ClientFixedIncome, one: FiScenario): FigureDetail {
  return {
    label: "Rate & spread scenarios",
    value: `${one.amount > 0 ? "+" : ""}${compact(one.amount, data.currency)}`,
    note: "Instantaneous P&L including convexity, worked out on every bond and fund line. The P&L of each line is not on this screen.",
    facts: [{ label: "% of sleeve", value: `${one.percent > 0 ? "+" : ""}${one.percent.toFixed(2)}%` }],
  };
}

/** An issuer: its share of the sleeve against the IPS single-issuer limit. */
function issuerFigure(data: ClientFixedIncome, one: FiIssuer): FigureDetail {
  return {
    label: "Issuer concentration",
    value: `${one.sharePercent.toFixed(1)}%`,
    note: `Share of the fixed income sleeve in bonds issued by ${one.issuer}. The holdings table does not name each bond's issuer, so its bonds are not listed here.`,
    facts: [
      { label: "Type", value: one.sovereign ? "Sovereign (no limit)" : "Corporate / EM" },
      ...(!one.sovereign && data.issuerLimitOfSleeve != null ? [{ label: "IPS limit, % of sleeve", value: `${data.issuerLimitOfSleeve.toFixed(1)}%` }] : []),
      ...(!one.sovereign && data.issuerLimit != null ? [{ label: "IPS limit, % of net worth", value: `${data.issuerLimit}%` }] : []),
      ...(one.overLimit ? [{ label: "Status", value: "Over limit" }] : []),
    ],
  };
}

/** What Fixed Income Analytics offers for a card of the reader's own: its key figures, ladder, credit and rates. */
function incomeFigures(data: ClientFixedIncome): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const pc = (value: number) => `${value.toFixed(1)}%`;
  const unitFormat = (unit: string) => (value: number) => unit === "PERCENT" ? `${value.toFixed(2)}%` : unit === "YEARS" ? `${value.toFixed(1)} yrs`
    : unit === "BP" ? `${value} bp` : unit === "MONEY" ? compact(value, data.currency) : String(value);
  return {
    ...kpiFigures(data.kpis.filter((one) => one.unit !== "RATING"), unitFormat),
    "ladder.years": seriesFigure("Maturity ladder", "Maturity & income", data.ladder.map((one) => String(one.year)), [
      { name: "Government & agency", values: data.ladder.map((one) => one.government) }, { name: "Credit & other", values: data.ladder.map((one) => one.credit) },
    ], amount, ["stacked-bar", "grouped-bar", "line", "table"]),
    "calendar.months": seriesFigure("Coupons and principal due, next 12 months", "Maturity & income", data.calendar.map((one) => new Date(one.month).toLocaleString("en-GB", { month: "short" })), [
      { name: "Coupons", values: data.calendar.map((one) => one.coupons) }, { name: "Principal", values: data.calendar.map((one) => one.principal) },
    ], amount, ["stacked-bar", "grouped-bar", "line", "table"]),
    "quality.ratings": seriesFigure("Credit quality against the Global Agg", "Credit", data.quality.map((one) => one.key), [
      { name: "Portfolio", values: data.quality.map((one) => one.portfolio) }, { name: "Global Agg", values: data.quality.map((one) => one.benchmark) },
    ], pc, ["grouped-bar", "horizontal-bar", "table"]),
    "quality.mix": sharesFigure("Sleeve by rating", "Credit", data.quality.filter((one) => one.portfolio > 0).map((one) => ({ name: one.key, value: one.portfolio })), pc),
    "sectors.mix": sharesFigure("Sleeve by issuer type", "Credit", data.sectors.map((one) => ({ name: one.key, value: one.value })), amount),
    "issuers.top": sharesFigure("Largest issuers, % of the sleeve", "Credit", data.issuers.map((one) => ({ name: one.issuer, value: one.sharePercent })), pc,
      ["horizontal-bar", "mindmap", "donut", "table"]),
    "rates.keyrates": seriesFigure("Key rate durations against the Agg", "Rates", data.keyRates.map((one) => one.key), [
      { name: "Portfolio", values: data.keyRates.map((one) => one.portfolio) }, { name: "Agg", values: data.keyRates.map((one) => one.benchmark) },
    ], (value) => value.toFixed(2), ["grouped-bar", "line", "radar", "table"]),
    "rates.scenarios": seriesFigure("Rate and spread scenarios", "Rates", data.scenarios.map((one) => one.name),
      [{ name: "P&L", values: data.scenarios.map((one) => one.amount) }], amount, ["horizontal-bar", "bar", "table"]),
    "segments.bands": seriesFigure("Fixed income segments, actual against target", "Allocation", data.segments.map((one) => one.name), [
      { name: "Actual", values: data.segments.map((one) => one.actual) }, { name: "Target", values: data.segments.map((one) => one.target) },
    ], pc, ["grouped-bar", "horizontal-bar", "radar", "table"]),
  };
}

/** @param picker the chart type switcher, beside the card's own action, for a card that draws a chart */
function Card({ title, lead, action, flush, picker, children }: {
  title: string;
  lead?: string;
  action?: ReactNode;
  flush?: boolean;
  picker?: ReactNode;
  children: ReactNode;
}) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  const body = useRef<HTMLDivElement>(null);
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-3", flush && "px-5")}>
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{action}{picker}<TableColumns scope={body} /><CardMenu /></div>
      </div>
      <div ref={body} className="contents">{children}</div>
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

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold", tone)}>{children}</span>;
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
function kpiValue(one: FiKpi, currency: string) {
  if (one.unit === "RATING") return one.text ?? "—";
  if (one.value == null) return "—";
  if (one.unit === "PERCENT") return `${one.value.toFixed(2)}%`;
  if (one.unit === "YEARS") return `${one.value.toFixed(1)} yrs`;
  if (one.unit === "BP") return `${one.value} bp`;
  if (one.unit === "MONEY") return compact(one.value, currency);
  return one.value.toFixed(2);
}

function kpiDelta(one: FiKpi) {
  const d = one.delta as number;
  const sign = d > 0 ? "+" : "";
  if (one.deltaUnit === "BP") return `${sign}${d} bp`;
  if (one.deltaUnit === "YEARS") return `${sign}${d.toFixed(1)} yrs`;
  if (one.deltaUnit === "NOTCHES") return d === 0 ? "In line" : `${Math.abs(d)} notch${Math.abs(d) === 1 ? "" : "es"} ${d > 0 ? "below" : "above"}`;
  return `${sign}${d}`;
}

/** More yield is green; a rating below the benchmark's is amber; duration differences are neutral. */
function kpiTone(one: FiKpi) {
  const d = one.delta ?? 0;
  if (one.key === "RATING") return d > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";
  if (["YTM", "YTW", "OAS"].includes(one.key)) return d >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  return "bg-slate-100 text-ink-soft";
}

/** A date as the page prints it; nothing, or something that is not a date, prints as a dash rather than throwing. */
function day(value: string | null | undefined) {
  if (value == null || value === "" || Number.isNaN(new Date(value).getTime())) return "—";
  return formatDate(value);
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
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

function toneOf(value: number | null | undefined) {
  if (value == null) return undefined;
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}
