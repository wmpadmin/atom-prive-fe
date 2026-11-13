import { Button, cn } from "@atomprive/ui";
import { ArrowLeft, ChevronRight, LayoutList, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CardSettingsContext, type Palette } from "./card-settings";
import { KIND_ICON, KIND_LABEL } from "./chart-kinds";
import type { CardChoice, ViewLayoutState, Width } from "./custom-view";

/**
 * Add card, the way Autotask's Add Widget works, in two steps: choose one of the screen's cards, then set it up — its
 * name, a line under it, its chart type, colours, width and place — with the card itself drawn beside the form as it
 * will look. A card already on screen opens on its settings to be changed; nothing is ever added twice.
 */
export function AddCardDialog<Id extends string>({ view, render, screen, start, onClose }: {
  view: ViewLayoutState<Id>;
  render: Record<Id, ReactNode>;
  /** What the screen is called, for the window's heading. */
  screen: string;
  /** A card to open on, at its settings; null to start by choosing one. */
  start: Id | null;
  onClose: () => void;
}) {
  const ids = Object.keys(view.meta) as Id[];
  const choiceFor = (id: Id): CardChoice<Id> => {
    const own = view.settings(id);
    return { title: own.title ?? view.meta[id].title, note: own.note ?? "", chart: view.chart(id), palette: own.palette, width: view.width(id), after: null };
  };
  const [step, setStep] = useState<1 | 2>(start ? 2 : 1);
  const [chosen, setChosen] = useState<Id | null>(start);
  const [choice, setChoice] = useState<CardChoice<Id> | null>(() => (start ? choiceFor(start) : null));
  const [query, setQuery] = useState("");
  const [which, setWhich] = useState<"all" | "hidden" | "shown">("all");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    box.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const pick = (id: Id) => {
    setChosen(id);
    setChoice(choiceFor(id));
  };
  const change = (next: Partial<CardChoice<Id>>) => setChoice((now) => (now ? { ...now, ...next } : now));
  const meta = chosen ? view.meta[chosen] : null;
  const onScreen = chosen != null && view.cards.includes(chosen);
  const save = () => {
    if (!chosen || !choice) return;
    view.configure(chosen, choice);
    onClose();
  };

  const listed = ids.filter((id) => {
    const shown = view.cards.includes(id);
    if (which === "hidden" && shown) return false;
    if (which === "shown" && !shown) return false;
    const name = view.settings(id).title ?? view.meta[id].title;
    return name.toLowerCase().includes(query.trim().toLowerCase());
  });
  const groups = [...new Set(listed.map((id) => view.meta[id].group ?? "Cards"))];
  const preview = useMemo(() => (chosen && choice ? {
    title: choice.title.trim() && choice.title.trim() !== view.meta[chosen].title ? choice.title.trim() : null,
    note: choice.note.trim() || null,
    palette: choice.palette,
    chart: choice.chart,
  } : null), [chosen, choice, view.meta]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-hidden="true" />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Add card"
        className="relative flex h-[min(920px,92vh)] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{step === 2 && onScreen ? "Card settings" : "Add card"}</h2>
            <p className="text-xs text-ink-muted">{screen} · your own layout, for every client</p>
          </div>
          <div className="flex items-center gap-5">
            <ol className="hidden items-center gap-2 text-xs font-bold sm:flex" aria-label="Steps">
              {(["Choose card", "Settings"] as const).map((name, at) => (
                <li key={name} className={cn("flex items-center gap-1.5", step === at + 1 ? "text-primary-700" : "text-ink-muted")}>
                  {at > 0 && <span className="mr-1 h-px w-6 bg-line" aria-hidden="true" />}
                  <span className={cn("grid size-5 place-items-center rounded-full border text-2xs",
                    step === at + 1 ? "border-primary-600 bg-primary-600 text-on-accent" : "border-line")}>{at + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-0 space-y-4 overflow-y-auto border-line px-6 py-5 md:border-r">
            {step === 1 ? (
              <>
                <Section title="Which card?" aside={`${ids.length} cards on this screen · ${view.cards.length} showing`}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…"
                      className="w-full rounded-lg border border-line py-2 pr-3 pl-8 text-sm focus:border-primary-400 focus:outline-none" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
                    {([["all", "All"], ["hidden", `Hidden only (${view.hidden.length})`], ["shown", `On screen (${view.cards.length})`]] as const).map(([id, name]) => (
                      <button key={id} type="button" aria-pressed={which === id} onClick={() => setWhich(id)}
                        className={cn("rounded-full border px-3 py-1 text-xs font-semibold",
                          which === id ? "border-primary-200 bg-primary-50 text-primary-700" : "border-line text-ink-soft hover:text-ink")}>{name}</button>
                    ))}
                  </div>
                  {groups.map((group) => (
                    <div key={group} className="mt-3">
                      <p className="mb-1.5 text-3xs font-bold tracking-wider text-ink-muted uppercase">{group}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {listed.filter((id) => (view.meta[id].group ?? "Cards") === group).map((id) => {
                          const kinds = view.meta[id].charts ?? [];
                          const kind = view.chart(id);
                          const Icon = kind ? KIND_ICON[kind] : LayoutList;
                          const shown = view.cards.includes(id);
                          return (
                            <button key={id} type="button" onClick={() => pick(id)} aria-pressed={chosen === id}
                              className={cn("flex items-center gap-2.5 rounded-xl border-[1.5px] px-2.5 py-2 text-left",
                                chosen === id ? "border-primary-500 bg-primary-50/60 ring-2 ring-primary-100" : "border-line hover:border-primary-300")}>
                              <span className={cn("size-4 shrink-0 rounded-full border-[1.5px]", chosen === id ? "border-[5px] border-primary-600" : "border-slate-400")} aria-hidden="true" />
                              <span className="grid h-8 w-11 shrink-0 place-items-center rounded-lg border border-line bg-canvas">
                                <Icon className="size-4 text-primary-600" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{view.settings(id).title ?? view.meta[id].title}</span>
                                <span className="block text-2xs text-ink-muted">
                                  {kind ? `${KIND_LABEL[kind]}${kinds.length > 1 ? ` · ${kinds.length} types` : ""}` : "Figures and lists"}
                                </span>
                              </span>
                              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-3xs font-bold",
                                shown ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft")}>{shown ? "On screen" : "Hidden"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {listed.length === 0 && <p className="mt-3 text-sm text-ink-muted">No card is called that.</p>}
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-primary-200 px-3 py-2.5 text-sm font-semibold text-primary-700/60"
                    title="Building a card from your own choice of figures comes next">
                    <span className="size-4 rounded-full border-[1.5px] border-primary-200" aria-hidden="true" />
                    + New card · build your own from this screen's figures
                    <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-3xs font-bold text-ink-soft">Coming next</span>
                  </div>
                </Section>

                {chosen && choice && (
                  <Section title="Placement">
                    {onScreen ? (
                      <p className="text-sm text-ink-soft">This card is already on screen. <b>Next</b> opens its settings to change it; it keeps its place unless you move it.</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={choice.after == null} onChange={() => change({ after: null })} className="size-4 accent-primary-600" />
                          Add to the first free place on the screen
                        </label>
                        <WidthChoice show={meta?.area !== "side"} value={choice.width} onChange={(width) => change({ width })} />
                        <Field label="Or put it after">
                          <select value={choice.after ?? ""} onChange={(event) => change({ after: (event.target.value || null) as Id | null })}
                            className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm">
                            <option value="">Choose a card…</option>
                            {view.cards.filter((id) => (view.meta[id].area ?? "main") === (meta?.area ?? "main")).map((id) => (
                              <option key={id} value={id}>{view.settings(id).title ?? view.meta[id].title}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                  </Section>
                )}
              </>
            ) : chosen && choice && meta ? (
              <>
                <Section title="General" aside={`Screen: ${screen}`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Card name" required>
                      <input value={choice.title} maxLength={80} onChange={(event) => change({ title: event.target.value })} placeholder={meta.title}
                        className="w-full rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
                    </Field>
                    <Field label="Group in Add card">
                      <p className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink-soft">{meta.group ?? "Cards"}</p>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Description">
                        <textarea value={choice.note} maxLength={500} rows={2} onChange={(event) => change({ note: event.target.value })}
                          placeholder="What this card is for (shown under its title)"
                          className="w-full resize-none rounded-lg border border-line px-2.5 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
                      </Field>
                      <p className="text-right text-3xs text-ink-muted">{choice.note.length} / 500</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Visualization type">
                        {(meta.charts?.length ?? 0) > 0 ? (
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" role="radiogroup" aria-label="Visualization type">
                            {meta.charts!.map((kind) => {
                              const Icon = KIND_ICON[kind];
                              const on = (choice.chart ?? meta.charts![0]) === kind;
                              return (
                                <button key={kind} type="button" role="radio" aria-checked={on} onClick={() => change({ chart: kind })}
                                  className={cn("flex flex-col items-center gap-1 rounded-xl border-[1.5px] px-1 py-2 text-2xs font-bold",
                                    on ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100" : "border-line text-ink-soft hover:border-primary-300")}>
                                  <Icon className={cn("size-5", on ? "text-primary-600" : "text-ink-muted")} aria-hidden="true" />
                                  {KIND_LABEL[kind]}
                                </button>
                              );
                            })}
                          </div>
                        ) : <p className="text-sm text-ink-muted">This card shows figures and lists, not a chart.</p>}
                      </Field>
                    </div>
                    {(meta.charts?.length ?? 0) > 0 && (
                      <Field label="Colour scheme">
                        <div className="space-y-1.5 text-sm">
                          {([["theme", "App theme"], ["traffic", "Green, amber, red"]] as [Palette, string][]).map(([id, name]) => (
                            <label key={id} className="flex items-center gap-2">
                              <input type="radio" name="palette" checked={choice.palette === id} onChange={() => change({ palette: id })} className="size-4 accent-primary-600" />
                              {name}
                              {id === "traffic" && (
                                <span className="flex gap-0.5" aria-hidden="true">
                                  <i className="h-2 w-3 rounded-xs bg-emerald-600" /><i className="h-2 w-3 rounded-xs bg-amber-500" /><i className="h-2 w-3 rounded-xs bg-red-600" />
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </Field>
                    )}
                    <WidthChoice show={meta.area !== "side"} value={choice.width} onChange={(width) => change({ width })} />
                  </div>
                </Section>
                <Section title="What it shows">
                  <p className="text-sm text-ink-soft">
                    The figures of <b className="text-ink">{meta.title}</b>, as this screen reads them for each client
                    {(meta.charts?.length ?? 0) > 0 && <>, drawn as <b className="text-ink">{KIND_LABEL[choice.chart ?? meta.charts![0]!]}</b></>}.
                    Choosing your own figures for a card comes with <b className="text-ink">New card</b>.
                  </p>
                </Section>
              </>
            ) : null}
          </div>

          <aside className="hidden min-h-0 overflow-y-auto bg-canvas/60 px-5 py-5 md:block" aria-label="Preview">
            <p className="mb-2.5 text-2xs font-bold tracking-wider text-ink-muted uppercase">Preview</p>
            {chosen && preview ? (
              <>
                <div className="pointer-events-none flex flex-col select-none [&>*]:flex-1">
                  <CardSettingsContext.Provider value={preview}>{render[chosen]}</CardSettingsContext.Provider>
                </div>
                <dl className="mt-3 space-y-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-xs">
                  <Fact name="Shown as" value={choice?.chart ? KIND_LABEL[choice.chart] : "Figures and lists"} />
                  {(meta?.charts?.length ?? 0) > 1 && <Fact name="Can switch to" value={meta!.charts!.filter((kind) => kind !== choice?.chart).map((kind) => KIND_LABEL[kind]).join(" · ")} />}
                  <Fact name="Group" value={meta?.group ?? "Cards"} />
                  <Fact name="On screen" value={onScreen ? "Yes" : "Not yet"} />
                </dl>
              </>
            ) : <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">Choose a card to see it here.</p>}
          </aside>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-3.5">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {step === 1 ? (
              <>
                {chosen && !onScreen && <Button variant="secondary" size="sm" onClick={save}>Add as it is</Button>}
                <Button size="sm" disabled={!chosen} onClick={() => setStep(2)}>
                  Next · Settings
                  <ChevronRight aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                {!start && (
                  <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
                    <ArrowLeft aria-hidden="true" />
                    Previous
                  </Button>
                )}
                <Button size="sm" disabled={!choice?.title.trim()} onClick={save}>{onScreen ? "Save card" : "Add card"}</Button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-bold">{title}</h3>
        {aside && <span className="text-2xs text-ink-muted">{aside}</span>}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </section>
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

function WidthChoice({ show, value, onChange }: { show: boolean; value: Width; onChange: (width: Width) => void }) {
  if (!show) return null;
  return (
    <Field label="Width">
      <div className="flex gap-4 text-sm">
        {([["HALF", "½ row"], ["FULL", "Full row"]] as [Width, string][]).map(([id, name]) => (
          <label key={id} className="flex items-center gap-2">
            <input type="radio" name="width" checked={value === id} onChange={() => onChange(id)} className="size-4 accent-primary-600" />
            {name}
          </label>
        ))}
      </div>
    </Field>
  );
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{name}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
