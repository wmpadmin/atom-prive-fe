import { ApiError } from "@atomprive/api-client";
import {
  useGetComplianceDashboard,
  useListExpiredClients,
  useListMine,
  useListOnboardingCases,
  type CasePage,
  type ComplianceDashboard as Figures,
  type ExpiredClient,
  type MyDeclarationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, SelectInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSearch,
  FileText,
  History,
  IdCard,
  KeyRound,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { useBookPanel } from "../../components/book-panel";
import { formatRelative } from "../../lib/labels";
import { menuFor } from "../../menu";
import { Chart, ink } from "../book/overview-charts";
import {
  AskTheAssistant,
  Breakdown,
  Counts,
  Loading,
  Panel,
  Strip,
  useDashboardCards,
  type CardMeta,
} from "../dashboard/dashboard-kit";
import { CustomizeButton, LayoutGrid } from "../layout/custom-view";
import { seriesFigure, sharesFigure, singleFigure } from "../layout/own-cards";
import { KindChart, useCardChart } from "../layout/chart-kinds";
import { ClientsInKyc, NoListYet, OwnDeclarationList, type LineLink } from "../dashboard/role-dashboard-lists";

/**
 * Compliance's dashboard: the firm's KYC and AML across the whole book, what is waiting on Compliance, what is
 * about to lapse, and the staff side — declarations and the audit trail. One dashboard with Customize view to
 * move, size and hide cards, the same as the Admin's; every figure opens the screen it was counted from.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "kyc" | "aml" | "queue" | "expiring" | "trail" | "sign-off" | "expired" | "mine" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  kyc: { title: "KYC overview", area: "main", charts: ["donut", "horizontal-bar", "table"] },
  aml: { title: "AML risk overview", area: "main", charts: ["donut", "horizontal-bar", "table"] },
  queue: { title: "Review queue", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  expiring: { title: "Expiring documents", area: "main", charts: ["bar", "horizontal-bar", "donut", "table"] },
  trail: { title: "Declarations & audit", area: "main", charts: ["table", "horizontal-bar", "donut"] },
  "sign-off": { title: "Awaiting your sign-off", area: "main" },
  expired: { title: "KYC expired", area: "main" },
  mine: { title: "Your own declarations", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
};


/** What the dashboard opens on: the four that matter most, chosen 13 Nov 2026; the rest wait in Add cards. A layout someone saved is kept. */
// What the dashboard showed when the portal was set up: what a new person sees, and what Reset to default view brings back.
const DEFAULT_CARDS: CardId[] = ["kyc", "aml", "queue", "expiring", "trail", "assistant"];

/** Which screen each counted line is worked from. A line whose screen the reader's menu lacks has no link. */
const WORKED_FROM: Record<string, string> = {
  "kyc-review": "/kyc-documents",
  "aml-rescore": "/aml-risk",
  "staff-declarations": "/staff-declarations",
  "re-uploads": "/kyc-documents",
  "audit-events": "/audit-log",
  "access-requests": "/family-access-trail",
};

const ICON_FOR: Record<string, LucideIcon> = {
  "kyc-review": FileSearch,
  "aml-rescore": ShieldCheck,
  "staff-declarations": UserCog,
  "re-uploads": Upload,
  "audit-events": History,
  "access-requests": KeyRound,
};

const ASK = [
  "Which clients have KYC papers outstanding?",
  "Which clients' KYC has expired?",
  "Which KYC documents are waiting for review?",
  "How do I approve a KYC document?",
  "How do I record a client's AML rating?",
];

/** The colour a band is drawn in, from what it obliges rather than what the firm called it. */
const DILIGENCE_COLOUR: Record<string, string> = { SIMPLIFIED: "#16a34a", STANDARD: "#f59e0b", ENHANCED: "#dc2626" };

export function ComplianceDashboard() {
  const user = useStaffUser();
  const [days, setDays] = useState(30);
  const figures = useGetComplianceDashboard<Figures, ApiError>(
    { days },
    { query: { placeholderData: keepPreviousData, refetchInterval: 60_000 } },
  );
  const view = useDashboardCards("compliance", CARD, DEFAULT_CARDS);
  // Every screen on the reader's menu, the ones drawn under a section heading included.
  const reachable = useMemo(
    () => new Set(menuFor(user).flatMap((one) => [one.to, ...(one.below ?? []).map((under) => under.to)])),
    [user],
  );
  const goTo = (...screens: string[]) => screens.find((one) => reachable.has(one.split("?")[0]!));
  const linkFor = (key: string) => {
    const to = WORKED_FROM[key];
    return to ? goTo(to) : undefined;
  };
  const data = figures.data;
  const waiting = (data?.queue ?? []).reduce((sum, one) => sum + one.count, 0);
  const panel = useBookPanel();
  // A client's line opens their KYC file, or their client file, whichever the reader's menu reaches.
  const clientLink: LineLink = (id) => (goTo("/kyc") ? `/kyc/${id}` : goTo("/clients") ? `/clients/${id}` : null);
  const kycRows = data ? [
    { name: "Approved", value: data.kyc.approved, statuses: ["APPROVED"] as const },
    { name: "In review", value: data.kyc.inReview, statuses: ["PENDING"] as const },
    { name: "Needs action", value: data.kyc.needsAction, statuses: ["REJECTED", "EXPIRED"] as const },
    { name: "Not started", value: data.kyc.notStarted, statuses: ["NOT_SUBMITTED"] as const },
  ] : [];
  const openKyc = (at: number) => {
    const row = kycRows[at];
    if (!data || !row) return;
    panel?.({ name: `KYC ${row.name.toLowerCase()}`, figure: {
      label: "KYC overview",
      value: String(row.value),
      note: "Clients not archived, by their KYC status.",
      facts: [{ label: "Clients", value: String(data.kyc.clients) }, { label: "Compliant", value: `${data.kyc.compliantPercent}%` }],
      link: goTo("/kyc") ? { to: "/kyc", label: "Open the KYC review" } : undefined,
      more: <>{row.statuses.map((status) => (
        <ClientsInKyc key={status} status={status} title={`Clients — KYC ${status === "PENDING" ? "in review" : status.toLowerCase().replace("_", " ")}`}
          linkFor={clientLink} />
      ))}</>,
    } });
  };
  const amlRows = data ? [
    ...data.aml.bands.map((one) => ({ name: one.name, value: one.clients, share: one.percent as number | undefined, diligence: one.dueDiligence as string | undefined })),
    { name: "Never scored", value: data.aml.neverScored, share: undefined, diligence: undefined },
  ] : [];
  const openAml = (at: number) => {
    const row = amlRows[at];
    if (!data || !row) return;
    panel?.({ name: row.name, figure: {
      label: "AML risk overview",
      value: String(row.value),
      note: row.diligence ? `Clients whose standing AML rating is in this band; ${row.diligence.toLowerCase()} due diligence.` : "Active clients with no AML rating on file.",
      facts: [
        ...(row.share !== undefined ? [{ label: "Share", value: `${row.share}%` }] : []),
        { label: "Clients", value: String(data.aml.clients) },
        { label: "Reassessments due", value: String(data.aml.reassessmentsDue) },
      ],
      link: goTo("/aml-risk") ? { to: "/aml-risk", label: "Open AML risk" } : undefined,
      more: <NoListYet what={row.diligence ? `clients in this band` : "clients never rated"} />,
    } });
  };
  const expiringFacts = data ? [
    { label: "0–30 days", value: String(data.expiring.within30) },
    { label: "31–60 days", value: String(data.expiring.within60) },
    { label: "61–90 days", value: String(data.expiring.within90) },
    { label: "Already expired", value: String(data.expiring.alreadyExpired) },
  ] : [];
  const openExpiring = (name: string, value: number) => panel?.({ name, figure: {
    label: "Expiring documents",
    value: String(value),
    note: "Approved papers by how soon they run out.",
    facts: expiringFacts,
    link: goTo("/kyc") ? { to: "/kyc", label: "Open the KYC review" } : undefined,
    more: <NoListYet what="papers expiring in this window" />,
  } });

  const render: Record<CardId, ReactNode> = {
    kyc: (
      <Panel icon={IdCard} title="KYC overview" to={goTo("/kyc")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={`${data.kyc.compliantPercent}%`} centreLabel="Compliant" onPick={panel ? openKyc : undefined}
              rows={[
                { name: "Approved", value: data.kyc.approved, colour: "#16a34a" },
                { name: "In review", value: data.kyc.inReview, colour: "#f59e0b" },
                { name: "Needs action", value: data.kyc.needsAction, colour: "#dc2626" },
                { name: "Not started", value: data.kyc.notStarted, colour: "#cbd5e1" },
              ]} />
            <Strip figures={[
              { label: "Total clients", value: data.kyc.clients, to: goTo("/clients") },
              { label: "KYC approved", value: data.kyc.approved, onClick: panel ? () => openKyc(0) : undefined },
              { label: "Needs action", value: data.kyc.needsAction, danger: data.kyc.needsAction > 0, to: goTo("/kyc") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    aml: (
      <Panel icon={ShieldCheck} title="AML risk overview" to={goTo("/aml-risk")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={String(data.aml.clients)} centreLabel="Clients" onPick={panel ? openAml : undefined}
              rows={[
                ...data.aml.bands.map((one) => ({ name: one.name, value: one.clients, share: one.percent,
                  colour: DILIGENCE_COLOUR[one.dueDiligence] })),
                { name: "Never scored", value: data.aml.neverScored, colour: "#cbd5e1" },
              ]} />
            <Strip figures={[
              { label: "Reassessments due", value: data.aml.reassessmentsDue, danger: data.aml.reassessmentsDue > 0,
                to: goTo("/aml-risk") },
              { label: "High risk", value: data.aml.highRisk, to: goTo("/aml-risk") },
              { label: "Never scored", value: data.aml.neverScored, danger: data.aml.neverScored > 0, to: goTo("/aml-risk") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    queue: (
      <Panel icon={ClipboardCheck} title={`Review queue${data ? ` (${waiting})` : ""}`} to={goTo("/kyc")}>
        {data ? <Counts rows={data.queue} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    expiring: (
      <Panel icon={CalendarDays} title="Expiring documents" to={goTo("/kyc")}>
        {data ? (
          <div className="space-y-3">
            <ExpiringChart within30={data.expiring.within30} within60={data.expiring.within60} within90={data.expiring.within90}
              onPick={panel ? (at) => openExpiring(`Expiring in ${["0–30", "31–60", "61–90"][at] ?? ""} days`,
                [data.expiring.within30, data.expiring.within60, data.expiring.within90][at] ?? 0) : undefined} />
            <Strip figures={[
              { label: "Next 90 days", value: data.expiring.within30 + data.expiring.within60 + data.expiring.within90,
                onClick: panel ? () => openExpiring("Expiring in the next 90 days",
                  data.expiring.within30 + data.expiring.within60 + data.expiring.within90) : undefined },
              { label: "Next 30 days", value: data.expiring.within30, danger: data.expiring.within30 > 0,
                onClick: panel ? () => openExpiring("Expiring in the next 30 days", data.expiring.within30) : undefined },
              { label: "Already expired", value: data.expiring.alreadyExpired, danger: data.expiring.alreadyExpired > 0,
                to: goTo("/kyc") },
            ]} />
          </div>
        ) : <Loading />}
      </Panel>
    ),
    trail: (
      <Panel icon={Layers} title="Declarations & audit" to={goTo("/audit-log")}>
        {data ? <Counts rows={data.declarations} linkFor={linkFor} iconFor={ICON_FOR} /> : <Loading />}
      </Panel>
    ),
    "sign-off": <SignOff to={goTo("/kyc")} />,
    expired: <Expired to={goTo("/kyc")} />,
    mine: <OwnDeclarations to={goTo("/my-declarations")} />,
    assistant: <AskTheAssistant questions={ASK} blurb="Get answers on KYC, AML, documents and how to use the portal." />,
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">Compliance dashboard</h1>
            <p className="text-sm text-ink-muted">KYC review, AML monitoring, expiring papers and staff declarations.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomizeButton view={view} />
          <SelectInput id="compliance-period" aria-label="Period the audit events are counted over" value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <LayoutGrid view={view} render={render} figures={data ? {
        "kyc.status": sharesFigure("KYC status across the firm", "KYC", [
          { name: "Approved", value: data.kyc.approved }, { name: "In review", value: data.kyc.inReview }, { name: "Needs action", value: data.kyc.needsAction },
          { name: "Not started", value: data.kyc.notStarted },
        ], (value: number) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
        "kyc.compliant": singleFigure("KYC compliant", "KYC", data.kyc.compliantPercent, (value) => `${Math.round(value)}%`, { gauge: true, max: 100 }),
        "aml.bands": sharesFigure("Clients by AML risk band", "AML", [
          ...data.aml.bands.map((one) => ({ name: one.name, value: one.clients })), { name: "Never scored", value: data.aml.neverScored },
        ], (value: number) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
        "expiring.months": seriesFigure("Papers expiring in the next three months", "Documents", ["0–30 days", "31–60 days", "61–90 days"],
          [{ name: "Papers expiring", values: [data.expiring.within30, data.expiring.within60, data.expiring.within90] }], (value: number) => String(Math.round(value)), ["bar", "horizontal-bar", "table"]),
        "queue.counts": sharesFigure("Review queue, counted", "Work", (data.queue).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
        "declarations.counts": sharesFigure("Declarations & audit, counted", "Work", (data.declarations).map((one) => ({ name: one.label, value: one.count })), (value: number) => String(Math.round(value)), ["horizontal-bar", "donut", "bar", "table"]),
      } : undefined} screen="Compliance dashboard" empty="Nothing on your dashboard. Use Customize view to add the cards you want." />
    </div>
  );
}

/** Approved papers by how soon they run out, in three columns of thirty days. */
function ExpiringChart({ within30, within60, within90, onPick }: {
  within30: number; within60: number; within90: number;
  /** Opens one window's papers, by its place: 0–30, 31–60, 61–90 days. */
  onPick?: (index: number) => void;
}) {
  const chart = useCardChart();
  const option = useMemo(() => {
    const c = ink();
    return {
      textStyle: { fontFamily: c.font, color: c.muted },
      grid: { left: 32, right: 8, top: 24, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: ["0–30 days", "31–60 days", "61–90 days"], axisTick: { show: false },
        axisLine: { lineStyle: { color: c.line } }, axisLabel: { color: c.muted, fontSize: 11 } },
      yAxis: { type: "value", minInterval: 1, axisLabel: { color: c.muted }, splitLine: { lineStyle: { color: c.line } } },
      series: [{
        type: "bar", barWidth: "46%", data: [within30, within60, within90],
        label: { show: true, position: "top", color: c.text, fontWeight: "bold" },
        itemStyle: { color: c.primary, borderRadius: [4, 4, 0, 0] },
      }],
    };
  }, [within30, within60, within90]);
  if (chart && !chart.own) {
    return (
      <KindChart kind={chart.kind!} height={200} label="Papers expiring in each of the next three months" format={(value) => String(Math.round(value))}
        data={chart.kind === "donut"
          ? { shape: "shares", items: [{ name: "0–30 days", value: within30 }, { name: "31–60 days", value: within60 }, { name: "61–90 days", value: within90 }] }
          : { shape: "series", categories: ["0–30 days", "31–60 days", "61–90 days"], series: [{ name: "Papers expiring", values: [within30, within60, within90] }] }}
        onPick={onPick} />
    );
  }
  return <Chart option={option} height={170} label={`Papers expiring: ${within30} within 30 days, ${within60} in 31 to 60, ${within90} in 61 to 90`}
    onPick={onPick ? (_, index) => onPick(index) : undefined} />;
}

/** Clients whose papers are all in and approved, waiting on the signature that activates them. */
function SignOff({ to }: { to?: string }) {
  const signing = useListOnboardingCases<CasePage, ApiError>({ signOff: "AWAITING", page: 0, size: 5 });
  const rows = signing.data?.items ?? [];
  return (
    <Panel icon={UserCheck} title={`Awaiting your sign-off${signing.data ? ` (${signing.data.totalItems})` : ""}`} to={to}>
      {!signing.data ? <Loading /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nobody is waiting on a signature.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {rows.map((one) => (
            <li key={one.id}>
              <Link to={`/kyc/cases/${one.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-primary-700">
                <span className="min-w-0 truncate font-medium">{one.clientName}</span>
                <span className="text-xs whitespace-nowrap text-ink-muted">updated {formatRelative(one.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Clients approved once whose papers have since run out. */
function Expired({ to }: { to?: string }) {
  const expired = useListExpiredClients<ExpiredClient[], ApiError>();
  const rows = (expired.data ?? []).slice(0, 5);
  return (
    <Panel icon={ShieldAlert} title={`KYC expired${expired.data ? ` (${expired.data.length})` : ""}`} to={to}>
      {!expired.data ? <Loading /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No approved client has a paper that has run out.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {rows.map((one) => (
            <li key={one.customerId}>
              <Link to={`/kyc/${one.customerId}?from=queue`} className="flex items-center justify-between gap-3 py-2 hover:text-primary-700">
                <span className="min-w-0 truncate font-medium">{one.clientName}</span>
                <span className="flex items-center gap-1 text-xs whitespace-nowrap text-red-700">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  {one.lapsed.map((paper) => paper.kindTitle).join(", ") || "A paper"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** What this person owes the firm themselves: the same nine declarations everybody signs. */
function OwnDeclarations({ to }: { to?: string }) {
  const declarations = useListMine<MyDeclarationRow[], ApiError>();
  const owed = (declarations.data ?? []).filter((one) => !one.signed).length;
  const panel = useBookPanel();
  const open = panel && declarations.data ? () => panel({ name: "Your own declarations", figure: {
    label: "Declarations",
    value: owed === 0 ? "All signed" : `${owed} outstanding`,
    facts: [
      { label: "Asked of you", value: String(declarations.data?.length ?? 0) },
      { label: "Outstanding", value: String(owed) },
      { label: "Overdue", value: String((declarations.data ?? []).filter((one) => !one.signed && one.overdue).length) },
    ],
    link: to ? { to, label: "Open my declarations" } : undefined,
    more: <OwnDeclarationList linkFor={(kind) => (to ? `${to}/${kind}` : null)} />,
  } }) : undefined;
  return (
    <Panel icon={FileText} title="Your own declarations" to={to}>
      <p className={open ? "cursor-pointer text-sm text-ink-muted hover:text-primary-700" : "text-sm text-ink-muted"}
        {...(open ? { role: "button", tabIndex: 0, onClick: open,
          onKeyDown: (event: KeyboardEvent<HTMLParagraphElement>) => { if (event.key === "Enter") open(); } } : {})}>
        {declarations.isError ? "These couldn't be read just now."
          : !declarations.data ? "Reading…"
            : owed === 0 ? "All signed. Nothing is outstanding."
              : owed === 1 ? "One is outstanding." : `${owed} are outstanding.`}
      </p>
    </Panel>
  );
}
