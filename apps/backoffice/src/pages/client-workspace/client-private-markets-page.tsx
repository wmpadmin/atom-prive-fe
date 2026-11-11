import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspacePrivateMarkets,
  type ClientPrivateMarkets,
  type IpsAllocationRow,
  type PmFund,
  type PmHedgeFund,
  type PmKpi,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ScatterChart } from "echarts/charts";
import { MarkLineComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";

echarts.use([ScatterChart, MarkLineComponent, LabelLayout]);

const CALLS = "#b4232a";

/**
 * A client's Private Markets & Alternatives, laid out section by section as the firm's 10 Nov design draws it. Every
 * figure — paid-in, distributions and NAV, the multiples and IRRs, the public-market equivalents, the J-curve, pacing
 * ahead and the hedge funds' figures — is worked out on the server and shown here as it comes. The fund cash flows,
 * NAVs, hedge fund series and the index are demo figures and pacing is a model estimate, which the page says. A client
 * whose figures come only from their bank's files holds no private funds in them, so every card is not in bank file.
 * Read only.
 */
export function ClientPrivateMarketsPage() {
  const { customerId = "" } = useParams();
  const pm = useGetClientWorkspacePrivateMarkets<ClientPrivateMarkets, ApiError>(customerId);
  const data = pm.data;

  if (pm.isError) return <Alert tone="danger">{pm.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the private markets program…</p>;
  const file = data.bankFile;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Private Markets
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Private Markets &amp; Alternatives</h1>
        <p className="mt-1 text-sm text-ink-muted">Commitments, cash flows and performance across private equity, venture, credit, infrastructure and hedge funds</p>
      </header>

      <Kpis data={data} />
      <Multiples data={data} />
      <Segments data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <JCurveCard data={data} />
        <DiversificationCard data={data} />
      </div>
      <FundsCard data={data} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ScorecardCard data={data} />
        <PacingCard data={data} />
      </div>
      <NoticesCard data={data} />
      <HedgeFundsCard data={data} />

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {file ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {day(data.asOf)} close.
          {!file && data.note && ` ${data.note}`}
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const KPI_LABELS = ["Commitments", "Paid-in capital", "Distributions", "Net asset value", "Unfunded", "Net IRR"];

function Kpis({ data }: { data: ClientPrivateMarkets }) {
  const kpis: (PmKpi | null)[] = data.bankFile ? KPI_LABELS.map(() => null) : data.kpis;
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      {kpis.map((one, at) => (
        <div key={one?.key ?? KPI_LABELS[at]} className="rounded-2xl border border-line bg-white px-4 py-3.5">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one?.label ?? KPI_LABELS[at]}</p>
          {!one ? <div className="mt-2"><NotInFile /></div> : (
            <>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">{kpiValue(one, data.currency)}</p>
              {one.detail && (
                <p className="mt-1 text-xs text-ink-muted">
                  {one.detail}
                  {one.extra && <> <span className={cn("font-semibold", one.extraTone === "UP" ? "text-emerald-700" : "text-red-700")}>{one.extra}</span></>}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const MULTIPLE_LABELS = ["TVPI", "DPI", "RVPI", "MOIC · gross", "Fee drag"];

function Multiples({ data }: { data: ClientPrivateMarkets }) {
  const rows: (PmKpi | null)[] = data.bankFile || data.multiples.length === 0 ? MULTIPLE_LABELS.map(() => null) : data.multiples;
  return (
    <div className="grid gap-x-6 gap-y-4 rounded-2xl border border-line bg-white px-5 py-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
      {rows.map((one, at) => (
        <div key={one?.key ?? MULTIPLE_LABELS[at]}>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one?.label ?? MULTIPLE_LABELS[at]}</p>
          {!one ? <div className="mt-2"><NotInFile /></div> : (
            <>
              <p className="mt-1 text-[1.75rem] leading-tight font-bold tabular-nums">{kpiValue(one, data.currency)}</p>
              <span className="mt-1.5 block h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-1.5 rounded-full bg-ink" style={{ width: `${one.bar ?? 0}%` }} />
              </span>
              {one.detail && <p className="mt-1.5 text-xs text-ink-muted">{one.detail}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Segments({ data }: { data: ClientPrivateMarkets }) {
  const rows = data.segments;
  const scale = Math.max(10, ...rows.map((one) => Math.max(one.max ?? 0, one.actual))) * 1.05;
  return (
    <Card title="Alternative Segments · Target vs Actual" lead={data.bankFile ? undefined : data.segmentsNote ?? undefined} flush
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
                  {["Min", "Target", "Max", "Actual", "Value", "Deviation", `Deviation ${symbolOf(data.currency)}`].map((one) => (
                    <th key={one} scope="col" className="px-2 py-2 text-right">{one}</th>
                  ))}
                  <th scope="col" className="w-48 py-2 pr-5 pl-2">Position in band</th>
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

function SegmentLine({ row, scale, currency }: { row: IpsAllocationRow; scale: number; currency: string }) {
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
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
      <td className="py-2 pr-5 pl-2">
        {row.min != null && row.max != null && row.target != null ? (
          <span className="relative block h-3" aria-hidden="true">
            <span className="absolute top-0 h-3 rounded-sm bg-slate-100" style={{ left: at(row.min), width: `calc(${at(row.max)} - ${at(row.min)})` }} />
            <span className="absolute top-1 left-0 h-1 rounded-full bg-primary-600" style={{ width: at(row.actual) }} />
            <span className="absolute -top-0.5 h-4 w-0.5 bg-red-600" style={{ left: at(row.target) }} />
          </span>
        ) : null}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function JCurveCard({ data }: { data: ClientPrivateMarkets }) {
  const bars = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.years.map((one) => one.year), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: "Distributions", stack: "flow", barMaxWidth: 28, data: data.years.map((one) => one.distributions), itemStyle: { color: colours.text } },
        { type: "bar", name: "Capital calls", stack: "flow", barMaxWidth: 28, data: data.years.map((one) => one.calls), itemStyle: { color: CALLS } },
      ],
    };
  }, [data.years, data.currency]);
  const lines = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", boundaryGap: false, data: data.years.map((one) => one.year), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: `Cumulative net cash flow · ${data.cumulativeNet == null ? "—" : compact(data.cumulativeNet, data.currency)}`,
          data: data.years.map((one) => one.cumulativeNet), symbol: "circle", symbolSize: 5, lineStyle: { color: CALLS, width: 1.5 }, itemStyle: { color: CALLS } },
        { type: "line", name: `Net cash flow + NAV (value created) · ${data.valueCreated == null ? "—" : compact(data.valueCreated, data.currency)}`,
          data: data.years.map((one) => one.valueCreated), symbol: "circle", symbolSize: 5, areaStyle: { color: colours.canvas, opacity: 0.6 },
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } },
      ],
    };
  }, [data.years, data.currency, data.cumulativeNet, data.valueCreated]);
  return (
    <Card title="J-Curve & Cash-flow History" lead={data.bankFile ? undefined : `Program level · ${data.currency} · calls shown below zero`}>
      {data.bankFile ? <FileBlock /> : data.years.length === 0 ? <Empty>No calls or distributions on file.</Empty> : (
        <>
          <Chart option={bars} height={230} label="Capital calls and distributions by year" />
          <p className="mt-4 text-3xs font-semibold tracking-wider text-ink-muted uppercase">Cumulative position</p>
          <Chart option={lines} height={220} label="Cumulative net cash flow and value created by year" />
        </>
      )}
    </Card>
  );
}

function DiversificationCard({ data }: { data: ClientPrivateMarkets }) {
  const donut = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, data.currency) },
      series: [{ type: "pie", radius: ["62%", "86%"], label: { show: false }, itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: data.strategies.map((one, at) => ({ name: one.label, value: one.value, itemStyle: { color: INK[at % INK.length] } })) }],
    };
  }, [data.strategies, data.currency]);
  const vintages = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 18, bottom: 4, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.vintages.map((one) => one.label), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [{ type: "bar", name: "Committed", barMaxWidth: 26, data: data.vintages.map((one) => one.value), itemStyle: { color: INK[0] },
        label: { show: true, position: "top", color: colours.muted, fontSize: 9, formatter: (p: { value: number }) => compact(p.value, data.currency) } }],
    };
  }, [data.vintages, data.currency]);
  return (
    <Card title="Diversification" lead={data.bankFile ? undefined : "Strategy by NAV · vintage by commitment"}>
      {data.bankFile ? <FileBlock /> : data.strategies.length === 0 ? <Empty>No funds held.</Empty> : (
        <>
          <div className="relative mx-auto w-full max-w-48">
            <Chart option={donut} height={180} label="NAV by strategy" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{data.nav == null ? "—" : compact(data.nav, data.currency)}</p>
                <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">NAV</p>
              </div>
            </div>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {data.strategies.map((one, at) => (
                <tr key={one.key}>
                  <td className="py-1.5"><span className="flex items-center gap-2"><span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />{one.label}</span></td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{compact(one.value, data.currency)}</td>
                  <td className="w-14 py-1.5 text-right text-ink-muted tabular-nums">{one.percent == null ? "—" : `${one.percent.toFixed(0)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-3xs font-semibold tracking-wider text-ink-muted uppercase">Commitments by vintage</p>
          <Chart option={vintages} height={170} label="Commitments by vintage year" />
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const TABS: [string, string][] = [["PE_CREDIT", "Private equity & credit"], ["REAL_ESTATE", "Real estate funds"], ["ALL", "All"]];

function FundsCard({ data }: { data: ClientPrivateMarkets }) {
  const [tab, setTab] = useState("PE_CREDIT");
  const rows = data.funds.filter((one) => tab === "ALL" || one.tab === tab);
  const total = data.totals.find((one) => one.tab === tab);
  return (
    <Card title="Fund Commitments" flush
      lead={data.bankFile ? undefined : "Quartile not measured: no Cambridge Associates vintage benchmarks on file · IRR not meaningful (n.m.) under 3 years"}
      action={!data.bankFile && (
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold" role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn("rounded-md px-2.5 py-1", tab === key ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      )}>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : rows.length === 0 ? <Empty>No funds in this group.</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-y border-line text-left text-3xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-2 pl-5">Fund</th>
                  <th scope="col" className="px-1.5 py-2">Strategy</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Vintage</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Commitment</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Paid-in</th>
                  <th scope="col" className="px-1.5 py-2">% called</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Distributed</th>
                  <th scope="col" className="px-1.5 py-2 text-right">NAV</th>
                  <th scope="col" className="px-1.5 py-2 text-right">NAV date</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Unfunded</th>
                  <th scope="col" className="px-1.5 py-2 text-right">TVPI</th>
                  <th scope="col" className="px-1.5 py-2 text-right">DPI</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Net IRR</th>
                  <th scope="col" className="py-2 pr-5 pl-1.5 text-right">Quartile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((one) => <FundLine key={one.name} row={one} currency={data.currency} />)}
                {total && <FundLine row={total} currency={data.currency} />}
              </tbody>
            </table>
          </div>
          {data.unattributedNote && <p className="mt-3 px-5 text-xs text-ink-muted">{data.unattributedNote}.</p>}
        </>
      )}
    </Card>
  );
}

function FundLine({ row, currency }: { row: PmFund; currency: string }) {
  const money = (value: number) => compact(value, currency);
  return (
    <tr className={cn(row.total && "bg-slate-50 font-semibold")}>
      <th scope="row" className="py-2 pr-2 pl-5 text-left font-semibold">
        <span className="block whitespace-nowrap">{row.name}</span>
        {row.administrator && <span className="block text-3xs font-normal text-ink-muted">Admin: {row.administrator}</span>}
      </th>
      <td className="px-1.5 py-2 whitespace-nowrap">{row.strategy}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{row.vintage ?? ""}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{money(row.committed)}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{money(row.paidIn)}</td>
      <td className="px-1.5 py-2">
        {row.calledPercent != null && (
          <span className="flex items-center gap-1.5">
            {!row.total && (
              <span className="block h-1.5 w-12 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.min(100, row.calledPercent)}%` }} />
              </span>
            )}
            <span className="tabular-nums">{row.calledPercent.toFixed(0)}%</span>
          </span>
        )}
      </td>
      <td className="px-1.5 py-2 text-right tabular-nums">{money(row.distributed)}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{money(row.nav)}</td>
      <td className={cn("px-1.5 py-2 text-right whitespace-nowrap tabular-nums", row.stale && "font-semibold text-amber-700")}
        title={row.stale ? "Older than the latest quarter end" : undefined}>
        {row.total ? "" : day(row.navDate)}
      </td>
      <td className="px-1.5 py-2 text-right tabular-nums">{money(row.unfunded)}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{row.tvpi == null ? "—" : `${row.tvpi.toFixed(2)}×`}</td>
      <td className="px-1.5 py-2 text-right tabular-nums">{row.dpi == null ? "—" : `${row.dpi.toFixed(2)}×`}</td>
      <td className={cn("px-1.5 py-2 text-right whitespace-nowrap tabular-nums", toneOf(row.irr))}>
        {row.irr != null ? `${row.irr > 0 ? "+" : ""}${row.irr.toFixed(1)}%` : <span className="text-ink-muted">{row.irrText ?? "—"}</span>}
      </td>
      <td className="py-2 pr-5 pl-1.5 text-right text-ink-muted">{row.total ? "" : row.quartile ?? "—"}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function ScorecardCard({ data }: { data: ClientPrivateMarkets }) {
  const option = useMemo(() => {
    const colours = ink();
    const largest = Math.max(1, ...data.scorecard.map((one) => one.committed));
    const point = (above: boolean) => data.scorecard.filter((one) => one.abovePme === above).map((one) => ({
      name: one.name, value: [one.irr, one.tvpi], symbolSize: 10 + 18 * Math.sqrt(one.committed / largest),
    }));
    const labelLayout = { moveOverlap: "shiftY", hideOverlap: true };
    const label = { show: true, position: "right", color: colours.text, fontSize: 10, formatter: (p: { name: string }) => p.name };
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 24, top: 24, bottom: 36, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "item", formatter: (p: { name: string; value: [number, number] }) => `${p.name}<br/>Net IRR ${p.value[0].toFixed(1)}% · TVPI ${p.value[1].toFixed(2)}×` },
      xAxis: { type: "value", name: "Net IRR", nameLocation: "middle", nameGap: 24, nameTextStyle: { color: colours.muted, fontSize: 10 },
        axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: colours.line } } },
      yAxis: { type: "value", scale: true, axisLabel: { color: colours.muted, formatter: (value: number) => `${value.toFixed(1)}×` },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "scatter", name: "Above public-market equivalent", data: point(true), itemStyle: { color: colours.text, opacity: 0.85 }, label, labelLayout,
          markLine: data.scorecardPme == null ? undefined : { symbol: "none", silent: true, lineStyle: { color: CALLS, type: "dashed" },
            label: { formatter: `PME ${data.scorecardPme.toFixed(1)}%`, color: CALLS, fontSize: 10 }, data: [{ xAxis: data.scorecardPme }] } },
        { type: "scatter", name: "Below PME", data: point(false), itemStyle: { color: CALLS, opacity: 0.85 }, label, labelLayout },
      ],
    };
  }, [data.scorecard, data.scorecardPme]);
  return (
    <Card title="Manager Scorecard" lead={data.bankFile ? undefined : "TVPI vs net IRR · bubble = commitment · each fund against its own MSCI ACWI PME"}>
      {data.bankFile ? <FileBlock /> : data.scorecard.length === 0 ? <Empty>No fund has a meaningful IRR yet: under 3 years since vintage or under a year of own flows.</Empty> : (
        <>
          <Chart option={option} height={300} label="Each fund's TVPI against its net IRR" />
          {data.scorecardNote && <p className="mt-2 text-xs text-ink-muted">{data.scorecardNote}.</p>}
        </>
      )}
    </Card>
  );
}

