import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspaceStructuredEquity,
  type ClientStructuredEquity,
  type SpBarrier,
  type SpEquityNote,
  type SpKpi,
  type SpPayoff,
  type SpShare,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { MarkLineComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useCurrencyParam } from "../../components/shown-currency";
import { Chart, ink } from "../book/overview-charts";
import { CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { FIGURE_KINDS } from "../layout/figure-strip";
import { kpiFigures, sharesFigure, type Figures } from "../layout/own-cards";
import { ReportButton } from "../layout/report";
import { useDrill } from "./drill-panel";
import type { FigureDetail } from "./figure-panel";
import { eventFigure, issuerFigure, lineFigure, scenarioFigure } from "./structured-figures";
import { compact, fullDay, kpiValue, levelText, nextEventText, statusText, toneClass, withAmount } from "./structured-format";
import { CalendarCard, Card, Empty, FileBlock, FileLines, IssuersCard, KpiStrip, Note, Pill, ScenariosCard, Tabs } from "./structured-parts";

echarts.use([MarkLineComponent]);

/**
 * A client's Equity Structured Products, exactly as the firm's design draws it (25 Nov 2026), less what the user's
 * "What to Remove" sheet takes off: the Delta-equivalent equity and Vega figures across the top, and the Delta $ and
 * Vega / pt columns of the scenarios. Every figure is worked out on the server from the notes kept for the client; the
 * notes, their levels and scenarios are demo figures, which the page says. A client whose bank holdings Excels were
 * uploaded sees their structured lines as the sheets state them, and every card the sheets cannot fill says so; the
 * client read only from his bank's feed sees not in bank file throughout. Read only.
 */
export function ClientStructuredEquityPage() {
  const { customerId = "" } = useParams();
  const query = useGetClientWorkspaceStructuredEquity<ClientStructuredEquity, ApiError>(customerId, useCurrencyParam());
  const data = query.data;
  const view = useViewLayout("workspace.structured-equity", CARDS, DEFAULT_CARDS);
  const drill = useDrill();

  if (query.isError) return <Alert tone="danger">{query.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the structured notes…</p>;
  const open = (key: string, name: string, figure: FigureDetail) => drill?.({ by: "figure", key: `structured-equity.${key}`, name, figure });

  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="absolute top-0 right-0 flex items-start gap-2"><ReportButton /><CustomizeButton view={view} /></div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Structured Products / Equity
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Equity Structured Products</h1>
        <p className="mt-1 text-sm text-ink-muted">Autocalls, reverse convertibles, capital-protected and participation notes on equity underlyings</p>
        <p className="mt-3 inline-flex rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          Benchmark: MSCI ACWI (USD)
        </p>
      </header>

      <LayoutGrid view={view} screen="Equity Structured Products" figures={data.source === "PLATFORM" ? equityFigures(data) : undefined} render={{
        kpis: (
          <div className="space-y-3">
            <KpiStrip data={data} kpis={data.kpis} labels={KPI_LABELS} onOpen={(one) => open(`kpi.${one.key}`, one.label, kpiFigure(data, one))} />
            {data.alert && <Note>{data.alert}</Note>}
          </div>
        ),
        notes: <NotesCard data={data} />,
        payoff: <PayoffCard data={data} />,
        barriers: <BarriersCard data={data} />,
        scenarios: (
          <ScenariosCard data={data} title="Equity Scenarios & Sensitivities" sets={data.scenarios} note={data.scenarioNote}
            lead={(set) => set?.lead ?? "MTM change for a uniform move in all underlyings · vol and rates held constant"} empty="No scenarios for these notes."
            onOpen={(set, row, at) => open(`scenario.${set.key}.${row?.noteId ?? "book"}.${at}`, `${row?.label ?? "Book"} · ${set.moves[at]}`,
              scenarioFigure(data.currency, "Equity scenarios", set, row, at))} />
        ),
        mix: <MixCard data={data} />,
        calendar: (
          <CalendarCard data={data} title="Observation Calendar" lead="Next 90 days" empty="Nothing falls due in the next 90 days." events={data.calendar}
            onOpen={(one, at) => open(`event.${one.on}.${at}`, one.title, eventFigure(data, one, "Observation calendar"))} />
        ),
        issuers: (
          <IssuersCard data={data} lead="Structured notes are unsecured issuer obligations · credit risk sits on top of payoff risk"
            issuers={data.issuers} limit={data.issuerLimit} empty="No equity structured notes on file for this client."
            onOpen={(one) => open(`issuer.${one.issuer}`, one.issuer, issuerFigure(data, one))} />
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

type EquityCard = "kpis" | "notes" | "payoff" | "barriers" | "scenarios" | "mix" | "calendar" | "issuers";

/** The screen's cards, in the design's order: every card on by default. */
const CARDS: Record<EquityCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  notes: { title: "Live Equity Structured Notes", group: "Notes", wide: true },
  payoff: { title: "Payoff at Maturity", group: "Payoffs & barriers" },
  barriers: { title: "Barrier Monitor", group: "Payoffs & barriers" },
  scenarios: { title: "Equity Scenarios & Sensitivities", group: "Risk", wide: true },
  mix: { title: "Payoff Mix", group: "Notes" },
  calendar: { title: "Observation Calendar", group: "Events" },
  issuers: { title: "Issuer Exposure", group: "Risk", wide: true },
};

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as EquityCard[];

/** The figures across the top, as the design names them less the two the sheet removes. */
const KPI_LABELS = ["Notional outstanding", "Mark-to-market", "Share of portfolio", "Running coupon", "Capital-protected",
  "Notes within 20% of barrier", "Next observation", "Expected autocalls · 3M"];

/* ------------------------------------------------------------------------------------------------------------ */

const FILTERS: [string, string][] = [["ALL", "All"], ["YIELD_ENHANCEMENT", "Yield enhancement"], ["CAPITAL_PROTECTED", "Capital protected"], ["PARTICIPATION", "Participation"]];

function NotesCard({ data }: { data: ClientStructuredEquity }) {
  const drill = useDrill();
  const [filter, setFilter] = useState("ALL");
  const cur = data.currency;
  const shown = filter === "ALL" ? data.notes : data.notes.filter((one) => one.category === filter);
  const open = (one: SpEquityNote) => drill?.({ by: "figure", key: `structured-equity.note.${one.id}`, name: one.label, figure: noteFigure(data, one) });
  return (
    <Card title="Live Equity Structured Notes" flush
      lead={data.source === "EXCEL" ? `${data.name} · the bank holdings Excels' equity structured lines, as sent` : `${data.name} · all entities · indicative issuer bids`}
      action={data.source === "PLATFORM" && data.notes.length > 0 ? <Tabs value={filter} onChange={setFilter} options={FILTERS} label="Payoff family" /> : undefined}>
      {data.source === "FEED" ? <div className="px-5"><FileBlock /></div> : data.source === "EXCEL" ? (
        <FileLines data={data} lines={data.fileLines} kind="equity"
          onOpen={(line, at) => drill?.({ by: "figure", key: `structured-equity.line.${at}`, name: line.name, figure: lineFigure(data, line) })} />
      ) : data.notes.length === 0 ? (
        <Empty>No equity structured notes on file for this client.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="min-w-44 py-2 pr-2 pl-5">Structure</th>
                <th scope="col" className="min-w-28 px-1.5 py-2">Underlying</th>
                <th scope="col" className="min-w-28 px-1.5 py-2">Issuer</th>
                <th scope="col" className="px-1.5 py-2 text-right">Notional</th>
                <th scope="col" className="px-1.5 py-2 text-right">MTM</th>
                <th scope="col" className="min-w-44 px-1.5 py-2">Coupon / payoff</th>
                <th scope="col" className="px-1.5 py-2">Barrier</th>
                <th scope="col" className="px-1.5 py-2 text-right">Worst-of level</th>
                <th scope="col" className="px-1.5 py-2 text-right">To barrier</th>
                <th scope="col" className="px-1.5 py-2">Next event</th>
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
                  <td className="px-1.5 py-2 text-xs">{one.underlying}</td>
                  <td className="px-1.5 py-2 text-xs">{one.issuer}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(one.notional, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.bidPercent.toFixed(1)}%</td>
                  <td className="px-1.5 py-2 text-xs">{one.payoff ?? "—"}</td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{one.barrier ?? "—"}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{levelText(one.worst, one.level)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">
                    {one.toBarrier == null ? "—" : `${one.toBarrier.toFixed(1)}%${one.toKnockOut ? " to KO" : ""}`}
                  </td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{nextEventText(one.nextEvent, one.nextEventOn)}</td>
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
                  <td className="px-1.5 py-2 text-xs" colSpan={6}>{data.total.averageCoupon == null ? "" : `Avg ${data.total.averageCoupon}% (coupon notes)`}</td>
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

const MARKER_COLOUR: Record<string, (colours: ReturnType<typeof ink>) => string> = {
  KNOCK_IN: (colours) => colours.danger,
  KNOCK_OUT: () => "#a16207",
  TRIGGER: (colours) => colours.muted,
  CAP: (colours) => colours.muted,
  TODAY: (colours) => colours.text,
};

function PayoffCard({ data }: { data: ClientStructuredEquity }) {
  const drill = useDrill();
  const [picked, setPicked] = useState<string | null>(null);
  const payoff = data.payoffs.find((one) => one.noteId === picked) ?? data.payoffs[0];
  const note = payoff ? data.notes.find((one) => one.id === payoff.noteId) : undefined;
  const open = () => { if (note) drill?.({ by: "figure", key: `structured-equity.payoff.${note.id}`, name: note.label, figure: noteFigure(data, note) }); };
  const knockIn = payoff?.markers.find((one) => one.kind === "KNOCK_IN");
  const knockOut = payoff?.markers.find((one) => one.kind === "KNOCK_OUT");
  return (
    <Card title="Payoff at Maturity"
      lead={payoff ? `${payoff.title} · ${compact(payoff.notional, data.currency)} · excludes coupons already paid` : "What each note repays at maturity"}>
      {data.source !== "PLATFORM" ? <FileBlock /> : !payoff ? <Empty>No equity structured notes on file for this client.</Empty> : (
        <div className="flex flex-1 flex-col gap-3">
          <Tabs value={payoff.noteId} onChange={setPicked} options={data.payoffs.map((one) => [one.noteId, one.tab])} label="Note" scroll />
          {/* The design's own legend: the note, the share held directly, its barrier and today's level. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-primary-600" aria-hidden="true" />Note redemption</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-slate-300" aria-hidden="true" />
              {note?.worst ? "Holding the worst-of share directly" : `Holding ${note?.underlying ?? "the underlying"} directly`}</span>
            {knockIn && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-red-500" aria-hidden="true" />Knock-in barrier {knockIn.at}%</span>}
            {knockOut && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-amber-700" aria-hidden="true" />Knock-out barrier {knockOut.at}%</span>}
            {note?.level != null && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-ink" aria-hidden="true" />Today · {levelText(note.worst, note.level)}</span>}
          </div>
          <PayoffChart payoff={payoff} onPick={open} />
          <Note>{payoff.note}</Note>
        </div>
      )}
    </Card>
  );
}

function PayoffChart({ payoff, onPick }: { payoff: SpPayoff; onPick: () => void }) {
  const option = useMemo(() => {
    const colours = ink();
    const top = Math.max(160, ...payoff.redemption.map((one) => one.y + 10));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 24, top: 40, bottom: 28, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${Math.round(value)}%` },
      xAxis: { type: "value", min: 0, max: 160, interval: 20, name: "Underlying at maturity (% of initial)", nameLocation: "middle", nameGap: 26,
        nameTextStyle: { color: colours.muted, fontSize: 10 }, axisLabel: { color: colours.muted, formatter: "{value}%" }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, max: Math.ceil(top / 40) * 40, interval: 40, axisLabel: { color: colours.muted, formatter: "{value}%" },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [
        { type: "line", name: "Note redemption", data: payoff.redemption.map((one) => [one.x, one.y]), showSymbol: false,
          lineStyle: { color: colours.primary, width: 2.5 }, itemStyle: { color: colours.primary },
          markLine: { symbol: "none", silent: true, data: payoff.markers.map((one) => ({
            xAxis: one.at, name: one.label,
            lineStyle: { color: (MARKER_COLOUR[one.kind] ?? MARKER_COLOUR.TRIGGER!)(colours), type: "dashed", width: one.kind === "TODAY" ? 1.5 : 1 },
            // Today's level is named a row above the barriers' names, so that close ones don't overlap.
            label: { formatter: one.label, position: "end", distance: one.kind === "TODAY" ? 16 : 4, color: (MARKER_COLOUR[one.kind] ?? MARKER_COLOUR.TRIGGER!)(colours), fontSize: 9 },
          })) } },
        { type: "line", name: "Held directly", data: [[0, 0], [160, 160]], showSymbol: false,
          lineStyle: { color: colours.neutral, type: "dashed", width: 1.5 }, itemStyle: { color: colours.neutral } },
      ],
    };
  }, [payoff]);
  return <Chart option={option} height={250} label={`What the note repays at maturity against where ${payoff.worst} ends`} onPick={onPick} />;
}

/* ------------------------------------------------------------------------------------------------------------ */

function BarriersCard({ data }: { data: ClientStructuredEquity }) {
  const drill = useDrill();
  const open = (one: SpBarrier) => {
    const note = data.notes.find((each) => each.id === one.noteId);
    if (note) drill?.({ by: "figure", key: `structured-equity.barrier.${one.noteId}`, name: one.label, figure: noteFigure(data, note) });
  };
  const at = (value: number) => `${Math.min(100, Math.max(0, (value / 150) * 100))}%`;
  return (
    <Card title="Barrier Monitor" lead="Worst performer vs barrier, % of initial level · sorted by distance">
      {data.source !== "PLATFORM" ? <FileBlock /> : data.barriers.length === 0 ? <Empty>No note has a barrier.</Empty> : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink" aria-hidden="true" />Current level</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-red-600" aria-hidden="true" />Knock-in barrier</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-amber-700" aria-hidden="true" />Knock-out barrier</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-ink-muted" aria-hidden="true" />Initial 100%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-2">Note</th>
                  <th scope="col" className="px-1.5 py-2">Worst</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Level</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Barrier</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Distance</th>
                  <th scope="col" className="py-2 pl-3">0% — 150%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.barriers.map((one) => (
                  <tr key={one.noteId} className="cursor-pointer hover:bg-canvas" onClick={() => open(one)}>
                    <th scope="row" className="py-2 pr-2 text-left text-xs font-semibold">{one.label}</th>
                    <td className="px-1.5 py-2 text-xs">{one.worst}</td>
                    <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.level.toFixed(1)}%</td>
                    <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.barrier}%</td>
                    <td className={cn("px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums", statusText(data.notes.find((each) => each.id === one.noteId)?.statusTone))}>
                      {one.distance.toFixed(1)}%{one.knockOut ? " to KO" : ""}
                    </td>
                    <td className="py-2 pl-3">
                      <span className="relative block h-2.5 w-36 rounded-full bg-slate-100" aria-label={`${one.level.toFixed(1)}% against a ${one.barrier}% barrier`}>
                        {!one.knockOut && <span className="absolute inset-y-0 left-0 rounded-l-full bg-red-50" style={{ width: at(one.barrier) }} />}
                        <span className={cn("absolute -top-0.5 h-3.5 w-0.5", one.knockOut ? "bg-amber-700" : "bg-red-600")} style={{ left: at(one.barrier) }} />
                        <span className="absolute -top-px h-3 w-px bg-ink-muted" style={{ left: at(100) }} />
                        <span className="absolute top-0.5 -ml-1 size-2 rounded-full bg-ink" style={{ left: at(one.level) }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function MixCard({ data }: { data: ClientStructuredEquity }) {
  const drill = useDrill();
  const excel = data.source === "EXCEL";
  const open = (one: SpShare, by: "family" | "region") =>
    drill?.({ by: "figure", key: `structured-equity.mix.${by}.${one.key}`, name: one.label, figure: shareFigure(data, one, by) });
  const largest = Math.max(1, ...data.byRegion.map((one) => one.value));
  return (
    <Card title="Payoff Mix" lead={excel ? "Market value by the sheets' Product Type and Geography" : "% of notional by structure family"}>
      {data.source === "FEED" ? <FileBlock /> : data.byFamily.length === 0 ? <Empty>No equity structured notes on file for this client.</Empty> : (
        <div className="space-y-6">
          <Bars rows={data.byFamily.map((one) => ({ key: one.key, label: one.label, width: one.percent, value: `${one.percent.toFixed(1)}%`, onClick: () => open(one, "family") }))}
            colour="bg-primary-600" />
          <Bars rows={data.byRegion.map((one) => ({ key: one.key, label: one.label, width: (one.value / largest) * 100, value: compact(one.value, data.currency), onClick: () => open(one, "region") }))}
            colour="bg-[#d6c9a8]" />
        </div>
      )}
    </Card>
  );
}

function Bars({ rows, colour }: { rows: { key: string; label: string; width: number; value: string; onClick: () => void }[]; colour: string }) {
  return (
    <ul className="space-y-1">
      {rows.map((one) => (
        <li key={one.key}>
          <button type="button" onClick={one.onClick} className="grid w-full grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 rounded-md py-1 text-left text-xs hover:bg-canvas">
            <span className="truncate">{one.label}</span>
            <span className="h-2 rounded-full bg-slate-100" aria-hidden="true">
              <span className={cn("block h-2 rounded-full", colour)} style={{ width: `${Math.min(100, Math.max(0, one.width))}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{one.value}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** The notes a figure across the top counts, as the server listed them. */
function counted(data: ClientStructuredEquity, one: SpKpi) {
  return data.notes.filter((note) => one.notes.includes(note.id));
}

/** What a figure across the top is made of, for the side panel. */
function kpiFigure(data: ClientStructuredEquity, one: SpKpi): FigureDetail {
  const cur = data.currency;
  const base: FigureDetail = { label: "Equity structured notes", value: kpiValue(one, cur), note: withAmount(one.detail, one.amount, cur) ?? undefined };
  const notes = data.notes;
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
      return { ...base, note: "The notes' mark-to-market as a share of the client's holdings; the notes are kept apart from the holdings.",
        facts: [{ label: "Notes · MTM", value: compact(data.total?.mtm ?? 0, cur) }, { label: "Holdings", value: one.amount == null ? "—" : compact(one.amount, cur) }] };
    case "RUNNING_COUPON":
      return { ...base, note: "Coupons weighted by notional, over the notes that pay one.", table: { title: "Coupon-bearing notes", columns: ["Note", "Notional", "Coupon % p.a."],
        rows: counted(data, one).map((note) => [note.label, compact(note.notional, cur), note.couponPercent]) } };
    case "CAPITAL_PROTECTED":
      return { ...base, table: { title: "Capital-protected notes", columns: ["Note", "Notional", "Payoff"],
        rows: counted(data, one).map((note) => [note.label, compact(note.notional, cur), note.payoff]) } };
    case "NEAR_BARRIER":
      return { ...base, note: "Notes whose worst level is within 20% of a knock-in.", table: { title: "Notes near a knock-in", columns: ["Note", "Worst-of level", "Barrier", "Distance"],
        rows: counted(data, one).map((note) => [note.label, levelText(note.worst, note.level), note.barrier, note.toBarrier == null ? null : `${note.toBarrier.toFixed(1)}%`]) } };
    case "NEXT_OBSERVATION":
      return { ...base, value: one.on ? fullDay(one.on) : "—", table: { title: "Observations in the next 90 days", columns: ["Date", "Event", "Expected"],
        rows: data.calendar.filter((event) => event.kind === "AUTOCALL_OBS" || event.kind === "COUPON_OBS").map((event) => [fullDay(event.on), event.title, event.status]) } };
    case "EXPECTED_AUTOCALLS":
      return { ...base, note: "Notes at or above their autocall trigger with an autocall date in the next three months.", table: { title: "Likely to autocall", columns: ["Note", "Notional", "Next event"],
        rows: counted(data, one).map((note) => [note.label, compact(note.notional, cur), nextEventText(note.nextEvent, note.nextEventOn)]) } };
    default:
      return base;
  }
}

/** One note's terms and what falls due on it. */
function noteFigure(data: ClientStructuredEquity, note: SpEquityNote): FigureDetail {
  const cur = data.currency;
  return {
    label: "Equity structured note",
    value: compact(note.mtm, cur),
    note: [note.structure, note.line, note.underlying].filter(Boolean).join(" · "),
    facts: [
      { label: "Issuer", value: note.issuer },
      { label: "Notional", value: compact(note.notional, cur) },
      { label: "Bid", value: `${note.bidPercent.toFixed(1)}%` },
      { label: "Coupon / payoff", value: note.payoff ?? "—" },
      { label: "Barrier", value: note.barrier ?? "—" },
      { label: "Worst-of level", value: levelText(note.worst, note.level) },
      { label: "To barrier", value: note.toBarrier == null ? "—" : `${note.toBarrier.toFixed(1)}%${note.toKnockOut ? " to KO" : ""}` },
      { label: "Status", value: note.status },
      { label: "Issued", value: fullDay(note.issuedOn) },
      { label: "Matures", value: fullDay(note.maturesOn) },
    ],
    table: note.events.length > 0 ? { title: "What falls due", columns: ["Date", "Event", "Expected"],
      rows: note.events.map((event) => [fullDay(event.on), withAmount(event.detail, event.amount, cur), event.status]) } : undefined,
  };
}

/** A payoff family or region, and the notes (or lines) in it. */
function shareFigure(data: ClientStructuredEquity, one: SpShare, by: "family" | "region"): FigureDetail {
  const cur = data.currency;
  const excel = data.source === "EXCEL";
  const lines = excel
    ? data.fileLines.filter((line) => (by === "family" ? line.productType ?? "Not stated" : line.geography ?? "Not stated") === one.key)
      .map((line) => [line.name, line.bank, line.marketValueUsd == null ? null : compact(line.marketValueUsd, cur)])
    : data.notes.filter((note) => (by === "family" ? note.category : note.region ?? "Other") === one.key)
      .map((note) => [note.label, note.issuer, compact(note.notional, cur)]);
  return {
    label: by === "family" ? "Payoff mix · structure family" : "Payoff mix · region",
    value: by === "family" ? `${one.percent.toFixed(1)}%` : compact(one.value, cur),
    note: `${one.notes} ${excel ? "line" : "note"}${one.notes === 1 ? "" : "s"} · ${compact(one.value, cur)} ${excel ? "market value" : "notional"}`,
    table: { columns: [excel ? "Line" : "Note", excel ? "Bank" : "Issuer", excel ? "Market value" : "Notional"], rows: lines },
  };
}

/** What Equity Structured Products offers for a card of the reader's own: its figures, mix and issuers. */
function equityFigures(data: ClientStructuredEquity): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const unitFormat = (unit: string) => (value: number) => unit === "PERCENT" ? `${value}%` : unit === "MONEY" ? amount(value) : value.toLocaleString("en-US");
  return {
    ...kpiFigures(data.kpis.filter((one) => one.unit !== "DATE"), unitFormat),
    "structured.families": sharesFigure("Notional by structure family", "Notes", data.byFamily.map((one) => ({ name: one.label, value: one.value })), amount),
    "structured.regions": sharesFigure("Notional by region", "Notes", data.byRegion.map((one) => ({ name: one.label, value: one.value })), amount),
    "structured.issuers": sharesFigure("MTM by issuer", "Risk", data.issuers.map((one) => ({ name: one.issuer, value: one.mtm })), amount),
  };
}
