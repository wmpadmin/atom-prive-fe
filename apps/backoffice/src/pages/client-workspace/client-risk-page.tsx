import { ApiError } from "@atomprive/api-client";
import { useGetClientRisk, type ClientRisk } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";
import { CardMenu, CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart } from "../layout/chart-kinds";
import { seriesFigure, sharesFigure, singleFigure, type Figures } from "../layout/own-cards";
import { useDrill } from "./drill-panel";

/**
 * A client's Risk & Exposure, laid out section by section as the firm's 10 Nov design draws it. Every figure is worked
 * out on the server — value at risk from the desk's own monthly returns, stress tests from the firm's scenarios on
 * today's holdings, look-through from what each line states — and shown here as it comes, judgements included. A card
 * that cannot be measured stays in its place and says why. Read only.
 */
type RiskCard = "kpis" | "contribution" | "factors" | "stress" | "correlation" | "geography" | "sectors" | "currencies"
  | "issuers" | "var" | "ladder";

/** The screen's cards, in the firm's order: every card on by default. */
const CARDS: Record<RiskCard, LayoutMeta> = {
  kpis: { title: "Key figures", group: "Summary", wide: true },
  contribution: { title: "Risk Contribution vs Capital", group: "Risk model", charts: ["horizontal-bar", "grouped-bar", "scatter", "table"] },
  factors: { title: "Factor Exposures", group: "Risk model", charts: ["horizontal-bar", "radar", "grouped-bar", "table"] },
  stress: { title: "Stress Tests & Scenarios", group: "Scenarios", charts: ["table", "horizontal-bar", "bar"] },
  correlation: { title: "Correlation Matrix", group: "Risk model", charts: ["heatmap", "table"] },
  geography: { title: "Geographic Look-through", group: "Look-through", charts: ["stacked-bar", "donut", "horizontal-bar", "treemap", "table"] },
  sectors: { title: "Sector Look-through", group: "Look-through", charts: ["horizontal-bar", "donut", "treemap", "table"] },
  currencies: { title: "Currency Exposure", group: "Look-through", wide: true, charts: ["table", "grouped-bar", "horizontal-bar", "donut"] },
  issuers: { title: "Issuer Look-through · Top 8", group: "Look-through", wide: true, charts: ["table", "stacked-bar", "horizontal-bar", "treemap"] },
  var: { title: "VaR History · 24 Months", group: "Scenarios", charts: ["line", "area", "bar", "table"] },
  ladder: { title: "Liquidity Ladder by Asset Class", group: "Liquidity", charts: ["stacked-bar", "grouped-bar", "table"] },
};

// The four that matter most open the screen; every other card waits in Add cards. A layout someone saved is kept.
const DEFAULT_CARDS: RiskCard[] = ["kpis", "contribution", "stress", "var"];

