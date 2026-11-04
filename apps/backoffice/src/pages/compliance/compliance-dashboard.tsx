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
import { Alert, SelectInput, cn } from "@atomprive/ui";
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
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { menuFor } from "../../menu";
import { Chart, ink } from "../book/overview-charts";
import {
  AskTheAssistant,
  Breakdown,
  CardGrid,
  Counts,
  EditCards,
  Loading,
  Panel,
  useDashboardCards,
  type CardMeta,
} from "../dashboard/dashboard-kit";

/**
 * Compliance's dashboard: the firm's KYC and AML across the whole book, what is waiting on Compliance, what is
 * about to lapse, and the staff side — declarations and the audit trail. One dashboard with Edit view to tick
 * cards on and off, the same as the Admin's; every figure opens the screen it was counted from.
 */

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

type CardId = "kyc" | "aml" | "queue" | "expiring" | "trail" | "sign-off" | "expired" | "mine" | "assistant";

const CARD: Record<CardId, CardMeta> = {
  kyc: { title: "KYC overview", area: "main" },
  aml: { title: "AML risk overview", area: "main" },
  queue: { title: "Review queue", area: "main" },
  expiring: { title: "Expiring documents", area: "main" },
  trail: { title: "Declarations & audit", area: "main" },
  "sign-off": { title: "Awaiting your sign-off", area: "main" },
  expired: { title: "KYC expired", area: "main" },
  mine: { title: "Your own declarations", area: "main" },
  assistant: { title: "AI Assistant", area: "side" },
};

const CARD_IDS = Object.keys(CARD) as CardId[];

/** What the dashboard opens on, as the firm drew it on 4 Nov 2026; the rest are under Edit view. */
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
  const view = useDashboardCards("compliance", CARD_IDS, DEFAULT_CARDS);
  const [editing, setEditing] = useState(false);
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

  const render: Record<CardId, ReactNode> = {
    kyc: (
      <Panel icon={IdCard} title="KYC overview" to={goTo("/kyc")}>
        {data ? (
          <div className="space-y-4">
            <Breakdown centre={`${data.kyc.compliantPercent}%`} centreLabel="Compliant"
              rows={[
                { name: "Approved", value: data.kyc.approved, colour: "#16a34a" },
                { name: "In review", value: data.kyc.inReview, colour: "#f59e0b" },
                { name: "Needs action", value: data.kyc.needsAction, colour: "#dc2626" },
                { name: "Not started", value: data.kyc.notStarted, colour: "#cbd5e1" },
              ]} />
            <Strip figures={[
              { label: "Total clients", value: data.kyc.clients, to: goTo("/clients") },
              { label: "KYC approved", value: data.kyc.approved },
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
            <Breakdown centre={String(data.aml.clients)} centreLabel="Clients"
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
            <ExpiringChart within30={data.expiring.within30} within60={data.expiring.within60} within90={data.expiring.within90} />
            <Strip figures={[
              { label: "Next 90 days", value: data.expiring.within30 + data.expiring.within60 + data.expiring.within90 },
              { label: "Next 30 days", value: data.expiring.within30, danger: data.expiring.within30 > 0 },
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
          <EditCards meta={CARD} shown={view.cards} editing={editing} onEditing={setEditing} onChange={view.change}
            changed={view.changed} onReset={view.reset} />
          <SelectInput id="compliance-period" aria-label="Period the audit events are counted over" value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))} className="w-40">
            {PERIODS.map((one) => <option key={one.days} value={one.days}>{one.label}</option>)}
          </SelectInput>
        </div>
      </header>

      {figures.isError && <Alert tone="danger">{figures.error.message}</Alert>}

      <CardGrid meta={CARD} shown={view.cards} render={render} editing={editing} onChange={view.change} />
    </div>
  );
}

/** A row of figures under a ring, each opening the screen it was counted from. */
function Strip({ figures }: { figures: { label: string; value: number; danger?: boolean; to?: string }[] }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-xl bg-slate-50 px-1 py-2.5">
      {figures.map((one) => {
        const body = (
          <>
            <dt className="text-xs text-ink-muted">{one.label}</dt>
            <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", one.danger && "text-red-600")}>{one.value}</dd>
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

/** Approved papers by how soon they run out, in three columns of thirty days. */
function ExpiringChart({ within30, within60, within90 }: { within30: number; within60: number; within90: number }) {
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
  return <Chart option={option} height={170} label={`Papers expiring: ${within30} within 30 days, ${within60} in 31 to 60, ${within90} in 61 to 90`} />;
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
  return (
    <Panel icon={FileText} title="Your own declarations" to={to}>
      <p className="text-sm text-ink-muted">
        {declarations.isError ? "These couldn't be read just now."
          : !declarations.data ? "Reading…"
            : owed === 0 ? "All signed. Nothing is outstanding."
              : owed === 1 ? "One is outstanding." : `${owed} are outstanding.`}
      </p>
    </Panel>
  );
}