function PacingCard({ data }: { data: ClientPrivateMarkets }) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 32, containLabel: true },
      legend: { bottom: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.pacing.map((one) => one.label), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "bar", name: `Projected distributions · ${compact(data.pacingDistributions ?? 0, data.currency)}`, stack: "pace", barMaxWidth: 28,
          data: data.pacing.map((one) => one.distributions), itemStyle: { color: colours.text } },
        { type: "bar", name: `Projected calls · ${compact(Math.abs(data.pacingCalls ?? 0), data.currency)}`, stack: "pace", barMaxWidth: 28,
          data: data.pacing.map((one) => one.calls), itemStyle: { color: CALLS } },
      ],
    };
  }, [data.pacing, data.currency, data.pacingDistributions, data.pacingCalls]);
  return (
    <Card title="Pacing Forecast · 8 Quarters" lead={data.bankFile ? undefined : "Expected cash flows on existing commitments"}>
      {data.bankFile ? <FileBlock /> : data.pacing.length === 0 ? <Empty>No commitments to pace.</Empty> : (
        <>
          <Chart option={option} height={280} label="Projected calls and distributions by quarter" />
          <p className="mt-2 text-xs text-ink-muted">
            Takahashi-Alexander model · base case.{" "}
            {data.positiveFrom ? <>Program turns net cash-flow positive from <strong className="text-ink">{data.positiveFrom}</strong>.</>
              : "Program stays net cash-flow negative over the eight quarters."}
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const NOTICE_TONE: Record<string, string> = {
  Received: "bg-amber-50 text-amber-800",
  Expected: "bg-slate-100 text-ink-soft",
  Funded: "bg-primary-50 text-primary-700",
  Settled: "bg-emerald-50 text-emerald-700",
};

function NoticesCard({ data }: { data: ClientPrivateMarkets }) {
  return (
    <Card title="Notices & Cash Events" lead={data.bankFile ? undefined : "From the capital calls and distributions on file"} flush>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : data.notices.length === 0 ? <Empty>No calls or distributions from 60 days back to 90 days ahead.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Fund</th>
                <th scope="col" className="px-2 py-2">Type</th>
                <th scope="col" className="px-2 py-2">Due / paid</th>
                <th scope="col" className="px-2 py-2 text-right">Amount</th>
                <th scope="col" className="py-2 pr-5 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.notices.map((one, at) => (
                <tr key={`${one.fund}-${one.on}-${at}`}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-semibold">{one.fund}</th>
                  <td className="px-2 py-2">
                    {one.kind === "CAPITAL_CALL" ? <Pill tone="bg-red-50 text-red-700">Capital call</Pill> : <Pill tone="bg-emerald-50 text-emerald-700">Distribution</Pill>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap tabular-nums">{day(one.on)}</td>
                  <td className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums", toneOf(one.amount))}>
                    {one.amount > 0 ? "+" : ""}{compact(one.amount, data.currency)}
                  </td>
                  <td className="py-2 pr-5 pl-4"><Pill tone={NOTICE_TONE[one.status] ?? "bg-slate-100 text-ink-soft"}>{one.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HedgeFundsCard({ data }: { data: ClientPrivateMarkets }) {
  return (
    <Card title="Hedge Funds" lead={data.bankFile ? undefined : data.hedgeNote ?? undefined} flush>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : data.hedgeFunds.length === 0 ? <Empty>No hedge funds in the client's alternatives lines.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Fund</th>
                <th scope="col" className="px-2 py-2">Strategy</th>
                <th scope="col" className="px-2 py-2 text-right">NAV</th>
                <th scope="col" className="px-2 py-2">Liquidity</th>
                <th scope="col" className="px-2 py-2">Lock-up / gate</th>
                {["YTD", "3Y ann.", "Vol", "Sharpe"].map((one) => <th key={one} scope="col" className="px-2 py-2 text-right">{one}</th>)}
                <th scope="col" className="py-2 pr-5 pl-2 text-right">Corr. ACWI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.hedgeFunds.map((one) => <HedgeLine key={one.name} row={one} currency={data.currency} />)}
              {data.hedgeSleeve && <HedgeLine row={data.hedgeSleeve} currency={data.currency} sleeve />}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HedgeLine({ row, currency, sleeve }: { row: PmHedgeFund; currency: string; sleeve?: boolean }) {
  const signed = (value: number | null) => (value == null ? <span className="text-ink-muted">—</span> : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`);
  return (
    <tr className={cn(sleeve && "bg-slate-50 font-semibold")}>
      <th scope="row" className="py-2 pr-3 pl-5 text-left font-semibold whitespace-nowrap">{row.name}</th>
      <td className="px-2 py-2 whitespace-nowrap">{row.strategy ?? ""}</td>
      <td className="px-2 py-2 text-right tabular-nums">{compact(row.value, currency)}</td>
      <td className="px-2 py-2 whitespace-nowrap">{row.liquidity ?? ""}</td>
      <td className="px-2 py-2 whitespace-nowrap">{row.lockup ?? ""}</td>
      <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(row.ytd))}>{signed(row.ytd)}</td>
      <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(row.threeYear))}>{signed(row.threeYear)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{row.volatility == null ? "—" : `${row.volatility.toFixed(1)}%`}</td>
      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
        {row.sharpe == null ? (sleeve || row.volatility == null ? "—" : <span className="text-ink-muted">not measured</span>) : row.sharpe.toFixed(2)}
      </td>
      <td className="py-2 pr-5 pl-2 text-right tabular-nums">{row.correlation == null ? "—" : row.correlation.toFixed(2)}</td>
    </tr>
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

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{children}</span>;
}

/** Where a bank-file client's files hold nothing; on one line, as every card here has room for it. */
function NotInFile() {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-left text-3xs leading-tight font-medium whitespace-nowrap text-ink-muted">
      not in bank file
    </span>
  );
}

function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

/** The server's figure in the unit it names; "n.m." where the server says it is not meaningful. */
function kpiValue(one: PmKpi, currency: string) {
  if (one.text) return one.text;
  if (one.value == null) return "—";
  if (one.unit === "PERCENT") return `${one.value.toFixed(1)}%`;
  if (one.unit === "MULTIPLE") return `${one.value.toFixed(2)}×`;
  return compact(one.value, currency);
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
