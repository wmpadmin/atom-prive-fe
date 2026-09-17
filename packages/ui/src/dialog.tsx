import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  /** lg suits long forms, such as editing a full profile. */
  size?: "md" | "lg";
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Modal built on the native dialog element: focus trapping, Escape and the backdrop come for free. */
export function Dialog({ open, size = "md", title, description, onClose, children }: DialogProps) {
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
      className={`m-auto w-full ${size === "lg" ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-0 font-sans text-ink shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]`}
    >
      {open && (
        <div className="relative space-y-5 px-6 py-6">
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
          {children}
        </div>
      )}
    </dialog>
  );
}
