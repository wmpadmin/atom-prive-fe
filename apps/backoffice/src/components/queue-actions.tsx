import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Where a screen's own buttons go when the screen is a panel inside a bigger one.
 *
 * <p>A queue's actions — Export, New proposal — belong to the queue, and nothing above it knows what they
 * do or what they are acting on: exporting means exporting whatever the filters currently select, which
 * only the queue holds. So the queue keeps its buttons, and this carries them up to where the screen has
 * room for them.
 *
 * <p>Empty where nobody offered a place, which is every screen that is itself the whole page. The buttons
 * then draw where they stand.
 */
const QueueActionsContext = createContext<{
  /**
   * Whether a screen above is keeping a place at all — which is a different question from whether it has
   * drawn the box yet. Without it, the one render before the box exists is indistinguishable from having
   * no frame, and the buttons flashed into their old position and jumped out of it again.
   */
  framed: boolean;
  box: HTMLElement | null;
  keep: (box: HTMLElement | null) => void;
}>({ framed: false, box: null, keep: () => {} });

/**
 * A screen that keeps its panels' buttons somewhere of its own choosing.
 *
 * <p>The box is held as state rather than in a ref, so the panel inside renders a second time once the
 * box exists. A ref is filled in after the render that would have read it, and the buttons would have sat
 * invisible until some unrelated keystroke drew the screen again.
 */
export function QueueActionsFrame({ children }: { children: ReactNode }) {
  const [box, keep] = useState<HTMLElement | null>(null);
  const carrying = useMemo(() => ({ framed: true, box, keep }), [box]);
  return <QueueActionsContext.Provider value={carrying}>{children}</QueueActionsContext.Provider>;
}

/**
 * The place the open panel's buttons are drawn. Put wherever the screen has room — on its own heading
 * row, where a row of nothing stood.
 */
export function QueueActionsBox({ className }: { className?: string }) {
  const { keep } = useContext(QueueActionsContext);
  return <div ref={keep} className={className} />;
}

/**
 * A panel's own buttons, drawn wherever the screen around it keeps such things.
 *
 * <p>Where a frame offered a box they go into it and nothing is left behind — not even an empty row,
 * which is what stood between the tabs and the filters and read as a band of missing content.
 */
export function QueueActions({ children, className }: { children: ReactNode; className?: string }) {
  const { framed, box } = useContext(QueueActionsContext);
  if (framed) {
    return box ? createPortal(children, box) : null;
  }
  return <div className={className}>{children}</div>;
}
