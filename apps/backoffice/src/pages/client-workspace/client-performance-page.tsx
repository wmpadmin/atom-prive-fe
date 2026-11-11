import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPerformance,
  type ClientPerformance,
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
          Portfolio management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Performance & attribution
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Performance &amp; Attribution</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Time- and money-weighted returns and risk-adjusted statistics against the mandate's benchmark · as at {formatDate(data.asOf)}
        </p>
      </header>
      {data.bankFile ? <FileClient /> : <Board data={data} />}
    </div>
  );
}

function FileClient() {
  const parts = ["Returns (TWR, MWR, annualised)", "Risk-adjusted statistics", "Benchmark", "Growth of $100", "Excess return bridge",
    "Returns by asset class", "Brinson-Fachler attribution", "Calendar-year returns", "Rolling 12-month return", "Monthly returns",
    "Fee impact"];
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-ink-soft">
        The bank's files hold one day of holdings for this client, so no return, statistic or fee can be measured from them.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {parts.map((one) => (
          <li key={one} className="flex items-center justify-between py-2 text-sm">{one}<NotInFile /></li>
        ))}
      </ul>
    </section>
  );
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
      <Card title="Brinson-Fachler Attribution" lead="Allocation, selection and interaction against the benchmark's own classes">
        <NotMeasured reason={data.brinson.reason} />
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <YearsCard data={data} />
        <RollingCard data={data} />
      </div>
      <MonthlyCard months={data.monthly} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <RiskCard data={data} />
        <FeesCard data={data} />
      </div>
      <p className="text-xs text-ink-muted">
        Returns are the desk's own time-weighted returns from each close, net of fees; the benchmark is the mandate's,
        from its recorded figures and month-end levels; fees are this client's recorded fees.
        {data.riskFreePercent != null ? ` Risk-free rate ${data.riskFreePercent}% a year, from Portfolio settings.` : " No risk-free rate is set on Portfolio settings."}
      </p>
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label={`Return · YTD (TWR${basis === "gross" ? ", gross" : ""})`} value={pct(ytd)} tone={toneOf(ytd)}
        note={k.ytdBenchmark == null ? "No benchmark on the mandate" : <>Benchmark {pct(k.ytdBenchmark)}{k.ytdExcess != null && <span className={toneOf(k.ytdExcess)}> · {pp(k.ytdExcess)}</span>}</>} />
      <Kpi label="Money-weighted · YTD" value={pct(k.ytdMoneyWeighted)} tone={toneOf(k.ytdMoneyWeighted)}
        emphasised={weighting === "mwr"}
        note={k.ytdMoneyWeighted == null ? "Nothing to solve over this year" : `IRR incl. timing of ${money(k.netFlowsYtd ?? 0, data.currency)} net flows`} />
      <Kpi label={k.itdAnnualised ? "Annualised · ITD" : "Since inception · ITD"} value={pct(k.itd)} tone={toneOf(k.itd)}
        note={<>{k.itdAnnualised ? null : "Under a year: not annualised · "}{k.itdBenchmark != null && `Mandate benchmark ${pct(k.itdBenchmark)} long-run`}{k.since && ` · since ${formatDate(k.since)}`}</>} />
      <Kpi label={`Sharpe ratio · ${window}`} value={num(k.sharpe)}
        note={k.sharpe == null ? (k.riskWhyNot ?? "—") : <>Benchmark {num(k.sharpeBenchmark)} · Sortino {num(k.sortino)}</>} />
      <Kpi label={`Information ratio · ${window}`} value={num(k.informationRatio)}
        note={k.informationRatio == null ? (k.riskWhyNot ?? "—") : `Tracking error ${pct(k.trackingError, false)}`} />
      <Kpi label="Max drawdown" value={pct(k.maxDrawdown)} tone={k.maxDrawdown != null && k.maxDrawdown < 0 ? "text-red-700" : undefined}
        note={k.drawdownPeak && k.drawdownTrough
          ? `${formatDate(k.drawdownPeak)} – ${formatDate(k.drawdownTrough)} · ${k.recoveredOn ? `recovered ${formatDate(k.recoveredOn)}` : "not yet recovered"}`
          : "No fall on month-end values"} />
      <Kpi label="Up / down capture" value={k.upCapture == null ? "—" : `${k.upCapture.toFixed(0)}% / ${k.downCapture == null ? "—" : `${k.downCapture.toFixed(0)}%`}`}
        note={k.upCapture == null ? (k.riskWhyNot ?? "—") : `vs mandate benchmark, ${window} monthly`} />
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
      xAxis: { type: "category", data: line.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
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
        <dl className="grid gap-4 sm:grid-cols-2">
          <Term label="Mandate" value={b?.mandate ?? "On no model"} />
          <Term label="Benchmark" value={b?.name ?? "None recorded for the mandate"} />
          <Term label="Composition" value={b?.composition ?? "Not recorded"} wide />
          <Term label="Components & weights" value="Not recorded" />
          <Term label="Rebalance" value="Not recorded" />
          <Term label="Effective from" value="Not recorded" />
        </dl>
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
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => value?.toFixed(1) },
      xAxis: { type: "category", data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: `Portfolio (${basis})`, data: portfolio, showSymbol: false, lineStyle: { color: colours.text, width: 1.5 },
          itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas } },
        { type: "line", name: "Mandate benchmark", data: points.map((one) => one.benchmark), showSymbol: false,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
        { type: "line", name: "IPS objective", data: points.map((one) => one.objective), showSymbol: false,
          lineStyle: { color: colours.muted, type: "dotted", width: 1.5 }, itemStyle: { color: colours.muted } },
      ],
    };
  }, [data.growth, basis]);
  return (
    <Card title="Growth of $100 · Since Inception"
      lead={`${basis === "net" ? "Net" : "Gross"} of fees · time-weighted · from ${data.kpis?.since ? formatDate(data.kpis.since) : "the first close"}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Return weighting" value={weighting} onChange={setWeighting} options={[["twr", "TWR"], ["mwr", "MWR"]]} />
          <Toggle label="Fees" value={basis} onChange={setBasis} options={[["net", "Net"], ["gross", "Gross"]]} />
        </div>
      }>
      {data.growth.length < 2 ? <Empty>Not enough history to draw yet.</Empty> : (
        <Chart option={option} height={260} label="What 100 put in at inception has grown to, against the benchmark and the objective" />
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
    <Card title="Returns by Asset Class" lead="Total portfolio: time-weighted, net of fees, benchmark beneath · classes: change in value, flows included">
      {data.byClass.length === 0 ? <Empty>Nothing written down to measure yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Sleeve</th>
                <th scope="col" className="px-2 py-2 text-right">Value</th>
                {PERIODS.map((one) => <th key={one} scope="col" className="px-2 py-2 text-right">{one}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.byClass.map((row) => (
                <tr key={row.key} className={cn(row.total && "bg-slate-50 font-semibold")}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">
                    {row.name}
                    {!row.total && <span className="block text-3xs font-normal text-ink-muted">change in value, flows included</span>}
                  </th>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{row.value == null ? "—" : money(row.value, data.currency)}</td>
                  {row.figures.map((figure, at) => (
                    <td key={at} className="px-2 py-2 text-right tabular-nums">
                      <span className={cn("block", toneOf(figure))}>{figure == null ? "—" : signed(figure)}</span>
                      {row.total && <span className="block text-3xs font-normal text-ink-muted">{row.benchmark[at] == null ? "—" : signed(row.benchmark[at] as number)}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">
        A dash is a period the history does not cover. Class figures count money moved into or out of a class as change: nothing records flows by class.
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
        { type: "bar", name: "Portfolio", data: data.calendarYears.map((one) => one.portfolio), itemStyle: { color: colours.text } },
        { type: "bar", name: "Mandate benchmark", data: data.calendarYears.map((one) => one.benchmark), itemStyle: { color: colours.neutral } },
      ],
    };
  }, [data.calendarYears]);
  return (
    <Card title="Calendar-year Returns">
      {data.calendarYears.length === 0 ? <Empty>No full month measured yet.</Empty> : (
        <Chart option={option} height={220} label="Each calendar year's return against the benchmark" />
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">* Part of the year: from the first close, or to date.</p>
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
      xAxis: { type: "category", data: data.rolling.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Portfolio", data: data.rolling.map((one) => one.portfolio), showSymbol: false, lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
        { type: "line", name: "Mandate benchmark", data: data.rolling.map((one) => one.benchmark), showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } },
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

function MonthlyCard({ months }: { months: PerformanceMonth[] }) {
  const years = [...new Set(months.map((one) => one.month.slice(0, 4)))].sort();
  const byKey = new Map(months.map((one) => [one.month.slice(0, 7), one]));
  const largest = Math.max(0.5, ...months.map((one) => Math.abs(one.value)));
  const yearTotal = (year: string) => {
    const of = months.filter((one) => one.month.startsWith(year));
    return (of.reduce((grown, one) => grown * (1 + one.value / 100), 1) - 1) * 100;
  };
  return (
    <Card title="Monthly Returns" lead="Net time-weighted return each month, %">
      {months.length === 0 ? <Empty>No month measured yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-2xs font-semibold text-ink-muted">
                <th scope="col" className="py-1.5 pr-2 pl-5 text-left">Year</th>
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
      <p className="mt-2 text-3xs text-ink-muted italic">A part month (from the first close, or to date) is marked with a dot.</p>
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
              <li key={one.type} className="grid grid-cols-[1fr_6rem_3.5rem] items-center gap-2 text-sm">
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

function Term({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", value === "Not recorded" && "text-ink-muted")}>{value}</dd>
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
