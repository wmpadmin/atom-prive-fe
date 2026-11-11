import { ApiError } from "@atomprive/api-client";
import {
  useGetClientRisk,
  type ClientRisk,
  type RiskScenario,
  type RiskSlice,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";

/**
 * A client's Risk & Exposure, laid out section by section as the firm's own design draws it. Every figure is worked
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Portfolio management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Risk & exposure
          </p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Risk &amp; Exposure</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Look-through exposures, risk decomposition, stress scenarios and liquidity across the family's entire balance sheet · as at {formatDate(data.asOf)}
          </p>
        </div>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-semibold text-ink-soft">{data.model}</span>
      </header>
      <Kpis data={data} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Risk Contribution vs Capital" lead="Ex-ante, investable assets, private assets de-smoothed">
          <Missing data={data} reason={data.riskContribution.reason} />
        </Card>
        <Card title="Factor Exposures" lead="Barra-style standardised loadings vs policy benchmark">
          <Missing data={data} reason={data.factorExposures.reason} />
        </Card>
      </div>
      <Stress data={data} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Correlation Matrix" lead="5Y monthly · private assets de-smoothed">
          <Missing data={data} reason={data.correlation.reason} />
        </Card>
        <VarHistory data={data} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Geographic Look-through" lead="All asset classes by country of risk · funds looked through" foot={data.geographyNote}>
          {data.bankFile ? <Missing data={data} reason="" /> : (
            <Bars rows={data.geography} max={Math.max(60, ...data.geography.map((one) => one.sharePercent))} colour="bg-slate-800"
              label={(one) => `${one.sharePercent.toFixed(1)}% · ${money(one.value, data.currency)}`} />
          )}
        </Card>
        <Card title="Sector Look-through" lead="Across equity, credit, private assets" foot={data.sectorNote}>
          {data.bankFile ? <Missing data={data} reason="" /> : data.sectors.length === 0 ? <Empty>No lines to look through.</Empty> : (
            <Bars rows={data.sectors} max={Math.max(20, ...data.sectors.map((one) => one.sharePercent))} colour="bg-amber-500"
              label={(one) => `${one.sharePercent.toFixed(1)}%`} />
          )}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Currencies data={data} />
        <IssuerLimit data={data} />
      </div>
      <Issuers data={data} />
      <Ladder data={data} />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Kpis({ data }: { data: ClientRisk }) {
  const k = data.kpis;
  const file = data.bankFile;
  const window = k.window ?? "";
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
  const [chosen, setChosen] = useState(0);
  const rows = data.stress;
  const pick: RiskScenario | undefined = rows[Math.min(chosen, rows.length - 1)];
  const tolerance = data.stressTolerance;
  const largest = Math.max(1, ...(pick?.byClass ?? []).map((one) => Math.abs(one.value)));
  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card title="Stress Tests & Scenarios" lead="Full revaluation on current holdings · private assets with lagged beta · click a scenario for its breakdown"
        foot={data.stressNote} flush>
        {data.bankFile ? <div className="px-5"><Missing data={data} reason="" /></div> : rows.length === 0 ? <Empty>{data.stressNote}</Empty> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3 pl-5">Scenario</th>
                  <th scope="col" className="px-2 py-2 text-right">Impact %</th>
                  <th scope="col" className="px-2 py-2 text-right">Impact {symbolOf(data.currency)}</th>
                  <th scope="col" className="px-2 py-2"><span className="sr-only">Impact bar</span></th>
                  <th scope="col" className="py-2 pr-5 pl-2">{tolerance == null ? "vs tolerance" : `vs ${signed(tolerance, false)} tolerance`}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((one, at) => (
                  <tr key={one.name} onClick={() => setChosen(at)} aria-selected={one === pick}
                    className={cn("cursor-pointer hover:bg-slate-50", one === pick && "bg-primary-50")}>
                    <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium">
                      <button type="button" className="text-left" onClick={() => setChosen(at)}>{one.name}</button>
                    </th>
                    <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(one.impactPercent))}>{signed(one.impactPercent)}</td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(one.impactAmount))}>{signedMoney(one.impactAmount, data.currency)}</td>
                    <td className="px-2 py-2"><Diverging value={one.impactPercent} /></td>
                    <td className="py-2 pr-5 pl-2">{one.standing ? <Standing value={one.standing} /> : <span className="text-xs text-ink-muted">no tolerance set</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={pick?.name ?? "Scenario"} lead={pick ? `${signed(pick.impactPercent)} · ${signedMoney(pick.impactAmount, data.currency)} by asset class` : undefined}>
        {data.bankFile ? <Missing data={data} reason="" /> : !pick ? <Empty>No scenario to break down.</Empty> : (
          <ul className="space-y-2">
            {pick.byClass.map((one) => (
              <li key={one.key} className="grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-2 text-sm">
                <span className="truncate" title={`Shock ${signed(one.sharePercent)}`}>{one.name}</span>
                <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                  <span className={cn("block h-full rounded-full", one.value < 0 ? "bg-red-500" : "bg-emerald-500")}
                    style={{ width: `${(Math.abs(one.value) / largest) * 100}%` }} />
                </span>
                <span className={cn("text-right tabular-nums", toneOf(one.value))}>{signedMoney(one.value, data.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
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
    <Card title="VaR History · 24 Months" lead="95% 1M VaR, % of investable"
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

function Currencies({ data }: { data: ClientRisk }) {
  const file = data.bankFile;
  const rows = file
    ? data.fileCurrencies.map((one) => ({ currency: one.currency, gross: one.amount, hedged: null, net: null, netPercent: null }))
    : data.currencies;
  const total = data.currencyTotal;
  const foot = file ? "Summed per currency from the bank's file lines, as sent and unconverted."
    : data.nonBasePercent == null ? null : `Non-${data.currency} net exposure ${data.nonBasePercent.toFixed(1)}% of the net total.`;
  return (
    <Card title="Currency Exposure" lead="Hedge overlays via share-class and forwards (reported by custodians)" foot={foot} flush>
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
                  <td className="px-2 py-2 text-right tabular-nums">{one.hedged == null ? <NotInFile /> : one.hedged === 0 ? "—" : money(one.hedged, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.net == null ? <NotInFile /> : money(one.net, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.netPercent == null ? "—" : `${one.netPercent.toFixed(1)}%`}</td>
                  <td className="py-2 pr-5 pl-2">
                    {one.netPercent != null && (
                      <span className="block h-1.5 w-28 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, one.netPercent))}%` }} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {!file && total && (
              <tfoot>
                <tr className="border-t border-line bg-slate-50 font-semibold">
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

function IssuerLimit({ data }: { data: ClientRisk }) {
  const limit = data.issuerLimit;
  const rows = data.issuers;
  const scale = Math.max(limit == null ? 0 : limit * 1.2, ...rows.map((one) => one.sharePercent), 1);
  const largest = rows.filter((one) => !one.sovereign).sort((a, b) => b.sharePercent - a.sharePercent)[0];
  const over = rows.filter((one) => one.overLimit);
  const foot = rows.length === 0 || limit == null ? null
    : `${largest ? `Largest non-sovereign: ${largest.issuer} ${largest.sharePercent.toFixed(1)}%. ` : ""}${over.length === 0
      ? "Headroom to the limit on every issuer." : `Over the limit: ${over.map((one) => one.issuer).join(", ")}.`}`;
  return (
    <Card title="Issuer Concentration vs Limit"
      lead={`% of net worth · red line = ${limit == null ? "no single-issuer limit set" : `${limit.toFixed(0)}% single-issuer limit (non-sovereign)`}`} foot={foot}>
      {data.bankFile ? <Missing data={data} reason="" /> : rows.length === 0 ? <Empty>No line names an issuer.</Empty> : (
        <ul className="space-y-2">
          {rows.map((one) => (
            <li key={one.issuer} className="grid grid-cols-[minmax(0,9rem)_1fr_4rem] items-center gap-2 text-sm">
              <span className="truncate">{one.issuer}{one.sovereign && <span className="ml-1 text-3xs text-ink-muted">sov.</span>}</span>
              <span className="relative block h-2 rounded-full bg-slate-100" aria-hidden="true">
                <span className={cn("block h-full rounded-full", one.overLimit ? "bg-red-500" : one.sovereign ? "bg-slate-400" : "bg-slate-800")}
                  style={{ width: `${Math.min(100, (one.sharePercent / scale) * 100)}%` }} />
                {limit != null && <span className="absolute -top-1 -bottom-1 w-0.5 bg-red-500" style={{ left: `${(limit / scale) * 100}%` }} />}
              </span>
              <span className={cn("text-right tabular-nums", one.overLimit && "font-semibold text-red-700")}>{one.sharePercent.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Issuers({ data }: { data: ClientRisk }) {
  const limit = data.issuerLimit;
  return (
    <Card title="Issuer Look-through · Top 8"
      lead={`Combined exposure to one obligor across instruments · ${limit == null ? "no IPS single-issuer limit set" : `IPS single-issuer limit ${limit.toFixed(0)}% of net worth for non-sovereigns`}`}
      foot={data.bankFile ? null : (
        <span className="flex flex-wrap items-center gap-4">
          <Key colour="bg-slate-800">Direct equity</Key><Key colour="bg-amber-500">Bonds</Key><Key colour="bg-sky-500">Via ETFs & funds</Key>
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
                  <th scope="row" className="py-2 pr-3 pl-5 text-left">
                    <b>{one.issuer}</b>{one.sovereign && <small className="ml-1 font-normal text-ink-muted">Sovereign · no limit</small>}
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums">{one.equity == null ? "—" : money(one.equity, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.bonds == null ? "—" : money(one.bonds, data.currency)}</td>
                  <td className="px-2 py-2 text-right text-ink-muted tabular-nums" title="Not measured: no fund holdings on file">—</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{money(one.total, data.currency)}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", one.overLimit && "font-semibold text-red-700")}>{one.sharePercent.toFixed(1)}%</td>
                  <td className="py-2 pr-5 pl-2">
                    <span className="flex h-2 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className="bg-slate-800" style={{ width: `${((one.equity ?? 0) / one.total) * 100}%` }} />
                      <span className="bg-amber-500" style={{ width: `${((one.bonds ?? 0) / one.total) * 100}%` }} />
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

function Ladder({ data }: { data: ClientRisk }) {
  const colours = ["bg-slate-800", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-rose-400"];
  return (
    <Card title="Liquidity Ladder by Asset Class" lead="Time to liquidate at fair value under normal markets"
      foot={data.bankFile ? null : (
        <span className="flex flex-col gap-2">
          <span className="flex flex-wrap gap-4">
            {data.liquidityTotals.map((one, at) => (
              <Key key={one.key} colour={colours[at % colours.length]}>{`${one.name}: ${money(one.value, data.currency)}`}</Key>
            ))}
          </span>
          {data.liquidityNote && <span>{data.liquidityNote}</span>}
        </span>
      )}>
      {data.bankFile ? <Missing data={data} reason="" /> : data.liquidity.length === 0 ? <Empty>No line states how quickly it turns to cash.</Empty> : (
        <ul className="grid gap-2">
          {data.liquidity.map((row) => (
            <li key={row.key} className="grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-2.5 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {row.buckets.map((one, at) => one.value > 0 && (
                  <span key={one.key} className={colours[at % colours.length]} style={{ width: `${one.sharePercent}%` }}
                    title={`${one.name}: ${money(one.value, data.currency)}`} />
                ))}
              </span>
              <span className="text-right tabular-nums">{money(row.total, data.currency)}</span>
            </li>
          ))}
        </ul>
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

function Bars({ rows, max, colour, label }: { rows: RiskSlice[]; max: number; colour: string; label: (one: RiskSlice) => string }) {
  return (
    <ul className="space-y-2">
      {rows.map((one) => (
        <li key={one.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate">{one.name}</span>
          <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
            <span className={cn("block h-full rounded-full", colour)} style={{ width: `${Math.min(100, (one.sharePercent / max) * 100)}%` }} />
          </span>
          <span className="text-right text-xs tabular-nums text-ink-soft">{label(one)}</span>
        </li>
      ))}
    </ul>
  );
}

function Diverging({ value }: { value: number }) {
  const width = Math.min(50, Math.abs(value) * 2.5);
  return (
    <span className="relative block h-2 w-28 rounded-full bg-slate-100" aria-hidden="true">
      <span className={cn("absolute top-0 bottom-0 rounded-full", value < 0 ? "bg-red-500" : "bg-emerald-500")}
        style={value < 0 ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }} />
    </span>
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
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
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
