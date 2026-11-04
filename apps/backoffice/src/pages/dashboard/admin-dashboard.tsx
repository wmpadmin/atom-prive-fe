import { ApiError } from "@atomprive/api-client";
import {
  useGetDashboard,
  useGetFirmDashboard,
  useListCurrencies,
  type ClassSlice,
  type Currency,
  type Dashboard,
  type FirmDashboard,
  type ManagerAum,
  type Waiting,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Gem,
  HeartPulse,
  Landmark,
  Layers,
  LifeBuoy,
  Link2,
  ListChecks,
  Mail,
  MoreVertical,
  Pencil,
  PieChart,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative, roleLabel } from "../../lib/labels";
import { menuFor } from "../../menu";
import { Chart, ink } from "../book/overview-charts";

/**
 * The Admin's dashboard: the firm's money and clients across the top, then everything waiting on somebody,
 * with the assistant and the Admin's own shortcuts down the side.
 *
 * <p>Every figure is counted from what is on file. The few panels the platform has nothing behind yet —
 * uptime, tasks, regulatory reports, client reviews — say "coming soon" rather than show a made-up number.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

/** Which screen each waiting thing is worked from. A link the reader's menu does not offer is not drawn. */
const WORKED_FROM: Record<string, string> = {
  proposals: "/approvals?queue=proposals",
  "portfolio-changes": "/approvals",
  "model-changes": "/approvals?queue=model-changes",
  "owned-assets": "/approvals?queue=owned-assets",
  deactivations: "/deactivation-requests",
  "family-access": "/family-access-trail",
  "family-invites": "/clients",
  support: "/support",
  "kyc-overdue": "/kyc-documents",
  "kyc-expired": "/kyc",
  "feeds-failed": "/ingestion",
  "kyc-renewals": "/kyc",
  "aml-reviews": "/aml-risk",
  "staff-declarations": "/staff-declarations",
};

const QUICK: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "Add staff", to: "/users", icon: UserPlus },
  { label: "Assign clients", to: "/clients", icon: Users },
  { label: "Reference data", to: "/config", icon: ClipboardList },
  { label: "Email templates", to: "/config", icon: Mail },
  { label: "Audit log", to: "/audit-log", icon: FileText },
  { label: "Bank feeds", to: "/ingestion", icon: Activity },
];

const LINKS: { label: string; to: string }[] = [
  { label: "Client Management overview", to: "/client-management" },
  { label: "Approvals", to: "/approvals" },
  { label: "Reports", to: "/reports" },
  { label: "Staff declarations", to: "/staff-declarations" },
  { label: "Permission matrix", to: "/roles" },
];

const ASK: string[] = [
  "What items are currently stuck?",
  "Which clients have KYC papers outstanding?",
  "List clients with a pending deactivation.",
  "How do I assign a client to a relationship manager?",
  "Give me a summary of open approvals.",
];

type Area = "main" | "side";

type CardId = "summary" | "trend" | "asset-classes" | "lifecycle" | "operations" | "approvals" | "upcoming"
  | "attention" | "activity" | "health" | "tasks" | "by-rm" | "by-pm" | "assistant" | "quick" | "links";

/**
 * Every card the dashboard can show, in the firm's own order. The assistant and the Admin's shortcuts sit down
 * the side; everything else two to a row, the wide ones taking the whole row.
 */
