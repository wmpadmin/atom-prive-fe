import { configureAuth } from "@atomprive/api-client";
import { refresh } from "@atomprive/api-client/portal";
import { currentSupportView, forgetSupportView } from "@atomprive/support/support-view";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SessionContext, type Session } from "./session-context";

/**
 * Holds the portal session for the tab it is open in.
 *
 * <p>The access token is held in memory rather than in local storage. A token in storage survives the tab
 * being closed, which sounds like a convenience until you remember whose screens these are: a client's
 * money, on whatever device they happened to use.
 *
 * <p>What survives instead is the refresh cookie, which the browser holds and no script on the page can
 * read. That is what makes a reload keep the session without anything readable being left behind.
 */

/** One refresh at a time. Six requests expiring together must not become six sign-ins. */
let refreshInFlight: Promise<boolean> | null = null;

/** Whether this tab opened as a support view, which once it ends is not renewed into anybody's session. */
let viewing = false;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const began = useCallback((token: string) => setAccessToken(token), []);
  const ended = useCallback(() => setAccessToken(null), []);

  const refreshAccessToken = useCallback(() => {
    // A support view is never renewed: it ends with its token, and the refresh cookie is somebody else's.
    if (currentSupportView() || viewing) {
      forgetSupportView();
      setAccessToken(null);
      return Promise.resolve(false);
    }
    refreshInFlight ??= refresh()
      .then((answer) => {
        if (!answer.accessToken) return false;
        setAccessToken(answer.accessToken);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  }, []);

  useEffect(() => {
    configureAuth({ getAccessToken: () => accessToken, refreshAccessToken });
  }, [accessToken, refreshAccessToken]);

  // The access token is gone after a reload; the refresh cookie is what brings the session back. Tried
  // once on the way in, and a failure just means nobody is signed in.
  useEffect(() => {
    const view = currentSupportView();
    if (view) {
      viewing = true;
      setAccessToken(view.token);
      setReady(true);
      return;
    }
    void refreshAccessToken().finally(() => setReady(true));
    // Once, on the way in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Session>(
    () => ({ accessToken, signedIn: accessToken !== null, began, ended }),
    [accessToken, began, ended],
  );
  // Nothing is drawn until the first refresh has answered, or a signed-in client would see the sign-in
  // screen for a moment on every reload and wonder what had happened to them.
  if (!ready) return null;
  return <SessionContext value={value}>{children}</SessionContext>;
}

