import { ApiError } from "@atomprive/api-client";
import { useWhatIf, type PortfolioStanding, type WhatIf } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, TextInput, cn } from "@atomprive/ui";
import { useState } from "react";
import { asFigure } from "../../lib/figures";
import { useAssetClasses } from "./asset-classes";
import { standingLabels, standingTones, type DriftStanding } from "./portfolio-labels";

/** A move as it is typed: a figure, and which way it goes. */
type Move = { way: "buy" | "sell"; amount: string };

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What the moves come to, signed the way the API takes them. */
function asMoves(typed: Record<string, Move>) {
  const moves: Record<string, number> = {};
  for (const [assetClass, move] of Object.entries(typed)) {
    const figure = Number(move.amount);
    if (move.amount.trim() === "" || !Number.isFinite(figure) || figure === 0) continue;
    moves[assetClass] = move.way === "sell" ? -figure : figure;
  }
  return moves;
}

/**
 * Where the portfolio would stand if trades somebody is considering were placed.
 *
 * <p>Nothing is written down and nothing is placed — the platform never places a trade. It is a question
 * asked of the figures before anybody acts on them.
 */
export function WhatIfPanel({
  customerId,
  standing,
  editing,
}: {
  customerId: string;
  standing: PortfolioStanding;
  /** Asking changes nothing, but it follows the screen's one mode: no boxes to type in while reading. */
  editing: boolean;
}) {
  const { names, inUse } = useAssetClasses();
  const [typed, setTyped] = useState<Record<string, Move>>({});
  const [asked, setAsked] = useState<WhatIf | null>(null);
  const [refused, setRefused] = useState<string | null>(null);

  const whatIf = useWhatIf<ApiError>({
    mutation: {
      onSuccess: (answer) => {
        setAsked(answer);
        setRefused(null);
      },
      onError: (caught) => {
        setAsked(null);
        setRefused(caught.message);
      },
    },
  });

  const moves = asMoves(typed);
  const anything = Object.keys(moves).length > 0;
  const was = standing.standing as DriftStanding | null;
  const would = (asked?.after.standing ?? null) as DriftStanding | null;

  /**
   * Asking saves nothing, but a screen that is being read should not have boxes to type in: a control that
   * takes a figure says the page is being changed, and this page says plainly when it is.
   */
  function change(assetClass: string, part: Partial<Move>) {
    const move = typed[assetClass] ?? { way: "buy" as const, amount: "" };
    setTyped({ ...typed, [assetClass]: { ...move, ...part } });
    setAsked(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What if</h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        Try a trade before anybody places one. Nothing here is written down, and the platform never places a
        trade — it says where the portfolio would stand if somebody did.
      </p>

      <div className="mt-3 space-y-2">
        {inUse.map((one) => {
          const move = typed[one.code] ?? { way: "buy" as const, amount: "" };
          return (
            <div key={one.code} className="flex items-center gap-2">
              {/* Named in full: a class cut off at a fixed width reads as a different class. */}
              <span className="w-56 shrink-0 text-sm text-ink">
                {names[one.code] ?? one.code}
              </span>
              <div className="flex rounded-lg border border-line p-0.5">
                {(["buy", "sell"] as const).map((way) => (
                  <button
                    key={way}
                    type="button"
                    aria-pressed={move.way === way}
                    disabled={!editing}
                    onClick={() => change(one.code, { way })}
                    className={cn(
                      "rounded-md px-2 py-1 text-2xs font-semibold uppercase transition-colors",
                      move.way === way ? "bg-primary-600 text-white" : "text-ink-muted",
                      editing && move.way !== way && "hover:text-ink",
                      !editing && "opacity-60",
                    )}
                  >
                    {way}
                  </button>
                ))}
              </div>
              <TextInput
                aria-label={`${names[one.code] ?? one.code} amount`}
                inputMode="decimal"
                placeholder="0.00"
                readOnly={!editing}
                className={editing ? undefined : "bg-canvas text-ink-muted"}
                value={move.amount}
                onChange={(event) => change(one.code, { amount: asFigure(event.target.value, move.amount) })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {!editing
            ? "Press Edit to try a trade. Nothing is saved by asking."
            : anything
              ? "Nothing is saved by asking."
              : "Put a figure against a class to ask."}
        </p>
        <div className="flex gap-2">
          {(anything || asked) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTyped({});
                setAsked(null);
                setRefused(null);
              }}
            >
              Clear
            </Button>
          )}
          <Button
            size="sm"
            disabled={!editing || !anything || whatIf.isPending}
            onClick={() => whatIf.mutate({ customerId, data: { moves } })}
          >
            {whatIf.isPending ? "Working it out…" : "Show me"}
          </Button>
        </div>
      </div>

      {refused && (
        <div className="mt-3">
          <Alert tone="danger">{refused}</Alert>
        </div>
      )}

      {asked && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-muted">It would stand</span>
            {was && <Badge tone={standingTones[was]}>{standingLabels[was]}</Badge>}
            <span aria-hidden="true" className="text-ink-muted">
              →
            </span>
            {would ? (
              <Badge tone={standingTones[would]}>{standingLabels[would]}</Badge>
            ) : (
              <span className="text-ink-muted">on no model</span>
            )}
          </div>

          {/* Money arriving or leaving is not a rebalance, and is said rather than left to be noticed. */}
          <p className="mt-2 text-xs text-ink-muted">
            {asked.netChange === 0 ? (
              <>
                {money(asked.sold, asked.after.currency)} moved between classes. The portfolio is worth what
                it was worth: a rebalance moves money, it does not add any.
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-700">
                  This is not only a rebalance.
                </span>{" "}
                {money(Math.abs(asked.netChange), asked.after.currency)} would{" "}
                {asked.netChange > 0 ? "arrive" : "leave"}, taking the portfolio to{" "}
                {money(asked.after.underManagement, asked.after.currency)}.
              </>
            )}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-4">Asset class</th>
                  <th scope="col" className="px-4 py-2 text-right">Target</th>
                  <th scope="col" className="px-4 py-2 text-right">Held now</th>
                  <th scope="col" className="px-4 py-2 text-right">Would hold</th>
                  <th scope="col" className="py-2 pl-4 text-left">Would stand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {asked.after.classes.map((one) => {
                  const before = asked.before.classes.find((was) => was.assetClass === one.assetClass);
                  const standsAs = one.standing as DriftStanding;
                  return (
                    <tr key={one.assetClass}>
                      <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{one.assetClassName}</th>
                      <td className="px-4 py-2 text-right tabular-nums">{one.targetShare.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                        {(before?.actualShare ?? 0).toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {one.actualShare.toFixed(2)}%
                      </td>
                      <td className="py-2 pl-4">
                        <Badge tone={standingTones[standsAs]}>{standingLabels[standsAs]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
