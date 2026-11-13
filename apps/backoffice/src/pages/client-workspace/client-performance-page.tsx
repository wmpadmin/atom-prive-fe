import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPerformance,
  type AttributionPeriod,
  type ClientPerformance,
  type PerformanceGrowth,
  type PerformanceMonth,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { CardMenu, CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta, type ViewLayoutState } from "../layout/custom-view";
import { FIGURE_KINDS, FigureRow, FigureStrip, useFigureRow } from "../layout/figure-strip";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart, type ChartData } from "../layout/chart-kinds";
import type { Figures } from "../layout/own-cards";
import { periodName, useDrill } from "./drill-panel";

/**
 * A client's Performance & Attribution, laid out the way the firm's own design draws it. Every figure is worked out on
 * the server from what is stored — the desk's own time-weighted returns, the client's own money-weighted return, the
 * mandate benchmark, the recorded fees — and shown here as it comes. Where the history is too short for a figure it
 * says why rather than showing a nought. Read only.
 */
export function ClientPerformancePage() {
  const { customerId = "" } = useParams();
  const performance = useGetClientPerformance<ClientPerformance, ApiError>(customerId);
  const data = performance.data;
  const view = useViewLayout("workspace.performance", CARDS, DEFAULT_CARDS);

  if (performance.isError) return <Alert tone="danger">{performance.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Measuring the returns…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Performance &amp; Attribution
          </p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Performance &amp; Attribution</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Time- and money-weighted returns, Brinson attribution and risk-adjusted statistics against the IPS policy benchmark
          </p>
        </div>
        {!data.bankFile && <CustomizeButton view={view} />}
      </header>
      {data.bankFile ? <FileClient /> : <Board data={data} view={view} />}
      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {data.bankFile ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/** Every card in the design's place, each saying the bank's files hold no returns, statistics or fees. */
function FileClient() {
  const kpis = ["Return · YTD (TWR)", "Money-weighted · YTD", "Annualised · ITD", "Sharpe ratio · 3Y", "Information ratio · 3Y",
    "Max drawdown", "Up / down capture", "Value added · ITD"];
  return (
    <>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {kpis.map((label) => <Kpi key={label} label={label} value="—" note={<NotInFile />} />)}
      </div>
      <Card title="Benchmark"><FileBlock /></Card>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Growth of $100 · Since Inception"><FileBlock /></Card>
        <Card title="Excess Return Bridge · YTD" lead="Benchmark to portfolio, investable assets"><FileBlock /></Card>
      </div>
      <Card title="Returns by Asset Class"><FileBlock /></Card>
      <Card title="Brinson-Fachler Attribution · YTD"><FileBlock /></Card>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Calendar-year Returns"><FileBlock /></Card>
        <Card title="Rolling 12-month Return" lead="Monthly observations"><FileBlock /></Card>
      </div>
      <Card title="Monthly Returns"><FileBlock /></Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Risk-adjusted Statistics"><FileBlock /></Card>
        <Card title="Fee Impact · YTD" lead="Return drag by fee type"><FileBlock /></Card>
      </div>
    </>
  );
}

function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

type PerformanceCard = "kpis" | "growth" | "benchmark" | "classes" | "bridge" | "brinson" | "years" | "fees" | "rolling"
  | "monthly" | "risk";

/** The screen's cards, in the firm's order: every card on by default. */
const CARDS: Record<PerformanceCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  growth: { title: "Growth of $100 · Since Inception", group: "Returns", charts: ["line", "area", "table"] },
  benchmark: { title: "Benchmark", group: "Summary", charts: ["line", "area", "grouped-bar", "table"] },
  classes: { title: "Returns by Asset Class", group: "Returns", wide: true, charts: ["table", "heatmap", "bar"] },
  bridge: { title: "Excess Return Bridge · YTD", group: "Attribution", charts: ["waterfall", "bar", "table"] },
  brinson: { title: "Brinson-Fachler Attribution", group: "Attribution", charts: ["table", "grouped-bar", "stacked-bar", "heatmap"] },
  years: { title: "Calendar-year Returns", group: "Returns", charts: ["grouped-bar", "line", "table"] },
  fees: { title: "Fee Impact · YTD", group: "Costs & risk", charts: ["horizontal-bar", "donut", "bar", "table"] },
  rolling: { title: "Rolling 12-month Return", group: "Returns", wide: true, charts: ["line", "area", "table"] },
  monthly: { title: "Monthly Returns", group: "Returns", wide: true, charts: ["heatmap", "bar", "table"] },
  // Its measures are in different units (percentages, ratios), so no one chart can put them side by side.
  risk: { title: "Risk-adjusted Statistics", group: "Costs & risk", wide: true },
};

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as PerformanceCard[];

/**
 * What Performance & Attribution offers for a card of the reader's own: the returns, attribution and costs this page
 * already reads for the client, named once. Every figure is the server's; nothing is recomputed.
 */
function performanceFigures(data: ClientPerformance): Figures {
  const pc = (value: number) => percent(value);
  const pts = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
  const ratio = (value: number) => value.toFixed(2);
  const one = (name: string, value: number | null | undefined, max: number, target?: number | null): ChartData | null =>
    value == null ? null : { shape: "gauge", name, value, max, target };
  const series = (categories: string[], rows: { name: string; values: (number | null)[] }[]): ChartData | null =>
    categories.length ? { shape: "series", categories, series: rows } : null;
  const k = data.kpis;
  const ytd = PERIODS.indexOf("YTD");
  const classes = data.byClass.filter((row) => !row.total);
  const period = data.attribution?.periods.find((one) => one.key === "YTD") ?? data.attribution?.periods[0];
  const scale = (value: number | null | undefined) => Math.max(10, Math.abs(value ?? 0) * 2);
  return {
    "returns.growth": {
      label: "Growth of 100 since inception", group: "Returns", kinds: ["line", "area", "table"], format: (value) => value.toFixed(1),
      data: series(data.growth.map((point) => monthLabel(point.on)), [
        { name: "Portfolio", values: data.growth.map((point) => point.portfolio) },
        { name: "Benchmark", values: data.growth.map((point) => point.benchmark) },
      ]),
    },
    "returns.years": {
      label: "Calendar-year returns against the benchmark", group: "Returns", kinds: ["grouped-bar", "line", "table"], format: pc,
      data: series(data.calendarYears.map((year) => String(year.year)), [
        { name: "Portfolio", values: data.calendarYears.map((year) => year.portfolio) },
        { name: "Benchmark", values: data.calendarYears.map((year) => year.benchmark) },
      ]),
    },
    "returns.monthly": {
      label: "Monthly returns", group: "Returns", kinds: ["bar", "line", "table"], format: pc,
      data: series(data.monthly.map((month) => periodName(month.month)), [{ name: "Net TWR", values: data.monthly.map((month) => month.value) }]),
    },
    "returns.rolling": {
      label: "Rolling 12-month return", group: "Returns", kinds: ["line", "area", "table"], format: pc,
      data: series(data.rolling.map((point) => monthLabel(point.on)), [
        { name: "Portfolio", values: data.rolling.map((point) => point.portfolio) },
        { name: "Benchmark", values: data.rolling.map((point) => point.benchmark) },
      ]),
    },
    "returns.ytd-line": {
      label: "This year, month by month, against the benchmark", group: "Returns", kinds: ["line", "area", "grouped-bar", "table"], format: pc,
      data: series((data.benchmark?.ytdLine ?? []).map((point) => monthLabel(point.on)), [
        { name: "Portfolio", values: (data.benchmark?.ytdLine ?? []).map((point) => point.portfolio) },
        { name: "Benchmark", values: (data.benchmark?.ytdLine ?? []).map((point) => point.benchmark) },
      ]),
    },
    "classes.ytd": {
      label: "Return this year by asset class", group: "Asset classes", kinds: ["bar", "horizontal-bar", "table"], format: pc,
      data: series(classes.map((row) => row.name), [{ name: "YTD", values: classes.map((row) => row.figures[ytd] ?? null) }]),
    },
    "classes.periods": {
      label: "Return by asset class and period", group: "Asset classes", kinds: ["heatmap", "table"], format: pc,
      data: series(PERIODS, classes.map((row) => ({ name: row.name, values: row.figures }))),
    },
    "attribution.effects": {
      label: `Attribution effects by class · ${period?.label ?? "YTD"}`, group: "Attribution", kinds: ["grouped-bar", "stacked-bar", "heatmap", "table"],
      format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)} bp`,
      data: period ? series(period.rows.map((row) => row.name), [
        { name: "Allocation", values: period.rows.map((row) => row.allocationBp) },
        { name: "Selection", values: period.rows.map((row) => row.selectionBp) },
        { name: "Interaction", values: period.rows.map((row) => row.interactionBp) },
      ]) : null,
    },
    "attribution.bridge": {
      label: `Benchmark to portfolio · ${period?.label ?? "YTD"}`, group: "Attribution", kinds: ["waterfall", "bar", "table"], format: (value) => `${value.toFixed(2)}`,
      data: period ? series(["Allocation", "Selection", "Interaction", "Residual"], [{ name: "Percentage points",
        values: [period.allocation, period.selection, period.interaction, period.residual] }]) : null,
    },
    "costs.fees": {
      label: "Fees by type, this year", group: "Costs", kinds: ["horizontal-bar", "donut", "bar", "table"], format: (value) => `${value.toFixed(2)}%`,
      data: data.fees?.byType.length ? { shape: "shares", items: data.fees.byType.map((fee) => ({ name: fee.label, value: fee.ytdPercent })) } : null,
    },
    "kpi.ytd": {
      label: "Return this year (TWR, net)", group: "Key figures", kinds: ["gauge", "number", "table"], format: pc,
      data: one("YTD, net", k?.ytd, scale(k?.ytd), k?.ytdBenchmark),
    },
    "kpi.excess": { label: "Excess return this year", group: "Key figures", kinds: ["number", "table"], format: pts, data: one("Excess over the benchmark", k?.ytdExcess, scale(k?.ytdExcess)) },
    "kpi.mwr": { label: "Money-weighted return this year", group: "Key figures", kinds: ["number", "gauge", "table"], format: pc, data: one("Money-weighted, YTD", k?.ytdMoneyWeighted, scale(k?.ytdMoneyWeighted)) },
    "kpi.itd": { label: "Return since inception", group: "Key figures", kinds: ["number", "table"], format: pc, data: one(k?.itdAnnualised ? "Since inception, annualised" : "Since inception", k?.itd, scale(k?.itd), k?.itdBenchmark) },
    "kpi.sharpe": { label: "Sharpe ratio", group: "Risk-adjusted", kinds: ["number", "gauge", "table"], format: ratio, data: one("Sharpe ratio", k?.sharpe, 3, k?.sharpeBenchmark) },
    "kpi.drawdown": { label: "Maximum drawdown", group: "Risk-adjusted", kinds: ["number", "table"], format: pc, data: one("Maximum drawdown", k?.maxDrawdown, scale(k?.maxDrawdown)) },
    "kpi.fees": { label: "Total fees this year", group: "Costs", kinds: ["number", "table"], format: (value) => `${value.toFixed(2)}%`, data: one("Fees, YTD", data.fees?.totalPercent, Math.max(2, (data.fees?.totalPercent ?? 0) * 2)) },
  };
}

function Board({ data, view }: { data: ClientPerformance; view: ViewLayoutState<PerformanceCard> }) {
  const [weighting, setWeighting] = useState<"twr" | "mwr">("twr");
  const [basis, setBasis] = useState<"net" | "gross">("net");
  return (
    <LayoutGrid view={view} screen="Performance & Attribution" figures={performanceFigures(data)} render={{
      kpis: <Kpis data={data} weighting={weighting} basis={basis} />,
      growth: <GrowthCard data={data} weighting={weighting} setWeighting={setWeighting} basis={basis} setBasis={setBasis} chart={cardChart(view, "growth")} />,
      benchmark: <BenchmarkCard data={data} chart={cardChart(view, "benchmark")} />,
      classes: <ClassCard data={data} chart={cardChart(view, "classes")} />,
      bridge: data.attribution ? <BridgeCard data={data} chart={cardChart(view, "bridge")} /> : (
        <Card title="Excess Return Bridge · YTD" lead="Benchmark to portfolio, investable assets">
          <NotMeasured reason={data.brinson.reason} />
        </Card>
      ),
      brinson: data.attribution ? <BrinsonCard data={data} chart={cardChart(view, "brinson")} /> : (
        <Card title="Brinson-Fachler Attribution · YTD" lead="Average weights · effects in basis points · investable assets, owned outright excluded">
          <NotMeasured reason={data.brinson.reason} />
        </Card>
      ),
      years: <YearsCard data={data} chart={cardChart(view, "years")} />,
      fees: <FeesCard data={data} chart={cardChart(view, "fees")} />,
      rolling: <RollingCard data={data} chart={cardChart(view, "rolling")} />,
      monthly: <MonthlyCard months={data.monthly} asOf={data.asOf} chart={cardChart(view, "monthly")} />,
      risk: <RiskCard data={data} />,
    }} />
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Kpis({ data, weighting, basis }: { data: ClientPerformance; weighting: "twr" | "mwr"; basis: "net" | "gross" }) {
  const k = data.kpis;
  if (!k) return null;
  const ytd = basis === "gross" ? k.ytdGross : k.ytd;
  const window = k.window ?? "3Y";
  return (
    <FigureStrip className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      <Kpi label={`Return · YTD (TWR${basis === "gross" ? ", gross" : ""})`} value={pct(ytd)} tone={toneOf(ytd)}
        note={k.ytdBenchmark == null ? "No benchmark on the mandate" : <>Benchmark {pct(k.ytdBenchmark)}{k.ytdExcess != null && <span className={toneOf(k.ytdExcess)}> · {pp(k.ytdExcess)}</span>}</>} />
      <Kpi label="Money-weighted · YTD" value={pct(k.ytdMoneyWeighted)} tone={toneOf(k.ytdMoneyWeighted)}
        emphasised={weighting === "mwr"}
        note={k.ytdMoneyWeighted == null ? "Nothing to solve over this year" : `IRR incl. timing of ${money(k.netFlowsYtd ?? 0, data.currency)} net flows`} />
      <Kpi label={k.itdAnnualised ? "Annualised · ITD" : "Since inception · ITD"} value={pct(k.itd)} tone={toneOf(k.itd)}
        note={<>{k.itdAnnualised ? null : "Under a year: not annualised · "}{k.itdBenchmark != null && `Benchmark ${pct(k.itdBenchmark)}`}{k.since && ` · since ${monthYear(k.since)}`}</>} />
      <Kpi label={`Sharpe ratio · ${window}`} value={num(k.sharpe)}
        note={k.sharpe == null ? (k.riskWhyNot ?? "—") : <>Benchmark {num(k.sharpeBenchmark)} · Sortino {num(k.sortino)}</>} />
      <Kpi label={`Information ratio · ${window}`} value={num(k.informationRatio)}
        note={k.informationRatio == null ? (k.riskWhyNot ?? "—") : `Tracking error ${pct(k.trackingError, false)}`} />
      <Kpi label="Max drawdown" value={pct(k.maxDrawdown)} tone={k.maxDrawdown != null && k.maxDrawdown < 0 ? "text-red-700" : undefined}
        note={k.drawdownPeak && k.drawdownTrough
          ? `${shortMonth(k.drawdownPeak, k.drawdownTrough)}–${monthYear(k.drawdownTrough)} · ${k.recoveredOn ? `recovered in ${monthsBetween(k.drawdownTrough, k.recoveredOn)} months` : "not yet recovered"}`
          : "No fall on month-end values"} />
      <Kpi label="Up / down capture" value={k.upCapture == null ? "—" : `${k.upCapture.toFixed(0)}% / ${k.downCapture == null ? "—" : `${k.downCapture.toFixed(0)}%`}`}
        note={k.upCapture == null ? (k.riskWhyNot ?? "—") : `vs policy benchmark, ${window} monthly`} />
      <Kpi label="Value added · ITD" value={k.valueAdded == null ? "—" : signedMoney(k.valueAdded, data.currency)} tone={toneOf(k.valueAdded)}
        note={k.valueAdded == null ? "No benchmark history on the mandate" : "vs benchmark-equivalent after flows"} />
    </FigureStrip>
  );
}

function BenchmarkCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const b = data.benchmark;
  const toMonth = useMonthDrill();
  const option = useMemo(() => {
    const colours = ink();
    const line = b?.ytdLine ?? [];
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value.toFixed(2)}%` },
      xAxis: { type: "category", boundaryGap: false, data: line.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Portfolio (TWR, net)", data: line.map((one) => one.portfolio), showSymbol: false, lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
        { type: "line", name: "Mandate benchmark", data: line.map((one) => one.benchmark), showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
      ],
    };
  }, [b]);
  return (
    <Card title="Benchmark" lead="The benchmark on the client's mandate, as recorded · view only" picker={(b?.ytdLine.length ?? 0) >= 2 && chart.picker}>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Total family · investable</p>
          <p className="mt-1 text-lg font-bold">{b?.name ?? "No benchmark recorded for the mandate"}</p>
          {b?.mandate && <p className="text-xs text-ink-muted">Mandate · {b.mandate}</p>}
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-ink-soft">{b?.composition ?? "Composition not recorded"}</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Live result · YTD {data.asOf.slice(0, 4)}</p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Small label="Portfolio" value={pct(b?.ytdPortfolio)} tone={toneOf(b?.ytdPortfolio)} />
            <Small label="Benchmark" value={pct(b?.ytdBenchmark)} />
            <Small label="Excess" value={b?.ytdExcess == null ? "—" : pp(b.ytdExcess)} tone={toneOf(b?.ytdExcess)} />
          </div>
          {(b?.ytdLine.length ?? 0) < 2 ? <Empty>Not enough months this year to draw.</Empty> : chart.own ? (
            <Chart option={option} height={170} label="This year's return, month by month, against the benchmark"
              onPick={toMonth && ((_, index) => toMonth(b?.ytdLine[index]?.on))} />
          ) : (
            <KindChart kind={chart.kind!} format={percent} height={170} label="This year's return, month by month, against the benchmark"
              data={{ shape: "series", categories: b!.ytdLine.map((one) => monthLabel(one.on)), series: [
                { name: "Portfolio", values: b!.ytdLine.map((one) => one.portfolio) },
                { name: "Benchmark", values: b!.ytdLine.map((one) => one.benchmark) },
              ] }}
              onPick={toMonth && ((index) => toMonth(b?.ytdLine[index]?.on))} />
          )}
        </div>
      </div>
    </Card>
  );
}

