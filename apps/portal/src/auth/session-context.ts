import { createContext, useContext } from "react";

/**
 * Who is signed in to the portal, and the token that proves it.
 *
 * <p>The token is held in memory rather than in local storage. A token in storage survives the tab being
 * closed, which sounds like a convenience until you remember whose screens these are: a client's money, on
 * whatever device they happened to use. Signing in again costs them a password; a token left behind on a
 * shared laptop costs them rather more.
 *
 * <p>Apart from the provider so that file exports a component and nothing else, which is what keeps hot
 * reloading working on it.
 */
export type Session = {
  accessToken: string | null;
  signedIn: boolean;
  /** Keeps the token for this tab's lifetime. */
  began: (accessToken: string) => void;
  ended: () => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return session;
}
