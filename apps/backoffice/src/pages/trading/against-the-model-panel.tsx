import { ApiError } from "@atomprive/api-client";
import { useGetClientPortfolio, type PortfolioStanding } from "@atomprive/api-client/backoffice";
import { Badge, cn } from "@atomprive/ui";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { standingLabels, standingTones } from "../portfolios/portfolio-labels";

/** The same arithmetic the blotter's figures are in: the client's own currency, to the penny. */
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function share(value: number) {
  return `${value.toFixed(2)}%`;
}

/**
 * What this order would do to the portfolio it is for.
 *
 * <p>Compliance are asked to pass or refuse a trade, and a reference, a sum and a class is not enough to
 * answer with: the question is whether the trade is right for that client, which means what the model asks
 * of them, what they hold against it, and where this order would leave them. Read-only — the panel moves
 * nothing and asks nothing of whoever is reading.
 *
 * <p>It is drawn from the portfolio as it stands now, not as it stood when the order was raised. That is
 * the honest answer to "should this go through today", and where the two differ the difference is the
 * reason to refuse it.
 */
export function AgainstTheModelPanel({
  customerId,
  assetClass,
  side,
  amount,
}: {
  customerId: string;
  assetClass: string;
  side: "BUY" | "SELL";
  amount: number;
}) {
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);

  if (standing.isPending) {
    return (
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <p className="text-sm text-ink-muted">Reading the client's portfolio…</p>
      </section>
    );
  }
  // A client with nothing written down is an ordinary state, not a failure worth a red banner — but it is
  // worth saying, because it is the reason the rest of this panel is missing.
  if (standing.isError || !standing.data?.modelPortfolioId) {
    return (
      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Against the model</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {standing.isError
            ? "Nothing is written down for this client's portfolio, so there is nothing to measure this order against."
            : "This client is on no model, so there is nothing to measure this order against."}
        </p>
      </section>
    );
  }

  const held = standing.data;
  const row = held.classes.find((one) => one.assetClass === assetClass);
  const moved = side === "BUY" ? amount : -amount;
  const after = row ? row.actualValue + moved : moved;
  const afterShare = held.underManagement > 0 ? (after / held.underManagement) * 100 : 0;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Against the model</h2>
          <p className="mt-1 text-xs text-ink-muted">
            The portfolio as it stands today, not as it stood when the order was raised.
          </p>
        </div>
        <Link
          to={`/portfolio-clients/${customerId}`}
          className="text-xs font-semibold text-primary-700 underline hover:text-primary-800"
        >
          Open the portfolio
        </Link>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Measured against">{held.modelName ?? "On no model"}</Fact>
        <Fact label="Under management">{money(held.underManagement, held.currency)}</Fact>
        <Fact label="Whole portfolio">
          {held.standing ? (
            <Badge tone={standingTones[held.standing]}>{standingLabels[held.standing]}</Badge>
          ) : (
            <span className="text-ink-muted">Nothing written down</span>
          )}
        </Fact>
        <Fact label="Last put back">
          {held.lastRebalancedOn ? formatDate(held.lastRebalancedOn) : <span className="text-ink-muted">Never</span>}
        </Fact>
      </dl>

      {row ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-4">{row.assetClassName}</th>
                <th scope="col" className="py-2 pr-4 text-right">Share</th>
                <th scope="col" className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">The model asks for</th>
                <td className="py-2.5 pr-4 text-right tabular-nums">{share(row.targetShare)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(row.targetValue, held.currency)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  They hold{" "}
                  <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
                </th>
                <td className="py-2.5 pr-4 text-right tabular-nums">{share(row.actualShare)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(row.actualValue, held.currency)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  This order {side === "BUY" ? "buys" : "sells"}
                </th>
                <td className="py-2.5 pr-4 text-right text-ink-muted">—</td>
                <td
                  className={cn(
                    "py-2.5 text-right font-semibold tabular-nums",
                    side === "BUY" ? "text-emerald-700" : "text-red-600",
                  )}
                >
                  {side === "BUY" ? "+" : "−"}
                  {money(amount, held.currency)}
                </td>
              </tr>
              <tr className="bg-canvas/60 font-semibold">
                <th scope="row" className="py-2.5 pr-4 text-left">Which would leave them at</th>
                <td className="py-2.5 pr-4 text-right tabular-nums">{share(afterShare)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(after, held.currency)}</td>
              </tr>
            </tbody>
          </table>
          {/* The one thing a reader must not have to work out for themselves. */}
          {after < 0 && (
            <p className="mt-3 text-sm font-semibold text-red-600">
              That is more {row.assetClassName.toLowerCase()} than the client holds, so this order cannot be
              placed as it stands.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          The model says nothing about this class, so there is no target to measure the order against.
        </p>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}
