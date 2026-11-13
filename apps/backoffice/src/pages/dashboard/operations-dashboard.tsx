import { ApiError } from "@atomprive/api-client";
import {
  useGetOperationsDashboard,
  useListOnboardingCases,
  type CasePage,
  type OperationsDashboard as Figures,
} from "@atomprive/api-client/backoffice";
import { Alert, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  FileStack,
  Inbox,
  Landmark,
  Link2,
  ListTodo,
  RefreshCw,
  Upload,
  UserMinus,
  UserPlus,
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
  Strip,
  useDashboardCards,
  type CardMeta,
} from "./dashboard-kit";
import { CustomizeButton, LayoutGrid } from "../layout/custom-view";
import { sharesFigure, singleFigure } from "../layout/own-cards";
import { KindChart, useCardChart } from "../layout/chart-kinds";

/**
 * Operations' dashboard: clients being taken on, the prospect pipeline, the bank feeds, the requests Operations
 * answer and what to do next. One dashboard with Customize view to move, size and hide cards, the same as the Admin's and
 * Compliance's; every figure opens the screen it was counted from.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "onboarding" | "pipeline" | "feeds" | "requests" | "to-do" | "applications" | "links" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  onboarding: { title: "Onboarding overview", area: "main", charts: ["donut", "funnel", "horizontal-bar", "table"] },
  pipeline: { title: "Prospects & pipeline", area: "main", charts: ["funnel", "bar", "horizontal-bar", "table"] },
  feeds: { title: "Bank feed health", area: "main", charts: ["donut", "horizontal-bar", "table"] },
  requests: { title: "Open requests", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  "to-do": { title: "To do", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  applications: { title: "Applications in progress", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  links: { title: "Key links", area: "side" },
};


/** What the dashboard opens on: the four that matter most, chosen 13 Nov 2026; the rest wait in Add cards. A layout someone saved is kept. */
// What the dashboard showed when the portal was set up: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS: CardId[] = ["onboarding", "pipeline", "feeds", "requests", "to-do", "assistant"];

/** Which screen each counted line is worked from. A line whose screen the reader's menu lacks has no link. */
const WORKED_FROM: Record<string, string[]> = {
  "family-invites": ["/clients"],
  // Not the access trail: that is the audit log, which Operations do not read. The clients are where it is done.
  "family-access": ["/clients"],
  deactivations: ["/deactivation-requests"],
  "re-uploads": ["/client-documents", "/clients"],
  "feeds-failed": ["/sync-errors", "/ingestion"],
  "follow-ups": ["/prospective-clients"],
  "missing-papers": ["/client-documents", "/clients"],
  applications: ["/clients"],
};

const ICON_FOR: Record<string, LucideIcon> = {
  "family-invites": UserPlus,
  "family-access": Users,
  deactivations: UserMinus,
  "re-uploads": Upload,
  "feeds-failed": RefreshCw,
  "follow-ups": Users,
  "missing-papers": FileStack,
  applications: ClipboardList,
};

const LINKS: { label: string; to: string }[] = [
  { label: "Prospective clients", to: "/prospective-clients" },
  { label: "All clients", to: "/clients" },
  { label: "Deactivation requests", to: "/deactivation-requests" },
  { label: "Bank feeds", to: "/ingestion" },
  { label: "Client documents", to: "/client-documents" },
];

const ASK = [
  "Which clients are still being onboarded?",
  "Which clients haven't sent their KYC papers?",
  "How do I onboard a new client?",
  "How do I raise a deactivation request?",
  "How do I assign a client to a relationship manager?",
];

