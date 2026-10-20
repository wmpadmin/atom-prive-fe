import { ApiError } from "@atomprive/api-client";
import {
  useGetClientValuations,
  type ValuationHistory,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { nameOf, useAssetClasses } from "./asset-classes";
import {
  changesIn, daysFrom, money, movedWithin, versionAndTheOneBefore,
  type Basis, type Day, type DayChange,
} from "./daily-tracker-days";

/**
 * One day of a client's portfolio, in full.
 *
 * <p>A day of its own rather than a drawer under the row that names it. Opened in place, a single day took
 * the height of six and buried the rest of the tracker under itself — and what it was showing was a table
 * of its own squeezed into one cell of another, which is why its sub-assets were read as a grid of lists
 * rather than the table they are.
 *
 * <p>It reads the same history the tracker reads and works the day out the same way, so the figure here
 * and the figure on the row that led here cannot part.
 */
export function DailyTrackerChangePage() {
  const { customerId = "", on = "", revision = "" } = useParams();
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId, { every: true });
  const classes = useAssetClasses();
  // The figures on this page are read, never put back. Asking for a client's figures to be returned to
  // an earlier day replaced every figure they had at once, which is a larger change than the firm wants
  // anybody making by hand; what a client holds will come from the daily file instead. The day itself is
  // still here to be read, and so is every restore that was asked for while it was possible.

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const day = daysFrom(history.data?.points ?? []).find((one) => one.on === on) ?? null;
  // Which version is being read, and what it is read against. A day written several times has figures for
  // each of them and this page only ever showed the one it closed on, so a change made at eleven and
  // corrected at noon left nothing on screen but the correction.
  // Which change is on screen, out of the address rather than out of a click. Held as state, a change
  // somebody was reading could not be linked to, bookmarked or reached again after a refresh — and the
  // restore raised from it named a record no address could reproduce.
  const reading = Number.isFinite(Number(revision)) ? Number(revision) : null;
  const pair = (day === null || reading === null)
    ? null : versionAndTheOneBefore(history.data?.points ?? [], reading);
  const shownLines = pair?.version.lines ?? {};
  const beforeLines = pair?.before?.lines ?? {};
  // What each class held, which the platform has kept since long before it kept the lines inside them.
  // Read here because the page used to look only at the lines: a day recorded by class alone had every
  // figure on screen in the row that led here and told the reader there was nothing to show.
  const shownClasses = pair?.version.holdings ?? {};
  const beforeClasses = pair?.before?.holdings ?? {};
  const worth = pair?.version.underManagement ?? 0;
  const movedBy = (pair === null || pair.before === null)
    ? null : pair.version.underManagement - pair.before.underManagement;
  const codes = classes.inUse
    .map((one) => one.code)
    .filter((code) => Object.keys(shownLines[code] ?? {}).length > 0 || (shownClasses[code] ?? 0) !== 0);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/portfolio-clients/${customerId}/days/${on}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to {on}
        </Link>
        <h1 className="mt-2 text-[1.625rem] font-bold">Change {reading}</h1>
        {/* What the number counts, because it does not count what a page about one day looks like it
            counts. It is the client's whole history, so a day touched once can read "Change 4" with
            no changes 1 to 3 anywhere on it — which sent its first reader hunting for three records
            that were on three other days. */}
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Written on {on} — the day somebody typed these figures, not a day the market was read.
          The numbering runs through everything ever written down for this client, not through this
          day: {whereItSits(day, reading)}.
        </p>
      </div>

      {history.isPending ? (
        <section className="rounded-2xl border border-line bg-white px-6 py-10">
          <p className="text-sm text-ink-muted">Reading the day…</p>
        </section>
      ) : day === null ? (
        <section className="rounded-2xl border border-line bg-white px-6 py-10">
          <p className="text-sm text-ink-muted">
            Nothing was written down on {on}. A day exists here only where somebody wrote the holdings
            down, so a day that is missing is a day nobody wrote anything — not a day nothing happened.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-white px-6 py-5">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                {/* The classes added up, which is what the Net AUM calculator calls a total allocation.
                    A Net AUM is that less the loan and plus what the client owns outright, and a day
                    keeps neither — so this heading named a figure the screen has never held. */}
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  Total allocation
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{money(worth)}</p>
              </div>
              <div>
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  Moved since the change before
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums",
                  movedBy === null ? "text-ink-muted"
                    : movedBy > 0 ? "text-emerald-700"
                      : movedBy < 0 ? "text-red-700" : "text-ink-muted")}
                >
                  {movedBy === null
                    ? "—"
                    : `${movedBy > 0 ? "+" : movedBy < 0 ? "−" : ""}${money(Math.abs(movedBy))}`}
                </p>
              </div>
              <div>
                {/* The hour, not the number. The heading above already says which change this is, and
                    "Reading" is this platform's word for a screen still loading — it is used that way
                    twice on the screen this one is opened from. */}
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Written at</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {pair ? atTime(pair.version.recordedAt) : "—"}
                </p>
                {pair?.version.closedTheDay && (
                  <p className="text-2xs text-ink-muted">
                    this is the figure every other screen reads the day by
                  </p>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Figures in {currency}. What moved is the whole of the change, which includes anything paid in
              or taken out that day — it is not what the money earned.
            </p>
          </section>

          <section>
            <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              What each sub-asset held
            </h2>
            <p className="mt-1 max-w-prose text-xs text-ink-muted">
              Asset class, then the sub-assets inside it, with what each held before this change beside what
              it held after it. Figures in {currency}.
            </p>
            <div className="mt-3">
              <Inside on={on} lines={shownLines} before={beforeLines} first={pair?.before == null}
                classes={shownClasses} beforeClasses={beforeClasses}
                codes={codes} names={classes.names} currency={currency} />
            </div>
          </section>
        </>
      )}

    </div>
  );
}