const CARD: Record<CardId, { title: string; area: Area; wide?: boolean }> = {
  summary: { title: "Firm summary", area: "main", wide: true },
  trend: { title: "AUM trend", area: "main" },
  "asset-classes": { title: "AUM by asset class", area: "main" },
  lifecycle: { title: "Clients by lifecycle", area: "main" },
  operations: { title: "Operational health", area: "main" },
  approvals: { title: "Approvals & queues", area: "main" },
  upcoming: { title: "Upcoming & due", area: "main" },
  attention: { title: "Items requiring attention", area: "main" },
  activity: { title: "Firm activity", area: "main", wide: true },
  health: { title: "System health", area: "main" },
  tasks: { title: "Task summary", area: "main" },
  "by-rm": { title: "AUM by RM", area: "main" },
  "by-pm": { title: "AUM by PM", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  quick: { title: "Quick actions", area: "side" },
  links: { title: "Key links", area: "side" },
};

const CARD_IDS = Object.keys(CARD) as CardId[];

/** The firm's ready-made views, agreed 4 Nov 2026. A view is just which cards, in what order. */
const PRESETS: { id: string; name: string; cards: CardId[] }[] = [
  { id: "mine", name: "My dashboard",
    cards: ["summary", "asset-classes", "operations", "approvals", "upcoming", "assistant"] },
  { id: "firm", name: "Firm overview", cards: ["summary", "trend", "asset-classes", "lifecycle", "by-pm", "by-rm"] },
  { id: "operations", name: "Operations", cards: ["operations", "approvals", "attention", "activity"] },
  { id: "compliance", name: "Compliance", cards: ["upcoming", "attention", "lifecycle"] },
  { id: "system", name: "System", cards: ["health", "activity", "quick", "links"] },
];

type Saved = { name: string; cards: CardId[] };

type Kept = {
  /** "preset:<id>" or "saved:<name>". */
  tab: string;
  /** What a ready-made view was changed to and not saved yet; a saved view is changed in place instead. */
  working: CardId[] | null;
  saved: Saved[];
};

const KEPT_AT = "atomprive.dashboard-view.v1.admin";

function onlyCards(list: unknown): CardId[] {
  return Array.isArray(list) ? [...new Set(list.filter((one): one is CardId => CARD_IDS.includes(one as CardId)))] : [];
}

function readKept(): Kept {
  const empty: Kept = { tab: "preset:mine", working: null, saved: [] };
  try {
    const found = window.localStorage.getItem(KEPT_AT);
    if (!found) return empty;
    const parsed = JSON.parse(found) as Partial<Kept>;
    const saved = (Array.isArray(parsed.saved) ? parsed.saved : [])
      .filter((one) => typeof one?.name === "string" && one.name !== "")
      .map((one) => ({ name: one.name, cards: onlyCards(one.cards) }));
    const tab = typeof parsed.tab === "string" && (PRESETS.some((one) => `preset:${one.id}` === parsed.tab)
      || saved.some((one) => `saved:${one.name}` === parsed.tab)) ? parsed.tab : empty.tab;
    return { tab, working: parsed.working ? onlyCards(parsed.working) : null, saved };
  } catch {
    return empty;
  }
}

/**
 * The Admin's views of the dashboard, kept in this browser: the firm's ready-made ones, their own saved ones,
 * and which is open. Changing a saved view changes it; changing a ready-made one is held until it is saved
 * under a name of its own, and picking the tab again puts it back as the firm made it.
 */
function useDashboardViews() {
  const [kept, setKept] = useState<Kept>(readKept);
  const write = (next: Kept) => {
    setKept(next);
    try {
      window.localStorage.setItem(KEPT_AT, JSON.stringify(next));
    } catch {
      // A browser that keeps nothing still shows the views; they last until the page is left.
    }
  };
  const preset = PRESETS.find((one) => `preset:${one.id}` === kept.tab);
  const savedOne = kept.saved.find((one) => `saved:${one.name}` === kept.tab);
  const cards = savedOne?.cards ?? kept.working ?? preset?.cards ?? PRESETS[0]!.cards;
  return {
    tab: kept.tab,
    saved: kept.saved,
    cards,
    /** A ready-made view showing something other than what the firm made it. */
    edited: !savedOne && kept.working !== null,
    pick: (tab: string) => write({ ...kept, tab, working: null }),
    change: (next: CardId[]) => (savedOne
      ? write({ ...kept, saved: kept.saved.map((one) => (one === savedOne ? { ...one, cards: next } : one)) })
      : write({ ...kept, working: next })),
    reset: () => write({ ...kept, working: null }),
    saveAs: (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      write({ tab: `saved:${trimmed}`, working: null,
        saved: [...kept.saved.filter((one) => one.name !== trimmed), { name: trimmed, cards }] });
    },
    remove: (name: string) => {
      const open = kept.tab === `saved:${name}`;
      write({ tab: open ? "preset:mine" : kept.tab, working: open ? null : kept.working,
        saved: kept.saved.filter((one) => one.name !== name) });
    },
  };
}

/** Closes a pop-over when somebody clicks anywhere outside it, or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
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
type CardControls = { earlier?: () => void; later?: () => void; remove: () => void; title: string };

const CardContext = createContext<CardControls | null>(null);

function money(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
}

export function AdminDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState("USD");
  const firm = useGetFirmDashboard<FirmDashboard, ApiError>(
    { currency, days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const platform = useGetDashboard<Dashboard, ApiError>({ query: { refetchInterval: 60_000 } });
  const currencies = useListCurrencies<Currency[], ApiError>();
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const linkFor = (key: string) => {
    const to = WORKED_FROM[key];
    return to && reachable.has(to.split("?")[0]!) ? to : undefined;
  };
  // The first of these screens the reader's menu offers, so a card goes somewhere they can open.
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const data = firm.data;
  const cur = data?.currency ?? currency;

  const view = useDashboardViews();
  const [editing, setEditing] = useState(false);
  const openItems = data ? data.headline.openApprovals + data.headline.openRequests : undefined;

  const cards: Record<CardId, ReactNode> = {
    summary: (
      <Panel icon={Layers} title="Firm summary">
        <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-line">
          <Figure label="Total AUM" value={data ? money(data.headline.totalAum, cur) : undefined}
            change={data?.headline.aumChangePercent} to={goTo("/client-management", "/clients")} />
          <Figure label="Total clients" value={data?.headline.clients} change={data?.headline.clientsChangePercent}
            to={goTo("/clients")} />
          <Figure label="Active staff" value={data?.headline.activeStaff} to={goTo("/users")} />
          <Figure label="Open items" value={openItems} tone={openItems ? "danger" : undefined}
            to={goTo("/approvals", "/deactivation-requests")} />
        </dl>
      </Panel>
    ),
    trend: (
      <Panel icon={Banknote} title="AUM trend" to={goTo("/client-management", "/clients")}>
        {data ? <GrowthChart data={data} /> : <Loading />}
      </Panel>
    ),
    "asset-classes": (
      <Panel icon={PieChart} title="AUM by asset class" to={goTo("/client-management", "/clients")}>
        {data ? <Breakdown currency={cur} centre={money(data.headline.totalAum, cur)} centreLabel={cur}
          rows={data.byAssetClass.map((one: ClassSlice) => ({ name: one.name, value: one.amount, share: one.sharePercent }))} />
          : <Loading />}
      </Panel>
    ),
    lifecycle: (
      <Panel icon={Users} title="Clients by lifecycle" to={goTo("/clients")}>
        {data ? <Breakdown centre={String(data.headline.clients)} centreLabel="Clients"
          rows={[
            { name: "Active", value: data.lifecycle.active },
            { name: "KYC not yet approved", value: data.lifecycle.onboarding },
            { name: "KYC expired", value: data.lifecycle.kycExpired },
            { name: "Deactivation", value: data.lifecycle.deactivating },
            { name: "Prospects", value: data.lifecycle.prospects, apart: true },
          ]} /> : <Loading />}
      </Panel>
    ),
    operations: (
      <Panel icon={Activity} title="Operational health">
        <ul className="space-y-2">
          <OpsRow icon={CheckCircle2} label="Onboarding" state="In progress" value={data?.operations.onboarding}
            tone="good" to={goTo("/clients")} />
          <OpsRow icon={Clock} label="KYC & compliance" state={data?.operations.kycInReview ? "Needs attention" : "Up to date"}
            value={data?.operations.kycInReview} tone={data?.operations.kycInReview ? "warn" : "good"}
            to={goTo("/kyc-documents", "/kyc", "/clients")} />
          <OpsRow icon={Layers} label="Portfolio proposals" state={data?.operations.proposalsPending ? "Pending approval" : "None waiting"}
            value={data?.operations.proposalsPending} tone={data?.operations.proposalsPending ? "danger" : "good"}
            to={goTo("/approvals?queue=proposals")} />
          <OpsRow icon={AlertTriangle} label="Bank feeds" state={data?.operations.bankFeedsFailed ? "Failed syncs" : "No failures, 24 h"}
            value={data?.operations.bankFeedsFailed} tone={data?.operations.bankFeedsFailed ? "danger" : "good"}
            to={goTo("/ingestion")} />
        </ul>
      </Panel>
    ),
    approvals: (
      <Panel icon={ListChecks} title={`Approvals & queues${data ? ` (${data.headline.openApprovals})` : ""}`}
        to={goTo("/approvals")}>
        <Counts rows={[...(data?.approvals ?? []), ...(data?.requests ?? [])]} linkFor={linkFor} limit={5}
          more={goTo("/approvals")} />
      </Panel>
    ),
    upcoming: (
      <Panel icon={CalendarDays} title="Upcoming & due" to={goTo("/staff-declarations", "/kyc")}>
        <Counts rows={data?.upcoming ?? []} linkFor={linkFor} countFirst />
        <ul className="mt-1 divide-y divide-line border-t border-line text-sm">
          <li className="flex items-center gap-3 py-2 text-ink-muted"><Landmark className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Regulatory reports</span><SoonTag /></li>
          <li className="flex items-center gap-3 py-2 text-ink-muted"><Users className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Client reviews</span><SoonTag /></li>
        </ul>
      </Panel>
    ),
    attention: (
      <Panel icon={AlertTriangle} title="Items requiring attention" to={goTo("/approvals")}>
        <Attention rows={(data?.attention ?? []).filter((one) => one.count > 0)} linkFor={linkFor} loaded={!!data} />
      </Panel>
    ),
    activity: <FirmActivity platform={platform.data} attention={data?.attention ?? []} linkFor={linkFor} to={goTo("/audit-log")} />,
    health: (
      <Panel icon={HeartPulse} title="System health" to={goTo("/ingestion")}>
        {platform.data ? (
          <dl className="divide-y divide-line text-sm">
            <Row label="Database">
              <Badge tone={platform.data.health.databaseUp ? "success" : "danger"}>
                {platform.data.health.databaseUp ? "Up" : "Not answering"}
              </Badge>
            </Row>
            <Row label="API response">{platform.data.health.apiLatencyMillis} ms</Row>
            <Row label="Last bank sync">
              {platform.data.health.lastSyncRunAt ? formatRelative(platform.data.health.lastSyncRunAt) : "None yet"}
            </Row>
            <Row label="Failed syncs, 24 h">{platform.data.tiles.failedSyncsToday}</Row>
            <Row label="Failed emails today">{platform.data.tiles.failedEmailsToday}</Row>
            <Row label="Uptime %"><SoonTag /></Row>
          </dl>
        ) : <Loading />}
      </Panel>
    ),
    tasks: (
      <Panel icon={ClipboardList} title="Task summary">
        <ComingSoon>Tasks with owners and due dates aren&rsquo;t in the platform yet.</ComingSoon>
      </Panel>
    ),
    "by-rm": (
      <Panel icon={Users} title="AUM by RM (top 5)" to={goTo("/users")}>
        <Managers rows={data?.byRelationshipManager} currency={cur} />
      </Panel>
    ),
    "by-pm": (
      <Panel icon={Users} title="AUM by PM (top 5)" to={goTo("/users")}>
        <Managers rows={data?.byPortfolioManager} currency={cur} />
      </Panel>
    ),
    assistant: <AskTheAssistant />,
    quick: (
      <Panel icon={Zap} title="Quick actions">
        <div className="grid auto-rows-fr grid-cols-2 gap-2">
          {QUICK.filter((one) => reachable.has(one.to)).map(({ label, to, icon: Icon }) => (
            <Link key={label} to={to}
              className="flex h-full min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-xs leading-tight font-semibold hover:border-primary-300 hover:bg-primary-50/50">
              <Icon className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </Panel>
    ),
    links: (
      <Panel icon={Link2} title="Key links">
        <ul className="space-y-1.5">
          {LINKS.filter((one) => reachable.has(one.to.split("?")[0]!)).map((one) => (
            <li key={one.to}>
              <Link to={one.to} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm hover:border-primary-300">
                {one.label}
                <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    ),
  };

  const shown = view.cards;
  const inArea = (area: Area) => shown.filter((id) => CARD[id].area === area);
  // Past its neighbour in the same part of the page, whatever sits between them elsewhere.
  const nudge = (id: CardId, step: -1 | 1) => {
    const mates = inArea(CARD[id].area);
    const neighbour = mates[mates.indexOf(id) + step];
    if (!neighbour) return;
    const next = [...shown];
    const from = next.indexOf(id);
    const to = next.indexOf(neighbour);
    next[from] = neighbour;
    next[to] = id;
    view.change(next);
  };
  const card = (id: CardId) => {
    const mates = inArea(CARD[id].area);
    const controls: CardControls = {
      title: CARD[id].title,
      earlier: mates[0] === id ? undefined : () => nudge(id, -1),
      later: mates[mates.length - 1] === id ? undefined : () => nudge(id, 1),
      remove: () => view.change(shown.filter((one) => one !== id)),
    };
    return (
      <CardContext.Provider key={id} value={controls}>
        <div className={cn("flex min-w-0 flex-col [&>*]:flex-1", (CARD[id].wide || fullRow.has(id)) && "@2xl:col-span-2",
          editing && "rounded-2xl outline-2 outline-offset-2 outline-primary-300 outline-dashed")}>
          {cards[id]}
        </div>
      </CardContext.Provider>
    );
  };
  // A card that would sit alone in its row — the last of an odd run, or one just before a full-width card —
  // takes the whole row, so no row is left half empty.
  const fullRow = new Set<CardId>();
  {
    let column = 0;
    const main = inArea("main");
    main.forEach((id, index) => {
      if (CARD[id].wide) {
        column = 0;
        return;
      }
      const next = main[index + 1];
      if (column === 0 && (!next || CARD[next].wide)) {
        fullRow.add(id);
        return;
      }
      column = (column + 1) % 2;
    });
  }
  const side = inArea("side");
  const savedName = view.tab.startsWith("saved:") ? view.tab.slice("saved:".length) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <Layers className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Admin dashboard</h1>
            <p className="text-sm text-ink-muted">Firm overview, operational control and key actions.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectInput id="firm-period" aria-label="Period the changes are measured over" value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
          <SelectInput id="firm-currency" aria-label="Currency the figures are shown in" value={currency}
            onChange={(event) => setCurrency(event.target.value)} className="w-28">
            {(currencies.data ?? [{ code: "USD", name: "US dollar" }]).map((one) => (
              <option key={one.code} value={one.code}>{one.code}</option>
            ))}
          </SelectInput>
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div role="tablist" aria-label="Dashboard views" className="-mb-px flex flex-wrap gap-1">
          {PRESETS.map((one) => (
            <ViewTab key={one.id} name={one.name} on={view.tab === `preset:${one.id}`}
              edited={view.tab === `preset:${one.id}` && view.edited} onPick={() => view.pick(`preset:${one.id}`)} />
          ))}
          {view.saved.map((one) => (
            <ViewTab key={one.name} name={one.name} on={view.tab === `saved:${one.name}`}
              onPick={() => view.pick(`saved:${one.name}`)} onDelete={() => view.remove(one.name)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {editing && !savedName && view.edited && (
            <Button variant="secondary" size="sm" onClick={view.reset}>
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          )}
          <Button variant={editing ? "primary" : "secondary"} size="sm" onClick={() => setEditing((now) => !now)}>
            <Pencil aria-hidden="true" />
            {editing ? "Done editing" : "Edit view"}
          </Button>
          <SaveViewAs onSave={view.saveAs} />
          <AddCard shown={shown} onApply={view.change} />
        </div>
      </div>

      {view.edited && (
        <p className="text-xs text-ink-muted">
          You&rsquo;ve changed this ready-made view. Use Save view as to keep it; picking the tab again puts it back.
        </p>
      )}
      {firm.isError && <Alert tone="danger">{firm.error.message}</Alert>}
      {data && data.unconverted > 0 && (
        <Alert tone="warning">
          {data.unconverted} client{data.unconverted === 1 ? "" : "s"} hold figures in a currency with no rate on file, and
          are left out of the amounts below.
        </Alert>
      )}

      {shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          Nothing on this view yet. Use Add card to put cards on it.
        </p>
      )}

      <div className={cn("grid gap-5", side.length > 0 && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        {/* Two cards to a row whenever the column is wide enough for two, read off the column itself rather
            than the window. The two in a row are one height; a long list shows its first few and leaves the
            rest to View all, so neither card stands half empty beside the other. */}
        <div className="@container min-w-0">
          <div className="grid gap-5 @2xl:grid-cols-2">{inArea("main").map(card)}</div>
        </div>
        {side.length > 0 && <aside className="space-y-5">{side.map(card)}</aside>}
      </div>
    </div>
  );
}

