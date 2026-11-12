import { ApiError } from "@atomprive/api-client";
import {
  getGetViewLayoutQueryKey,
  useGetViewLayout,
  useResetViewLayout,
  useSaveViewLayout,
  type LayoutCard,
  type ViewLayout,
} from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, GripVertical, LayoutGrid, Plus, RotateCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

/**
 * A screen made of cards that each member of staff lays out for themselves, the way Autotask's dashboards are: drag a
 * card to move it, make it half the row or all of it, hide it, and put a hidden one back from Add cards. The layout is
 * kept on the server for each person and screen (view-layouts), so it follows them to any browser; Reset puts back
 * the screen as the firm set it.
 *
 * <p>Changes made while customizing wait for Done; Cancel throws them away. A card the code no longer has is skipped,
 * and one it gained since the person saved shows where the firm's default puts it.
 */

export type Width = LayoutCard["width"];

/** What the customize mode needs to know of each card: its name, its group in Add cards, and where it may sit. */
export type LayoutMeta = {
  title: string;
  /** The heading it is listed under in Add cards. */
  group?: string;
  /** Full width unless the person makes it half. */
  wide?: boolean;
  /** A card down the side column moves only among the side cards and has no width of its own. */
  area?: "main" | "side";
};

type Placed<Id extends string> = { id: Id; width: Width; hidden: boolean };

export type ViewLayoutState<Id extends string> = ReturnType<typeof useViewLayout<Id>>;

/** One screen's layout for the reader, with the customize session it is changed through. */
export function useViewLayout<Id extends string>(key: string, meta: Record<Id, LayoutMeta>, defaults: Id[]) {
  const ids = useMemo(() => Object.keys(meta) as Id[], [meta]);
  const queryClient = useQueryClient();
  const saved = useGetViewLayout<ViewLayout, ApiError>(key, { query: { staleTime: 5 * 60_000 } });
  const save = useSaveViewLayout<ApiError>();
  const reset = useResetViewLayout<ApiError>();

  const widthOf = useCallback((id: Id): Width => (meta[id]?.wide ? "FULL" : "HALF"), [meta]);
  const standard = useMemo<Placed<Id>[]>(
    () => [
      ...defaults.filter((id) => ids.includes(id)).map((id) => ({ id, width: widthOf(id), hidden: false })),
      ...ids.filter((id) => !defaults.includes(id)).map((id) => ({ id, width: widthOf(id), hidden: true })),
    ],
    [defaults, ids, widthOf],
  );
  const stored = useMemo<Placed<Id>[]>(() => {
    const layout = saved.data;
    if (!layout?.savedAt) return standard;
    const known = layout.cards.filter((one): one is LayoutCard & { id: Id } => ids.includes(one.id as Id))
      .map((one) => ({ id: one.id as Id, width: meta[one.id as Id]?.area === "side" ? widthOf(one.id as Id) : one.width, hidden: one.hidden }));
    // A card the screen gained after the person saved: shown where the default shows it, hidden if the default hides it.
    const added = standard.filter((one) => !known.some((line) => line.id === one.id));
    return [...known, ...added];
  }, [saved.data, standard, ids, meta, widthOf]);

  const [draft, setDraft] = useState<Placed<Id>[] | null>(null);
  const placed = draft ?? stored;
  const editing = draft !== null;

  const persist = (next: Placed<Id>[]) => {
    const isStandard = next.length === standard.length && next.every((one, at) => {
      const other = standard[at]!;
      return other.id === one.id && other.width === one.width && other.hidden === one.hidden;
    });
    const done = (layout: ViewLayout) => queryClient.setQueryData(getGetViewLayoutQueryKey(key), layout);
    if (isStandard) {
      reset.mutate({ key }, { onSuccess: () => done({ key, cards: [], savedAt: null }) });
    } else {
      save.mutate({ key, data: { cards: next } }, { onSuccess: done });
    }
  };
  /** Outside customize mode a card's ⋮ changes the layout straight away; inside it, the change waits for Done. */
  const apply = (next: Placed<Id>[]) => (editing ? setDraft(next) : persist(next));

  const shown = placed.filter((one) => !one.hidden).map((one) => one.id);
  return {
    key,
    meta,
    /** The cards on screen, in order. */
    cards: shown,
    hidden: placed.filter((one) => one.hidden).map((one) => one.id),
    width: (id: Id) => placed.find((one) => one.id === id)?.width ?? widthOf(id),
    editing,
    saving: save.isPending || reset.isPending,
    error: save.error?.message ?? reset.error?.message ?? null,
    /** Whether the layout differs from the firm's default. */
    changed: placed.some((one, at) => {
      const other = standard[at];
      return !other || other.id !== one.id || other.width !== one.width || other.hidden !== one.hidden;
    }),
    begin: () => setDraft(stored),
    cancel: () => setDraft(null),
    done: () => {
      if (draft) persist(draft);
      setDraft(null);
    },
    reset: () => (editing ? setDraft(standard) : persist(standard)),
    /** The shown cards in a new order (or fewer of them); a card left out is hidden, keeping its place among the rest. */
    change: (cards: Id[]) => {
      const next = [
        ...cards.map((id) => ({ id, width: placed.find((one) => one.id === id)?.width ?? widthOf(id), hidden: false })),
        ...placed.filter((one) => !cards.includes(one.id)).map((one) => ({ ...one, hidden: true })),
      ];
      apply(next);
    },
    setWidth: (id: Id, width: Width) => apply(placed.map((one) => (one.id === id ? { ...one, width } : one))),
    hide: (id: Id) => apply(placed.map((one) => (one.id === id ? { ...one, hidden: true } : one))),
    /** Puts a hidden card back at the end of its area. */
    show: (id: Id) => {
      const card = placed.find((one) => one.id === id);
      if (!card) return;
      apply([...placed.filter((one) => one.id !== id && !one.hidden), { ...card, hidden: false }, ...placed.filter((one) => one.id !== id && one.hidden)]);
    },
    /** Moves a card to just before (or after) another of the same area. */
    move: (id: Id, target: Id, after: boolean) => {
      if (id === target) return;
      const card = placed.find((one) => one.id === id);
      if (!card) return;
      const rest = placed.filter((one) => one.id !== id);
      const at = rest.findIndex((one) => one.id === target);
      rest.splice(after ? at + 1 : at, 0, card);
      apply(rest);
    },
  };
}

