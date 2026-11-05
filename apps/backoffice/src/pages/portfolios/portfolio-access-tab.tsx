import { ApiError } from "@atomprive/api-client";
import {
  getGetPermissionMatrixQueryKey,
  useGetPermissionMatrix,
  useUpdateRolePermission,
  type PermissionMatrix,
  type UpdateRolePermissionRequestLevel,
} from "@atomprive/api-client/backoffice";
import { Alert, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useSession, useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";

type Level = UpdateRolePermissionRequestLevel;
type Permission = PermissionMatrix["permissions"][number]["permission"];

/** The permissions that decide who does what with portfolios, in the order a portfolio desk thinks of them. */
const COLUMNS: { permission: Permission; label: string }[] = [
  { permission: "VIEW_CUSTOMER_PROFILE", label: "View portfolios" },
  { permission: "SEND_PROPOSALS", label: "Edit portfolios" },
  { permission: "APPROVE_PORTFOLIO_CHANGES", label: "Approve changes" },
  { permission: "MANAGE_ASSET_CLASSES", label: "Manage settings" },
  { permission: "EXPORT_CUSTOMER_DATA", label: "View reports" },
];

/**
 * Who may do what with portfolios: the firm's own permission matrix, the portfolio columns of it. A change here is
 * a change to the matrix itself — the same record Admin → Permission matrix edits — so the two screens cannot
 * disagree. Changed only by somebody who may manage roles.
 */
export function PortfolioAccessTab() {
  const user = useStaffUser();
  const { reloadUser } = useSession();
  const mayRead = hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW");
  const mayChange = hasAuthority(user, "MANAGE_USERS_AND_ROLES:CHANGE");
  const queryClient = useQueryClient();
  const matrix = useGetPermissionMatrix<PermissionMatrix, ApiError>({ query: { enabled: mayRead } });
  const [said, setSaid] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const update = useUpdateRolePermission<ApiError>({
    mutation: {
      onMutate: () => setSaid(null),
      onSuccess: (updated, { permission, data }) => {
        queryClient.setQueryData<PermissionMatrix>(getGetPermissionMatrixQueryKey(), (current) =>
          current && { ...current, roles: current.roles.map((role) => (role.role === updated.role ? updated : role)) });
        const label = COLUMNS.find((one) => one.permission === permission)?.label ?? permission;
        const level = matrix.data?.levels.find((one) => one.level === data.level)?.label ?? data.level;
        setSaid({ tone: "success", message: `Saved: ${updated.name} · ${label} is now ${level}.` });
        if (updated.role === user.activeRole) void reloadUser();
      },
      onError: (error) => {
        setSaid({ tone: "danger", message: error.message });
        void queryClient.invalidateQueries({ queryKey: getGetPermissionMatrixQueryKey() });
      },
    },
  });

  if (!mayRead) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Who may do what is the firm&rsquo;s permission matrix, which Admin looks after. Ask an Admin to change it.
      </p>
    );
  }
  if (matrix.isError) return <Alert tone="danger">{matrix.error.message}</Alert>;
  if (!matrix.data) return <p className="py-8 text-center text-sm text-ink-muted">Reading the permissions…</p>;
  const levelLabel = new Map(matrix.data.levels.map((one) => [one.level, one.label]));
  const allowed = new Map(matrix.data.permissions.map((one) => [one.permission, one.levels]));

  return (
    <div className="space-y-3">
      {said && <Alert tone={said.tone}>{said.message}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="rounded-l-lg px-3 py-2.5">Role</th>
              {COLUMNS.map((one) => (
                <th key={one.permission} scope="col" className="px-3 py-2.5 whitespace-nowrap">{one.label}</th>
              ))}
              <th scope="col" className="rounded-r-lg px-3 py-2.5 whitespace-nowrap">Client view</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {matrix.data.roles.map((role) => (
              <tr key={role.role}>
                <th scope="row" className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{role.name}</th>
                {COLUMNS.map((column) => {
                  const grant = role.grants.find((one) => one.permission === column.permission);
                  if (!grant) return <td key={column.permission} className="px-3 py-2.5 text-ink-muted">—</td>;
                  const locked = grant.lockedReason !== null;
                  const busy = update.isPending && update.variables?.role === role.role && update.variables.permission === column.permission;
                  return (
                    <td key={column.permission} className="min-w-36 px-3 py-2">
                      {locked || !mayChange ? (
                        <span className="inline-flex items-center gap-1.5 text-sm" title={grant.lockedReason ?? undefined}>
                          {locked && <Lock aria-hidden="true" className="size-3.5 text-ink-muted" />}
                          {levelLabel.get(grant.level) ?? grant.level}
                        </span>
                      ) : (
                        <SelectInput
                          aria-label={`${role.name}: ${column.label}`}
                          value={grant.level}
                          disabled={busy}
                          onChange={(event) => update.mutate({ role: role.role, permission: column.permission, data: { level: event.target.value as Level } })}
                        >
                          {(allowed.get(column.permission) ?? []).map((level) => (
                            <option key={level} value={level}>{levelLabel.get(level) ?? level}</option>
                          ))}
                        </SelectInput>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-ink-muted">Not yet</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">
        These are the firm&rsquo;s own permissions — the same record as{" "}
        <Link to="/roles" className="font-semibold text-primary-700 hover:underline">Admin → Permission matrix</Link>, which holds the rest.
        {!mayChange && " Only somebody who may manage roles can change them."} Client view waits for the client portal.
      </p>
    </div>
  );
}
