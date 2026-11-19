import { ApiError } from "@atomprive/api-client";
import {
  exportAuditEvents,
  useGetPermissionMatrix,
  useListAuditEvents,
  type AuditLogPage,
  type PermissionMatrix,
  type RoleAccessView,
} from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";
import { ArrowLeft, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { roleLabels } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { useStaffUser } from "../../auth/session";
import { ListReportButton } from "../layout/list-report";

/**
 * AI settings & security, laid out as the firm's design (AI_Assistant_Screens_v3, screen 4): who may ask what,
 * what never leaves the platform, and every question asked.
 *
 * <p>Read from what is really there rather than set here. Who reaches which data is the permission matrix, so the
 * table is worked out from it and edited there. The protection rules are how the assistants are built, so they
 * are stated as always on, not offered as switches that would change nothing. The trail is the audit log, held
 * to the two assistants' questions.
 */

const ASKED = ["portfolio.assistant_asked", "market.assistant_asked"];

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const RULES: { title: string; detail: string; state: "on" | "later" }[] = [
  { title: "Replace client details before anything goes to the AI", state: "on",
    detail: "Client names and codes are swapped for aliases such as “Client K7QM”; names are put back only on screen." },
  { title: "Keep client data away from market providers", state: "on",
    detail: "Market questions go to public news and price sources with the question alone, never a client's name, holdings or files." },
  { title: "Respect existing permissions", state: "on",
    detail: "Each answer is looked up with the asker's own permissions, so it never shows more than their screens do." },
  { title: "Approval before anything reaches a client", state: "on",
    detail: "A reminder the assistant offers is sent only when the person approves it; a rebalance becomes a draft proposal, never a trade." },
  { title: "Keep every question on record", state: "on",
    detail: "Each question is written to the audit log under the person who asked it." },
  { title: "Desktop folder access needs IT approval", state: "later",
    detail: "Applies once desktop folders can be connected (see Connected apps)." },
];

function grant(role: RoleAccessView, permission: string) {
  return role.grants.find((one) => one.permission === permission)?.level ?? "NONE";
}

/**
 * Which clients a role's questions can reach, by the same rule the server narrows them with (WhoseClients): the
 * client-profile permission alone. Reading every client's profile is the whole book; otherwise their own, or the
 * ones they were assigned.
 */
function clientReach(role: RoleAccessView): { text: string; on: boolean } {
  const profile = grant(role, "VIEW_CUSTOMER_PROFILE");
  if (profile === "FULL" || profile === "VIEW_ONLY") return { text: "All clients", on: true };
  if (profile === "OWN_CLIENTS") return { text: "Own clients", on: true };
  if (profile === "ASSIGNED") return { text: "Assigned clients", on: true };
  return { text: "No client data", on: false };
}

function Cell({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={on ? "font-semibold text-emerald-700" : "text-ink-muted"}>{children}</span>;
}

export function AiSettingsPage() {
  const user = useStaffUser();
  const matrix = useGetPermissionMatrix<PermissionMatrix, ApiError>();
  const month = useListAuditEvents<AuditLogPage, ApiError>({ actions: ASKED, from: startOfMonth(), page: 0, size: 200 });
  const recent = useListAuditEvents<AuditLogPage, ApiError>({ actions: ASKED, page: 0, size: 10 });
  const people = new Set((month.data?.items ?? []).map((one) => one.actorName ?? "")).size;
  const roles = (matrix.data?.roles ?? []).filter((one) => one.role !== "IT_ADMIN");

  return (
    <div className="space-y-5">
      <Link to="/assistant" className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
        <ArrowLeft className="size-4" aria-hidden="true" />
        AI Assistant
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">Administration</p>
          <span aria-hidden="true" className="mt-1.5 block h-0.5 w-8 rounded bg-primary-600" />
          <h1 className="mt-2 text-[1.75rem] font-bold text-balance">AI settings &amp; security</h1>
          <p className="mt-1 text-sm text-ink-muted">Admin view · who can use what, and what leaves our platform.</p>
        </div>
        <ListReportButton list="AI assistant questions" load={() => exportAuditEvents({ actions: ASKED })}
          filters="Questions asked to the AI Assistant" />
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Client names sent to the AI" value="Aliased" tone="good" />
        <Tile label="Client data to market providers" value="Blocked" tone="good" />
        <Tile label="Questions this month" value={month.data ? String(month.data.totalItems) : "…"} />
        <Tile label="People asking this month" value={month.data ? String(people) : "…"} />
      </dl>

      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="access-by-role" className="rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
          <h2 id="access-by-role" className="mb-1 text-xl font-bold">Access by role</h2>
          <p className="mb-4 text-xs text-ink-muted">Read from the permission matrix: the assistant reaches what each role&apos;s screens reach.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2.5 pr-3">Role</th>
                  <th scope="col" className="px-3 py-2.5">Client data</th>
                  <th scope="col" className="px-3 py-2.5">Portfolio questions</th>
                  <th scope="col" className="px-3 py-2.5">Market data</th>
                  <th scope="col" className="px-3 py-2.5">Files &amp; apps</th>
                </tr>
              </thead>
              <tbody>
                {matrix.isPending && <tr><td colSpan={5} className="py-4 text-ink-muted">Loading…</td></tr>}
                {roles.map((role) => {
                  const reach = clientReach(role);
                  // Portfolio questions open on SEND_PROPOSALS:CHANGE, which only the FULL level grants.
                  const desk = grant(role, "SEND_PROPOSALS") === "FULL";
                  return (
                    <tr key={role.role} className="border-b border-line last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left font-semibold">{roleLabels[role.role as keyof typeof roleLabels] ?? role.name}</th>
                      <td className="px-3 py-3"><Cell on={reach.on}>{reach.text}</Cell></td>
                      <td className="px-3 py-3"><Cell on={desk}>{desk ? "Yes" : "No"}</Cell></td>
                      <td className="px-3 py-3"><Cell on>Yes</Cell></td>
                      <td className="px-3 py-3"><Cell on={false}>Not connected</Cell></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW") && (
            <Link to="/roles" className="mt-4 inline-flex rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-primary-300">
              Edit roles
            </Link>
          )}
        </section>

        <section aria-labelledby="protection" className="rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
          <h2 id="protection" className="mb-1 text-xl font-bold">Data protection rules</h2>
          <p className="mb-2 text-xs text-ink-muted">Built into the assistant, so they are always on and nobody can switch them off.</p>
          <ul className="divide-y divide-line">
            {RULES.map((rule) => (
              <li key={rule.title} className="flex items-start justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-semibold">{rule.title}</p>
                  <p className="text-xs text-ink-muted">{rule.detail}</p>
                </div>
                {rule.state === "on" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="size-3.5" aria-hidden="true" />
                    Always on
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">Once connected</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="ai-trail" className="space-y-3 rounded-2xl border border-line bg-white px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ai-trail" className="text-xl font-bold">Audit trail</h2>
          <Link to="/audit-log" className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline">Open the full audit log</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-3 py-2.5">Time</th>
                <th scope="col" className="px-3 py-2.5">User</th>
                <th scope="col" className="px-3 py-2.5">Asked about</th>
                <th scope="col" className="px-3 py-2.5">Source used</th>
                <th scope="col" className="px-3 py-2.5">Sent outside</th>
              </tr>
            </thead>
            <tbody>
              {recent.isPending && <tr><td colSpan={5} className="px-3 py-4 text-ink-muted">Loading…</td></tr>}
              {recent.data?.items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">Nobody has asked the assistant anything yet.</td></tr>
              )}
              {recent.data?.items.map((one) => {
                const market = one.action === "market.assistant_asked";
                return (
                  <tr key={one.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      {new Date(one.occurredAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3">
                      {one.actorName ?? "Unknown"}
                      {one.actorRole && <span className="text-ink-muted"> ({roleLabels[one.actorRole as keyof typeof roleLabels] ?? one.actorRole})</span>}
                    </td>
                    <td className="px-3 py-3">{one.targetLabel ?? "—"}</td>
                    <td className="px-3 py-3">{market ? "Market data" : "Client & portfolio data"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={market ? "neutral" : "warning"}>{market ? "Public question only" : "Aliased question"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted">The last ten questions. Download above for every question, or open the audit log to search them.</p>
      </section>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <dt className="text-xs font-semibold tracking-[0.1em] text-ink-muted uppercase">{label}</dt>
      <dd className={`mt-1.5 text-xl font-semibold tabular-nums ${tone === "good" ? "text-emerald-700" : ""}`}>{value}</dd>
    </div>
  );
}
