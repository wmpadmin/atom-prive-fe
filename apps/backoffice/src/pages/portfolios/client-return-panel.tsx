import { ApiError } from "@atomprive/api-client";
import {
  useListClientReturns,
  type ReturnOverPeriod,
  type ReturnsByPeriod,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { ClientCashflowsPanel } from "./client-cashflows-panel";
import { ClientJoinedPanel } from "./client-joined-panel";
import { exactly } from "./money-words";

/**
 * The four rows, in the order a portfolio manager asks for them.
 *
 * <p>What it made in money first, because it is the only one of the four that is a fact rather than a
 * reading of one — the three rates under it are all that same gain divided by something, and a reader who
 * disagrees with a rate can check it against nothing else.
 *
 * <p>Then what the client's money earned, which is the question asked on the telephone. Then what the
 * plan did, which is the firm's question. The growth rate last: it
 * is the simplest to say and the easiest to mislead with, since it takes no account of money moving.
 */
const ROWS = [
  { id: "gained", metric: "Gained", money: true },
  { id: "absolute", metric: "Absolute" },
  { id: "moneyWeighted", metric: "XIRR" },
  { id: "timeWeighted", metric: "Time-weighted" },
  { id: "cagr", metric: "CAGR" },
] as const;

function said(value: number | null | undefined, money: boolean, currency: string) {
  if (value === null || value === undefined) return null;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return money ? `${sign}${exactly(Math.abs(value), currency)}` : `${sign}${Math.abs(value).toFixed(2)}%`;
}

/**
 * What a client's portfolio has earned, over the window somebody asks for.
 *
 * <p>A table rather than a stack of cards: five figures, each with the sum it was worked out by. The
 * formula is a column rather than a footnote because two of them change with the length of the window —
 * over a year a rate is raised to a year's power and under one it is not — so a screen that stated one
 * formula for both would be describing the figure it was not showing.
 *
 * <p>Every window comes down in one answer, so switching between them is instant and two windows cannot
 * disagree about the same day.
 *
 * <p>The money in and out sits under it, because it is what the table is made of. A return works by
 * taking those movements back out of the answer and can only take out what somebody wrote down — so the
 * list is not a reference table here, it is the working.
 */
export function ClientReturnPanel({ customerId }: { customerId: string }) {
  const read = useListClientReturns<ReturnsByPeriod, ApiError>(customerId);
  const [at, setAt] = useState(5);
  // Above the refusal below, because taking the page is a hook: one skipped on the way out of an early
  // return is a hook React counts as missing on the render after it. Copied out of the frozen list rather
  // than handed over as it stands, since what the page is taken over is an ordinary array of rows.
  const paged = usePagedRows([...ROWS]);

  if (read.isError) {
    return <Alert tone="danger">{read.error.message}</Alert>;
  }
  const periods: ReturnOverPeriod[] = read.data?.periods ?? [];
  const currency = read.data?.currency ?? "";
  const shown = periods[at] ?? periods[periods.length - 1] ?? null;

  return (
    <div className="space-y-5">
      {/* Above the windows rather than beside them: it is the floor under every figure on this tab, the
          day the firm's own record of this client starts, and the earliest a window could ever open. */}
      <ClientJoinedPanel customerId={customerId} />

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Return</h2>
          {/* Every window the firm reads, in the order they are asked for. */}
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">
                  What this client's portfolio earned from {shown.from} to {shown.to}, read five ways.
                </caption>
                <thead>
                  <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th scope="col" className="px-5 py-3 whitespace-nowrap">Finance metric</th>
                    <th scope="col" className="px-5 py-3">Formula used</th>
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paged.shown.map((row) => {
                    const value = row.id === "gained" ? shown.gained
                      : row.id === "absolute" ? shown.absolute
                        : row.id === "moneyWeighted" ? shown.moneyWeighted
                          : row.id === "timeWeighted" ? shown.timeWeighted : shown.cagr;
                    const money = "money" in row && row.money === true;
                    const printed = said(value, money, currency);
                    return (
                      <tr key={row.id}>
                        <th scope="row" className="px-5 py-3 text-left font-semibold whitespace-nowrap text-ink">
                          {row.metric}
                        </th>
                        {/* The sum it was worked out by, in the same words whoever checks it would use. */}
                        <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                          {shown.formulae[row.id]}
                        </td>
                        <td className={cn("px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap",
                          printed === null ? "text-ink-muted" : (value ?? 0) < 0 ? "text-red-700" : "text-ink")}
                        >
                          {printed ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Outside the strip the table scrolls in and above the working, which belongs to the window
                rather than to the page of rows. */}
            <PagedFooter paged={paged} noun={["metric", "metrics"]} />

            <div className="border-t border-line px-5 py-3 text-xs text-ink-muted">
              {/* Said in words, not left to be worked out of two dates: a client six days old reads "a
                  week" on a button, and the two have to agree out loud. */}
              {shown.shortened && (
                <p className="mb-1.5 font-medium text-ink-soft">
                  This client's figures only go back to {shown.from}, so {shown.said.toLowerCase()} is the
                  {" "}{shown.days} days there are.
                </p>
              )}
              <p>
                {shown.from} to {shown.to}, {shown.days} days. Opened at{" "}
                {exactly(shown.opening ?? 0, currency)}, closed at {exactly(shown.closing ?? 0, currency)}.
                {" "}Figures are the asset classes added up, which is what a day keeps — a day holds no
                loan and nothing owned outright, so there is no past Net AUM to read.
              </p>
              {/* Under a year the two rates are the window's own rather than per year, which is the only
                  honest reading: annualising six days raises the whole period to the power of sixty. */}
              {!shown.ayearOrMore && (
                <p className="mt-1.5">
                  XIRR and CAGR are over these {shown.days} days rather than per year. A yearly rate needs
                  a year of it, and annualising a short window runs to figures nobody can act on.
                </p>
              )}
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
                  {exactly(shown.takenOut, currency)} out, taken back out of every figure above except CAGR.
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
