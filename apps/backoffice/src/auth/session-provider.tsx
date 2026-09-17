import { configureAuth } from "@atomprive/api-client";
import { getCurrentStaff, logout, refresh, type SignInResponse, type StaffProfile } from "@atomprive/api-client/backoffice";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SessionContext, type SessionState } from "./session";

// Kept in memory only: never in localStorage, where injected scripts could read it.
let accessToken: string | null = null;
// Refresh tokens are single-use, so parallel 401s must share one refresh call.
let refreshInFlight: Promise<boolean> | null = null;

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const applySignIn = useCallback((response: SignInResponse) => {
    accessToken = response.accessToken;
    setState({ status: "signedIn", user: response.user });
  }, []);

  const clearSession = useCallback(() => {
    accessToken = null;
    queryClient.clear();
    setState({ status: "signedOut" });
  }, [queryClient]);

  const refreshAccessToken = useCallback(() => {
    refreshInFlight ??= refresh()
      .then((response) => {
        applySignIn(response);
        return true;
      })
      .catch(() => {
        clearSession();
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  }, [applySignIn, clearSession]);

  const applyProfile = useCallback((user: StaffProfile) => {
    setState((current) => (current.status === "signedIn" ? { status: "signedIn", user } : current));
  }, []);

  const reloadUser = useCallback(async () => {
    try {
      applyProfile(await getCurrentStaff());
    } catch {
      // Keep what's on screen; if the session has ended, the refresh attempt has already signed the user out.
    }
  }, [applyProfile]);

  useEffect(() => {
    configureAuth({ getAccessToken: () => accessToken, refreshAccessToken, onForbidden: () => void reloadUser() });
    // After a page reload the access token is gone; the refresh cookie restores the session.
    void refreshAccessToken();
  }, [refreshAccessToken, reloadUser]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const session = useMemo(
    () => ({ state, applySignIn, signOut, reloadUser, applyProfile }),
    [state, applySignIn, signOut, reloadUser, applyProfile],
  );
  return <SessionContext value={session}>{children}</SessionContext>;
}
