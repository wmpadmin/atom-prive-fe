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
import { ArrowLeft, ArrowRight, GripVertical, LayoutGrid as LayoutIcon, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { AddCardDialog } from "./add-card";
import { CardSettingsContext, type CardSettings, type Palette } from "./card-settings";
import type { ChartKind } from "./chart-kinds";

/**
 * A screen made of cards that each member of staff lays out for themselves, the way Autotask's dashboards are: drag a
 * card to move it, make it half the row or all of it, hide it, and put a hidden one back from Add cards. The layout is
 * kept on the server for each person and screen (view-layouts), so it follows them to any browser; Reset puts back
 * the screen as the firm set it.
 *
 * <p>A card that draws a chart may also be switched to another kind of chart that fits its figures; the choice is kept
 * with the layout. Changes made while customizing wait for Done; Cancel throws them away. A card the code no longer has is skipped,
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
  /** The kinds of chart the card can be drawn as, its own look first; none where it draws no chart. */
  charts?: ChartKind[];
};

/**
 * @param chart the kind picked for the card, or null for its own look
 * @param title the reader's own name for it, or null for its own
 * @param note a line of the reader's own under its title, or null for its own
 * @param palette "traffic" for green, amber and red, or null for the app's colours
 */
type Placed<Id extends string> = {
  id: Id;
  width: Width;
  hidden: boolean;
  chart: ChartKind | null;
  title: string | null;
  note: string | null;
  palette: "traffic" | null;
};

/** What Add card sets for one card when it is added or saved. */
export type CardChoice<Id extends string> = {
  title: string;
  note: string;
  chart: ChartKind | null;
  palette: Palette;
  width: Width;
  /** Where a card being added goes: after this card, or at the first free place (the end) when null. */
  after: Id | null;
};

function same<Id extends string>(one: Placed<Id>, other: Placed<Id>) {
  return one.id === other.id && one.width === other.width && one.hidden === other.hidden && one.chart === other.chart
    && one.title === other.title && one.note === other.note && one.palette === other.palette;
}

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
      ...defaults.filter((id) => ids.includes(id)).map((id) => ({ id, width: widthOf(id), hidden: false, chart: null, title: null, note: null, palette: null })),
      ...ids.filter((id) => !defaults.includes(id)).map((id) => ({ id, width: widthOf(id), hidden: true, chart: null, title: null, note: null, palette: null })),
    ],
    [defaults, ids, widthOf],
  );
  const stored = useMemo<Placed<Id>[]>(() => {
    const layout = saved.data;
    if (!layout?.savedAt) return standard;
    const known = layout.cards.filter((one): one is LayoutCard & { id: Id } => ids.includes(one.id as Id))
      .map((one) => ({
        id: one.id as Id, width: meta[one.id as Id]?.area === "side" ? widthOf(one.id as Id) : one.width, hidden: one.hidden,
        // A kind the card no longer offers falls back to its own look.
        chart: meta[one.id as Id]?.charts?.includes(one.chart as ChartKind) ? one.chart as ChartKind : null,
        title: one.title ?? null,
        note: one.note ?? null,
        palette: one.palette === "traffic" ? "traffic" as const : null,
      }));
    // A card the screen gained after the person saved: shown where the default shows it, hidden if the default hides it.
    const added = standard.filter((one) => !known.some((line) => line.id === one.id));
    return [...known, ...added];
  }, [saved.data, standard, ids, meta, widthOf]);

  const [draft, setDraft] = useState<Placed<Id>[] | null>(null);
  /** Add card, open on its first step, or on one card's settings. */
  const [adding, setAdding] = useState<{ card: Id | null } | null>(null);
  const placed = draft ?? stored;
  const editing = draft !== null;

  const persist = (next: Placed<Id>[]) => {
    const isStandard = next.length === standard.length && next.every((one, at) => same(one, standard[at]!));
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
    changed: placed.some((one, at) => !standard[at] || !same(one, standard[at])),
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
        ...cards.map((id) => {
          const was = placed.find((one) => one.id === id);
          return { id, width: was?.width ?? widthOf(id), hidden: false, chart: was?.chart ?? null, title: was?.title ?? null,
            note: was?.note ?? null, palette: was?.palette ?? null };
        }),
        ...placed.filter((one) => !cards.includes(one.id)).map((one) => ({ ...one, hidden: true })),
      ];
      apply(next);
    },
    setWidth: (id: Id, width: Width) => apply(placed.map((one) => (one.id === id ? { ...one, width } : one))),
    /** The kind of chart the card is drawn as: the one picked, or its own look. Null for a card with no chart. */
    chart: (id: Id): ChartKind | null => placed.find((one) => one.id === id)?.chart ?? meta[id]?.charts?.[0] ?? null,
    /** The reader's own name, line and colours for the card, as its card reads them. */
    settings: (id: Id): CardSettings => {
      const one = placed.find((card) => card.id === id);
      return { title: one?.title ?? null, note: one?.note ?? null, palette: one?.palette ?? "theme" };
    },
    /** Add card: open on choosing a card, or on one card's settings. */
    adding,
    openAdd: (card?: Id) => setAdding({ card: card ?? null }),
    closeAdd: () => setAdding(null),
    /**
     * Sets a card as Add card left it, showing it if it was hidden. Anything left as the card has it — its own name,
     * line, look and the app's colours — is kept as no choice at all, so the card follows the firm's if that changes.
     */
    configure: (id: Id, choice: CardChoice<Id>) => {
      const was = placed.find((one) => one.id === id);
      if (!was) return;
      const title = choice.title.trim();
      const note = choice.note.trim();
      const card: Placed<Id> = {
        id,
        width: meta[id]?.area === "side" ? widthOf(id) : choice.width,
        hidden: false,
        chart: choice.chart == null || choice.chart === meta[id]?.charts?.[0] ? null : choice.chart,
        title: title && title !== meta[id]?.title ? title : null,
        note: note || null,
        palette: choice.palette === "traffic" ? "traffic" : null,
      };
      const rest = placed.filter((one) => one.id !== id);
      let at: number;
      if (!was.hidden && choice.after == null) at = placed.indexOf(was);
      else if (choice.after != null && rest.some((one) => one.id === choice.after)) at = rest.findIndex((one) => one.id === choice.after) + 1;
      else at = rest.filter((one) => !one.hidden).length;
      rest.splice(at, 0, card);
      apply(rest);
    },
    /** Draws the card as another kind; its own look is kept as no choice at all. */
    setChart: (id: Id, kind: ChartKind) => {
      const chart = kind === meta[id]?.charts?.[0] ? null : kind;
      apply(placed.map((one) => (one.id === id ? { ...one, chart } : one)));
    },
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
      <LayoutIcon aria-hidden="true" />
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
        <p className="text-xs text-ink-soft">Drag cards to move them, ⚙ to change one, ✕ to hide, Add card to bring one in. Saved to your account, so it follows you to any device.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => view.openAdd()}>
          <Plus aria-hidden="true" />
          Add card
        </Button>
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
  const settings = view.settings(id);
  if (!view.editing) {
    return <div className={className}><CardSettingsContext.Provider value={settings}>{children}</CardSettingsContext.Provider></div>;
  }

  const meta = view.meta[id];
  const name = settings.title ?? meta.title;
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
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{name}</span>
        <button type="button" aria-label={`Settings of ${name}`} title="Card settings" onClick={() => view.openAdd(id)}
          className="rounded p-0.5 text-ink-muted hover:text-ink">
          <Settings2 className="size-3.5" aria-hidden="true" />
        </button>
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
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col select-none [&>*]:flex-1">
        <CardSettingsContext.Provider value={settings}>{children}</CardSettingsContext.Provider>
      </div>
    </div>
  );
}

