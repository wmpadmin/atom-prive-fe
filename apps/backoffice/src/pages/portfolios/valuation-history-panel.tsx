import { ApiError } from "@atomprive/api-client";
import { useGetClientValuations, type ValuationHistory, type ValuationPoint } from "@atomprive/api-client/backoffice";
import { Alert } from "@atomprive/ui";
import { formatDate } from "../../lib/labels";

/** The drawing's own coordinates. The box it is drawn into scales it, so these are only proportions. */
const WIDTH = 720;
const HEIGHT = 150;
const PADDING = { top: 12, right: 12, bottom: 12, left: 12 };

/** Money as a statement writes it: grouped thousands, two decimal places. */
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Where each day sits in the drawing. A flat history is drawn down the middle rather than along an edge. */
function placed(points: ValuationPoint[]) {
  const worth = points.map((point) => point.underManagement);
  const low = Math.min(...worth);
  const high = Math.max(...worth);
  const span = high - low;
  const across = WIDTH - PADDING.left - PADDING.right;
  const down = HEIGHT - PADDING.top - PADDING.bottom;
  return points.map((point, at) => ({
    point,
    x: PADDING.left + (points.length === 1 ? across / 2 : (across * at) / (points.length - 1)),
    y: PADDING.top + (span === 0 ? down / 2 : down - (down * (point.underManagement - low)) / span),
  }));
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

  if (history.isError) {
    return <Alert tone="danger">{history.error.message}</Alert>;
  }
  const points = history.data?.points ?? [];
  const currency = history.data?.currency ?? "USD";
  const restated = points.filter((point) => point.asRecorded !== null).length;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
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
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full text-primary-600"
              role="img"
              aria-label={`What the portfolio has been worth, ${formatDate(points[0]!.valuedOn)} to ${formatDate(points.at(-1)!.valuedOn)}, in ${currency}.`}
            >
              {(() => {
                const sited = placed(points);
                const line = sited.map((one) => `${one.x},${one.y}`).join(" ");
                const floor = HEIGHT - PADDING.bottom;
                return (
                  <>
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
                  </>
                );
              })()}
            </svg>
            <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-2xs text-ink-muted">
              <span>{formatDate(points[0]!.valuedOn)}</span>
              {restated > 0 && (
                <span>
                  ○ {restated === 1 ? "1 day was" : `${restated} days were`} written in another currency
                </span>
              )}
              <span>{formatDate(points.at(-1)!.valuedOn)}</span>
            </figcaption>
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
