import { useRef, useState, type PointerEvent } from "react";

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

  function clear() {
    took.current = null;
    setDragging(null);
    setOver(null);
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
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const holding = took.current;
        if (!holding) return;
        // A few pixels before it counts as a drag, so a press that wanders by one does not rearrange
        // the table under somebody who meant to click.
        if (dragging === null && Math.abs(event.clientX - holding.from) < 4) return;
        if (dragging === null) setDragging(holding.id);
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