export function ClientRiskPage() {
  const { customerId = "" } = useParams();
  const risk = useGetClientRisk<ClientRisk, ApiError>(customerId);
  const data = risk.data;
  const view = useViewLayout("workspace.risk", CARDS, DEFAULT_CARDS);

  if (risk.isError) return <Alert tone="danger">{risk.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Measuring the risk…</p>;

  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="absolute top-0 right-0"><CustomizeButton view={view} /></div>
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
      <LayoutGrid view={view} screen="Risk & Exposure" figures={data.bankFile ? undefined : riskFigures(data)} render={{
        kpis: <Kpis data={data} />,
        contribution: (
          <Card title="Risk Contribution vs Capital" lead="Ex-ante, investable assets, private assets de-smoothed"
            picker={data.classRisk.length > 0 && cardChart(view, "contribution").picker}>
            {data.classRisk.length > 0 ? <ClassRisk data={data} chart={cardChart(view, "contribution")} /> : <Missing data={data} reason={data.riskContribution.reason} />}
          </Card>
        ),
        factors: (
          <Card title="Factor Exposures" lead="Barra-style standardised loadings vs policy benchmark"
            picker={data.factors.length > 0 && cardChart(view, "factors").picker}>
            {data.factors.length > 0 ? <Factors data={data} chart={cardChart(view, "factors")} /> : <Missing data={data} reason={data.factorExposures.reason} />}
          </Card>
        ),
        stress: <Stress data={data} chart={cardChart(view, "stress")} />,
        correlation: (
          <Card title="Correlation Matrix" lead={data.correlationMatrix ? "Monthly class returns, last 3 years · private assets de-smoothed" : "5Y monthly · private assets de-smoothed"}
            picker={!!data.correlationMatrix && cardChart(view, "correlation").picker}>
            {data.correlationMatrix ? <Correlation data={data} chart={cardChart(view, "correlation")} /> : <Missing data={data} reason={data.correlation.reason} />}
          </Card>
        ),
        geography: <Geography data={data} chart={cardChart(view, "geography")} />,
        sectors: <Sectors data={data} chart={cardChart(view, "sectors")} />,
        currencies: <Currencies data={data} chart={cardChart(view, "currencies")} />,
        issuers: <Issuers data={data} chart={cardChart(view, "issuers")} />,
        var: <VarHistory data={data} chart={cardChart(view, "var")} />,
        ladder: <Ladder data={data} chart={cardChart(view, "ladder")} />,
      }} />
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
      <Kpi label="Diversification ratio" value={k.diversificationRatio == null ? "—" : k.diversificationRatio.toFixed(2)}
        note={file ? <NotInFile /> : k.diversificationRatio == null ? <NotMeasuredTag title={k.diversification.reason} />
          : "Weighted class volatilities over the portfolio's · demo class returns"} />
    </div>
  );
}

