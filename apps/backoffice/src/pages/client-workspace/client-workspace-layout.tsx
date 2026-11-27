import { ApiError } from "@atomprive/api-client";
import {
  getGetRecentClientWorkspacesQueryKey,
  useGetClientWorkspace,
  useRecordClientWorkspaceOpened,
  type ClientWorkspace,
} from "@atomprive/api-client/backoffice";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { DrillHost } from "./drill-panel";
import { SourceTags } from "./source-tags";
import { WORKSPACE_SCREENS } from "./workspace-screens";

/**
 * One client's workspace: the screen, at the page's full width. Its menu — back to all clients, the client's card
 * and switcher, and the workspace's screens — is drawn inside the main sidebar, under the Client Directory, as the
 * firm's design has it (app-layout.tsx, ClientMenu).
 */
export function ClientWorkspaceLayout() {
  const { customerId = "" } = useParams();

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

  // Each card says where its figures come from, for the client whose figures come only from his bank's files. The
  // workspace is the Overview's own query, so this costs nothing the Overview does not already ask for.
  const workspace = useGetClientWorkspace<ClientWorkspace, ApiError>(customerId, undefined, { query: { enabled: !!customerId } });
  const { pathname } = useLocation();
  const rest = pathname.split(`/client-workspace/${customerId}`)[1]?.replace(/^\//, "").split("/")[0] ?? "";
  const screen = WORKSPACE_SCREENS.find((one) => one.path === rest)?.id ?? null;

  return (
    <SourceTags screen={workspace.data?.bankFile ? screen : null}>
      <DrillHost customerId={customerId}>
        <Outlet />
      </DrillHost>
    </SourceTags>
  );
}
