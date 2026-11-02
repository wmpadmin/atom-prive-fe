import { ApiError } from "@atomprive/api-client";
import {
  useAccounts,
  useDashboard,
  useMe,
  useReceived,
  useRequests,
  type AccountRow,
  type FamilyRequest,
  type Happening,
  type Me,
  type PortalDashboard,
  type RequestRow,
} from "@atomprive/api-client/portal";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  KeyRound,
  Landmark,
  LineChart,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { Card } from "./card";
import { AllocationRing, ValueChart } from "./dashboard-charts";
import { percent, whole } from "./figures";

/** How a KYC status reads to the client, and the colour of the pill it sits in. */
const KYC: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Verified", tone: "bg-access-full-soft text-access-full-ink" },
  PENDING: { label: "Under review", tone: "bg-access-view-soft text-access-view-ink" },
  NOT_SUBMITTED: { label: "Not submitted", tone: "bg-canvas text-ink-soft" },
  REJECTED: { label: "Action needed", tone: "bg-access-none-soft text-access-none-ink" },
  EXPIRED: { label: "Expired", tone: "bg-access-none-soft text-access-none-ink" },
};

const KIND_ICON: Record<string, LucideIcon> = {
  kyc: ShieldCheck,
  access: KeyRound,
  family: Users,
  portfolio: LineChart,
};

function Tile({ icon: Icon, label, children }: { icon?: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 p-5">
      {Icon && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Return({ value }: { value: number | null }) {
  if (value === null) {
    return <p className="mt-1 text-xl font-bold text-ink-muted">—</p>;
  }
  const Arrow = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xl font-bold tabular-nums ${value >= 0 ? "text-access-full-ink" : "text-access-none-ink"}`}>
      <Arrow aria-hidden="true" className="size-5" />
      {percent(value)}
    </p>
  );
}

function Figures({ dashboard, accounts }: { dashboard: PortalDashboard; accounts: number | undefined }) {
  const kyc = KYC[dashboard.kycStatus] ?? KYC.NOT_SUBMITTED!;
  const ytd = dashboard.returnYearToDate;
  return (
    <div className="grid divide-line rounded-2xl border border-line bg-white sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
      <Tile icon={Landmark} label="Portfolio value">
        <p className="mt-0.5 truncate text-xl font-bold text-ink tabular-nums">{whole(dashboard.netWorth, dashboard.currency)}</p>
        {ytd !== null && (
          <p className={`text-xs font-semibold tabular-nums ${ytd >= 0 ? "text-access-full-ink" : "text-access-none-ink"}`}>
            {ytd >= 0 ? "↑" : "↓"} {percent(ytd)} <span className="font-medium text-ink-muted">(YTD)</span>
          </p>
        )}
      </Tile>
      <Tile label="Total return (YTD)">
        <Return value={ytd} />
      </Tile>
      <Tile icon={Wallet} label="Active accounts">
        <p className="mt-0.5 text-xl font-bold text-ink tabular-nums">{accounts ?? "—"}</p>
      </Tile>
      <Tile icon={ShieldCheck} label="KYC status">
        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${kyc.tone}`}>{kyc.label}</span>
      </Tile>
    </div>
  );
}

/** What is waiting on the client. Each item goes to the screen that answers it. */
function Pending() {
  const access = useReceived<RequestRow[], ApiError>();
  const joins = useRequests<FamilyRequest[], ApiError>();
  const onAccess = (access.data ?? []).filter((one) => one.status === "ASKED").length;
  const onJoins = (joins.data ?? []).length;

  const items = [
    { count: onAccess, label: onAccess === 1 ? "Access request" : "Access requests", hint: "to answer", icon: KeyRound, to: "/access" },
    { count: onJoins, label: onJoins === 1 ? "Family invitation" : "Family invitations", hint: "to answer", icon: UserPlus, to: "/requests" },
  ].filter((one) => one.count > 0);

  return (
    <Card title="Pending for you">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nothing is waiting on you.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((one) => (
            <li key={one.label}>
              <Link to={one.to} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-sidebar">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <one.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-tight font-bold text-ink tabular-nums">{one.count}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {one.label} {one.hint}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Recent({ activity }: { activity: Happening[] }) {
  return (
    <Card title="Recent activity">
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nothing has happened on your account yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {activity.map((one, index) => {
            const Icon = KIND_ICON[one.kind] ?? ShieldCheck;
            return (
              <li key={`${one.at}-${index}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{one.title}</p>
                  <p className="text-xs text-ink-muted">{one.detail}</p>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-ink-muted">{when(one.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const me = useMe<Me, ApiError>();
  const dashboard = useDashboard<PortalDashboard, ApiError>();
  const accounts = useAccounts<AccountRow[], ApiError>();
  const firstName = me.data?.fullName.split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Welcome{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mt-1 text-sm text-ink-muted">Here's your wealth overview and key updates.</p>
      </div>

      {dashboard.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">
          Your dashboard could not be loaded. Refresh the page to try again.
        </p>
      ) : !dashboard.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          <Figures dashboard={dashboard.data} accounts={accounts.data?.filter((one) => one.mine).length} />
          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Portfolio performance" className="lg:col-span-2" action={<span className="text-xs font-medium text-ink-muted">This year · {dashboard.data.currency}</span>}>
              <ValueChart points={dashboard.data.valueThisYear} currency={dashboard.data.currency} />
            </Card>
            <Card title="Asset allocation">
              <AllocationRing slices={dashboard.data.allocation} currency={dashboard.data.currency} />
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Pending />
            <Recent activity={dashboard.data.activity} />
          </div>
        </>
      )}
    </div>
  );
}
