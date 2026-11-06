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
  type FirmWaiting,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Gem,
  HeartPulse,
  Landmark,
  Layers,
  LifeBuoy,
  Link2,
  ListChecks,
  Mail,
  PieChart,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative, roleLabel } from "../../lib/labels";
import { menuFor } from "../../menu";
import { Chart, ink } from "../book/overview-charts";
import {
  AskTheAssistant,
  Breakdown,
  CardGrid,
  CardMenu,
  ComingSoon,
  Counts,
  EditCards,
  Loading,
  Panel,
  Row,
  SoonTag,
  money,
  useDashboardCards,
  type CardMeta,
} from "./dashboard-kit";

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

type CardId = "summary" | "trend" | "asset-classes" | "lifecycle" | "operations" | "approvals" | "upcoming"
  | "attention" | "activity" | "health" | "tasks" | "by-rm" | "by-pm" | "rm-count" | "rm-book" | "assistant" | "quick"
  | "links";

/**
 * Every card the dashboard can show, in the firm's own order. The assistant and the Admin's shortcuts sit down
 * the side; everything else two to a row, the wide ones taking the whole row.
 */
const CARD: Record<CardId, CardMeta> = {
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
  "rm-count": { title: "Relationship managers", area: "main" },
  "rm-book": { title: "AUM by relationship manager", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  quick: { title: "Quick actions", area: "side" },
  links: { title: "Key links", area: "side" },
};

const CARD_IDS = Object.keys(CARD) as CardId[];

/** What the dashboard opens on until the Admin changes it: the firm's own choice, 4 Nov 2026. */
const DEFAULT_CARDS: CardId[] = ["summary", "asset-classes", "operations", "approvals", "upcoming", "assistant"];

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

  const view = useDashboardCards("admin", CARD_IDS, DEFAULT_CARDS);
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
        <Counts rows={[...(data?.approvals ?? []), ...(data?.requests ?? [])]} linkFor={linkFor} iconFor={ICON_FOR} limit={5}
          more={goTo("/approvals")} />
      </Panel>
    ),
    upcoming: (
      <Panel icon={CalendarDays} title="Upcoming & due" to={goTo("/staff-declarations", "/kyc")}>
        <Counts rows={data?.upcoming ?? []} linkFor={linkFor} iconFor={ICON_FOR} countFirst />
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
    "rm-count": (
      <Panel icon={Users} title="Relationship managers" to={goTo("/users")}>
        {data?.everyRelationshipManager ? (
          <div className="py-2">
            <p className="text-3xl font-bold tabular-nums">{data.everyRelationshipManager.length}</p>
            <p className="mt-1 text-sm text-ink-muted">with at least one client</p>
          </div>
        ) : <Loading />}
      </Panel>
    ),
    "rm-book": (
      <Panel icon={Users} title="AUM by relationship manager" to={goTo("/users")}>
        <RelationshipBook rows={data?.everyRelationshipManager} currency={cur} />
      </Panel>
    ),
    assistant: <AskTheAssistant questions={ASK} blurb="Ask about operations, clients, compliance or how to use the portal." />,
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
          <EditCards meta={CARD} shown={shown} editing={editing} onEditing={setEditing} onChange={view.change}
            changed={view.changed} onReset={view.reset} />
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

      <CardGrid meta={CARD} shown={shown} render={cards} editing={editing} onChange={view.change} />
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

function Attention({ rows, linkFor, loaded }: { rows: FirmWaiting[]; linkFor: (key: string) => string | undefined; loaded: boolean }) {
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
  attention: FirmWaiting[];
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

/**
 * Every relationship manager with a client: how many clients, what they hold and their share of the firm. A
 * client with two RMs counts in full for each, so the shares can add up to more than the whole.
 */
function RelationshipBook({ rows, currency }: { rows: ManagerAum[] | undefined; currency: string }) {
  if (!rows) {
    return <Loading />;
  }
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No relationship manager has a client yet.</p>;
  }
  const overlap = rows.reduce((sum, one) => sum + Number(one.sharePercent), 0) > 100;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="py-1.5 pr-3 font-medium">Relationship manager</th>
            <th className="py-1.5 pr-3 text-right font-medium">Clients</th>
            <th className="py-1.5 pr-3 text-right font-medium">AUM</th>
            <th className="py-1.5 font-medium">Share of firm AUM</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((one) => (
            <tr key={one.staffId}>
              <td className="py-2 pr-3">{one.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{one.clients}</td>
              <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{money(one.amount, currency)}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 rounded-full bg-slate-100">
                    <span className="block h-2 rounded-full bg-primary-600"
                      style={{ width: `${Math.min(100, Number(one.sharePercent))}%` }} />
                  </span>
                  <span className="w-12 text-right text-xs text-ink-muted tabular-nums">{one.sharePercent}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {overlap && (
        <p className="mt-2 text-xs text-ink-muted">Shares add up to more than 100% because a client can have more than one RM.</p>
      )}
    </div>
  );
}
