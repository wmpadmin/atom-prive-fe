import { Button, cn } from "@atomprive/ui";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  FileText,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  SendHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Chart, ink } from "../book/overview-charts";

/**
 * The pieces every role's dashboard is built from: cards in a grid of two, each with its ⋮, an Edit view that
 * ticks cards on and off, and the panels, lists and rings the cards are drawn with. One dashboard per role and
 * no named views, at the firm's request; what a person ticks is kept in their browser.
 */

/** Something waiting, counted: the key says which screen it is worked from. */
export type Waiting = { key: string; label: string; count: number };

/** Where a card sits and what it is called: the side column holds the assistant and shortcuts. */
export type CardMeta = { title: string; area: "main" | "side"; wide?: boolean };

/**
 * The cards on one dashboard, in order, kept in this browser under {@code key}. Whatever is ticked in Edit view
 * is what the dashboard shows from then on; a card the code no longer has is quietly dropped.
 */
export function useDashboardCards<Id extends string>(key: string, ids: readonly Id[], defaults: Id[]) {
  const where = `atomprive.dashboard-cards.v1.${key}`;
  const [cards, setCards] = useState<Id[]>(() => {
    try {
      const found = window.localStorage.getItem(where);
      if (!found) return defaults;
      const parsed: unknown = JSON.parse(found);
      return Array.isArray(parsed) ? [...new Set(parsed.filter((one): one is Id => ids.includes(one as Id)))] : defaults;
    } catch {
      return defaults;
    }
  });
  const change = (next: Id[]) => {
    setCards(next);
    try {
      window.localStorage.setItem(where, JSON.stringify(next));
    } catch {
      // A browser that keeps nothing still shows the change; it lasts until the page is left.
    }
  };
  return { cards, change, changed: cards.join("|") !== defaults.join("|"), reset: () => change(defaults) };
}

/**
 * The cards on screen: two to a row in the main column, read off the column itself rather than the window, and
 * the side column beside it on wide screens. The two in a row are one height; a card that would sit alone takes
 * the whole row, so none is left half empty. Each card gets its own ⋮ to move it or take it off.
 */