/**
 * Where a change sits among the ones written on its own day.
 *
 * <p>Said because the number beside it does not say it. "Change 4" on a day holding one change is the
 * client's fourth ever, and a reader who takes it for the day's fourth goes looking for three more.
 */
function whereItSits(day: Day | null, reading: number | null) {
  if (day === null || reading === null) return "one of the changes written for them";
  const at = day.versions.findIndex((one) => one.revision === reading);
  if (day.versions.length === 1) return "it is the only change written on this day";
  return `it is the ${nth(at + 1)} of ${day.versions.length} written on this day`;
}

function nth(at: number) {
  if (at === 1) return "first";
  if (at === 2) return "second";
  if (at === 3) return "third";
  return `${at}th`;
}

/**
 * One day of the tracker: what the portfolio closed at, and every change written that day.
 *
 * <p>A day and a change used to be one screen. It opened straight onto the change the day ended on and
 * offered a list of the others only where there were others — so a day said "Change 4" with nothing
 * around it to say what that was the fourth of, and no way to the rest.
 *
 * <p>Now the day is a list and a change is a page. The list always draws, even for a day written once,
 * because "one change on this day" is an answer and a bare number is not.
 */
export function DailyTrackerDayPage() {
  const { customerId = "", on = "" } = useParams();
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId, { every: true });
  const classes = useAssetClasses();
  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }
  const currency = history.data?.currency ?? "";
  const day = daysFrom(history.data?.points ?? []).find((one) => one.on === on) ?? null;
  // Worked out once, for the figure at the top of the day and for the table underneath it. A day read
  // twice is two answers waiting to differ, and they did: the total at the top said nothing had moved,
  // over a list of what had moved.
  const changes = day === null ? [] : changesIn(day);
  const moved = movedWithin(changes);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/portfolio-clients/${customerId}?tab=daily`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to the daily tracker
        </Link>
        <h1 className="mt-2 text-[1.625rem] font-bold">{on}</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Every change written down on this day. The portfolio is read elsewhere by the one it ended on;
          the others are what it took to get there. Open one to see what each sub-asset held.
        </p>
      </div>

      {history.isPending ? (
        <section className="rounded-2xl border border-line bg-white px-6 py-10">
          <p className="text-sm text-ink-muted">Reading the day…</p>
        </section>
      ) : day === null ? (
        <section className="rounded-2xl border border-line bg-white px-6 py-10">
          <p className="text-sm text-ink-muted">
            Nothing was written down on {on}. A day exists here only where somebody wrote the holdings
            down, so this is a day nobody wrote anything — not a day nothing happened.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-white px-6 py-5">
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
              <div>
                <p className="text-2xs tracking-wider text-ink-muted uppercase">
                  Total allocation it closed at
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{money(day.worth)}</p>
              </div>
              {/* What the day did INSIDE itself — the question somebody opens a day to ask, and the one
                  figure that was not on the page. Money taken out of one sub-asset and put into another
                  leaves the total exactly where it was, so a day read by its total alone announced that
                  nothing had happened directly above the list of what had happened. */}
              <div>
                <p className="text-2xs tracking-wider text-ink-muted uppercase">
                  Moved between holdings
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums",
                  moved > 0.005 ? "text-ink" : "text-ink-muted")}>
                  {moved > 0.005 ? money(moved) : "Nothing"}
                </p>
              </div>
              {/* And what the day did to the total, which is a different question that used to wear the
                  other one's name. Said against a date rather than against "the day before on file":
                  that day can be a fortnight back, and a reader has no way to tell which day it was. */}
              <div>
                <p className="text-2xs tracking-wider text-ink-muted uppercase">
                  {day.dayBefore === null
                    ? "Nothing on file before this"
                    : `Allocation against ${day.dayBefore.on}`}
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums",
                  day.moved === null ? "text-ink-muted"
                    : day.moved > 0 ? "text-emerald-700" : day.moved < 0 ? "text-red-600" : "text-ink")}>
                  {day.moved === null
                    ? "—"
                    : `${day.moved > 0 ? "+" : day.moved < 0 ? "−" : ""}${money(Math.abs(day.moved))}`}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Figures in {currency}. What moved between holdings is money that went from one sub-asset to
              another, which leaves the total where it was. What the allocation did against an earlier day
              is the whole of the change, anything paid in or taken out included — it is not what the money
              earned. A day exists here only where somebody wrote the holdings down, so the day it is read
              against may be weeks earlier.
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white">
            <h2 className="border-b border-line px-6 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              {day.versions.length === 1 ? "One change on this day" : `${day.versions.length} changes on this day`}
            </h2>
            <Changes
              day={day}
              changes={changes}
              currency={currency}
              customerId={customerId}
              names={classes.names}
            />
          </section>
        </>
      )}
    </div>
  );
}

/** The hour a change was written, which is what tells two changes on one day apart. */
function atTime(when: string) {
  return new Date(when).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Why a change has nothing to show, which is three different facts and used to be one phrase.
 *
 * <p>"The first change written down" was printed under the heading "Money came out of" on every opening
 * change of every day — where it answered a question nobody had asked, and said nothing about the money.
 * Worse, it was usually untrue as a description of the change: the first thing written on a day is
 * normally the whole of what happened on it.
 */
function nothingSaid(change: DayChange, basis: Basis) {
  if (change.out.length > 0 || change.into.length > 0) return null;
  if (basis.kind === "nothing-before") return "The first holdings written down for this client";
  if (basis.kind === "no-lines-before") {
    return `${basis.on} was written before sub-asset figures were kept, so there is nothing to read this against`;
  }
  return "Nothing moved between the lines";
}

/**
 * The changes a day was made of, oldest first, and what each one moved by.
 *
 * <p>A day used to keep one figure, so five decisions taken in it were kept as the last of them. Each
 * writes its own now, and this is where they are read: what the portfolio stood at after each, and what
 * that change moved it by.
 *
 * <p>Each is measured against the change before it on the day, and the first against how the day before
 * on file ended — which is what the paragraph under this table has always told its readers. It was not
 * what the table did: the first change of every day was measured against nothing and came out blank, so
 * the opening move of a day was invisible and a day written once showed a page of dashes. The reading is
 * done in {@code changesIn}, once, and handed to this and to the figure above it alike.
 *
 * <p>The one the day ended on is marked, because that is the figure every other screen reads this day by.
 */
function Changes({ day, changes, currency, customerId, names }: {
  day: Day;
  /** Worked out above and handed down, so the figure at the top and this table cannot part. */
  changes: DayChange[];
  currency: string;
  customerId: string;
  /** What each class is called, so a line reads as a person says it rather than as a code. */
  names: Record<string, string>;
}) {
  return (
    <div className="px-6 py-4">
      {/* The heading is the section's, above. Said here too it was printed twice over. */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-4 whitespace-nowrap">Change</th>
            <th scope="col" className="px-4 py-2">Money came out of</th>
            <th scope="col" className="px-4 py-2">And went into</th>
            <th scope="col" className="py-2 pl-4 text-right whitespace-nowrap">Moved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {changes.map((change) => {
            const one = change.version;
            const quiet = nothingSaid(change, change.basis);
            // Each change is a row to press. The table below showed the one the day closed on and no
            // other, so a figure written at eleven and corrected at noon left nothing on screen but the
            // correction — the list said it had happened and there was nowhere to go and see it.
            const its = `/portfolio-clients/${customerId}/days/${day.on}/changes/${one.revision}`;
            return (
              <tr key={one.id} className="hover:bg-slate-50">
                <td className="py-2 pr-4 align-top whitespace-nowrap text-ink-muted">
                  {/* A link rather than a press that swaps the page beneath it: a change is a thing with
                      an address, so it can be sent to somebody, kept in a tab and come back to. */}
                  <Link
                    to={its}
                    className="font-semibold text-primary-700 underline-offset-2 hover:underline"
                  >
                    Change {one.revision}
                  </Link>
                  {/* The hour, because two corrections in one afternoon are told apart by nothing else. */}
                  <span className="ml-2 text-ink-muted">{atTime(one.recordedAt)}</span>
                  {one.closedTheDay && (
                    <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-2xs text-ink">
                      the day closed here
                    </span>
                  )}
                  {/* Which day the first change of a day was read against, said on the row that was read
                      against it. The day before on file can be a fortnight back, and a movement measured
                      over a fortnight is a different claim from one measured over a night. */}
                  {change.basis.kind === "day-before" && (
                    <span className="mt-0.5 block text-2xs text-ink-muted">
                      against {change.basis.on}
                    </span>
                  )}
                </td>
                {/* Out of on one side, into on the other, each line with what it lost or gained. Said
                    as one wrapping run of names it was a wall to read: a change taking money out of one
                    line and putting it into three ran the four names together with an arrow somewhere
                    in the middle, and which of them was which took working out.

                    Where there is nothing to show, the reason is said once across the pair rather than
                    twice down it — a sentence about the day is not an answer to "money came out of". */}
                {quiet !== null ? (
                  <td className="px-4 py-2 align-top text-ink-muted" colSpan={2}>{quiet}</td>
                ) : (
                  <>
                    <td className="px-4 py-2 align-top">
                      {change.out.length === 0 ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {change.out.map((shift) => (
                            <li key={`${shift.assetClass}-${shift.line}`}
                              className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 text-red-700">
                                {nameOf(shift.assetClass, names)} · {shift.line}
                              </span>
                              <span className="shrink-0 tabular-nums text-red-700">
                                −{money(Math.abs(shift.by))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {change.into.length === 0 ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {change.into.map((shift) => (
                            <li key={`${shift.assetClass}-${shift.line}`}
                              className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 text-emerald-700">
                                {nameOf(shift.assetClass, names)} · {shift.line}
                              </span>
                              <span className="shrink-0 tabular-nums text-emerald-700">
                                +{money(shift.by)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </>
                )}
                <td className="py-2 pl-4 text-right align-top whitespace-nowrap tabular-nums">
                  {change.shifted > 0.005 ? (
                    <span className="font-semibold text-ink">{money(change.shifted)}</span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-2xs text-ink-muted">
        Figures in {currency}. Each change says which lines it took money out of and which it put money
        into, against the change before it on this day — the first against the day before on file, which is
        named on the row. The number runs through this client's whole history, so it does not start at one
        on every day. Open one to read what every sub-asset held.
      </p>
    </div>
  );
}

function Inside({ on, lines, before, first, classes, beforeClasses, codes, names, currency }: {
  on: string;
  lines: Record<string, Record<string, number>>;
  before: Record<string, Record<string, number>>;
  /** Whether nothing was written before this change, so there is nothing to measure it against. */
  first: boolean;
  /** What each class held, which is kept on every day the platform has ever written. */
  classes: Record<string, number>;
  beforeClasses: Record<string, number>;
  codes: string[];
  names: Record<string, string>;
  currency: string;
}) {
  if (codes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-6 text-center text-sm text-ink-muted">
        Nothing was written down under any class on this day.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {codes.map((code) => {
        const now: Record<string, number> = lines[code] ?? {};
        const was: Record<string, number> = before[code] ?? {};
        // A day recorded by class alone, which is every day written before the platform kept the lines
        // inside a class. It has a figure for the class and nothing under it — which is a different thing
        // from a class holding nothing, and the page used to say the second about the first.
        const byClassOnly = Object.keys(now).length === 0;
        // Every line either side of the change, so one that has gone is still named rather than simply
        // absent — a line that disappears without a word reads as a line nobody wrote down.
        const every = [...new Set([...Object.keys(now), ...Object.keys(was)])].sort();
        return (
          <li key={code} className="overflow-hidden rounded-xl border border-ink/20 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3">
              <span className="font-semibold">{nameOf(code, names)}</span>
              <span className="flex items-center gap-3">
                {/* Said because the two can differ: the class total and the lines under it are written
                    from different readings of the client, so a card whose parts do not come to its
                    heading is telling the truth about both rather than hiding one of them. */}
                <span className="text-2xs tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  {byClassOnly ? "The class total" : "Its sub-assets, added up"}
                </span>
                <span className="tabular-nums font-semibold">
                  {currency} {money(byClassOnly
                    ? (classes[code] ?? 0)
                    : Object.values(now).reduce((sum: number, each) => sum + each, 0))}
                </span>
              </span>
            </div>
            {/* A day recorded by class alone has a figure and nothing under it. It used to show as a
                blank page saying the platform knew nothing about the day, with the very figure it was
                denying printed on the row that led here. Said plainly instead: what the class held, what
                it held before, and that the breakdown was not kept that day. */}
            {byClassOnly ? (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-1 px-5 py-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-2xs tracking-wider text-ink-muted uppercase">Before</dt>
                  <dd className="tabular-nums text-ink-muted">
                    {first || beforeClasses[code] === undefined ? "—" : money(beforeClasses[code])}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs tracking-wider text-ink-muted uppercase">Held</dt>
                  <dd className="font-medium tabular-nums">{money(classes[code] ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-2xs tracking-wider text-ink-muted uppercase">Moved</dt>
                  <dd className={cn("tabular-nums",
                    first || beforeClasses[code] === undefined ? "text-ink-muted"
                      : (classes[code] ?? 0) - beforeClasses[code] > 0 ? "text-emerald-700"
                        : (classes[code] ?? 0) - beforeClasses[code] < 0 ? "text-red-700"
                          : "text-ink-muted")}
                  >
                    {first || beforeClasses[code] === undefined
                      ? "—"
                      : (classes[code] ?? 0) - beforeClasses[code] === 0
                        ? "no change"
                        : `${(classes[code] ?? 0) - beforeClasses[code] > 0 ? "+" : "−"}`
                          + money(Math.abs((classes[code] ?? 0) - beforeClasses[code]))}
                  </dd>
                </div>
                <p className="col-span-full mt-1 text-2xs text-ink-muted">
                  What each sub-asset inside this class held was not kept on this day. Days written since
                  the platform started keeping it have the breakdown.
                </p>
              </dl>
            ) : (
            <div className="overflow-x-auto">
              {/* Laid out to fixed widths, the same in every card. Sized to their contents instead, each
                  class worked its columns out from its own longest name — so "FX Derivatives" and "Yield
                  Enhancement Strategies" pushed the three figure columns to different places, and the
                  headings over them stepped left and right down the page. The figures are the same kind of
                  figure in every card and belong under one line. */}
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">
                  What {nameOf(code, names)} held on {on}, in {currency}, beside the change before it.
                </caption>
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-ink/15 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th scope="col" className="py-3 pr-3 pl-5">Sub-asset</th>
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Before</th>
                    <th scope="col" className="px-5 py-3 text-right">Held</th>
                    <th scope="col" className="px-5 py-3 text-right">Moved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {every.map((line) => {
                    const held = now[line];
                    const before = was[line];
                    // Known only where the change before this one recorded its lines at all. It may not
                    // have: the platform kept class totals for a fortnight before it kept what was inside
                    // them, so a line's figure beforehand can be unrecorded rather than nought — and read
                    // as nought, every line on the first day that kept them was printed as money arriving
                    // that had in truth been sitting there all along.
                    const knownBefore = !first && Object.keys(was).length > 0;
                    const moved = (held ?? 0) - (before ?? 0);
                    return (
                      <tr key={line}>
                        <th scope="row" className={cn("py-3 pr-3 pl-5 text-left font-medium break-words",
                          held === undefined ? "text-ink-muted line-through" : "text-ink")}
                        >
                          {line}
                        </th>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-muted">
                          {!knownBefore ? "—" : before === undefined ? "not held" : money(before)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">
                          {held === undefined ? "gone" : money(held)}
                        </td>
                        <td className={cn("px-5 py-3 text-right tabular-nums",
                          !knownBefore ? "text-ink-muted"
                            : moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-700" : "text-ink-muted")}
                        >
                          {!knownBefore
                            ? "—"
                            : moved === 0
                              ? "no change"
                              : `${moved > 0 ? "+" : "−"}${money(Math.abs(moved))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
