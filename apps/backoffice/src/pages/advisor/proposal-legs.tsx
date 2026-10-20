import type { MoveLegRequest } from "@atomprive/api-client/backoffice";
import { named } from "../portfolios/money-words";

function money(amount: number, currency: string | null) {
  return `${currency ?? ""} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2,
    maximumFractionDigits: 2 })}`.trim();
}

/**
 * What a proposal would move, leg by leg: out of one line of the portfolio and into another.
 *
 * <p>Written out rather than described, because this is what approving the proposal carries out. A reader
 * answering one is answering these rows and nothing else.
 */
export function ProposalLegs({ legs, currency }: { legs: MoveLegRequest[]; currency: string | null }) {
  if (legs.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        This proposal doesn't say where the money would go. It was written before a proposal carried its own
        moves, so there is nothing here to carry out.
      </p>
    );
  }
  const total = legs.reduce((sum, leg) => sum + leg.amount, 0);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Each leg: where the money leaves, where it lands, and how much moves.</caption>
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-3 pr-4">
              Out of
            </th>
            <th scope="col" className="px-4 py-3">
              Into
            </th>
            <th scope="col" className="py-3 pl-4 text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {legs.map((leg, at) => (
            <tr key={at}>
              <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                {named(leg.fromSubClass ?? null, leg.fromAssetClass, leg.fromSubSubClass)}
              </th>
              <td className="px-4 py-3 text-ink">
                {named(leg.toSubClass ?? null, leg.toAssetClass, leg.toSubSubClass)}
              </td>
              <td className="py-3 pl-4 text-right tabular-nums whitespace-nowrap">
                {money(leg.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
        {/* What the whole thing comes to, because that is the figure somebody answering it weighs. */}
        {legs.length > 1 && (
          <tfoot>
            <tr className="border-t border-line font-semibold text-ink">
              <th scope="row" colSpan={2} className="py-3 pr-4 text-left">
                In all
              </th>
              <td className="py-3 pl-4 text-right tabular-nums whitespace-nowrap">{money(total, currency)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
