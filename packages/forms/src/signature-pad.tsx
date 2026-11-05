import { cn } from "@atomprive/ui";
import { useEffect, useRef, useState } from "react";

/** How wide and tall the drawing is kept, whatever size it is shown at. */
const WIDTH = 600;
const HEIGHT = 200;

/**
 * Signing by hand: a box to draw a signature in, with a finger on a tablet or a mouse on a desktop. What comes
 * out is the drawing itself, as a PNG, which is what gets kept against the form.
 */
export function SignaturePad({
  onChange,
  disabled = false,
}: {
  onChange: (drawing: string | null) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const surface = canvas.current?.getContext("2d");
    if (!surface) return;
    surface.lineWidth = 2.5;
    surface.lineCap = "round";
    surface.lineJoin = "round";
    surface.strokeStyle = "#0f172a";
  }, []);

  /** Where the pointer is on the drawing itself, whatever size the box is shown at. */
  function at(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * WIDTH,
      y: ((event.clientY - box.top) / box.height) * HEIGHT,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const surface = canvas.current?.getContext("2d");
    if (!surface) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = at(event);
    surface.beginPath();
    surface.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const surface = canvas.current?.getContext("2d");
    if (!surface) return;
    const { x, y } = at(event);
    surface.lineTo(x, y);
    surface.stroke();
  }

  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    setDrawn(true);
    onChange(canvas.current?.toDataURL("image/png") ?? null);
  }

  function clear() {
    const surface = canvas.current?.getContext("2d");
    if (!surface || !canvas.current) return;
    surface.clearRect(0, 0, WIDTH, HEIGHT);
    setDrawn(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        aria-label="Sign here"
        className={cn(
          "h-40 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white",
          disabled ? "opacity-60" : "cursor-crosshair",
        )}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      />
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{drawn ? "Signed." : "Draw your signature in the box."}</span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !drawn}
          className="font-semibold text-ink underline disabled:text-ink-muted disabled:no-underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
