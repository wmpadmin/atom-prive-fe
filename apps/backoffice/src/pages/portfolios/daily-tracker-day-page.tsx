import { ApiError } from "@atomprive/api-client";
import {
  useAskToRestore,
  useGetClientValuations,
  useListClientRestores,
  type RestoreRow,
  type ValuationHistory,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { nameOf, useAssetClasses } from "./asset-classes";
import { daysFrom, money, type Day } from "./daily-tracker-days";

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
export function DailyTrackerDayPage() {
  const { customerId = "", on = "" } = useParams();
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId, { every: true });
  const classes = useAssetClasses();
  const user = useStaffUser();
  // Whoever may write a client's figures is who may ask for them to be put back. Answering is somebody
  // else's, which is the whole point, so the button here is only ever an asking.
  const mayAsk = hasAuthority(user, "SEND_PROPOSALS:CHANGE");
  const restores = useListClientRestores<RestoreRow[], ApiError>(customerId);
  const waiting = (restores.data ?? []).find((one) => one.status === "PENDING") ?? null;
  const askToRestore = useAskToRestore<ApiError>();
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const [failed, setFailed] = useState<string | null>(null);

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const day = daysFrom(history.data?.points ?? []).find((one) => one.on === on) ?? null;
  const codes = classes.inUse
    .map((one) => one.code)
    .filter((code) => day !== null && Object.keys(day.lines[code] ?? {}).length > 0);

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
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.625rem] font-bold">{on}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              What this client's portfolio was worth on this day, what it took to get there, and what each
              sub-asset held either side of it.
            </p>
          </div>
          {/* Asking for the figures to be put back, from the screen where they are being read. Nothing is
              written by pressing it: whoever looks after the client answers, exactly as they answer a
              money move, because this replaces every figure rather than two of them. */}
          {mayAsk && day !== null && (
            <Button
              variant="secondary"
              disabled={waiting !== null}
              onClick={() => {
                setFailed(null);
                setWhy("");
                setAsking(true);
              }}
            >
              <RotateCcw aria-hidden="true" />
              Ask to put the figures back
            </Button>
          )}
        </div>
        {waiting && (
          <div className="mt-3">
            <Alert tone="info">
              <p className="font-semibold">
                {waiting.raisedByName} has already asked to put this client back to {waiting.restoreTo}.
              </p>
              <p className="mt-1 text-sm">
                {waiting.why} · asked {formatDateTime(waiting.raisedAt)}
              </p>
              <p className="mt-1 text-sm">
                Nothing has changed. One ask waits at a time, so this one is answered or taken back first.
              </p>
            </Alert>
          </div>
        )}
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
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Net AUM</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{money(day.worth)}</p>
              </div>
              <div>
                <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  Moved since the day before
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums",
                  day.moved === null ? "text-ink-muted"
                    : day.moved > 0 ? "text-emerald-700"
                      : day.moved < 0 ? "text-danger-700" : "text-ink-muted")}
                >
                  {day.moved === null
                    ? "—"
                    : `${day.moved > 0 ? "+" : day.moved < 0 ? "−" : ""}${money(Math.abs(day.moved))}`}
                  {day.movedShare !== null && (
                    <span className="ml-2 text-sm font-normal">
                      {day.movedShare > 0 ? "+" : day.movedShare < 0 ? "−" : ""}
                      {Math.abs(day.movedShare).toFixed(2)}%
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Figures in {currency}. What moved is the whole of the change, which includes anything paid in
              or taken out that day — it is not what the money earned.
            </p>
          </section>

          {day.versions.length > 1 && (
            <section className="overflow-hidden rounded-2xl border border-line bg-white">
              <h2 className="border-b border-line px-6 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Written {day.versions.length} times on this day
              </h2>
              <div className="px-6 py-4">
                <Changes day={day} currency={currency} />
              </div>
            </section>
          )}

          <section>
            <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              What each sub-asset held
            </h2>
            <p className="mt-1 max-w-prose text-xs text-ink-muted">
              Asset class, then the sub-assets inside it, with what each held the day before beside what it
              held on this one. Figures in {currency}.
            </p>
            <div className="mt-3">
              <Inside day={day} codes={codes} names={classes.names} currency={currency} />
            </div>
          </section>
        </>
      )}

      {/* The reason is what whoever answers is being asked about. They can see the figures — both sets. */}
      <Dialog
        open={asking}
        title={`Put this client back to how they stood on ${on}?`}
        onClose={() => setAsking(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p>
              Every figure the client has would be written again as they stood at version{" "}
              {day?.versions.length ? closeRevisionOf(day) : "—"} on {on}
              {day && <> — {currency} {money(day.worth)} across {Object.values(day.lines)
                .reduce((sum, inClass) => sum + Object.keys(inClass).length, 0)} sub-assets</>}.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              This day is left exactly as it is. What it holds is written forward as a new version, so the
              trail keeps both what happened and that somebody put it back.
            </p>
          </div>
          {failed && <Alert tone="danger">{failed}</Alert>}
          <Field id="why-it-goes-back" label="Why it should go back" required>
            <TextArea
              id="why-it-goes-back"
              rows={3}
              value={why}
              onChange={(event) => setWhy(event.target.value)}
            />
          </Field>
          <p className="text-sm text-ink-muted">
            Nothing changes yet. This goes to whoever looks after the client.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button
              disabled={why.trim() === "" || askToRestore.isPending || day === null}
              onClick={() => {
                if (day === null) return;
                setFailed(null);
                void askToRestore
                  .mutateAsync({
                    customerId,
                    data: { revision: closeRevisionOf(day), why: why.trim() },
                  })
                  .then(() => {
                    setAsking(false);
                    return restores.refetch();
                  })
                  .catch((caught: ApiError) => {
                    setFailed(caught?.message ?? "That could not be asked for.");
                  });
              }}
            >
              {askToRestore.isPending ? "Asking…" : "Ask for it"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** The version the day ended on, which is the figure every other screen reads that day by. */
function closeRevisionOf(day: Day) {
  const close = day.versions.find((one) => one.closedTheDay) ?? day.versions[day.versions.length - 1];
  return close.revision;
}

/**
 * The changes a day was made of, oldest first, and what each one moved by.
 *
 * <p>A day used to keep one figure, so five decisions taken in it were kept as the last of them. Each
 * writes its own now, and this is where they are read: what the portfolio stood at after each, and what
 * that change moved it by — measured against the change before it, not against the day before.
 *
 * <p>The one the day ended on is marked, because that is the figure every other screen reads this day by.
 */
function Changes({ day, currency }: { day: Day; currency: string }) {
  return (
    <div>
      {/* The heading is the section's, above. Said here too it was printed twice over. */}
      <table className="w-full text-xs">
        <tbody className="divide-y divide-line/60">
          {day.versions.map((one, at) => {
            const before = at === 0 ? null : day.versions[at - 1];
            const moved = before === null ? null : one.underManagement - before.underManagement;
            return (
              <tr key={one.id}>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-muted">
                  Change {one.revision}
                  {one.closedTheDay && (
                    <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-2xs text-ink">
                      the day closed here
                    </span>
                  )}
                </td>
                <td className="px-4 py-1.5 text-right font-medium tabular-nums text-ink">
                  {money(one.underManagement)}
                </td>
                <td className="py-1.5 pl-4 text-right whitespace-nowrap tabular-nums">
                  {/* The first change of a day is measured against the day before, which the row above
                      already says. Said again here it would read as a second movement. */}
                  {moved === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <span className={cn("font-medium",
                      moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-600" : "text-ink-muted")}>
                      {moved > 0 ? "+" : moved < 0 ? "−" : ""}{money(Math.abs(moved))}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-2xs text-ink-muted">
        Figures in {currency}. Each is measured against the change before it on this day.
      </p>
    </div>
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
/**
 * What every sub-asset held on this day, beside what it held the day before.
 *
 * <p>A card for each class with a table inside it, which is how the holdings screen draws the same shape —
 * one screen's way of showing a client's classes and the lines under them, so a reader moving between them
 * is not learning a second layout for the same thing. Squeezed into one cell of the tracker it had been
 * drawn as a grid of lists with its own invented alignment; these are figures, and figures line up.
 */
function Inside({ day, codes, names, currency }: {
  day: Day;
  codes: string[];
  names: Record<string, string>;
  currency: string;
}) {
  const shown = codes.filter((code) => Object.keys(day.lines[code] ?? {}).length > 0);
  if (shown.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-6 text-center text-sm text-ink-muted">
        This day was written before the platform kept what each line was worth, so there is nothing to
        show. Days written from now on have it.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {shown.map((code) => {
        const now = day.lines[code] ?? {};
        const was = day.linesBefore[code] ?? {};
        // Every line either side of the day, so one that has gone is still named rather than simply
        // absent — a line that disappears without a word reads as a line nobody wrote down.
        const every = [...new Set([...Object.keys(now), ...Object.keys(was)])].sort();
        const first = Object.keys(day.linesBefore).length === 0;
        return (
          <li key={code} className="overflow-hidden rounded-xl border border-ink/20 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3">
              <span className="font-semibold">{nameOf(code, names)}</span>
              <span className="flex items-center gap-3">
                <span className="text-2xs tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  From its lines
                </span>
                <span className="tabular-nums font-semibold">
                  {currency} {money(day.holdings[code] ?? 0)}
                </span>
              </span>
            </div>
            <div className="overflow-x-auto">
              {/* Laid out to fixed widths, the same in every card. Sized to their contents instead, each
                  class worked its columns out from its own longest name — so "FX Derivatives" and "Yield
                  Enhancement Strategies" pushed the three figure columns to different places, and the
                  headings over them stepped left and right down the page. The figures are the same kind of
                  figure in every card and belong under one line. */}
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">
                  What {nameOf(code, names)} held on {day.on}, in {currency}, beside the day before.
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
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">The day before</th>
                    <th scope="col" className="px-5 py-3 text-right">Held</th>
                    <th scope="col" className="px-5 py-3 text-right">Moved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {every.map((line) => {
                    const held = now[line];
                    const before = was[line];
                    const moved = (held ?? 0) - (before ?? 0);
                    return (
                      <tr key={line}>
                        <th scope="row" className={cn("py-3 pr-3 pl-5 text-left font-medium break-words",
                          held === undefined ? "text-ink-muted line-through" : "text-ink")}
                        >
                          {line}
                        </th>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-muted">
                          {first ? "—" : before === undefined ? "not held" : money(before)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">
                          {held === undefined ? "gone" : money(held)}
                        </td>
                        <td className={cn("px-5 py-3 text-right tabular-nums",
                          moved > 0 ? "text-emerald-700" : moved < 0 ? "text-danger-700" : "text-ink-muted")}
                        >
                          {first
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
          </li>
        );
      })}
    </ul>
  );
}
