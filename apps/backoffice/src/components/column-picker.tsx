import { Button, cn } from "@atomprive/ui";
import { ArrowDown, ArrowUp, Check, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ColumnChoice {
  id: string;
  label: string;
}

interface ColumnPickerProps {
  columns: ColumnChoice[];
  shown: ReadonlySet<string>;
  onChange: (shown: ReadonlySet<string>) => void;
  /**
   * The order the columns are in, on a table that lets them be moved.
   *
   * <p>Given, the list is drawn in that order and each row carries arrows; dragging a heading and
   * pressing an arrow are then the same act. Left out, this is the picker it has always been: what to
   * show, listed in the order the firm wrote them.
   */
  order?: string[];
  onMove?: (id: string, to: number) => void;
  /** Offered only once something has actually been changed, so it is never a button that undoes nothing. */
  onReset?: () => void;
  arranged?: boolean;
}

/**
 * Chooses which columns a table shows, and on a table that allows it, what order they are in.
 *
 * <p>The arrows are not a lesser way of doing what dragging does. A column that has been taken off has
 * no heading left to drag, so this list is the only way back for it; and a reader who is not using a
 * mouse has no other way to move one at all.
 */
export function ColumnPicker({
  columns, shown, onChange, order, onMove, onReset, arranged = false,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle(id: string) {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const named = new Map(columns.map((one) => [one.id, one.label]));
  // The table's own order where it has one, and the order the firm wrote them in where it has not.
  const listed = order ?? columns.map((one) => one.id);
  const movable = order !== undefined && onMove !== undefined;

  return (
    <div ref={pickerRef} className="relative">
      <Button variant="secondary" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Columns3 aria-hidden="true" />
        Columns
        <span className="text-xs font-medium text-ink-muted tabular-nums">
          {shown.size}/{columns.length}
        </span>
      </Button>
      {open && (
        <div className={cn("absolute right-0 z-20 mt-2 rounded-xl border border-line bg-white p-1.5 shadow-lg",
          movable ? "w-72" : "w-60")}>
          <p className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Columns to show
          </p>
          {movable && (
            <p className="px-3 pb-2 text-xs text-ink-muted">Drag a heading to move it, or use the arrows.</p>
          )}
          <ul className="max-h-80 overflow-auto">
            {listed.map((id, at) => {
              const ticked = shown.has(id);
              return (
                <li key={id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-pressed={ticked}
                    onClick={() => toggle(id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        ticked ? "border-primary-600 bg-primary-600 text-on-accent" : "border-line bg-white",
                      )}
                    >
                      {ticked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{named.get(id) ?? id}</span>
                  </button>
                  {movable && (
                    <>
                      {/* Up and down, not left and right: this list runs down the screen while the
                          columns it moves run across it, so the arrow points the way the row a reader is
                          looking at will travel. */}
                      <button
                        type="button"
                        aria-label={`Move ${named.get(id) ?? id} earlier`}
                        disabled={at === 0}
                        onClick={() => onMove(id, at - 1)}
                        className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink",
                          at === 0 && "pointer-events-none opacity-30")}
                      >
                        <ArrowUp aria-hidden="true" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${named.get(id) ?? id} later`}
                        disabled={at === listed.length - 1}
                        onClick={() => onMove(id, at + 1)}
                        className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink",
                          at === listed.length - 1 && "pointer-events-none opacity-30")}
                      >
                        <ArrowDown aria-hidden="true" className="size-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {onReset && arranged ? (
            <button
              type="button"
              onClick={onReset}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-600 hover:bg-slate-50"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Put them back as they were
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange(new Set(columns.map((column) => column.id)))}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-600 hover:bg-slate-50"
            >
              Show every column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
