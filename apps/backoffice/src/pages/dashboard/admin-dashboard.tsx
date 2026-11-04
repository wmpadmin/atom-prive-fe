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
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  ChevronRight,
  ClipboardList,
  FileText,
  Flag,
  HeartPulse,
  Landmark,
  Link2,
  ListChecks,
  Mail,
  Pencil,
  PieChart,
  Plus,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative, roleLabel } from "../../lib/labels";
import { ViewTabs } from "../../components/view-tabs";
import { useTableView } from "../../lib/table-view";
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

type Area = "top" | "main" | "side";

type CardId = "figures" | "growth" | "approvals" | "attention" | "asset-classes" | "lifecycle" | "operations"
  | "activity" | "tasks" | "by-rm" | "by-pm" | "upcoming" | "assistant" | "quick" | "links";

/**
 * Every card the dashboard can show, in the firm's own order. Where it sits: the key figures across the top,
 * the assistant and the Admin's shortcuts down the side, everything else three to a row.
 */
const CARD: Record<CardId, { title: string; area: Area; wide?: boolean }> = {
  figures: { title: "Key figures", area: "top" },
  growth: { title: "AUM & client growth", area: "main" },
  approvals: { title: "Approvals & queues", area: "main" },
  attention: { title: "Items requiring attention", area: "main" },
  "asset-classes": { title: "AUM by asset class", area: "main" },
  lifecycle: { title: "Clients by lifecycle", area: "main" },
  operations: { title: "Operational health", area: "main" },
  activity: { title: "Firm activity", area: "main", wide: true },
  tasks: { title: "Task summary", area: "main" },
  "by-rm": { title: "AUM by RM (top 5)", area: "main" },
  "by-pm": { title: "AUM by PM (top 5)", area: "main" },
  upcoming: { title: "Upcoming & due", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  quick: { title: "Quick actions", area: "side" },
  links: { title: "Key links", area: "side" },
};

const CARD_IDS = Object.keys(CARD) as CardId[];

/** The firm's five, asked for on 4 Nov 2026: everything else is one click away under Add card. */
const SHOWN_BY_DEFAULT: CardId[] = ["figures", "growth", "approvals", "attention", "assistant"];

const HIDDEN_BY_DEFAULT = CARD_IDS.filter((id) => !SHOWN_BY_DEFAULT.includes(id));

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

  const view = useTableView("admin-dashboard", CARD_IDS, HIDDEN_BY_DEFAULT);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  // Whether what is on screen differs from the tab that is lit: the firm's five, or the saved view picked.
  const asTheFirmHasIt = view.order.join("|") === CARD_IDS.join("|")
    && [...view.hidden].sort().join("|") === [...HIDDEN_BY_DEFAULT].sort().join("|");
  const edited = view.current === null ? !asTheFirmHasIt : view.changed;

  const cards: Record<CardId, ReactNode> = {
    figures: (
      <Panel icon={Landmark} title="Key figures">
        <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4">
          <Headline icon={Landmark} label="Total AUM" value={data ? money(data.headline.totalAum, cur) : undefined}
            change={data?.headline.aumChangePercent} to={goTo("/client-management", "/clients")} />
          <Headline icon={Users} label="Total clients" value={data?.headline.clients} change={data?.headline.clientsChangePercent}
            to={goTo("/clients")} />
          <Headline icon={UserCog} label="Active staff" value={data?.headline.activeStaff} to={goTo("/users")} />
          <Headline icon={UserPlus} label="Onboarding" value={data?.headline.onboarding} to={goTo("/clients")} />
          <Headline icon={ListChecks} label="Open approvals" value={data?.headline.openApprovals} tone="warn"
            to={goTo("/approvals", "/deactivation-requests")} />
          <Headline icon={Flag} label="Open requests" value={data?.headline.openRequests} tone="warn"
            to={goTo("/family-access-trail", "/support")} />
          <Headline icon={ShieldCheck} label="Compliance due" value={data?.headline.complianceDue} tone="danger"
            to={goTo("/kyc", "/staff-declarations")} />
          <Headline icon={HeartPulse} label="System health"
            value={platform.data ? (platform.data.health.databaseUp ? "Up" : "Down") : undefined}
            tone={platform.data && !platform.data.health.databaseUp ? "danger" : "good"} note="Uptime % coming soon"
            to={goTo("/ingestion")} />
        </div>
      </Panel>
    ),
    growth: (
      <Panel icon={Banknote} title="AUM & client growth" to={goTo("/client-management", "/clients")}>
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
        <div className="grid h-full auto-rows-fr grid-cols-2 gap-2.5">
          <Mini label="Onboarding" value={data?.operations.onboarding} state="In progress" tone="good"
            to={goTo("/clients")} />
          <Mini label="KYC & compliance" value={data?.operations.kycInReview} state="In review"
            tone={data && data.operations.kycInReview > 0 ? "warn" : "good"} to={goTo("/kyc-documents", "/kyc", "/clients")} />
          <Mini label="Portfolio proposals" value={data?.operations.proposalsPending} state="Pending"
            tone={data && data.operations.proposalsPending > 0 ? "warn" : "good"} to={goTo("/approvals?queue=proposals")} />
          <Mini label="Bank feeds" value={data?.operations.bankFeedsFailed} state="Failed, 24 h"
            tone={data && data.operations.bankFeedsFailed > 0 ? "danger" : "good"} to={goTo("/ingestion")} />
        </div>
      </Panel>
    ),
    approvals: (
      <Panel icon={ListChecks} title={`Approvals & queues${data ? ` (${data.headline.openApprovals})` : ""}`}
        to={goTo("/approvals")}>
        <Counts rows={[...(data?.approvals ?? []), ...(data?.requests ?? [])]} linkFor={linkFor} />
      </Panel>
    ),
    attention: (
      <Panel icon={AlertTriangle} title="Items requiring attention" to={goTo("/approvals")}>
        <Attention rows={(data?.attention ?? []).filter((one) => one.count > 0)} linkFor={linkFor} loaded={!!data} />
      </Panel>
    ),
    activity: <FirmActivity platform={platform.data} attention={data?.attention ?? []} linkFor={linkFor} to={goTo("/audit-log")} />,
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
    upcoming: (
      <Panel icon={BadgeCheck} title="Upcoming & due" to={goTo("/staff-declarations", "/kyc")}>
        <Counts rows={data?.upcoming ?? []} linkFor={linkFor} />
        <ul className="mt-1 divide-y divide-line border-t border-line text-sm">
          <li className="flex justify-between py-2 text-ink-muted"><span>Regulatory reports</span><SoonTag /></li>
          <li className="flex justify-between py-2 text-ink-muted"><span>Client reviews</span><SoonTag /></li>
        </ul>
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

  const shown = view.shown as CardId[];
  const inArea = (area: Area) => shown.filter((id) => CARD[id].area === area);
  // Moving a card past its neighbour in the same part of the page, whatever sits between them elsewhere.
  const nudge = (id: CardId, step: -1 | 1) => {
    const mates = inArea(CARD[id].area);
    const neighbour = mates[mates.indexOf(id) + step];
    if (neighbour) view.move(id, view.order.indexOf(neighbour));
  };
  const card = (id: CardId) => {
    const mates = inArea(CARD[id].area);
    return (
      <Editable key={id} editing={editing} title={CARD[id].title} wide={CARD[id].wide}
        first={mates[0] === id} last={mates[mates.length - 1] === id}
        onEarlier={() => nudge(id, -1)} onLater={() => nudge(id, 1)} onRemove={() => view.toggle(id)}>
        {cards[id]}
      </Editable>
    );
  };
  const side = inArea("side");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-bold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {editing
              ? `Editing ${view.current ? `\u201c${view.current}\u201d` : "the default view"}. Changes are kept only in this browser.`
              : "Firm overview, operational control and key actions."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewTabs
            views={view.views}
            current={view.current}
            edited={edited}
            onPick={(name) => (name === null ? view.reset() : view.apply(name))}
            onSave={view.saveAs}
            onDelete={view.remove}
            firstLabel="Default"
          />
          {editing ? (
            <>
              <Button variant="secondary" size="sm" onClick={view.reset}>
                <RotateCcw aria-hidden="true" />
                Reset to default
              </Button>
              <div className="relative">
                <Button size="sm" onClick={() => setAdding((now) => !now)} disabled={view.hidden.length === 0}
                  aria-expanded={adding}>
                  <Plus aria-hidden="true" />
                  Add card
                </Button>
                {adding && view.hidden.length > 0 && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-white p-2 shadow-lg">
                    <p className="px-2 pt-1 pb-2 text-xs font-semibold text-ink-muted">Cards not on this view</p>
                    {(view.hidden as CardId[]).map((id) => (
                      <button key={id} type="button" onClick={() => { view.toggle(id); setAdding(false); }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary-50">
                        {CARD[id].title}
                        <Plus className="size-4 text-primary-600" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" onClick={() => { setEditing(false); setAdding(false); }}>Done</Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Edit view
            </Button>
          )}
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

      {firm.isError && <Alert tone="danger">{firm.error.message}</Alert>}
      {data && data.unconverted > 0 && (
        <Alert tone="warning">
          {data.unconverted} client{data.unconverted === 1 ? "" : "s"} hold figures in a currency with no rate on file, and
          are left out of the amounts below.
        </Alert>
      )}

      {inArea("top").map(card)}

      {shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          Nothing on this view. Use Edit view, then Add card.
        </p>
      )}

      <div className={cn("grid gap-5", side.length > 0 && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        {/* Three cards to a row whenever the column is wide enough for three, read off the column itself
            rather than the window, so the sidebar and the assistant beside it cannot push them into one. */}
        <div className="@container min-w-0">
          <div className="grid gap-5 @2xl:grid-cols-3">{inArea("main").map(card)}</div>
        </div>
        {side.length > 0 && <aside className="space-y-5">{side.map(card)}</aside>}
      </div>
    </div>
  );
}

/**
 * One card as the view arranges it. While the view is being edited it carries its own controls: earlier,
 * later, and off the view altogether — what comes off goes back into Add card.
 */
function Editable({ editing, title, wide, first, last, onEarlier, onLater, onRemove, children }: {
  editing: boolean;
  title: string;
  wide?: boolean;
  first: boolean;
  last: boolean;
  onEarlier: () => void;
  onLater: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative flex min-w-0 flex-col [&>*]:flex-1", wide && "@2xl:col-span-2",
      editing && "rounded-2xl outline-2 outline-offset-2 outline-primary-300 outline-dashed")}>
      {children}
      {editing && (
        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1 rounded-xl bg-white/90 p-1 shadow-sm">
          <IconButton label={`Move ${title} earlier`} onClick={onEarlier} disabled={first}><ArrowLeft /></IconButton>
          <IconButton label={`Move ${title} later`} onClick={onLater} disabled={last}><ArrowRight /></IconButton>
          <IconButton label={`Remove ${title} from this view`} onClick={onRemove} danger><X /></IconButton>
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn("grid size-7 place-items-center rounded-lg disabled:opacity-30 [&_svg]:size-4",
        danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-primary-50 text-primary-700 hover:bg-primary-100")}>
      {children}
    </button>
  );
}

function Headline({ icon: Icon, label, value, change, tone, to, note }: {
  icon: LucideIcon;
  label: string;
  value: ReactNode | undefined;
  change?: number | null;
  tone?: "warn" | "danger" | "good";
  to?: string;
  note?: string;
}) {
  const body = (
    <>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl",
        tone === "danger" ? "bg-red-50 text-red-600" : tone === "warn" ? "bg-amber-50 text-amber-600"
          : tone === "good" ? "bg-emerald-50 text-emerald-600" : "bg-primary-50 text-primary-600")}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs leading-tight font-semibold text-ink-muted">{label}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn("text-lg font-bold tabular-nums", tone === "danger" && "text-red-600",
            tone === "good" && "text-emerald-600")}>{value ?? "—"}</span>
          {change != null && (
            <span className={cn("inline-flex items-center text-2xs font-semibold tabular-nums",
              change < 0 ? "text-red-600" : "text-emerald-600")}>
              {change < 0 ? <ArrowDownRight className="size-3" aria-hidden="true" /> : <ArrowUpRight className="size-3" aria-hidden="true" />}
              {change > 0 ? "+" : ""}{change}%
            </span>
          )}
        </span>
        {note && <span className="block text-2xs text-ink-muted">{note}</span>}
      </span>
    </>
  );
  const className = "flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-3";
  return to ? <Link to={to} className={cn(className, "hover:border-primary-300")}>{body}</Link> : <div className={className}>{body}</div>;
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
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary-700 hover:underline">
            View all
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
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
    <div className="space-y-3">
      <div className="relative mx-auto w-36">
        <Chart option={option} height={144} label={`${centreLabel}: ${ringed.map((one) => `${one.name} ${one.value}`).join(", ")}`} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-2xs text-ink-muted">{centreLabel}</span>
            <span className="block text-sm font-bold tabular-nums">{centre.replace(`${currency ?? ""} `, "")}</span>
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {rows.map((one, index) => (
          <li key={one.name} className={cn("flex items-center gap-2", one.apart && "mt-2 border-t border-line pt-2")}>
            <span className="size-2.5 shrink-0 rounded-full"
              style={{ background: one.apart ? "var(--color-slate-300)" : SLICE_COLOURS[index % SLICE_COLOURS.length] }} />
            <span className="min-w-0 flex-1 leading-tight">{one.name}</span>
            {one.share !== undefined && <span className="text-ink-muted tabular-nums">{one.share}%</span>}
            <span className="font-semibold tabular-nums">
              {currency ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(one.value) : one.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mini({ label, value, state, tone, to }: {
  label: string;
  value: number | undefined;
  state: string;
  tone: "good" | "warn" | "danger";
  to?: string;
}) {
  const className = cn("flex h-full flex-col justify-center rounded-xl border px-3 py-2.5",
    tone === "danger" ? "border-red-200 bg-red-50/60" : tone === "warn" ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60");
  const body = (
    <>
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value ?? "—"}</p>
      <p className={cn("text-2xs font-semibold", tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-emerald-700")}>{state}</p>
    </>
  );
  return to ? <Link to={to} className={cn(className, "transition-shadow hover:shadow-md")}>{body}</Link>
    : <div className={className}>{body}</div>;
}

function Counts({ rows, linkFor }: { rows: Waiting[]; linkFor: (key: string) => string | undefined }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((one) => {
        const to = linkFor(one.key);
        const inner = (
          <>
            <span className="min-w-0 flex-1 leading-tight">{one.label}</span>
            <span className={cn("font-bold tabular-nums", one.count === 0 && "font-normal text-ink-muted")}>{one.count}</span>
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
      {to && (
        <Link to={to} className="mb-2.5 inline-flex shrink-0 items-center gap-1 pr-2 text-xs font-semibold text-primary-700 hover:underline">
          View all
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
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
        <div>
          <h2 className="text-base font-bold">AI Assistant</h2>
          <p className="text-xs text-ink-muted">Ask about operations, clients, compliance or how to use the portal.</p>
        </div>
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
