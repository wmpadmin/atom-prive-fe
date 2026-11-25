import type { SpEvent, SpFileLine, SpIssuer, SpKpi, SpScenarioSet } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { TableColumns } from "../../components/table-columns";
import { useCardLabel } from "../layout/card-settings";
import { CardMenu } from "../layout/custom-view";
import { FigureRow, FigureStrip, useFiguresAsTable } from "../layout/figure-strip";
import { asSent, compact, dayMonth, kpiValue, signedMoney, signTone, toneClass, withAmount } from "./structured-format";

/**
 * The pieces the Structured Products screens share (25 Nov 2026), so that Equity, Fixed Income and Alternative draw
 * their figures, tables, scenarios, calendars and issuers alike. Each piece lays out what the server sent; a click hands
 * the row to the screen, which opens its breakdown.
 */

/** Whatever every Structured Products screen carries that these pieces read. */
type Screen = { source: string; currency: string; name: string };

/**
 * A card as the client's other screens draw theirs.
 *
 * @param flush the card's body runs to its edges, for a table
 * @param action beside the title: the card's tabs
 */
export function Card({ title, lead, flush, action, children }: { title: string; lead?: string; flush?: boolean; action?: ReactNode; children: ReactNode }) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  const body = useRef<HTMLDivElement>(null);
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-3", flush && "px-5")}>
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{action}<TableColumns scope={body} /><CardMenu /></div>
      </div>
      <div ref={body} className="contents">{children}</div>
    </section>
  );
}

export function Tabs({ value, onChange, options, label, scroll }: { value: string; onChange: (next: string) => void; options: [string, string][]; label: string; scroll?: boolean }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex w-fit max-w-full rounded-lg border border-line p-0.5", scroll && "scroll-x-quietly")}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap", value === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** A line of explanation under a figure or a chart, as the designs set them in a grey box. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs text-ink-soft">
      <span className="mt-px grid size-3.5 shrink-0 place-items-center rounded-full border border-ink-muted text-[0.5rem] font-bold text-ink-muted" aria-hidden="true">i</span>
      <span>{children}</span>
    </p>
  );
}

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{children}</span>;
}

/** Where a client's files hold nothing; on one line, as every card here has room for it. */
export function NotInFile() {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-left text-3xs leading-tight font-medium whitespace-nowrap text-ink-muted">
      not in bank file
    </span>
  );
}

export function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

/* ------------------------------------------------------------------------------------------------------------ */

/**
 * The figures across the top. A figure the client's files leave out says so; the client read only from his bank's feed
 * has none, and every label says not in bank file.
 *
 * @param labels the figures' labels in the design's order, for the client whose feed sends none
 */
export function KpiStrip({ data, kpis, labels, onOpen }: { data: Screen; kpis: SpKpi[]; labels: string[]; onOpen: (one: SpKpi) => void }) {
  const rows = useFiguresAsTable();
  const shown: (SpKpi | null)[] = kpis.length > 0 ? kpis : labels.map(() => null);
  return (
    <FigureStrip className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      {shown.map((one, at) => {
        const label = one?.label ?? labels[at]!;
        // A figure the files leave out: the sheets' or the feed's, never the platform's own.
        const absent = data.source !== "PLATFORM" && (one == null || (one.value == null && one.on == null));
        const detail = one && !absent ? withAmount(one.detail, one.amount, data.currency) : null;
        const tag = one?.tag && !absent ? <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap", toneClass(one.tagTone))}>{one.tag}</span> : null;
        if (rows) {
          return (
            <FigureRow key={label} label={one && !absent ? (
              <button type="button" className="text-left hover:text-primary-700 hover:underline" onClick={() => onOpen(one)}>{label}</button>
            ) : label} value={absent ? <NotInFile /> : <>{kpiValue(one!, data.currency)}{tag && <span className="ml-2">{tag}</span>}</>} note={detail} />
          );
        }
        const clickable = one && !absent;
        return (
          <div key={label} className={cn("rounded-2xl border border-line bg-white px-4 py-3.5", clickable && "cursor-pointer hover:border-ink-muted")}
            {...(clickable ? { role: "button", tabIndex: 0, onClick: () => onOpen(one), onKeyDown: (event: ReactKeyboardEvent) => { if (event.key === "Enter") onOpen(one); } } : {})}>
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
            {absent ? <div className="mt-2"><NotInFile /></div> : (
              <>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums">{kpiValue(one!, data.currency)}{tag}</p>
                {detail && <p className="mt-1 text-xs text-ink-muted">{detail}</p>}
              </>
            )}
          </div>
        );
      })}
    </FigureStrip>
  );
}

