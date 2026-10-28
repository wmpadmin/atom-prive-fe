import { configureAuth } from "@atomprive/api-client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SessionContext, type Session } from "./session-context";

/**
 * Holds the portal session for the tab it is open in.
 *
 * <p>The token is held in memory rather than in local storage. A token in storage survives the tab being
 * closed, which sounds like a convenience until you remember whose screens these are: a client's money, on
 * whatever device they happened to use. Signing in again costs them a password; a token left behind on a
 * shared laptop costs them rather more.
 */

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const began = useCallback((token: string) => setAccessToken(token), []);
  const ended = useCallback(() => setAccessToken(null), []);

  useEffect(() => {
    configureAuth({
      getAccessToken: () => accessToken,
      // No silent refresh yet. When the token runs out the client signs in again, which is honest: a
      // refresh that quietly fails would leave them looking at a screen that has stopped loading.
      refreshAccessToken: async () => false,
    });
  }, [accessToken]);

  const value = useMemo<Session>(
    () => ({ accessToken, signedIn: accessToken !== null, began, ended }),
    [accessToken, began, ended],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

