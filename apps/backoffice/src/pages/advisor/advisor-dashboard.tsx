import { ApiError } from "@atomprive/api-client";
import {
  useGetRelationshipManagerDashboard,
  useListCurrencies,
  useListPacksToSign,
  type Currency,
  type RelationshipManagerDashboard as Figures,
  type SignaturePackPage,
} from "@atomprive/api-client/backoffice";
import { Alert, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CalendarClock,
  ChevronRight,
  FileSignature,
  FileStack,
  Gem,
  IdCard,
  Layers,
  Link2,
  ListChecks,
  PhoneCall,
  TrendingUp,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { menuFor } from "../../menu";
import {
  AskTheAssistant,
  Breakdown,
  Counts,
  Loading,
  Panel,
  Strip,
  money,
  useDashboardCards,
  type CardMeta,
} from "../dashboard/dashboard-kit";
import { CustomizeButton, LayoutGrid } from "../layout/custom-view";
import { sharesFigure, singleFigure } from "../layout/own-cards";

/**
 * A relationship manager's dashboard: their own clients and nobody else's — where each stands, what waits on
 * their answer, and who to chase. One dashboard with Customize view to move, size and hide cards, the same as every other
 * role's; every figure opens the screen it was counted from.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "clients" | "approvals" | "kyc" | "portfolios" | "chase" | "signatures" | "links" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  clients: { title: "My clients overview", area: "main", charts: ["donut", "horizontal-bar", "mindmap", "table"] },
  approvals: { title: "My approvals & actions", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  kyc: { title: "KYC status (my clients)", area: "main", charts: ["donut", "horizontal-bar", "table"] },
  portfolios: { title: "Portfolio summary", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  chase: { title: "Client engagement & chase", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  signatures: { title: "Waiting on your signature", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
  links: { title: "Key links", area: "side" },
};


/** What the dashboard opens on: the four that matter most, chosen 13 Nov 2026; the rest wait in Add cards. A layout someone saved is kept. */
const DEFAULT_CARDS: CardId[] = ["clients", "approvals", "kyc", "portfolios"];

/** Which screen each counted line is worked from. A line whose screen the reader's menu lacks has no link. */
const WORKED_FROM: Record<string, string[]> = {
  proposals: ["/approvals?queue=proposals"],
  "portfolio-changes": ["/approvals"],
  "owned-assets": ["/approvals?queue=owned-assets"],
  clearances: ["/my-clearances"],
  "kyc-to-chase": ["/my-clients"],
  "papers-expiring": ["/my-clients"],
  "follow-ups": ["/prospective-clients"],
  "off-plan": ["/my-clients"],
  "model-changes": ["/approvals?queue=model-changes"],
};

const ICON_FOR: Record<string, LucideIcon> = {
  proposals: ListChecks,
  "portfolio-changes": ArrowLeftRight,
  "owned-assets": Gem,
  clearances: UserMinus,
  "kyc-to-chase": FileStack,
  "papers-expiring": CalendarClock,
  "follow-ups": PhoneCall,
  "off-plan": TrendingUp,
  "model-changes": Layers,
};

const LINKS: { label: string; to: string }[] = [
  { label: "My clients", to: "/my-clients" },
  { label: "Approvals", to: "/approvals" },
  { label: "Forms to sign", to: "/to-sign" },
  { label: "My clearance requests", to: "/my-clearances" },
];

const ASK = [
  "Which of my clients have KYC papers outstanding?",
  "List my pending approvals.",
  "Which of my clients' KYC has expired?",
  "How do I send a KYC reminder to a client?",
  "How do I raise a deactivation request?",
];

export function AdvisorDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState("USD");
  const figures = useGetRelationshipManagerDashboard<Figures, ApiError>(
    { currency, days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const currencies = useListCurrencies<Currency[], ApiError>();
  const view = useDashboardCards("relationship-manager", CARD, DEFAULT_CARDS);
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const linkFor = (key: string) => goTo(...(WORKED_FROM[key] ?? []));
  const data = figures.data;
  const cur = data?.currency ?? currency;
  const waiting = (data?.approvals ?? []).reduce((sum, one) => sum + one.count, 0);

  const render: Record<CardId, ReactNode> = {
    clients: (
      <Panel icon={Users} title="My clients overview" to={goTo("/my-clients")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={String(data.clients.total)} centreLabel="Clients"
              rows={[
                { name: "Active", value: data.clients.active, colour: "#16a34a" },
                { name: "Onboarding", value: data.clients.onboarding, colour: "#8b5cf6" },
                { name: "KYC expired", value: data.clients.kycExpired, colour: "#f59e0b" },
                { name: "Deactivation", value: data.clients.deactivating, colour: "#0ea5e9", apart: true },
              ]} />
            <Strip figures={[
              { label: "AUM (my clients)", value: money(data.clients.aum, cur), change: data.clients.aumChangePercent },
              { label: "New clients", value: data.clients.newClients },
              { label: "Papers expiring", value: data.clients.papersExpiring, danger: data.clients.papersExpiring > 0,
                to: goTo("/my-clients") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    approvals: (
      <Panel icon={Layers} title={`My approvals & actions${data ? ` (${waiting})` : ""}`} to={goTo("/approvals")}>
        {data ? <Counts rows={data.approvals} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    kyc: (
      <Panel icon={IdCard} title="KYC status (my clients)" to={goTo("/my-clients")}>
        {data ? (
          <Breakdown centre={`${data.kyc.completePercent}%`} centreLabel="KYC complete"
            rows={[
              { name: "Approved", value: data.kyc.approved, colour: "#16a34a" },
              { name: "In review", value: data.kyc.inReview, colour: "#f59e0b" },
              { name: "Needs action", value: data.kyc.needsAction, colour: "#dc2626" },
              { name: "Not started", value: data.kyc.notStarted, colour: "#cbd5e1" },
            ]} />
        ) : <Loading />}
      </Panel>
    ),
    portfolios: (
      <Panel icon={TrendingUp} title="Portfolio summary" to={goTo("/my-clients")}>
        {data ? (
          <div className="space-y-3">
            <Strip figures={[
              { label: "AUM (my clients)", value: money(data.clients.aum, cur), change: data.clients.aumChangePercent },
              { label: "With a portfolio", value: data.portfolios.withPortfolio },
            ]} />
            <Counts linkFor={linkFor} iconFor={ICON_FOR} rows={[
              { key: "off-plan", label: "Clients off plan (drift)", count: data.portfolios.offPlan },
              { key: "proposals", label: "Proposals in draft", count: data.portfolios.drafts },
              { key: "model-changes", label: "Model switches waiting", count: data.portfolios.modelChanges },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    chase: (
      <Panel icon={PhoneCall} title="Client engagement & chase" to={goTo("/my-clients")}>
        {data ? <Counts rows={data.chase} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    signatures: <Signatures to={goTo("/to-sign")} />,
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
    assistant: <AskTheAssistant questions={ASK} blurb="Get insights on your clients, approvals, KYC and next actions." />,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Relationship manager dashboard</h1>
            <p className="text-sm text-ink-muted">Your clients, approvals, KYC and portfolio oversight.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomizeButton view={view} />
          <SelectInput id="rm-period" aria-label="Period the changes are measured over" value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
          <SelectInput id="rm-currency" aria-label="Currency the figures are shown in" value={currency}
            onChange={(event) => setCurrency(event.target.value)} className="w-28">
            {(currencies.data ?? [{ code: "USD", name: "US dollar" }]).map((one) => (
              <option key={one.code} value={one.code}>{one.code}</option>
            ))}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <LayoutGrid view={view} render={render} figures={data ? {
        "clients.status": sharesFigure("My clients by status", "Clients", [
          { name: "Active", value: data.clients.active }, { name: "Onboarding", value: data.clients.onboarding }, { name: "KYC expired", value: data.clients.kycExpired },
          { name: "Deactivation", value: data.clients.deactivating },
        ], (value: number) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
        "clients.total": singleFigure("My clients", "Clients", data.clients.total, (value: number) => String(Math.round(value))),
        "kyc.status": sharesFigure("KYC status of my clients", "KYC", [
          { name: "Approved", value: data.kyc.approved }, { name: "In review", value: data.kyc.inReview }, { name: "Needs action", value: data.kyc.needsAction },
          { name: "Not started", value: data.kyc.notStarted },
        ], (value: number) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
        "kyc.complete": singleFigure("KYC complete", "KYC", data.kyc.completePercent, (value) => `${Math.round(value)}%`, { gauge: true, max: 100 }),
        "approvals.counts": sharesFigure("My approvals & actions, counted", "Work", (data.approvals).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
        "chase.counts": sharesFigure("Client engagement & chase, counted", "Work", (data.chase).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
      } : undefined} screen="Relationship Manager dashboard" empty="Nothing on your dashboard. Use Customize view to add the cards you want." />
    </div>
  );
}

/** Onboarding packs waiting on this manager's signature. */
function Signatures({ to }: { to?: string }) {
  const toSign = useListPacksToSign<SignaturePackPage, ApiError>({ size: 1 });
  return (
    <Panel icon={FileSignature} title="Waiting on your signature" to={to}>
      <p className="text-sm text-ink-muted">
        {toSign.isError ? "These couldn't be counted just now."
          : !toSign.data ? "Counting…"
            : toSign.data.totalItems === 0 ? "Nothing is waiting on your signature."
              : toSign.data.totalItems === 1 ? "One pack is waiting on your signature."
                : `${toSign.data.totalItems} packs are waiting on your signature.`}
      </p>
    </Panel>
  );
}
