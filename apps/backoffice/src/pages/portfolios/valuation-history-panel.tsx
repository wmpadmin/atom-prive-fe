import { ApiError } from "@atomprive/api-client";
import { useGetClientValuations, type ValuationHistory, type ValuationPoint } from "@atomprive/api-client/backoffice";
import { Alert } from "@atomprive/ui";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "../../lib/labels";

/**
 * The drawing is made at the size it is shown at, never scaled to fit.
 *
 * <p>A fixed grid stretched to the width of the card takes its lettering and its strokes with it: on a wide
 * screen the axis figures came out half again the size of every other word on the page, and the line with
 * them. Measured instead, a figure set at 12 is 12 wherever the card happens to end.
 */
const HEIGHT = 210;
/** Room down the left for the figures the line is read against, and under it for the days. */
const PADDING = { top: 26, right: 16, bottom: 26, left: 72 };
/** Narrow enough for a phone, and what is drawn before the card has been measured. */
const NARROWEST = 280;

/** Money as a statement writes it: grouped thousands, two decimal places. */
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Short enough to sit beside the line without crowding it: 28.0K, 1.2M. */
function shortMoney(amount: number) {
  const size = Math.abs(amount);
  if (size >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

/**
 * The stretch the line is drawn against, and the figures written beside it.
 *
 * <p>Never from nothing: a portfolio that moved from 28,000 to 28,500 drawn from zero is a flat line, and
 * the whole point of the drawing is the half-percent it moved. The scale is given a margin above and below
 * instead, so the line has somewhere to be.
 *
 * <p>A flat history has no stretch at all, so one is invented around the single figure — otherwise every
 * tick would read the same and the line would sit on top of one of them.
 */
function scale(points: ValuationPoint[]) {
  const worth = points.map((point) => point.underManagement);
  const low = Math.min(...worth);
  const high = Math.max(...worth);
  const margin = high === low ? Math.max(Math.abs(high) * 0.1, 1) : (high - low) * 0.15;
  const from = low - margin;
  const to = high + margin;
  return { from, to, ticks: [to, (to + from) / 2, from] };
}

/** Where a figure sits down the drawing, on the same scale the ticks are written from. */
function down(amount: number, from: number, to: number) {
  const height = HEIGHT - PADDING.top - PADDING.bottom;
  const span = to - from;
  return PADDING.top + (span === 0 ? height / 2 : height - (height * (amount - from)) / span);
}

/** Where each day sits in the drawing, across whatever width the card turned out to be. */
function placed(points: ValuationPoint[], width: number) {
  const { from, to } = scale(points);
  const across = width - PADDING.left - PADDING.right;
  return points.map((point, at) => ({
    point,
    x: PADDING.left + (points.length === 1 ? across / 2 : (across * at) / (points.length - 1)),
    y: down(point.underManagement, from, to),
  }));
}

/** The card's width in real pixels, so the drawing can be made at the size it is shown at. */
function useWidth() {
  const box = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const card = box.current;
    if (!card) return;
    const watching = new ResizeObserver(([seen]) => {
      if (seen) setWidth(seen.contentRect.width);
    });
    watching.observe(card);
    return () => watching.disconnect();
  }, []);

  return [box, Math.max(width, NARROWEST)] as const;
}

/**
 * What a client's portfolio has been worth, day by day.
 *
 * <p>Worth, not return: nothing records money paid in or taken out, so a rise between two days may be the
 * market or may be a deposit.
 *
 * <p>A day written in another currency is marked, and what it was recorded as is kept beside it — converting
 * restates a figure, and a restated figure is not the one somebody wrote down.
 */