/** The button that starts customizing, and while customizing, nothing: the bar takes over. */
export function CustomizeButton<Id extends string>({ view }: { view: ViewLayoutState<Id> }) {
  if (view.editing) return null;
  return (
    <Button variant="secondary" onClick={view.begin}>
      <LayoutGrid aria-hidden="true" />
      Customize view
    </Button>
  );
}

/** The bar across the screen while customizing: what can be done, and Reset, Cancel and Done. */
export function CustomizeBar<Id extends string>({ view, screen }: { view: ViewLayoutState<Id>; screen: string }) {
  if (!view.editing && !view.error) return null;
  if (!view.editing) {
    return <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">Your layout could not be saved: {view.error}</p>;
  }
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-bold">Customizing your view · {screen}</p>
        <p className="text-xs text-ink-soft">Drag cards to move them, pick ½ or Full width, ✕ to hide. Saved to your account, so it follows you to any device.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={view.reset} disabled={!view.changed}>
          <RotateCcw aria-hidden="true" />
          Reset to default
        </Button>
        <Button variant="secondary" size="sm" onClick={view.cancel}>Cancel</Button>
        <Button size="sm" onClick={view.done}>Done</Button>
      </div>
    </div>
  );
}

/** Every card the reader can have on this screen, grouped, with the hidden ones ready to add back. */
export function CardLibrary<Id extends string>({ view }: { view: ViewLayoutState<Id> }) {
  const [query, setQuery] = useState("");
  if (!view.editing) return null;
  const ids = Object.keys(view.meta) as Id[];
  const listed = ids.filter((id) => view.meta[id].title.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(listed.map((id) => view.meta[id].group ?? "Cards"))];
  return (
    <aside aria-label="Add cards"
      className="fixed inset-y-0 right-0 z-40 flex w-80 max-w-[90vw] flex-col border-l border-line bg-white shadow-2xl">
      <div className="border-b border-line px-4 pt-4 pb-3">
        <p className="text-base font-bold">Add cards</p>
        <p className="text-xs text-ink-muted">Every card you can have here. Hidden ones wait in this list.</p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…"
            className="w-full rounded-xl border border-line bg-white py-1.5 pr-3 pl-8 text-sm focus:border-primary-400 focus:outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {groups.map((group) => (
          <section key={group} className="mb-3">
            <h3 className="mb-1.5 text-3xs font-bold tracking-wider text-ink-muted uppercase">{group}</h3>
            <ul className="space-y-1.5">
              {listed.filter((id) => (view.meta[id].group ?? "Cards") === group).map((id) => {
                const on = view.cards.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{view.meta[id].title}</span>
                    {on ? (
                      <span className="text-2xs font-semibold text-emerald-700">On screen</span>
                    ) : (
                      <button type="button" onClick={() => view.show(id)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-2xs font-bold text-primary-700 hover:bg-primary-100">
                        <Plus className="size-3" aria-hidden="true" /> Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {listed.length === 0 && <p className="py-3 text-sm text-ink-muted">No card is called that.</p>}
      </div>
    </aside>
  );
}

/** Which card is being dragged, shared by every frame on the screen. */
let dragging: string | null = null;

/**
 * One card while customizing: a dashed frame with its handle, width and ✕ above it, dragged by the handle onto another
 * card of the same area to land before or after it. Outside customize mode it draws the card alone.
 */
export function EditFrame<Id extends string>({ id, view, className, children }: {
  id: Id;
  view: ViewLayoutState<Id>;
  className?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState<"before" | "after" | null>(null);
  const [grabbed, setGrabbed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!view.editing) setOver(null);
  }, [view.editing]);
  if (!view.editing) return <div className={className}>{children}</div>;

  const meta = view.meta[id];
  const area = meta.area ?? "main";
  const mates = view.cards.filter((one) => (view.meta[one].area ?? "main") === area);
  const at = mates.indexOf(id);
  const side = (event: DragEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return "before" as const;
    const wideRow = rect.width > rect.height * 1.6;
    return (wideRow ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2) ? "after" as const : "before" as const;
  };
  const sameArea = () => dragging != null && dragging !== id && (view.meta[dragging as Id]?.area ?? "main") === area;

  return (
    <div ref={box} className={cn("relative flex min-w-0 flex-col rounded-2xl outline-2 outline-offset-2 outline-primary-300 outline-dashed", className,
      grabbed && "opacity-50",
      over === "before" && "shadow-[-6px_0_0_0_var(--color-primary-500)]",
      over === "after" && "shadow-[6px_0_0_0_var(--color-primary-500)]")}
      draggable={grabbed}
      onDragStart={(event) => {
        dragging = id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      }}
      onDragEnd={() => {
        dragging = null;
        setGrabbed(false);
      }}
      onDragOver={(event) => {
        if (!sameArea()) return;
        event.preventDefault();
        setOver(side(event));
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(event) => {
        event.preventDefault();
        if (sameArea()) view.move(dragging as Id, id, side(event) === "after");
        setOver(null);
      }}>
      <div className="mb-1.5 flex items-center gap-1.5 rounded-xl bg-primary-50 px-2 py-1">
        <button type="button" aria-label={`Drag ${meta.title} to move it`} title="Drag to move"
          onMouseDown={() => setGrabbed(true)} onMouseUp={() => setGrabbed(false)}
          className="cursor-grab rounded p-0.5 text-ink-muted hover:text-ink active:cursor-grabbing">
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{meta.title}</span>
        <button type="button" aria-label={`Move ${meta.title} earlier`} disabled={at <= 0}
          onClick={() => view.move(id, mates[at - 1]!, false)} className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Move ${meta.title} later`} disabled={at < 0 || at >= mates.length - 1}
          onClick={() => view.move(id, mates[at + 1]!, true)} className="rounded p-0.5 text-ink-muted hover:text-ink disabled:opacity-30">
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
        {area === "main" && (
          <span className="flex rounded-md bg-white p-0.5 ring-1 ring-line" role="group" aria-label={`Width of ${meta.title}`}>
            {(["HALF", "FULL"] as const).map((width) => (
              <button key={width} type="button" aria-pressed={view.width(id) === width} onClick={() => view.setWidth(id, width)}
                className={cn("rounded px-1.5 text-2xs font-bold", view.width(id) === width ? "bg-primary-600 text-on-accent" : "text-ink-muted hover:text-ink")}>
                {width === "HALF" ? "½" : "Full"}
              </button>
            ))}
          </span>
        )}
        <button type="button" aria-label={`Hide ${meta.title}`} onClick={() => view.hide(id)}
          className="rounded p-0.5 text-ink-muted hover:bg-red-50 hover:text-red-600">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col select-none [&>*]:flex-1">{children}</div>
    </div>
  );
}
