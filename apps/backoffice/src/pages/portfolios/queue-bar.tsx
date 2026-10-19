import type { ReactNode } from "react";

/**
 * The top line of a queue's card: what the list is on the left, what narrows it on the right.
 *
 * <p>Every queue on the approvals screen used to float its filter in a block of its own above the card,
 * and then spend the card's own heading repeating whichever state the filter was set to — the same words
 * twice, a hand's width apart, with a strip of page between them. One line says both now: a name that
 * does not move as the filter moves, and the controls at the end of the row, where somebody who has read
 * the list to the bottom looks to change it.
 *
 * <p>Written once because seven queues were drawing this line seven times. A heading a size smaller on one
 * queue than on the next is nobody's decision — it is what happens when seven files each keep a copy.
 *
 * <p>Two things the card around it has to honour. It must not be {@code overflow-hidden}: a FilterMenu
 * opens its list below the button, and a card that clips its children clips that list at the card's edge,
 * leaving the choices on screen but cut in half. And a FilterMenu at the right-hand end of the row wants
 * {@code align="right"}, or its list hangs from the left edge of the button and runs off the page.
 */
export function QueueBar({ name, children }: {
  /**
   * What the list is, not what it has been narrowed to.
   *
   * <p>The same words as the tab that opens this queue, deliberately. Named freshly here, a queue reached
   * through a tab saying "Model switch" was headed "Model changes" and its control announced itself as
   * "Requests" — three names for one list on one screen, and a reader asked to find the model-switch
   * queue with nothing to tell them they had.
   */
  name: string;
  /**
   * The controls, in reading order, ending at the right-hand corner.
   *
   * <p>Left out where a card has nothing to narrow — one client's own plans are the whole list — so the
   * bar is still the line that names a card rather than a line that only exists to hold a filter.
   */
  children?: ReactNode;
}) {
  return (
    // Wraps rather than scrolls. On a phone the controls drop under the heading and stay against the right
    // edge; a row that scrolled would park the filter off the side of a card nobody thinks to drag.
    // Bottom-aligned, because a queue whose controls carry their own little labels above them is a row
    // of two heights, and centring put the heading half a label lower than everything it sits beside.
    <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
      {/* Said once, in the card's own voice rather than in the voice its controls use. Set in the same
          micro-caps as the little labels above the controls, the heading read as one more caption
          belonging to the box beside it — and on the queue that has four of them it sat out of line with
          all four. */}
      <h2 className="text-sm font-semibold text-ink">{name}</h2>
      <div className="ml-auto flex flex-wrap items-end justify-end gap-3">{children}</div>
    </div>
  );
}
