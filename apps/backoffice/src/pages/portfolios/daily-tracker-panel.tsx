import { ApiError } from "@atomprive/api-client";
import {
  useGetClientValuations,
  type ValuationHistory,
  type ValuationPoint,
} from "@atomprive/api-client/backoffice";
import { Alert, DateInput, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { nameOf, useAssetClasses } from "./asset-classes";
import { daysFrom, money } from "./daily-tracker-days";

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
  // Every change, not a figure a day — this is the one screen that is about what happened rather than
  // about what it came to. Everything else that draws history takes the day's close, because a movement
  // worked out between two figures of the same day is not a movement.
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId, { every: true });
  const classes = useAssetClasses();
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const points: ValuationPoint[] = history.data?.points ?? [];
  // Worked out before the dates are applied, so a day's movement is measured against the day that
  // actually came before it rather than against the first day somebody happened to filter to.
  //
  // Gathered back into days first. The row is still a day, and what it says it moved is still what it
  // moved since the day before — measured close against close, never against a figure from the middle
  // of a day, which is not where either day stood.
  const everyDay = daysFrom(points);
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
            What the portfolio was worth each day, and what moved since the day before. Every change
            writes its own record; a day shows the one it ended on and opens onto the list of them. A day is
            written when somebody writes the holdings down, so a gap is a day nobody wrote anything —
            not a day nothing happened.
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
                const its = `/portfolio-clients/${customerId}/days/${day.on}`;
                return (
                // The whole row, not the date in it. The date alone is where a reader's eye is, but it is
                // not where their hand goes: a row of figures invites a press anywhere along it, and a
                // press that lands on a number selected the number and did nothing else.
                //
                // Every day, including one written before the platform kept what each line was worth. A
                // drawer opening onto nothing is a promise the row cannot keep; a page is a place that
                // can say so, and it still has what the day was worth and what it moved by.
                <tr
                  key={day.on}
                  className="cursor-pointer hover:bg-slate-50/60"
                  onClick={() => {
                    // Not while somebody is reading a figure out of it. Dragging across a number ends in
                    // a click, and a table that navigates away mid-selection cannot be copied from.
                    if ((window.getSelection()?.toString() ?? "") !== "") return;
                    void navigate(its);
                  }}
                >
                  <th scope="row" className="py-3 pr-4 text-left font-medium whitespace-nowrap text-ink">
                    {/* A real link inside it as well, so the day can be opened in its own tab and reached
                        by keyboard — which a row that only listens for a click cannot be. */}
                    <Link
                      to={its}
                      className="flex items-center gap-1.5 font-medium text-ink hover:text-primary-700"
                    >
                      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
                      {day.on}
                    </Link>
                    {/* How many changes the day holds, said on the row rather than found by opening it.
                        A day written five times and a day written once looked identical here, and the
                        figures on this row are only ever the last of them. */}
                    {day.versions.length > 1 && (
                      <span className="mt-0.5 block pl-5 text-2xs font-normal text-ink-muted">
                        {day.versions.length} changes
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink">
                    {money(day.worth)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {day.moved === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span className={cn("font-semibold",
                        day.moved > 0 ? "text-emerald-700" : day.moved < 0 ? "text-danger-700" : "text-ink-muted")}
                      >
                        {day.moved > 0 ? "+" : day.moved < 0 ? "−" : ""}{money(Math.abs(day.moved))}
                        {day.movedShare !== null && (
                          <span className="block text-2xs font-normal">
                            {day.movedShare > 0 ? "+" : day.movedShare < 0 ? "−" : ""}
                            {Math.abs(day.movedShare).toFixed(2)}%
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