function GrowthCard({ data, weighting, setWeighting, basis, setBasis, chart }: {
  data: ClientPerformance;
  weighting: "twr" | "mwr";
  setWeighting: (next: "twr" | "mwr") => void;
  basis: "net" | "gross";
  setBasis: (next: "net" | "gross") => void;
  chart: CardChart;
}) {
  const toMonth = useMonthDrill();
  const option = useMemo(() => {
    const colours = ink();
    const points = data.growth;
    const portfolio = points.map((one) => (basis === "gross" ? one.portfolioGross : one.portfolio));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      legend: { show: false },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => value?.toFixed(1) },
      xAxis: { type: "category", boundaryGap: points.length === 1, data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: `Portfolio (${basis})`, data: portfolio, showSymbol: points.length === 1, symbolSize: 8, lineStyle: { color: colours.text, width: 1.5 },
          itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas } },
        { type: "line", name: "Policy benchmark", data: points.map((one) => one.benchmark), showSymbol: false,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
        { type: "line", name: "IPS objective", data: points.map((one) => one.objective), showSymbol: false,
          lineStyle: { color: colours.muted, type: "dotted", width: 1.5 }, itemStyle: { color: colours.muted } },
      ],
    };
  }, [data.growth, basis]);
  return (
    <Card title="Growth of $100 · Since Inception" picker={data.growth.length > 1 && chart.picker}
      lead={`${basis === "net" ? "Net" : "Gross"} of fees · inception ${data.kpis?.since ? formatDate(data.kpis.since) : "the first close"}${
        data.kpis?.itdAnnualised && data.kpis.itd != null && data.kpis.itdBenchmark != null
          ? ` · annualised ${data.kpis.itd.toFixed(1)}% vs ${data.kpis.itdBenchmark.toFixed(1)}%` : ""}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Return weighting" value={weighting} onChange={setWeighting} options={[["twr", "TWR"], ["mwr", "MWR"]]} />
          <Toggle label="Fees" value={basis} onChange={setBasis} options={[["net", "Net"], ["gross", "Gross"]]} />
        </div>
      }>
      {data.growth.length === 0 ? <Empty>Not enough history to draw yet.</Empty> : (
        <>
          {chart.own ? (
            <Chart option={option} height={260} label="What 100 put in at inception has grown to, against the benchmark and the objective"
              onPick={toMonth && ((_, index) => toMonth(data.growth[index]?.on))} />
          ) : (
            <KindChart kind={chart.kind!} format={(value) => value.toFixed(1)} height={260}
              label="What 100 put in at inception has grown to, against the benchmark and the objective"
              data={{ shape: "series", categories: data.growth.map((one) => monthLabel(one.on)), series: [
                { name: `Portfolio (${basis})`, values: data.growth.map((one) => (basis === "gross" ? one.portfolioGross : one.portfolio)) },
                { name: "Policy benchmark", values: data.growth.map((one) => one.benchmark) },
                { name: "IPS objective", values: data.growth.map((one) => one.objective) },
              ] }}
              onPick={toMonth && ((index) => toMonth(data.growth[index]?.on))} />
          )}
          {data.growth.length === 1 && <p className="mt-1 text-3xs text-ink-muted italic">One reading on file so far: it is marked as a point, and the line starts with the next.</p>}
          <GrowthLegend data={data} basis={basis} />
        </>
      )}
      {weighting === "mwr" && (
        <p className="mt-2 text-3xs text-ink-muted italic">
          Growth is drawn time-weighted: a money-weighted return is one rate for the client's own money, shown in the cards, not a path.
        </p>
      )}
    </Card>
  );
}

/**
 * Benchmark to portfolio in one walk: the benchmark the page shows, each Brinson effect, what the effects leave
 * unexplained, and the portfolio's own time-weighted return. The server's figures; nothing is added up here.
 */
function BridgeCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const drill = useDrill();
  const period = data.attribution?.periods.find((one) => one.key === "YTD") ?? data.attribution?.periods[0];
  const option = useMemo(() => {
    if (!period) return {};
    const colours = ink();
    const steps: { name: string; value: number; total?: boolean }[] = [
      { name: "Benchmark", value: period.benchmark, total: true },
      { name: "Allocation", value: period.allocation },
      { name: "Selection", value: period.selection },
      { name: "Interaction", value: period.interaction },
      ...(Math.abs(period.residual) >= 0.01 ? [{ name: "Residual", value: period.residual }] : []),
      { name: "Portfolio", value: period.portfolio, total: true },
    ];
    // Each step floats from where the walk stood; the totals stand on zero.
    let running = 0;
    const base: number[] = [];
    const bar: { value: number; itemStyle: { color: string } }[] = [];
    for (const step of steps) {
      if (step.total) {
        base.push(Math.min(0, step.value));
        bar.push({ value: Math.abs(step.value), itemStyle: { color: colours.text } });
        running = step.value;
      } else {
        const next = running + step.value;
        base.push(Math.min(running, next));
        bar.push({ value: Math.abs(step.value), itemStyle: { color: step.value >= 0 ? colours.primary : colours.danger } });
        running = next;
      }
    }
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (items: { dataIndex: number }[]) => {
          const step = steps[items[0]?.dataIndex ?? 0];
          return `${step.name}: ${step.total ? signed(step.value) : `${step.value >= 0 ? "+" : ""}${step.value.toFixed(2)} pp`}`;
        } },
      xAxis: { type: "category", data: steps.map((one) => one.name), axisLabel: { color: colours.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", stack: "walk", data: base, itemStyle: { color: "transparent" }, emphasis: { disabled: true }, silent: true, tooltip: { show: false } },
        { type: "bar", stack: "walk", data: bar, barMaxWidth: 44,
          label: { show: true, position: "top", color: colours.text, fontSize: 11,
            formatter: ({ dataIndex }: { dataIndex: number }) => {
              const step = steps[dataIndex];
              return step.total ? `${step.value.toFixed(2)}%` : `${step.value >= 0 ? "+" : ""}${step.value.toFixed(2)}`;
            } } },
      ],
    };
  }, [period]);
  if (!period) return null;
  const openEffect = (name: string) => {
    const effect = EFFECTS[name];
    drill?.(effect ? { by: "effect", key: effect, name } : { by: "effect", key: "total", name: "All effects" });
  };
  const walk = [
    { name: "Benchmark", value: period.benchmark },
    { name: "Allocation", value: period.allocation },
    { name: "Selection", value: period.selection },
    { name: "Interaction", value: period.interaction },
    ...(Math.abs(period.residual) >= 0.01 ? [{ name: "Residual", value: period.residual }] : []),
    { name: "Portfolio", value: period.portfolio },
  ];
  const largest = period.rows.reduce<{ name: string; bp: number } | null>(
    (best, row) => (best == null || Math.abs(row.totalBp) > Math.abs(best.bp) ? { name: row.name, bp: row.totalBp } : best), null);
  return (
    <Card title={`Excess Return Bridge · ${period.label}`} lead="Benchmark to portfolio, investable assets · percentage points" picker={chart.picker}>
      {chart.own ? (
        <div className="relative min-h-[240px] flex-1">
          <div className="absolute inset-0">
            <Chart option={option} label="From the benchmark's return to the portfolio's, through allocation, selection, interaction and the residual"
              onPick={drill ? (name) => openEffect(name) : undefined} />
          </div>
        </div>
      ) : (
        <KindChart kind={chart.kind!} format={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`} height={240}
          label="From the benchmark's return to the portfolio's, through allocation, selection, interaction and the residual"
          data={{ shape: "series", categories: walk.map((one) => one.name), series: [{ name: "Percentage points", values: walk.map((one) => one.value) }] }}
          onPick={drill ? (index) => openEffect(walk[index]?.name ?? "") : undefined} />
      )}
      <p className="mt-2 text-xs text-ink-muted">
        {largest && `${largest.name} is the largest single driver (${largest.bp >= 0 ? "+" : ""}${largest.bp} bp). `}
        The residual, {period.residual >= 0 ? "+" : ""}{period.residual.toFixed(2)} pp, is what month-by-month linking leaves unexplained.
      </p>
      <p className="mt-1 text-3xs text-ink-muted italic">{data.attribution?.note}</p>
    </Card>
  );
}

function BrinsonCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const drill = useDrill();
  const periods = data.attribution?.periods ?? [];
  const [key, setKey] = useState(periods[0]?.key ?? "YTD");
  const period: AttributionPeriod | undefined = periods.find((one) => one.key === key) ?? periods[0];
  if (!period) return null;
  const totals = period.rows.reduce((sum, row) => ({
    allocation: sum.allocation + row.allocationBp, selection: sum.selection + row.selectionBp,
    interaction: sum.interaction + row.interactionBp, total: sum.total + row.totalBp,
  }), { allocation: 0, selection: 0, interaction: 0, total: 0 });
  const excess = period.portfolio - period.benchmark;
  return (
    <Card title={`Brinson-Fachler Attribution · ${period.label}`}
      lead="Average weights · effects in basis points · investable assets, owned outright excluded"
      action={periods.length > 1 && <Toggle label="Period" value={period.key} onChange={setKey} options={periods.map((one) => [one.key, one.key])} />}
      picker={chart.picker}>
      {!chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value > 0 ? "+" : ""}${Math.round(value)} bp`} height={260}
          label="Each sleeve's allocation, selection and interaction effects"
          data={{ shape: "series", categories: period.rows.map((row) => row.name), series: [
            { name: "Allocation", values: period.rows.map((row) => row.allocationBp) },
            { name: "Selection", values: period.rows.map((row) => row.selectionBp) },
            { name: "Interaction", values: period.rows.map((row) => row.interactionBp) },
          ] }}
          onPick={(index) => { const row = period.rows[index]; if (row) drill?.({ by: "class", key: row.key, name: row.name }); }} />
      ) : (
      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="py-2 pr-2 pl-5">Sleeve</th>
              <th scope="col" className="px-2 py-2 text-right">Port. wt</th>
              <th scope="col" className="px-2 py-2 text-right">Bench wt</th>
              <th scope="col" className="px-2 py-2 text-right">Port. ret</th>
              <th scope="col" className="px-2 py-2 text-right">Bench ret</th>
              <th scope="col" className="px-2 py-2 text-right">Allocation</th>
              <th scope="col" className="px-2 py-2 text-right">Selection</th>
              <th scope="col" className="px-2 py-2 text-right">Interaction</th>
              <th scope="col" className="py-2 pr-5 pl-2 text-right">Total bp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {period.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="py-2 pr-2 pl-5 text-left font-medium">
                  <button type="button" className="text-left hover:text-primary-700 hover:underline"
                    onClick={() => drill?.({ by: "class", key: row.key, name: row.name })}>{row.name}</button>
                </th>
                <td className="px-2 py-2 text-right tabular-nums">{row.portfolioWeight.toFixed(1)}%</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.benchmarkWeight.toFixed(1)}%</td>
                <td className="px-2 py-2 text-right tabular-nums">{signed(row.portfolioReturn)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{signed(row.benchmarkReturn)}</td>
                <Bp value={row.allocationBp} />
                <Bp value={row.selectionBp} />
                <Bp value={row.interactionBp} />
                <Bp value={row.totalBp} last />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-slate-50 font-semibold">
              <th scope="row" className="py-2 pr-2 pl-5 text-left">Total (investable)</th>
              <td className="px-2 py-2 text-right tabular-nums">100.0%</td>
              <td className="px-2 py-2 text-right tabular-nums">100.0%</td>
              <td className="px-2 py-2 text-right tabular-nums">{signed(period.portfolio)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{signed(period.benchmark)}</td>
              <Bp value={totals.allocation} />
              <Bp value={totals.selection} />
              <Bp value={totals.interaction} />
              <Bp value={totals.total} last />
            </tr>
          </tfoot>
        </table>
      </div>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">
        {data.attribution?.note}. The portfolio is the time-weighted return and the benchmark the page's; of the {excess >= 0 ? "+" : ""}{excess.toFixed(2)} pp
        between them, {period.residual >= 0 ? "+" : ""}{period.residual.toFixed(2)} pp is the residual month-by-month linking leaves.
      </p>
    </Card>
  );
}

function Bp({ value, last }: { value: number; last?: boolean }) {
  return (
    <td className={cn("py-2 text-right tabular-nums", last ? "pr-5 pl-2 font-semibold" : "px-2", value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : "")}>
      {value > 0 ? "+" : ""}{value}
    </td>
  );
}

const PERIODS = ["MTD", "QTD", "YTD", "1Y", "3Y ann.", "5Y ann.", "ITD ann."];

function ClassCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const drill = useDrill();
  const classes = data.byClass.filter((row) => !row.total);
  const ytd = PERIODS.indexOf("YTD");
  const open = (index: number) => {
    const row = classes[index];
    if (row && row.key !== "OWNED_OUTRIGHT") drill?.({ by: "class", key: row.key, name: row.name });
  };
  return (
    <Card title="Returns by Asset Class" lead={`Portfolio return with benchmark beneath · time-weighted, net of fees, ${data.currency}`}
      picker={classes.length > 0 && chart.picker}>
      {data.byClass.length === 0 ? <Empty>Nothing written down to measure yet.</Empty> : chart.kind === "heatmap" ? (
        // Each class a row, each period a column, as the table has them.
        <KindChart kind="heatmap" format={percent} height={60 + classes.length * 34} label="Each asset class's return over each period"
          data={{ shape: "series", categories: PERIODS, series: classes.map((row) => ({ name: row.name, values: row.figures })) }} />
      ) : chart.kind === "bar" ? (
        <KindChart kind="bar" format={percent} height={240} label="Each asset class's return this year"
          data={{ shape: "series", categories: classes.map((row) => row.name), series: [{ name: "YTD", values: classes.map((row) => row.figures[ytd] ?? null) }] }}
          onPick={open} />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Asset class</th>
                <th scope="col" className="px-2 py-2 text-right">Value</th>
                {PERIODS.map((one) => <th key={one} scope="col" className="px-2 py-2 text-right">{one}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.byClass.map((row) => (
                <tr key={row.key} className={cn(row.total && "bg-slate-50 font-semibold")}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">
                    {row.total || row.key === "OWNED_OUTRIGHT" ? row.name : (
                      <button type="button" className="text-left hover:text-primary-700 hover:underline"
                        onClick={() => drill?.({ by: "class", key: row.key, name: row.name })}>{row.name}</button>
                    )}
                  </th>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{row.value == null ? "—" : money(row.value, data.currency)}</td>
                  {row.figures.map((figure, at) => (
                    <td key={at} className="px-2 py-2 text-right tabular-nums">
                      <span className={cn("block", toneOf(figure))}>{figure == null ? "—" : signed(figure)}</span>
                      <span className="block text-3xs font-normal text-ink-muted">{row.benchmark[at] != null ? signed(row.benchmark[at] as number) : "—"}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">
        {data.classNote ?? "No benchmark is recorded for each asset class, so the line beneath a class is a dash; the total's is the policy benchmark. Class figures count money moved in or out of a class as change."}
      </p>
    </Card>
  );
}

function YearsCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const drill = useDrill();
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => (value == null ? "—" : `${value.toFixed(2)}%`) },
      xAxis: { type: "category", data: data.calendarYears.map((one) => `${one.year}${one.partial ? "*" : ""}`), axisLabel: { color: colours.muted },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        // Capped, so a single year reads as an ordinary pair of bars in the middle rather than two slabs.
        // The portfolio in the app's blue rather than the ink, which glares near-white on the dark theme.
        { type: "bar", name: "Portfolio", barMaxWidth: 40, data: data.calendarYears.map((one) => one.portfolio), itemStyle: { color: colours.primary } },
        { type: "bar", name: "Policy benchmark", barMaxWidth: 40, data: data.calendarYears.map((one) => one.benchmark), itemStyle: { color: colours.neutral } },
      ],
    };
  }, [data.calendarYears]);
  const openYear = (index: number) => {
    const year = data.calendarYears[index];
    if (year) drill?.({ by: "period", key: String(year.year), name: String(year.year) });
  };
  return (
    <Card title="Calendar-year Returns" picker={data.calendarYears.length > 0 && chart.picker}>
      {data.calendarYears.length === 0 ? <Empty>No full month measured yet.</Empty> : chart.own ? (
        <Chart option={option} height={220} label="Each calendar year's return against the benchmark"
          onPick={drill ? (_, index) => openYear(index) : undefined} />
      ) : (
        <KindChart kind={chart.kind!} format={percent} height={220} label="Each calendar year's return against the benchmark"
          data={{ shape: "series", categories: data.calendarYears.map((one) => `${one.year}${one.partial ? "*" : ""}`), series: [
            { name: "Portfolio", values: data.calendarYears.map((one) => one.portfolio) },
            { name: "Policy benchmark", values: data.calendarYears.map((one) => one.benchmark) },
          ] }}
          onPick={drill ? openYear : undefined} />
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">{yearsNote(data)}</p>
    </Card>
  );
}

function RollingCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const toMonth = useMonthDrill();
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => (value == null ? "—" : `${value.toFixed(2)}%`) },
      xAxis: { type: "category", boundaryGap: false, data: data.rolling.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Portfolio", data: data.rolling.map((one) => one.portfolio), showSymbol: false, lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
        { type: "line", name: "Policy benchmark", data: data.rolling.map((one) => one.benchmark), showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
      ],
    };
  }, [data.rolling]);
  return (
    <Card title="Rolling 12-month Return" lead="Monthly observations" picker={data.rolling.length > 0 && chart.picker}>
      {data.rolling.length === 0 ? <Empty>Needs twelve monthly returns; {data.months} on file.</Empty> : chart.own ? (
        <Chart option={option} height={220} label="Each month's trailing twelve-month return against the benchmark"
          onPick={toMonth && ((_, index) => toMonth(data.rolling[index]?.on))} />
      ) : (
        <KindChart kind={chart.kind!} format={percent} height={220} label="Each month's trailing twelve-month return against the benchmark"
          data={{ shape: "series", categories: data.rolling.map((one) => monthLabel(one.on)), series: [
            { name: "Portfolio", values: data.rolling.map((one) => one.portfolio) },
            { name: "Policy benchmark", values: data.rolling.map((one) => one.benchmark) },
          ] }}
          onPick={toMonth && ((index) => toMonth(data.rolling[index]?.on))} />
      )}
    </Card>
  );
}

function MonthlyCard({ months, asOf, chart }: { months: PerformanceMonth[]; asOf: string; chart: CardChart }) {
  const drill = useDrill();
  const years = [...new Set(months.map((one) => one.month.slice(0, 4)))].sort();
  const byKey = new Map(months.map((one) => [one.month.slice(0, 7), one]));
  const largest = Math.max(0.5, ...months.map((one) => Math.abs(one.value)));
  const yearTotal = (year: string) => {
    const of = months.filter((one) => one.month.startsWith(year));
    return (of.reduce((grown, one) => grown * (1 + one.value / 100), 1) - 1) * 100;
  };
  return (
    <Card title="Monthly Returns" lead={`Net TWR % · ${new Date(asOf).toLocaleString("en-GB", { month: "short", year: "numeric" })} month-to-date`}
      picker={months.length > 0 && chart.picker}>
      {months.length === 0 ? <Empty>No month measured yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={percent} height={240} label="Each month's net time-weighted return"
          data={{ shape: "series", categories: months.map((one) => periodName(one.month)), series: [{ name: "Net TWR", values: months.map((one) => one.value) }] }}
          onPick={(index) => { const one = months[index]; if (one) drill?.({ by: "period", key: one.month.slice(0, 7), name: periodName(one.month) }); }} />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-2xs font-semibold text-ink-muted">
                <th scope="col" className="py-1.5 pr-2 pl-5 text-left"><span className="sr-only">Year</span></th>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((one) => (
                  <th key={one} scope="col" className="px-0.5 py-1.5 text-center">{one}</th>
                ))}
                <th scope="col" className="py-1.5 pr-5 pl-0.5 text-center">Year</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year}>
                  <th scope="row" className="py-0.5 pr-2 pl-5 text-left font-semibold">{year}</th>
                  {Array.from({ length: 12 }, (_, at) => {
                    const one = byKey.get(`${year}-${String(at + 1).padStart(2, "0")}`);
                    return (
                      <td key={at} className="px-0.5 py-0.5">
                        {one ? (
                          <button type="button" disabled={!drill} className="block w-full rounded-sm enabled:hover:ring-2 enabled:hover:ring-primary-300"
                            aria-label={`${periodName(one.month)}: ${signed(one.value)}`}
                            onClick={() => drill?.({ by: "period", key: one.month.slice(0, 7), name: periodName(one.month) })}>
                            <Heat value={one.value} largest={largest} partial={one.partial} />
                          </button>
                        ) : <span className="block h-7 rounded-sm bg-slate-50" />}
                      </td>
                    );
                  })}
                  <td className="py-0.5 pr-5 pl-0.5">
                    <button type="button" disabled={!drill} className="block w-full rounded-sm enabled:hover:ring-2 enabled:hover:ring-primary-300"
                      aria-label={`${year}: ${signed(yearTotal(year))}`} onClick={() => drill?.({ by: "period", key: year, name: year })}>
                      <Heat value={yearTotal(year)} largest={Math.max(largest, Math.abs(yearTotal(year)))} partial={false} strong />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs" style={{ background: "color-mix(in srgb, var(--color-red-500) 35%, transparent)" }} aria-hidden="true" />Negative</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-slate-100" aria-hidden="true" />Flat</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs" style={{ background: "color-mix(in srgb, var(--color-emerald-500) 35%, transparent)" }} aria-hidden="true" />Positive</li>
        <li className="text-3xs italic">A part month is marked with a dot.</li>
      </ul>
    </Card>
  );
}

function Heat({ value, largest, partial, strong }: { value: number; largest: number; partial: boolean; strong?: boolean }) {
  // A soft tint of green or red graded by size, under the page's own ink, as on the Interest Matrix: never a solid
  // saturated block.
  const depth = Math.min(1, Math.abs(value) / largest);
  const hue = value > 0.05 ? "var(--color-emerald-500)" : value < -0.05 ? "var(--color-red-500)" : null;
  return (
    <span className={cn("block h-7 rounded-sm px-1 text-center leading-7 text-ink tabular-nums", strong && "font-bold")}
      style={{ background: hue ? `color-mix(in srgb, ${hue} ${Math.round(10 + 30 * depth)}%, transparent)` : "var(--color-slate-100)" }}>
      {signed(value)}{partial && "·"}
    </span>
  );
}

function RiskCard({ data }: { data: ClientPerformance }) {
  const risk = data.risk;
  return (
    <Card title={`Risk-adjusted Statistics · ${risk?.window ?? "3Y"}`}
      lead={`Monthly returns${data.riskFreePercent != null ? `, risk-free = ${data.riskFreePercent}% (3M T-bill)` : ", no risk-free rate set"}`}>
      {!risk || risk.measures.length === 0 ? <Empty>{risk?.whyNot ?? "Nothing to measure yet."}</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Measure</th>
                <th scope="col" className="px-2 py-2 text-right">Portfolio</th>
                <th scope="col" className="py-2 pr-5 pl-2 text-right">Benchmark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {risk.measures.map((one) => (
                <tr key={one.key}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-normal">
                    {one.label}
                    {one.note && <span className="block text-3xs text-ink-muted">{one.note}</span>}
                  </th>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{one.portfolio == null ? "—" : one.percent ? `${one.portfolio.toFixed(1)}%` : one.portfolio.toFixed(2)}</td>
                  <td className="py-2 pr-5 pl-2 text-right tabular-nums text-ink-soft">{one.benchmark == null ? "—" : one.percent ? `${one.benchmark.toFixed(1)}%` : one.benchmark.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FeesCard({ data, chart }: { data: ClientPerformance; chart: CardChart }) {
  const f = data.fees;
  const largest = Math.max(0.01, ...(f?.byType ?? []).map((one) => one.ytdPercent));
  return (
    <Card title="Fee Impact · YTD" lead="Return drag by fee type" picker={!!f && f.byType.length > 0 && chart.picker}>
      {!f ? <Empty>No fees are recorded for this client.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Small label="Gross" value={pct(f.gross)} big />
            <Small label="Total fees" value={`−${f.totalPercent.toFixed(2)}%`} tone="text-red-700" big />
            <Small label="Net" value={pct(f.net)} tone={toneOf(f.net)} big />
          </div>
          {!chart.own ? (
            <div className="mt-4">
              <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(2)}%`} height={220} label="This year's return drag by fee type"
                data={{ shape: "shares", items: f.byType.map((one) => ({ name: one.label, value: one.ytdPercent })) }} />
            </div>
          ) : (
          <ul className="mt-4 divide-y divide-line">
            {f.byType.map((one) => (
              <li key={one.type} className="grid min-h-9 grid-cols-[170px_minmax(0,1fr)_54px] items-center gap-2 py-1.5 text-sm">
                <span className="leading-snug break-words" title={`${one.annualBp} bp a year`}>{one.label}</span>
                <span className="block h-2.5 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.ytdPercent / largest) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{one.ytdPercent.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Total cost YTD {money(f.totalAmount, data.currency)} · annualised TER {f.annualPercent.toFixed(2)}%
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** The bridge's bars that are one Brinson effect; the benchmark, the residual and the portfolio open all of them. */
const EFFECTS: Record<string, string> = { Allocation: "allocation", Selection: "selection", Interaction: "interaction" };

/** Opens the month a point of a line falls in; nothing outside a client's workspace. */
function useMonthDrill() {
  const drill = useDrill();
  return drill ? (on: string | undefined) => {
    if (on) drill({ by: "period", key: on.slice(0, 7), name: periodName(on) });
  } : undefined;
}

/** @param picker the chart type switcher, beside the card's own action, for a card that draws a chart */
function Card({ title, lead, action, picker, children }: { title: string; lead?: string; action?: ReactNode; picker?: ReactNode; children: ReactNode }) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{action}{picker}<CardMenu /></div>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note, tone, emphasised }: { label: string; value: string; note: ReactNode; tone?: string; emphasised?: boolean }) {
  if (useFigureRow()) return <FigureRow label={label} value={value} note={note} tone={tone} />;
  return (
    <div className={cn("rounded-2xl border bg-white px-4 py-3.5", emphasised ? "border-primary-200 ring-1 ring-primary-200" : "border-line")}>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <div className="mt-1 text-xs text-ink-muted">{note}</div>
    </div>
  );
}

function Small({ label, value, tone, big }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("font-bold tabular-nums", big ? "text-2xl" : "text-xl", tone)}>{value}</p>
    </div>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5">
      {options.map(([id, name]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            value === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
          {name}
        </button>
      ))}
    </div>
  );
}