export function OperationsDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const figures = useGetOperationsDashboard<Figures, ApiError>(
    { days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const view = useDashboardCards("operations", CARD, DEFAULT_CARDS);
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const linkFor = (key: string) => goTo(...(WORKED_FROM[key] ?? []));
  const data = figures.data;
  const period = PERIODS.find((one) => one.days === days)?.label.toLowerCase() ?? `last ${days} days`;

  const render: Record<CardId, ReactNode> = {
    onboarding: (
      <Panel icon={Users} title="Onboarding overview" to={goTo("/clients")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown
              centre={String(data.onboarding.fillingIn + data.onboarding.awaitingClient + data.onboarding.inReview)}
              centreLabel="Onboarding"
              rows={[
                { name: "Application being filled in", value: data.onboarding.fillingIn, colour: "#1d6ee8" },
                { name: "Waiting on the client", value: data.onboarding.awaitingClient, colour: "#f59e0b" },
                { name: "KYC with Compliance", value: data.onboarding.inReview, colour: "#8b5cf6" },
                { name: `Activated, ${period}`, value: data.onboarding.activated, colour: "#16a34a", apart: true },
              ]} />
            <Strip figures={[
              { label: "New intakes", value: data.onboarding.newIntakes, change: data.onboarding.newIntakesChangePercent },
              { label: "Activated", value: data.onboarding.activated },
              { label: "Avg. time to activate",
                value: data.onboarding.averageDaysToActivate == null ? "—" : `${Math.round(data.onboarding.averageDaysToActivate)} days` },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    pipeline: (
      <Panel icon={Building2} title="Prospects & pipeline" to={goTo("/prospective-clients", "/client-management")}>
        {data ? (
          <div className="space-y-4">
            <Funnel stages={[
              { label: "New", value: data.pipeline.fresh },
              { label: "In discussion", value: data.pipeline.inDiscussion },
              { label: "Follow-up", value: data.pipeline.followUp },
              { label: "Qualified", value: data.pipeline.qualified },
              { label: "Converted", value: data.pipeline.converted, done: true },
            ]} />
            <Strip figures={[
              { label: "Conversion rate", value: data.pipeline.conversionPercent == null ? "—" : `${data.pipeline.conversionPercent}%` },
              { label: "Open prospects", value: data.pipeline.open, to: goTo("/prospective-clients") },
              { label: "Stalled (>14 days)", value: data.pipeline.stalled, danger: data.pipeline.stalled > 0,
                to: goTo("/prospective-clients") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    feeds: (
      <Panel icon={Landmark} title="Bank feed health" to={goTo("/ingestion")}>
        {data ? (
          <div className="space-y-4">
            {data.feeds.succeeded + data.feeds.failed + data.feeds.running === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No bank feed has run in the {period}.</p>
            ) : (
              <Breakdown centre={data.feeds.successPercent == null ? "—" : `${data.feeds.successPercent}%`} centreLabel="Success"
                rows={[
                  { name: "Succeeded", value: data.feeds.succeeded, colour: "#16a34a" },
                  { name: "Failed", value: data.feeds.failed, colour: "#dc2626" },
                  { name: "Running", value: data.feeds.running, colour: "#f59e0b" },
                ]} />
            )}
            <Strip figures={[
              { label: "Runs", value: data.feeds.succeeded + data.feeds.failed + data.feeds.running },
              { label: "Success rate", value: data.feeds.successPercent == null ? "—" : `${data.feeds.successPercent}%` },
              { label: "Failed", value: data.feeds.failed, danger: data.feeds.failed > 0, to: goTo("/sync-errors", "/ingestion") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    requests: (
      <Panel icon={Inbox} title={`Open requests${data ? ` (${data.requests.reduce((sum, one) => sum + one.count, 0)})` : ""}`}>
        {data ? <Counts rows={data.requests} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    "to-do": (
      <Panel icon={ListTodo} title="To do">
        {data ? <Counts rows={data.toDo} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    applications: <Applications to={goTo("/clients")} />,
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
    assistant: <AskTheAssistant questions={ASK} blurb="Get answers on onboarding, clients, deactivation and how to use the portal." />,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <ClipboardList className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Operations dashboard</h1>
            <p className="text-sm text-ink-muted">Client onboarding, prospects, deactivation and bank feeds.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomizeButton view={view} />
          <SelectInput id="operations-period" aria-label="Period new intakes, activations and feed runs are counted over"
            value={String(days)} onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <LayoutGrid view={view} render={render} figures={data ? {
        "onboarding.stage": sharesFigure("Clients in onboarding, by stage", "Onboarding", [
          { name: "Application being filled in", value: data.onboarding.fillingIn }, { name: "Waiting on the client", value: data.onboarding.awaitingClient },
          { name: "KYC with Compliance", value: data.onboarding.inReview },
        ], (value: number) => String(Math.round(value)), ["funnel", "donut", "horizontal-bar", "table"]),
        "onboarding.activated": singleFigure("Clients activated in the period", "Onboarding", data.onboarding.activated, (value: number) => String(Math.round(value))),
        "feeds.runs": sharesFigure("Bank feed runs by outcome", "Bank feeds", [
          { name: "Succeeded", value: data.feeds.succeeded }, { name: "Failed", value: data.feeds.failed }, { name: "Running", value: data.feeds.running },
        ], (value: number) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
        "feeds.success": singleFigure("Bank feed success rate", "Bank feeds", data.feeds.successPercent, (value) => `${Math.round(value)}%`, { gauge: true, max: 100 }),
        "requests.counts": sharesFigure("Open requests, counted", "Work", (data.requests).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
        "todo.counts": sharesFigure("To do, counted", "Work", (data.toDo).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
      } : undefined} screen="Operations dashboard" empty="Nothing on your dashboard. Use Customize view to add the cards you want." />
    </div>
  );
}

/** The pipeline as one arrow of stages, the converted stage lit as the one that counts. */
function Funnel({ stages }: { stages: { label: string; value: number; done?: boolean }[] }) {
  const chart = useCardChart();
  if (chart && !chart.own) {
    return (
      <KindChart kind={chart.kind!} height={220} label="Clients at each stage of the pipeline" format={(value) => String(Math.round(value))}
        data={{ shape: "shares", items: stages.map((one) => ({ name: one.label, value: one.value })) }} />
    );
  }
  return (
    <ol className="flex">
      {stages.map((one, index) => (
        <li key={one.label}
          className={cn("relative min-w-0 flex-1 py-3 pr-3 pl-5 text-center",
            one.done ? "bg-emerald-600 text-white" : index % 2 === 0 ? "bg-primary-50" : "bg-primary-100/70",
            index === 0 && "rounded-l-xl pl-3")}
          style={{ clipPath: index === stages.length - 1
            ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)"
            : index === 0 ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
              : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)" }}>
          <span className={cn("block text-xs leading-tight", one.done ? "text-white/90" : "text-ink-muted")}>{one.label}</span>
          <span className="block text-lg font-bold tabular-nums">{one.value}</span>
        </li>
      ))}
    </ol>
  );
}

/** Applications still being filled in, most recently touched first. */
function Applications({ to }: { to?: string }) {
  const cases = useListOnboardingCases<CasePage, ApiError>({ status: "IN_PROCESS", page: 0, size: 5 });
  const rows = cases.data?.items ?? [];
  return (
    <Panel icon={ClipboardList} title={`Applications in progress${cases.data ? ` (${cases.data.totalItems})` : ""}`} to={to}>
      {!cases.data ? <Loading /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No application is being filled in.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {rows.map((one) => (
            <li key={one.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate font-medium">{one.clientName}</span>
              <span className="text-xs whitespace-nowrap text-ink-muted">updated {formatRelative(one.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