function Stress({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const rows = data.stress;
  const tolerance = data.stressTolerance;
  const largest = Math.max(1, ...rows.map((one) => Math.abs(one.impactPercent)));
  return (
    <Card title="Stress Tests & Scenarios" lead="Full revaluation on current holdings · private assets with lagged beta"
      foot={data.bankFile || rows.length === 0 ? null : data.stressNote} flush picker={!data.bankFile && rows.length > 0 && chart.picker}>
      {data.bankFile ? <div className="px-5"><Missing data={data} reason="" /></div> : rows.length === 0 ? <Empty>{data.stressNote}</Empty> : !chart.own ? (
        <div className="px-5">
          <KindChart kind={chart.kind!} format={(value) => signed(value)} height={60 + rows.length * 30} label="What each scenario would do to the portfolio"
            data={{ shape: "series", categories: rows.map((one) => one.name), series: [{ name: "Impact %", values: rows.map((one) => one.impactPercent) }] }} />
        </div>
      ) : (
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

/** The look-through by sector, across equity, credit and private assets. */
function Sectors({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  return (
    <Card title="Sector Look-through" lead="Across equity, credit, private assets" foot={data.bankFile ? null : data.sectorNote}
      picker={!data.bankFile && data.sectors.length > 0 && chart.picker}>
      {data.bankFile ? <Missing data={data} reason="" /> : data.sectors.length === 0 ? <Empty>No lines to look through.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={260} label="Holdings by sector, looked through"
          data={{ shape: "shares", items: data.sectors.map((one) => ({ name: one.name, value: one.sharePercent })) }} />
      ) : (
        <ul className="space-y-2">
          {data.sectors.map((one, at) => (
            <li key={one.key} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="leading-snug break-words">{one.name}</span>
              <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                <span className={cn("block h-full rounded-full", at < 3 ? "bg-primary-600" : "bg-amber-600")}
                  style={{ width: `${Math.min(100, (one.sharePercent / Math.max(20, data.sectors[0].sharePercent)) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums">{one.sharePercent.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Geography({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const rows = data.geography;
  const empty = rows.every((one) => one.value === 0);
  return (
    <Card title="Geographic Look-through" lead="All asset classes by country of risk · funds looked through" foot={data.bankFile ? null : data.geographyNote}
      picker={!data.bankFile && !empty && chart.picker}>
      {data.bankFile ? <Missing data={data} reason="" /> : empty ? <Empty>No lines to look through.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => money(value, data.currency)} height={240} label="Holdings by country of risk, looked through"
          data={{ shape: "shares", items: rows.filter((one) => one.value > 0).map((one) => ({ name: one.name, value: one.value })) }} />
      ) : (
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

function Currencies({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const file = data.bankFile;
  const drill = useDrill();
  const rows = file
    ? data.fileCurrencies.map((one) => ({ currency: one.currency, gross: one.amount, hedged: null, net: null, netPercent: null }))
    : data.currencies;
  const total = data.currencyTotal;
  return (
    <Card title="Currency Exposure" lead="Hedge overlays via share-class and forwards (reported by custodians)"
      foot={file ? "Summed per currency from the bank's file lines, as sent and unconverted." : null} flush
      picker={!file && rows.length > 0 && chart.picker}>
      {rows.length === 0 ? <Empty>{file ? "No lines in the bank's file." : "No lines to read."}</Empty> : !file && !chart.own ? (
        <div className="px-5">
          <KindChart kind={chart.kind!} format={(value) => money(value, data.currency)} height={240} label="Exposure to each currency, gross, hedged and net"
            data={chart.kind === "grouped-bar"
              ? { shape: "series", categories: data.currencies.map((one) => one.currency), series: [
                  { name: "Gross", values: data.currencies.map((one) => one.gross) },
                  { name: "Hedged", values: data.currencies.map((one) => one.hedged) },
                  { name: "Net", values: data.currencies.map((one) => one.net) },
                ] }
              : { shape: "shares", items: data.currencies.map((one) => ({ name: one.currency, value: one.net })) }}
            onPick={(at) => { const one = data.currencies[at]; if (one) drill?.({ by: "currency", key: one.currency, name: one.currency }); }} />
        </div>
      ) : (
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
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-bold">
                    {file ? one.currency : (
                      <button type="button" className="hover:text-primary-700 hover:underline" title="Open the lines held in this currency"
                        onClick={() => drill?.({ by: "currency", key: one.currency, name: one.currency })}>{one.currency}</button>
                    )}
                  </th>
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

function Issuers({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  return (
    <Card title="Issuer Look-through · Top 8" lead="Combined exposure to one obligor across instruments"
      foot={data.bankFile ? null : (
        <span className="flex flex-wrap items-center gap-4">
          <Key colour="bg-slate-800">Direct equity</Key><Key colour="bg-amber-600">Bonds</Key><Key colour="bg-amber-200">Via ETFs &amp; funds</Key>
          {data.issuerNote && <span>{data.issuerNote}</span>}
        </span>
      )} flush picker={!data.bankFile && data.issuers.length > 0 && chart.picker}>
      {data.bankFile ? <div className="px-5"><Missing data={data} reason="" /></div> : data.issuers.length === 0 ? <Empty>No line names an issuer.</Empty> : !chart.own ? (
        <div className="px-5">
          <KindChart kind={chart.kind!} format={(value) => money(value, data.currency)} height={260} label="Exposure to each issuer across instruments"
            data={chart.kind === "stacked-bar"
              ? { shape: "series", categories: data.issuers.map((one) => one.issuer), series: [
                  { name: "Direct equity", values: data.issuers.map((one) => one.equity) },
                  { name: "Bonds", values: data.issuers.map((one) => one.bonds) },
                  { name: "Via ETFs & funds", values: data.issuers.map((one) => one.viaFunds) },
                ] }
              : { shape: "shares", items: data.issuers.map((one) => ({ name: one.issuer, value: one.total })) }} />
        </div>
      ) : (
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
                  <td className="px-2 py-2 text-right tabular-nums">{one.viaFunds == null ? "—" : money(one.viaFunds, data.currency)}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{money(one.total, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{one.sharePercent.toFixed(1)}%</td>
                  <td className="py-2 pr-5 pl-2">
                    <span className="flex h-2 w-12 overflow-hidden rounded-xs bg-slate-100" aria-hidden="true">
                      <span className="bg-slate-800" style={{ width: `${((one.equity ?? 0) / one.total) * 100}%` }} />
                      <span className="bg-amber-600" style={{ width: `${((one.bonds ?? 0) / one.total) * 100}%` }} />
                      <span className="bg-amber-200" style={{ width: `${((one.viaFunds ?? 0) / one.total) * 100}%` }} />
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

function VarHistory({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const points = data.varHistory;
  const limit = data.varLimit;
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value.toFixed(1)}%` },
      xAxis: { type: "category", boundaryGap: points.length === 1, data: points.map((one) => one.on), axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false } },
      yAxis: { type: "value", min: 0, axisLabel: { color: colours.muted, formatter: (value: number) => `${value.toFixed(1)}%` },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "95% 1M VaR", data: points.map((one) => one.var95), showSymbol: points.length === 1, symbolSize: 8,
          label: { show: points.length === 1, position: "top", color: colours.text, formatter: ({ value }: { value: number }) => `${value.toFixed(1)}%` },
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas } },
        ...(limit == null ? [] : [{ type: "line", name: `IPS risk limit ${limit.toFixed(1)}%`, data: points.map(() => limit), showSymbol: false,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger } }]),
      ],
    };
  }, [points, limit]);
  return (
    <Card title="VaR History · 24 Months" picker={!data.bankFile && points.length > 1 && chart.picker}
      foot={data.bankFile ? null : (
        <span className="flex flex-wrap gap-4">
          <Key colour="bg-slate-800">95% 1M VaR, % of investable</Key>
          <Key colour="bg-red-500" dashed>{limit == null ? "No IPS risk limit set" : `IPS risk limit ${limit.toFixed(1)}%`}</Key>
        </span>
      )}>
      {data.bankFile ? <Missing data={data} reason="" /> : points.length === 0 ? <Empty>{data.varHistoryNote ?? "Not enough months to draw."}</Empty> : (
        <>
          {chart.own ? <Chart option={option} height={190} label="Value at risk at each month end over the trailing twelve months" /> : (
            <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={190} label="Value at risk at each month end over the trailing twelve months"
              data={{ shape: "series", categories: points.map((one) => monthLabel(one.on)), series: [
                { name: "95% 1M VaR", values: points.map((one) => one.var95) },
                ...(limit == null ? [] : [{ name: "IPS risk limit", values: points.map(() => limit), colour: ink().danger }]),
              ] }} />
          )}
          {points.length === 1 && <p className="mt-1 text-3xs text-ink-muted italic">One reading on file so far: it is marked as a point, and the line starts with the next.</p>}
        </>
      )}
    </Card>
  );
}

function Ladder({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const drill = useDrill();
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
      foot={data.bankFile ? null : data.liquidityNote} picker={!data.bankFile && rows.length > 0 && chart.picker}>
      {data.bankFile ? <Missing data={data} reason="" /> : rows.length === 0 ? <Empty>No line states how quickly it turns to cash.</Empty> : (
        <>
          {chart.own ? (
            <Chart option={option} height={200} label="What each liquidity rung holds, stacked by asset class"
              onPick={(name) => drill?.({ by: "liquidity", key: name, name })} />
          ) : (
            <KindChart kind={chart.kind!} format={(value) => money(value, data.currency)} height={200} label="What each liquidity rung holds, by asset class"
              data={{ shape: "series", categories: rungs.map((one) => one.name), series: rows.map((row) => ({ name: row.name, values: row.buckets.map((one) => one.value) })) }}
              onPick={(at) => { const rung = rungs[at]; if (rung) drill?.({ by: "liquidity", key: rung.name, name: rung.name }); }} />
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {rows.map((row, at) => (
              <button key={row.key} type="button" className="inline-flex items-center gap-1.5 hover:text-primary-700 hover:underline"
                onClick={() => drill?.({ by: "class", key: row.key, name: row.name })}>
                <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                {row.name}
              </button>
            ))}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {rungs.map((one) => (
              <button key={one.key} type="button" className="hover:text-primary-700 hover:underline"
                onClick={() => drill?.({ by: "liquidity", key: one.name, name: one.name })}>
                {one.name}: <b className="text-ink tabular-nums">{money(one.value, data.currency)}</b>
              </button>
            ))}
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** Each class's share of capital beside its share of risk, both as bars on one scale. */
function ClassRisk({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const drill = useDrill();
  const rows = data.classRisk;
  const largest = Math.max(1, ...rows.flatMap((one) => [one.capitalPercent, one.riskPercent]));
  const open = (at: number) => { const one = rows[at]; if (one) drill?.({ by: "class", key: one.key, name: one.name }); };
  if (!chart.own) return (
    <>
      <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={240} label="Each class's share of capital beside its share of risk"
        data={chart.kind === "scatter"
          ? { shape: "points", xName: "Share of capital %", yName: "Share of risk %", items: rows.map((one) => ({ name: one.name, x: one.capitalPercent, y: one.riskPercent })) }
          : { shape: "series", categories: rows.map((one) => one.name), series: [
              { name: "Share of capital", values: rows.map((one) => one.capitalPercent), colour: ink().neutral },
              { name: "Share of risk", values: rows.map((one) => one.riskPercent), colour: ink().primary },
            ] }}
        onPick={open} />
      <p className="mt-1 text-3xs text-ink-muted italic">{data.riskContribution.reason}</p>
    </>
  );
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((one) => (
          <li key={one.key} className="grid grid-cols-[minmax(0,11rem)_1fr_7.5rem] items-center gap-3 py-2 text-sm">
            <span className="leading-snug break-words">
              <button type="button" className="text-left hover:text-primary-700 hover:underline"
                onClick={() => drill?.({ by: "class", key: one.key, name: one.name })}>{one.name}</button>
              <span className="block text-3xs text-ink-muted">vol {one.volatilityPercent.toFixed(1)}%</span>
            </span>
            <span className="space-y-1" aria-hidden="true">
              <span className="block h-2 rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-slate-400" style={{ width: `${(one.capitalPercent / largest) * 100}%` }} />
              </span>
              <span className="block h-2 rounded-full bg-slate-100">
                <span className={cn("block h-full rounded-full", one.riskPercent > one.capitalPercent ? "bg-red-500" : "bg-primary-600")}
                  style={{ width: `${(Math.max(0, one.riskPercent) / largest) * 100}%` }} />
              </span>
            </span>
            <span className="text-right text-xs tabular-nums">
              <span className="block">{one.capitalPercent.toFixed(1)}% capital</span>
              <span className="block font-semibold">{one.riskPercent.toFixed(1)}% risk</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-slate-400" aria-hidden="true" />Share of capital</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-primary-600" aria-hidden="true" />Share of risk</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-red-500" aria-hidden="true" />Risk above capital</span>
      </p>
      <p className="mt-1 text-3xs text-ink-muted italic">{data.riskContribution.reason}</p>
    </>
  );
}

/** Each factor's loading, the client's beside the policy benchmark's, about a centred zero line. */
function Factors({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const largest = Math.max(0.1, ...data.factors.flatMap((one) => [Math.abs(one.loading), Math.abs(one.benchmarkLoading ?? 0)]));
  const bar = (value: number, tone: string) => (
    <span className="relative block h-2" aria-hidden="true">
      <span className="absolute -top-0.5 left-1/2 h-3 w-px bg-ink-muted/40" />
      <span className={cn("absolute top-0 h-2", tone, value >= 0 ? "left-1/2 rounded-r-sm" : "right-1/2 rounded-l-sm")}
        style={{ width: `${(Math.abs(value) / largest) * 50}%` }} />
    </span>
  );
  if (!chart.own) return (
    <>
      <KindChart kind={chart.kind!} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`} height={260} label="Each factor's loading against the policy benchmark's"
        data={{ shape: "series", categories: data.factors.map((one) => one.label), series: [
          { name: "Portfolio", values: data.factors.map((one) => one.loading), colour: ink().primary },
          { name: "Policy benchmark", values: data.factors.map((one) => one.benchmarkLoading), colour: ink().neutral },
        ] }} />
      <p className="mt-1 text-3xs text-ink-muted italic">{data.factorExposures.reason}</p>
    </>
  );
  return (
    <>
      <ul className="divide-y divide-line">
        {data.factors.map((one) => (
          <li key={one.key} className="grid grid-cols-[minmax(0,10rem)_1fr_6.5rem] items-center gap-3 py-2 text-sm">
            <span className="leading-snug break-words">{one.label}</span>
            <span className="space-y-1">
              {bar(one.loading, "bg-primary-600")}
              {one.benchmarkLoading != null && bar(one.benchmarkLoading, "bg-slate-400")}
            </span>
            <span className="text-right text-xs tabular-nums">
              <span className="block font-semibold">{one.loading > 0 ? "+" : ""}{one.loading.toFixed(2)}</span>
              <span className="block text-ink-muted">bench {one.benchmarkLoading == null ? "—" : `${one.benchmarkLoading > 0 ? "+" : ""}${one.benchmarkLoading.toFixed(2)}`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-primary-600" aria-hidden="true" />Portfolio</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-slate-400" aria-hidden="true" />Policy benchmark</span>
      </p>
      <p className="mt-1 text-3xs text-ink-muted italic">{data.factorExposures.reason}</p>
    </>
  );
}

/** Class by class, a soft tint for how closely each pair moves: blue together, red apart. */
function Correlation({ data, chart }: { data: ClientRisk; chart: CardChart }) {
  const matrix = data.correlationMatrix;
  if (!matrix) return null;
  if (!chart.own) return (
    <KindChart kind={chart.kind!} format={(value) => value.toFixed(2)} label="How closely each pair of classes moves together"
      data={{ shape: "series", categories: matrix.names, series: matrix.values.map((row, at) => ({ name: matrix.names[at]!, values: row })) }} />
  );
  return (
    <>
      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-3xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-1.5 pr-2 pl-5"><span className="sr-only">Class</span></th>
              {matrix.names.map((name) => <th key={name} scope="col" className="px-1.5 py-1.5 text-center">{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.values.map((row, at) => (
              <tr key={matrix.names[at]}>
                <th scope="row" className="py-1 pr-2 pl-5 text-left font-medium whitespace-nowrap">{matrix.names[at]}</th>
                {row.map((value, col) => (
                  <td key={col} className="px-0.5 py-0.5">
                    <span className="block rounded-md px-1.5 py-2 text-center text-ink tabular-nums"
                      style={{ background: `color-mix(in srgb, var(${value >= 0 ? "--color-primary-600" : "--color-red-500"}) ${Math.round(Math.abs(value) * (at === col ? 30 : 55))}%, transparent)` }}>
                      {value.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-3xs text-ink-muted italic">{matrix.months} monthly class returns · {data.correlation.reason}</p>
    </>
  );
}

/** What Risk & Exposure offers for a card of the reader's own: its risk figures, scenarios and look-throughs. */
function riskFigures(data: ClientRisk): Figures {
  const amount = (value: number) => money(value, data.currency);
  const pc = (value: number) => `${value.toFixed(1)}%`;
  const k = data.kpis;
  return {
    "kpi.var": singleFigure("95% 1-month VaR, % of investable", "Key figures", k.var95, pc,
      { gauge: true, max: Math.max(10, (k.varLimit ?? k.var95 ?? 0) * 2), policy: k.varLimit != null ? { value: k.varLimit, label: "VaR limit" } : null }),
    "kpi.var-amount": singleFigure("95% 1-month VaR", "Key figures", k.var95Amount, amount),
    "kpi.es": singleFigure("97.5% expected shortfall, % of investable", "Key figures", k.es975, pc, { gauge: true, max: Math.max(10, (k.es975 ?? 0) * 2) }),
    "kpi.volatility": singleFigure("Volatility, ex-ante", "Key figures", k.exAnteVolatility, pc,
      { gauge: true, max: Math.max(20, (k.volatilityBudget ?? k.exAnteVolatility ?? 0) * 2), policy: k.volatilityBudget != null ? { value: k.volatilityBudget, label: "volatility budget" } : null }),
    "kpi.beta": singleFigure("Beta", "Key figures", k.beta, (value) => value.toFixed(2), { gauge: true, max: 2 }),
    "stress.impact": seriesFigure("Stress test impact by scenario", "Scenarios", data.stress.map((one) => one.name),
      [{ name: "Impact %", values: data.stress.map((one) => one.impactPercent) }], pc, ["horizontal-bar", "bar", "table"]),
    "var.history": seriesFigure("VaR over the last 24 months", "Scenarios", data.varHistory.map((one) => monthLabel(one.on)),
      [{ name: "95% 1M VaR", values: data.varHistory.map((one) => one.var95) }], pc, ["line", "area", "bar", "table"]),
    "risk.classes": seriesFigure("Share of risk against share of capital, by class", "Risk model", data.classRisk.map((one) => one.name), [
      { name: "Capital", values: data.classRisk.map((one) => one.capitalPercent) }, { name: "Risk", values: data.classRisk.map((one) => one.riskPercent) },
    ], pc, ["grouped-bar", "horizontal-bar", "table"]),
    "risk.factors": seriesFigure("Factor loadings against the benchmark", "Risk model", data.factors.map((one) => one.label), [
      { name: "Portfolio", values: data.factors.map((one) => one.loading) }, { name: "Benchmark", values: data.factors.map((one) => one.benchmarkLoading) },
    ], (value) => value.toFixed(2), ["horizontal-bar", "radar", "grouped-bar", "table"]),
    "look.geography": sharesFigure("Holdings by country of risk", "Look-through", data.geography.filter((one) => one.value > 0).map((one) => ({ name: one.name, value: one.value })), amount),
    "look.sectors": sharesFigure("Holdings by sector, % of the book", "Look-through", data.sectors.map((one) => ({ name: one.name, value: one.sharePercent })), pc),
    "look.currencies": sharesFigure("Net exposure by currency", "Look-through", data.currencies.map((one) => ({ name: one.currency, value: one.net ?? 0 })), amount),
    "look.issuers": sharesFigure("Exposure to the largest issuers", "Look-through", data.issuers.map((one) => ({ name: one.issuer, value: one.total })), amount,
      ["horizontal-bar", "treemap", "donut", "table"]),
    "liquidity.ladder": seriesFigure("Liquidity ladder by asset class", "Liquidity", data.liquidityTotals.map((one) => one.name),
      data.liquidity.map((row) => ({ name: row.name, values: row.buckets.map((one) => one.value) })), amount, ["stacked-bar", "grouped-bar", "table"]),
  };
}

/** @param picker the chart type switcher, beside the title, for a card that draws a chart */
function Card({ title, lead, foot, flush, picker, children }: {
  title: string;
  lead?: string;
  foot?: ReactNode;
  flush?: boolean;
  picker?: ReactNode;
  children: ReactNode;
}) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-3", flush && "px-5")}>
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{picker}<CardMenu /></div>
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
