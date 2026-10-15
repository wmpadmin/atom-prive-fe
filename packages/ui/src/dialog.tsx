import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  /**
   * lg suits long forms, such as editing a full profile; xl a form laid out in columns; 2xl one laid out
   * in columns that are themselves tables, where the narrower one leaves a name and its figure fighting
   * over the same few inches.
   */
  size?: "md" | "lg" | "xl" | "2xl";
  /**
   * Hold it at its full height whatever is in it. For a dialog somebody steps through, where one step is
   * long and the next is short: left to its content it grows and shrinks under the cursor, and the button
   * they are about to press moves with it.
   */
  tall?: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

const WIDTHS = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl", "2xl": "max-w-7xl" } as const;

/** Modal built on the native dialog element: focus trapping, Escape and the backdrop come for free. */
export function Dialog({ open, size = "md", tall, title, description, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`m-auto flex max-h-[calc(100dvh-3rem)] w-full flex-col ${tall ? "h-[calc(100dvh-3rem)]" : ""} ${WIDTHS[size]} overflow-hidden rounded-2xl bg-white p-0 font-sans text-ink shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]`}
    >
      {open && (
        <>
          {/* The title and the way out stay put. A dialog longer than the screen scrolls inside itself
              rather than growing past the bottom of the window and taking its own close button with it. */}
          <div className="relative shrink-0 px-6 pt-6 pb-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink"
            >
              <X className="size-4" />
            </button>
            <div className="pr-8">
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-ink-muted">{description}</div>}
            </div>
          </div>
          <div
            className={`min-h-0 flex-1 overflow-y-auto px-6 pb-6 ${tall ? "flex flex-col" : ""}`}
          >
            {children}
          </div>
        </>
      )}
    </dialog>
  );
}