export function CardGrid<Id extends string>({ meta, shown, render, editing, onChange }: {
  meta: Record<Id, CardMeta>;
  shown: Id[];
  render: Record<Id, ReactNode>;
  editing: boolean;
  onChange: (cards: Id[]) => void;
}) {
  const inArea = (area: CardMeta["area"]) => shown.filter((id) => meta[id].area === area);
  const nudge = (id: Id, step: -1 | 1) => {
    const mates = inArea(meta[id].area);
    const neighbour = mates[mates.indexOf(id) + step];
    if (!neighbour) return;
    const next = [...shown];
    const from = next.indexOf(id);
    const to = next.indexOf(neighbour);
    next[from] = neighbour;
    next[to] = id;
    onChange(next);
  };
  const main = inArea("main");
  const side = inArea("side");
  const fullRow = useMemo(() => {
    const alone = new Set<Id>();
    let column = 0;
    main.forEach((id, index) => {
      if (meta[id].wide) {
        column = 0;
        return;
      }
      const next = main[index + 1];
      if (column === 0 && (!next || meta[next].wide)) {
        alone.add(id);
        return;
      }
      column = (column + 1) % 2;
    });
    return alone;
  }, [main, meta]);
  const card = (id: Id) => {
    const mates = inArea(meta[id].area);
    const controls: CardControls = {
      title: meta[id].title,
      earlier: mates[0] === id ? undefined : () => nudge(id, -1),
      later: mates[mates.length - 1] === id ? undefined : () => nudge(id, 1),
      remove: () => onChange(shown.filter((one) => one !== id)),
    };
    return (
      <CardContext.Provider key={id} value={controls}>
        <div className={cn("flex min-w-0 flex-col [&>*]:flex-1", (meta[id].wide || fullRow.has(id)) && "@2xl:col-span-2",
          editing && "rounded-2xl outline-2 outline-offset-2 outline-primary-300 outline-dashed")}>
          {render[id]}
        </div>
      </CardContext.Provider>
    );
  };
  if (shown.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
        Nothing on your dashboard. Use Edit view to tick the cards you want.
      </p>
    );
  }
  return (
    <div className={cn("grid gap-5", side.length > 0 && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
      <div className="@container min-w-0">
        <div className="grid gap-5 @2xl:grid-cols-2">{main.map(card)}</div>
      </div>
      {side.length > 0 && <aside className="space-y-5">{side.map(card)}</aside>}
    </div>
  );
}

/** Closes a pop-over when somebody clicks anywhere outside it, or presses Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, close]);
  return box;
}


/** What a card's ⋮ offers, handed down to whichever card is drawn inside it. */
export type CardControls = { earlier?: () => void; later?: () => void; remove: () => void; title: string };

export const CardContext = createContext<CardControls | null>(null);


export function money(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
}


/**
 * Edit view: every card, ticked where it is on the dashboard. Ticking one puts it on straight away and unticking
 * takes it off; nothing waits on a button. Reset puts back the dashboard as the firm set it.
 */
export function EditCards<Id extends string>({ meta, shown, editing, onEditing, onChange, changed, onReset }: {
  meta: Record<Id, CardMeta>;
  shown: Id[];
  editing: boolean;
  onEditing: (editing: boolean) => void;
  onChange: (cards: Id[]) => void;
  changed: boolean;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const close = useCallback(() => onEditing(false), [onEditing]);
  const box = useDismiss(editing, close);
  const listed = (Object.keys(meta) as Id[]).filter((id) => meta[id].title.toLowerCase().includes(query.trim().toLowerCase()));
  const flip = (id: Id) => onChange(shown.includes(id) ? shown.filter((one) => one !== id) : [...shown, id]);
  return (
    <div ref={box} className="relative">
      <Button variant={editing ? "primary" : "secondary"} onClick={() => { setQuery(""); onEditing(!editing); }}
        aria-expanded={editing}>
        <Pencil aria-hidden="true" />
        Edit view
      </Button>
      {editing && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Cards on your dashboard</p>
            <button type="button" aria-label="Close" onClick={close} className="rounded p-1 text-ink-muted hover:bg-slate-100">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-0.5 text-2xs text-ink-muted">Tick to add a card, untick to take it off. Kept in this browser.</p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards…"
              className="w-full rounded-xl border border-line bg-white py-1.5 pr-3 pl-8 text-sm focus:border-primary-400 focus:outline-none" />
          </div>
          <ul className="mt-2 max-h-80 space-y-0.5 overflow-y-auto">
            {listed.map((id) => (
              <li key={id}>
                <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50",
                  shown.includes(id) && "bg-primary-50/60")}>
                  <input type="checkbox" checked={shown.includes(id)} onChange={() => flip(id)}
                    className="size-4 accent-primary-600" />
                  {meta[id].title}
                </label>
              </li>
            ))}
            {listed.length === 0 && <li className="px-2 py-3 text-sm text-ink-muted">No card is called that.</li>}
          </ul>
          <div className="mt-3 flex justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={onReset} disabled={!changed}>
              <RotateCcw aria-hidden="true" />
              Reset to default
            </Button>
            <Button size="sm" onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}


/** A card's ⋮: move it either way, open the screen behind it, or take it off this view. */
export function CardMenu({ to }: { to?: string }) {
  const controls = useContext(CardContext);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const box = useDismiss(open, close);
  if (!controls) return null;
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40 [&_svg]:size-4";
  const act = (run?: () => void) => () => {
    run?.();
    setOpen(false);
  };
  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={`Options for ${controls.title}`} aria-expanded={open} onClick={() => setOpen((now) => !now)}
        className="grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink">
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <button type="button" className={item} onClick={act(controls.earlier)} disabled={!controls.earlier}>
            <ArrowLeft aria-hidden="true" />Move earlier
          </button>
          <button type="button" className={item} onClick={act(controls.later)} disabled={!controls.later}>
            <ArrowRight aria-hidden="true" />Move later
          </button>
          {to && (
            <Link to={to} className={item}>
              <ExternalLink aria-hidden="true" />Open full screen
            </Link>
          )}
          <button type="button" className={cn(item, "text-red-600 hover:bg-red-50")} onClick={act(controls.remove)}>
            <X aria-hidden="true" />Remove from this view
          </button>
        </div>
      )}
    </div>
  );
}


