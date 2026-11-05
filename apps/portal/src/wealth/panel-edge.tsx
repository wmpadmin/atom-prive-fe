import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * A side panel's left edge, which is also the handle for how wide it is: a reader with a table to read can
 * give it room, and one who wants the page beside it can take the room back.
 *
 * <p>Built like the sidebar's edge. The arrow keys move it a step at a time (Shift for a bigger step), and
 * Home or a double-click puts it back to where it opened. The width is written down once, on release.
 */
export function PanelEdge({
  label,
  width,
  narrowest,
  widest,
  opensAt,
  onDrag,
  onSettled,
}: {
  /** What the handle is called to a screen reader, such as "How wide the assistant is". */
  label: string;
  width: number;
  narrowest: number;
  widest: number;
  /** Where Home and a double-click put it back to. */
  opensAt: number;
  onDrag: (to: number) => void;
  onSettled: (to: number) => void;
}) {
  const dragging = useRef(false);
  const latest = useRef(width);
  useEffect(() => {
    latest.current = width;
  }, [width]);

  useEffect(() => {
    const moved = (event: PointerEvent) => {
      if (!dragging.current) {
        return;
      }
      // The panel's right edge is the window's, so the width asked for is the distance from the pointer to it.
      event.preventDefault();
      onDrag(window.innerWidth - event.clientX);
    };
    const released = () => {
      if (!dragging.current) {
        return;
      }
      dragging.current = false;
      onSettled(latest.current);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", moved);
    window.addEventListener("pointerup", released);
    window.addEventListener("pointercancel", released);
    return () => {
      window.removeEventListener("pointermove", moved);
      window.removeEventListener("pointerup", released);
      window.removeEventListener("pointercancel", released);
    };
  }, [onDrag, onSettled]);

  const byKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      onSettled(opensAt);
      return;
    }
    const step = event.shiftKey ? 48 : 16;
    // The handle is on the left, so moving it left makes the panel wider.
    const by = event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
    if (by === 0) {
      return;
    }
    event.preventDefault();
    latest.current += by;
    onSettled(latest.current);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={narrowest}
      aria-valuemax={widest}
      tabIndex={0}
      onKeyDown={byKey}
      onDoubleClick={() => onSettled(opensAt)}
      onPointerDown={(event) => {
        event.preventDefault();
        dragging.current = true;
        document.body.style.setProperty("cursor", "col-resize");
        document.body.style.setProperty("user-select", "none");
      }}
      className="absolute top-0 -left-1 z-10 h-full w-2 cursor-col-resize
        before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2
        before:bg-transparent hover:before:bg-primary-600 focus-visible:before:bg-primary-600
        focus-visible:outline-none"
    />
  );
}
