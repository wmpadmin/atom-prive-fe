import { ApiError } from "@atomprive/api-client";
import { useGetItAdminDashboard, type ItAdminDashboard as Figures } from "@atomprive/api-client/backoffice";
import { Alert, Badge, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleCheck,
  FileClock,
  HeartPulse,
  KeyRound,
  LifeBuoy,
  Link2,
  Lock,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { menuFor } from "../../menu";
import {
  AskTheAssistant,
  Breakdown,
  Counts,
  Loading,
  Panel,
  Row,
  Strip,
  useDashboardCards,
  type CardMeta,
} from "./dashboard-kit";
import { CustomizeButton, LayoutGrid } from "../layout/custom-view";

/**
 * The IT Admin's dashboard: support tickets, who is signed in and who was looked at as somebody else, whether the
 * platform is well, the staff accounts and the security trail. One dashboard with Customize view to move, size and
 * hide cards, the same as every other role's.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "tickets" | "sessions" | "health" | "users" | "security" | "links" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  tickets: { title: "Support tickets overview", area: "main" },
  sessions: { title: "Access & sessions", area: "main" },
  health: { title: "System health", area: "main" },
  users: { title: "User management", area: "main" },
  security: { title: "Security & compliance", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  links: { title: "Key links", area: "side" },
};


/** What the dashboard opens on: the four that matter most, chosen 13 Nov 2026; the rest wait in Add cards. A layout someone saved is kept. */
const DEFAULT_CARDS: CardId[] = ["tickets", "sessions", "health", "security"];

/** Which screen each counted line is worked from. A line whose screen the reader's menu lacks has no link. */
const WORKED_FROM: Record<string, string[]> = {
  staff: ["/users"],
  active: ["/users"],
  invited: ["/users"],
  deactivated: ["/users"],
  "failed-sign-ins": ["/audit-log"],
  lockouts: ["/audit-log"],
  "authenticator-resets": ["/audit-log"],
  "permission-changes": ["/audit-log", "/roles"],
  "audit-events": ["/audit-log"],
};

const ICON_FOR: Record<string, LucideIcon> = {
  staff: Users,
  active: UserCheck,
  invited: UserPlus,
  deactivated: UserX,
  "client-logins": UserCog,
  "failed-sign-ins": ShieldAlert,
  lockouts: Lock,
  "authenticator-resets": KeyRound,
  "permission-changes": ShieldCheck,
  "audit-events": FileClock,
};

const LINKS: { label: string; to: string }[] = [
  { label: "Support tickets", to: "/support" },
  { label: "Sign in as", to: "/sign-in-as" },
  { label: "Audit log", to: "/audit-log" },
  { label: "Staff users", to: "/users" },
];

const ASK = [
  "How do I reset a client's authenticator?",
  "How do I sign in as a client to see their portal?",
  "How do I end a staff member's sessions?",
  "How do I issue a temporary password?",
  "How do I answer a support ticket?",
];

export function ItAdminDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const figures = useGetItAdminDashboard<Figures, ApiError>(
    { days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const view = useDashboardCards("it-admin", CARD, DEFAULT_CARDS);
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const linkFor = (key: string) => goTo(...(WORKED_FROM[key] ?? []));
  const data = figures.data;
  const stillOpen = data ? data.tickets.open + data.tickets.inProgress + data.tickets.waiting : 0;
  const active = data ? data.sessions.staff + data.sessions.clients + data.sessions.signedInAs : 0;

  const render: Record<CardId, ReactNode> = {
    tickets: (
      <Panel icon={LifeBuoy} title="Support tickets overview" to={goTo("/support")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={String(stillOpen)} centreLabel="Open tickets"
              rows={[
                { name: "Open", value: data.tickets.open, colour: "#16a34a" },
                { name: "In progress", value: data.tickets.inProgress, colour: "#1d6ee8" },
                { name: "Waiting on the person", value: data.tickets.waiting, colour: "#f59e0b" },
                { name: "Closed in the period", value: data.tickets.closed, colour: "#cbd5e1", apart: true },
              ]} />
            <Strip figures={[
              { label: "Avg. resolution",
                value: data.tickets.averageHoursToResolve == null ? "—" : `${data.tickets.averageHoursToResolve} hrs` },
              { label: "Raised", value: data.tickets.raised },
              { label: "Untouched a day", value: data.tickets.overdue, danger: data.tickets.overdue > 0, to: goTo("/support") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    sessions: (
      <Panel icon={Users} title="Access & sessions" to={goTo("/sign-in-as")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={String(active)} centreLabel="Signed in"
              rows={[
                { name: "Staff sessions", value: data.sessions.staff, colour: "#8b5cf6" },
                { name: "Client sessions", value: data.sessions.clients, colour: "#16a34a" },
                { name: "Sign in as (running)", value: data.sessions.signedInAs, colour: "#f59e0b" },
              ]} />
            <Strip figures={[
              { label: "Sign-ins", value: data.sessions.signInsInPeriod },
              { label: "Sign in as", value: data.sessions.signInsAsInPeriod, to: goTo("/sign-in-as") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    health: (
      <Panel icon={HeartPulse} title="System health">
        {data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CircleCheck className={cn("size-9", data.health.databaseUp ? "text-emerald-600" : "text-red-600")} aria-hidden="true" />
              <div>
                <p className={cn("font-bold", data.health.databaseUp ? "text-emerald-700" : "text-red-700")}>
                  {data.health.databaseUp ? "All systems answering" : "The database is not answering"}
                </p>
                <p className="text-xs text-ink-muted">Checked just now</p>
              </div>
            </div>
            <dl className="divide-y divide-line text-sm">
              <Row label="Database">
                <Badge tone={data.health.databaseUp ? "success" : "danger"}>{data.health.databaseUp ? "Up" : "Down"}</Badge>
              </Row>
              <Row label="API response">{data.health.apiLatencyMillis} ms</Row>
              <Row label="Last bank sync">
                {data.health.lastSyncRunAt ? (
                  <span className="flex items-center gap-2">
                    {formatRelative(data.health.lastSyncRunAt)}
                    {data.health.lastSyncOutcome === "FAILED" && <Badge tone="danger">Failed</Badge>}
                  </span>
                ) : "None yet"}
              </Row>
              <Row label="Background work queued">{data.health.pendingEvents}</Row>
              <Row label="Emails that failed today">
                <span className={cn(data.health.failedEmailsToday > 0 && "text-red-600")}>{data.health.failedEmailsToday}</span>
              </Row>
            </dl>
          </div>
        ) : <Loading />}
      </Panel>
    ),
    users: (
      <Panel icon={UserCog} title="User management" to={goTo("/users")}>
        {data ? <Counts rows={data.users} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    security: (
      <Panel icon={ShieldCheck} title="Security & compliance" to={goTo("/audit-log")}>
        {data ? <Counts rows={data.security} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    links: (
      <Panel icon={Link2} title="Key links">
        <ul className="space-y-1.5">
          {LINKS.filter((one) => reachable.has(one.to)).map((one) => (
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
    assistant: <AskTheAssistant questions={ASK} blurb="Get help with sign-ins, sessions, tickets and how to use the portal." />,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <Monitor className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">IT Admin dashboard</h1>
            <p className="text-sm text-ink-muted">Support, access, user accounts and system health.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomizeButton view={view} />
          <SelectInput id="it-period" aria-label="Period tickets, sign-ins and security events are counted over"
            value={String(days)} onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <LayoutGrid view={view} render={render} screen="IT Admin dashboard" empty="Nothing on your dashboard. Use Customize view to add the cards you want." />
    </div>
  );
}
