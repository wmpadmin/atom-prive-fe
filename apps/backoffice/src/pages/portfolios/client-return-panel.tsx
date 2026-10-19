import { ApiError } from "@atomprive/api-client";
import {
  useListClientReturns,
  type ReturnOverPeriod,
  type ReturnsByPeriod,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { ClientCashflowsPanel } from "./client-cashflows-panel";
import { exactly } from "./money-words";

/**
 * The four figures, in the order a portfolio manager asks for them.
 *
 * <p>What it made in money first, because it is the only one of the four that is a fact rather than a
 * reading of one — the three rates under it are all that same gain divided by something, and a reader
 * who disagrees with a rate can only check it against this.
 *
 * <p>Then what the client's money earned, because that is the client's own question and the one they ask
 * on the phone. Then what the plan did, which is the firm's question and the figure a benchmark can be
 * set beside. CAGR last: it is the simplest to say and the easiest to mislead with, since it takes no
 * account of money moving at all.
 */
type Figure = {
  id: "gained" | "moneyWeighted" | "timeWeighted" | "cagr";
  label: string;
  /** The one that is a fact rather than a reading of one, set larger because everything else leans on it. */
  lead?: boolean;
  /** What the rest of the industry calls it, where that is not what this screen calls it. */
  tag?: string;
  /**
   * Whether this one is a rate per year rather than a figure for the window.
   *
   * <p>Two of the four are, and two are not. What it made and what the plan did are what happened over
   * the window itself; the other two answer "at what yearly rate", which is a different question and
   * only has an answer over a year. Said per figure because the row that carried it for all of them
   * labelled the plan's own period return as a yearly rate, which it has never been.
   */
  perYear?: boolean;
  said: string;
};

const FIGURES: Figure[] = [
  {
    id: "gained",
    label: "What it made",
    lead: true,
    said: "What the portfolio is worth now, less what it was worth then, less everything paid in and plus "
      + "everything taken out. The plain fact the three rates below are all readings of.",
  },
  {
    id: "moneyWeighted",
    label: "What the client's money earned",
    tag: "XIRR",
    perYear: true,
    said: "The yearly rate at which every rupee, counted from the day it arrived, comes to what is there "
      + "now. Money that arrived late earned only what happened after it arrived, and this is the only "
      + "figure here that knows that.",
  },
  {
    id: "timeWeighted",
    label: "What the plan did",
    tag: "Time-weighted",
    said: "The same period with money in and out taken back out of the answer, so it says what the plan "
      + "did with whatever it was given. This is the one to set beside a benchmark.",
  },
  {
    id: "cagr",
    label: "Smoothed yearly rate",
    tag: "CAGR",
    perYear: true,
    said: "The rate the opening figure would have to grow at, every year, to reach the closing one. It "
      + "takes no account of money moving, so where any did it describes the figures rather than the "
      + "earning.",
  },
];

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/**
 * What a client's portfolio has earned, over the window somebody asks for.
 *
 * <p>Every window comes down in one answer, so switching between them is instant and two windows cannot
 * disagree about the same day.
 *
 * <p>The money in and out sits on this screen rather than somewhere else, because it is what the figures
 * above it are made of. A return works by taking those movements back out of the answer and can only
 * take out what somebody wrote down — so the list is not a reference table here, it is the working.
 */
export function ClientReturnPanel({ customerId }: { customerId: string }) {
  const read = useListClientReturns<ReturnsByPeriod, ApiError>(customerId);
  const [at, setAt] = useState(5);

  if (read.isError) {
    return <Alert tone="danger">{read.error.message}</Alert>;
  }
  const periods: ReturnOverPeriod[] = read.data?.periods ?? [];
  const currency = read.data?.currency ?? "";
  const shown = periods[at] ?? periods[periods.length - 1] ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Return</h2>
          {/* Every window the firm reads, in the order they are asked for. The one that cannot be
              measured is still drawn: a window missing from the row reads as a window nobody thought of
              rather than one this client is not old enough for. */}
          <div role="tablist" aria-label="How far back" className="ml-auto flex flex-wrap gap-1">
            {periods.map((one, which) => (
              <button
                key={one.period}
                type="button"
                role="tab"
                aria-selected={which === at}
                disabled={!one.measured}
                onClick={() => setAt(which)}
                className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  which === at ? "bg-primary-600 text-white"
                    : one.measured ? "text-ink-muted hover:text-ink" : "text-ink-muted/40")}
                title={one.measured ? undefined : (one.whyNot ?? undefined)}
              >
                {one.said}
              </button>
            ))}
          </div>
        </div>

        {read.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading what it has earned…</p>
        ) : shown === null ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            Nothing to measure yet. A return needs two days of figures to measure between.
          </p>
        ) : !shown.measured ? (
          <p className="px-5 py-8 text-sm text-ink-muted">{shown.whyNot}</p>
        ) : (
          <>
            <div className="divide-y divide-line">
              {FIGURES.map((figure) => {
                const value = figure.id === "gained" ? shown.gained
                  : figure.id === "moneyWeighted" ? shown.moneyWeighted
                    : figure.id === "timeWeighted" ? shown.timeWeighted : shown.cagr;
                const said = figure.id === "gained"
                  ? (value === null || value === undefined ? null
                    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${exactly(Math.abs(value), currency)}`)
                  : percent(value);
                return (
                  <div key={figure.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-4">
                    <div className="min-w-56 flex-1">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className={cn("font-semibold text-ink", figure.lead && "text-base")}>
                          {figure.label}
                        </span>
                        {figure.tag !== undefined && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-ink-soft">
                            {figure.tag}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 max-w-prose text-xs text-ink-muted">{figure.said}</p>
                    </div>
                    <p className={cn("shrink-0 text-right tabular-nums",
                      figure.lead ? "text-2xl font-bold" : "text-lg font-semibold",
                      said === null ? "text-ink-muted"
                        : (value ?? 0) < 0 ? "text-red-700" : "text-ink")}
                    >
                      {said ?? "—"}
                      {/* Said once per rate rather than once on the screen: a reader scanning the column
                          takes each figure on its own. */}
                      {figure.id === "gained" && (
                        <span className="mt-0.5 block text-2xs font-normal text-ink-muted">
                          on {exactly(shown.opening ?? 0, currency)} and {exactly(shown.paidIn, currency)} put in
                        </span>
                      )}
                      {figure.id === "gained" && shown.absolute !== null && (
                        <span className="mt-0.5 block text-xs font-semibold text-ink-soft">
                          {percent(shown.absolute)} absolute
                        </span>
                      )}
                      {/* Why it is not there, rather than a bare dash beside three figures that are.
                          A yearly rate over six days raises the whole window to the power of sixty: it
                          comes out exact and unusable, and the two figures above it already say what
                          happened over those days. */}
                      {figure.perYear && said === null && !shown.ayearOrMore && (
                        <span className="mt-0.5 block max-w-48 text-2xs font-normal text-amber-700">
                          Not over {shown.days} days — a rate per year needs a year of it. The two figures
                          above are this window's own.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line px-5 py-3 text-xs text-ink-muted">
              {/* Said in words, not left to be worked out of two dates. A client six days old reads "a
                  week" on a button and six days in the line under it, and the two have to agree out
                  loud or the button is quietly lying. */}
              {shown.shortened && (
                <p className="mb-1.5 font-medium text-ink-soft">
                  This client's figures only go back to {shown.from}, so {shown.said.toLowerCase()} is
                  the {shown.days} days there are.
                </p>
              )}
              <p>
                {shown.from} to {shown.to}, {shown.days} days. Opened at{" "}
                {exactly(shown.opening ?? 0, currency)}, closed at {exactly(shown.closing ?? 0, currency)}.
                {" "}Figures are the asset classes added up, which is what a day keeps — a day holds no
                loan and nothing owned outright, so there is no past Net AUM to read.
              </p>
              {shown.flows === 0 ? (
                <p className="mt-1.5 font-medium text-amber-700">
                  No money in or out is written down over this window, so the whole of the change is being
                  read as something the money earned. If any of it was paid in, write it down below and
                  every figure above will drop to what was actually earned.
                </p>
              ) : (
                <p className="mt-1.5">
                  {shown.flows === 1 ? "One movement" : `${shown.flows} movements`} of money in or out are
                  written down over this window: {exactly(shown.paidIn, currency)} in and{" "}
                  {exactly(shown.takenOut, currency)} out, taken back out of every rate above except CAGR.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <ClientCashflowsPanel customerId={customerId} currency={currency} />
    </div>
  );
}
