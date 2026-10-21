import type { PlannedLeg } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { figure, netted, overItsBand } from "./money-words";

/**
 * What the client would be left holding, line by line.
 *
 * <p>The question whoever answers is actually answering is not what moves but what is left — and that was
 * arithmetic they did themselves, across legs no screen put side by side.
 *
 * <p>Drawn once for both kinds of asking. A client's own asking has said this for a while; advice said
 * none of it, and somebody agreeing to a proposal could take a line past its band without the word band
 * appearing anywhere on the page. Two screens saying it differently would be two readings of one client's
 * money.
 */
export function WhatItWouldLeave({ legs }: { legs: PlannedLeg[] }) {
  const leaves = netted(legs);
  // Taken above the empty check below, because a hook cannot be called after a return: the netting is
  // already done by this point, so the page is settled whether or not there is anything to draw.
  const paged = usePagedRows(leaves);
  if (leaves.length === 0) {
    return null;
  }
  // Wrapped, because this sits in a two-column grid beside what would move: a table and a footer
  // returned loose would be two cells of that grid rather than one.
  return (
    <div>
      <table className="w-full table-fixed text-sm">
        <caption className="border-b border-line pb-2 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          What it would leave
        </caption>
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[31%]" />
          <col className="w-[31%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-2 pr-3">Line</th>
            <th scope="col" className="px-3 py-2 text-right">Holds now</th>
            <th scope="col" className="py-2 pl-3 text-right">Would hold</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {paged.shown.map((line) => (
            <tr key={line.name} className="align-top">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium break-words text-ink">
                {line.name}
                {/* Said against the line, because it is the line whose figure has moved. */}
                {line.heldWhenRaised !== null && (
                  <span className="mt-0.5 block text-xs font-normal text-amber-700">
                    held {figure(line.heldWhenRaised)} when this was written
                  </span>
                )}
                {/* The half nothing on this screen could ask before: something else is waiting to put money
                    in here too. Each was weighed against the same figures and each sits inside the band on
                    its own. */}
                {line.askedByOthers >= 1 && (
                  <span className="mt-0.5 block text-xs font-normal text-amber-700">
                    another waiting ask would add {figure(line.askedByOthers)} here too
                  </span>
                )}
                {overItsBand(line) > 0 && (
                  <span className="mt-0.5 block text-xs font-normal text-amber-700">
                    {figure(overItsBand(line))} past the {figure(line.mayHold ?? 0)} allowed
                  </span>
                )}
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-ink-muted">
                {figure(line.holdsNow)}
              </td>
              <td className={cn("py-2.5 pl-3 text-right tabular-nums whitespace-nowrap",
                overItsBand(line) > 0 ? "font-semibold text-amber-700" : "text-ink")}>
                {figure(line.wouldHold)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PagedFooter paged={paged} noun={["line", "lines"]} />
    </div>
  );
}

/** Whether agreeing to these legs would leave any line past the most it may hold. */
export function wouldBreakAband(legs: PlannedLeg[]) {
  return netted(legs).some((line) => overItsBand(line) > 0);
}

/** Whether something else waiting would land in a line these legs land in. */
export function somethingElseLandsHere(legs: PlannedLeg[]) {
  return netted(legs).some((line) => line.askedByOthers >= 1);
}