function NotMeasured({ reason }: { reason: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">{reason}</p>
  );
}

function NotInFile() {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      not in bank file
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

/** Their legend under the chart, with where each line ends. */
function GrowthLegend({ data, basis }: { data: ClientPerformance; basis: "net" | "gross" }) {
  // Where each line ends: its last point, which for a line with a gap at the end is the last one it has.
  const end = (pick: (one: PerformanceGrowth) => number | null | undefined) =>
    [...data.growth].reverse().map(pick).find((value) => value != null);
  if (data.growth.length === 0) return null;
  const items: [string, string, number | null | undefined][] = [
    ["Portfolio", "bg-ink", end((one) => (basis === "gross" ? one.portfolioGross : one.portfolio))],
    ["Policy benchmark", "bg-red-500", end((one) => one.benchmark)],
    ["IPS objective", "bg-slate-400", end((one) => one.objective)],
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.filter(([, , value]) => value != null).map(([name, colour, value]) => (
        <li key={name} className="flex items-center gap-1.5">
          <span className={cn("h-0.5 w-4", colour)} aria-hidden="true" />
          {name} · <b className="text-ink tabular-nums">{Math.round(value as number)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Their footnote under the calendar years, from the server's reading of them. */
function yearsNote(data: ClientPerformance) {
  const first = data.calendarYears[0];
  const parts: string[] = [];
  if (first?.partial && data.kpis?.since) parts.push(`* ${first.year} from inception, ${formatDate(data.kpis.since)}.`);
  const summary = data.yearsSummary;
  if (summary) {
    parts.push(`Outperformed benchmark in ${summary.outperformed} of ${summary.periods} periods; ${summary.negative} negative ${summary.negative === 1 ? "year" : "years"}.`);
  }
  return parts.join(" ") || "* Part of the year: from the first close, or to date.";
}

function monthYear(day: string) {
  const date = new Date(day);
  return `${date.toLocaleString("en-GB", { month: "short" })} ${date.getFullYear()}`;
}

/** The peak's month alone where it shares the trough's year, as "Jan–Sep 2022". */
function shortMonth(peak: string, trough: string) {
  const from = new Date(peak);
  return from.getFullYear() === new Date(trough).getFullYear() ? from.toLocaleString("en-GB", { month: "short" }) : monthYear(peak);
}

function monthsBetween(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

/** A return as the switched charts write it: "+4.21%". */
function percent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pct(value: number | null | undefined, sign = true) {
  if (value == null) return "—";
  return `${sign && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function pp(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function num(value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(2);
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  }
}

function signedMoney(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${money(amount, currency)}`;
}

function toneOf(value: number | null | undefined) {
  if (value == null) return undefined;
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}

function monthLabel(day: string) {
  const date = new Date(day);
  return date.getMonth() === 0 ? `Jan ${String(date.getFullYear()).slice(2)}` : date.toLocaleString("en-GB", { month: "short" });
}
