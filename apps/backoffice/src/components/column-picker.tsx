import { Button, cn } from "@atomprive/ui";
import { Check, Columns3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ColumnChoice {
  id: string;
  label: string;
}

interface ColumnPickerProps {
  columns: ColumnChoice[];
  shown: ReadonlySet<string>;
  onChange: (shown: ReadonlySet<string>) => void;
}

/** Chooses which columns a table shows; the first column always stays. */
export function ColumnPicker({ columns, shown, onChange }: ColumnPickerProps) {
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
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <p className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Columns to show</p>
          <ul>
            {columns.map((column) => {
              const ticked = shown.has(column.id);
              return (
                <li key={column.id}>
                  <button
                    type="button"
                    aria-pressed={ticked}
                    onClick={() => toggle(column.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border",
                        ticked ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white",
                      )}
                    >
                      {ticked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {column.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => onChange(new Set(columns.map((column) => column.id)))}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-600 hover:bg-slate-50"
          >
            Show every column
          </button>
        </div>
      )}
    </div>
  );
}
