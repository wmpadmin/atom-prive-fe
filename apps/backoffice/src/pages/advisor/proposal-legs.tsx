import type { MoveLegRequest, PlannedLeg } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { figure, named, netted, overItsBand } from "../portfolios/money-words";

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
  // Asked for above the empty case below, because which page a reader is on is held in a hook, and a hook
  // reached on one render and skipped on the next loses track of which state is its own.
  const paged = usePagedRows(legs);
  if (legs.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        This proposal doesn't say where the money would go. It was written before a proposal carried its own
        moves, so there is nothing here to carry out.
      </p>
    );
  }
  // Every leg, not the page's worth. The figure somebody weighs before agreeing is the whole of what would
  // move, and a total that counted the page would say a proposal moves less than it moves.
  const total = legs.reduce((sum, leg) => sum + leg.amount, 0);
  return (
    <>
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
            {paged.shown.map((leg, at) => (
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
      {/* Outside the box the table scrolls in, so the pager stays where it is put while the columns slide. */}
      <PagedFooter paged={paged} noun={["leg", "legs"]} />
    </>
  );
}


/**
 * The line money lands on while nobody has decided where it is really going.
 *
 * <p>A rebalance sells and nothing else. The proceeds have to sit somewhere between the selling and the
 * placing, and this is where — but naming it to the person answering would say a decision had been made
 * that has not. Written here as the one place that knows both halves: the server moves it into this line,
 * and this table says what that means.
 */
const WAITING_TO_BE_PLACED = { assetClass: "CASH", subClass: "Uninvested cash" };

function waitingToBePlaced(leg: PlannedLeg) {
  return leg.toAssetClass === WAITING_TO_BE_PLACED.assetClass
    && leg.toSubClass === WAITING_TO_BE_PLACED.subClass
    && (leg.toSubSubClass === null || leg.toSubSubClass === "");
}

/**
 * What a proposal would move and what it would leave, in one table.
 *
 * <p>They were two: the legs above, the lines below, and the reader joining them up themselves. The
 * question being answered is both at once — this much leaves this line, and this is what the line is left
 * holding — so a reader who has to hold five rows in their head to ask it is a reader doing the screen's
 * arithmetic.
 *
 * <p>Holds now and would hold are said of the line the money LEAVES, which is the line the amount beside
 * them comes out of. Where two legs draw on one line, both rows report what that line is finally left
 * with rather than each doing half the sum.
 */
export function ProposalMoves({ legs, currency }: { legs: PlannedLeg[]; currency: string | null }) {
  // All three read the whole list, and have to. Netting is what lets two legs drawing on one line each
  // report what that line is finally left with, and a page of legs would net only against itself.
  const leaves = netted(legs);
  const byName = new Map(leaves.map((line) => [line.name, line]));
  const total = legs.reduce((sum, leg) => sum + leg.amount, 0);
  const paged = usePagedRows(legs);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            Each leg: where the money leaves, where it lands, what that line holds now, how much moves and
            what it would be left holding.
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4">Out of</th>
              <th scope="col" className="px-4 py-3">Into</th>
              <th scope="col" className="px-4 py-3 text-right">Holds now</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
              <th scope="col" className="py-3 pl-4 text-right">Would hold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.shown.map((leg, at) => {
              const from = named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass);
              const source = byName.get(from);
              const into = byName.get(named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass));
              const past = into === undefined ? 0 : overItsBand(into);
              return (
                <tr key={at} className="align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                    {from}
                    {/* Said against the line, because it is the line whose figure has moved under this. */}
                    {source?.heldWhenRaised != null && (
                      <span className="mt-0.5 block text-xs font-normal text-amber-700">
                        held {figure(source.heldWhenRaised)} when this was written
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-ink">
                    {waitingToBePlaced(leg) ? (
                      <span className="text-ink-muted">Nothing decided yet</span>
                    ) : (
                      named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)
                    )}
                    {/* The half a reader could not ask before: agreeing to this would take the line the
                        money lands in past the most the model lets it hold. */}
                    {past > 0 && (
                      <span className="mt-0.5 block text-xs font-normal text-amber-700">
                        {figure(past)} past the {figure(into?.mayHold ?? 0)} allowed
                      </span>
                    )}
                    {into !== undefined && into.askedByOthers >= 1 && (
                      <span className="mt-0.5 block text-xs font-normal text-amber-700">
                        another waiting ask would add {figure(into.askedByOthers)} here too
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-ink-muted">
                    {figure(leg.heldNow)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {money(leg.amount, currency)}
                  </td>
                  <td className={cn("py-3 pl-4 text-right tabular-nums whitespace-nowrap",
                    source !== undefined && overItsBand(source) > 0
                      ? "font-semibold text-amber-700" : "text-ink")}>
                    {figure(source?.wouldHold ?? leg.heldNow - leg.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* What the whole thing comes to, because that is the figure somebody answering it weighs. */}
          {legs.length > 1 && (
            <tfoot>
              <tr className="border-t border-line font-semibold text-ink">
                <th scope="row" colSpan={3} className="py-3 pr-4 text-left">In all</th>
                <td className="py-3 pl-4 text-right tabular-nums whitespace-nowrap">
                  {money(total, currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Outside the box the table scrolls in, and only where there is something to count. */}
      {legs.length > 0 && <PagedFooter paged={paged} noun={["leg", "legs"]} />}
    </>
  );
}
