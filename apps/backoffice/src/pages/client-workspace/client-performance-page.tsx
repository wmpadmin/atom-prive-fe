import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPerformance,
  type ClientPerformance,
  type PerformanceGrowth,
  type PerformanceMonth,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";

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

  if (performance.isError) return <Alert tone="danger">{performance.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Measuring the returns…</p>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Performance &amp; Attribution
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Performance &amp; Attribution</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Time- and money-weighted returns, Brinson attribution and risk-adjusted statistics against the IPS policy benchmark
        </p>
      </header>
      {data.bankFile ? <FileClient /> : <Board data={data} />}
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

function Board({ data }: { data: ClientPerformance }) {
  const [weighting, setWeighting] = useState<"twr" | "mwr">("twr");
  const [basis, setBasis] = useState<"net" | "gross">("net");
  return (
    <>
      <Kpis data={data} weighting={weighting} basis={basis} />
      <BenchmarkCard data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <GrowthCard data={data} weighting={weighting} setWeighting={setWeighting} basis={basis} setBasis={setBasis} />
        <Card title="Excess Return Bridge · YTD" lead="Benchmark to portfolio, investable assets">
          <NotMeasured reason={data.brinson.reason} />
        </Card>
      </div>
      <ClassCard data={data} />
      <Card title="Brinson-Fachler Attribution · YTD" lead="Average weights · effects in basis points · investable assets, owned outright excluded">
        <NotMeasured reason={data.brinson.reason} />
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <YearsCard data={data} />
        <RollingCard data={data} />
      </div>
      <MonthlyCard months={data.monthly} asOf={data.asOf} />
      <div className="grid gap-4 xl:grid-cols-2">
        <RiskCard data={data} />
        <FeesCard data={data} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Kpis({ data, weighting, basis }: { data: ClientPerformance; weighting: "twr" | "mwr"; basis: "net" | "gross" }) {
  const k = data.kpis;
  if (!k) return null;
  const ytd = basis === "gross" ? k.ytdGross : k.ytd;
  const window = k.window ?? "3Y";
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
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
    </div>
  );
}

function BenchmarkCard({ data }: { data: ClientPerformance }) {
  const b = data.benchmark;
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
    <Card title="Benchmark" lead="The benchmark on the client's mandate, as recorded · view only">
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
          {(b?.ytdLine.length ?? 0) < 2 ? <Empty>Not enough months this year to draw.</Empty> : (
            <Chart option={option} height={170} label="This year's return, month by month, against the benchmark" />
          )}
        </div>
      </div>
    </Card>
  );
}

function GrowthCard({ data, weighting, setWeighting, basis, setBasis }: {
  data: ClientPerformance;
  weighting: "twr" | "mwr";
  setWeighting: (next: "twr" | "mwr") => void;
  basis: "net" | "gross";
  setBasis: (next: "net" | "gross") => void;
}) {
  const option = useMemo(() => {
    const colours = ink();
    const points = data.growth;
    const portfolio = points.map((one) => (basis === "gross" ? one.portfolioGross : one.portfolio));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      legend: { show: false },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => value?.toFixed(1) },
      xAxis: { type: "category", boundaryGap: false, data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: `Portfolio (${basis})`, data: portfolio, showSymbol: false, lineStyle: { color: colours.text, width: 1.5 },
          itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas } },
        { type: "line", name: "Policy benchmark", data: points.map((one) => one.benchmark), showSymbol: false,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
        { type: "line", name: "IPS objective", data: points.map((one) => one.objective), showSymbol: false,
          lineStyle: { color: colours.muted, type: "dotted", width: 1.5 }, itemStyle: { color: colours.muted } },
      ],
    };
  }, [data.growth, basis]);
  return (
    <Card title="Growth of $100 · Since Inception"
      lead={`${basis === "net" ? "Net" : "Gross"} of fees · inception ${data.kpis?.since ? formatDate(data.kpis.since) : "the first close"}${
        data.kpis?.itdAnnualised && data.kpis.itd != null && data.kpis.itdBenchmark != null
          ? ` · annualised ${data.kpis.itd.toFixed(1)}% vs ${data.kpis.itdBenchmark.toFixed(1)}%` : ""}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Return weighting" value={weighting} onChange={setWeighting} options={[["twr", "TWR"], ["mwr", "MWR"]]} />
          <Toggle label="Fees" value={basis} onChange={setBasis} options={[["net", "Net"], ["gross", "Gross"]]} />
        </div>
      }>
      {data.growth.length < 2 ? <Empty>Not enough history to draw yet.</Empty> : (
        <>
          <Chart option={option} height={260} label="What 100 put in at inception has grown to, against the benchmark and the objective" />
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

const PERIODS = ["MTD", "QTD", "YTD", "1Y", "3Y ann.", "5Y ann.", "ITD ann."];

function ClassCard({ data }: { data: ClientPerformance }) {
  return (
    <Card title="Returns by Asset Class" lead={`Portfolio return with benchmark beneath · time-weighted, net of fees, ${data.currency}`}>
      {data.byClass.length === 0 ? <Empty>Nothing written down to measure yet.</Empty> : (
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
                    {row.name}
                  </th>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{row.value == null ? "—" : money(row.value, data.currency)}</td>
                  {row.figures.map((figure, at) => (
                    <td key={at} className="px-2 py-2 text-right tabular-nums">
                      <span className={cn("block", toneOf(figure))}>{figure == null ? "—" : signed(figure)}</span>
                      <span className="block text-3xs font-normal text-ink-muted">{row.total && row.benchmark[at] != null ? signed(row.benchmark[at] as number) : "—"}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">
        No benchmark is recorded for each asset class, so the line beneath a class is a dash; the total's is the policy benchmark. Class figures count money moved in or out of a class as change.
      </p>
    </Card>
  );
}

function YearsCard({ data }: { data: ClientPerformance }) {
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
        { type: "bar", name: "Portfolio", barMaxWidth: 40, data: data.calendarYears.map((one) => one.portfolio), itemStyle: { color: colours.text } },
        { type: "bar", name: "Policy benchmark", barMaxWidth: 40, data: data.calendarYears.map((one) => one.benchmark), itemStyle: { color: colours.neutral } },
      ],
    };
  }, [data.calendarYears]);
  return (
    <Card title="Calendar-year Returns">
      {data.calendarYears.length === 0 ? <Empty>No full month measured yet.</Empty> : (
        <Chart option={option} height={220} label="Each calendar year's return against the benchmark" />
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">{yearsNote(data)}</p>
    </Card>
  );
}

function RollingCard({ data }: { data: ClientPerformance }) {
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
    <Card title="Rolling 12-month Return" lead="Monthly observations">
      {data.rolling.length === 0 ? <Empty>Needs twelve monthly returns; {data.months} on file.</Empty> : (
        <Chart option={option} height={220} label="Each month's trailing twelve-month return against the benchmark" />
      )}
    </Card>
  );
}

function MonthlyCard({ months, asOf }: { months: PerformanceMonth[]; asOf: string }) {
  const years = [...new Set(months.map((one) => one.month.slice(0, 4)))].sort();
  const byKey = new Map(months.map((one) => [one.month.slice(0, 7), one]));
  const largest = Math.max(0.5, ...months.map((one) => Math.abs(one.value)));
  const yearTotal = (year: string) => {
    const of = months.filter((one) => one.month.startsWith(year));
    return (of.reduce((grown, one) => grown * (1 + one.value / 100), 1) - 1) * 100;
  };
  return (
    <Card title="Monthly Returns" lead={`Net TWR % · ${new Date(asOf).toLocaleString("en-GB", { month: "short", year: "numeric" })} month-to-date`}>
      {months.length === 0 ? <Empty>No month measured yet.</Empty> : (
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
                        {one ? <Heat value={one.value} largest={largest} partial={one.partial} /> : <span className="block h-7 rounded-sm bg-slate-50" />}
                      </td>
                    );
                  })}
                  <td className="py-0.5 pr-5 pl-0.5"><Heat value={yearTotal(year)} largest={Math.max(largest, Math.abs(yearTotal(year)))} partial={false} strong /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-red-600" aria-hidden="true" />Negative</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-slate-100" aria-hidden="true" />Flat</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-emerald-500" aria-hidden="true" />Positive</li>
        <li className="text-3xs italic">A part month is marked with a dot.</li>
      </ul>
    </Card>
  );
}

function Heat({ value, largest, partial, strong }: { value: number; largest: number; partial: boolean; strong?: boolean }) {
  const depth = Math.min(1, Math.abs(value) / largest);
  const tone = value > 0.05 ? (depth > 0.5 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700")
    : value < -0.05 ? (depth > 0.5 ? "bg-red-600 text-white" : "bg-red-50 text-red-700") : "bg-slate-100 text-ink-soft";
  return (
    <span className={cn("block h-7 rounded-sm px-1 text-center leading-7 tabular-nums", tone, strong && "font-bold")}>
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

function FeesCard({ data }: { data: ClientPerformance }) {
  const f = data.fees;
  const largest = Math.max(0.01, ...(f?.byType ?? []).map((one) => one.ytdPercent));
  return (
    <Card title="Fee Impact · YTD" lead="Return drag by fee type">
      {!f ? <Empty>No fees are recorded for this client.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Small label="Gross" value={pct(f.gross)} big />
            <Small label="Total fees" value={`−${f.totalPercent.toFixed(2)}%`} tone="text-red-700" big />
            <Small label="Net" value={pct(f.net)} tone={toneOf(f.net)} big />
          </div>
          <ul className="mt-4 space-y-2">
            {f.byType.map((one) => (
              <li key={one.type} className="grid grid-cols-[170px_minmax(0,1fr)_54px] items-center gap-2 text-sm">
                <span className="truncate" title={`${one.annualBp} bp a year`}>{one.label}</span>
                <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.ytdPercent / largest) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{one.ytdPercent.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Total cost YTD {money(f.totalAmount, data.currency)} · annualised TER {f.annualPercent.toFixed(2)}%
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Card({ title, lead, action, children }: { title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
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

function Kpi({ label, value, note, tone, emphasised }: { label: string; value: string; note: ReactNode; tone?: string; emphasised?: boolean }) {
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
