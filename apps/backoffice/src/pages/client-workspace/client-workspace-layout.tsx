import { ApiError } from "@atomprive/api-client";
import {
  getGetRecentClientWorkspacesQueryKey,
  useListWorkspaceClients,
  useRecordClientWorkspaceOpened,
  type WorkspaceClients,
} from "@atomprive/api-client/backoffice";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useStaffUser } from "../../auth/session";
import { SelectInput, cn } from "@atomprive/ui";
import { ArrowLeft } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router";
import { WORKSPACE_SCREENS, workspaceOf } from "./workspace-screens";

/**
 * One client's workspace: a side menu of the screens built for it, a switcher to another of the reader's clients, a
 * way back to the directory, and the screen itself beside them.
 */
export function ClientWorkspaceLayout() {
  const { customerId = "" } = useParams();
  const navigate = useNavigate();
  const listed = useListWorkspaceClients<WorkspaceClients, ApiError>({ query: { staleTime: 60_000 } });
  const clients = listed.data?.clients ?? [];
  const current = clients.find((one) => one.customerId === customerId);
  const groups = [...new Set(WORKSPACE_SCREENS.map((one) => one.group ?? ""))];

  // Noted on the server each time a portfolio manager opens a client, for the Recent clients in their sidebar.
  const user = useStaffUser();
  const queryClient = useQueryClient();
  const { mutate: noteOpened } = useRecordClientWorkspaceOpened<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetRecentClientWorkspacesQueryKey() }) },
  });
  const manager = user.activeRole === "PORTFOLIO_MANAGER";
  useEffect(() => {
    if (manager && customerId) {
      noteOpened({ customerId });
    }
  }, [manager, customerId, noteOpened]);

  return (
    <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <NavLink to="/client-directory" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-primary-700">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All clients
        </NavLink>
        <div className="rounded-xl border border-line bg-white p-3">
          {current && (
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-50 text-sm font-bold text-primary-700" aria-hidden="true">
                {current.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{current.name}</p>
                <p className="text-2xs text-ink-muted">{current.code}</p>
              </div>
            </div>
          )}
          <SelectInput id="workspace-client" aria-label="Switch to another client" value={customerId}
            onChange={(event) => navigate(workspaceOf(event.target.value))} className="h-9 w-full">
            {!current && <option value={customerId}>This client</option>}
            {clients.map((one) => <option key={one.customerId} value={one.customerId}>{one.name}</option>)}
          </SelectInput>
        </div>
        <nav aria-label="Client workspace" className="space-y-3">
          {groups.map((group) => (
            <div key={group || "main"} className="space-y-0.5">
              {group && <p className="px-3 text-3xs font-semibold tracking-wider text-ink-muted uppercase">{group}</p>}
              {WORKSPACE_SCREENS.filter((one) => (one.group ?? "") === group).map((one) => (
                <NavLink key={one.id} to={workspaceOf(customerId, one.path)} end
                  className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    isActive ? "bg-primary-50 font-semibold text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
                  <one.icon className="size-4" aria-hidden="true" />
                  {one.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
