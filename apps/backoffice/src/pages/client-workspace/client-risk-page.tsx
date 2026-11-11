import { ApiError } from "@atomprive/api-client";
import { useGetClientRisk, type ClientRisk } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";

/**
 * A client's Risk & Exposure, laid out section by section as the firm's 10 Nov design draws it. Every figure is worked
 * out on the server — value at risk from the desk's own monthly returns, stress tests from the firm's scenarios on
 * today's holdings, look-through from what each line states — and shown here as it comes, judgements included. A card
 * that cannot be measured stays in its place and says why. Read only.
 */
export function ClientRiskPage() {
  const { customerId = "" } = useParams();
  const risk = useGetClientRisk<ClientRisk, ApiError>(customerId);
  const data = risk.data;

  if (risk.isError) return <Alert tone="danger">{risk.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Measuring the risk…</p>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Risk &amp; Exposure
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Risk &amp; Exposure</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Look-through exposures, risk decomposition, stress scenarios and liquidity across the family's entire balance sheet
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {data.model}
        </p>
      </header>
      <Kpis data={data} />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card title="Risk Contribution vs Capital" lead="Ex-ante, investable assets, private assets de-smoothed">
          <Missing data={data} reason={data.riskContribution.reason} />
        </Card>
        <Card title="Factor Exposures" lead="Barra-style standardised loadings vs policy benchmark">
          <Missing data={data} reason={data.factorExposures.reason} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Stress data={data} />
        <Card title="Correlation Matrix" lead="5Y monthly · private assets de-smoothed">
          <Missing data={data} reason={data.correlation.reason} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Geography data={data} />
        <Card title="Sector Look-through" lead="Across equity, credit, private assets" foot={data.bankFile ? null : data.sectorNote}>
          {data.bankFile ? <Missing data={data} reason="" /> : data.sectors.length === 0 ? <Empty>No lines to look through.</Empty> : (
            <ul className="space-y-2">
              {data.sectors.map((one, at) => (
                <li key={one.key} className="grid grid-cols-[minmax(0,8.75rem)_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{one.name}</span>
                  <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                    <span className={cn("block h-full rounded-full", at < 3 ? "bg-slate-800" : "bg-amber-600")}
                      style={{ width: `${Math.min(100, (one.sharePercent / Math.max(20, data.sectors[0].sharePercent)) * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{one.sharePercent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Currencies data={data} />
      <Issuers data={data} />
      <div className="grid gap-4 xl:grid-cols-2">
        <VarHistory data={data} />
        <Ladder data={data} />
      </div>
      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>Values in {data.bankFile ? "the bank's own currencies" : data.currency} unless stated; market data as of {formatDate(data.asOf)} close.</span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Kpis({ data }: { data: ClientRisk }) {
  const k = data.kpis;
  const file = data.bankFile;
  const window = k.window ?? "";
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      <Kpi label="VaR · 95% · 1 month" value={k.var95Amount == null ? "—" : money(k.var95Amount, data.currency)}
        note={file ? <NotInFile /> : k.var95 == null ? (k.whyNot ?? "—")
          : `${k.var95.toFixed(1)}% of investable · ${k.varLimit == null ? "no limit set" : `limit ${k.varLimit.toFixed(1)}%`}`} />
      <Kpi label="Expected shortfall · 97.5%" value={k.es975Amount == null ? "—" : money(k.es975Amount, data.currency)}
        note={file ? <NotInFile /> : k.es975 == null ? (k.whyNot ?? "—") : `${k.es975.toFixed(1)}% · parametric, monthly`} />
      <Kpi label="Volatility · ex-ante" value={k.exAnteVolatility == null ? "—" : `${k.exAnteVolatility.toFixed(1)}%`}
        note={file ? <NotInFile /> : <>
          {k.exAnteVolatility == null && "Not recorded · "}
          {k.exPostVolatility == null ? "Ex-post not measured" : `Ex-post ${window} ${k.exPostVolatility.toFixed(1)}%`}
          {` · ${k.volatilityBudget == null ? "no budget set" : `budget ${k.volatilityBudget.toFixed(1)}%`}`}
        </>} />
      <Kpi label="Beta to mandate benchmark" value={k.beta == null ? "—" : k.beta.toFixed(2)}
        note={file ? <NotInFile /> : k.beta == null ? (k.betaWhyNot ?? "—")
          : `Correlation ${k.correlation == null ? "—" : k.correlation.toFixed(2)} · ${k.benchmark ?? "benchmark"} · ${window} monthly`} />
      <Kpi label={`Worst stress${k.worstScenario ? ` · ${k.worstScenario}` : ""}`}
        value={k.worstPercent == null ? "—" : signed(k.worstPercent)} tone={toneOf(k.worstPercent)}
        note={file ? <NotInFile /> : k.worstAmount == null ? "No scenario run" : `${signedMoney(k.worstAmount, data.currency)} on total net worth`} />
      <Kpi label="Diversification ratio" value="—"
        note={file ? <NotInFile /> : <NotMeasuredTag title={k.diversification.reason} />} />
    </div>
  );
}

function Stress({ data }: { data: ClientRisk }) {
  const rows = data.stress;
  const tolerance = data.stressTolerance;
  const largest = Math.max(1, ...rows.map((one) => Math.abs(one.impactPercent)));
  return (
    <Card title="Stress Tests & Scenarios" lead="Full revaluation on current holdings · private assets with lagged beta"
      foot={data.bankFile || rows.length === 0 ? null : data.stressNote} flush>
      {data.bankFile ? <div className="px-5"><Missing data={data} reason="" /></div> : rows.length === 0 ? <Empty>{data.stressNote}</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Scenario</th>
                <th scope="col" className="px-2 py-2 text-right">Impact %</th>
                <th scope="col" className="px-2 py-2 text-right">Impact {symbolOf(data.currency)}</th>
                <th scope="col" className="px-2 py-2"><span className="sr-only">Impact bar</span></th>
                <th scope="col" className="py-2 pr-5 pl-2 whitespace-nowrap">{tolerance == null ? "vs tolerance" : `vs ${signed(tolerance, false)} tolerance`}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one) => (
                <tr key={one.name}>
                  <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal">{one.name}</th>
                  <td className={cn("px-2 py-2.5 text-right font-semibold tabular-nums", toneOf(one.impactPercent))}>{signed(one.impactPercent)}</td>
                  <td className={cn("px-2 py-2.5 text-right font-semibold tabular-nums", toneOf(one.impactAmount))}>{signedMoney(one.impactAmount, data.currency)}</td>
                  <td className="px-2 py-2.5">
                    <span className="block h-2.5 w-24 rounded-xs bg-slate-100" aria-hidden="true">
                      <span className={cn("ml-auto block h-full rounded-xs", one.impactPercent < 0 ? "bg-red-600" : "bg-emerald-700")}
                        style={{ width: `${(Math.abs(one.impactPercent) / largest) * 70}%`, marginRight: "15%" }} />
                    </span>
                  </td>
                  <td className="py-2.5 pr-5 pl-2">{one.standing ? <Standing value={one.standing} /> : <span className="text-xs text-ink-muted">no tolerance set</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Geography({ data }: { data: ClientRisk }) {
  const rows = data.geography;
  return (
    <Card title="Geographic Look-through" lead="All asset classes by country of risk · funds looked through" foot={data.bankFile ? null : data.geographyNote}>
      {data.bankFile ? <Missing data={data} reason="" /> : rows.every((one) => one.value === 0) ? <Empty>No lines to look through.</Empty> : (
        <>
          <span className="flex h-3 overflow-hidden rounded-xs bg-slate-100" aria-hidden="true">
            {rows.map((one, at) => one.sharePercent > 0 && (
              <span key={one.key} style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </span>
          <ul className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {rows.map((one, at) => (
              <li key={one.key} className="rounded-lg border border-line px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="size-2 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                  {one.name}
                </p>
                <p className="text-lg font-bold tabular-nums">{one.sharePercent.toFixed(1)}%</p>
                <p className="text-2xs text-ink-muted tabular-nums">{money(one.value, data.currency)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Currencies({ data }: { data: ClientRisk }) {
  const file = data.bankFile;
  const rows = file
    ? data.fileCurrencies.map((one) => ({ currency: one.currency, gross: one.amount, hedged: null, net: null, netPercent: null }))
    : data.currencies;
  const total = data.currencyTotal;
  return (
    <Card title="Currency Exposure" lead="Hedge overlays via share-class and forwards (reported by custodians)"
      foot={file ? "Summed per currency from the bank's file lines, as sent and unconverted." : null} flush>
      {rows.length === 0 ? <Empty>{file ? "No lines in the bank's file." : "No lines to read."}</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Ccy</th>
                <th scope="col" className="px-2 py-2 text-right">Gross</th>
                <th scope="col" className="px-2 py-2 text-right">Hedged</th>
                <th scope="col" className="px-2 py-2 text-right">Net</th>
                <th scope="col" className="px-2 py-2 text-right">% net</th>
                <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Share bar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one) => (
                <tr key={one.currency}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-bold">{one.currency}</th>
                  <td className="px-2 py-2 text-right tabular-nums">{file ? plain(one.gross) : money(one.gross, data.currency)}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", one.hedged != null && one.hedged < 0 && "text-red-700")}>
                    {one.hedged == null ? <NotInFile /> : one.hedged === 0 ? "—" : money(one.hedged, data.currency)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.net == null ? <NotInFile /> : money(one.net, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.netPercent == null ? "—" : `${one.netPercent.toFixed(1)}%`}</td>
                  <td className="py-2 pr-5 pl-2">
                    {one.netPercent != null && (
                      <span className="block h-1.5 w-28 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-full rounded-full bg-amber-600" style={{ width: `${Math.min(100, Math.max(0, one.netPercent))}%` }} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {!file && total && (
              <tfoot>
                <tr className="border-t border-line font-bold">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">Total</th>
                  <td className="px-2 py-2 text-right tabular-nums">{money(total.gross, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{total.hedged === 0 ? "—" : money(total.hedged, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(total.net, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{`${total.netPercent.toFixed(0)}%`}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}

function Issuers({ data }: { data: ClientRisk }) {
  return (
    <Card title="Issuer Look-through · Top 8" lead="Combined exposure to one obligor across instruments"
      foot={data.bankFile ? null : (
        <span className="flex flex-wrap items-center gap-4">
          <Key colour="bg-slate-800">Direct equity</Key><Key colour="bg-amber-600">Bonds</Key><Key colour="bg-amber-200">Via ETFs &amp; funds</Key>
          {data.issuerNote && <span>{data.issuerNote}</span>}
        </span>
      )} flush>
      {data.bankFile ? <div className="px-5"><Missing data={data} reason="" /></div> : data.issuers.length === 0 ? <Empty>No line names an issuer.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Issuer</th>
                <th scope="col" className="px-2 py-2 text-right">Equity</th>
                <th scope="col" className="px-2 py-2 text-right">Bonds</th>
                <th scope="col" className="px-2 py-2 text-right">Via funds</th>
                <th scope="col" className="px-2 py-2 text-right">Total</th>
                <th scope="col" className="px-2 py-2 text-right">% NW</th>
                <th scope="col" className="py-2 pr-5 pl-2">Mix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.issuers.map((one) => (
                <tr key={one.issuer}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-bold">{one.issuer}</th>
                  <td className="px-2 py-2 text-right tabular-nums">{one.equity == null ? "—" : money(one.equity, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.bonds == null ? "—" : money(one.bonds, data.currency)}</td>
                  <td className="px-2 py-2 text-right text-ink-muted tabular-nums" title="Not measured: no fund holdings on file">—</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{money(one.total, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.sharePercent.toFixed(1)}%</td>
                  <td className="py-2 pr-5 pl-2">
                    <span className="flex h-2 w-12 overflow-hidden rounded-xs bg-slate-100" aria-hidden="true">
                      <span className="bg-slate-800" style={{ width: `${((one.equity ?? 0) / one.total) * 100}%` }} />
                      <span className="bg-amber-600" style={{ width: `${((one.bonds ?? 0) / one.total) * 100}%` }} />
                    </span>
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

function VarHistory({ data }: { data: ClientRisk }) {
  const points = data.varHistory;
  const limit = data.varLimit;
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value.toFixed(1)}%` },
      xAxis: { type: "category", data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", min: 0, axisLabel: { color: colours.muted, formatter: (value: number) => `${value.toFixed(1)}%` },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "95% 1M VaR", data: points.map((one) => one.var95), showSymbol: false,
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas } },
        ...(limit == null ? [] : [{ type: "line", name: `IPS risk limit ${limit.toFixed(1)}%`, data: points.map(() => limit), showSymbol: false,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } }]),
      ],
    };
  }, [points, limit]);
  return (
    <Card title="VaR History · 24 Months"
      foot={data.bankFile ? null : (
        <span className="flex flex-wrap gap-4">
          <Key colour="bg-slate-800">95% 1M VaR, % of investable</Key>
          <Key colour="bg-red-500" dashed>{limit == null ? "No IPS risk limit set" : `IPS risk limit ${limit.toFixed(1)}%`}</Key>
        </span>
      )}>
      {data.bankFile ? <Missing data={data} reason="" /> : points.length < 2 ? <Empty>{data.varHistoryNote ?? "Not enough months to draw."}</Empty> : (
        <Chart option={option} height={190} label="Value at risk at each month end over the trailing twelve months" />
      )}
    </Card>
  );
}

function Ladder({ data }: { data: ClientRisk }) {
  const rows = data.liquidity;
  const rungs = data.liquidityTotals;
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => money(value, data.currency) },
      xAxis: { type: "category", data: rungs.map((one) => one.name), axisLabel: { color: colours.muted, fontSize: 10 },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: colours.muted, fontSize: 10, formatter: (value: number) => money(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: rows.map((row, at) => ({
        type: "bar", name: row.name, stack: "rungs", barWidth: "55%",
        data: row.buckets.map((one) => one.value), itemStyle: { color: INK[at % INK.length] },
      })),
    };
  }, [rows, rungs, data.currency]);
  return (
    <Card title="Liquidity Ladder by Asset Class" lead="Time to liquidate at fair value under normal markets"
      foot={data.bankFile ? null : data.liquidityNote}>
      {data.bankFile ? <Missing data={data} reason="" /> : rows.length === 0 ? <Empty>No line states how quickly it turns to cash.</Empty> : (
        <>
          <Chart option={option} height={200} label="What each liquidity rung holds, stacked by asset class" />
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {rows.map((row, at) => (
              <span key={row.key} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                {row.name}
              </span>
            ))}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {rungs.map((one) => (
              <span key={one.key}>{one.name}: <b className="text-ink tabular-nums">{money(one.value, data.currency)}</b></span>
            ))}
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Card({ title, lead, foot, flush, children }: { title: string; lead?: string; foot?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3", flush && "px-5")}>
        <h2 className="text-lg font-bold">{title}</h2>
        {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
      </div>
      <div className="flex-1">{children}</div>
      {foot && <div className={cn("mt-3 border-t border-line pt-3 text-xs text-ink-muted", flush && "px-5")}>{foot}</div>}
    </section>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <div className="mt-1 text-xs text-ink-muted">{note}</div>
    </div>
  );
}

const STANDING: Record<string, [string, string]> = {
  WITHIN: ["Within", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  WATCH: ["Watch", "bg-amber-50 text-amber-700 ring-amber-200"],
  DEVIATION: ["Deviation", "bg-red-50 text-red-700 ring-red-200"],
};

function Standing({ value }: { value: string }) {
  const [label, tone] = STANDING[value] ?? [value, "bg-slate-50 text-ink-soft ring-line"];
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1", tone)}>{label}</span>;
}

function Key({ colour, dashed, children }: { colour: string; dashed?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-3 rounded-sm", colour, dashed && "h-0.5")} aria-hidden="true" />
      {children}
    </span>
  );
}

function Missing({ data, reason }: { data: ClientRisk; reason: string }) {
  if (data.bankFile) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
  }
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">{reason}</p>;
}

function NotMeasuredTag({ title }: { title: string }) {
  return (
    <span title={title} className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      not measured
    </span>
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
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function signed(value: number, sign = true) {
  return `${sign && value > 0 ? "+" : ""}${value.toFixed(1)}%`.replace("-", "−");
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount);
  } catch {
    return plain(amount);
  }
}

function plain(amount: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
}

function signedMoney(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${money(amount, currency)}`;
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

function monthLabel(day: string) {
  const date = new Date(day);
  return `${date.toLocaleString("en-GB", { month: "short" })} ${String(date.getFullYear()).slice(2)}`;
}