/** One view's tab. A saved view can be deleted from its own tab; the firm's ready-made ones cannot. */
function ViewTab({ name, on, edited, onPick, onDelete }: {
  name: string;
  on: boolean;
  edited?: boolean;
  onPick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span className={cn("group flex items-center border-b-2", on ? "border-primary-600" : "border-transparent")}>
      <button type="button" role="tab" aria-selected={on} onClick={onPick}
        className={cn("px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
          on ? "text-primary-700" : "text-ink-muted hover:text-ink")}>
        {name}
        {edited && <span className="ml-1 text-primary-600" title="Changed, not saved">•</span>}
      </button>
      {onDelete && (
        <button type="button" aria-label={`Delete the view ${name}`} title="Delete this view" onClick={onDelete}
          className="-ml-1.5 mr-1 grid size-5 place-items-center rounded text-ink-muted opacity-0 group-hover:opacity-100
            focus:opacity-100 hover:bg-red-50 hover:text-red-600">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Names what is on screen and keeps it as a view of its own. */
function SaveViewAs({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const close = useCallback(() => setOpen(false), []);
  const box = useDismiss(open, close);
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name);
    setName("");
    setOpen(false);
  };
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((now) => !now)} aria-expanded={open}>
        <Copy aria-hidden="true" />
        Save view as
      </Button>
      {open && (
        <form onSubmit={save} className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-lg">
          <label htmlFor="dashboard-view-name" className="text-xs font-semibold text-ink-muted">Name this view</label>
          <div className="mt-1.5 flex gap-2">
            <input id="dashboard-view-name" autoFocus value={name} onChange={(event) => setName(event.target.value)}
              maxLength={40} placeholder="e.g. Month end"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none" />
            <Button size="sm" type="submit" disabled={!name.trim()}>Save</Button>
          </div>
          <p className="mt-2 text-2xs text-ink-muted">Kept in this browser, as a tab beside the others.</p>
        </form>
      )}
    </div>
  );
}

/** Every card, ticked where it is on this view: tick more to add them, untick to take them off. */
function AddCard({ shown, onApply }: { shown: CardId[]; onApply: (cards: CardId[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<Set<CardId>>(new Set());
  const close = useCallback(() => setOpen(false), []);
  const box = useDismiss(open, close);
  const begin = () => {
    setTicked(new Set(shown));
    setQuery("");
    setOpen((now) => !now);
  };
  const added = CARD_IDS.filter((id) => ticked.has(id) && !shown.includes(id));
  const removed = shown.filter((id) => !ticked.has(id));
  const listed = CARD_IDS.filter((id) => CARD[id].title.toLowerCase().includes(query.trim().toLowerCase()));
  const apply = () => {
    onApply([...shown.filter((id) => ticked.has(id)), ...added]);
    setOpen(false);
  };
  return (
    <div ref={box} className="relative">
      <Button size="sm" onClick={begin} aria-expanded={open}>
        <Plus aria-hidden="true" />
        Add card
        <ChevronDown aria-hidden="true" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Add card</p>
            <button type="button" aria-label="Close" onClick={close} className="rounded p-1 text-ink-muted hover:bg-slate-100">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards…"
              className="w-full rounded-xl border border-line bg-white py-1.5 pr-3 pl-8 text-sm focus:border-primary-400 focus:outline-none" />
          </div>
          <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
            {listed.map((id) => (
              <li key={id}>
                <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50",
                  ticked.has(id) && "bg-primary-50/60")}>
                  <input type="checkbox" checked={ticked.has(id)} className="size-4 accent-primary-600"
                    onChange={() => setTicked((now) => {
                      const next = new Set(now);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })} />
                  {CARD[id].title}
                </label>
              </li>
            ))}
            {listed.length === 0 && <li className="px-2 py-3 text-sm text-ink-muted">No card is called that.</li>}
          </ul>
          <Button className="mt-3 w-full" size="sm" onClick={apply} disabled={added.length === 0 && removed.length === 0}>
            {added.length === 0 && removed.length > 0 ? "Update view" : `Add selected (${added.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A card's ⋮: move it either way, open the screen behind it, or take it off this view. */
function CardMenu({ to }: { to?: string }) {
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

/** One of the four figures across the Firm summary. */
function Figure({ label, value, change, tone, to }: {
  label: string;
  value: ReactNode | undefined;
  change?: number | null;
  tone?: "danger";
  to?: string;
}) {
  const body = (
    <>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={cn("mt-1 text-lg font-bold whitespace-nowrap tabular-nums xl:text-xl", tone === "danger" && "text-red-600")}>{value ?? "—"}</dd>
      {change != null && (
        <dd className={cn("mt-1 inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
          change < 0 ? "text-red-600" : "text-emerald-600")}>
          {change < 0 ? <ArrowDownRight className="size-3.5" aria-hidden="true" /> : <ArrowUpRight className="size-3.5" aria-hidden="true" />}
          {change > 0 ? "+" : ""}{change}%
        </dd>
      )}
    </>
  );
  return to ? <Link to={to} className="block px-4 first:pl-0 hover:[&_dd]:text-primary-700">{body}</Link>
    : <div className="px-4 first:pl-0">{body}</div>;
}

/** One line of Operational health: what, where it stands, how many, and the way in. */
function OpsRow({ icon: Icon, label, state, value, tone, to }: {
  icon: LucideIcon;
  label: string;
  state: string;
  value: number | undefined;
  tone: "good" | "warn" | "danger";
  to?: string;
}) {
  const inner = (
    <>
      <Icon className={cn("size-5 shrink-0", tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-emerald-600")}
        aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={cn("block text-xs", tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-ink-muted")}>
          {state}
        </span>
      </span>
      <span className={cn("text-lg font-bold tabular-nums", tone === "danger" && "text-red-600")}>{value ?? "—"}</span>
      {to && <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />}
    </>
  );
  const className = cn("flex items-center gap-3 rounded-xl px-3 py-2.5",
    tone === "danger" ? "bg-red-50/70" : tone === "warn" ? "bg-amber-50/70" : "bg-slate-50");
  return (
    <li>
      {to ? <Link to={to} className={cn(className, "hover:ring-1 hover:ring-primary-200")}>{inner}</Link>
        : <div className={className}>{inner}</div>}
    </li>
  );
}

function Panel({ icon: Icon, title, to, children }: {
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

function Loading() {
  return <p className="py-10 text-center text-sm text-ink-muted">Loading…</p>;
}

function SoonTag() {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-ink-muted">Coming soon</span>;
}

function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full min-h-32 place-items-center rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <div>
        <SoonTag />
        <p className="mt-2 text-sm text-ink-muted">{children}</p>
      </div>
    </div>
  );
}

/** The firm's money as columns and its client count as a line, month by month. */
function GrowthChart({ data }: { data: FirmDashboard }) {
  const option = useMemo(() => {
    const c = ink();
    const months = data.growth.map((one, index) =>
      index === data.growth.length - 1 ? "Now"
        : new Date(`${one.on}T00:00:00`).toLocaleDateString("en-GB", { month: "short" }));
    const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
    return {
      textStyle: { fontFamily: c.font, color: c.muted },
      grid: { left: 40, right: 28, top: 36, bottom: 22 },
      legend: { top: 0, textStyle: { color: c.muted, fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => compact(value),
      },
      xAxis: { type: "category", data: months, axisLine: { lineStyle: { color: c.line } }, axisTick: { show: false },
        axisLabel: { interval: 0, color: c.muted, fontSize: 10 } },
      yAxis: [
        { type: "value", axisLabel: { formatter: compact, color: c.muted }, splitLine: { lineStyle: { color: c.line } } },
        { type: "value", axisLabel: { color: c.muted }, splitLine: { show: false }, minInterval: 1 },
      ],
      series: [
        { name: `AUM (${data.currency})`, type: "bar", data: data.growth.map((one) => Number(one.aum)), barWidth: "48%",
          itemStyle: { color: c.primary, borderRadius: [4, 4, 0, 0] } },
        { name: "Clients", type: "line", yAxisIndex: 1, data: data.growth.map((one) => one.clients), symbolSize: 6,
          itemStyle: { color: c.text }, lineStyle: { width: 2, color: c.text } },
      ],
    };
  }, [data]);
  return <Chart option={option} height={220} label="AUM and number of clients at the end of each of the last six months" />;
}

const SLICE_COLOURS = ["#1d6ee8", "#0f9d8a", "#f2a01c", "#8b5cf6", "#e5484d", "#64748b", "#0ea5e9", "#a3a3a3"];

/** A ring of what makes up a whole, with each part listed beside it. */
function Breakdown({ rows, centre, centreLabel, currency }: {
  rows: { name: string; value: number; share?: number; apart?: boolean }[];
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
          itemStyle: { color: SLICE_COLOURS[index % SLICE_COLOURS.length] } })),
      }],
    };
  }, [ringed, currency]);
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">Nothing on file yet.</p>;
  }
  return (
    // What makes it up on the left, read first, and the ring on the right; one above the other when narrow.
    <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center">
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {rows.map((one, index) => (
          <li key={one.name} className={cn("flex items-center gap-2", one.apart && "mt-2 border-t border-line pt-2")}>
            <span className="size-2.5 shrink-0 rounded-full"
              style={{ background: one.apart ? "var(--color-slate-300)" : SLICE_COLOURS[index % SLICE_COLOURS.length] }} />
            <span className="min-w-0 flex-1 leading-tight">{one.name}</span>
            {one.share !== undefined && <span className="text-xs text-ink-muted tabular-nums">{one.share}%</span>}
            <span className="font-semibold tabular-nums">
              {currency ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(one.value) : one.value}
            </span>
          </li>
        ))}
      </ul>
      <div className="relative mx-auto w-40 shrink-0 sm:mx-0">
        <Chart option={option} height={160} label={`${centreLabel}: ${ringed.map((one) => `${one.name} ${one.value}`).join(", ")}`} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-2xs text-ink-muted">{centreLabel}</span>
            <span className="block text-sm font-bold tabular-nums">{centre.replace(`${currency ?? ""} `, "")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** The icon each waiting thing is drawn with, so a list of counts can be read at a glance. */
const ICON_FOR: Record<string, LucideIcon> = {
  proposals: Users,
  "portfolio-changes": ArrowLeftRight,
  "model-changes": Layers,
  "owned-assets": Gem,
  deactivations: UserMinus,
  "family-access": Users,
  "family-invites": UserPlus,
  support: LifeBuoy,
  "kyc-renewals": CalendarDays,
  "aml-reviews": ShieldCheck,
  "staff-declarations": FileText,
};

function Counts({ rows, linkFor, countFirst = false, limit, more }: {
  rows: Waiting[];
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
        const Icon = ICON_FOR[one.key] ?? FileText;
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

function Attention({ rows, linkFor, loaded }: { rows: Waiting[]; linkFor: (key: string) => string | undefined; loaded: boolean }) {
  if (loaded && rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">Nothing needs attention right now.</p>;
  }
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.slice(0, 5).map((one) => {
        const to = linkFor(one.key);
        const inner = (
          <>
            <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="min-w-0 flex-1">{one.label}</span>
            <b className="tabular-nums">{one.count}</b>
            {to && <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />}
          </>
        );
        return (
          <li key={one.key}>
            {to ? <Link to={to} className="flex items-center gap-2.5 py-2 hover:text-primary-700">{inner}</Link>
              : <div className="flex items-center gap-2.5 py-2">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const ACTIVITY_TABS = ["Firm activity (recent)", "Stuck items", "Key changes", "System & integrations"] as const;

function FirmActivity({ platform, attention, linkFor, to }: {
  platform: Dashboard | undefined;
  attention: Waiting[];
  linkFor: (key: string) => string | undefined;
  /** Where the whole record is read: the audit log. */
  to?: string;
}) {
  const [tab, setTab] = useState<(typeof ACTIVITY_TABS)[number]>(ACTIVITY_TABS[0]);
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white">
      <div className="flex items-end justify-between gap-3 border-b border-line px-3 pt-2">
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {ACTIVITY_TABS.map((one) => (
          <button key={one} type="button" role="tab" aria-selected={tab === one} onClick={() => setTab(one)}
            className={cn("border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap",
              tab === one ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>
            {one}
          </button>
        ))}
      </div>
      <div className="mb-1.5 flex shrink-0 items-center gap-1 pr-1">
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
            View all
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
        <CardMenu to={to} />
      </div>
      </div>
      <div className="px-5 py-3">
        {tab === "Firm activity (recent)" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="py-1.5 pr-3 font-medium">Activity</th>
                  <th className="py-1.5 pr-3 font-medium">By</th>
                  <th className="py-1.5 font-medium">About</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(platform?.recentActivity ?? []).slice(0, 6).map((event, index) => (
                  <tr key={`${event.occurredAt}-${index}`}>
                    <td className="py-2 pr-3 whitespace-nowrap text-ink-muted tabular-nums">{formatRelative(event.occurredAt)}</td>
                    <td className="py-2 pr-3 font-medium">{event.description}</td>
                    <td className="py-2 pr-3 text-ink-soft">
                      {event.actorName ?? "System"}{event.actorRole && ` (${roleLabel(event.actorRole)})`}
                    </td>
                    <td className="py-2 text-ink-soft">{event.targetLabel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!platform && <Loading />}
          </div>
        )}
        {tab === "Stuck items" && <Attention rows={attention.filter((one) => one.count > 0)} linkFor={linkFor} loaded />}
        {tab === "Key changes" && <ComingSoon>A list of changes to roles, permissions and reference data.</ComingSoon>}
        {tab === "System & integrations" && platform && (
          <dl className="divide-y divide-line text-sm">
            <Row label="Database">
              <Badge tone={platform.health.databaseUp ? "success" : "danger"}>{platform.health.databaseUp ? "Up" : "Not answering"}</Badge>
            </Row>
            <Row label="API response">{platform.health.apiLatencyMillis} ms</Row>
            <Row label="Last bank sync">
              {platform.health.lastSyncRunAt ? formatRelative(platform.health.lastSyncRunAt) : "No bank has been pulled yet"}
            </Row>
            <Row label="Bank syncs, last 24 hours">{platform.tiles.syncRunsToday} run, {platform.tiles.failedSyncsToday} failed</Row>
            <Row label="Emails that failed today">{platform.tiles.failedEmailsToday}</Row>
          </dl>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function Managers({ rows, currency }: { rows: ManagerAum[] | undefined; currency: string }) {
  if (rows && rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No assigned clients hold anything yet.</p>;
  }
  const most = Math.max(...(rows ?? []).map((one) => Number(one.amount)), 1);
  return (
    <ul className="space-y-2.5 text-sm">
      {(rows ?? []).map((one) => (
        <li key={one.staffId} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3">
          <span className="truncate" title={one.name}>{one.name}</span>
          <span className="h-2 rounded-full bg-slate-100">
            <span className="block h-2 rounded-full bg-primary-600" style={{ width: `${(Number(one.amount) / most) * 100}%` }} />
          </span>
          <span className="text-xs whitespace-nowrap tabular-nums">
            <b>{money(one.amount, currency).replace(`${currency} `, "")}</b>{" "}
            <span className="text-ink-muted">({one.sharePercent}%)</span>
          </span>
        </li>
      ))}
      {!rows && <Loading />}
    </ul>
  );
}

/** A way into the Firm Assistant from here: a suggested question, or one typed, opens it already asked. */
function AskTheAssistant() {
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
          <p className="text-xs text-ink-muted">Ask about operations, clients, compliance or how to use the portal.</p>
        </div>
        <CardMenu to="/assistant" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {ASK.map((question) => (
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