export function Panel({ icon: Icon, title, to, children }: {
  icon: LucideIcon;
  title: string;
  /** Where the whole card leads: its title opens it, and so does "View all" beside it. */
  to?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Icon className="size-4.5 text-primary-600" aria-hidden="true" />
          {to ? <Link to={to} className="hover:text-primary-700 hover:underline">{title}</Link> : title}
        </h2>
        <div className="flex items-center gap-1">
          {to && (
            <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary-700 hover:underline">
              View all
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
          <CardMenu to={to} />
        </div>
      </div>
      <div className="flex-1 px-5 pb-4">{children}</div>
    </section>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-ink-muted">Loading…</p>;
}

export function SoonTag() {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-ink-muted">Coming soon</span>;
}

export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full min-h-32 place-items-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <div>
        <SoonTag />
        <p className="mt-2 text-sm text-ink-muted">{children}</p>
      </div>
    </div>
  );
}


export const SLICE_COLOURS = ["#1d6ee8", "#0f9d8a", "#f2a01c", "#8b5cf6", "#e5484d", "#64748b", "#0ea5e9", "#a3a3a3"];

/** A ring of what makes up a whole, with each part listed beside it. */
export function Breakdown({ rows, centre, centreLabel, currency }: {
  rows: { name: string; value: number; share?: number; apart?: boolean; colour?: string }[];
  centre: string;
  centreLabel: string;
  currency?: string;
}) {
  const ringed = rows.filter((one) => !one.apart);
  const option = useMemo(() => {
    const c = ink();
    return {
      textStyle: { fontFamily: c.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => currency ? money(value, currency) : String(value) },
      series: [{
        type: "pie", radius: ["62%", "88%"], avoidLabelOverlap: true, label: { show: false },
        itemStyle: { borderColor: c.surface, borderWidth: 2 },
        data: ringed.map((one, index) => ({ name: one.name, value: Number(one.value),
          itemStyle: { color: one.colour ?? SLICE_COLOURS[index % SLICE_COLOURS.length] } })),
      }],
    };
  }, [ringed, currency]);
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">Nothing on file yet.</p>;
  }
  return (
    // The ring on the left and what makes it up beside it; one above the other when narrow.
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto w-40 shrink-0 sm:mx-0">
        <Chart option={option} height={160} label={`${centreLabel}: ${ringed.map((one) => `${one.name} ${one.value}`).join(", ")}`} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-2xs text-ink-muted">{centreLabel}</span>
            <span className="block text-sm font-bold tabular-nums">{centre.replace(`${currency ?? ""} `, "")}</span>
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {rows.map((one, index) => (
          <li key={one.name} className={cn("flex items-center gap-2", one.apart && "mt-2 border-t border-line pt-2")}>
            <span className="size-2.5 shrink-0 rounded-full"
              style={{ background: one.apart ? "var(--color-slate-300)" : one.colour ?? SLICE_COLOURS[index % SLICE_COLOURS.length] }} />
            <span className="min-w-0 flex-1 leading-tight">{one.name}</span>
            {one.share !== undefined && <span className="text-xs text-ink-muted tabular-nums">{one.share}%</span>}
            <span className="font-semibold tabular-nums">
              {currency ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(one.value) : one.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}


export function Counts({ rows, linkFor, iconFor = {}, countFirst = false, limit, more }: {
  rows: Waiting[];
  /** The icon each line is drawn with, by its key; a line not named gets a plain document. */
  iconFor?: Record<string, LucideIcon>;
  linkFor: (key: string) => string | undefined;
  /** "21 KYC renewals due" rather than "KYC renewals due … 21", where the number is the point of the line. */
  countFirst?: boolean;
  /** How many lines the card shows: the ones with something waiting first, the rest left to View all. */
  limit?: number;
  /** Where the lines left out are read. */
  more?: string;
}) {
  const ordered = limit === undefined ? rows
    : [...rows.filter((one) => one.count > 0), ...rows.filter((one) => one.count === 0)];
  const shown = limit === undefined ? ordered : ordered.slice(0, limit);
  const left = ordered.length - shown.length;
  return (
    <>
    <ul className="divide-y divide-line text-sm">
      {shown.map((one) => {
        const to = linkFor(one.key);
        const Icon = iconFor[one.key] ?? FileText;
        const count = (
          <span className={cn("font-bold tabular-nums", one.count === 0 && "font-normal text-ink-muted")}>{one.count}</span>
        );
        const inner = (
          <>
            <Icon className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
            {countFirst && count}
            <span className="min-w-0 flex-1 leading-tight">{one.label}</span>
            {!countFirst && count}
            {to && <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />}
          </>
        );
        return (
          <li key={one.label}>
            {to ? <Link to={to} className="flex items-center gap-3 py-2 hover:text-primary-700">{inner}</Link>
              : <div className="flex items-center gap-3 py-2">{inner}</div>}
          </li>
        );
      })}
    </ul>
    {left > 0 && (
      more ? (
        <Link to={more} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
          {left} more in View all
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : <p className="mt-1 text-xs text-ink-muted">{left} more</p>
    )}
    </>
  );
}


export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}


/** A way into the Firm Assistant from here: a suggested question, or one typed, opens it already asked. */
export function AskTheAssistant({ questions, blurb }: { questions: string[]; blurb: string }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const ask = (question: string) => {
    if (!question.trim()) return;
    void navigate(`/assistant?ask=${encodeURIComponent(question.trim())}`);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-500/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">AI Assistant</h2>
          <p className="text-xs text-ink-muted">{blurb}</p>
        </div>
        <CardMenu to="/assistant" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {questions.map((question) => (
          <li key={question}>
            <button type="button" onClick={() => ask(question)}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-left text-xs font-medium hover:border-violet-300">
              {question}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <label htmlFor="dashboard-ask" className="sr-only">Ask the assistant</label>
        <input id="dashboard-ask" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
        <button type="submit" disabled={!draft.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">
          <SendHorizontal className="size-4" aria-hidden="true" />
          <span className="sr-only">Ask</span>
        </button>
      </form>
    </section>
  );
}

/** A row of figures under a ring, each opening the screen it was counted from. */
export function Strip({ figures }: {
  figures: { label: string; value: ReactNode; change?: number | null; danger?: boolean; to?: string }[];
}) {
  return (
    <dl className="grid auto-cols-fr grid-flow-col divide-x divide-line rounded-xl bg-slate-50 px-1 py-2.5">
      {figures.map((one) => {
        const body = (
          <>
            <dt className="text-xs text-ink-muted">{one.label}</dt>
            <dd className={cn("mt-0.5 flex items-baseline gap-1.5 text-lg font-bold tabular-nums", one.danger && "text-red-600")}>
              {one.value}
              {one.change != null && (
                <span className={cn("text-xs font-semibold", one.change < 0 ? "text-red-600" : "text-emerald-600")}>
                  {one.change > 0 ? "+" : ""}{one.change}%
                </span>
              )}
            </dd>
          </>
        );
        return one.to ? (
          <Link key={one.label} to={one.to} className="px-3 hover:[&_dd]:text-primary-700">{body}</Link>
        ) : (
          <div key={one.label} className="px-3">{body}</div>
        );
      })}
    </dl>
  );
}
