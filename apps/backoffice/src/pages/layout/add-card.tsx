import { changeOwnCard, createOwnCard, deleteOwnCard, getGetViewLayoutQueryKey, getListOwnCardsQueryKey, type Breaks } from "@atomprive/api-client/backoffice";
import { Button, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, LayoutList, Move, Plus, RotateCcw, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { INK } from "../portfolios/asset-classes";
import { CardSettingsContext, type Palette } from "./card-settings";
import { CardChartContext, cardChart, KIND_ICON, KIND_LABEL, TRAFFIC, type ChartKind } from "./chart-kinds";
import type { CardChoice, LayoutMeta, ViewLayoutState, Width } from "./custom-view";
import { OWN, OWN_GROUP, POLICY_STEPS, breakPoints, rising, shapeLabel, times, type Figure, type Figures, type OwnCardDraft } from "./own-cards";

/** A card of the reader's own as its step leaves it: what the card is, and where it goes. */
type OwnStepDraft = OwnCardDraft & { width: Width; after: string | null };

/** A card being built in this window and not yet saved. */
const NEW = "new:";

/** The three stages down the window's left side. */
const STAGES = [["cards", "Cards"], ["settings", "Card Settings"], ["summary", "Summary"]] as const;

/**
 * Customize view, as designed on 13 Nov 2026: three stages down the left — Cards, Card Settings, Summary. Cards is the
 * screen's list of cards with a search: a ticked card is on the screen, an unticked one is taken off it, and Add New
 * Card builds one from the screen's own figures. Card Settings takes each ticked card in turn — its chart type,
 * colours, width and place beside the card itself, or for a card of one's own the figure it reports on. Summary lists
 * them all before saving. A card's ⚙ opens on that card alone and changes nothing else.
 */
export function CustomizeDialog<Id extends string>({ view, render, screen, start, onClose, figures }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  /** What the screen is called, for the window's heading. */
  screen: string;
  /** A card to open on, by its ⚙; null to start by choosing cards. */
  start: Id | null;
  onClose: () => void;
  /** The figures this screen offers for cards of the reader's own; Add New Card waits where there are none. */
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
      ? { title: own.title, note: own.note, group: own.group, source: own.source, chart: own.chart, palette: own.palette, breaks: own.breaks, width: view.width(id), after: null }
      : { title: "", note: null, group: null, source: "", chart: "", palette: null, breaks: null, width: "HALF", after: null });
  };
  // A card gone from the screen while the window is open (one just deleted) reads as such rather than breaking it.
  const nameOf = (id: Id) => (isOwn(id) ? draftOf(id).title.trim() || (isNew(id) ? "New card" : view.meta[id]?.title ?? "Deleted card")
    : view.settings(id).title ?? view.meta[id]?.title ?? "Card");
  const offered = figures && Object.keys(figures).length > 0;
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
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [step]);

  const choiceOf = (id: Id) => choices[id] ?? baseline(id);
  const change = (id: Id, next: Partial<CardChoice<Id>>) => setChoices((now) => ({ ...now, [id]: { ...(now[id] ?? baseline(id)), ...next } }));
  const summary = picked.length + 1;
  const go = (next: number) => {
    setStep(next);
    setReached((now) => Math.max(now, next));
  };
  const toggle = (id: Id) => setPicked((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
  const addNew = () => {
    const id = `${NEW}${built + 1}` as Id;
    setBuilt((now) => now + 1);
    setDrafts((now) => ({ ...now, [id]: { title: "", note: null, group: null, source: "", chart: "", palette: null, breaks: null, width: "HALF", after: null } }));
    setPicked((now) => [...now, id]);
    go(picked.length + 1);
  };
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
        const body = { title: draft.title.trim(), note: draft.note?.trim() || null, group: draft.group, source: draft.source, chart: draft.chart,
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
  // An own card is ready with a name, a figure and a type; and, where it is drawn with break points, points in order.
  const ready = (id: Id) => {
    if (!isOwn(id)) return true;
    const draft = draftOf(id);
    const banded = (draft.chart === "gauge" || draft.chart === "number") && draft.breaks;
    return !!draft.title.trim() && !!figures?.[draft.source] && !!draft.chart && (!banded || !!rising(draft.breaks!.points));
  };

  const current = step >= 1 && step <= picked.length ? picked[step - 1]! : null;
  const stage = step === 0 ? "cards" : step === summary ? "summary" : "settings";
  const stageStep = (key: (typeof STAGES)[number][0]) => (key === "cards" ? 0 : key === "summary" ? summary : Math.min(1, summary));
  const iconOf = (id: Id): LucideIcon => {
    const kind = isOwn(id) ? (draftOf(id).chart as ChartKind) : choiceOf(id).chart ?? view.meta[id]?.charts?.[0];
    return (kind && KIND_ICON[kind]) || LayoutList;
  };
  const kindName = (id: Id) => {
    const kind = isOwn(id) ? (draftOf(id).chart as ChartKind) : choiceOf(id).chart ?? view.meta[id]?.charts?.[0];
    return kind ? KIND_LABEL[kind] : "Figures & lists";
  };
  const widthName = (id: Id) => (!isOwn(id) && view.meta[id]?.area === "side" ? "Side panel"
    : (isOwn(id) ? draftOf(id).width : choiceOf(id).width) === "FULL" ? "Full row" : "½ row");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/55" onClick={onClose} aria-hidden="true" />
      <div ref={box} role="dialog" aria-modal="true" aria-label={`Customize view · ${screen}`}
        className="relative flex h-[min(760px,92vh)] w-[min(1080px,96vw)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 px-7 pt-5 pb-4">
          <h2 className="text-xl font-bold">Customize View</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] border-t border-line max-sm:grid-cols-1">
          {/* The three stages: a tick once passed, the current one marked on its right edge. */}
          <nav aria-label="Steps" className="border-r border-line bg-canvas/60 px-4 py-6 max-sm:hidden">
            <ol className="space-y-1">
              {STAGES.map(([key, name], at) => {
                const target = stageStep(key);
                const on = stage === key;
                const done = !on && (key === "cards" ? step > 0 : key === "settings" ? step === summary : false);
                const open = !(only && key === "cards") && target <= reached;
                return (
                  <li key={key}>
                    <button type="button" disabled={!open} onClick={() => go(target)} aria-current={on ? "step" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-lg border-r-2 px-2.5 py-2.5 text-left text-sm",
                        on ? "border-primary-600 bg-primary-50 font-bold text-primary-700" : "border-transparent text-ink-soft enabled:hover:bg-white/70")}>
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-2xs font-bold",
                        on ? "bg-primary-600 text-on-accent" : done ? "border-[1.5px] border-primary-600 text-primary-600" : "bg-slate-200 text-ink-soft")}>
                        {done ? <Check className="size-3.5" aria-hidden="true" /> : at + 1}
                      </span>
                      {name}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
              {step === 0 ? (
                <>
                  <StageHeading title="Step 1: Cards" lead="Select the cards you want to show on this screen." />
                  <div className="relative mb-5">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input data-autofocus aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…"
                      className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-9 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
                  </div>
                  <CardOptions ids={ids} view={view} query={query} picked={picked} nameOf={nameOf} iconOf={iconOf} onToggle={toggle}
                    onAll={(listed, on) => setPicked((now) => (on ? [...now, ...listed.filter((id) => !now.includes(id))] : now.filter((id) => !listed.includes(id))))} />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" size="sm" disabled={!offered} onClick={addNew}
                      title={offered ? "Build a card from this screen's figures" : "Building your own card is not open on this screen yet"}>
                      <Plus aria-hidden="true" />
                      Add New Card
                    </Button>
                    <span className="text-xs text-ink-muted">{picked.length} selected</span>
                  </div>
                </>
              ) : current && isOwn(current) ? (
                <OwnStep key={current} draft={draftOf(current)} figures={figures ?? {}} isNew={isNew(current)} busy={saving}
                  position={`Card ${step} of ${picked.length}`}
                  headings={[...new Set((Object.values(view.meta) as LayoutMeta[]).filter((one) => !one.own && one.group).map((one) => one.group!))]}
                  onChange={(next) => setDrafts((now) => ({ ...now, [current]: { ...draftOf(current), ...next } }))}
                  onDelete={isNew(current) ? undefined : () => remove(current)} />
              ) : current ? (
                <CardStep id={current} view={view} render={render} choice={choiceOf(current)} picked={picked} position={`Card ${step} of ${picked.length}`}
                  onChange={(next) => change(current, next)} nameOf={nameOf} />
              ) : (
                <>
                  <StageHeading title="Review Your Selection" lead="Please review your changes before saving." />
                  <ul className="divide-y divide-line">
                    {picked.map((id, at) => {
                      const Icon = iconOf(id);
                      return (
                        <li key={id} className="grid grid-cols-[2rem_minmax(0,1fr)_9rem_5rem_3rem] items-center gap-3 py-3 max-sm:grid-cols-[2rem_minmax(0,1fr)_3rem]">
                          <CardIcon icon={Icon} />
                          <span className="truncate text-sm font-bold">{nameOf(id)}</span>
                          <span className="text-xs text-ink-soft max-sm:hidden">{kindName(id)}</span>
                          <span className="text-xs text-ink-soft max-sm:hidden">{widthName(id)}</span>
                          <button type="button" onClick={() => go(at + 1)} className="text-right text-xs font-bold text-primary-700 hover:underline">Edit</button>
                        </li>
                      );
                    })}
                    {picked.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">No card selected: the screen will be empty.</li>}
                  </ul>
                  {removed.length > 0 && (
                    <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                      Taken off the screen: <b>{removed.map(nameOf).join(", ")}</b>. Tick them on Cards to bring them back.
                    </p>
                  )}
                  {!only && (
                    <button type="button" onClick={() => { view.reset(); onClose(); }}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 hover:underline">
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Reset to Default
                    </button>
                  )}
                </>
              )}
            </div>

            {problem && <p className="border-t border-red-200 bg-red-50 px-7 py-2 text-sm text-red-800">{problem}</p>}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-7 py-4">
              {step === 0 ? (
                <Button variant="secondary" size="sm" onClick={() => { onClose(); view.begin(); }} title="Drag the cards about on the screen itself">
                  <Move aria-hidden="true" />
                  Rearrange on page
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled={only && step === 1} onClick={() => go(step - 1)}>
                  <ArrowLeft aria-hidden="true" />
                  Back
                </Button>
              )}
              <div className="flex gap-2">
                {step === 0 && <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>}
                {step === summary ? (
                  <Button size="sm" onClick={save} disabled={saving || picked.some((id) => !ready(id))}>{saving ? "Saving…" : "Save View"}</Button>
                ) : (
                  <Button size="sm" disabled={current != null && isOwn(current) && !ready(current)} onClick={() => go(step + 1)}>
                    Next
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageHeading({ title, lead, aside }: { title: string; lead: string; aside?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>
      </div>
      {aside && <span className="shrink-0 pt-1 text-xs text-ink-muted">{aside}</span>}
    </div>
  );
}

/** A card's mark in the lists: the chart it draws, or a list for figures and tables. */
function CardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-7 place-items-center rounded-md bg-primary-50 text-primary-700">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

/** Every card of the screen, grouped, each ticked or not, with whether it is on screen today. */
function CardOptions<Id extends string>({ ids, view, query, picked, nameOf, iconOf, onToggle, onAll }: {
  ids: Id[];
  view: ViewLayoutState<Id>;
  query: string;
  picked: Id[];
  nameOf: (id: Id) => string;
  iconOf: (id: Id) => LucideIcon;
  onToggle: (id: Id) => void;
  /** Ticks every card listed, or unticks them all: the whole screen, or what the search has left. */
  onAll: (listed: Id[], on: boolean) => void;
}) {
  const listed = ids.filter((id) => nameOf(id).toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(listed.map((id) => view.meta[id].group ?? "Cards"))];
  if (listed.length === 0) return <p className="py-3 text-sm text-ink-muted">No card is called that.</p>;
  const ticked = listed.filter((id) => picked.includes(id)).length;
  const all = ticked === listed.length;
  return (
    <div className="space-y-5" role="listbox" aria-multiselectable="true" aria-label="Cards">
      <button type="button" onClick={() => onAll(listed, !all)} aria-pressed={all}
        className="-mb-2 flex w-full items-center gap-3 border-b border-line pb-3 text-left text-sm font-semibold">
        <span className={cn("grid size-[18px] shrink-0 place-items-center rounded border-[1.5px]",
          ticked > 0 ? "border-primary-600 bg-primary-600 text-on-accent" : "border-slate-300")} aria-hidden="true">
          {all ? <Check className="size-3" strokeWidth={3} /> : ticked > 0 && <span className="h-0.5 w-2 rounded bg-current" />}
        </span>
        {query.trim() ? "Select all shown" : "Select all cards"}
        <span className="ml-auto text-xs font-normal text-ink-muted">{ticked} of {listed.length}</span>
      </button>
      {groups.map((group) => (
        <section key={group}>
          <h4 className="mb-1 text-sm font-bold">{group}</h4>
          <div className="divide-y divide-line">
            {listed.filter((id) => (view.meta[id].group ?? "Cards") === group).map((id) => {
              const on = picked.includes(id);
              const shown = view.cards.includes(id);
              return (
                <button key={id} type="button" role="option" aria-selected={on} onClick={() => onToggle(id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-canvas/60">
                  <span className={cn("grid size-[18px] shrink-0 place-items-center rounded border-[1.5px]",
                    on ? "border-primary-600 bg-primary-600 text-on-accent" : "border-slate-300")} aria-hidden="true">
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <CardIcon icon={iconOf(id)} />
                  <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold", shown ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft")}>
                    {shown ? "On Screen" : "Hidden"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The two colour schemes, as dots: the app's own colours, or green, amber and red. */
function PaletteDots({ value, onChange, name }: { value: Palette; onChange: (next: Palette) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {([["theme", "App colours", INK.slice(0, 4)], ["traffic", "Green · amber · red", TRAFFIC]] as [Palette, string, readonly string[]][]).map(([key, label, colours]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} aria-label={label} title={label} onClick={() => onChange(key)}
          className={cn("flex items-center gap-1.5 rounded-full border px-2 py-1.5",
            value === key ? "border-primary-500 ring-2 ring-primary-100" : "border-line hover:border-primary-300")}>
          {colours.map((colour) => <span key={colour} className="size-4 rounded-full" style={{ background: colour }} />)}
        </button>
      ))}
    </div>
  );
}

/** ½ row or full row, side by side. */
function WidthToggle({ value, onChange }: { value: Width; onChange: (next: Width) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Width">
      {([["HALF", "½ Row"], ["FULL", "Full Row"]] as [Width, string][]).map(([key, name]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}
          className={cn("rounded-md px-3.5 py-1.5 text-xs font-semibold", value === key ? "bg-primary-50 text-primary-700 ring-1 ring-primary-300" : "text-ink-soft hover:text-ink")}>
          {name}
        </button>
      ))}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none";

/** One picked card's settings: chart type, colours, width and place, beside the card as they will draw it. */
function CardStep<Id extends string>({ id, view, render, choice, picked, position, onChange, nameOf }: {
  id: Id;
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  choice: CardChoice<Id>;
  picked: Id[];
  position: string;
  onChange: (next: Partial<CardChoice<Id>>) => void;
  nameOf: (id: Id) => string;
}) {
  const meta = view.meta[id];
  const shown = view.cards.includes(id);
  const kinds = meta.charts ?? [];
  const area = meta.area ?? "main";
  const kind = choice.chart ?? kinds[0];
  const KindIcon = kind ? KIND_ICON[kind] : LayoutList;
  // Cards still being built have no place to go after yet: they are not the screen's until saved.
  const places = [...new Set([...view.cards, ...picked])].filter((one) => one !== id && !one.startsWith(NEW) && (view.meta[one]?.area ?? "main") === area);
  // The card as the portal was set up with it: its own name, type, colours and width, in its own place.
  const standard: CardChoice<Id> = { title: meta.title, note: "", chart: null, palette: "theme", width: meta.wide ? "FULL" : "HALF", after: null };
  const changed = choice.title.trim() !== meta.title || choice.note.trim() !== "" || (choice.chart != null && choice.chart !== kinds[0])
    || choice.palette !== "theme" || (area === "main" && choice.width !== standard.width) || choice.after != null;
  const preview = useMemo(() => ({
    title: choice.title.trim() && choice.title.trim() !== meta.title ? choice.title.trim() : null,
    note: choice.note.trim() || null,
    palette: choice.palette,
    chart: choice.chart,
    preview: true,
  }), [choice, meta.title]);
  return (
    <>
      <StageHeading title={nameOf(id)} lead="Configure your card settings" aside={position} />
      <div className="-mt-3 mb-5">
        <button type="button" disabled={!changed} onClick={() => onChange(standard)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 hover:underline disabled:cursor-default disabled:text-ink-muted disabled:no-underline">
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {changed ? "Reset to default" : "As set up · default"}
        </button>
      </div>
      {/* The settings in one row, the card as it will draw beneath them at its full width. */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-5 [&>*]:min-w-48">
          {kinds.length > 0 && (
            <Field label="Chart Type">
              <div className="relative">
                <KindIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-primary-700" aria-hidden="true" />
                <SelectInput data-autofocus value={kind} onChange={(event) => onChange({ chart: event.target.value as ChartKind })} className="pl-9">
                  {kinds.map((one) => <option key={one} value={one}>{KIND_LABEL[one]}</option>)}
                </SelectInput>
              </div>
            </Field>
          )}
          {kinds.some((one) => one !== "tiles" && one !== "table") && (
            <Field label="Colour Scheme">
              <PaletteDots value={choice.palette} onChange={(palette) => onChange({ palette })} name="Colour scheme" />
            </Field>
          )}
          {area === "main" && (
            <Field label="Width">
              <WidthToggle value={choice.width} onChange={(width) => onChange({ width })} />
            </Field>
          )}
          <Field label="Place">
            <SelectInput value={choice.after ?? ""} onChange={(event) => onChange({ after: (event.target.value || null) as Id | null })}>
              <option value="">{shown ? "Keep current place" : "At the end"}</option>
              {places.map((one) => <option key={one} value={one}>After {nameOf(one)}</option>)}
            </SelectInput>
          </Field>
        </div>
        <section aria-label="Preview" className="min-w-0 border-t border-line pt-5">
          <p className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">Preview</p>
          {/* The card works as on the screen — its own buttons switch what it shows — but a click on a figure or a
              link, which would leave the window, is held. */}
          <div className="flex flex-col [&>*]:flex-1" onClickCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("canvas, a, [data-drill]")) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}>
            <CardSettingsContext.Provider value={preview}>
              <CardChartContext.Provider value={kinds.length ? cardChart(view, id) : null}>{render[id]}</CardChartContext.Provider>
            </CardSettingsContext.Provider>
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * A card of the reader's own, built or changed: its name, group and description on the left; on the right which of the
 * screen's figures it reports on, how it is drawn, its break points, colours and width.
 */
/** @param headings the screen's own groups in Cards, any of which the card may be listed under */
function OwnStep({ draft, figures, isNew, busy, position, headings, onChange, onDelete }: {
  draft: OwnStepDraft;
  figures: Figures;
  isNew: boolean;
  busy: boolean;
  position: string;
  headings: string[];
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
    <>
      <StageHeading title={isNew ? "Add New Card" : draft.title || "Your card"}
        lead={isNew ? "Create a custom card using the data from this screen." : "A card of your own, built from this screen's figures."} aside={position} />
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="space-y-5">
          <Field label="Card Name" required>
            <input data-autofocus value={draft.title} maxLength={80} onChange={(event) => onChange({ title: event.target.value })}
              placeholder="What the card is called" className={INPUT} />
          </Field>
          <Field label="Group">
            <SelectInput value={draft.group ?? ""} onChange={(event) => onChange({ group: event.target.value || null })}>
              <option value="">{OWN_GROUP}</option>
              {headings.filter((one) => one !== OWN_GROUP).map((one) => <option key={one} value={one}>{one}</option>)}
            </SelectInput>
          </Field>
          <Field label="Description">
            <textarea value={draft.note ?? ""} maxLength={500} rows={4} onChange={(event) => onChange({ note: event.target.value })}
              placeholder="Shown under its title" className={cn(INPUT, "resize-none")} />
          </Field>
          {onDelete && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
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

        <div className="space-y-5">
          <Field label="What do you want to report on?" required>
            <SelectInput value={draft.source} onChange={(event) => pick(event.target.value)}>
              <option value="">Choose a figure…</option>
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {Object.entries(figures).filter(([, one]) => one.group === group).map(([key, one]) => (
                    <option key={key} value={key}>{one.label} — {shapeLabel(one)}</option>
                  ))}
                </optgroup>
              ))}
            </SelectInput>
          </Field>
          <Field label="How do you want to see it?">
            {figure ? (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How to see it">
                {kinds.map((kind) => {
                  const Icon = KIND_ICON[kind];
                  return (
                    <button key={kind} type="button" role="radio" aria-checked={draft.chart === kind} aria-label={KIND_LABEL[kind]} title={KIND_LABEL[kind]}
                      onClick={() => onChange({ chart: kind, breaks: kind === "gauge" || kind === "number" ? draft.breaks ?? startingBreaks(figure) : draft.breaks })}
                      className={cn("grid size-10 place-items-center rounded-lg border",
                        draft.chart === kind ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100" : "border-line text-ink-soft hover:border-primary-300")}>
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-ink-muted">Choose what it reports on first.</p>}
          </Field>
          {figure && gauge && (
            <Field label="Break Points (optional)">
              <div className="space-y-2.5 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="own-basis" checked={draft.breaks?.basis !== "POLICY"} className="size-4 accent-primary-600"
                      onChange={() => onChange({ breaks: { ...startingBreaks(figure), reversed: draft.breaks?.reversed ?? false } })} />
                    Values I set
                  </label>
                  <label className={cn("flex items-center gap-1.5", !figure.policy && "opacity-40")}>
                    <input type="radio" name="own-basis" disabled={!figure.policy} checked={draft.breaks?.basis === "POLICY"} className="size-4 accent-primary-600"
                      onChange={() => onChange({ breaks: { basis: "POLICY", points: POLICY_STEPS, reversed: draft.breaks?.reversed ?? false } })} />
                    The client's IPS {figure.policy?.label ?? "limit"}
                  </label>
                </div>
                {draft.breaks?.basis === "POLICY" ? (
                  <PolicySteps breaks={draft.breaks} label={figure.policy?.label ?? "limit"}
                    onChange={(steps) => onChange({ breaks: { ...draft.breaks!, points: steps } })} />
                ) : points && (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {points.map((one, at) => (
                        <input key={at} type="number" value={one} aria-label={`Break point ${at + 1}`}
                          onChange={(event) => onChange({ breaks: { ...draft.breaks!, points: points.map((point, index) => (index === at ? Number(event.target.value) : point)) } })}
                          className="w-24 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs tabular-nums" />
                      ))}
                      <SelectInput value={points.length - 1} aria-label="Segments" className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
                        onChange={(event) => onChange({ breaks: { ...draft.breaks!, points: spread(points[0]!, points[points.length - 1]!, Number(event.target.value)) } })}>
                        {[2, 3, 4, 5].map((one) => <option key={one} value={one}>{one} segments</option>)}
                      </SelectInput>
                    </div>
                    {!breakPoints(draft.breaks, figure) && <p className="text-xs text-red-700">Each point must be higher than the one before.</p>}
                  </>
                )}
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={draft.breaks?.reversed ?? false} className="size-4 accent-primary-600"
                    onChange={(event) => onChange({ breaks: { ...(draft.breaks ?? startingBreaks(figure)), reversed: event.target.checked } })} />
                  Reverse Colours
                </label>
              </div>
            </Field>
          )}
          <div className="flex flex-wrap gap-x-8 gap-y-5">
            {(!figure || kinds.some((kind) => kind !== "gauge" && kind !== "number")) && (
              <Field label="Colour Scheme">
                <PaletteDots value={draft.palette === "traffic" ? "traffic" : "theme"} onChange={(palette) => onChange({ palette: palette === "traffic" ? "traffic" : null })} name="Colour scheme" />
              </Field>
            )}
            <Field label="Width">
              <WidthToggle value={draft.width} onChange={(width) => onChange({ width })} />
            </Field>
          </div>
        </div>
      </div>
    </>
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
      <p className="mb-1.5 text-sm font-semibold">{label}{required && <span className="text-red-600"> *</span>}</p>
      {children}
    </div>
  );
}

/** Steps for each number of segments, each keeping the limit itself (1×) as a point. */
const STEPS_BY_SEGMENTS: Record<number, number[]> = { 2: [0, 1, 2], 3: [0, 1, 2, 4], 4: [0, 0.5, 1, 2, 4], 5: [0, 0.5, 1, 1.5, 2, 4] };

/**
 * Where the colours change against the client's own limit, as multiples of it: 1× is the limit itself. The first is
 * where the dial starts and the last where it ends; each client's dial is drawn from their own limit.
 */
function PolicySteps({ breaks, label, onChange }: { breaks: Breaks; label: string; onChange: (steps: number[]) => void }) {
  const steps = breaks.points.map(Number);
  const valid = rising(steps);
  const inner = steps.slice(1, -1);
  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        Segments
        <SelectInput value={steps.length - 1} className="rounded-md border border-line bg-white px-1.5 py-1"
          onChange={(event) => onChange(STEPS_BY_SEGMENTS[Number(event.target.value)]!)}>
          {[2, 3, 4, 5].map((one) => <option key={one} value={one}>{one}</option>)}
        </SelectInput>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((one, at) => (
          <span key={at} className="flex items-center gap-1">
            <input type="number" min={0} step={0.25} value={one} aria-label={`Step ${at + 1}, times the ${label}`}
              onChange={(event) => onChange(steps.map((step, index) => (index === at ? Number(event.target.value) : step)))}
              className="w-16 rounded-md border border-line px-2 py-1 text-xs tabular-nums" />
            <span className="text-xs text-ink-muted">×</span>
          </span>
        ))}
      </div>
      {valid ? (
        <p className="text-xs text-ink-muted">
          Multiples of each client's own {label}: colours change at {inner.map(times).join(", ") || "no point"}; the dial runs from {times(steps[0]!)} to {times(steps[steps.length - 1]!)}.
        </p>
      ) : <p className="text-xs text-red-700">Each step must be higher than the one before.</p>}
    </>
  );
}
