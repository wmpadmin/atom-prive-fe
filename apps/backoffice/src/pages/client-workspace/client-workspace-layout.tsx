import { ApiError } from "@atomprive/api-client";
import { getGetRecentClientWorkspacesQueryKey, useRecordClientWorkspaceOpened } from "@atomprive/api-client/backoffice";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";

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

  return <Outlet />;
}
