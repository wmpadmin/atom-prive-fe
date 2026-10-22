import { Button, TextInput, cn } from "@atomprive/ui";
import { BookmarkCheck, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The arrangements a reader has kept for one table, and the way to keep another.
 *
 * <p>Separate from the Columns list beside it, because they answer different questions. That one is
 * "what is in front of me"; this one is "which of the ways I read this table am I in". A reader who
 * works a Monday call off one arrangement and a drift review off another is not changing their mind
 * about columns — they are moving between two jobs.
 *
 * <p>What is on screen is kept whether or not it has a name. Naming it is for coming back to it, not
 * for keeping it, so nothing is ever lost by not pressing anything here.
 */
export function ViewPicker({
  views,
  current,
  changed,
  onApply,
  onSave,
  onDelete,
}: {
  views: { name: string }[];
  /** The view on screen, where it came from one. */
  current: string | null;
  /** Whether it has been rearranged since. */
  changed: boolean;
  onApply: (name: string) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent
        ? event.key === "Escape"
        : !box.current?.contains(event.target as Node)) {
        setOpen(false);
        setNaming(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", away);
    };
  }, [open]);

  function keep() {
    const asked = name.trim();
    if (asked === "") return;
    onSave(asked);
    setName("");
    setNaming(false);
  }

  return (
    <div ref={box} className="relative">
      <Button variant="secondary" aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((was) => !was)}>
        <BookmarkCheck aria-hidden="true" />
        {current ?? "Views"}
        {/* Said rather than drawn as a dot: a reader who has rearranged a saved view needs to know the
            name at the top is no longer what is in front of them. */}
        {current && changed && <span className="text-xs font-medium text-ink-muted">edited</span>}
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <p className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Saved views
          </p>

          {views.length === 0 ? (
            <p className="px-3 pb-2 text-xs text-ink-muted">
              None yet. Arrange the table, then keep it under a name.
            </p>
          ) : (
            <ul>
              {views.map((view) => (
                <li key={view.name} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => { onApply(view.name); setOpen(false); }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
                      {view.name === current && <Check className="size-3.5 text-primary-600" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete the view ${view.name}`}
                    onClick={() => onDelete(view.name)}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1 border-t border-line pt-1.5">
            {naming ? (
              <div className="flex items-center gap-1.5 px-1.5 pb-1">
                <TextInput
                  // Drawn only once naming has begun, so taking the caret is answering the press rather
                  // than snatching it from somewhere else on the screen.
                  autoFocus
                  value={name}
                  placeholder="Name this arrangement"
                  aria-label="Name this arrangement"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); keep(); }
                    if (event.key === "Escape") { event.stopPropagation(); setNaming(false); }
                  }}
                />
                <Button size="sm" onClick={keep} disabled={name.trim() === ""}>Save</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setNaming(true); setName(current && changed ? current : ""); }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold",
                  "text-primary-600 hover:bg-slate-50")}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                {current && changed ? `Save over "${current}", or under a new name` : "Save this arrangement"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