export function ValuationHistoryPanel({ customerId }: { customerId: string }) {
  const history = useGetClientValuations<ValuationHistory, ApiError>(customerId);
  const [box, width] = useWidth();

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }
  const points = history.data?.points ?? [];
  const currency = history.data?.currency ?? "USD";
  const restated = points.filter((point) => point.asRecorded !== null).length;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5" ref={box}>
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What it has been worth</h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        Worth, not return: nothing records money paid in or taken out yet, so a rise between two days may be
        the market or may be a deposit. A day is written down each time the holdings are saved.
      </p>

      {points.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Nothing written down yet. Save what the client holds and the first day appears here.
        </p>
      ) : (
        <>
          <figure className="mt-4">
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width={width}
              height={HEIGHT}
              className="block max-w-full text-primary-600"
              role="img"
              aria-label={`What the portfolio has been worth, ${formatDate(points[0]!.valuedOn)} to ${formatDate(points.at(-1)!.valuedOn)}, in ${currency}.`}
            >
              {(() => {
                const sited = placed(points, width);
                const line = sited.map((one) => `${one.x},${one.y}`).join(" ");
                const floor = HEIGHT - PADDING.bottom;
                const { from, to, ticks } = scale(points);
                return (
                  <>
                    {/* The figures the line is read against. Without them its height says nothing at all. */}
                    {ticks.map((tick) => {
                      const y = down(tick, from, to);
                      return (
                        <g key={tick}>
                          <line
                            x1={PADDING.left}
                            x2={width - PADDING.right}
                            y1={y}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth="1"
                            opacity="0.14"
                          />
                          <text
                            x={PADDING.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-ink-muted text-[12px]"
                          >
                            {shortMoney(tick)}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={PADDING.left - 10}
                      y={12}
                      textAnchor="end"
                      className="fill-ink-muted text-[11px] font-semibold tracking-wider uppercase"
                    >
                      {currency}
                    </text>
                    <polygon
                      points={`${sited[0]!.x},${floor} ${line} ${sited.at(-1)!.x},${floor}`}
                      fill="currentColor"
                      opacity="0.08"
                    />
                    <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" />
                    {sited.map((one) => (
                      <circle
                        key={one.point.valuedOn}
                        cx={one.x}
                        cy={one.y}
                        // A day that was restated is drawn hollow, so the eye can find it on the line.
                        r={one.point.asRecorded ? 5 : 3.5}
                        // Hollow against the card it sits on, which every card in the back-office paints white.
                        fill={one.point.asRecorded ? "white" : "currentColor"}
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <title>
                          {`${formatDate(one.point.valuedOn)}: ${money(one.point.underManagement, currency)}`}
                          {one.point.asRecorded
                            ? ` — recorded as ${money(one.point.asRecorded.underManagement, one.point.asRecorded.currency)}`
                            : ""}
                        </title>
                      </circle>
                    ))}
                    {/* The days, under the dots they belong to rather than only at the two ends. */}
                    {sited.map((one, at) =>
                      at === 0 || at === sited.length - 1 || sited.length <= 6 ? (
                        <text
                          key={`day-${one.point.valuedOn}`}
                          x={one.x}
                          y={HEIGHT - 8}
                          textAnchor={at === 0 ? "start" : at === sited.length - 1 ? "end" : "middle"}
                          className="fill-ink-muted text-[12px]"
                        >
                          {formatDate(one.point.valuedOn)}
                        </text>
                      ) : null,
                    )}
                  </>
                );
              })()}
            </svg>
            {restated > 0 && (
              <figcaption className="mt-1 text-2xs text-ink-muted">
                ○ {restated === 1 ? "1 day was" : `${restated} days were`} written in another currency
              </figcaption>
            )}
          </figure>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Every day on file, with what it was recorded as.</caption>
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-4">
                    Day
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Worth
                  </th>
                  <th scope="col" className="py-2 pl-4 text-right">
                    As recorded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...points].reverse().map((point) => (
                  <tr key={point.valuedOn}>
                    <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap text-ink">
                      {formatDate(point.valuedOn)}
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {money(point.underManagement, currency)}
                    </td>
                    {/* A day nobody has restated was recorded as exactly what it still says. */}
                    <td className="py-2 pl-4 text-right tabular-nums text-ink-muted">
                      {point.asRecorded
                        ? money(point.asRecorded.underManagement, point.asRecorded.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {restated > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              A day written in another currency was converted at the rate that applied on that day. What it
              was first recorded as is kept beside it and never changes again.
            </p>
          )}
        </>
      )}
    </section>
  );
}
