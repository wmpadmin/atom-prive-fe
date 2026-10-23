import { useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * What a heading says, without the part only a screen reader hears.
 *
 * <p>Every heading carries a note after its name — "column 2 of 5, use the Columns button" — which is
 * there for somebody who cannot see the table. Read whole, the label being carried would say it too.
 */
function labelOf(heading: HTMLElement) {
  const copy = heading.cloneNode(true) as HTMLElement;
  for (const heard of copy.querySelectorAll(".sr-only")) heard.remove();
  return copy.textContent?.trim() ?? "";
}

/**
 * Taking hold of a column heading and putting it down somewhere else.
 *
 * <p>Worked out from the pointer rather than from the browser's own drag-and-drop. Written that way, a
 * heading could be picked up and never put down: marking the heading as the one being dragged restyles
 * the very node the browser has just taken hold of, and Chrome abandons a drag whose node changes in
 * the tick it begins in — dragstart fired, dragend fired straight after it, and no heading in between
 * ever saw a dragover to accept the drop. This depends on none of that, and unlike the native one it
 * can be tested.
 *
 * <p>Here rather than on each table, because three tables writing this out three times is three places
 * for it to be subtly different, and the difference would show as one table that reorders oddly.
 */
export function useColumnDrag(view: { order: string[]; move: (id: string, to: number) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  /** Which heading the pointer is over, so the one that would take the drop says so. */
  const [over, setOver] = useState<string | null>(null);
  /*
   * What was picked up and where, held outside React's state.
   *
   * <p>A press is not yet a drag: it becomes one a few pixels later, and until then nothing has to be
   * drawn differently. Kept in state it would redraw the table on every press of a heading, and
   * redrawing the heading somebody has just taken hold of is the very thing that broke this when it was
   * written with the browser's own drag.
   */
  const took = useRef<{ id: string; from: number } | null>(null);

  /*
   * The label travelling with the pointer.
   *
   * <p>Built by hand and put on the page rather than drawn by React, so that every table gets it from
   * this one file. Rendered the usual way it would have to be mounted by each table in turn, which is
   * nine more places to forget it — and a drag that looks different on one screen than on the next is
   * nobody's decision.
   *
   * <p>Without it, the only sign a column was in hand was the heading going pale and the one under the
   * pointer tinting. A reader watching their own pointer saw neither.
   */
  const carried = useRef<HTMLDivElement | null>(null);
  /** What that label says, read off the heading at the moment it was pressed. */
  const label = useRef("");

  function pickUp(label: string, x: number, y: number) {
    if (carried.current) return;
    const node = document.createElement("div");
    // Must not take the pointer: what is under it is how the heading to drop on is worked out, and a
    // label sitting under the cursor would be the only thing ever found there.
    node.className = "pointer-events-none fixed z-50 rounded-lg border border-line bg-white "
      + "px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-lg";
    node.textContent = label;
    document.body.append(node);
    carried.current = node;
    carryTo(x, y);
    // The cursor keeps its grip the whole way across, including over the gaps between headings, and
    // nothing highlights as blue text while the pointer sweeps the table.
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function carryTo(x: number, y: number) {
    const node = carried.current;
    if (!node) return;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    // Beside the pointer rather than under it, so the label never hides the heading being aimed at.
    node.style.transform = "translate(14px, -50%)";
  }

  function putDown() {
    carried.current?.remove();
    carried.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  // A drag that ends because the screen went away still has to let go of the page: the label is on the
  // body, which outlives this table.
  useEffect(() => putDown, []);

  function clear() {
    took.current = null;
    setDragging(null);
    setOver(null);
    putDown();
  }

  /** Everything a heading needs to be draggable, bound to the column it is the heading of. */
  function headingProps(id: string) {
    return {
      "data-column": id,
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        // The left button only.
        if (event.button !== 0) return;
        event.preventDefault();
        took.current = { id, from: event.clientX };
        // Taken now, while the heading is certainly still the one pressed. Read later it would be read
        // off whatever the pointer had since moved over.
        label.current = labelOf(event.currentTarget);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const holding = took.current;
        if (!holding) return;
        // A few pixels before it counts as a drag, so a press that wanders by one does not rearrange
        // the table under somebody who meant to click.
        if (dragging === null && Math.abs(event.clientX - holding.from) < 4) return;
        if (dragging === null) {
          setDragging(holding.id);
          pickUp(label.current, event.clientX, event.clientY);
        }
        carryTo(event.clientX, event.clientY);
        const under = document.elementFromPoint(event.clientX, event.clientY);
        const heading = under?.closest("[data-column]")?.getAttribute("data-column") ?? null;
        setOver(heading === holding.id ? null : heading);
      },
      onPointerUp: () => {
        const holding = took.current;
        // Dropped where it was picked up, or outside every heading: nothing has been asked for.
        if (holding && dragging !== null && over !== null && over !== holding.id) {
          // Read against the whole order rather than against what is on screen, so a column dropped
          // past a hidden one does not jump over it.
          view.move(holding.id, view.order.indexOf(over));
        }
        clear();
      },
      onPointerCancel: clear,
    };
  }

  return { dragging, over, headingProps };
}