/** A bank Excel's structured lines of the screen's class, each cell as the sheet states it. */
export function FileLines({ data, lines, kind, onOpen }: { data: Screen; lines: SpFileLine[]; kind: string; onOpen: (one: SpFileLine, at: number) => void }) {
  const cur = data.currency;
  if (lines.length === 0) return <Empty>The bank holdings Excels hold no {kind} structured lines.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="min-w-56 py-2 pr-2 pl-5">Name</th>
            <th scope="col" className="px-1.5 py-2">Bank</th>
            <th scope="col" className="min-w-40 px-1.5 py-2">Product type</th>
            <th scope="col" className="px-1.5 py-2">Ccy</th>
            <th scope="col" className="px-1.5 py-2 text-right">Holding</th>
            <th scope="col" className="px-1.5 py-2 text-right">Last price</th>
            <th scope="col" className="px-1.5 py-2 text-right">Market value</th>
            <th scope="col" className="px-1.5 py-2 text-right">P&amp;L</th>
            <th scope="col" className="px-1.5 py-2 text-right">P&amp;L %</th>
            <th scope="col" className="px-1.5 py-2">Issuer</th>
            <th scope="col" className="py-2 pr-5 pl-1.5">Geography</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((one, at) => (
            <tr key={`${one.bank}-${one.isin ?? one.name}-${at}`} className="cursor-pointer hover:bg-canvas" onClick={() => onOpen(one, at)}>
              <th scope="row" className="py-2 pr-2 pl-5 text-left font-normal">
                <button type="button" className="text-left font-semibold hover:text-primary-700 hover:underline"
                  onClick={(event) => { event.stopPropagation(); onOpen(one, at); }}>{one.name}</button>
                {one.isin && <span className="block text-2xs text-ink-muted">{one.isin}</span>}
              </th>
              <td className="px-1.5 py-2 text-xs">{one.bank}</td>
              <td className="px-1.5 py-2 text-xs">{one.productType ?? "—"}</td>
              <td className="px-1.5 py-2 text-xs">{one.currency ?? "—"}</td>
              <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.holding == null ? "—" : asSent(one.holding)}</td>
              <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.lastPrice == null ? "—" : asSent(one.lastPrice)}</td>
              <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{one.marketValueUsd == null ? "—" : compact(one.marketValueUsd, cur)}</td>
              <td className={cn("px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums", signTone(one.pnlUsd))}>{one.pnlUsd == null ? "—" : signedMoney(one.pnlUsd, cur)}</td>
              <td className={cn("px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums", signTone(one.pnlPercent))}>{one.pnlPercent == null ? "—" : `${one.pnlPercent.toFixed(2)}%`}</td>
              <td className="px-1.5 py-2 text-xs">{one.issuer ?? "—"}</td>
              <td className="py-2 pr-5 pl-1.5 text-xs">{one.geography ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A scenarios card: its tabs, each note's change for each shock, the book, and what the shocks show. A note a tab does
 * not move shows a dash.
 *
 * @param lead the line under the title, for the tab shown
 */
export function ScenariosCard({ data, title, sets, note, lead, empty, onOpen }: {
  data: Screen; title: string; sets: SpScenarioSet[]; note: string | null; lead: (set: SpScenarioSet | undefined) => string; empty: string;
  onOpen: (set: SpScenarioSet, row: SpScenarioSet["rows"][number] | null, at: number) => void;
}) {
  const [key, setKey] = useState(sets[0]?.key ?? "");
  const set = sets.find((one) => one.key === key) ?? sets[0];
  const cur = data.currency;
  const cell = (amount: number | null | undefined, at: number, last: boolean, open: () => void) => (
    <td key={at} className={cn("py-2 text-right text-xs whitespace-nowrap tabular-nums", signTone(amount), last ? "pr-5 pl-1.5" : "px-1.5")}>
      {amount == null ? <span className="text-ink-muted">—</span> : <button type="button" className="hover:underline" onClick={open}>{signedMoney(amount, cur)}</button>}
    </td>
  );
  return (
    <Card title={title} flush lead={lead(set)}
      action={data.source === "PLATFORM" && sets.length > 0 ? <Tabs value={set?.key ?? key} onChange={setKey} options={sets.map((one) => [one.key, one.label])} label="Scenario" /> : undefined}>
      {data.source !== "PLATFORM" ? <div className="px-5"><FileBlock /></div> : !set ? <Empty>{empty}</Empty> : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-2 pl-5">Note</th>
                  {set.moves.map((move, at) => (
                    <th key={move} scope="col" className={cn("py-2 text-right", at === set.moves.length - 1 ? "pr-5 pl-1.5" : "px-1.5")}>{move}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {set.rows.map((row) => (
                  <tr key={row.noteId}>
                    <th scope="row" className="py-2 pr-2 pl-5 text-left text-xs font-semibold whitespace-nowrap">{row.label}</th>
                    {row.amounts.map((amount, at) => cell(amount, at, at === row.amounts.length - 1, () => onOpen(set, row, at)))}
                  </tr>
                ))}
                <tr className="border-t-2 border-line bg-canvas/60 font-bold">
                  <th scope="row" className="py-2 pr-2 pl-5 text-left text-xs">Book</th>
                  {set.book.map((amount, at) => cell(amount, at, at === set.book.length - 1, () => onOpen(set, null, at)))}
                </tr>
              </tbody>
            </table>
          </div>
          {note && <div className="px-5"><Note>{note}</Note></div>}
        </div>
      )}
    </Card>
  );
}

/** What falls due next on each note, as the designs list it. */
export function CalendarCard({ data, title, lead, empty, events, onOpen }: {
  data: Screen; title: string; lead: string; empty: string; events: SpEvent[]; onOpen: (one: SpEvent, at: number) => void;
}) {
  return (
    <Card title={title} lead={lead}>
      {data.source !== "PLATFORM" ? <FileBlock /> : events.length === 0 ? <Empty>{empty}</Empty> : (
        <ul className="divide-y divide-line">
          {events.map((one, at) => (
            <li key={`${one.on}-${one.noteId}-${one.kind}`}>
              <button type="button" onClick={() => onOpen(one, at)} className="flex w-full items-center gap-3 rounded-md py-2.5 text-left hover:bg-canvas">
                <span className="w-11 shrink-0 rounded-lg border border-line py-1 text-center leading-none">
                  <span className="block text-base font-bold tabular-nums">{dayMonth(one.on).split(" ")[0]}</span>
                  <span className="block text-3xs font-semibold tracking-wider text-ink-muted uppercase">{dayMonth(one.on).split(" ")[1]}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{one.title}</span>
                  <span className="block text-xs text-ink-muted">{withAmount(one.detail, one.amount, data.currency)}</span>
                </span>
                <Pill tone={toneClass(one.statusTone)}>{one.status}</Pill>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The issuers the notes are owed by, against the issuer limit; a bank Excel's ratings, CDS and limit are not in it. */
export function IssuersCard({ data, lead, issuers, limit, empty, onOpen }: {
  data: Screen; lead: string; issuers: SpIssuer[]; limit: number | null; empty: string; onOpen: (one: SpIssuer) => void;
}) {
  const excel = data.source === "EXCEL";
  return (
    <Card title="Issuer Exposure" flush lead={lead}>
      {data.source === "FEED" ? <div className="px-5"><FileBlock /></div> : issuers.length === 0 ? <Empty>{empty}</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wide whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Issuer</th>
                <th scope="col" className="px-1.5 py-2">Rating</th>
                <th scope="col" className="px-1.5 py-2 text-right">5Y CDS</th>
                <th scope="col" className="px-1.5 py-2 text-right">Notes</th>
                <th scope="col" className="px-1.5 py-2 text-right">{excel ? "Market value" : "MTM"}</th>
                <th scope="col" className="px-1.5 py-2">Share of book</th>
                <th scope="col" className="py-2 pr-5 pl-1.5">{limit != null ? `Limit · ${compact(limit, data.currency)}` : "Limit"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {issuers.map((one) => (
                <tr key={one.issuer} className="cursor-pointer hover:bg-canvas" onClick={() => onOpen(one)}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left text-xs font-semibold whitespace-nowrap">{one.issuer}</th>
                  <td className="px-1.5 py-2 text-xs">{excel ? <NotInFile /> : one.rating ?? "—"}</td>
                  <td className="px-1.5 py-2 text-right text-xs tabular-nums">{excel ? <NotInFile /> : one.cdsBp == null ? "—" : `${one.cdsBp} bp`}</td>
                  <td className="px-1.5 py-2 text-right text-xs tabular-nums">{one.notes}</td>
                  <td className="px-1.5 py-2 text-right text-xs whitespace-nowrap tabular-nums">{compact(one.mtm, data.currency)}</td>
                  <td className="px-1.5 py-2">
                    <span className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="h-1.5 w-20 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.min(100, one.share)}%` }} />
                      </span>
                      {one.share.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 pr-5 pl-1.5">
                    {excel ? <NotInFile /> : one.withinLimit == null ? <span className="text-xs text-ink-muted">No limit set</span>
                      : <Pill tone={one.withinLimit ? toneClass("OK") : toneClass("DANGER")}>{one.withinLimit ? "Within limit" : "Over limit"}</Pill>}
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
