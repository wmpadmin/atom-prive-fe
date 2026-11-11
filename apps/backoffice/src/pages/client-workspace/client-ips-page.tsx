import { ApiError } from "@atomprive/api-client";
import {
  useGetClientIps,
  type ClientIps,
  type IpsAllocationRow,
  type IpsCheck,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";

/**
 * A client's IPS Monitoring, laid out the way the firm's own design draws it: the policy's terms, a scorecard of its
 * rules, its budgets, the allocation against the model's bands, the sub-classes furthest from policy, a year of
 * deviation, the return objective, every constraint check, and the log of deviations and exceptions.
 *
 * <p>Read only. Every band, status and figure is the server's: the bands are the client's model as the platform
 * enforces it, and nothing here measures a band or a limit again. A client whose figures come only from their bank's
 * files has no policy, model or limit on file, and every part says so.
 */
export function ClientIpsPage() {
  const { customerId = "" } = useParams();
  const ips = useGetClientIps<ClientIps, ApiError>(customerId);
  const data = ips.data;

  if (ips.isError) return <Alert tone="danger">{ips.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the policy…</p>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / IPS Monitoring
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">IPS Monitoring</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Strategic allocation, tolerance bands and constraint compliance against the signed investment policy
        </p>
      </header>
      <Monitoring data={data} />
      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {data.bankFile ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

function Monitoring({ data }: { data: ClientIps }) {
  return (
    <>
      <Summary data={data} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Scorecard data={data} />
        <Budget data={data} />
      </div>
      <AllocationCard data={data} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <SubDeviations data={data} />
        <HistoryCard data={data} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <ObjectiveCard data={data} />
        <ChecksCard data={data} />
      </div>
      <LogCard data={data} />
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Summary({ data }: { data: ClientIps }) {
  const s = data.summary;
  if (data.bankFile) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Investment policy statement</p>
        <div className="mt-2"><NotInFile /></div>
      </section>
    );
  }
  if (!s) {
    return <section className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-muted">No investment policy is recorded for this client.</section>;
  }
  const pct = (value: number | null) => (value == null ? null : `${value}%`);
  return (
    <section className="grid gap-5 rounded-2xl border border-line bg-white p-5 lg:grid-cols-[1.2fr_2fr]">
      <div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Investment policy statement</p>
        <h2 className="mt-1 text-xl font-bold">{s.title}{s.version && ` · ${s.version}`}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {s.signedOn ? `Signed ${formatDate(s.signedOn)}` : "Signing date not recorded"}{s.signedBy && ` by ${s.signedBy}`}.
          {s.scope && ` ${s.scope}.`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.nextReview && <Pill tone="bg-amber-50 text-amber-700">Next review {formatDate(s.nextReview)}</Pill>}
          {s.riskProfile && <Pill tone="bg-slate-100 text-ink-soft">Risk profile {titleCase(s.riskProfile)}</Pill>}
          {s.discretion && <Pill tone="bg-slate-100 text-ink-soft">{titleCase(s.discretion)} · monitored</Pill>}
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Term label="Return objective" value={s.returnObjective} />
        <Term label="Policy benchmark" value={s.benchmark} />
        <Term label="Max drawdown tolerance" value={pct(s.maxDrawdownPercent)} />
        <Term label="Volatility budget" value={s.volatilityBudgetPercent == null ? null : `≤ ${s.volatilityBudgetPercent}% ex-ante`} />
        <Term label="Liquidity" value={s.liquidityTerms} />
        <Term label="Illiquid ceiling" value={s.illiquidCeilingPercent == null ? null : `≤ ${s.illiquidCeilingPercent}% of investable`} />
        <Term label="Income need" value={s.incomeNeed} />
        <Term label="Exclusions" value={s.exclusions} />
      </dl>
    </section>
  );
}

function Term({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? <span className="text-ink-muted">Not recorded</span>}</dd>
    </div>
  );
}

const STATUS: Record<string, [string, string, string]> = {
  COMPLIANT: ["Compliant", "bg-emerald-50 text-emerald-700", "#10b981"],
  WITHIN: ["Within band", "bg-emerald-50 text-emerald-700", "#10b981"],
  NEAR_LIMIT: ["Near limit", "bg-amber-50 text-amber-700", "#f59e0b"],
  NEAR_EDGE: ["Near edge", "bg-amber-50 text-amber-700", "#f59e0b"],
  WARNING: ["Warning", "bg-amber-100 text-amber-800", "#ea580c"],
  DEVIATION: ["Deviation", "bg-red-50 text-red-700", "#dc2626"],
  NOT_MEASURED: ["Not measured", "bg-slate-100 text-ink-muted", "#94a3b8"],
  NOT_SET: ["Not set", "bg-slate-100 text-ink-muted", "#94a3b8"],
};

function Scorecard({ data }: { data: ClientIps }) {
  const s = data.scorecard;
  const rows = useMemo<[string, number][]>(
    () => [["COMPLIANT", s.compliant], ["NEAR_LIMIT", s.nearLimit], ["WARNING", s.warning], ["DEVIATION", s.deviation]],
    [s],
  );
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item" },
      series: [{
        type: "pie", radius: ["68%", "88%"], label: { show: false }, itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: rows.filter(([, count]) => count > 0).map(([key, count]) => ({ name: STATUS[key]![0], value: count, itemStyle: { color: STATUS[key]![2] } })),
      }],
    };
  }, [rows]);
  return (
    <Card title="Compliance Scorecard" lead={data.bankFile ? undefined : `${s.rules} rules monitored${s.notMeasured > 0 ? ` · ${s.notMeasured} could not be measured` : ""}`}>
      {data.bankFile ? <FileBlock /> : (<>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative size-40 shrink-0">
          <Chart option={option} height={160} label="Rules by status" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-xl font-bold tabular-nums">{s.compliant + s.nearLimit}/{s.rules}</p>
              <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Passing</p>
            </div>
          </div>
        </div>
        <ul className="min-w-40 flex-1 divide-y divide-line text-sm">
          {rows.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-xs" style={{ background: STATUS[key]![2] }} aria-hidden="true" />
                {STATUS[key]![0]}
              </span>
              <span className="font-semibold tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 border-t border-line pt-2 text-3xs text-ink-muted">
        Checked {formatDateTime(data.checkedAt)} IST · read live each time this page opens
      </p>
      </>)}
    </Card>
  );
}

function Budget({ data }: { data: ClientIps }) {
  return (
    <Card title="Risk & Liquidity Budget" lead="Utilisation of IPS limits">
      {data.bankFile ? <FileBlock /> : data.gauges.length === 0 ? <Empty>No budget limit is recorded.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.gauges.map((one) => <Gauge key={one.key} check={one} />)}
        </div>
      )}
    </Card>
  );
}

