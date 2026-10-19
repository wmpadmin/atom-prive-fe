import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";

/** One thing the menu can be set to, and how many rows it would leave on screen. */
export type FilterOption<T extends string> = {
  id: T;
  label: string;
  /** Shown beside the label where the screen knows it. A count of nothing is still worth saying. */
  count?: number;
};

/**
 * One control that says what a list is being narrowed to, in place of a row of buttons.
 *
 * <p>A row of buttons says everything at once: eight or nine of them wrap onto two lines, push the list
 * down the page, and leave the reader to find which one is lit. One control says the one thing that is
 * true — what you are looking at — and keeps the rest a press away.
 *
 * <p>It opens <em>below</em> the button rather than over it, which is the whole reason this is not a
 * native {@code <select>}: a native menu on a Mac lays the chosen item on top of the control that opened
 * it, so the control disappears at the moment you are deciding what to do with it.
 *
 * <p>Single choice only. A list is in one state at a time, which is the question every queue on the
 * platform asks; anything that needs several at once wants checkboxes and a different control.
 */
export function FilterMenu<T extends string>({
  label, value, options, onChange, align = "left", className,
}: {
  /** What is being narrowed, for whoever cannot see the control. "Proposals", "Plans". */
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  /**
   * Which edge the menu hangs from. Left by default, because that is where the eye already is — right
   * for a control sitting at the right-hand end of a row, where a left-hung menu would run off the page.
   */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const chosen = options.find((one) => one.id === value) ?? options[0];

  // Closed by the two things that mean "not this": a press somewhere else, and Escape. Both are listened
  // for only while it is open, so a page full of these costs nothing until one is being used.
  useEffect(() => {
    if (!open) {
      return;
    }
    function away(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        type="button"
        id={`${id}-button`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${chosen?.label ?? ""}`}
        onClick={() => setOpen((was) => !was)}
        // The same height and the same least width as every other control on a filter row, so a row of
        // them lines up instead of each one shrinking to the length of whatever happens to be chosen.
        className={cn(
          "flex h-10 w-full min-w-44 items-center justify-between gap-2 rounded-lg border border-line",
          "bg-white px-3 text-sm font-semibold text-ink hover:border-ink/25",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{chosen?.label}</span>
          {chosen?.count !== undefined && (
            <span className="shrink-0 tabular-nums text-ink-muted">{chosen.count}</span>
          )}
        </span>
        <ChevronDown aria-hidden="true"
          className={cn("size-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        // Below the button rather than over it, which is the point. z-20 clears the cards it opens over;
        // nothing on these screens sits higher than a dialog.
        <ul
          role="listbox"
          aria-labelledby={`${id}-button`}
          className={cn(
            "absolute top-full z-20 mt-1 max-h-80 min-w-56 overflow-y-auto rounded-xl border border-line",
            "bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                role="option"
                aria-selected={one.id === value}
                onClick={() => {
                  onChange(one.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50",
                  one.id === value ? "font-semibold text-ink" : "text-ink-soft",
                )}
              >
                {/* The tick holds its width whether or not it is drawn, so the labels line up. */}
                <span className="w-4 shrink-0">
                  {one.id === value && <Check aria-hidden="true" className="size-4 text-primary-600" />}
                </span>
                <span className="flex-1">{one.label}</span>
                {one.count !== undefined && (
                  <span className="shrink-0 tabular-nums text-ink-muted">{one.count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
