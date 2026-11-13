import { changeOwnCard, createOwnCard, deleteOwnCard, getGetViewLayoutQueryKey, getListOwnCardsQueryKey } from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Move, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CardSettingsContext, type Palette } from "./card-settings";
import { CardChartContext, cardChart, KIND_LABEL, type ChartKind } from "./chart-kinds";
import type { CardChoice, ViewLayoutState, Width } from "./custom-view";
import { OWN, OwnCardView, breakPoints, shapeLabel, type Figure, type Figures, type OwnCardDraft } from "./own-cards";

/** A card of the reader's own as its step leaves it: what the card is, and where it goes. */
type OwnStepDraft = OwnCardDraft & { width: Width; after: string | null };

/** A card being built in this window and not yet saved. */
const NEW = "new:";

/**
 * Customize view as one journey, the way it was drawn on 13 Nov 2026: pick the screen's cards in one dropdown, then
 * each picked card has a step of its own — name, a line under it, chart type, colours, width and place, with the card
 * itself drawn beside the form — and a Summary to check before saving. The dropdown is the screen's list of cards: one
 * left unticked is taken off the screen, as the Summary says. A card's ⚙ opens on that card alone and changes nothing
 * else.
 */
export function CustomizeDialog<Id extends string>({ view, render, screen, start, onClose, figures }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  /** What the screen is called, for the window's heading. */
  screen: string;
  /** A card to open on, by its ⚙; null to start by choosing cards. */
  start: Id | null;
  onClose: () => void;
  /** The figures this screen offers for cards of the reader's own; Add new card waits where there are none. */
  figures?: Figures;
}) {
  const ids = Object.keys(view.meta) as Id[];
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, OwnStepDraft>>({});
  const [built, setBuilt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const isNew = (id: Id) => id.startsWith(NEW);
  const isOwn = (id: Id) => isNew(id) || !!view.meta[id]?.own;
  const draftOf = (id: Id): OwnStepDraft => {
    const own = view.meta[id]?.own;
    return drafts[id] ?? (own
      ? { title: own.title, note: own.note, source: own.source, chart: own.chart, palette: own.palette, breaks: own.breaks, width: view.width(id), after: null }
      : { title: "", note: null, source: "", chart: "", palette: null, breaks: null, width: "HALF", after: null });
  };
  // A card gone from the screen while the window is open (one just deleted) reads as such rather than breaking it.
  const nameOf = (id: Id) => (isOwn(id) ? draftOf(id).title.trim() || (isNew(id) ? "New card" : view.meta[id]?.title ?? "Deleted card")
    : view.settings(id).title ?? view.meta[id]?.title ?? "Card");
  const offered = figures && Object.keys(figures).length > 0;
  const addNew = () => {
    const id = `${NEW}${built + 1}` as Id;
    setBuilt((now) => now + 1);
    setDrafts((now) => ({ ...now, [id]: { title: "", note: null, source: "", chart: "", palette: null, breaks: null, width: "HALF", after: null } }));
    setPicked((now) => [...now, id]);
  };
  const baseline = (id: Id): CardChoice<Id> => {
    const own = view.settings(id);
    return { title: own.title ?? view.meta[id].title, note: own.note ?? "", chart: view.chart(id), palette: own.palette, width: view.width(id), after: null };
  };
  const only = start != null;
  const [picked, setPicked] = useState<Id[]>(() => (start ? [start] : view.cards));
  const [choices, setChoices] = useState<Partial<Record<Id, CardChoice<Id>>>>({});
  const [step, setStep] = useState(only ? 1 : 0);
  const [reached, setReached] = useState(only ? 1 : 0);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-autofocus], input, button")?.focus();
  }, [step]);

  const choiceOf = (id: Id) => choices[id] ?? baseline(id);
  const change = (id: Id, next: Partial<CardChoice<Id>>) => setChoices((now) => ({ ...now, [id]: { ...(now[id] ?? baseline(id)), ...next } }));
  const summary = picked.length + 1;
  const go = (next: number) => {
    setStep(next);
    setReached((now) => Math.max(now, next));
  };
  const toggle = (id: Id) => setPicked((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
  const removed = only ? [] : view.cards.filter((id) => !picked.includes(id));
  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      // The reader's own cards are saved first, so the new ones have their names before they are placed.
      const placedAs = new Map<Id, Id>();
      const choices: Partial<Record<Id, CardChoice<Id>>> = {};
      for (const id of picked) {
        if (!isOwn(id)) {
          choices[id] = choiceOf(id);
          continue;
        }
        const draft = draftOf(id);
        const body = { title: draft.title.trim(), note: draft.note?.trim() || null, source: draft.source, chart: draft.chart,
          palette: draft.palette, breaks: draft.chart === "gauge" || draft.chart === "number" ? draft.breaks : null };
        let layoutId = id;
        if (isNew(id)) {
          const card = await createOwnCard(view.screenKey, body);
          layoutId = `${OWN}${card.id}` as Id;
        } else if (drafts[id]) {
          await changeOwnCard(view.screenKey, view.meta[id].own!.id, body);
        }
        placedAs.set(id, layoutId);
        choices[layoutId] = { title: "", note: "", chart: null, palette: "theme", width: draft.width, after: draft.after as Id | null };
      }
      view.arrange(picked.map((id) => placedAs.get(id) ?? id), choices, only);
      await queryClient.invalidateQueries({ queryKey: getListOwnCardsQueryKey(view.screenKey) });
      onClose();
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "Your view could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: Id) => {
    const own = view.meta[id]?.own;
    if (!own) return;
    setSaving(true);
    try {
      await deleteOwnCard(view.screenKey, own.id);
      // Closed before the cards are read again, so the window never holds a card the screen no longer has.
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListOwnCardsQueryKey(view.screenKey) }),
        queryClient.invalidateQueries({ queryKey: getGetViewLayoutQueryKey(view.screenKey) }),
      ]);
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "The card could not be deleted.");
    } finally {
      setSaving(false);
    }
  };
  const ready = (id: Id) => !isOwn(id) || (!!draftOf(id).title.trim() && !!figures?.[draftOf(id).source] && !!draftOf(id).chart);

  const current = step >= 1 && step <= picked.length ? picked[step - 1]! : null;
  const steps = [
    ...(only ? [] : [{ at: 0, name: "Cards" }]),
    ...picked.map((id, at) => ({ at: at + 1, name: nameOf(id) })),
    { at: summary, name: "Summary" },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-hidden="true" />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Customize view"
        className="relative flex h-[min(920px,94vh)] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Customize view</h2>
            <p className="text-xs text-ink-muted">
              {current ? `Card ${step} of ${picked.length} · ${nameOf(current)}` : step === summary ? "Summary · check before saving" : `${screen} · your own layout, for every client`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {/* Where the journey stands: a step for the cards, one for each card picked, and the summary. */}
        <nav aria-label="Steps" className="flex flex-wrap gap-1.5 border-b border-line px-6 py-2.5">
          {steps.map((one, at) => {
            const on = one.at === step;
            const done = one.at < step || (one.at <= reached && one.at !== step);
            return (
              <button key={`${one.at}-${one.name}`} type="button" disabled={one.at > reached} onClick={() => go(one.at)} aria-current={on ? "step" : undefined}
                className={cn("inline-flex max-w-56 items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-bold",
                  on ? "border-primary-600 bg-primary-600 text-on-accent"
                    : done ? "border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
                    : "border-line text-ink-muted disabled:opacity-70")}>
                <span className="truncate">{at + 1} {one.name}</span>
                {done && !on && <Check className="size-3 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 0 ? (
            <div className="px-6 py-5">
              <p className="mb-1.5 text-sm font-bold">Which cards do you want on this screen?</p>
              {/* One multi-select: ticked cards as chips above the list, every card below, grouped, with a search. */}
              <div className="rounded-xl border-[1.5px] border-primary-500 ring-2 ring-primary-100">
                <button type="button" onClick={() => setListOpen((now) => !now)} aria-expanded={listOpen} data-autofocus
                  className="flex min-h-11 w-full flex-wrap items-center gap-1.5 px-2.5 py-2 text-left">
                  {picked.length === 0 && <span className="text-sm text-ink-muted">Choose cards…</span>}
                  {picked.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                      {nameOf(id)}
                      <span role="button" tabIndex={0} aria-label={`Untick ${nameOf(id)}`}
                        onClick={(event) => { event.stopPropagation(); toggle(id); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggle(id); } }}
                        className="rounded-full hover:text-red-600">
                        <X className="size-3" aria-hidden="true" />
                      </span>
                    </span>
                  ))}
                  <ChevronDown className={cn("ml-auto size-4 text-ink-muted transition", listOpen && "rotate-180")} aria-hidden="true" />
                </button>
                {listOpen && (
                  <div className="border-t border-line">
                    <div className="relative border-b border-line">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                      <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…"
                        className="w-full bg-transparent py-2 pr-3 pl-9 text-sm focus:outline-none" />
                    </div>
                    <CardOptions ids={ids} view={view} query={query} picked={picked} nameOf={nameOf} onToggle={toggle} />
                    {offered ? (
                      <button type="button" onClick={addNew}
                        className="flex w-full items-start gap-2 border-t border-line bg-primary-50/40 px-3 py-2.5 text-left text-sm font-bold text-primary-700 hover:bg-primary-50">
                        <Plus className="mt-0.5 size-4" aria-hidden="true" />
                        <span>
                          Add new card
                          <span className="block text-xs font-normal text-ink-soft">Build one from this screen's figures. Click again for another.</span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-bold text-primary-700/60"
                        title="Building a card from your own choice of figures is not open on this screen yet">
                        <Plus className="size-4" aria-hidden="true" />
                        Add new card
                        <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-3xs font-bold text-ink-soft">Coming next</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {picked.length} selected · each gets its own step next. A hidden card you tick is added; an on-screen card is
                changed; an on-screen card you untick is taken off the screen.
              </p>
            </div>
          ) : current && isOwn(current) ? (
            <OwnStep key={current} draft={draftOf(current)} figures={figures ?? {}} isNew={isNew(current)} busy={saving}
              places={[...new Set([...view.cards, ...picked])].filter((one) => one !== current && !isNew(one)).map((one) => [one, nameOf(one)] as [string, string])}
              onChange={(next) => setDrafts((now) => ({ ...now, [current]: { ...draftOf(current), ...next } }))}
              onDelete={isNew(current) ? undefined : () => remove(current)} />
          ) : current ? (
            <CardStep id={current} view={view} render={render} choice={choiceOf(current)} picked={picked}
              onChange={(next) => change(current, next)} nameOf={nameOf} />
          ) : (
            <div className="space-y-4 px-6 py-5">
              <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {picked.map((id, at) => {
                  if (isOwn(id)) {
                    const draft = draftOf(id);
                    const figure = figures?.[draft.source];
                    return (
                      <li key={id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                        <span className="grid size-6 place-items-center rounded-full bg-primary-50 text-2xs font-bold text-primary-700">{at + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{nameOf(id)}</p>
                          <p className="text-xs text-ink-muted">
                            Your card · {figure?.label ?? "no figure picked"} · {KIND_LABEL[draft.chart as ChartKind] ?? "—"} · {draft.width === "FULL" ? "Full row" : "½ row"}
                            {" · "}
                            <b className={cn("font-semibold", isNew(id) ? "text-emerald-700" : drafts[id] ? "text-primary-700" : "text-ink-muted")}>
                              {isNew(id) ? "new" : drafts[id] ? "changed" : view.cards.includes(id) ? "unchanged" : "added"}
                            </b>
                          </p>
                        </div>
                        <button type="button" onClick={() => go(at + 1)} className="text-xs font-bold text-primary-700 hover:underline">Edit</button>
                      </li>
                    );
                  }
                  const choice = choiceOf(id);
                  const before = baseline(id);
                  const shown = view.cards.includes(id);
                  const edited = JSON.stringify(choice) !== JSON.stringify(before);
                  const kind = choice.chart ?? view.meta[id].charts?.[0] ?? null;
                  return (
                    <li key={id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                      <span className="grid size-6 place-items-center rounded-full bg-primary-50 text-2xs font-bold text-primary-700">{at + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{choice.title.trim() || view.meta[id].title}</p>
                        <p className="text-xs text-ink-muted">
                          {choice.title.trim() && choice.title.trim() !== view.meta[id].title && `${view.meta[id].title} · `}
                          {kind ? KIND_LABEL[kind] : "Figures and lists"} · {choice.width === "FULL" ? "Full row" : "½ row"}
                          {choice.palette === "traffic" && " · green, amber, red"}
                          {" · "}
                          <b className={cn("font-semibold", !shown ? "text-emerald-700" : edited ? "text-primary-700" : "text-ink-muted")}>
                            {!shown ? "added" : edited ? "changed" : "unchanged"}
                          </b>
                        </p>
                      </div>
                      <button type="button" onClick={() => go(at + 1)} className="text-xs font-bold text-primary-700 hover:underline">Edit</button>
                    </li>
                  );
                })}
                {picked.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">No card picked: the screen will be empty.</li>}
              </ol>
              {removed.length > 0 && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                  Not picked, so taken off the screen: <b>{removed.map(nameOf).join(", ")}</b>. They stay in the dropdown to bring back.
                </p>
              )}
              <p className="text-xs text-ink-soft">
                Saved to your account and used for every client. To move cards about, use <b>Rearrange on the page</b> on the first
                step; <b>Reset to default</b> brings back the firm's own cards.
              </p>
            </div>
          )}
        </div>

        {problem && <p className="border-t border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">{problem}</p>}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3.5">
          {step === 0 ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="secondary" size="sm" onClick={() => { onClose(); view.begin(); }}>
                <Move aria-hidden="true" />
                Rearrange on the page
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" disabled={only && step === 1} onClick={() => go(step - 1)}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
          )}
          <div className="flex gap-2">
            {step < summary && step > 0 && step < picked.length && (
              <Button variant="secondary" size="sm" onClick={() => go(summary)}>Skip to summary</Button>
            )}
            {step === summary ? (
              <>
                {!only && <Button variant="secondary" size="sm" onClick={() => { view.reset(); onClose(); }}>Reset to default</Button>}
                <Button size="sm" onClick={save} disabled={saving || picked.some((id) => !ready(id))}>{saving ? "Saving…" : "Save view"}</Button>
              </>
            ) : (
              <Button size="sm" disabled={current != null && (isOwn(current) ? !ready(current) : !choiceOf(current).title.trim())} onClick={() => go(step + 1)}>
                {step === 0 ? (picked.length ? `Next · ${picked.length} card${picked.length === 1 ? "" : "s"}` : "Next · Summary")
                  : step < picked.length ? `Next · ${nameOf(picked[step]!)}` : "Next · Summary"}
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

/** The dropdown's list: every card of the screen, grouped, each ticked or not, with whether it is on screen today. */
function CardOptions<Id extends string>({ ids, view, query, picked, nameOf, onToggle }: {
  ids: Id[];
  view: ViewLayoutState<Id>;
  query: string;
  picked: Id[];
  nameOf: (id: Id) => string;
  onToggle: (id: Id) => void;
}) {
  const listed = ids.filter((id) => nameOf(id).toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(listed.map((id) => view.meta[id].group ?? "Cards"))];
  if (listed.length === 0) return <p className="px-3 py-3 text-sm text-ink-muted">No card is called that.</p>;
  return (
    <div className="max-h-[52vh] overflow-y-auto py-1" role="listbox" aria-multiselectable="true" aria-label="Cards">
      {groups.map((group) => (
        <div key={group}>
          <p className="px-3 pt-2 pb-1 text-3xs font-bold tracking-wider text-ink-muted uppercase">{group}</p>
          {listed.filter((id) => (view.meta[id].group ?? "Cards") === group).map((id) => {
            const on = picked.includes(id);
            const shown = view.cards.includes(id);
            return (
              <button key={id} type="button" role="option" aria-selected={on} onClick={() => onToggle(id)}
                className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm", on ? "bg-primary-50/60" : "hover:bg-canvas")}>
                <span className={cn("grid size-4 shrink-0 place-items-center rounded border-[1.5px]", on ? "border-primary-600 bg-primary-600 text-on-accent" : "border-slate-400")} aria-hidden="true">
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-3xs font-bold", shown ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft")}>
                  {shown ? "On screen" : "Hidden"}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** One picked card's own step: its settings beside the card as they will draw it. */
function CardStep<Id extends string>({ id, view, render, choice, picked, onChange, nameOf }: {
  id: Id;
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  choice: CardChoice<Id>;
  picked: Id[];
  onChange: (next: Partial<CardChoice<Id>>) => void;
  nameOf: (id: Id) => string;
}) {
  const meta = view.meta[id];
  const shown = view.cards.includes(id);
  const kinds = meta.charts ?? [];
  const area = meta.area ?? "main";
  // Cards still being built have no place to go after yet: they are not the screen's until saved.
  const places = [...new Set([...view.cards, ...picked])].filter((one) => one !== id && !one.startsWith(NEW) && (view.meta[one]?.area ?? "main") === area);
  const preview = useMemo(() => ({
    title: choice.title.trim() && choice.title.trim() !== meta.title ? choice.title.trim() : null,
    note: choice.note.trim() || null,
    palette: choice.palette,
    chart: choice.chart,
  }), [choice, meta.title]);
  return (
    <div className="grid gap-5 px-6 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h3 className="text-sm font-bold">General</h3>
          <span className="text-2xs text-ink-muted">{shown ? "On screen today · will be changed" : "Hidden today · will be added"}</span>
        </div>
        <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-2">
          <Field label="Card name" required>
            <input value={choice.title} maxLength={80} data-autofocus onChange={(event) => onChange({ title: event.target.value })} placeholder={meta.title}
              className="w-full rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
          </Field>
          <Field label="Place">
            <select value={choice.after ?? ""} onChange={(event) => onChange({ after: (event.target.value || null) as Id | null })}
              className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm">
              <option value="">{shown ? "Keep its place" : "At the end"}</option>
              {places.map((one) => <option key={one} value={one}>After {nameOf(one)}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea value={choice.note} maxLength={500} rows={2} onChange={(event) => onChange({ note: event.target.value })}
                placeholder="What this card is for (shown under its title)"
                className="w-full resize-none rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
            </Field>
            <p className="text-right text-3xs text-ink-muted">{choice.note.length} / 500</p>
          </div>
          <div className="sm:col-span-2">
            <Field label="Visualization type">
              {kinds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Visualization type">
                  {kinds.map((kind) => {
                    const on = (choice.chart ?? kinds[0]) === kind;
                    return (
                      <button key={kind} type="button" role="radio" aria-checked={on} onClick={() => onChange({ chart: kind })}
                        className={cn("rounded-lg border-[1.5px] px-2.5 py-1 text-xs font-bold",
                          on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line text-ink-soft hover:border-primary-300")}>
                        {KIND_LABEL[kind]}
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-ink-muted">This card shows figures and lists, not a chart.</p>}
            </Field>
          </div>
          {kinds.length > 0 && (
            <Field label="Colour scheme">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {([["theme", "App"], ["traffic", "Green · amber · red"]] as [Palette, string][]).map(([key, name]) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input type="radio" name={`palette-${id}`} checked={choice.palette === key} onChange={() => onChange({ palette: key })} className="size-4 accent-primary-600" />
                    {name}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {area === "main" && (
            <Field label="Width">
              <div className="flex gap-4 text-sm">
                {([["HALF", "½ row"], ["FULL", "Full row"]] as [Width, string][]).map(([key, name]) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input type="radio" name={`width-${id}`} checked={choice.width === key} onChange={() => onChange({ width: key })} className="size-4 accent-primary-600" />
                    {name}
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>
      </section>
      <section aria-label="Preview" className="min-w-0">
        <p className="mb-2 text-2xs font-bold tracking-wider text-ink-muted uppercase">Preview</p>
        <div className="pointer-events-none flex flex-col select-none [&>*]:flex-1">
          <CardSettingsContext.Provider value={preview}>
            <CardChartContext.Provider value={kinds.length ? cardChart(view, id) : null}>{render[id]}</CardChartContext.Provider>
          </CardSettingsContext.Provider>
        </div>
      </section>
    </div>
  );
}

/**
 * A card of the reader's own, built or changed: its name, which of the screen's figures it reports on, how it is
 * drawn, and for a gauge where its colours change — beside the card as it will draw for the client in view.
 */
function OwnStep({ draft, figures, isNew, busy, places, onChange, onDelete }: {
  draft: OwnStepDraft;
  figures: Figures;
  isNew: boolean;
  busy: boolean;
  places: [string, string][];
  onChange: (next: Partial<OwnStepDraft>) => void;
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const figure: Figure | undefined = figures[draft.source];
  const groups = [...new Set(Object.values(figures).map((one) => one.group))];
  const kinds = figure?.kinds ?? [];
  // A gauge's dial and a number's colour both follow the break points.
  const gauge = draft.chart === "gauge" || draft.chart === "number";
  const points = draft.breaks?.basis === "VALUES" ? draft.breaks.points : null;
  const pick = (source: string) => {
    const next = figures[source];
    if (!next) return onChange({ source });
    onChange({ source, chart: next.kinds.includes(draft.chart as ChartKind) ? draft.chart : next.kinds[0]!, breaks: next.kinds[0] === "gauge" ? startingBreaks(next) : null });
  };
  return (
    <div className="grid gap-5 px-6 py-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="rounded-xl border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-bold">General</h3>
            <span className="text-2xs text-ink-muted">{isNew ? "New card · yours alone" : "Your card"}</span>
          </div>
          <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-2">
            <Field label="Card name" required>
              <input value={draft.title} maxLength={80} data-autofocus onChange={(event) => onChange({ title: event.target.value })}
                placeholder="What the card is called"
                className="w-full rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
            </Field>
            <Field label="Group">
              <p className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink-soft">Your own cards</p>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea value={draft.note ?? ""} maxLength={500} rows={2} onChange={(event) => onChange({ note: event.target.value })}
                  placeholder="Shown under its title"
                  className="w-full resize-none rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
              </Field>
            </div>
            <Field label="Width">
              <div className="flex gap-4 text-sm">
                {([["HALF", "½ row"], ["FULL", "Full row"]] as [Width, string][]).map(([key, name]) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input type="radio" name="own-width" checked={draft.width === key} onChange={() => onChange({ width: key })} className="size-4 accent-primary-600" />
                    {name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Place">
              <select value={draft.after ?? ""} onChange={(event) => onChange({ after: event.target.value || null })}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm">
                <option value="">{isNew ? "At the end" : "Keep its place"}</option>
                {places.map(([id, name]) => <option key={id} value={id}>After {name}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-line">
          <div className="border-b border-line px-4 py-2.5"><h3 className="text-sm font-bold">What it shows</h3></div>
          <div className="grid gap-4 px-4 py-3.5">
            <Field label="What do you want to report on?" required>
              <select value={draft.source} onChange={(event) => pick(event.target.value)}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm">
                <option value="">Choose a figure…</option>
                {groups.map((group) => (
                  <optgroup key={group} label={group}>
                    {Object.entries(figures).filter(([, one]) => one.group === group).map(([key, one]) => (
                      <option key={key} value={key}>{one.label} — {shapeLabel(one)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {figure && (
              <Field label="How do you want to see it?">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How to see it">
                  {kinds.map((kind) => (
                    <button key={kind} type="button" role="radio" aria-checked={draft.chart === kind}
                      onClick={() => onChange({ chart: kind, breaks: kind === "gauge" || kind === "number" ? draft.breaks ?? startingBreaks(figure) : draft.breaks })}
                      className={cn("rounded-lg border-[1.5px] px-2.5 py-1 text-xs font-bold",
                        draft.chart === kind ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line text-ink-soft hover:border-primary-300")}>
                      {KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {figure && kinds.some((kind) => kind !== "gauge" && kind !== "number") && (
              <Field label="Colour scheme">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                  {([[null, "App"], ["traffic", "Green · amber · red"]] as [string | null, string][]).map(([key, name]) => (
                    <label key={name} className="flex items-center gap-1.5">
                      <input type="radio" name="own-palette" checked={(draft.palette ?? null) === key} onChange={() => onChange({ palette: key })} className="size-4 accent-primary-600" />
                      {name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {figure && gauge && (
              <Field label="Break points">
                <div className="space-y-2.5 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="own-basis" checked={draft.breaks?.basis !== "POLICY"} className="size-4 accent-primary-600"
                        onChange={() => onChange({ breaks: { ...startingBreaks(figure), reversed: draft.breaks?.reversed ?? false } })} />
                      Values I set
                    </label>
                    <label className={cn("flex items-center gap-1.5", !figure.policy && "opacity-40")}>
                      <input type="radio" name="own-basis" disabled={!figure.policy} checked={draft.breaks?.basis === "POLICY"} className="size-4 accent-primary-600"
                        onChange={() => onChange({ breaks: { basis: "POLICY", points: [0, 1, 2, 4], reversed: draft.breaks?.reversed ?? false } })} />
                      The client's IPS {figure.policy?.label ?? "limit"}
                    </label>
                  </div>
                  {draft.breaks?.basis === "POLICY" ? (
                    <p className="text-xs text-ink-muted">Red below the client's limit, amber up to twice it, green beyond: each client's own limit.</p>
                  ) : points && (
                    <>
                      <div className="flex items-center gap-2 text-xs">
                        Segments
                        <select value={points.length - 1} className="rounded-md border border-line bg-white px-1.5 py-1"
                          onChange={(event) => onChange({ breaks: { ...draft.breaks!, points: spread(points[0]!, points[points.length - 1]!, Number(event.target.value)) } })}>
                          {[2, 3, 4, 5].map((one) => <option key={one} value={one}>{one}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {points.map((one, at) => (
                          <input key={at} type="number" value={one} aria-label={`Break point ${at + 1}`}
                            onChange={(event) => onChange({ breaks: { ...draft.breaks!, points: points.map((point, index) => (index === at ? Number(event.target.value) : point)) } })}
                            className="w-20 rounded-md border border-line px-2 py-1 text-xs tabular-nums" />
                        ))}
                      </div>
                      {!breakPoints(draft.breaks, figure) && <p className="text-xs text-red-700">Each point must be higher than the one before.</p>}
                    </>
                  )}
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={draft.breaks?.reversed ?? false} className="size-4 accent-primary-600"
                      onChange={(event) => onChange({ breaks: { ...(draft.breaks ?? startingBreaks(figure)), reversed: event.target.checked } })} />
                    Reverse colours (high is bad)
                  </label>
                </div>
              </Field>
            )}
          </div>
        </section>
        {onDelete && (
          <div className="flex items-center gap-2 text-sm">
            {confirming ? (
              <>
                <span className="text-red-800">Delete this card for good? It cannot be brought back.</span>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
                <Button size="sm" disabled={busy} onClick={onDelete} className="bg-red-600 hover:bg-red-700">Delete card</Button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-xs font-bold text-red-700 hover:underline">Delete card</button>
            )}
          </div>
        )}
      </div>
      <section aria-label="Preview" className="min-w-0">
        <p className="mb-2 text-2xs font-bold tracking-wider text-ink-muted uppercase">Preview</p>
        {figure ? <OwnCardView card={draft} figure={figure} /> : (
          <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">Choose what it reports on to see it here.</p>
        )}
        <p className="mt-2 text-2xs text-ink-muted">Drawn from the client in view. Only figures this screen already reads are offered, so nothing new is calculated.</p>
      </section>
    </div>
  );
}

/** Where a new gauge's colours change to start with: around the figure for the client in view. */
function startingBreaks(figure: Figure) {
  if (figure.policy) return { basis: "POLICY", points: [0, 1, 2, 4], reversed: false };
  const value = figure.data?.shape === "gauge" ? Math.abs(figure.data.value) : 100;
  const top = niceCeiling(Math.max(value * 1.5, 1));
  return { basis: "VALUES", points: spread(0, top, 3), reversed: false };
}

function spread(from: number, to: number, segments: number) {
  return Array.from({ length: segments + 1 }, (_, at) => Math.round((from + ((to - from) * at) / segments) * 100) / 100);
}

function niceCeiling(value: number) {
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-ink-soft">{label}{required && <span className="text-red-600"> *</span>}</p>
      {children}
    </div>
  );
}
