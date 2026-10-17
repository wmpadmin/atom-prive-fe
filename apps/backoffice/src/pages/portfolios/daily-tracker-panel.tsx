import { ApiError } from "@atomprive/api-client";
import {
  useGetClientValuations,
  type ValuationHistory,
  type ValuationPoint,
} from "@atomprive/api-client/backoffice";
import { Alert, DateInput, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { nameOf, useAssetClasses } from "./asset-classes";

/** The window a date may be picked in: nothing is written before the firm existed, or after today. */
const TODAY = new Date();

const LONG_AGO = new Date(TODAY.getFullYear() - 20, 0, 1);

/**
 * A heading this table has no room for, written shorter.
 *
 * <p>One entry, and it earns it: "Cash & cash equivalents" is four times the width of the figures under
 * it, so its column takes the width of its heading and the right-aligned numbers in it end up stranded
 * across a gap that reads as a missing column. Nothing else the firm names is long enough to do that.
 *
 * <p>Here rather than in the firm's own list, because the firm's name for it is right everywhere it fits
 * — this is one table's problem with one word. The whole name is on hover.
 */
const SHORTER: Record<string, string> = { CASH: "Cash and Equivalents" };

/** A day on the line, with what changed between it and the day before. */
type Day = {
  on: string;
  worth: number;
  /** What it moved by since the day before; nothing on the first day, which has no day before it. */
  moved: number | null;
  /** That movement as a share of what it opened at; nothing where it opened at nothing. */
  movedShare: number | null;
  holdings: Record<string, number>;
  /** What each sub-asset was worth, by class. Empty for a day written before the platform kept it. */
  lines: Record<string, Record<string, number>>;
  /** The day before's lines, so a movement can be read without hunting back up the list. */
  linesBefore: Record<string, Record<string, number>>;
};

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * What the portfolio has been worth, day by day, and what moved between one day and the next.
 *
 * <p>A portfolio is worth something different every day, and the figure a client asks about is usually
 * not today's: it is what changed since yesterday, or since the day they paid something in. The screens
 * beside this one answer where the portfolio stands; this one answers how it got there.
 *
 * <p>A day is written when somebody writes the holdings down, because that is the only moment the platform
 * learns what anything is worth — no custodian feed delivers a price. So the line has gaps, and the gaps
 * are honest: a week with nothing on it is a week nobody wrote anything down, not a week nothing moved.
 */
export function DailyTrackerPanel({ customerId }: { customerId: string }) {
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId);
  const classes = useAssetClasses();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Which days have been opened up. Shut by default: the table is read a row at a time, and every row
  // opened at once is the wall this tab was split off the portfolio screen to avoid.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const points: ValuationPoint[] = history.data?.points ?? [];
  // Worked out before the dates are applied, so a day's movement is measured against the day that
  // actually came before it rather than against the first day somebody happened to filter to.
  const everyDay: Day[] = points.map((point, at) => {
    const before = at === 0 ? null : points[at - 1];
    const moved = before === null ? null : point.underManagement - before.underManagement;
    return {
      on: point.valuedOn,
      worth: point.underManagement,
      moved,
      movedShare: (moved === null || before === null || before.underManagement === 0)
        ? null : (moved / before.underManagement) * 100,
      holdings: point.holdings ?? {},
      lines: point.lines ?? {},
      linesBefore: before?.lines ?? {},
    };
  });
  const shown = everyDay
    .filter((day) => (from === "" || day.on >= from) && (to === "" || day.on <= to))
    .reverse();

  // Every class that appears on any day shown, in the firm's own order, so a column does not come and go
  // as the days are filtered.
  const codes = classes.inUse
    .map((one) => one.code)
    .filter((code) => shown.some((day) => (day.holdings[code] ?? 0) !== 0));

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Daily tracker</h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            What the portfolio was worth each day, and what moved since the day before. A day is written
            when somebody writes the holdings down, so a gap is a day nobody wrote anything — not a day
            nothing happened.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="tracker-from" className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            From
            <DateInput id="tracker-from" name="tracker-from" clearable min={LONG_AGO} max={TODAY}
              value={from} onChange={(said) => setFrom(said ?? "")} />
          </label>
          <label htmlFor="tracker-to" className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            To
            <DateInput id="tracker-to" name="tracker-to" clearable min={LONG_AGO} max={TODAY}
              value={to} onChange={(said) => setTo(said ?? "")} />
          </label>
          {(from !== "" || to !== "") && (
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(""); }}
              className="pb-2 text-xs font-semibold text-primary-700 hover:underline"
            >
              Every day
            </button>
          )}
        </div>
      </div>

      {history.isPending ? (
        <p className="py-8 text-center text-sm text-ink-muted">Reading the days…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-muted">
          {everyDay.length === 0
            ? "No day has been written down yet. One is written each time somebody saves the holdings."
            : "No day between those two dates."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">What this portfolio was worth each day, in {currency}.</caption>
            <thead>
              <tr className="border-b border-ink/15 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4">Day</th>
                <th scope="col" className="px-4 py-3 text-right">Net AUM</th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">Moved</th>
                {codes.map((code) => (
                  <th
                    key={code}
                    scope="col"
                    className="px-4 py-3 text-right whitespace-nowrap"
                    title={nameOf(code, classes.names)}
                  >
                    {SHORTER[code] ?? nameOf(code, classes.names)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((day) => {
                const inside = Object.keys(day.lines).length > 0;
                const open = inside && (opened[day.on] ?? false);
                return (
                <Fragment key={day.on}>
                <tr
                  className={cn(inside && "cursor-pointer hover:bg-slate-50/60")}
                  onClick={inside ? () => setOpened((was) => ({ ...was, [day.on]: !open })) : undefined}
                >
                  <th scope="row" className="py-3 pr-4 text-left font-medium whitespace-nowrap text-ink">
                    {/* Only where there is something behind it. A day written before the platform kept
                        its lines opens onto nothing, and a chevron that opens onto nothing is a promise
                        the row cannot keep. */}
                    {inside ? (
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpened((was) => ({ ...was, [day.on]: !open }));
                        }}
                        className="flex items-center gap-1.5 text-left font-medium text-ink hover:text-primary-700"
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
                        />
                        {day.on}
                      </button>
                    ) : (
                      <span className="pl-5">{day.on}</span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                    {money(day.worth)}
                  </td>
                  {/* The first day on the line has no day before it, which is not a movement of nought. */}
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {day.moved === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span className={cn("font-semibold",
                        day.moved > 0 ? "text-emerald-700" : day.moved < 0 ? "text-red-600" : "text-ink-muted")}>
                        {day.moved > 0 ? "+" : day.moved < 0 ? "−" : ""}{money(Math.abs(day.moved))}
                        {day.movedShare !== null && (
                          <span className="block text-2xs font-normal opacity-75">
                            {day.movedShare > 0 ? "+" : ""}{day.movedShare.toFixed(2)}%
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  {codes.map((code) => (
                    <td key={code} className="px-4 py-3 text-right tabular-nums text-ink-muted">
                      {(day.holdings[code] ?? 0) === 0 ? "—" : money(day.holdings[code] ?? 0)}
                    </td>
                  ))}
                </tr>
                {open && (
                  <tr>
                    <td colSpan={3 + codes.length} className="bg-slate-50/60 px-4 py-3">
                      <Inside day={day} codes={codes} names={classes.names} />
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Said once under the table rather than on every row of it. */}
      {shown.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">
          Figures in {currency}. What moved is the whole of the change, which includes anything paid in or
          taken out that day — it is not what the money earned.
        </p>
      )}
    </section>
  );
}

/**
 * What a day was made of, line by line, and what each line did since the day before.
 *
 * <p>The class totals on the row above say equities went from one figure to another; this says which
 * line inside it moved, which is the question that follows and the one the firm asked for — money goes
 * into one thing and out of another, and a class total hides exactly that.
 *
 * <p>A line the day before did not have is new rather than up from nought, and one that has gone is
 * said as gone. Both are movements; neither is a figure growing.
 */
function Inside({ day, codes, names }: {
  day: Day;
  codes: string[];
  names: Record<string, string>;
}) {
  const shown = codes.filter((code) => Object.keys(day.lines[code] ?? {}).length > 0);
  if (shown.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        This day was written before the platform kept what each line was worth, so there is nothing to
        open. Days written from now on have it.
      </p>
    );
  }
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((code) => {
        const now = day.lines[code] ?? {};
        const was = day.linesBefore[code] ?? {};
        // Every line either side of the day, so one that has gone is still named rather than simply
        // absent — a line that disappears without a word reads as a line nobody wrote down.
        const every = [...new Set([...Object.keys(now), ...Object.keys(was)])].sort();
        return (
          <div key={code}>
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              {nameOf(code, names)}
            </p>
            <ul className="mt-1.5 space-y-1">
              {every.map((line) => {
                const held = now[line];
                const before = was[line];
                const moved = (held ?? 0) - (before ?? 0);
                return (
                  <li key={line} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className={cn("min-w-0 flex-1 truncate",
                      held === undefined ? "text-ink-muted line-through" : "text-ink")}>
                      {line}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">
                      {held === undefined ? "gone" : money(held)}
                    </span>
                    <span className={cn("w-24 shrink-0 text-right tabular-nums",
                      moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-600" : "text-ink-muted")}>
                      {Object.keys(was).length === 0
                        ? "—"
                        : moved === 0
                          ? "no change"
                          : `${moved > 0 ? "+" : "−"}${money(Math.abs(moved))}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