/**
 * A screen's cards in the reader's order: two to a row, a full-width card taking the row, and a half card with no
 * half beside it stretched across so no row is left half empty. Customizing draws the bar, Add card and each card's
 * frame; outside it the cards are drawn as they are.
 */
export function LayoutGrid<Id extends string>({ view, render, screen }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  /** What the customize bar calls this screen. */
  screen: string;
}) {
  const shown = view.cards;
  const wide = (id: Id) => view.width(id) === "FULL";
  const alone = new Set<Id>();
  let column = 0;
  shown.forEach((id, index) => {
    if (wide(id)) {
      column = 0;
      return;
    }
    const next = shown[index + 1];
    if (column === 0 && (!next || wide(next))) {
      alone.add(id);
      return;
    }
    column = (column + 1) % 2;
  });
  return (
    <div className="space-y-4">
      <CustomizeBar view={view} screen={screen} />
      {view.adding && <AddCardDialog view={view} render={render} screen={screen} start={view.adding.card} onClose={view.closeAdd} />}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          Every card is hidden. Use Customize view to add the cards you want.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((id) => (
            <EditFrame key={id} id={id} view={view}
              className={cn("flex min-w-0 flex-col [&>*:last-child]:flex-1", (wide(id) || alone.has(id)) && "xl:col-span-2")}>
              {render[id]}
            </EditFrame>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A narrow screen's sections one under another, such as a side panel: moved and hidden like cards, with no width.
 * While customizing, the hidden ones are listed at the end to add back, as a drawer would cover the panel.
 */
export function LayoutStack<Id extends string>({ view, render, screen }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  screen: string;
}) {
  return (
    <div className="space-y-6">
      {view.editing && (
        <div className="space-y-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5">
          <p className="text-sm font-bold">Customizing · {screen}</p>
          <p className="text-xs text-ink-soft">Move sections with the arrows or by dragging, ✕ to hide. Saved to your account.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={view.reset} disabled={!view.changed}>
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={view.cancel}>Cancel</Button>
            <Button size="sm" onClick={view.done}>Done</Button>
          </div>
        </div>
      )}
      {view.cards.map((id) => (
        <EditFrame key={id} id={id} view={view}>{render[id]}</EditFrame>
      ))}
      {view.editing && view.hidden.length > 0 && (
        <section className="rounded-xl border border-dashed border-line px-3 py-2.5">
          <p className="mb-1.5 text-2xs font-bold tracking-wider text-ink-muted uppercase">Hidden sections</p>
          <ul className="space-y-1.5">
            {view.hidden.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{view.meta[id].title}</span>
                <button type="button" onClick={() => view.show(id)}
                  className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-2xs font-bold text-primary-700 hover:bg-primary-100">
                  <Plus className="size-3" aria-hidden="true" /> Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!view.editing && view.cards.length === 0 && (
        <p className="text-sm text-ink-muted">Every section is hidden. Use Customize to add them back.</p>
      )}
    </div>
  );
}
