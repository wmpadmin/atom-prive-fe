import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useGetClientValuations,
  type PortfolioStanding,
  type ValuationHistory,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useState } from "react";
import { inkFor, nameOf, useAssetClasses } from "./asset-classes";

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

/** A figure short enough for an axis: 1.2M rather than 1,200,000, which no axis has room for. */
function brief(amount: number) {
  const size = Math.abs(amount);
  if (size >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return String(Math.round(amount));
}

/** The day without its year, which an axis has room for and a reader does not need twice. */
function shortly(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/**
 * What the portfolio has done, drawn.
 *
 * <p>Four questions, four shapes, because they are not the same question. What has the book been worth —
 * a line, because that is a thing over time. What is it made of today, against what it should be made of
 * — two rings side by side, because that is a whole divided up and the comparison is the point. How has
 * that mix moved — a stack a day, because the question is about proportions changing rather than any one
 * figure. And how far is each class outside its band — a bar from the middle, because the sign matters as
 * much as the size.
 *
 * <p>Every one of them is drawn from the days on file, which are written when somebody writes the holdings
 * down. The gaps are real and left as gaps: a line drawn straight through a fortnight nobody wrote
 * anything in would be the platform inventing a fortnight.
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
  const byClass = standing.data?.classes ?? [];
  const order = classes.inUse;

  return (
    <div className="space-y-4">
      <WorthOverTime
        points={points}
        everyCount={every.length}
        currency={currency}
        pending={history.isPending}
        days={days}
        setDays={setDays}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <MadeOf byClass={byClass} order={order} names={classes.names} currency={currency} />
        <HowTheMixMoved points={points} order={order} names={classes.names} />
      </div>

      <AgainstTheBand byClass={byClass} names={classes.names} />
    </div>
  );
}

/** What the book has been worth, as a line with the ground under it filled in. */
function WorthOverTime({ points, everyCount, currency, pending, days, setDays }: {
  points: ValuationHistory["points"];
  everyCount: number;
  currency: string;
  pending: boolean;
  days: number;
  setDays: (days: number) => void;
}) {
  const worths = points.map((point) => point.underManagement);
  const high = Math.max(...worths, 0);
  const low = Math.min(...worths, high);
  // Drawn on its own scale with a tenth of the range as air above and below, not from nought: a book
  // that moved from 15.2m to 15.3m against a baseline of nothing is a flat line, and seeing that it
  // moved is the whole reason for drawing it.
  const pad = (high - low) * 0.12 || Math.max(high * 0.02, 1);
  const top = high + pad;
  const foot = Math.max(low - pad, 0);
  const span = top - foot || 1;
  const x = (at: number) => (at / Math.max(points.length - 1, 1)) * 100;
  const y = (worth: number) => 40 - ((worth - foot) / span) * 40;

  const first = points[0]?.underManagement ?? 0;
  const last = points[points.length - 1]?.underManagement ?? 0;
  const moved = points.length < 2 ? null : last - first;
  const movedShare = (moved === null || first === 0) ? null : (moved / first) * 100;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What it has been worth
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-bold tabular-nums text-ink">
              {money(last)} <span className="text-base font-normal text-ink-muted">{currency}</span>
            </span>
            {moved !== null && (
              <span className={cn("text-sm font-semibold tabular-nums",
                moved > 0 ? "text-emerald-700" : moved < 0 ? "text-red-600" : "text-ink-muted")}>
                {moved > 0 ? "▲" : moved < 0 ? "▼" : ""} {money(Math.abs(moved))}
                {movedShare !== null && ` (${movedShare > 0 ? "+" : ""}${movedShare.toFixed(1)}%)`}
                <span className="ml-1 font-normal text-ink-muted">
                  over {points.length} {points.length === 1 ? "day" : "days"}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                days === range.days
                  ? "bg-primary-600 text-on-accent"
                  : "bg-slate-100 text-ink-soft hover:bg-slate-200")}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {pending ? (
        <p className="py-16 text-center text-sm text-ink-muted">Reading the days…</p>
      ) : points.length < 2 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-16 text-center text-sm text-ink-muted">
          {everyCount === 0 ? "No day has been written down yet." : "One day on file. A line needs two."}
        </p>
      ) : (
        <figure className="mt-5 flex gap-3">
          {/* The scale beside the drawing rather than inside it, so the line never runs under a number. */}
          <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right text-2xs tabular-nums text-ink-muted">
            <span>{brief(top)}</span>
            <span>{brief((top + foot) / 2)}</span>
            <span>{brief(foot)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <svg
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              role="img"
              aria-label={`What the portfolio was worth on each of ${points.length} days, in ${currency}`}
              className="h-52 w-full overflow-visible"
            >
              <defs>
                <linearGradient id="worth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Three lines to read against, and no more: a grid is for finding a height, not decoration. */}
              {[0, 20, 40].map((line) => (
                <line key={line} x1="0" y1={line} x2="100" y2={line}
                  stroke="currentColor" strokeWidth="0.15" className="text-ink/15" />
              ))}
              <polygon
                fill="url(#worth-fill)"
                points={`0,40 ${points.map((p, i) => `${x(i)},${y(p.underManagement)}`).join(" ")} 100,40`}
              />
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="0.7"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={points.map((p, i) => `${x(i)},${y(p.underManagement)}`).join(" ")}
              />
              {points.map((point, i) => (
                <circle key={point.valuedOn} cx={x(i)} cy={y(point.underManagement)} r="0.8" fill="#1d4ed8">
                  <title>{point.valuedOn}: {money(point.underManagement)} {currency}</title>
                </circle>
              ))}
            </svg>
            <div className="mt-1 flex justify-between text-2xs text-ink-muted">
              {points.length <= 8
                ? points.map((point) => <span key={point.valuedOn}>{shortly(point.valuedOn)}</span>)
                : (<><span>{shortly(points[0].valuedOn)}</span>
                  <span>{shortly(points[points.length - 1].valuedOn)}</span></>)}
            </div>
          </div>
        </figure>
      )}
    </section>
  );
}

/** What the book is made of today, against what the plan asks it to be made of. */
function MadeOf({ byClass, order, names, currency }: {
  byClass: PortfolioStanding["classes"];
  order: { code: string }[];
  names: Record<string, string>;
  currency: string;
}) {
  const held = byClass.filter((row) => row.actualValue > 0);
  const whole = held.reduce((sum, row) => sum + row.actualValue, 0);

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        What it is made of
      </h2>
      <p className="mt-1 text-xs text-ink-muted">Today, against what the plan asks for.</p>

      {whole === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-muted">
          Nothing is written down yet.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-8">
            <Ring
              title="Held"
              slices={held.map((row) => ({
                code: row.assetClass,
                share: (row.actualValue / whole) * 100,
                ink: inkFor(row.assetClass, order),
              }))}
              middle={brief(whole)}
              under={currency}
            />
            <Ring
              title="Asked for"
              slices={byClass.filter((row) => row.targetShare > 0).map((row) => ({
                code: row.assetClass,
                share: row.targetShare,
                ink: inkFor(row.assetClass, order),
              }))}
              middle="100"
              under="%"
            />
          </div>

          {/* Named beside the figure, because a ring read by colour alone is a ring nobody can read. */}
          <ul className="mt-5 space-y-1.5">
            {byClass
              .filter((row) => row.actualValue > 0 || row.targetShare > 0)
              .map((row) => {
                const actual = whole === 0 ? 0 : (row.actualValue / whole) * 100;
                return (
                  <li key={row.assetClass} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: inkFor(row.assetClass, order) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {row.assetClassName || nameOf(row.assetClass, names)}
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink">
                      {actual.toFixed(1)}%
                    </span>
                    <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-ink-muted">
                      of {row.targetShare.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </section>
  );
}

/** One ring. Slices are drawn as a dashed circle, which needs no arc arithmetic and never rounds wrong. */
function Ring({ title, slices, middle, under }: {
  title: string;
  slices: { code: string; share: number; ink: string }[];
  middle: string;
  under: string;
}) {
  const R = 15.9155;
  const circumference = 100;
  // Where each slice starts, worked out up front rather than carried along as the list is drawn: a
  // running total mutated inside a map is a total that is wrong the second time React draws it.
  const starts = slices.reduce<number[]>((walked, slice) =>
    [...walked, (walked[walked.length - 1] ?? 0) + slice.share], [0]);
  return (
    <figure className="text-center">
      <svg viewBox="0 0 42 42" className="size-36" role="img" aria-label={`${title}, by asset class`}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="currentColor" strokeWidth="5"
          className="text-slate-100" />
        {slices.map((slice, at) => {
          const dash = `${slice.share} ${circumference - slice.share}`;
          const offset = circumference / 4 - starts[at];
          return (
            <circle
              key={slice.code}
              cx="21" cy="21" r={R}
              fill="none"
              stroke={slice.ink}
              strokeWidth="5"
              strokeDasharray={dash}
              strokeDashoffset={offset}
            />
          );
        })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-ink text-[5px] font-bold">{middle}</text>
        <text x="21" y="25" textAnchor="middle" className="fill-ink-muted text-[3px]">{under}</text>
      </svg>
      <figcaption className="mt-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        {title}
      </figcaption>
    </figure>
  );
}

/** How the proportions moved, a stack a day. */
function HowTheMixMoved({ points, order, names }: {
  points: ValuationHistory["points"];
  order: { code: string }[];
  names: Record<string, string>;
}) {
  const codes = order
    .map((one) => one.code)
    .filter((code) => points.some((point) => (point.holdings?.[code] ?? 0) > 0));

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        How the mix moved
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Each day as a whole, divided up. A stack that changes shape is money moving between classes.
      </p>

      {points.length === 0 || codes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-12 text-center text-sm text-ink-muted">
          No day has been written down yet.
        </p>
      ) : (
        <>
          <div className="mt-5 flex h-40 items-end gap-1.5">
            {points.map((point) => {
              const whole = codes.reduce((sum, code) => sum + (point.holdings?.[code] ?? 0), 0) || 1;
              return (
                <div key={point.valuedOn} className="flex min-w-0 flex-1 flex-col justify-end">
                  <div className="flex h-36 flex-col-reverse overflow-hidden rounded-md">
                    {codes.map((code) => {
                      const share = ((point.holdings?.[code] ?? 0) / whole) * 100;
                      if (share <= 0) return null;
                      return (
                        <div
                          key={code}
                          style={{ height: `${share}%`, background: inkFor(code, order) }}
                          title={`${point.valuedOn} · ${nameOf(code, names)}: ${share.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                  <span className="mt-1 truncate text-center text-2xs text-ink-muted">
                    {shortly(point.valuedOn)}
                  </span>
                </div>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {codes.map((code) => (
              <li key={code} className="flex items-center gap-1.5 text-2xs text-ink-muted">
                <span aria-hidden="true" className="size-2 rounded-full"
                  style={{ background: inkFor(code, order) }} />
                {nameOf(code, names)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** How far each class is outside its band, drawn from the middle so the sign reads as a direction. */
function AgainstTheBand({ byClass, names }: {
  byClass: PortfolioStanding["classes"];
  names: Record<string, string>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        How far each class is from its band
      </h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        Left of the middle is short of its target; right is over. The pale block is the band — a bar
        inside it is sound, a bar past it has breached.
      </p>

      {byClass.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line py-10 text-center text-sm text-ink-muted">
          Nothing to measure until this client is on a plan.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {byClass.map((row) => {
            const band = row.band?.breachAt ?? 0;
            const drift = row.drift ?? 0;
            // One scale for every row, so a class twice as far out looks twice as far out.
            const widest = Math.max(...byClass.map((one) =>
              Math.max(Math.abs(one.drift ?? 0), one.band?.breachAt ?? 0)), 1) * 1.1;
            const out = Math.abs(drift) > band;
            return (
              <li key={row.assetClass} className="grid grid-cols-[9rem_1fr_7rem] items-center gap-3">
                <span className="truncate text-sm text-ink">
                  {row.assetClassName || nameOf(row.assetClass, names)}
                </span>
                <span className="relative block h-5 rounded bg-slate-50">
                  {/* The band itself, as ground rather than a mark: a bar inside it is plainly inside. */}
                  <span aria-hidden="true" className="absolute inset-y-0 rounded bg-slate-200"
                    style={{ left: `${50 - (band / widest) * 50}%`, width: `${(band / widest) * 100}%` }} />
                  <span aria-hidden="true" className="absolute inset-y-0 w-px bg-ink/30" style={{ left: "50%" }} />
                  <span
                    className={cn("absolute inset-y-1 rounded-sm", out ? "bg-red-500" : "bg-emerald-500")}
                    style={drift >= 0
                      ? { left: "50%", width: `${(Math.abs(drift) / widest) * 50}%` }
                      : { right: "50%", width: `${(Math.abs(drift) / widest) * 50}%` }}
                  />
                </span>
                <span className={cn("text-right text-sm tabular-nums",
                  out ? "font-semibold text-red-600" : "text-ink-muted")}>
                  {drift > 0 ? "+" : drift < 0 ? "−" : ""}{Math.abs(drift).toFixed(1)}pp
                  <span className="block text-2xs font-normal text-ink-muted">band ±{band}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* The one thing this cannot draw, said rather than left to be discovered. */}
      <p className="mt-4 text-xs text-ink-muted">
        Sub-assets are not drawn. A day on file keeps what each asset class was worth, not what each line
        inside it was, so there is no history to draw one from — only today&apos;s figure, which is under
        Portfolio performance.
      </p>
    </section>
  );
}
