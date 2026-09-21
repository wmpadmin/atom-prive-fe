import { ApiError } from "@atomprive/api-client";
import { useGetDashboard, type Dashboard } from "@atomprive/api-client/backoffice";
import { Alert, Badge } from "@atomprive/ui";
import { Activity, Database, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatDateTime, formatRelative, roleLabel } from "../../lib/labels";

/** What an Admin sees when they sign in: the figures, the newest activity and whether the platform is well (#76). */
export function DashboardPage() {
  const dashboard = useGetDashboard<Dashboard, ApiError>({ query: { refetchInterval: 60_000 } });

  if (dashboard.isError) {
    return <Alert tone="danger">{dashboard.error.message}</Alert>;
  }
  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Where the platform stands right now. Every figure is counted from what is actually recorded.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Clients" value={data?.tiles.clients} to="/clients" />
        <Tile label="Family groups" value={data?.tiles.familyGroups} />
        <Tile label="Linked bank accounts" value={data?.tiles.linkedBankAccounts ?? null} waitingOn="bank connections" />
        <Tile label="New clients today" value={data?.tiles.registeredToday} />
        <Tile label="Sync runs today" value={data?.tiles.syncRunsToday} to="/bank-syncs" />
        <Tile label="Failed syncs today" value={data?.tiles.failedSyncsToday} tone={data && data.tiles.failedSyncsToday > 0 ? "danger" : undefined} to="/bank-syncs" />
        <Tile label="KYC waiting for review" value={data?.tiles.kycPending} />
        <Tile
          label="Proposals waiting for sign-off"
          value={data?.tiles.portfolioApprovalsPending ?? null}
          waitingOn="proposals"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="activity-title" className="rounded-2xl border border-line bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div>
              <h2 id="activity-title" className="text-base font-bold">
                Recent activity
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">The newest entries in the audit trail.</p>
            </div>
            <Link to="/audit-log" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              Audit log
            </Link>
          </div>
          {data && data.recentActivity.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">Nothing has happened yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {(data?.recentActivity ?? []).map((event, index) => (
                <li key={`${event.occurredAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 py-3">
                  <p className="text-sm font-medium">
                    {event.description}
                    {event.actorName && <span className="font-normal text-ink-muted"> · {event.actorName}</span>}
                    {event.actorRole && <span className="font-normal text-ink-muted"> ({roleLabel(event.actorRole)})</span>}
                    {event.targetLabel && <span className="font-normal text-ink-muted"> — {event.targetLabel}</span>}
                  </p>
                  <p className="text-xs whitespace-nowrap text-ink-muted tabular-nums">{formatRelative(event.occurredAt)}</p>
                </li>
              ))}
              {!data && <li className="px-6 py-10 text-center text-sm text-ink-muted">Loading…</li>}
            </ol>
          )}
        </section>

        <section aria-labelledby="health-title" className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-6 py-5">
            <h2 id="health-title" className="text-base font-bold">
              System health
            </h2>
          </div>
          <dl className="divide-y divide-line">
            <Health icon={<Database />} label="Database">
              {data ? (
                <Badge tone={data.health.databaseUp ? "success" : "danger"}>{data.health.databaseUp ? "Up" : "Not answering"}</Badge>
              ) : (
                "…"
              )}
            </Health>
            <Health icon={<Timer />} label="API response">
              {data ? `${data.health.apiLatencyMillis} ms` : "…"}
            </Health>
            <Health icon={<Activity />} label="Last bank sync">
              {data?.health.lastSyncRunAt ? (
                <span className="flex items-center gap-2">
                  {formatDateTime(data.health.lastSyncRunAt)}
                  {data.health.lastSyncOutcome && (
                    <Badge tone={data.health.lastSyncOutcome === "FAILED" ? "danger" : "success"}>
                      {data.health.lastSyncOutcome === "FAILED" ? "Failed" : data.health.lastSyncOutcome === "RUNNING" ? "Running" : "Succeeded"}
                    </Badge>
                  )}
                </span>
              ) : (
                <span className="text-ink-muted">No bank has been pulled yet</span>
              )}
            </Health>
          </dl>
        </section>
      </div>
    </div>
  );
}

interface TileProps {
  label: string;
  value: number | null | undefined;
  /** Named when the figure has nothing behind it yet, so the tile says so instead of showing a nought. */
  waitingOn?: string;
  tone?: "danger";
  to?: string;
}

function Tile({ label, value, waitingOn, tone, to }: TileProps) {
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      {value === null && waitingOn ? (
        <p className="mt-2 text-sm text-ink-muted">Waiting on {waitingOn}</p>
      ) : (
        <p className={`mt-1 text-3xl font-bold tabular-nums ${tone === "danger" ? "text-red-600" : ""}`}>
          {value === undefined ? "—" : value}
        </p>
      )}
    </>
  );
  const className = "block rounded-2xl border border-line bg-white px-5 py-4";
  return to ? (
    <Link to={to} className={`${className} transition-colors hover:border-primary-300`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Health({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4">
      <dt className="flex items-center gap-2 text-sm text-ink-muted [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}
