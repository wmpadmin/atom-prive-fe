import { useGetClientManagementOverview, type Activity, type ProspectPipeline } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import {
  Archive,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CircleCheck,
  FileUp,
  Info,
  Mail,
  MessageSquare,
  UserPlus,
  UserRound,
  UsersRound,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { menuFor } from "../../menu";


const MARKS: Record<string, { icon: LucideIcon; tone: string }> = {
  added: { icon: UserPlus, tone: "bg-violet-50 text-violet-600" },
  emailed: { icon: Mail, tone: "bg-primary-50 text-primary-600" },
  followed_up: { icon: MessageSquare, tone: "bg-primary-50 text-primary-600" },
  converted: { icon: ArrowLeftRight, tone: "bg-violet-50 text-violet-600" },
  lost: { icon: UserX, tone: "bg-slate-100 text-slate-500" },
  registered: { icon: UserRound, tone: "bg-primary-50 text-primary-600" },
  document: { icon: FileUp, tone: "bg-primary-50 text-primary-600" },
  kyc_approved: { icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
  approved: { icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
};

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/**
 * Client Management at a glance: prospects and clients counted, where onboarding has got to, what is waiting,
 * how many prospects became clients, and what happened lately. A relationship manager sees their own.
 */
export function ClientManagementOverviewPage() {
  const user = useStaffUser();
  const overview = useGetClientManagementOverview();
  const data = overview.data;
  // Only what this reader may open is a link; the rest is shown and goes nowhere.
  const reachable = new Set(menuFor(user).flatMap((item) => [item.to, ...item.below.map((under) => under.to)]));
  const clientsAt = reachable.has("/my-clients") ? "/my-clients" : "/clients";
  const can = (to: string) => (reachable.has(to) ? to : undefined);
  // Prospects, clients and — for Admin and Operations only — deactivated clients, each its own colour.
  // Each part opens the list it counts, where this reader may open it.
  const parts = [
    { key: "prospects", label: "Prospective", colour: "#7c3aed", value: data?.prospects ?? 0,
      to: can("/prospective-clients") && "/prospective-clients?from=overview" },
    { key: "clients", label: "Clients", colour: "#1d6ee8", value: data?.clients ?? 0,
      to: can(clientsAt) && `${clientsAt}?from=overview` },
    ...(data?.deactivated == null ? [] : [{ key: "deactivated", label: "Deactivated", colour: "#cbd5e1", value: data.deactivated,
      to: can("/archived-clients") && "/archived-clients?from=overview" }]),
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Client Management – Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage prospective clients and clients (onboarding and active) at a glance.</p>
      </header>

      <div className={cn("grid gap-4 sm:grid-cols-2", data?.deactivated == null ? "xl:grid-cols-2" : "xl:grid-cols-3")}>
        <Tile to={can("/prospective-clients") && "/prospective-clients?from=overview"} icon={UsersRound} tone="bg-violet-50 text-violet-600" title="Prospective Clients"
          count={data?.prospects} thisMonth={data?.prospectsThisMonth} />
        <Tile to={can(clientsAt) && `${clientsAt}?from=overview`} icon={UserRound} tone="bg-primary-50 text-primary-600" title="Clients"
          count={data?.clients} thisMonth={data?.clientsThisMonth} />
        {data?.deactivated != null && (
          <Tile to={can("/archived-clients") && "/archived-clients?from=overview"} icon={Archive} tone="bg-slate-100 text-slate-500" title="Deactivated" count={data.deactivated} />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Client Status Distribution">
          <div className="flex flex-wrap items-center gap-8">
            <Ring total={total} parts={parts} />
            <ul className="min-w-48 flex-1 space-y-4 text-sm">
              {parts.map((part) => {
                const value = part.value;
                const row = (
                  <>
                    <span className="size-2.5 rounded-full" style={{ background: part.colour }} aria-hidden="true" />
                    <span>{part.label}</span>
                    <span className="font-semibold tabular-nums">{value} ({total ? Math.round((value / total) * 100) : 0}%)</span>
                  </>
                );
                const grid = "grid grid-cols-[0.75rem_1fr_auto] items-center gap-3";
                return (
                  <li key={part.key}>
                    {part.to ? (
                      <Link to={part.to} className={cn(grid, "-mx-2 rounded-lg px-2 py-1 hover:bg-slate-50")}>{row}</Link>
                    ) : (
                      <div className={cn(grid, "py-1")}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>

        <Panel title="Prospect Pipeline" action={can("/prospective-clients") && <HeaderLink to="/prospective-clients?from=overview">View All</HeaderLink>}>
          <Pipeline pipeline={data?.pipeline} to={can("/prospective-clients")} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Client Conversion" info="Prospective clients converted to clients, by calendar month.">
          <Conversion months={data?.conversion.months ?? []} thisMonth={data?.conversion.thisMonth ?? 0} />
        </Panel>

        <Panel title="Recent Activity" action={can("/audit-log") && <HeaderLink to="/audit-log">View All</HeaderLink>}>
          <ul className="divide-y divide-line">
            {(data?.activity ?? []).map((line, index) => (
              <ActivityLine key={`${line.at}-${index}`} line={line} to={linkFor(line, clientsAt, can)} />
            ))}
            {data && data.activity.length === 0 && <li className="py-6 text-sm text-ink-muted">Nothing has happened yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function linkFor(line: Activity, clientsAt: string, can: (to: string) => string | undefined) {
  if (line.prospectId) return can("/prospective-clients") && `/prospective-clients?open=${line.prospectId}&from=overview`;
  if (line.kind === "approved" && line.onboardingCaseId) return `/onboarding/${line.onboardingCaseId}`;
  if (line.clientId) return can(clientsAt) && `${clientsAt}/${line.clientId}`;
  return undefined;
}

function Panel({ title, info, action, children }: { title: string; info?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {title}
          {info && (
            <span title={info} className="text-ink-muted">
              <Info className="size-4" aria-hidden="true" />
              <span className="sr-only">{info}</span>
            </span>
          )}
        </h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700">
      {children} <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function Tile({ to, icon: Icon, tone, title, count, thisMonth }: {
  to: string | undefined;
  icon: LucideIcon;
  tone: string;
  title: string;
  count: number | undefined;
  thisMonth?: number;
}) {
  const body = (
    <>
      <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", tone)}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-3xl font-extrabold tabular-nums">{count ?? "–"}</span>
        {thisMonth !== undefined && (
          <span className={cn("flex items-center gap-1 text-xs font-semibold", thisMonth > 0 ? "text-emerald-700" : "text-ink-muted")}>
            {thisMonth > 0 && <ArrowUp className="size-3.5" aria-hidden="true" />}
            {thisMonth > 0 ? `+${thisMonth}` : "None"} this month
          </span>
        )}
      </span>
    </>
  );
  const box = "group flex items-center gap-4 rounded-2xl border border-line bg-white p-5";
  return to ? <Link to={to} className={cn(box, "hover:border-primary-200")}>{body}</Link> : <div className={box}>{body}</div>;
}

/** The four stages an open prospect moves through, in order, each in its status colour. */
const STAGES = [
  { key: "newProspects", status: "NEW", label: "New", colour: "bg-primary-600" },
  { key: "inDiscussion", status: "IN_DISCUSSION", label: "In Discussion", colour: "bg-amber-500" },
  { key: "followUp", status: "FOLLOW_UP", label: "Follow Up", colour: "bg-violet-500" },
  { key: "qualified", status: "QUALIFIED", label: "Qualified", colour: "bg-emerald-500" },
] as const;

/** How many open prospects are at each stage; each opens the list at that stage. */
function Pipeline({ pipeline, to }: { pipeline: ProspectPipeline | undefined; to: string | undefined }) {
  const largest = Math.max(1, ...STAGES.map((stage) => pipeline?.[stage.key] ?? 0));
  return (
    <ul className="space-y-2">
      {STAGES.map((stage) => {
        const count = pipeline?.[stage.key] ?? 0;
        const body = (
          <>
            <span className="w-28 shrink-0 text-sm font-semibold">{stage.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span className={cn("block h-full rounded-full", stage.colour)} style={{ width: `${(count / largest) * 100}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">{pipeline ? count : "–"}</span>
          </>
        );
        return (
          <li key={stage.key}>
            {to ? (
              <Link to={`${to}?status=${stage.status}&from=overview`} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-2.5 hover:bg-slate-50">{body}</Link>
            ) : (
              <div className="flex items-center gap-4 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActivityLine({ line, to }: { line: Activity; to: string | undefined }) {
  const mark = MARKS[line.kind] ?? MARKS.registered;
  const Icon = mark.icon;
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", mark.tone)}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{line.subject}</span> — {line.what}
        <span className="block text-xs text-ink-muted">{formatDateTime(line.at)}{line.by ? ` · ${line.by}` : ""}</span>
      </span>
    </>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 hover:bg-slate-50">{body}</Link>
      ) : (
        <div className="flex items-center gap-4 py-3">{body}</div>
      )}
    </li>
  );
}

/** Prospects converted each month as a line, this month marked, with this month's figure under it. */
function Conversion({ months, thisMonth }: { months: { month: string; count: number }[]; thisMonth: number }) {
  const highest = Math.max(4, ...months.map((one) => one.count));
  const step = Math.ceil(highest / 4);
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((at) => at * step);
  // Drawn on one fixed grid that scales with the card: room on the left for the counts and the axis name,
  // underneath for the months and theirs.
  const width = 520;
  const height = 240;
  const left = 52;
  const right = 20;
  const plotTop = 24;
  const plotBottom = 190;
  const x = (index: number) => left + (months.length > 1 ? (index * (width - left - right)) / (months.length - 1) : 0);
  const y = (count: number) => plotBottom - (count / top) * (plotBottom - plotTop);
  const points = months.map((one, index) => ({ ...one, x: x(index), y: y(one.count) }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1)!.x},${plotBottom} L${points[0].x},${plotBottom} Z` : "";
  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
        aria-label={`Clients converted by month: ${months.map((one) => `${MONTH.format(new Date(one.month))} ${one.count}`).join(", ")}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" />
            <text x={left - 10} y={y(tick)} dy="0.35em" textAnchor="end" fontSize="12" fill="var(--color-ink-muted)">{tick}</text>
          </g>
        ))}
        <path d={area} fill="#7c3aed" fillOpacity="0.08" />
        <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const current = index === points.length - 1;
          return (
            <g key={point.month}>
              <circle cx={point.x} cy={point.y} r={current ? 6 : 4.5} fill={current ? "#7c3aed" : "white"} stroke="#7c3aed" strokeWidth="2">
                <title>{`${point.count} converted in ${MONTH.format(new Date(point.month))}`}</title>
              </circle>
              {current && (
                <text x={point.x} y={point.y - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#7c3aed">{point.count}</text>
              )}
              <text x={point.x} y={plotBottom + 22} textAnchor="middle" fontSize="12.5" fill="var(--color-ink-soft)">
                {MONTH.format(new Date(point.month))}
              </text>
            </g>
          );
        })}
        {/* What the axes are: the count up the side, the month along the bottom. */}
        <text x="12" y={(plotTop + plotBottom) / 2} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--color-ink-muted)"
          transform={`rotate(-90 12 ${(plotTop + plotBottom) / 2})`}>Clients converted</text>
        <text x={(left + width - right) / 2} y={height - 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--color-ink-muted)">Month</text>
      </svg>
      <p className="border-t border-line pt-4 text-sm text-ink-soft">
        <span className="font-bold text-ink tabular-nums">{thisMonth}</span> converted to client this month
      </p>
    </div>
  );
}

/** A ring with each part's share of the whole, and the whole in the middle. */
function Ring({ total, parts }: {
  total: number;
  parts: { key: string; label: string; colour: string; value: number; to?: string | false }[];
}) {
  const navigate = useNavigate();
  const radius = 15.9155; // a circumference of 100, so each part's length is its percentage
  const arcs = parts.reduce<{ key: string; label: string; colour: string; share: number; offset: number; value: number; to?: string | false }[]>((drawn, part) => {
    const offset = drawn.reduce((sum, one) => sum + one.share, 0);
    return [...drawn, { ...part, share: total ? (part.value / total) * 100 : 0, offset }];
  }, []);
  return (
    <svg viewBox="0 0 42 42" className="size-44 shrink-0" role="img" aria-label={`${total} in all: ${parts.map((part) => `${part.value} ${part.label.toLowerCase()}`).join(", ")}`}>
      <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="5" />
      {total > 0 && arcs.map((arc) => {
        const to = arc.to || undefined;
        return (
          <circle key={arc.key} cx="21" cy="21" r={radius} fill="none" stroke={arc.colour} strokeWidth="5"
            strokeDasharray={`${arc.share} ${100 - arc.share}`} strokeDashoffset={25 - arc.offset}
            className={cn(to && "cursor-pointer transition-[stroke-width] hover:[stroke-width:6]")}
            role={to ? "link" : undefined}
            tabIndex={to ? 0 : undefined}
            aria-label={to ? `${arc.label}: ${arc.value}. Open the list` : undefined}
            onClick={to ? () => void navigate(to) : undefined}
            onKeyDown={to ? (event) => { if (event.key === "Enter") void navigate(to); } : undefined}
          >
            <title>{`${arc.label}: ${arc.value}`}</title>
          </circle>
        );
      })}
      <text x="21" y="21" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor">{total}</text>
      <text x="21" y="27" textAnchor="middle" fontSize="2.8" fill="var(--color-ink-muted)">Total</text>
    </svg>
  );
}
