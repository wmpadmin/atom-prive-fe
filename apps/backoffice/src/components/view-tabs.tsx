import { Button, TextInput, cn } from "@atomprive/ui";
import { Plus, Table2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * One arrangement, as a tab.
 *
 * <p>Declared here rather than inside the strip below. A component made during a render is a new
 * component every render, so React tears the old one down and builds this again — which throws away
 * anything inside it, the caret included.
 */
function Tab({ of, label, current, edited, onPick, onDelete }: {
  of: string | null;
  label: string;
  current: string | null;
  edited: boolean;
  onPick: (name: string | null) => void;
  onDelete: (name: string) => void;
}) {
  const here = of === current;
  return (
    <div className={cn(
      "flex items-center rounded-lg",
      here ? "border border-line bg-white shadow-xs" : "border border-transparent",
    )}>
      <button
        type="button"
        aria-current={here ? "true" : undefined}
        onClick={() => onPick(of)}
        className={cn(
          "flex items-center gap-2 rounded-lg py-1.5 pl-3 text-sm whitespace-nowrap",
          of === null || !here ? "pr-3" : "pr-1.5",
          here ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
        )}
      >
        <Table2 aria-hidden="true" className="size-3.5 opacity-60" />
        {label}
        {/* Only on the tab it is true of. A reader who has rearranged what is in front of them needs to
            know the name above it has stopped describing it. */}
        {here && edited && <span className="text-xs font-normal text-ink-muted">edited</span>}
      </button>
      {here && of !== null && (
        <button
          type="button"
          aria-label={`Delete the view ${label}`}
          onClick={() => onDelete(of)}
          className="mr-1.5 grid size-5 shrink-0 place-items-center rounded text-ink-muted hover:bg-red-50 hover:text-red-600"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * The arrangements a reader keeps for one table, along the top of it.
 *
 * <p>Tabs rather than a list behind a button, because these are not settings — they are the ways this
 * reader reads this table, and which one they are in is the first thing they need to know. Behind a
 * button it is a thing to go and check; along the top it is simply true.
 *
 * <p>The first tab is the table as the firm wrote it, and it cannot be deleted: a reader who has made a
 * mess of every arrangement they own needs one that is not theirs to go back to.
 */
export function ViewTabs({
  views,
  current,
  edited,
  onPick,
  onSave,
  onDelete,
}: {
  views: { name: string }[];
  /** The saved view on screen, or nothing where it is the firm's own. */
  current: string | null;
  /** Whether what is on screen has been changed from whichever tab is lit. */
  edited: boolean;
  /** Null picks the firm's own arrangement. */
  onPick: (name: string | null) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!naming) return;
    const away = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent
        ? event.key === "Escape"
        : !box.current?.contains(event.target as Node)) {
        setNaming(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", away);
    };
  }, [naming]);

  function keep() {
    const asked = name.trim();
    if (asked === "") return;
    onSave(asked);
    setName("");
    setNaming(false);
  }

  return (
    <div ref={box} className="relative flex flex-wrap items-center gap-1">
      <Tab of={null} label="All clients"
        current={current} edited={edited} onPick={onPick} onDelete={onDelete} />
      {views.map((view) => (
        <Tab key={view.name} of={view.name} label={view.name}
          current={current} edited={edited} onPick={onPick} onDelete={onDelete} />
      ))}

      <button
        type="button"
        aria-label="Save this arrangement as a view"
        aria-expanded={naming}
        onClick={() => { setNaming((was) => !was); setName(""); }}
        className="grid size-7 place-items-center rounded-lg border border-line text-ink-muted hover:bg-slate-50 hover:text-ink"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>

      {naming && (
        <div className="absolute top-full left-0 z-20 mt-1 w-80 rounded-xl border border-line bg-white p-3 shadow-lg">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">New view</p>
          <p className="mt-1 text-xs text-ink-muted">
            Keeps the table as it stands now — the order of the columns and the ones taken off.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <TextInput
              // Drawn only once this opens, so taking the caret answers the press rather than snatching
              // it from somewhere else on the screen.
              autoFocus
              value={name}
              placeholder="Name it"
              aria-label="Name this view"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); keep(); }
                if (event.key === "Escape") { event.stopPropagation(); setNaming(false); }
              }}
            />
            <Button size="sm" onClick={keep} disabled={name.trim() === ""}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
