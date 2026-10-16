import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useGetClientValuations,
  type PortfolioStanding,
  type ValuationHistory,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { nameOf, useAssetClasses } from "./asset-classes";

/** How far back to draw. Days, because a portfolio is written down daily and read the same way. */
const RANGES = [
  { days: 3, label: "3 days" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Everything" },
];

function money(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * What the portfolio has done, drawn rather than listed.
 *
 * <p>Two questions, because they are asked together and answered from the same days. What has the book
 * been worth, and which classes have been outside their bands while it was? A table answers both and is
 * read a row at a time; a line and a set of bars answer both at a glance, which is what somebody wants
 * when they are asking whether anything is going wrong rather than exactly how much.
 *
 * <p>Drawn from the days on file, which are written when somebody writes the holdings down. The gaps are
 * real and are left as gaps: a line drawn straight through a fortnight nobody wrote anything in would be
 * the platform inventing a fortnight.
 */
export function AnalyticsPanel({ customerId }: { customerId: string }) {
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId);
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  const classes = useAssetClasses();
  const [days, setDays] = useState(0);

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }

  const currency = history.data?.currency ?? "";
  const every = history.data?.points ?? [];
  const points = days === 0 ? every : every.slice(-days);

  // The line's own scale, not nought to the top: a book that moved from 15.2m to 15.3m drawn against a
  // baseline of nothing is a flat line, and the whole point of drawing it is to see that it moved.
  const worths = points.map((point) => point.underManagement);
  const high = Math.max(...worths, 0);
  const low = Math.min(...worths, high);
  const span = high - low;
  const at = (worth: number) => (span === 0 ? 50 : 100 - ((worth - low) / span) * 100);

  const first = points[0]?.underManagement ?? 0;
  const last = points[points.length - 1]?.underManagement ?? 0;
  const moved = points.length < 2 ? null : last - first;

  const byClass = standing.data?.classes ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              What it has been worth
            </h2>
            <p className="mt-1 max-w-prose text-xs text-ink-muted">
              Every day on file, newest at the right. A day is written when somebody writes the holdings
              down, so the gaps are days nobody wrote anything.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setDays(range.days)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  days === range.days
                    ? "bg-primary-600 text-on-accent"
                    : "bg-slate-100 text-ink-soft hover:bg-slate-200",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {history.isPending ? (
          <p className="py-10 text-center text-sm text-ink-muted">Reading the days…</p>
        ) : points.length < 2 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink-muted">
            {every.length === 0
              ? "No day has been written down yet."
              : "One day on file. A line needs two."}
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-2xl font-bold tabular-nums text-ink">
                {money(last)} <span className="text-sm font-normal text-ink-muted">{currency}</span>
              </span>
              {moved !== null && (
                <span className={cn("text-sm font-semibold tabular-nums",
                  moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-600" : "text-ink-muted")}>
                  {moved > 0 ? "+" : moved < 0 ? "−" : ""}{money(Math.abs(moved))} {currency}
                  <span className="ml-1 font-normal text-ink-muted">
                    over {points.length} {points.length === 1 ? "day" : "days"} on file
                  </span>
                </span>
              )}
            </div>
            {/* Hand-drawn rather than a charting library: one line and a dot per day is less code than
                the configuration a library would need, and it carries the theme's own ink. */}
            <figure className="mt-4">
              <svg
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                role="img"
                aria-label={`What the portfolio was worth on each of ${points.length} days, in ${currency}`}
                className="h-44 w-full"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  className="text-primary-600"
                  points={points.map((point, i) =>
                    `${(i / Math.max(points.length - 1, 1)) * 100},${(at(point.underManagement) / 100) * 40}`,
                  ).join(" ")}
                />
                {points.map((point, i) => (
                  <circle
                    key={point.valuedOn}
                    cx={(i / Math.max(points.length - 1, 1)) * 100}
                    cy={(at(point.underManagement) / 100) * 40}
                    r="0.7"
                    className="fill-primary-700"
                  >
                    <title>{point.valuedOn}: {money(point.underManagement)} {currency}</title>
                  </circle>
                ))}
              </svg>
              <figcaption className="mt-1 flex justify-between text-2xs text-ink-muted">
                <span>{points[0]?.valuedOn}</span>
                <span className="tabular-nums">
                  {money(low)} – {money(high)} {currency}
                </span>
                <span>{points[points.length - 1]?.valuedOn}</span>
              </figcaption>
            </figure>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          How far each class is from its band
        </h2>
        <p className="mt-1 max-w-prose text-xs text-ink-muted">
          Where each class stands today against what the model asks of it. The bar is how far it has
          wandered; the mark is where its band ends.
        </p>
        {byClass.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-muted">
            Nothing to measure until this client is on a plan.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {byClass.map((row) => {
              const band = row.band?.breachAt ?? 0;
              const drift = row.drift ?? 0;
              // Both the bar and the mark are drawn against the same scale, so a class that has gone
              // twice its band looks twice as far out as one that has just reached it.
              const scale = Math.max(Math.abs(drift), band, 1) * 1.15;
              return (
                <li key={row.assetClass}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">
                      {row.assetClassName || nameOf(row.assetClass, classes.names)}
                    </span>
                    <span className={cn("tabular-nums",
                      Math.abs(drift) > band ? "font-semibold text-red-600" : "text-ink-muted")}>
                      {drift > 0 ? "+" : drift < 0 ? "−" : ""}{Math.abs(drift).toFixed(1)}pp
                      <span className="ml-1 text-2xs font-normal text-ink-muted">of ±{band}</span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={cn("absolute inset-y-0 rounded-full",
                        Math.abs(drift) > band ? "bg-red-500" : "bg-emerald-500")}
                      style={drift >= 0
                        ? { left: "50%", width: `${(Math.abs(drift) / scale) * 50}%` }
                        : { right: "50%", width: `${(Math.abs(drift) / scale) * 50}%` }}
                    />
                    {/* Where the band ends, on both sides, so the bar can be read against it. */}
                    {[-1, 1].map((side) => (
                      <span
                        key={side}
                        aria-hidden="true"
                        className="absolute inset-y-[-2px] w-px bg-ink/40"
                        style={{ left: `${50 + side * (band / scale) * 50}%` }}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {/* The one thing this cannot draw, said rather than left to be discovered. */}
        <p className="mt-4 text-xs text-ink-muted">
          Sub-assets are not drawn here. A day on file keeps what each asset class was worth, not what each
          line inside it was, so there is no history to draw one from — only today&apos;s figure, which is
          under Portfolio performance.
        </p>
      </section>
    </div>
  );
}
