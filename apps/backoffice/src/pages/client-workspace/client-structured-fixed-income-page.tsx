import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspaceStructuredFixedIncome,
  type ClientStructuredFixedIncome,
  type SpFiNote,
  type SpKpi,
} from "@atomprive/api-client/backoffice";
import { Alert } from "@atomprive/ui";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useCurrencyParam } from "../../components/shown-currency";
import { CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { FIGURE_KINDS } from "../layout/figure-strip";
import { kpiFigures, sharesFigure, type Figures } from "../layout/own-cards";
import { ReportButton } from "../layout/report";
import { useDrill } from "./drill-panel";
import type { FigureDetail } from "./figure-panel";
import { eventFigure, issuerFigure, lineFigure, scenarioFigure } from "./structured-figures";
import { compact, fullDay, kpiValue, monthYear, toneClass, withAmount } from "./structured-format";
import { CalendarCard, Card, Empty, FileBlock, FileLines, IssuersCard, KpiStrip, Pill, ScenariosCard, Tabs } from "./structured-parts";

/**
 * A client's Fixed Income Structured Products, exactly as the firm's design draws it (25 Nov 2026), less what the
 * user's "What to Remove" sheet takes off: the Reference credit exposure and Range accrual figures across the top, and
 * the Rate Trigger Monitor, Coupon Profile and Credit-linked Exposure sections. Every figure is worked out on the server
 * from the notes kept for the client; the share of the fixed income sleeve and the book's yield are Fixed Income
 * Analytics' own. The notes, their levels, statuses and scenarios are demo figures, which the page says. A client whose
 * bank holdings Excels were uploaded sees their fixed income structured lines as the sheets state them; the client read
 * only from his bank's feed sees not in bank file throughout. Read only.
 */
export function ClientStructuredFixedIncomePage() {
  const { customerId = "" } = useParams();
  const query = useGetClientWorkspaceStructuredFixedIncome<ClientStructuredFixedIncome, ApiError>(customerId, useCurrencyParam());
  const data = query.data;
  const view = useViewLayout("workspace.structured-fixed-income", CARDS, DEFAULT_CARDS);
  const drill = useDrill();

  if (query.isError) return <Alert tone="danger">{query.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the structured notes…</p>;
  const open = (key: string, name: string, figure: FigureDetail) => drill?.({ by: "figure", key: `structured-fixed-income.${key}`, name, figure });

  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="absolute top-0 right-0 flex items-start gap-2"><ReportButton /><CustomizeButton view={view} /></div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Structured Products / Fixed Income
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Fixed Income Structured Products</h1>
        <p className="mt-1 text-sm text-ink-muted">Credit-linked, range accrual, callable, CMS, inflation-linked and rate-linked notes</p>
        <p className="mt-3 inline-flex rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          Benchmark: Bloomberg Global Agg (USD-hedged)
        </p>
      </header>

      <LayoutGrid view={view} screen="Fixed Income Structured Products" figures={data.source === "PLATFORM" ? fixedIncomeFigures(data) : undefined} render={{
        kpis: <KpiStrip data={data} kpis={data.kpis} labels={KPI_LABELS} onOpen={(one) => open(`kpi.${one.key}`, one.label, kpiFigure(data, one))} />,
        notes: <NotesCard data={data} />,
        scenarios: (
          <ScenariosCard data={data} title="Rate & Spread Scenarios" sets={data.scenarios} note={data.scenarioNote}
            lead={() => `MTM change, ${data.currency} · instantaneous shock`} empty="No scenarios for these notes."
            onOpen={(set, row, at) => open(`scenario.${set.key}.${row?.noteId ?? "book"}.${at}`, `${row?.label ?? "Book"} · ${set.moves[at]}`,
              scenarioFigure(data.currency, "Rate & spread scenarios", set, row, at))} />
        ),
        calendar: (
          <CalendarCard data={data} title="Coupon, Call & Fixing Calendar" lead="Next 6 months" empty="Nothing falls due in the next 6 months."
            events={data.calendar} onOpen={(one, at) => open(`event.${one.on}.${at}`, one.title, eventFigure(data, one, "Coupon, call & fixing calendar"))} />
        ),
        issuers: (
          <IssuersCard data={data} lead="Unsecured issuer obligations" issuers={data.issuers} limit={data.issuerLimit}
            empty="No fixed income structured notes on file for this client." onOpen={(one) => open(`issuer.${one.issuer}`, one.issuer, issuerFigure(data, one))} />
        ),
      }} />

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {data.source === "FEED" ? `Nothing on this screen is in the bank file for this client as of ${fullDay(data.asOf)}.`
            : data.source === "EXCEL" ? `Values in USD as the bank holdings Excels state them unless another currency is picked, as of ${fullDay(data.asOf)}. ${data.note ?? ""}`
              : `Values in ${data.currency} unless stated; MTM are issuer indicative bids as of ${fullDay(data.asOf)} close. ${data.note ?? ""}`}
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

type FixedIncomeCard = "kpis" | "notes" | "scenarios" | "calendar" | "issuers";

/** The screen's cards, in the design's order less the three the sheet removes: every card on by default. */
const CARDS: Record<FixedIncomeCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  notes: { title: "Live Fixed Income Structured Notes", group: "Notes", wide: true },
  scenarios: { title: "Rate & Spread Scenarios", group: "Risk", wide: true },
  calendar: { title: "Coupon, Call & Fixing Calendar", group: "Events" },
  issuers: { title: "Issuer Exposure", group: "Risk" },
};

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as FixedIncomeCard[];

/** The figures across the top, as the design names them less the two the sheet removes. */
const KPI_LABELS = ["Notional outstanding", "Mark-to-market", "Share of portfolio", "Running yield", "Effective duration", "DV01", "CS01",
  "Call probability · next date"];

const FILTERS: [string, string][] = [["ALL", "All"], ["CREDIT_LINKED", "Credit-linked"], ["RATE_LINKED", "Rate-linked"], ["INFLATION", "Inflation"]];

function NotesCard({ data }: { data: ClientStructuredFixedIncome }) {
  const drill = useDrill();
  const [filter, setFilter] = useState("ALL");
  const cur = data.currency;
  const shown = filter === "ALL" ? data.notes : data.notes.filter((one) => one.category === filter);
  const open = (one: SpFiNote) => drill?.({ by: "figure", key: `structured-fixed-income.note.${one.id}`, name: one.label, figure: noteFigure(data, one) });
  return (
    <Card title="Live Fixed Income Structured Notes" flush
      lead={data.source === "EXCEL" ? `${data.name} · the bank holdings Excels' fixed income structured lines, as sent` : `${data.name} · all entities · indicative issuer bids`}
      action={data.source === "PLATFORM" && data.notes.length > 0 ? <Tabs value={filter} onChange={setFilter} options={FILTERS} label="Note type" /> : undefined}>
      {data.source === "FEED" ? <div className="px-5"><FileBlock /></div> : data.source === "EXCEL" ? (
        <FileLines data={data} lines={data.fileLines} kind="fixed income"
          onOpen={(line, at) => drill?.({ by: "figure", key: `structured-fixed-income.line.${at}`, name: line.name, figure: lineFigure(data, line) })} />
      ) : data.notes.length === 0 ? (
        <Empty>No fixed income structured notes on file for this client.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="min-w-44 py-2 pr-2 pl-5">Structure</th>
                <th scope="col" className="min-w-36 px-1.5 py-2">Underlying / reference</th>
                <th scope="col" className="min-w-28 px-1.5 py-2">Issuer</th>
                <th scope="col" className="px-1.5 py-2 text-right">Notional</th>
                <th scope="col" className="px-1.5 py-2 text-right">MTM</th>
                <th scope="col" className="px-1.5 py-2 text-right">Current coupon</th>
                <th scope="col" className="min-w-44 px-1.5 py-2">Terms</th>
                <th scope="col" className="px-1.5 py-2">Maturity</th>
                <th scope="col" className="min-w-36 px-1.5 py-2">Key trigger</th>
                <th scope="col" className="py-2 pr-5 pl-1.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((one) => (
                <tr key={one.id} className="cursor-pointer hover:bg-canvas" onClick={() => open(one)}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left font-normal">
                    <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline"
                      onClick={(event) => { event.stopPropagation(); open(one); }}>{one.structure}</button>
                    {one.line && <span className="block text-2xs text-ink-muted">{one.line}</span>}
                  </th>
                  <td className="px-1.5 py-2 text-xs">{one.reference}</td>
                  <td className="px-1.5 py-2 text-xs">{one.issuer}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(one.notional, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.bidPercent.toFixed(1)}%</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.couponPercent == null ? "—" : `${one.couponPercent.toFixed(2)}%`}</td>
                  <td className="px-1.5 py-2 text-xs">{one.terms ?? "—"}</td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{monthYear(one.maturesOn)}</td>
                  <td className="px-1.5 py-2 text-xs">{one.keyTrigger ?? "—"}</td>
                  <td className="py-2 pr-5 pl-1.5"><Pill tone={toneClass(one.statusTone)}>{one.status}</Pill></td>
                </tr>
              ))}
              {filter === "ALL" && data.total && (
                <tr className="border-t-2 border-line bg-canvas/60 font-bold">
                  <th scope="row" className="py-2 pr-2 pl-5 text-left">Total · {data.total.notes} note{data.total.notes === 1 ? "" : "s"}</th>
                  <td className="px-1.5 py-2" />
                  <td className="px-1.5 py-2" />
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(data.total.notional, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(data.total.mtm, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{data.total.averageCoupon == null ? "" : `${data.total.averageCoupon.toFixed(2)}%`}</td>
                  <td className="px-1.5 py-2" colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** The notes a figure across the top counts, as the server listed them. */
function counted(data: ClientStructuredFixedIncome, one: SpKpi) {
  return data.notes.filter((note) => one.notes.includes(note.id));
}

/** What a figure across the top is made of, for the side panel. */
function kpiFigure(data: ClientStructuredFixedIncome, one: SpKpi): FigureDetail {
  const cur = data.currency;
  const base: FigureDetail = { label: "Fixed income structured notes", value: kpiValue(one, cur), note: withAmount(one.detail, one.amount, cur) ?? undefined };
  const notes = counted(data, one);
  switch (one.key) {
    case "NOTIONAL":
      return { ...base, table: { title: "By note", columns: ["Note", "Issuer", "Notional", "Bid %"],
        rows: notes.map((note) => [note.label, note.issuer, compact(note.notional, cur), note.bidPercent]), total: ["Notes", null, compact(data.total?.notional ?? 0, cur), null] } };
    case "MARK_TO_MARKET":
      return data.source === "EXCEL"
        ? { ...base, note: "The sheets' own Market value USD, added up.", table: { title: "By line", columns: ["Line", "Bank", "Market value"],
          rows: data.fileLines.map((line) => [line.name, line.bank, line.marketValueUsd == null ? null : compact(line.marketValueUsd, cur)]) } }
        : { ...base, note: "Each note's notional at its issuer's indicative bid.", table: { title: "By note", columns: ["Note", "Notional", "Bid %", "MTM"],
          rows: notes.map((note) => [note.label, compact(note.notional, cur), note.bidPercent, compact(note.mtm, cur)]), total: ["Notes", null, null, compact(data.total?.mtm ?? 0, cur)] } };
    case "SHARE_OF_PORTFOLIO":
      return { ...base, note: "The notes' mark-to-market as a share of the client's holdings, and of the fixed income sleeve Fixed Income Analytics reads.",
        facts: [{ label: "Notes · MTM", value: compact(data.total?.mtm ?? 0, cur) }, { label: "Holdings", value: one.amount == null ? "—" : compact(one.amount, cur) }],
        link: { to: "fixed-income", label: "Fixed Income Analytics" } };
    case "RUNNING_YIELD":
      return { ...base, note: "Current coupons weighted by notional, against the yield to maturity of the client's fixed income sleeve.",
        table: { title: "Coupons", columns: ["Note", "Notional", "Current coupon %"], rows: notes.map((note) => [note.label, compact(note.notional, cur), note.couponPercent]) },
        link: { to: "fixed-income", label: "Fixed Income Analytics" } };
    case "EFFECTIVE_DURATION":
    case "DV01":
    case "CS01":
      return { ...base, note: "Each note's option-adjusted duration, weighted by its mark-to-market; DV01 and CS01 are a basis point on each note's value.",
        table: { title: "By note", columns: ["Note", "MTM", "Effective duration"], rows: notes.map((note) => [note.label, compact(note.mtm, cur), note.duration == null ? null : `${note.duration} yrs`]) } };
    case "CALL_PROBABILITY":
      return { ...base, value: kpiValue(one, cur), facts: one.on ? [{ label: "Next call date", value: fullDay(one.on) }] : [],
        table: { title: "Callable notes", columns: ["Note", "Notional", "Call probability"], rows: notes.map((note) => [note.label, compact(note.notional, cur), note.callProbability == null ? null : `${note.callProbability}%`]) } };
    default:
      return base;
  }
}

/** One note's terms and what falls due on it. */
function noteFigure(data: ClientStructuredFixedIncome, note: SpFiNote): FigureDetail {
  const cur = data.currency;
  return {
    label: "Fixed income structured note",
    value: compact(note.mtm, cur),
    note: [note.structure, note.line, note.reference].filter(Boolean).join(" · "),
    facts: [
      { label: "Issuer", value: note.issuer },
      { label: "Notional", value: compact(note.notional, cur) },
      { label: "Bid", value: `${note.bidPercent.toFixed(1)}%` },
      { label: "Current coupon", value: note.couponPercent == null ? "—" : `${note.couponPercent.toFixed(2)}%` },
      { label: "Terms", value: note.terms ?? "—" },
      { label: "Key trigger", value: note.keyTrigger ?? "—" },
      { label: "Status", value: note.status },
      { label: "Effective duration", value: note.duration == null ? "—" : `${note.duration} yrs` },
      { label: "Issued", value: fullDay(note.issuedOn) },
      { label: "Matures", value: fullDay(note.maturesOn) },
    ],
    table: note.events.length > 0 ? { title: "What falls due", columns: ["Date", "Event", "Expected"],
      rows: note.events.map((event) => [fullDay(event.on), `${event.title} · ${withAmount(event.detail, event.amount, cur)}`, event.status]) } : undefined,
  };
}

/** What Fixed Income Structured Products offers for a card of the reader's own: its figures, types and issuers. */
function fixedIncomeFigures(data: ClientStructuredFixedIncome): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const unitFormat = (unit: string) => (value: number) => unit === "PERCENT" ? `${value}%` : unit === "MONEY" ? amount(value) : unit === "YEARS" ? `${value} yrs` : value.toLocaleString("en-US");
  const byType = new Map<string, number>();
  data.notes.forEach((one) => byType.set(one.categoryLabel, (byType.get(one.categoryLabel) ?? 0) + one.notional));
  return {
    ...kpiFigures(data.kpis.filter((one) => one.unit !== "DATE"), unitFormat),
    "structured.types": sharesFigure("Notional by note type", "Notes", [...byType].map(([name, value]) => ({ name, value })), amount),
    "structured.issuers": sharesFigure("MTM by issuer", "Risk", data.issuers.map((one) => ({ name: one.issuer, value: one.mtm })), amount),
  };
}
