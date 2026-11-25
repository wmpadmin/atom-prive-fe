import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspaceStructuredAlternative,
  type ClientStructuredAlternative,
  type SpAltNote,
  type SpAltScenario,
  type SpFxTrigger,
  type SpKpi,
  type SpShare,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useCurrencyParam } from "../../components/shown-currency";
import { CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { FIGURE_KINDS } from "../layout/figure-strip";
import { kpiFigures, sharesFigure, type Figures } from "../layout/own-cards";
import { ReportButton } from "../layout/report";
import { useDrill } from "./drill-panel";
import type { FigureDetail } from "./figure-panel";
import { eventFigure, issuerFigure, lineFigure } from "./structured-figures";
import { compact, fullDay, kpiValue, signedMoney, signTone, statusText, toneClass, withAmount } from "./structured-format";
import { CalendarCard, Card, Empty, FileBlock, FileLines, IssuersCard, KpiStrip, Note, Pill, Tabs } from "./structured-parts";

/**
 * A client's Alternative Structured Products, exactly as the firm's design draws it (25 Nov 2026), less what the
 * user's "What to Remove" sheet takes off: the Commodity delta, Non-USD settlement risk, CPPI risky exposure and Next
 * fixing figures across the top, and the CPPI Monitor. Every figure is worked out on the server from the notes kept for
 * the client; the notes, their levels, prices, shocks and statuses are demo figures, which the page says. A client whose
 * bank holdings Excels were uploaded sees their alternative structured lines as the sheets state them; the client read
 * only from his bank's feed sees not in bank file throughout. Read only.
 */
export function ClientStructuredAlternativePage() {
  const { customerId = "" } = useParams();
  const query = useGetClientWorkspaceStructuredAlternative<ClientStructuredAlternative, ApiError>(customerId, useCurrencyParam());
  const data = query.data;
  const view = useViewLayout("workspace.structured-alternative", CARDS, DEFAULT_CARDS);
  const drill = useDrill();

  if (query.isError) return <Alert tone="danger">{query.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the structured notes…</p>;
  const open = (key: string, name: string, figure: FigureDetail) => drill?.({ by: "figure", key: `structured-alternative.${key}`, name, figure });
  const openNote = (id: string) => {
    const note = data.notes.find((one) => one.id === id);
    if (note) open(`note.${id}`, note.label, noteFigure(data, note));
  };

  return (
    <div className="space-y-5">
      <header className="relative">
        <div className="absolute top-0 right-0 flex items-start gap-2"><ReportButton /><CustomizeButton view={view} /></div>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Structured Products / Alternatives
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Alternative Structured Products</h1>
        <p className="mt-1 text-sm text-ink-muted">Commodity, FX, hedge fund, digital asset, volatility and real estate-linked notes</p>
        <p className="mt-3 inline-flex rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          Benchmark: House Alternatives SAA
        </p>
      </header>

      <LayoutGrid view={view} screen="Alternative Structured Products" figures={data.source === "PLATFORM" ? alternativeFigures(data) : undefined} render={{
        kpis: (
          <div className="space-y-3">
            <KpiStrip data={data} kpis={data.kpis} labels={KPI_LABELS} onOpen={(one) => open(`kpi.${one.key}`, one.label, kpiFigure(data, one))} />
            {data.alert && <Note>{data.alert}</Note>}
          </div>
        ),
        notes: <NotesCard data={data} onOpen={openNote} />,
        exposure: <ExposureCard data={data} onOpen={(one) => open(`exposure.${one.key}`, one.label, exposureFigure(data, one))} />,
        scenarios: <ScenariosCard data={data} onOpen={(one) => open(`scenario.${one.key}`, one.name, scenarioFigure(data, one))} />,
        liquidity: <LiquidityCard data={data} onOpen={openNote} />,
        fx: <FxCard data={data} onOpen={openNote} />,
        calendar: (
          <CalendarCard data={data} title="Observation Calendar" lead="Next 90 days" empty="Nothing falls due in the next 90 days." events={data.calendar}
            onOpen={(one, at) => open(`event.${one.on}.${at}`, one.title, eventFigure(data, one, "Observation calendar"))} />
        ),
        issuers: (
          <IssuersCard data={data} lead="Unsecured issuer obligations across alternative-linked notes" issuers={data.issuers} limit={data.issuerLimit}
            empty="No alternative structured notes on file for this client." onOpen={(one) => open(`issuer.${one.issuer}`, one.issuer, issuerFigure(data, one))} />
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

type AlternativeCard = "kpis" | "notes" | "exposure" | "scenarios" | "liquidity" | "fx" | "calendar" | "issuers";

/**
 * The screen's cards, in the design's order less the CPPI Monitor the sheet removes. Exposure by Underlying shared its
 * row with the CPPI Monitor, so it now takes the whole row. Every card on by default.
 */
const CARDS: Record<AlternativeCard, LayoutMeta> = {
  kpis: { title: "Key figures", charts: [...FIGURE_KINDS], group: "Summary", wide: true },
  notes: { title: "Live Alternative Structured Notes", group: "Notes", wide: true },
  exposure: { title: "Exposure by Underlying", group: "Notes", wide: true },
  scenarios: { title: "Alternative Scenarios", group: "Risk", wide: true },
  liquidity: { title: "Liquidity & Valuation", group: "Risk", wide: true },
  fx: { title: "FX Trigger Monitor", group: "Events" },
  calendar: { title: "Observation Calendar", group: "Events" },
  issuers: { title: "Issuer Exposure", group: "Risk", wide: true },
};

// The screen as the portal was set up, every card on it: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS = Object.keys(CARDS) as AlternativeCard[];

/** The figures across the top, as the design names them less the four the sheet removes. */
const KPI_LABELS = ["Notional outstanding", "Mark-to-market", "Share of portfolio", "Capital-protected", "Underlying asset types", "Daily-priced notes"];

const FILTERS: [string, string][] = [["ALL", "All"], ["COMMODITIES", "Commodities"], ["FX", "FX"], ["HEDGE_FUNDS", "Hedge funds"], ["DIGITAL", "Digital"], ["REAL_ESTATE", "Real estate"]];

function NotesCard({ data, onOpen }: { data: ClientStructuredAlternative; onOpen: (id: string) => void }) {
  const drill = useDrill();
  const [filter, setFilter] = useState("ALL");
  const cur = data.currency;
  const shown = filter === "ALL" ? data.notes : data.notes.filter((one) => one.category === filter);
  return (
    <Card title="Live Alternative Structured Notes" flush
      lead={data.source === "EXCEL" ? `${data.name} · the bank holdings Excels' alternative structured lines, as sent` : `${data.name} · all entities · indicative issuer bids`}
      action={data.source === "PLATFORM" && data.notes.length > 0 ? <Tabs value={filter} onChange={setFilter} options={FILTERS} label="Asset" /> : undefined}>
      {data.source === "FEED" ? <div className="px-5"><FileBlock /></div> : data.source === "EXCEL" ? (
        <FileLines data={data} lines={data.fileLines} kind="alternative"
          onOpen={(line, at) => drill?.({ by: "figure", key: `structured-alternative.line.${at}`, name: line.name, figure: lineFigure(data, line) })} />
      ) : data.notes.length === 0 ? (
        <Empty>No alternative structured notes on file for this client.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="min-w-48 py-2 pr-2 pl-5">Structure</th>
                <th scope="col" className="min-w-40 px-1.5 py-2">Underlying</th>
                <th scope="col" className="px-1.5 py-2">Type</th>
                <th scope="col" className="min-w-28 px-1.5 py-2">Issuer</th>
                <th scope="col" className="px-1.5 py-2 text-right">Notional</th>
                <th scope="col" className="px-1.5 py-2 text-right">MTM</th>
                <th scope="col" className="min-w-48 px-1.5 py-2">Payoff terms</th>
                <th scope="col" className="py-2 pr-5 pl-1.5 text-right">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((one) => (
                <tr key={one.id} className="cursor-pointer hover:bg-canvas" onClick={() => onOpen(one.id)}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left font-normal">
                    <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline"
                      onClick={(event) => { event.stopPropagation(); onOpen(one.id); }}>{one.structure}</button>
                    {one.line && <span className="block text-2xs text-ink-muted">{one.line}</span>}
                  </th>
                  <td className="px-1.5 py-2 text-xs">{one.underlying}</td>
                  <td className="px-1.5 py-2"><Pill tone="bg-amber-50 text-amber-800">{one.type}</Pill></td>
                  <td className="px-1.5 py-2 text-xs">{one.issuer}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(one.notional, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.bidPercent.toFixed(1)}%</td>
                  <td className="px-1.5 py-2 text-xs">{one.payoff ?? "—"}</td>
                  <td className="py-2 pr-5 pl-1.5 text-right text-xs whitespace-nowrap tabular-nums">{one.level ?? "—"}</td>
                </tr>
              ))}
              {filter === "ALL" && data.total && (
                <tr className="border-t-2 border-line bg-canvas/60 font-bold">
                  <th scope="row" className="py-2 pr-2 pl-5 text-left">Total · {data.total.notes} note{data.total.notes === 1 ? "" : "s"}</th>
                  <td className="px-1.5 py-2" colSpan={3} />
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(data.total.notional, cur)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(data.total.mtm, cur)}</td>
                  <td className="py-2 pr-5 pl-1.5" colSpan={2} />
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

function ExposureCard({ data, onOpen }: { data: ClientStructuredAlternative; onOpen: (one: SpShare) => void }) {
  const largest = Math.max(1, ...data.exposure.map((one) => one.value));
  return (
    <Card title="Exposure by Underlying" lead={`MTM, ${data.currency} · look-through to the asset driving the payoff`}>
      {data.source !== "PLATFORM" ? <FileBlock /> : data.exposure.length === 0 ? <Empty>No alternative structured notes on file for this client.</Empty> : (
        <div className="space-y-4">
          <ul className="space-y-1">
            {data.exposure.map((one) => (
              <li key={one.key}>
                <button type="button" onClick={() => onOpen(one)} className="grid w-full grid-cols-[minmax(0,14rem)_1fr_5rem] items-center gap-3 rounded-md py-1 text-left text-xs hover:bg-canvas">
                  <span className="truncate">{one.label}</span>
                  <span className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                    <span className="block h-2 rounded-full bg-[#8a6d3b]" style={{ width: `${Math.min(100, (one.value / largest) * 100)}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{compact(one.value, data.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.exposureNote && <Note>{data.exposureNote}</Note>}
        </div>
      )}
    </Card>
  );
}

function ScenariosCard({ data, onOpen }: { data: ClientStructuredAlternative; onOpen: (one: SpAltScenario) => void }) {
  return (
    <Card title="Alternative Scenarios" flush lead={`MTM change, ${data.currency} · single-factor shocks and a combined risk-off case`}>
      {data.source !== "PLATFORM" ? <div className="px-5"><FileBlock /></div> : data.scenarios.length === 0 ? <Empty>No scenarios for these notes.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Scenario</th>
                <th scope="col" className="px-1.5 py-2">Shock</th>
                <th scope="col" className="px-1.5 py-2 text-right">Book impact</th>
                <th scope="col" className="px-1.5 py-2 text-right">% of SP book</th>
                <th scope="col" className="px-1.5 py-2">Most affected</th>
                <th scope="col" className="py-2 pr-5 pl-1.5">What happens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.scenarios.map((one) => (
                <tr key={one.key} className={cn("cursor-pointer hover:bg-canvas", one.combined && "border-t-2 border-line bg-canvas/60 font-bold")} onClick={() => onOpen(one)}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left text-xs font-semibold whitespace-nowrap">{one.name}</th>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{one.shock}</td>
                  <td className={cn("px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums", signTone(one.impact))}>{signedMoney(one.impact, data.currency)}</td>
                  <td className={cn("px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums", signTone(one.percentOfBook))}>
                    {one.percentOfBook > 0 ? "+" : one.percentOfBook < 0 ? "−" : ""}{Math.abs(one.percentOfBook).toFixed(1)}%
                  </td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{one.mostAffected}</td>
                  <td className={cn("py-2 pr-5 pl-1.5 text-xs", !one.combined && "text-ink-soft")}>{one.whatHappens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LiquidityCard({ data, onOpen }: { data: ClientStructuredAlternative; onOpen: (id: string) => void }) {
  const percent = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(1)}%`);
  return (
    <Card title="Liquidity & Valuation" flush lead="How quickly each note can be sold, and how fresh the price is">
      {data.source !== "PLATFORM" ? <div className="px-5"><FileBlock /></div> : data.liquidity.length === 0 ? <Empty>No alternative structured notes on file for this client.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Note</th>
                <th scope="col" className="px-1.5 py-2">Pricing source</th>
                <th scope="col" className="px-1.5 py-2">Frequency</th>
                <th scope="col" className="px-1.5 py-2">Last price</th>
                <th scope="col" className="px-1.5 py-2 text-right">Bid / offer</th>
                <th scope="col" className="px-1.5 py-2 text-right">Est. early-exit cost</th>
                <th scope="col" className="px-1.5 py-2">Settlement</th>
                <th scope="col" className="py-2 pr-5 pl-1.5">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.liquidity.map((one) => (
                <tr key={one.noteId} className="cursor-pointer hover:bg-canvas" onClick={() => onOpen(one.noteId)}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left text-xs font-semibold whitespace-nowrap">{one.label}</th>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{one.pricingSource}</td>
                  <td className="px-1.5 py-2 text-xs">{one.frequency}</td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap tabular-nums">{fullDay(one.lastPriced)}</td>
                  <td className="px-1.5 py-2 text-right text-xs tabular-nums">{percent(one.bidOffer)}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.exitCost == null ? one.exitText ?? "—" : percent(one.exitCost)}</td>
                  <td className="px-1.5 py-2 text-xs whitespace-nowrap">{one.settlement}</td>
                  <td className="py-2 pr-5 pl-1.5"><Pill tone={toneClass(one.valuationTone)}>{one.valuation}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FxCard({ data, onOpen }: { data: ClientStructuredAlternative; onOpen: (id: string) => void }) {
  return (
    <Card title="FX Trigger Monitor" lead="Spot vs strike and range">
      {data.source !== "PLATFORM" ? <FileBlock /> : data.fxTriggers.length === 0 ? <Empty>No FX-linked notes on file for this client.</Empty> : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink" aria-hidden="true" />Spot</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-xs bg-emerald-50 ring-1 ring-emerald-200" aria-hidden="true" />Safe zone</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-amber-700" aria-hidden="true" />Trigger</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-2">Note</th>
                  <th scope="col" className="px-1.5 py-2">Pair</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Spot</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Trigger</th>
                  <th scope="col" className="px-1.5 py-2 text-right">Cushion</th>
                  <th scope="col" className="py-2 pl-3">Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.fxTriggers.map((one) => (
                  <tr key={one.noteId} className="cursor-pointer hover:bg-canvas" onClick={() => onOpen(one.noteId)}>
                    <th scope="row" className="py-2 pr-2 text-left text-xs font-semibold whitespace-nowrap">{one.label}</th>
                    <td className="px-1.5 py-2 text-xs">{one.pair}</td>
                    <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.spot.toFixed(one.decimals)}</td>
                    <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">
                      {one.upper == null ? one.lower.toFixed(one.decimals) : `${one.lower.toFixed(2)}–${one.upper.toFixed(2)}`}
                    </td>
                    <td className={cn("px-1.5 py-2 text-right text-xs tabular-nums", statusText(one.tone))}>{one.cushion.toFixed(1)}%</td>
                    <td className="py-2 pl-3"><Track one={one} /></td>
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

/** Spot against the strike or the range, on a scale a little wider than both. */
function Track({ one }: { one: SpFxTrigger }) {
  const low = Math.min(one.lower, one.spot) * 0.97;
  const high = Math.max(one.upper ?? one.lower, one.spot) * 1.03;
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))}%`;
  // Above a single strike is safe (the note repays in its own currency); inside a range is safe.
  const zoneFrom = one.lower;
  const zoneTo = one.upper ?? high;
  return (
    <span className="relative block h-2.5 w-36 rounded-full bg-slate-100" aria-label={`Spot ${one.spot} against ${one.upper == null ? `a strike of ${one.lower}` : `a range of ${one.lower} to ${one.upper}`}`}>
      <span className="absolute inset-y-0 bg-emerald-50" style={{ left: at(zoneFrom), width: `calc(${at(zoneTo)} - ${at(zoneFrom)})` }} />
      <span className="absolute -top-0.5 h-3.5 w-0.5 bg-amber-700" style={{ left: at(one.lower) }} />
      {one.upper != null && <span className="absolute -top-0.5 h-3.5 w-0.5 bg-amber-700" style={{ left: at(one.upper) }} />}
      <span className="absolute top-0.5 -ml-1 size-2 rounded-full bg-ink" style={{ left: at(one.spot) }} />
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

/** The notes a figure across the top counts, as the server listed them. */
function counted(data: ClientStructuredAlternative, one: SpKpi) {
  return data.notes.filter((note) => one.notes.includes(note.id));
}

/** What a figure across the top is made of, for the side panel. */
function kpiFigure(data: ClientStructuredAlternative, one: SpKpi): FigureDetail {
  const cur = data.currency;
  const base: FigureDetail = { label: "Alternative structured notes", value: kpiValue(one, cur), note: withAmount(one.detail, one.amount, cur) ?? undefined };
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
      return { ...base, note: "The notes' mark-to-market as a share of the client's holdings; the notes are kept apart from the holdings.",
        facts: [{ label: "Notes · MTM", value: compact(data.total?.mtm ?? 0, cur) }, { label: "Holdings", value: one.amount == null ? "—" : compact(one.amount, cur) }] };
    case "CAPITAL_PROTECTED":
      return { ...base, table: { title: "Capital-protected notes", columns: ["Note", "Notional", "Payoff"], rows: notes.map((note) => [note.label, compact(note.notional, cur), note.payoff]) } };
    case "ASSET_TYPES":
      return { ...base, table: { title: "By asset type", columns: ["Note", "Type", "Underlying"], rows: notes.map((note) => [note.label, note.type, note.underlying]) } };
    case "DAILY_PRICED":
      return { ...base, table: { title: "Pricing", columns: ["Note", "Frequency", "Last price"],
        rows: data.liquidity.map((row) => [row.label, row.frequency, fullDay(row.lastPriced)]) } };
    default:
      return base;
  }
}

/** One note's terms and what falls due on it. */
function noteFigure(data: ClientStructuredAlternative, note: SpAltNote): FigureDetail {
  const cur = data.currency;
  const priced = data.liquidity.find((one) => one.noteId === note.id);
  return {
    label: "Alternative structured note",
    value: compact(note.mtm, cur),
    note: [note.structure, note.line, note.underlying].filter(Boolean).join(" · "),
    facts: [
      { label: "Type", value: note.type },
      { label: "Issuer", value: note.issuer },
      { label: "Notional", value: compact(note.notional, cur) },
      { label: "Bid", value: `${note.bidPercent.toFixed(1)}%` },
      { label: "Payoff terms", value: note.payoff ?? "—" },
      { label: "Level", value: note.level ?? "—" },
      ...(priced ? [{ label: "Priced", value: `${priced.frequency} · ${priced.pricingSource}` }, { label: "Settlement", value: priced.settlement }] : []),
      { label: "Issued", value: fullDay(note.issuedOn) },
      { label: "Matures", value: fullDay(note.maturesOn) },
    ],
    table: note.events.length > 0 ? { title: "What falls due", columns: ["Date", "Event", "Expected"],
      rows: note.events.map((event) => [fullDay(event.on), `${event.title} · ${withAmount(event.detail, event.amount, cur)}`, event.status]) } : undefined,
  };
}

/** The notes behind one underlying's exposure. */
function exposureFigure(data: ClientStructuredAlternative, one: SpShare): FigureDetail {
  const cur = data.currency;
  return {
    label: "Exposure by underlying",
    value: compact(one.value, cur),
    note: `${one.percent.toFixed(1)}% of the notes' mark-to-market · ${one.notes} note${one.notes === 1 ? "" : "s"}`,
    table: { columns: ["Note", "Underlying", "MTM"],
      rows: data.notes.filter((note) => note.exposure === one.key).map((note) => [note.label, note.underlying, compact(note.mtm, cur)]) },
  };
}

/** One shock: its impact, the notes it moves and what happens. */
function scenarioFigure(data: ClientStructuredAlternative, one: SpAltScenario): FigureDetail {
  const cur = data.currency;
  return {
    label: "Alternative scenarios",
    value: signedMoney(one.impact, cur),
    note: `${one.shock} · ${one.whatHappens}`,
    facts: [{ label: "% of SP book", value: `${one.percentOfBook > 0 ? "+" : one.percentOfBook < 0 ? "−" : ""}${Math.abs(one.percentOfBook).toFixed(1)}%` },
      { label: "Most affected", value: one.mostAffected }],
    table: { title: "Notes it moves, most affected first", columns: ["Note", "Underlying", "MTM"],
      rows: one.noteIds.map((id) => data.notes.find((note) => note.id === id)).filter((note): note is SpAltNote => note != null)
        .map((note) => [note.label, note.underlying, compact(note.mtm, cur)]) },
  };
}

/** What Alternative Structured Products offers for a card of the reader's own: its figures, exposure and issuers. */
function alternativeFigures(data: ClientStructuredAlternative): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const unitFormat = (unit: string) => (value: number) => unit === "PERCENT" ? `${value}%` : unit === "MONEY" ? amount(value) : value.toLocaleString("en-US");
  return {
    ...kpiFigures(data.kpis.filter((one) => one.unit !== "DATE"), unitFormat),
    "structured.exposure": sharesFigure("MTM by underlying", "Notes", data.exposure.map((one) => ({ name: one.label, value: one.value })), amount),
    "structured.issuers": sharesFigure("MTM by issuer", "Risk", data.issuers.map((one) => ({ name: one.issuer, value: one.mtm })), amount),
  };
}
