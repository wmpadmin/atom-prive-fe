import { Maximize2, Minimize2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { FigureBody, type FigureDetail } from "../pages/client-workspace/figure-panel";

/** A figure a book-level screen opens: its name over it, and what it is made of. */
export type BookFigure = { name: string; figure: FigureDetail };

const Opener = createContext<((target: BookFigure) => void) | null>(null);

/**
 * Opens the side panel from any screen outside a client's workspace — the book, the directory, the dashboards, the
 * models — with what a figure is made of, read from the screen's own figures. Null where no host is above.
 */
export function useBookPanel() {
  return useContext(Opener);
}

const NARROW = 760;

function widest() {
  return typeof window === "undefined" ? 1200 : Math.max(420, window.innerWidth - 96);
}

/**
 * Gives every screen of the back office the side panel a client's workspace has: on the right, over the screen, with
 * the figure, how it is worked out, the lines behind it and the screen that goes deeper. A new screen shuts it.
 */
export function BookPanelHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<BookFigure | null>(null);
  const show = useCallback((target: BookFigure) => setOpen(target), []);
  const close = useCallback(() => setOpen(null), []);
  const { pathname } = useLocation();

  useEffect(() => close(), [pathname, close]);

  return (
    <Opener.Provider value={show}>
      {children}
      {open && <BookPanel target={open} onClose={close} />}
    </Opener.Provider>
  );
}

function BookPanel({ target, onClose }: { target: BookFigure; onClose: () => void }) {
  const [width, setWidth] = useState(() => Math.min(NARROW, widest()));
  const full = width >= widest() - 4;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-label={`${target.name} breakdown`}
        className="absolute inset-y-0 right-0 flex max-w-full flex-col bg-white shadow-2xl" style={{ width }}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{target.figure.label}</p>
            <h2 className="mt-1 truncate text-xl font-bold">{target.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setWidth(full ? Math.min(NARROW, widest()) : widest())}
              className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label={full ? "Make the panel narrower" : "Fill the screen"} title={full ? "Make narrower" : "Fill the screen"}>
              {full ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FigureBody figure={target.figure} wide={width >= 900} />
        </div>
      </section>
    </div>
  );
}