function Gauge({ check }: { check: IpsCheck }) {
  const used = Math.min(100, check.usedPercent ?? 0);
  const colour = STATUS[check.status]?.[2] ?? "#94a3b8";
  const angle = Math.PI * (1 - used / 100);
  const x = 60 + 48 * Math.cos(angle);
  const y = 60 - 48 * Math.sin(angle);
  return (
    <div className="text-center">
      <svg viewBox="0 0 120 70" className="mx-auto w-36" aria-hidden="true">
        <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100" />
        {used > 0 && <path d={`M12 60 A48 48 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={colour} strokeWidth="10" />}
      </svg>
      <p className="-mt-6 text-xl font-bold tabular-nums">{check.current == null ? "—" : `${check.current}%`}</p>
      <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Limit {check.limit}</p>
      <p className="mt-1 text-xs font-semibold">{check.label}</p>
      <p className="text-xs text-ink-muted">{gaugeCaption(check)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function AllocationCard({ data }: { data: ClientIps }) {
  const [expanded, setExpanded] = useState(true);
  const [basis, setBasis] = useState<"investable" | "total">("investable");
  const rows = data.allocation.filter((one) => expanded || one.assetClass);
  const scale = Math.max(10, ...data.allocation.filter((one) => one.assetClass).map((one) => Math.max(one.max ?? 0, one.actual))) * 1.05;
  const classes = data.allocation.filter((one) => one.assetClass).length;
  const total = (data.investable ?? 0) + (data.ownedOutright ?? 0);
  if (data.bankFile) return <FileAllocation data={data} />;
  return (
    <Card title="Strategic Asset Allocation · Target vs Actual"
      lead={`${classes} asset classes · ${data.allocation.length - classes} sub-classes · deviation shown in percentage points and ${data.currency}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Toggle label="Rows shown" value={expanded ? "all" : "classes"} onChange={(next) => setExpanded(next === "all")}
            options={[["all", "Expand all"], ["classes", "Asset classes only"]]} />
          <Toggle label="Measured against" value={basis} onChange={setBasis}
            options={[["investable", "Investable"], ["total", "Total incl. owned outright"]]} />
        </div>
      }>
      {data.allocation.length === 0 ? <Empty>No model to measure against yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
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
              {rows.map((one) => <AllocationLine key={one.key} row={one} basis={basis} scale={scale} currency={data.currency} />)}
              {basis === "total" && (data.ownedOutright ?? 0) > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">Owned outright</th>
                  <td colSpan={3} className="px-2 py-2 text-right text-xs font-normal text-ink-muted">outside the policy's scope</td>
                  <td className="px-2 py-2 text-right tabular-nums">{pct(((data.ownedOutright ?? 0) * 100) / (total || 1))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{compact(data.ownedOutright ?? 0, data.currency)}</td>
                  <td colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-primary-600" aria-hidden="true" />Actual</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-slate-100" aria-hidden="true" />Tolerance band</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" aria-hidden="true" />Target</li>
      </ul>
      <p className="mt-1 text-3xs text-ink-muted">{data.bandRule}</p>
      {basis === "total" && <p className="mt-1 text-3xs text-ink-muted italic">Bands are set on the investable portfolio; against the total, only the actual share is shown.</p>}
    </Card>
  );
}

function AllocationLine({ row, basis, scale, currency }: { row: IpsAllocationRow; basis: "investable" | "total"; scale: number; currency: string }) {
  const investable = basis === "investable";
  const actual = investable ? row.actual : row.actualOfTotal;
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const tone = row.status === "DEVIATION" ? "bg-red-600" : row.status === "NEAR_EDGE" ? "bg-amber-500" : "bg-primary-600";
  return (
    <tr className={cn(row.assetClass && "bg-slate-50 font-semibold")}>
      <th scope="row" className={cn("py-2 pr-3 text-left", row.assetClass ? "pl-5" : "pl-9 font-normal")}>{row.name}</th>
      <td className="px-2 py-2 text-right tabular-nums">{investable ? pct(row.min) : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{investable ? pct(row.target) : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{investable ? pct(row.max) : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{pct(actual)}</td>
      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{compact(row.value, currency)}</td>
      <td className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums", row.status === "DEVIATION" && "text-red-700")}>
        {investable && row.deviationPoints != null ? `${row.deviationPoints > 0 ? "+" : ""}${row.deviationPoints.toFixed(2)} pp` : "—"}
      </td>
      <td className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums", toneOf(row.deviationValue ?? 0))}>
        {investable && row.deviationValue != null ? signedCompact(row.deviationValue, currency) : "—"}
      </td>
      <td className="px-2 py-2">
        {investable && row.min != null && row.max != null && row.target != null ? (
          <span className="relative block h-3" aria-hidden="true" title={`${STATUS[row.status]?.[0] ?? row.status} · band ${pct(row.min)} – ${pct(row.max)}`}>
            <span className="absolute top-0 h-3 rounded-sm bg-slate-100" style={{ left: at(row.min), width: `calc(${at(row.max)} - ${at(row.min)})` }} />
            <span className={cn("absolute top-1 left-0 h-1 rounded-full", tone)} style={{ width: at(actual) }} />
            <span className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: at(row.target) }} />
          </span>
        ) : <span className="text-xs text-ink-muted">{investable ? "Not set by the model" : ""}</span>}
      </td>
      <td className="py-2 pr-5 pl-2 whitespace-nowrap">
        {row.status === "NOT_SET" ? <span className="text-xs text-ink-muted">—</span>
          : <span className={cn("text-xs font-semibold", row.status === "DEVIATION" ? "text-red-700" : row.status === "NEAR_EDGE" ? "text-amber-700" : "text-emerald-700")}>{STATUS[row.status]?.[0] ?? row.status}</span>}
      </td>
    </tr>
  );
}

function SubDeviations({ data }: { data: ClientIps }) {
  const largest = Math.max(0.01, ...data.subDeviations.map((one) => Math.abs(one.deviationPoints)));
  return (
    <Card title="Sub-class Deviations" lead="Where the portfolio sits furthest from policy">
      {data.bankFile ? <FileBlock /> : data.subDeviations.length === 0 ? <Empty>The model sets no sub-class targets for this client.</Empty> : (
        <ul className="space-y-1">
          {data.subDeviations.map((one, at) => (
            <li key={`${one.name}-${at}`} className="grid grid-cols-[1fr_8rem_3.5rem] items-center gap-2 text-xs">
              <span className="truncate" title={`${one.assetClass} · ${one.name}`}>{one.name}</span>
              <span className="relative block h-2" aria-hidden="true">
                <span className="absolute top-0 left-1/2 h-2 w-px bg-line" />
                <span className={cn("absolute top-0 h-2", one.deviationPoints >= 0 ? "left-1/2 rounded-r-sm bg-primary-600" : "right-1/2 rounded-l-sm bg-red-600")}
                  style={{ width: `${(Math.abs(one.deviationPoints) / largest) * 50}%` }} />
              </span>
              <span className={cn("text-right tabular-nums", toneOf(one.deviationPoints))}>
                {one.deviationPoints > 0 ? "+" : ""}{one.deviationPoints.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!data.bankFile && <p className="mt-2 text-3xs text-ink-muted italic">Percentage points vs target, sorted · overweights right, underweights left</p>}
    </Card>
  );
}

function HistoryCard({ data }: { data: ClientIps }) {
  const series = data.history;
  const option = useMemo(() => {
    const colours = ink();
    const days = [...new Set(series.flatMap((one) => one.points.map((point) => point.on)))].sort();
    const equity = series.find((one) => one.assetClass === "EQUITIES") ?? series[0];
    const band = equity?.band ?? 0;
    const flagged = days.filter((day) => series.some((one) => one.points.some((point) => point.on === day && point.outside)));
    const marked = flagged[flagged.length - 1];
    // Symmetric about the target, wide enough for the furthest class and the band, so no line is pressed flat.
    const furthest = Math.max(band, ...series.flatMap((one) => one.points.map((point) => Math.abs(point.deviation))));
    const edge = Math.max(2, Math.ceil((furthest * 1.15) / 2) * 2);
    const bandName = band > 0 && equity ? `${equity.name} band ±${band} pp` : null;
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 16, bottom: 36, containLabel: true },
      legend: { bottom: 0, data: [...series.map((one) => one.name), ...(bandName ? [bandName] : [])], textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => (value == null ? "—" : `${value.toFixed(2)} pp`) },
      xAxis: { type: "category", data: days, axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", min: -edge, max: edge, splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => `${value > 0 ? "+" : ""}${value}` },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        ...series.map((one, at) => {
          const byDay = new Map(one.points.map((point) => [point.on, point.deviation]));
          return { type: "line", name: one.name, data: days.map((day) => byDay.get(day) ?? null), showSymbol: true, symbolSize: 4,
            lineStyle: { color: INK[at % INK.length], width: 2 }, itemStyle: { color: INK[at % INK.length] } };
        }),
        ...(band > 0 && equity ? [
          { type: "line", name: bandName, data: days.map(() => band), showSymbol: false,
            lineStyle: { color: colours.danger, type: "dashed", width: 1 }, itemStyle: { color: colours.danger },
            ...(marked ? { markLine: { symbol: "none", silent: true, lineStyle: { color: colours.danger, type: "solid", width: 1 },
              label: { formatter: `${monthLabel(marked)} deviation`, color: colours.danger, fontSize: 10 }, data: [{ xAxis: marked }] } } : {}) },
          { type: "line", name: "", data: days.map(() => -band), showSymbol: false,
            lineStyle: { color: colours.danger, type: "dashed", width: 1 }, itemStyle: { color: colours.danger } },
        ] : []),
      ],
    };
  }, [series]);
  const hasPoints = series.some((one) => one.points.length > 1);
  return (
    <Card title="Deviation from Target · 12 Months" lead="Percentage points vs strategic target · month-end">
      {data.bankFile ? <FileBlock /> : !hasPoints ? <Empty>Not enough month-end valuations to draw yet.</Empty> : (
        <Chart option={option} height={260} label="Each class's distance from target at each month end" />
      )}
    </Card>
  );
}

function ObjectiveCard({ data }: { data: ClientIps }) {
  const o = data.objective;
  const option = useMemo(() => {
    const colours = ink();
    const points = o?.rolling ?? [];
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value.toFixed(1)}%` },
      xAxis: { type: "category", data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => quarterLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: `Rolling ${o?.rollingWindow ?? "5Y"} annualised return`, data: points.map((one) => one.annualised), showSymbol: false,
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
        ...(o?.objectivePercent == null ? [] : [{ type: "line", name: `${o.objective ?? "Policy"} objective`, data: points.map(() => o.objectivePercent),
          showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } }]),
      ],
    };
  }, [o]);
  return (
    <Card title="Objective Tracking">
      {data.bankFile ? <FileBlock /> : !o ? <Empty>No objective is recorded.</Empty> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {o.rollingWindow == null || o.rollingWindow === "5Y" ? "5Y" : "Since inception"} ann. return
              </p>
              <p className="text-2xl font-bold tabular-nums">{o.windowAnnualised == null ? "—" : `${o.windowAnnualised}%`}</p>
              {o.rollingWindow && o.rollingWindow !== "5Y" && <p className="text-xs text-ink-muted">{o.rollingWindow}</p>}
            </div>
            <div>
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Objective{o.objective && ` ${o.objective}`}</p>
              <p className="text-2xl font-bold tabular-nums">{o.objectivePercent == null ? "—" : `${o.objectivePercent}%`}</p>
            </div>
          </div>
          <div>
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Status</p>
            {o.windowAnnualised == null || o.margin == null ? (
              <p className="mt-1 text-sm">
                <Pill tone="bg-slate-100 text-ink-soft">Not enough history</Pill>
                <span className="ml-2 text-xs text-ink-muted">{o.firstClose ? `Measured since ${formatDate(o.firstClose)}; twelve months are needed.` : "No valuation history yet."}</span>
              </p>
            ) : (
              <Pill tone={(o.margin ?? 0) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                {(o.margin ?? 0) >= 0 ? "On track" : "Behind"} · {(o.margin ?? 0) > 0 ? "+" : ""}{o.margin} pp
              </Pill>
            )}
          </div>
          {o.rolling.length < 2 ? (
            <Empty>{o.rollingWindow == null ? "Not measured: fewer than twelve monthly returns on file." : "Not enough quarter ends to draw yet."}</Empty>
          ) : (
            <Chart option={option} height={180} label="Rolling annualised return at each quarter end, against the policy's objective" />
          )}
        </div>
      )}
    </Card>
  );
}

function ChecksCard({ data }: { data: ClientIps }) {
  const [only, setOnly] = useState<"all" | "exceptions">("all");
  const shown = data.checks.filter((one) => only === "all" || ["NEAR_LIMIT", "WARNING", "DEVIATION"].includes(one.status));
  return (
    <Card title="Constraint Checks" lead={`${shown.length} of ${data.checks.length} rules shown`}
      action={<Toggle label="Rules shown" value={only} onChange={setOnly} options={[["all", "All"], ["exceptions", "Exceptions"]]} />}>
      {data.bankFile ? <FileBlock /> : shown.length === 0 ? <Empty>{data.checks.length === 0 ? "No constraint is recorded in the policy." : "Every rule is compliant."}</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Rule</th>
                <th scope="col" className="px-2 py-2">Limit</th>
                <th scope="col" className="px-2 py-2 text-right">Current</th>
                <th scope="col" className="px-2 py-2">Utilisation</th>
                <th scope="col" className="px-2 py-2">Status</th>
                <th scope="col" className="py-2 pr-5 pl-2">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((one) => (
                <tr key={one.key} className="align-top">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-normal">
                    {one.label}
                    {one.note && <span className="block text-3xs text-ink-muted">{one.note}</span>}
                  </th>
                  <td className="px-2 py-2 whitespace-nowrap">{one.limit}</td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                    {one.currentText ?? (one.current == null ? "—" : one.key === "EXCLUSIONS" ? `${one.current} holdings` : `${one.current}%`)}
                  </td>
                  <td className="px-2 py-2">
                    {one.usedPercent == null ? <span className="text-xs text-ink-muted">—</span> : (
                      <span className="flex items-center gap-2">
                        <span className="block h-1.5 w-20 rounded-full bg-slate-100" aria-hidden="true">
                          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, one.usedPercent)}%`, background: STATUS[one.status]?.[2] }} />
                        </span>
                        <span className="text-xs tabular-nums">{one.usedPercent}%</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2"><Pill tone={STATUS[one.status]?.[1] ?? ""}>{STATUS[one.status]?.[0] ?? one.status}</Pill></td>
                  <td className="py-2 pr-5 pl-2 text-xs whitespace-nowrap text-ink-muted">
                    {one.measuredOn ? formatDate(one.measuredOn) : formatDateTime(data.checkedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LogCard({ data }: { data: ClientIps }) {
  const tone = (status: string) => (status === "OPEN" ? "bg-red-50 text-red-700" : status === "WAIVED" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700");
  return (
    <Card title="Deviation & Exception Log" lead="Last 12 months · audit trail">
      {data.bankFile ? <FileBlock /> : data.log.length === 0 ? <Empty>Nothing recorded in the last twelve months.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Date</th>
                <th scope="col" className="px-2 py-2">Rule</th>
                <th scope="col" className="px-2 py-2">Observed</th>
                <th scope="col" className="px-2 py-2">Status</th>
                <th scope="col" className="px-2 py-2">Resolution</th>
                <th scope="col" className="py-2 pr-5 pl-2">Approved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.log.map((one, at) => (
                <tr key={`${one.on}-${at}`} className="align-top">
                  <td className="py-2 pr-3 pl-5 whitespace-nowrap text-ink-muted">{formatDate(one.on)}</td>
                  <td className="px-2 py-2">{one.rule}</td>
                  <td className="px-2 py-2">{one.observed}</td>
                  <td className="px-2 py-2"><Pill tone={tone(one.status)}>{titleCase(one.status)}</Pill></td>
                  <td className="px-2 py-2 text-ink-soft">{one.resolution ?? "—"}</td>
                  <td className="py-2 pr-5 pl-2 text-ink-soft">{one.approvedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** His bank's lines, by the bank's own class within each currency, with the value as sent and nothing else. */
function FileAllocation({ data }: { data: ClientIps }) {
  return (
    <Card title="Strategic Asset Allocation · Target vs Actual" lead="His lines by the bank's own class within each currency, as the bank's files state them">
      {data.fileLines.length === 0 ? <FileBlock /> : (
        <div className="-mx-5 overflow-x-auto">
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
                <th scope="col" className="px-2 py-2">Position in band</th>
                <th scope="col" className="py-2 pr-5 pl-2">Status</th>
              </tr>
            </thead>
            {data.fileLines.map((group) => (
              <tbody key={`${group.currency}-${group.assetClass}`} className="divide-y divide-line">
                <tr className="bg-slate-50 font-semibold">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">{group.assetClass} · {group.currency}</th>
                  <td colSpan={4} className="px-2 py-2 text-right"><NotInFile /></td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{exact(group.total, group.currency)}</td>
                  <td colSpan={3} className="py-2 pr-5 pl-2"><NotInFile /></td>
                </tr>
                {group.lines.map((one, at) => (
                  <tr key={`${one.name}-${at}`}>
                    <th scope="row" className="py-2 pr-3 pl-9 text-left font-normal">{one.name}</th>
                    <td className="px-2 py-2 text-right"><NotInFile /></td>
                    <td className="px-2 py-2 text-right"><NotInFile /></td>
                    <td className="px-2 py-2 text-right"><NotInFile /></td>
                    <td className="px-2 py-2 text-right"><NotInFile /></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{exact(one.value, group.currency)}</td>
                    <td className="px-2 py-2 text-right"><NotInFile /></td>
                    <td className="px-2 py-2"><NotInFile /></td>
                    <td className="py-2 pr-5 pl-2"><NotInFile /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </Card>
  );
}

/** A card his bank's files hold nothing for: it stays in its place and says so. */
function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

/** The design's gauge captions: the share of a budget or a ceiling, and the status once it is near the limit. */
function gaugeCaption(check: IpsCheck) {
  if (check.usedPercent == null) return check.note ?? "Not measured";
  if (check.status !== "COMPLIANT") return STATUS[check.status]?.[0] ?? check.status;
  return `${check.usedPercent}% of ${check.key === "EX_ANTE_VOLATILITY" ? "budget" : "ceiling"}`;
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

function quarterLabel(day: string) {
  const date = new Date(day);
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${String(date.getFullYear()).slice(2)}`;
}

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

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("inline-block rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{children}</span>;
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

function pct(value: number | null | undefined) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  }
}

function signedCompact(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${compact(amount, currency)}`;
}

function toneOf(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}

function titleCase(text: string) {
  return text.toLowerCase().replace(/_/g, " ").replace(/^\w/, (first) => first.toUpperCase());
}

function monthLabel(day: string) {
  const date = new Date(day);
  return date.getMonth() === 0 ? `Jan ${String(date.getFullYear()).slice(2)}` : date.toLocaleString("en-GB", { month: "short" });
}
