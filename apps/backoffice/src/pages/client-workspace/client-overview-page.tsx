import { ApiError } from "@atomprive/api-client";
import {
  getGetClientWorkspaceQueryKey,
  useAddClientNote,
  useGetClientWorkspace,
  type BookAumPoint,
  type ClientWorkspace,
  type WorkspaceBankFile,
  type WorkspaceSlice,
  type ConvertedSlice,
} from "@atomprive/api-client/backoffice";
import { ConvertedNote, FileViewToggle, MissingRates, type FileView } from "../../components/converted-usd";
import { Alert, Button, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TableColumns } from "../../components/table-columns";
import { Link, useNavigate, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";
import { CardMenu, CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { ReportButton } from "../layout/report";
import { FIGURE_KINDS, FigureRow, FigureStrip, useFigureRow, useFiguresAsTable } from "../layout/figure-strip";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart, type ChartData } from "../layout/chart-kinds";
import type { Figures } from "../layout/own-cards";
import { periodName, useDrill } from "./drill-panel";
import type { FigureDetail } from "./figure-panel";

/**
 * A client's Overview, laid out the way the firm's own design draws it: what they are worth, the facts of their
 * mandate, how their worth has moved against the benchmark, how it is invested and held against its bands, how it has
 * performed, how quickly it turns to cash, what they hold most of, money coming and going, and alerts and notes.
 *
 * <p>Read only, apart from notes. Every band, deviation and return is the server's. A client whose figures come only
 * from their bank's files is shown that file as it was sent, and "not in bank file" wherever it holds nothing.
 */
/** The Overview's cards, in the firm's order, with the kinds of chart each can be drawn as (its own look first). */
const CARDS: Record<OverviewCard, LayoutMeta> = {
  headline: { title: "Net worth & key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  facts: { title: "Mandate & relationship", group: "Summary", wide: true },
  worth: { title: "Net Worth Evaluation", group: "Summary", charts: ["line", "area", "bar", "table"] },
  allocation: { title: "Asset Allocation", group: "Allocation & performance", charts: ["donut", "horizontal-bar", "mindmap", "table"] },
  bands: { title: "Target vs Actual Allocation", group: "Allocation & performance", charts: ["table", "grouped-bar", "horizontal-bar", "radar"] },
  performance: { title: "Performance", group: "Allocation & performance", charts: ["table", "grouped-bar", "bar"] },
  liquidity: { title: "Liquidity Profile", group: "Liquidity & cash", charts: ["horizontal-bar", "bar", "donut", "table"] },
  entities: { title: "Holding Entities", group: "Structure", charts: ["horizontal-bar", "donut", "mindmap", "table"] },
  positions: { title: "Top 10 Positions", group: "Holdings", charts: ["table", "horizontal-bar", "mindmap"] },
  flows: { title: "Projected Cash Flows", group: "Liquidity & cash", charts: ["stacked-bar", "grouped-bar", "waterfall", "line", "table"] },
  "look-through": { title: "Beneficial Look-through", group: "Structure", charts: ["stacked-bar", "donut", "mindmap", "table"] },
  alerts: { title: "Alerts & Notes", group: "Activity" },
};

type OverviewCard = "headline" | "facts" | "worth" | "allocation" | "bands" | "performance" | "liquidity" | "entities"
  | "positions" | "flows" | "look-through" | "alerts";

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as OverviewCard[];

export function ClientOverviewPage() {
  const { customerId = "" } = useParams();
  const workspace = useGetClientWorkspace<ClientWorkspace, ApiError>(customerId);
  const data = workspace.data;
  const view = useViewLayout("workspace.overview", CARDS, DEFAULT_CARDS);

  if (workspace.isError) return <Alert tone="danger">{workspace.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the workspace…</p>;

  const file = data.bankFile;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Client Overview
          </p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">{data.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{subtitle(data)}</p>
        </div>
        <div className="flex items-start gap-2"><ReportButton /><CustomizeButton view={view} /></div>
      </header>

      {/* Every card in the design's place until the reader moves it; a bank-file client's cards say what his file does
          not hold. One layout per reader for every client's Overview. */}
      <LayoutGrid view={view} screen="Client Overview" figures={file ? undefined : overviewFigures(data)} render={{
        headline: <Headline data={data} />,
        facts: <Facts data={data} />,
        worth: <WorthCard data={data} chart={cardChart(view, "worth")} />,
        allocation: <AllocationCard data={data} chart={cardChart(view, "allocation")} />,
        bands: <BandsCard data={data} chart={cardChart(view, "bands")} />,
        performance: <PerformanceCard data={data} chart={cardChart(view, "performance")} />,
        liquidity: <LiquidityCard data={data} chart={cardChart(view, "liquidity")} />,
        entities: <HoldingEntitiesCard data={data} chart={cardChart(view, "entities")} />,
        positions: <TopPositionsCard data={data} chart={cardChart(view, "positions")} />,
        flows: <CashFlowCard data={data} chart={cardChart(view, "flows")} />,
        "look-through": <LookThroughCard data={data} chart={cardChart(view, "look-through")} />,
        alerts: <AlertsAndNotes data={data} />,
      }} />

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {file ? `Values in ${file.converted.currency}, converted from the bank's own currencies at FX rates${file.converted.ratesOn ? ` of ${formatDate(file.converted.ratesOn)}` : ""}` : `Values in ${data.currency} unless stated`}; market data as of {formatDate(data.asOf)} close.
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/**
 * What the Overview offers for a card of the reader's own: the figures this page already reads for the client, named
 * once. A bank-file client's page offers none, as his file holds none of them.
 */
function overviewFigures(data: ClientWorkspace): Figures {
  const cur = data.currency;
  const amount = (value: number) => compact(value, cur);
  const percent = (value: number) => `${value.toFixed(1)}%`;
  const shares = (rows: { name: string; amount: number }[]): ChartData | null =>
    rows.length ? { shape: "shares", items: rows.map((one) => ({ name: one.name, value: one.amount })) } : null;
  const one = (name: string, value: number | null | undefined, max: number, target?: number | null): ChartData | null =>
    value == null ? null : { shape: "gauge", name, value, max, target };
  const h = data.headline;
  const periods = (data.performance?.periods ?? []).filter((period) => period.portfolio != null);
  const months = data.cashFlowMonths;
  return {
    "allocation.class": { label: "Holdings by asset class", group: "Allocation", kinds: ["donut", "horizontal-bar", "mindmap", "bar", "table"], format: amount, data: shares(data.byAssetClass) },
    "allocation.currency": { label: "Holdings by currency", group: "Allocation", kinds: ["donut", "horizontal-bar", "mindmap", "bar", "table"], format: amount, data: shares(data.byCurrency) },
    "allocation.entity": { label: "Holdings by entity", group: "Allocation", kinds: ["donut", "horizontal-bar", "mindmap", "bar", "table"], format: amount, data: shares(data.byEntity) },
    "allocation.bands": {
      label: "Actual against target, by asset class", group: "Allocation", kinds: ["grouped-bar", "horizontal-bar", "radar", "table"], format: percent,
      data: data.bands.length ? { shape: "series", categories: data.bands.map((band) => band.name), series: [
        { name: "Actual", values: data.bands.map((band) => band.actual) }, { name: "Target", values: data.bands.map((band) => band.target) },
      ] } : null,
    },
    "liquidity.buckets": {
      label: "Holdings by time to cash", group: "Liquidity & cash", kinds: ["horizontal-bar", "donut", "bar", "table"], format: amount,
      data: data.liquidity ? shares(data.liquidity.buckets.map((bucket) => ({ name: bucket.name, amount: bucket.amount }))) : null,
    },
    "liquidity.buffer": {
      label: "Cash buffer, % of net worth", group: "Liquidity & cash", kinds: ["gauge", "number", "table"], format: percent,
      data: one("Cash buffer", data.liquidity?.buffer, Math.max(20, (data.liquidity?.buffer ?? 0) * 1.2), data.liquidity?.floor),
      policy: data.liquidity?.floor != null ? { value: data.liquidity.floor, label: "liquidity floor" } : null,
    },
    "liquidity.liquid30": {
      label: "Liquid within 30 days, % of net worth", group: "Liquidity & cash", kinds: ["gauge", "number", "table"], format: percent,
      data: one("Liquid within 30 days", h.liquidShareOfNetWorth, 100),
    },
    "flows.months": {
      label: "Cash flows by month, next 12", group: "Liquidity & cash", kinds: ["stacked-bar", "grouped-bar", "waterfall", "line", "table"], format: amount,
      data: months.length ? { shape: "series", categories: months.map((month) => monthLabel(month.month)), series: [
        { name: "Inflows", values: months.map((month) => month.inflows) }, { name: "Outflows", values: months.map((month) => month.outflows) },
      ] } : null,
    },
    "flows.income": { label: "Income, next 12 months", group: "Liquidity & cash", kinds: ["number", "table"], format: amount, data: one("Income · next 12 months", h.incomeNext12Months, (h.incomeNext12Months ?? 0) * 2 || 1) },
    "worth.history": {
      label: "Investable assets over time", group: "Worth", kinds: ["line", "area", "bar", "table"], format: amount,
      data: data.worth.length > 1 ? { shape: "series", categories: data.worth.map((point) => monthYear(point.on)), series: [{ name: "Investable assets", values: data.worth.map((point) => point.amount) }] } : null,
    },
    "worth.net": { label: "Net worth", group: "Worth", kinds: ["number", "table"], format: amount, data: one("Net worth", h.netWorth, (h.netWorth ?? 0) * 2 || 1) },
    "worth.unfunded": { label: "Unfunded commitments", group: "Worth", kinds: ["number", "table"], format: amount, data: one("Unfunded commitments", h.unfunded, (h.unfunded ?? 0) * 2 || 1) },
    "performance.periods": {
      label: "Return by period against the benchmark", group: "Performance", kinds: ["grouped-bar", "bar", "line", "table"], format: (value) => `${value.toFixed(2)}%`,
      data: periods.length ? { shape: "series", categories: periods.map((period) => period.name), series: [
        { name: "Portfolio", values: periods.map((period) => period.portfolio) }, { name: "Benchmark", values: periods.map((period) => period.benchmark) },
      ] } : null,
    },
    "positions.top": {
      label: "Ten largest positions", group: "Holdings", kinds: ["horizontal-bar", "mindmap", "donut", "table"], format: amount,
      data: shares(data.topPositions.map((position) => ({ name: position.name, amount: position.value }))),
    },
    "entities.holding": {
      label: "What each holding entity holds", group: "Structure", kinds: ["horizontal-bar", "donut", "mindmap", "table"], format: amount,
      data: shares(data.holdingEntities.map((entity) => ({ name: entity.name, amount: entity.value }))),
    },
  };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Header band and facts                                                                                         */

function Headline({ data }: { data: ClientWorkspace }) {
  const { headline: h, currency: cur, bankFile: file } = data;
  const ytd = data.performance?.periods.find((one) => one.key === "YTD");
  const mtd = data.performance?.periods.find((one) => one.key === "MTD");
  const rows = useFiguresAsTable();
  const drill = useDrill();
  // A return opens its period: this month, or this year, of the performance screen's own months.
  const month = data.asOf.slice(0, 7);
  const year = data.asOf.slice(0, 4);
  // A key figure opens what this page holds behind it; a bank-file client's file holds none of them.
  const open = drill && !file ? (key: string, name: string, figure: FigureDetail) => () => drill({ by: "figure", key, name, figure }) : undefined;
  const buckets = (data.liquidity?.buckets ?? []).filter((one) => one.key === "DAYS_3" || one.key === "DAYS_30");
  const calls = data.cashFlows.filter((one) => one.kind === "CAPITAL_CALL");
  const income = data.cashFlows.filter((one) => INCOME_KINDS.has(one.kind));
  const pickNetWorth = open?.("net-worth", "Total net worth", {
    label: "Net worth", value: h.netWorth == null ? "—" : compact(h.netWorth, cur),
    note: "Investable assets and what is owned outright, less liabilities, consolidated across every entity.",
    facts: [{ label: "Investable", value: money(h.investable, cur) }, { label: "Owned outright", value: money(h.ownedOutright, cur) },
      { label: "Liabilities", value: money(h.liabilities, cur) }, { label: "Change YTD (investable)", value: h.investableChangeYearToDate == null ? "—" : signedCompact(h.investableChangeYearToDate, cur) },
      { label: "Entities", value: String(data.entityCount) }, { label: "Accounts", value: String(h.accounts) }, { label: "Custodians", value: String(h.custodians) }],
    chart: data.worth.length > 1 ? { title: "Investable assets over time", kind: "line", format: "money", currency: cur,
      data: { shape: "series", categories: data.worth.map((one) => monthYear(one.on)), series: [{ name: "Investable assets", values: data.worth.map((one) => one.amount) }] } } : undefined,
  });
  const stats = (
    <>
      <Stat label="MTD" file={!!file}
        onPick={drill && !file && mtd?.portfolio != null ? () => drill({ by: "period", key: month, name: periodName(month) }) : undefined}
        value={mtd?.portfolio == null ? null : signedPercent(mtd.portfolio)}
        note={mtd?.benchmark == null ? null : `Bench ${signedPercent(mtd.benchmark)}`} />
      <Stat label="YTD (TWR)" file={!!file}
        onPick={drill && !file && ytd?.portfolio != null ? () => drill({ by: "period", key: year, name: periodName(year) }) : undefined}
        value={ytd?.portfolio == null ? null : signedPercent(ytd.portfolio)}
        note={ytd?.benchmark == null ? null : `Bench ${signedPercent(ytd.benchmark)}${ytd.excess == null ? "" : ` · ${signedPoints(ytd.excess)}`}`} />
      <Stat label="Liquid ≤ 30 days" file={!!file}
        onPick={h.liquidWithin30Days == null ? undefined : open?.("liquid-30", "Liquid ≤ 30 days", {
          label: "Liquidity", value: compact(h.liquidWithin30Days, cur), note: "Holdings stated as turning into cash at fair value within thirty days.",
          facts: [{ label: "% of net worth", value: h.liquidShareOfNetWorth == null ? "—" : `${h.liquidShareOfNetWorth.toFixed(1)}%` },
            { label: "Cash buffer", value: data.liquidity?.buffer == null ? "—" : `${data.liquidity.buffer.toFixed(1)}%` },
            { label: "Liquidity floor", value: data.liquidity?.floor == null ? "—" : `${data.liquidity.floor.toFixed(1)}%` }],
          table: buckets.length === 0 ? undefined : { title: "By time to cash", columns: ["Bucket", "Amount", "Share of holdings"],
            rows: buckets.map((one) => [one.name, compact(one.amount, cur), `${one.sharePercent.toFixed(1)}%`]),
            total: ["Total", compact(h.liquidWithin30Days, cur), null] },
        })}
        value={h.liquidWithin30Days == null ? null : compact(h.liquidWithin30Days, cur)}
        note={h.liquidShareOfNetWorth == null ? null : `${h.liquidShareOfNetWorth.toFixed(1)}% of net worth`} />
      <Stat label="Unfunded commitments" file={!!file}
        onPick={open?.("unfunded", "Unfunded commitments", {
          label: "Private markets", value: compact(h.unfunded ?? 0, cur),
          note: "Committed to private funds and not yet called. The Overview holds the total only; each fund's commitment is on Private Markets.",
          facts: [{ label: "Vehicles", value: String(h.vehicles) }, { label: "Liquid cover", value: h.liquidCover == null ? "—" : `${h.liquidCover}×` }],
          table: calls.length === 0 ? undefined : { title: "Capital calls expected in the next 12 months", columns: ["Due", "Fund", "Amount"],
            rows: calls.map((one) => [formatDate(one.on), one.detail ?? one.title, signedCompact(one.amount, one.currency)]) },
          link: { to: "private-markets", label: "Private Markets" },
        })}
        value={h.unfunded == null ? (file ? null : compact(0, cur)) : compact(h.unfunded, cur)}
        note={h.unfunded == null ? "Nothing committed and uncalled" : `${h.vehicles} vehicle${h.vehicles === 1 ? "" : "s"}${h.liquidCover == null ? "" : ` · ${h.liquidCover}× liquid cover`}`} />
      <Stat label="Income · next 12M" file={!!file}
        onPick={h.incomeNext12Months == null ? undefined : open?.("income-12m", "Income · next 12 months", {
          label: "Cash flows", value: compact(h.incomeNext12Months, cur), note: "Coupons, dividends and distributions expected over the next twelve months.",
          facts: [{ label: "Expected payments", value: String(income.length) }],
          chart: data.cashFlowMonths.length === 0 ? undefined : { title: "Expected inflows by month", kind: "bar", format: "money", currency: cur,
            data: { shape: "series", categories: data.cashFlowMonths.map((one) => monthLabel(one.month)), series: [{ name: "Inflows", values: data.cashFlowMonths.map((one) => one.inflows) }] } },
          table: income.length === 0 ? undefined : { title: "Income expected", columns: ["Date", "Payment", "Amount"],
            rows: income.map((one) => [formatDate(one.on), `${one.title}${one.detail ? ` · ${one.detail}` : ""}`, signedCompact(one.amount, one.currency)]) },
        })}
        value={h.incomeNext12Months == null ? null : compact(h.incomeNext12Months, cur)}
        note="Coupons, dividends, distributions" />
    </>
  );
  // As a table: net worth first, then the same figures one to a row.
  if (rows) {
    return (
      <FigureStrip>
        <FigureRow label="Total net worth" value={file ? compact(file.converted.total, file.converted.currency) : h.netWorth == null ? "—" : compact(h.netWorth, cur)}
          note={file ? `Bank holdings converted to ${file.converted.currency}${file.converted.ratesOn ? ` at FX rates of ${formatDate(file.converted.ratesOn)}` : ""}` : `Investable ${money(h.investable, cur)} · Owned outright ${money(h.ownedOutright, cur)} · Liabilities ${money(h.liabilities, cur)}`} />
        {stats}
      </FigureStrip>
    );
  }
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      {/* Net worth and the lines under it are one figure in a report. */}
      <div data-figure {...(pickNetWorth ? { role: "button", tabIndex: 0, title: "Open its breakdown", className: "-m-1 cursor-pointer rounded-md p-1 hover:bg-canvas",
        onClick: pickNetWorth, onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter") pickNetWorth(); } } : {})}>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Total net worth · consolidated</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {file ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-4xl font-bold tabular-nums">{compact(file.converted.total, file.converted.currency)}</span>
            <Marker>bank holdings in {file.converted.currency}{file.converted.ratesOn ? ` · FX rates of ${formatDate(file.converted.ratesOn)}` : ""}</Marker>
          </div>
        ) : (
          <>
            <span className="text-4xl font-bold tabular-nums">{h.netWorth == null ? "—" : compact(h.netWorth, cur)}</span>
            {h.investableChangeYearToDate != null && (
              <span className={cn("text-sm font-semibold", toneOf(h.investableChangeYearToDate))}>
                {h.investableChangeYearToDate >= 0 ? "▲" : "▼"} {signedCompact(h.investableChangeYearToDate, cur)} investable
                {ytd?.portfolio != null && ` · ${signedPercent(ytd.portfolio)} YTD`}
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {file ? (
          <>
            Investable {money(file.converted.total, file.converted.currency)} · Owned outright <NotInFile /> · Liabilities <NotInFile />
            {data.entityCount > 0 && <>{" · "}{data.entityCount} {data.entityCount === 1 ? "entity" : "entities"} (entered by staff)</>}
            {" · "}{h.accounts} accounts · {h.custodians} custodian{h.custodians === 1 ? "" : "s"} · as of {file.asOf ? formatDate(file.asOf) : "—"}
          </>
        ) : (
          <>
            Investable {money(h.investable, cur)} · Owned outright {money(h.ownedOutright, cur)} · Liabilities {money(h.liabilities, cur)}
            {" · "}{data.entityCount} {data.entityCount === 1 ? "entity" : "entities"}
            {" · "}{h.accounts} accounts · {h.custodians} custodian{h.custodians === 1 ? "" : "s"}
          </>
        )}
      </p>
      </div>
      {file && <div className="mt-2"><MissingRates converted={file.converted} /></div>}
      <div data-figure-strip className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats}
      </div>
    </section>
  );
}

function Stat({ label, value, note, file, onPick }: { label: string; value: string | null; note: ReactNode; file: boolean; onPick?: () => void }) {
  if (useFigureRow()) return <FigureRow label={label} value={value ?? (file ? <NotInFile /> : "—")} note={file ? null : note} />;
  return (
    <div {...(onPick ? { role: "button", tabIndex: 0, title: "Open its breakdown", className: "-m-1 cursor-pointer rounded-md p-1 hover:bg-canvas",
      onClick: onPick, onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter") onPick(); } } : {})}>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value ?? (file ? <NotInFile /> : <Muted>—</Muted>)}</p>
      {!file && note && <p className="text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

function Facts({ data }: { data: ClientWorkspace }) {
  const f = data.facts;
  const file = !!data.bankFile;
  const fromFile = (value: ReactNode | null | undefined) => value ?? (file ? <NotInFile /> : <Muted>—</Muted>);
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* A bank-file client's mandate and policy dates are what staff set for him, never what the bank sent. */}
      {file && (f.mandate || f.lastReview || f.nextReview) && (
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="inline-block w-fit rounded-sm border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-3xs font-semibold whitespace-nowrap text-amber-800">
            Mandate and review dates entered by staff · not from the bank file
          </span>
        </div>
      )}
      <Fact label="Relationship lead" value={f.relationshipManager ?? <Muted>Not recorded</Muted>} />
      <Fact label="Mandate" value={fromFile(f.mandate)} />
      {/* Which model the client is measured against, by the model's name alone, whether or not an index is recorded for
          it: the blended benchmark's long name and composition, where there is one, are on Performance. */}
      <Fact label="Benchmark" value={fromFile(f.mandate ?? f.benchmark)} />
      <Fact label="Base currency" value={f.baseCurrency ?? <Muted>Not recorded</Muted>} />
      <Fact label="Client since" value={f.clientSince ? formatDate(f.clientSince) : <Muted>—</Muted>} />
      <Fact label="Last review" value={fromFile(f.lastReview && formatDate(f.lastReview))} />
      <Fact label="Next review" value={fromFile(f.nextReview && formatDate(f.nextReview))} />
      <Fact label="Risk profile" value={fromFile(f.riskProfile && `${titleCase(f.riskProfile)}${f.ipsVersion ? ` · Signed IPS ${f.ipsVersion}` : ""}`)} />
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Worth and allocation                                                                                          */

const RANGES = [
  { id: "1Y", months: 12 },
  { id: "3Y", months: 36 },
  { id: "5Y", months: 60 },
  { id: "ITD", months: null },
] as const;

function WorthCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("5Y");
  const months = RANGES.find((one) => one.id === range)?.months ?? null;
  const from = months == null ? "" : shiftMonths(data.asOf, -months);
  // Quarter ends within the range, and today's reading last, as the design draws them.
  const cut = (points: BookAumPoint[]) => points.filter((one, at) =>
    one.on >= from && (at === points.length - 1 || [3, 6, 9, 12].includes(Number(one.on.slice(5, 7)))));
  // A bank-file client's worth is his bank's files in dollars, every day they state, each at today's rates.
  const conv = data.bankFile?.converted ?? null;
  const cur = conv ? conv.currency : data.currency;
  const worth = conv ? conv.history : cut(data.worth);
  const bench = conv ? [] : cut(data.benchmarkEquivalent);
  const total = conv ? [] : cut(data.totalWorth ?? []);
  const flows = data.externalFlows.filter((one) => one.on >= from).reduce((sum, one) => sum + one.amount, 0);
  const option = useMemo(() => {
    const colours = ink();
    const days = worth.map((one) => one.on);
    // A single reading is drawn as a marked, labelled point rather than an empty box.
    const single = worth.length === 1;
    const benchOn = new Map(bench.map((one) => [one.on, one.amount]));
    const totalOn = new Map(total.map((one) => [one.on, one.amount]));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, cur) },
      xAxis: {
        type: "category", boundaryGap: single,
        data: days,
        axisLabel: { color: colours.muted, formatter: (value: string, at: number) => (at === days.length - 1 ? monthYear(value) : quarterLabel(value)) },
        axisLine: { lineStyle: { color: colours.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitNumber: 4,
        axisLabel: { color: colours.muted, formatter: axisMoney([...worth, ...bench, ...total].map((one) => one.amount), cur) },
        splitLine: { lineStyle: { color: colours.line } },
      },
      series: [
        {
          type: "line", name: "Investable assets", data: worth.map((one) => one.amount), showSymbol: single, symbolSize: 8,
          label: { show: single, position: "top", color: colours.text, formatter: ({ value }: { value: number }) => compact(value, cur) },
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas },
        },
        ...(total.length > 1 ? [{
          type: "line", name: "Total net worth", data: days.map((day) => totalOn.get(day) ?? null), connectNulls: true,
          showSymbol: false, lineStyle: { color: colours.primary, width: 1.5 }, itemStyle: { color: colours.primary },
        }] : []),
        ...(bench.length > 1 ? [{
          type: "line", name: "Benchmark-equivalent (after flows)", data: days.map((day) => benchOn.get(day) ?? null),
          showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger },
        }] : []),
      ],
    };
  }, [worth, bench, total, cur]);
  const figures = useMemo<ChartData>(() => {
    const benchOn = new Map(bench.map((one) => [one.on, one.amount]));
    const totalOn = new Map(total.map((one) => [one.on, one.amount]));
    return {
      shape: "series",
      categories: worth.map((one, at) => (at === worth.length - 1 ? monthYear(one.on) : quarterLabel(one.on))),
      series: [
        { name: "Investable assets", values: worth.map((one) => one.amount) },
        ...(total.length > 1 ? [{ name: "Total net worth", values: worth.map((one) => totalOn.get(one.on) ?? null) }] : []),
        ...(bench.length > 1 ? [{ name: "Benchmark-equivalent", values: worth.map((one) => benchOn.get(one.on) ?? null) }] : []),
      ],
    };
  }, [worth, bench, total]);
  const format = useMemo(() => (value: number) => compact(value, cur), [cur]);
  const drill = useDrill();
  // A point opens its month on the performance screen; a bank-file client's worth has no performance behind it.
  const pickPoint = drill && !conv ? (index: number) => {
    const point = worth[index];
    if (point) drill({ by: "period", key: point.on.slice(0, 7), name: periodName(point.on) });
  } : undefined;
  return (
    <Card title="Net Worth Evaluation" picker={(!data.bankFile || conv) && chart.picker}
      lead={conv ? `Bank holdings in ${cur} · each day the bank's files state, at today's FX rates` : data.bankFile ? undefined
        : `Quarter-end values, ${cur} · after net external flows of ${signedCompact(flows, cur)}`}
      action={!data.bankFile && <Toggle label="Period shown" value={range} onChange={setRange} options={RANGES.map((one) => [one.id, one.id])} />}>
      {data.bankFile && !conv ? <FileBlock /> : (
        <>
          {worth.length === 0 ? <Empty>There is no valuation history to draw yet.</Empty> : chart.own ? (
            <Chart option={option} height={260} label="The portfolio's worth at each quarter end, beside its benchmark-equivalent"
              onPick={pickPoint ? (_, index) => pickPoint(index) : undefined} />
          ) : (
            <KindChart data={figures} kind={chart.kind!} format={format} height={260} label="The portfolio's worth at each quarter end, beside its benchmark-equivalent"
              onPick={pickPoint} />
          )}
          {conv && <ConvertedNote converted={conv} />}
          {!conv && <p className="mt-2 text-3xs text-ink-muted italic">
            {worth.length === 1 && "One reading on file so far: it is marked as a point, and the line starts with the next. "}
            {total.length > 1
              ? "Total net worth adds what is owned outright, valued at each month end between its appraisals (demo history), and loans at today's balance. "
              : "Total net worth is not drawn: what is owned outright and what is owed have no history on file."}
            {worth.length > 1 && data.benchmarkEquivalent.length < 2 && " No benchmark history is on file for this mandate."}
          </p>}
        </>
      )}
    </Card>
  );
}

function AllocationCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const [by, setBy] = useState<"class" | "entity" | "currency">("class");
  const file = data.bankFile;
  // A bank-file client's lines in dollars, by the bank's own class or by the currency the bank wrote them in.
  const conv = file?.converted ?? null;
  const asSlices = (list: ConvertedSlice[]): WorkspaceSlice[] =>
    list.map((one) => ({ key: one.name, name: one.name, amount: one.usd, sharePercent: one.share }));
  const slices = conv ? (by === "class" ? asSlices(conv.byClass) : by === "currency" ? asSlices(conv.byCurrency) : [])
    : by === "class" ? data.byAssetClass : by === "entity" ? data.byEntity : data.byCurrency;
  const cur = conv ? conv.currency : data.currency;
  const total = slices.reduce((sum, one) => sum + one.amount, 0);
  const drill = useDrill();
  const navigate = useNavigate();
  // A class, currency or entity opens its breakdown (what no entity holds opens the holdings); what is owned outright
  // opens the screen that registers it.
  const pick = (slice: WorkspaceSlice) => {
    if (conv) return;
    if (by === "entity") {
      if (slice.key) drill?.({ by: "legalEntity", key: slice.key, name: slice.name });
      else navigate(`/client-workspace/${data.customerId}/holdings`);
    }
    else if (slice.key === "OWNED_OUTRIGHT") navigate(`/client-workspace/${data.customerId}/collectibles`);
    else drill?.({ by, key: slice.key, name: slice.name });
  };
  return (
    <Card title="Asset Allocation" picker={(!file || (conv && by !== "entity")) && chart.picker}
      action={<Toggle label="Broken down by" value={by} onChange={setBy} options={[["class", "Asset class"], ["entity", "Entity"], ["currency", "Currency"]]} />}>
      {file && (!conv || by === "entity") ? (
        by !== "currency" ? <FileBlock /> : (
          <>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {file.holdings.map((one) => (
                  <tr key={one.currency} className={cn(drill && "cursor-pointer hover:bg-canvas")}
                    onClick={drill ? () => drill({ by: "currency", key: one.currency, name: one.currency }) : undefined}>
                    <td className="py-1.5 font-semibold">
                      {drill ? (
                        <button type="button" className="text-left hover:text-primary-700 hover:underline"
                          onClick={(event) => { event.stopPropagation(); drill({ by: "currency", key: one.currency, name: one.currency }); }}>
                          {one.currency}
                        </button>
                      ) : one.currency}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{compact(one.amount, one.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-3xs text-ink-muted italic">His file's lines summed in each currency the bank used; not converted, so no shares.</p>
          </>
        )
      ) : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, cur)} height={260} label={`Breakdown by ${by}`}
          data={{ shape: "shares", items: slices.map((one) => ({ name: one.name, value: one.amount })) }}
          onPick={(at) => { const slice = slices[at]; if (slice) pick(slice); }} />
      ) : (
        <Donut slices={slices} currency={cur} onPick={conv ? undefined : pick}
          centre={compact(conv || by === "currency" || data.headline.netWorth == null ? total : data.headline.netWorth, cur)}
          centreLabel={conv ? "Bank holdings" : by === "currency" ? "Holdings" : "Net worth"} />
      )}
      {conv && by !== "entity" && <ConvertedNote converted={conv} />}
      {!file && by === "entity" && <p className="mt-2 text-3xs text-ink-muted italic">Each top-level entity at look-through value; what no entity holds is a slice of its own.</p>}
      {!file && by === "currency" && <p className="mt-2 text-3xs text-ink-muted italic">The portfolio's lines by the currency each is exposed to; what is owned outright is not in it.</p>}
    </Card>
  );
}

function Donut({ slices, currency, centre, centreLabel, onPick }: {
  slices: WorkspaceSlice[];
  currency: string;
  centre: string;
  centreLabel: string;
  onPick?: (slice: WorkspaceSlice) => void;
}) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, currency) },
      series: [{
        type: "pie", radius: ["62%", "86%"], label: { show: false },
        itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: slices.map((one, at) => ({ name: one.name, value: one.amount, itemStyle: { color: INK[at % INK.length] } })),
      }],
    };
  }, [slices, currency]);
  if (slices.length === 0) return <Empty>Nothing to break down yet.</Empty>;
  return (
    <>
      <div className="relative mx-auto w-full max-w-52">
        <Chart option={option} height={190} label={`Breakdown by ${centreLabel.toLowerCase()}`}
          onPick={onPick ? (_, at) => { const slice = slices[at]; if (slice) onPick(slice); } : undefined} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{centre}</p>
            <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{centreLabel}</p>
          </div>
        </div>
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody className="divide-y divide-line">
          {slices.map((one, at) => (
            <tr key={one.key || "none"} className={cn(onPick && "cursor-pointer hover:bg-canvas")} onClick={onPick ? () => onPick(one) : undefined}>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                  {onPick ? (
                    <button type="button" className="text-left hover:text-primary-700 hover:underline" onClick={(event) => { event.stopPropagation(); onPick(one); }}>
                      {one.name}
                    </button>
                  ) : one.name}
                </span>
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{compact(one.amount, currency)}</td>
              <td className="w-14 py-1.5 text-right text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Bands and performance                                                                                         */

function BandsCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const bands = data.bands;
  const scale = Math.max(10, ...bands.map((one) => Math.max(one.upper, one.actual))) * 1.1;
  // A share below nothing (a class a loan outweighs) is drawn at the axis, never off the left of it.
  const at = (value: number) => `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;
  const conv = data.bankFile?.converted ?? null;
  const drill = useDrill();
  // A class opens its breakdown; a bank-file client's classes are EFG's read as the house's, so they are not opened.
  const pick = drill && !data.bankFile ? (one: (typeof bands)[number]) => drill({ by: "class", key: one.assetClass, name: one.name }) : undefined;
  return (
    <Card title="Target vs Actual Allocation" picker={(!data.bankFile || bands.length > 0) && chart.picker}
      lead={data.bankFile
        ? (bands.length === 0 ? undefined : `EFG's classes read as the house's · his bank lines in ${conv?.currency ?? "USD"} at FX rates${conv?.ratesOn ? ` of ${formatDate(conv.ratesOn)}` : ""}, as IPS Monitoring reads them`)
        : `% of investable assets (${money(data.headline.investable, data.currency)}) · owned outright excluded`}
      action={!data.bankFile && (
        <Link to={`/client-workspace/${data.customerId}/holdings`} className="text-xs font-semibold text-primary-700 hover:underline">
          Sub-class detail ({data.subClasses})
        </Link>
      )}>
      {data.bankFile && bands.length === 0 ? <FileBlock /> : bands.length === 0 ? <Empty>No model to measure against yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={260} label="Each asset class's actual weight against its target"
          data={{ shape: "series", categories: bands.map((one) => one.name), series: [
            { name: "Actual", values: bands.map((one) => one.actual) },
            { name: "Target", values: bands.map((one) => one.target) },
          ] }}
          onPick={pick ? (index) => { const one = bands[index]; if (one) pick(one); } : undefined} />
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3 pl-5">Asset class</th>
                  <th scope="col" className="w-2/5 px-3 py-2">Position vs band</th>
                  <th scope="col" className="px-3 py-2 text-right">Actual</th>
                  <th scope="col" className="px-3 py-2 text-right">Target</th>
                  <th scope="col" className="py-2 pr-5 pl-3 text-right">Deviation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bands.map((one) => (
                  <tr key={one.assetClass} className={cn(pick && "cursor-pointer hover:bg-canvas")} onClick={pick ? () => pick(one) : undefined}>
                    <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-medium">
                      {pick ? (
                        <button type="button" className="text-left hover:text-primary-700 hover:underline"
                          onClick={(event) => { event.stopPropagation(); pick(one); }}>
                          {one.name}
                        </button>
                      ) : one.name}
                    </th>
                    <td className="px-3 py-2.5">
                      <span className="relative block h-3" aria-hidden="true"
                        title={`Band ${one.lower.toFixed(1)}% – ${one.upper.toFixed(1)}%`}>
                        <span className="absolute top-0 h-3 rounded-sm bg-slate-100"
                          style={{ left: at(one.lower), width: `calc(${at(one.upper)} - ${at(one.lower)})` }} />
                        <span className={cn("absolute top-1 left-0 h-1 rounded-full", one.pastNearEdge ? "bg-red-600" : "bg-primary-600")}
                          style={{ width: at(one.actual) }} />
                        <span className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: at(one.target) }} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{one.actual.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-ink-muted tabular-nums">{one.target.toFixed(1)}%</td>
                    <td className="py-2.5 pr-5 pl-3 text-right">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
                        one.pastNearEdge ? "bg-red-50 text-red-700" : "bg-slate-100 text-ink-soft")}
                        title={one.usedPercent == null ? undefined : `${one.usedPercent}% of the band used`}>
                        {signedPoints(one.deviation)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-primary-600" aria-hidden="true" />Actual</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-slate-100" aria-hidden="true" />Tolerance band</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" aria-hidden="true" />Target</li>
            <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-red-600" aria-hidden="true" />Deviation &gt; 75% of band</li>
          </ul>
        </>
      )}
    </Card>
  );
}

function PerformanceCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const periods = data.performance?.periods ?? [];
  const measured = periods.filter((one) => one.portfolio != null);
  const label = (one: (typeof periods)[number]) => (one.key === "ITD" ? "ITD ann." : one.name);
  const widest = Math.max(0.1, ...periods.map((one) => Math.abs(one.excess ?? 0)));
  const drill = useDrill();
  // This month and this year open their period; the longer ones are not one period the panel reads.
  const periodKey = (one: (typeof periods)[number]) =>
    one.key === "MTD" ? data.asOf.slice(0, 7) : one.key === "YTD" ? data.asOf.slice(0, 4) : null;
  // The longer windows open their own figures: the portfolio against the benchmark over that window.
  const figureOf = (one: (typeof periods)[number]): FigureDetail => ({
    label: "Performance", value: one.portfolio == null ? "—" : signedPercent(one.portfolio),
    note: `Time-weighted return, net of fees, over ${one.key === "ITD" ? `the life of the portfolio${data.performance?.since ? ` since ${monthYear(data.performance.since)}` : ""}, annualised` : `the last ${one.name}`}.`,
    facts: [{ label: "Portfolio", value: one.portfolio == null ? "—" : signedPercent(one.portfolio) },
      { label: "Benchmark", value: one.benchmark == null ? "—" : signedPercent(one.benchmark) },
      { label: "Excess", value: one.excess == null ? "—" : signedPoints(one.excess) }],
    chart: measured.length === 0 ? undefined : { title: "Every period against the benchmark", kind: "grouped-bar", format: "percent",
      data: { shape: "series", categories: measured.map(label), series: [
        { name: "Portfolio", values: measured.map((each) => each.portfolio) }, { name: "Benchmark", values: measured.map((each) => each.benchmark) },
      ] } },
    link: { to: "performance", label: "Performance" },
  });
  const pick = (one: (typeof periods)[number] | undefined) => {
    if (!one || one.portfolio == null || !drill) return;
    const key = periodKey(one);
    if (key) drill({ by: "period", key, name: periodName(key) });
    else drill({ by: "figure", key: `performance:${one.key}`, name: one.key === "ITD" ? "ITD ann." : one.name, figure: figureOf(one) });
  };
  const canPick = (one: (typeof periods)[number]) => !!drill && one.portfolio != null;
  return (
    <Card title="Performance" lead="Time-weighted, net of fees" picker={!data.bankFile && chart.picker}
      action={<Link to={`/client-workspace/${data.customerId}/performance`} className="text-xs font-semibold text-primary-700 hover:underline">Attribution</Link>}>
      {data.bankFile ? <FileBlock /> : periods.length === 0 ? <Empty>Not enough history to measure yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(2)}%`} height={240}
          label={chart.kind === "bar" ? "Excess return over the benchmark for each period" : "The portfolio's return against the benchmark for each period"}
          data={{ shape: "series", categories: measured.map(label), series: chart.kind === "bar"
            ? [{ name: "Excess", values: measured.map((one) => one.excess) }]
            : [{ name: "Portfolio", values: measured.map((one) => one.portfolio) }, { name: "Benchmark", values: measured.map((one) => one.benchmark) }] }}
          onPick={drill ? (index) => pick(measured[index]) : undefined} />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Period</th>
                <th scope="col" className="px-3 py-2 text-right">Portfolio</th>
                <th scope="col" className="px-3 py-2 text-right">Bench</th>
                <th scope="col" className="px-3 py-2 text-right">Excess pp</th>
                <th scope="col" className="py-2 pr-5 pl-3"><span className="sr-only">Excess bar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.map((one) => (
                <tr key={one.key} className={cn(canPick(one) && "cursor-pointer hover:bg-canvas")} onClick={canPick(one) ? () => pick(one) : undefined}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium whitespace-nowrap">
                    {canPick(one) ? (
                      <button type="button" className="text-left hover:text-primary-700 hover:underline"
                        onClick={(event) => { event.stopPropagation(); pick(one); }}>
                        {one.key === "ITD" && data.performance?.since ? `ITD ann. (${monthYear(data.performance.since)})` : one.name}
                      </button>
                    ) : one.key === "ITD" && data.performance?.since ? `ITD ann. (${monthYear(data.performance.since)})` : one.name}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {one.portfolio == null ? <Muted>{one.key === "ITD" ? "under a year" : "not enough history"}</Muted> : <Signed value={one.portfolio} unit="%" />}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-soft tabular-nums">{one.benchmark == null ? <Muted>—</Muted> : signedPercent(one.benchmark)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{one.excess == null ? <Muted>—</Muted> : <Signed value={one.excess} unit="" />}</td>
                  <td className="py-2 pr-5 pl-3">
                    {one.excess != null && (
                      <span className="relative block h-2 w-16 rounded-xs bg-slate-100" aria-hidden="true">
                        <span className={cn("absolute top-0 bottom-0 rounded-xs", one.excess < 0 ? "bg-red-500" : "bg-emerald-600")}
                          style={one.excess < 0 ? { right: "50%", width: `${(Math.abs(one.excess) / widest) * 50}%` } : { left: "50%", width: `${(one.excess / widest) * 50}%` }} />
                      </span>
                    )}
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

/* ------------------------------------------------------------------------------------------------------------ */
/* Liquidity, positions, cash flows                                                                              */

function LiquidityCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const liquidity = data.liquidity;
  const largest = Math.max(1, ...(liquidity?.buckets ?? []).map((one) => one.amount));
  const drill = useDrill();
  // A rung opens the lines stated in it, read by the rung's name as the holdings book writes it; none stated, by nothing.
  const pick = drill ? (one: WorkspaceSlice) => drill({ by: "liquidity", key: one.key ? one.name : "", name: one.name }) : undefined;
  return (
    <Card title="Liquidity Profile" lead="Time to convert to cash at fair value" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : !liquidity ? <Empty>No holdings written down yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={240} label="Holdings by how quickly they turn to cash"
          data={{ shape: "shares", items: liquidity.buckets.map((one) => ({ name: one.name, value: one.amount })) }}
          onPick={pick ? (index) => { const one = liquidity.buckets[index]; if (one) pick(one); } : undefined} />
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm" aria-hidden="true">
            {liquidity.buckets.map((one, at) => (
              <span key={one.key || "none"} className={cn(pick && "cursor-pointer")} onClick={pick ? () => pick(one) : undefined}
                style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {liquidity.buckets.map((one, at) => (
              <li key={one.key || "none"} className={cn("grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm", pick && "cursor-pointer rounded-md hover:bg-canvas")}
                onClick={pick ? () => pick(one) : undefined}>
                {pick ? (
                  <button type="button" className="text-left hover:text-primary-700 hover:underline"
                    onClick={(event) => { event.stopPropagation(); pick(one); }}>
                    {one.name}
                  </button>
                ) : <span>{one.name}</span>}
                <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(one.amount / largest) * 100}%`, background: INK[at % INK.length] }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{compact(one.amount, data.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
            Liquidity buffer (cash)
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-ink-soft tabular-nums">
              {liquidity.buffer == null ? "—" : `${liquidity.buffer.toFixed(1)}%`}
              {liquidity.floor != null && ` · floor ${liquidity.floor.toFixed(1)}%`}
            </span>
          </p>
        </>
      )}
    </Card>
  );
}

function TopPositionsCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const positions = data.topPositions;
  const drill = useDrill();
  const navigate = useNavigate();
  const largest = Math.max(1, ...positions.map((one) => one.weightPercent));
  const total = positions.reduce((sum, one) => sum + one.value, 0);
  const weight = positions.reduce((sum, one) => sum + one.weightPercent, 0);
  const [fileView, setFileView] = useState<FileView>("converted");
  return (
    <Card title="Top 10 Positions" lead={data.bankFile ? undefined : "Look-through across all entities"} picker={!data.bankFile && chart.picker}
      action={<div className="flex flex-wrap items-center gap-2">
        {data.bankFile && <FileViewToggle value={fileView} onChange={setFileView} />}
        <Link to={`/client-workspace/${data.customerId}/holdings`} className="text-xs font-semibold text-primary-700 hover:underline">All holdings</Link>
      </div>}>
      {data.bankFile ? (fileView === "converted" ? <ConvertedPositions file={data.bankFile} /> : <FilePositions file={data.bankFile} />) : positions.length === 0 ? <Empty>No holdings written down yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={300} label="The ten largest positions by value"
          data={{ shape: "shares", items: positions.map((one) => ({ name: one.name, value: one.value })) }}
          onPick={(at) => {
            const one = positions[at];
            if (!one) return;
            if (one.kind === "Owned outright") navigate(`/client-workspace/${data.customerId}/collectibles`);
            else drill?.({ by: "position", key: one.name, name: one.name });
          }} />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">#</th>
                <th scope="col" className="px-3 py-2">Position</th>
                <th scope="col" className="px-3 py-2">Held by</th>
                <th scope="col" className="px-3 py-2 text-right">Value</th>
                <th scope="col" className="px-3 py-2 text-right">Weight</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {positions.map((one, at) => (
                <tr key={`${one.name}-${at}`} className="cursor-pointer hover:bg-canvas"
                  onClick={() => one.kind === "Owned outright"
                    ? navigate(`/client-workspace/${data.customerId}/collectibles`)
                    : drill?.({ by: "position", key: one.name, name: one.name })}>
                  <td className="py-2 pr-2 pl-5 text-xs text-ink-muted tabular-nums">{String(at + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline">{one.name}</button>
                    <span className="block text-xs text-ink-muted">{one.kind}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{one.heldBy ?? <Muted>—</Muted>}</td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">{compact(one.value, data.currency)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center justify-end gap-2">
                      <span className="text-xs tabular-nums">{one.weightPercent.toFixed(1)}%</span>
                      <span className="block h-1.5 w-14 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.weightPercent / largest) * 100}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-5 pl-3 text-right tabular-nums">{one.yearToDate == null ? <Muted>—</Muted> : <Signed value={one.yearToDate} unit="%" />}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td className="px-3 py-2">Top {positions.length} total</td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums">{compact(total, data.currency)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">{weight.toFixed(1)}%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** The kinds of expected flow the server adds up as income for the next twelve months. */
const INCOME_KINDS = new Set(["COUPON", "DIVIDEND", "DISTRIBUTION"]);

/** How many expected flows the card lists before the rest are asked for. */
const FLOWS_SHOWN = 8;

function CashFlowCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const [allFlows, setAllFlows] = useState(false);
  const drill = useDrill();
  // A month's bar opens that month's flows; a row opens every flow of its kind, or a capital call its fund.
  const pickMonth = (index: number) => {
    const month = data.cashFlowMonths[index];
    if (month) drill?.({ by: "month", key: month.month.slice(0, 7), name: longMonth(month.month) });
  };
  const pickFlow = (one: ClientWorkspace["cashFlows"][number]) => {
    if (one.kind === "CAPITAL_CALL" && one.detail) drill?.({ by: "fund", key: one.detail, name: one.detail });
    else drill?.({ by: "flowType", key: one.title, name: one.title });
  };
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: {
        type: "category", data: data.cashFlowMonths.map((one) => monthLabel(one.month)),
        axisLabel: { color: colours.muted }, axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false },
      },
      yAxis: {
        type: "value", splitNumber: 4,
        axisLabel: { color: colours.muted, formatter: axisMoney(data.cashFlowMonths.flatMap((one) => [one.inflows, one.outflows, 0]), data.currency) },
        splitLine: { lineStyle: { color: colours.line } },
      },
      series: [
        { type: "bar", name: "Inflows", stack: "flows", data: data.cashFlowMonths.map((one) => one.inflows), itemStyle: { color: colours.primary } },
        { type: "bar", name: "Outflows", stack: "flows", data: data.cashFlowMonths.map((one) => one.outflows), itemStyle: { color: colours.danger } },
      ],
    };
  }, [data.cashFlowMonths, data.currency]);
  return (
    <Card title="Projected Cash Flows · 12 Months" lead="Coupons, dividends, distributions, calls, running costs" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileMovements file={data.bankFile} /> : (
      <div className="space-y-3">
        {data.cashFlows.length === 0 ? <Empty>Nothing expected in the next twelve months.</Empty> : (
          chart.own ? (
            <Chart option={option} height={220} label="Money expected in and out each month for the next twelve"
              onPick={drill ? (_, index) => pickMonth(index) : undefined} />
          ) : (
            <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={220} label="Money expected in and out each month for the next twelve"
              data={{ shape: "series", categories: data.cashFlowMonths.map((one) => monthLabel(one.month)), series: [
                { name: "Inflows", values: data.cashFlowMonths.map((one) => one.inflows), colour: ink().primary },
                { name: "Outflows", values: data.cashFlowMonths.map((one) => one.outflows), colour: ink().danger },
              ] }}
              onPick={drill ? pickMonth : undefined} />
          )
        )}
        <ul className="divide-y divide-line text-sm">
          {/* Whole rows only: the first few, then the rest on request, so a row is never cut through. */}
          {(allFlows ? data.cashFlows : data.cashFlows.slice(0, FLOWS_SHOWN)).map((one, at) => (
            <li key={`${one.on}-${at}`}>
              <button type="button" onClick={() => pickFlow(one)} disabled={!drill}
                className="flex w-full items-center gap-3 py-2 text-left enabled:hover:bg-canvas">
                <span className="w-14 shrink-0 text-xs text-ink-muted tabular-nums">{dayMonth(one.on)}</span>
                <span className="min-w-0 flex-1 truncate">{one.title}{one.detail && ` · ${one.detail}`}</span>
                <span className={cn("shrink-0 font-semibold tabular-nums", toneOf(one.amount))}>{signedCompact(one.amount, one.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
        {data.cashFlows.length > FLOWS_SHOWN && (
          <button type="button" onClick={() => setAllFlows((now) => !now)}
            className="text-xs font-semibold text-primary-700 hover:underline">
            {allFlows ? "Show fewer" : `+${data.cashFlows.length - FLOWS_SHOWN} more`}
          </button>
        )}
      </div>
      )}
    </Card>
  );
}

function HoldingEntitiesCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const largest = Math.max(1, ...data.holdingEntities.map((one) => one.value));
  const drill = useDrill();
  return (
    <Card title="Holding Entities" lead="Top-level ownership · subsidiaries rolled up" picker={!data.bankFile && chart.picker}
      action={<Link to={`/client-workspace/${data.customerId}/structure`} className="text-xs font-semibold text-primary-700 hover:underline">Structure</Link>}>
      {data.bankFile ? <FileBlock /> : data.holdingEntities.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => compact(value, data.currency)} height={240} label="What each top-level entity holds"
          data={{ shape: "shares", items: data.holdingEntities.map((one) => ({ name: one.name, value: one.value })) }}
          onPick={(at) => { const one = data.holdingEntities[at]; if (one) drill?.({ by: "legalEntity", key: one.id, name: one.name }); }} />
      ) : (
        <ul className="divide-y divide-line">
          {data.holdingEntities.map((one) => (
            <li key={one.id} className={cn("grid grid-cols-[1fr_6rem_5rem] items-center gap-3 py-2.5", drill && "cursor-pointer hover:bg-canvas")}
              onClick={drill ? () => drill({ by: "legalEntity", key: one.id, name: one.name }) : undefined}>
              <div className="min-w-0">
                {drill ? (
                  <button type="button" className="block max-w-full truncate text-left text-sm font-semibold hover:text-primary-700 hover:underline"
                    onClick={(event) => { event.stopPropagation(); drill({ by: "legalEntity", key: one.id, name: one.name }); }}>
                    {one.name}
                  </button>
                ) : <p className="truncate text-sm font-semibold">{one.name}</p>}
                <p className="truncate text-xs text-ink-muted">{one.jurisdiction}{one.description && ` · ${one.description}`}</p>
              </div>
              <span className="block h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.value / largest) * 100}%` }} />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">{compact(one.value, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LookThroughCard({ data, chart }: { data: ClientWorkspace; chart: CardChart }) {
  const people = data.beneficialLookThrough;
  const drill = useDrill();
  const pick = drill ? (one: (typeof people)[number]) => drill({ by: "beneficiary", key: one.id, name: one.name }) : undefined;
  return (
    <Card title="Beneficial Look-through" lead="Economic interest after trust and entity look-through" picker={!data.bankFile && chart.picker}>
      {data.bankFile ? <FileBlock /> : people.length === 0 ? <Empty>No beneficiary is on file for this client yet.</Empty> : !chart.own ? (
        <KindChart kind={chart.kind!} format={(value) => `${value.toFixed(1)}%`} height={240} label="Each beneficiary's economic interest"
          data={{ shape: "shares", items: people.map((one) => ({ name: one.name, value: one.sharePercent })) }}
          onPick={pick ? (index) => { const one = people[index]; if (one) pick(one); } : undefined} />
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
            {people.map((one, at) => (
              <span key={one.id} className={cn(pick && "cursor-pointer")} onClick={pick ? () => pick(one) : undefined}
                style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {people.map((one) => (
              <li key={one.id} className={cn("flex items-center gap-3 py-2", pick && "cursor-pointer hover:bg-canvas")} onClick={pick ? () => pick(one) : undefined}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-50 text-sm font-bold text-primary-700" aria-hidden="true">
                  {one.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  {pick ? (
                    <button type="button" className="block max-w-full truncate text-left text-sm font-semibold hover:text-primary-700 hover:underline"
                      onClick={(event) => { event.stopPropagation(); pick(one); }}>
                      {one.name}
                    </button>
                  ) : <p className="truncate text-sm font-semibold">{one.name}</p>}
                  <p className="text-xs text-ink-muted">{one.generation ?? (one.kind === "CHARITY" ? "Charitable" : "—")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{compact(one.value, data.currency)}</p>
                  <p className="text-xs text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The bank-file client                                                                                          */

/** A card his bank's files hold nothing for: it stays in its place and says so. */
function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

/** His file's lines, ranked within each currency only, since ranking across them would need a rate. */
function FilePositions({ file }: { file: WorkspaceBankFile }) {
  if (file.byCurrency.length === 0) return <FileBlock />;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-5">#</th>
            <th scope="col" className="px-3 py-2">Position</th>
            <th scope="col" className="px-3 py-2">Held by</th>
            <th scope="col" className="px-3 py-2 text-right">Value</th>
            <th scope="col" className="px-3 py-2 text-right">Weight</th>
            <th scope="col" className="py-2 pr-5 pl-3 text-right">YTD</th>
          </tr>
        </thead>
        {file.byCurrency.map((group) => (
          <tbody key={group.currency} className="divide-y divide-line">
            <tr className="bg-slate-50 text-xs font-semibold">
              <td colSpan={3} className="py-1.5 pl-5">{group.currency}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{compact(group.total, group.currency)}</td>
              <td colSpan={2} />
            </tr>
            {group.lines.slice(0, 10).map((one, at) => (
              <tr key={`${one.name}-${at}`}>
                <td className="py-2 pr-2 pl-5 text-xs text-ink-muted tabular-nums">{String(at + 1).padStart(2, "0")}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{one.name}</span>
                  <span className="block text-xs text-ink-muted">{one.assetClass ?? "Class not in bank file"}</span>
                </td>
                <td className="px-3 py-2"><NotInFile /></td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">{exact(one.value, one.currency)}</td>
                <td className="px-3 py-2 text-right"><NotInFile /></td>
                <td className="py-2 pr-5 pl-3 text-right"><NotInFile /></td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="mt-2 px-5 text-3xs text-ink-muted italic">
        {file.banks.join(", ") || "No bank"} · as of {file.asOf ? formatDate(file.asOf) : "—"} · ranked within each currency, not across them: that would need a rate the bank did not send.
      </p>
    </div>
  );
}

/** His file's ten largest lines across every currency, each converted to dollars at the latest rate in FX rates. */
function ConvertedPositions({ file }: { file: WorkspaceBankFile }) {
  const conv = file.converted;
  if (conv.top.length === 0) return <>{conv.missing.length > 0 ? <MissingRates converted={conv} /> : <FileBlock />}</>;
  // The same columns as the bank's own view, so switching between the two moves nothing but the figures.
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-2 pl-5">#</th>
            <th scope="col" className="px-3 py-2">Position</th>
            <th scope="col" className="px-3 py-2">Held by</th>
            <th scope="col" className="px-3 py-2 text-right">Value · {conv.currency}</th>
            <th scope="col" className="px-3 py-2 text-right">Weight</th>
            <th scope="col" className="py-2 pr-5 pl-3 text-right">YTD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {conv.top.map((one, at) => (
            <tr key={`${one.name}-${at}`}>
              <td className="py-2 pr-2 pl-5 text-xs text-ink-muted tabular-nums">{String(at + 1).padStart(2, "0")}</td>
              <td className="px-3 py-2">
                <span className="font-semibold">{one.name}</span>
                <span className="block text-xs text-ink-muted">{one.assetClass ?? "Class not in bank file"}</span>
              </td>
              <td className="px-3 py-2"><NotInFile /></td>
              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                {exact(one.usd, conv.currency)}
                {one.currency !== conv.currency && <span className="block text-2xs font-normal text-ink-muted">{exact(one.asSent, one.currency)}</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{one.share.toFixed(1)}%</td>
              <td className="py-2 pr-5 pl-3 text-right"><NotInFile /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5"><ConvertedNote converted={conv} /></div>
    </div>
  );
}

/** What his bank's files say moved, in place of a projection his file cannot give. */
/** How many of the bank file's movements the card lists before the rest are asked for. */
const MOVEMENTS_SHOWN = 12;

function FileMovements({ file }: { file: WorkspaceBankFile }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <p className="mb-2 text-xs font-semibold text-ink-soft">As the bank's files state them</p>
      {file.movements.length === 0 ? <FileBlock /> : (
        <ul className="divide-y divide-line text-sm">
          {/* Whole rows, the first dozen and the rest on request, descriptions wrapping rather than cut. */}
          {(all ? file.movements : file.movements.slice(0, MOVEMENTS_SHOWN)).map((one, at) => (
            <li key={`${one.bookedOn}-${at}`} className="flex items-start gap-3 py-2">
              <span className="w-14 shrink-0 text-xs text-ink-muted tabular-nums">{dayMonth(one.bookedOn)}</span>
              <span className="min-w-0 flex-1">
                {one.type ?? <NotInFile />}
                <span className="block text-xs break-words text-ink-muted">{one.description}</span>
              </span>
              <span className={cn("shrink-0 font-semibold tabular-nums", toneOf(one.amount))}>{exact(one.amount, one.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      {file.movements.length > MOVEMENTS_SHOWN && (
        <button type="button" onClick={() => setAll((now) => !now)} className="mt-1 text-xs font-semibold text-primary-700 hover:underline">
          {all ? "Show fewer" : `+${file.movements.length - MOVEMENTS_SHOWN} more`}
        </button>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">No projection: the bank's file states what has moved, not what is to come.</p>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Alerts and notes                                                                                              */

const ALERT_TAGS: Record<string, [string, string]> = {
  DEVIATION: ["Deviation", "bg-red-50 text-red-700"],
  IPS_WARNING: ["Monitor", "bg-amber-50 text-amber-700"],
  DATA_DELAYED: ["Data", "bg-amber-50 text-amber-700"],
  CAPITAL_CALL: ["Capital call", "bg-slate-100 text-ink-soft"],
};

function AlertsAndNotes({ data }: { data: ClientWorkspace }) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set when Save is pressed on an empty note; the box stays red until something is written.
  const [tried, setTried] = useState(false);
  const empty = tried && !body.trim();
  const queryClient = useQueryClient();
  const add = useAddClientNote<ApiError>({
    mutation: {
      onSuccess: () => {
        setWriting(false);
        setBody("");
        setError(null);
        setTried(false);
        void queryClient.invalidateQueries({ queryKey: getGetClientWorkspaceQueryKey(data.customerId) });
      },
      onError: (caught) => setError(caught.message),
    },
  });
  return (
    <Card title="Alerts & Notes"
      action={!writing && (
        <Button variant="secondary" size="sm" onClick={() => setWriting(true)}>
          <Plus aria-hidden="true" />
          Add note
        </Button>
      )}>
      {writing && (
        <form className="mb-4 space-y-2" onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim()) {
            setTried(true);
            document.getElementById("client-note")?.focus();
            return;
          }
          add.mutate({ customerId: data.customerId, data: { body } });
        }}>
          <label htmlFor="client-note" className="sr-only">Note</label>
          <TextArea id="client-note" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)}
            aria-invalid={empty || undefined} aria-describedby={empty ? "client-note-error" : undefined}
            placeholder="What should the next person to open this client know?" />
          {empty && <p id="client-note-error" className="text-xs text-red-600">Write the note first.</p>}
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={add.isPending}>Save note</Button>
            <Button variant="ghost" size="sm" onClick={() => { setWriting(false); setBody(""); setError(null); setTried(false); }}>Cancel</Button>
          </div>
        </form>
      )}
      {data.alerts.length === 0 && data.notes.length === 0 ? <Empty>Nothing to look at, and no notes yet.</Empty> : (
        <ul className="divide-y divide-line">
          {data.alerts.map((one, at) => {
            const [label, tone] = ALERT_TAGS[one.kind] ?? [one.kind, "bg-slate-100 text-ink-soft"];
            return (
              <li key={`alert-${at}`} className="py-2.5">
                <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold", tone)}>{label}</span>
                <p className="mt-1 text-sm">{one.text}{one.on && <span className="text-ink-muted"> · {formatDate(one.on)}</span>}</p>
              </li>
            );
          })}
          {data.notes.map((one) => (
            <li key={one.id} className="py-2.5">
              <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-2xs font-semibold text-primary-700">PM note</span>
              <p className="mt-1 text-sm whitespace-pre-line">{one.body}</p>
              <p className="text-xs text-ink-muted">— {one.writtenBy}, {formatDateTime(one.writtenAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

/** @param picker the chart type switcher, beside the card's own action, for a card that draws a chart */
function Card({ title, lead, action, picker, children }: { title: string; lead?: string; action?: ReactNode; picker?: ReactNode; children: ReactNode }) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  const body = useRef<HTMLDivElement>(null);
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
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

function Toggle<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
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

/** Where a bank-file client's files hold nothing: left blank, and said so, rather than shown as a nought. */
function NotInFile() {
  return <Marker>not in bank file</Marker>;
}

function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      {children}
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function Signed({ value, unit }: { value: number; unit: string }) {
  return <span className={toneOf(value)}>{value > 0 ? "+" : ""}{value.toFixed(1)}{unit}</span>;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function money(amount: number | null, currency: string) {
  return amount == null ? "—" : compact(amount, currency);
}

/** A bank's figure in full, to the cent, as the bank wrote it. */
function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedCompact(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${compact(amount, currency)}`;
}

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function signedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function toneOf(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}

function titleCase(text: string) {
  return text.toLowerCase().replace(/_/g, " ").replace(/^\w/, (first) => first.toUpperCase());
}

/** The design's subtitle: what kind of client, and how many entities across which jurisdictions. */
function subtitle(data: ClientWorkspace) {
  const kind = [data.customerType === "ENTITY" ? "Entity" : "Individual",
    data.segment === "HNW_PLUS" ? "HNW+" : data.segment === "FOUNDATION" ? "Foundation" : data.segment].filter(Boolean).join(" · ");
  const places = data.jurisdictions.length <= 1 ? data.jurisdictions.join("")
    : `${data.jurisdictions.slice(0, -1).join(", ")} and ${data.jurisdictions[data.jurisdictions.length - 1]}`;
  const entities = data.bankFile ? null
    : data.entityCount === 0 ? "no entities on file"
    : `${data.entityCount} ${data.entityCount === 1 ? "entity" : "entities"}${places ? ` across ${places}` : ""}`;
  return [kind, entities, "consolidated net worth view"].filter(Boolean).join(" · ");
}

/**
 * A money axis whose labels tell the ticks apart: compact, with as many decimals as the spread of the figures needs,
 * so a narrow range does not print the same label four times.
 */
function axisMoney(values: number[], currency: string) {
  const finite = values.filter((one) => Number.isFinite(one));
  const largest = Math.max(1, ...finite.map((one) => Math.abs(one)));
  const spread = finite.length === 0 ? largest : Math.max(...finite) - Math.min(...finite);
  // One figure, or several equal ones, has no spread to tell apart: the chart draws its own ticks around it, and one
  // decimal reads them. Three decimals there made labels such as "-$600.000K", too wide for the axis, which cut the
  // minus off.
  const ratio = spread === 0 ? 1 : spread / largest;
  const digits = ratio < 0.02 ? 3 : ratio < 0.2 ? 2 : 1;
  return (value: number) => {
    try {
      // Only the decimals a tick needs: -$1.2M, not -$1.200M.
      return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", minimumFractionDigits: 0,
        maximumFractionDigits: digits }).format(value);
    } catch {
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(value);
    }
  };
}

function shiftMonths(day: string, months: number) {
  const date = new Date(day);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function monthYear(day: string) {
  const date = new Date(day);
  return `${date.toLocaleString("en-GB", { month: "short" })} ${String(date.getFullYear()).slice(2)}`;
}

function quarterLabel(day: string) {
  const date = new Date(day);
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${String(date.getFullYear()).slice(2)}`;
}

/** "December 2026", as the breakdown panel heads a month. */
function longMonth(day: string) {
  return new Date(`${day.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function monthLabel(day: string) {
  const date = new Date(day);
  return date.getMonth() === 0 ? `Jan ${String(date.getFullYear()).slice(2)}` : date.toLocaleString("en-GB", { month: "short" });
}

function dayMonth(day: string) {
  return new Date(day).toLocaleString("en-GB", { day: "2-digit", month: "short" });
}
