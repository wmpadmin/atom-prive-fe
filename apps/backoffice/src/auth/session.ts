import { createContext, useContext } from "react";
import type { SignInResponse, StaffProfile } from "@atomprive/api-client/backoffice";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: StaffProfile };

export interface Session {
  state: SessionState;
  /** Store the tokens from a sign-in, refresh or password change. */
  applySignIn: (response: SignInResponse) => void;
  signOut: () => Promise<void>;
  /** Fetches the user's current permissions, which an Admin may have changed since sign-in (#75). */
  reloadUser: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

/** The signed-in user; only call below a route that requires sign-in. */
export function useStaffUser(): StaffProfile {
  const { state } = useSession();
  if (state.status !== "signedIn") throw new Error("useStaffUser needs a signed-in user");
  return state.user;
}
