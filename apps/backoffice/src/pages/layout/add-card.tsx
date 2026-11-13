import { Button, cn } from "@atomprive/ui";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Move, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CardSettingsContext, type Palette } from "./card-settings";
import { CardChartContext, cardChart, KIND_LABEL } from "./chart-kinds";
import type { CardChoice, ViewLayoutState, Width } from "./custom-view";

/**
 * Customize view as one journey, the way it was drawn on 13 Nov 2026: pick the screen's cards in one dropdown, then
 * each picked card has a step of its own — name, a line under it, chart type, colours, width and place, with the card
 * itself drawn beside the form — and a Summary to check before saving. The dropdown is the screen's list of cards: one
 * left unticked is taken off the screen, as the Summary says. A card's ⚙ opens on that card alone and changes nothing
 * else.
 */
export function CustomizeDialog<Id extends string>({ view, render, screen, start, onClose }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  /** What the screen is called, for the window's heading. */
  screen: string;
  /** A card to open on, by its ⚙; null to start by choosing cards. */
  start: Id | null;
  onClose: () => void;
}) {
  const ids = Object.keys(view.meta) as Id[];
  const nameOf = (id: Id) => view.settings(id).title ?? view.meta[id].title;
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
  const save = () => {
    // Every card picked is saved as it stands, its step opened or skipped.
    view.arrange(picked, Object.fromEntries(picked.map((id) => [id, choiceOf(id)])) as Record<Id, CardChoice<Id>>, only);
    onClose();
  };

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
                    <div className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-bold text-primary-700/60"
                      title="Building a card from your own choice of figures comes next">
                      <Plus className="size-4" aria-hidden="true" />
                      Add new card
                      <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-3xs font-bold text-ink-soft">Coming next</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {picked.length} selected · each gets its own step next. A hidden card you tick is added; an on-screen card is
                changed; an on-screen card you untick is taken off the screen.
              </p>
            </div>
          ) : current ? (
            <CardStep id={current} view={view} render={render} choice={choiceOf(current)} picked={picked}
              onChange={(next) => change(current, next)} nameOf={nameOf} />
          ) : (
            <div className="space-y-4 px-6 py-5">
              <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {picked.map((id, at) => {
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
                <Button size="sm" onClick={save}>Save view</Button>
              </>
            ) : (
              <Button size="sm" disabled={current != null && !choiceOf(current).title.trim()} onClick={() => go(step + 1)}>
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
  const places = [...new Set([...view.cards, ...picked])].filter((one) => one !== id && (view.meta[one].area ?? "main") === area);
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

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-ink-soft">{label}{required && <span className="text-red-600"> *</span>}</p>
      {children}
    </div>
  );
}
