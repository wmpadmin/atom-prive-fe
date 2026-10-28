import { Navigate } from "react-router";
import { AppLayout } from "../app-layout";
import { LoginPage } from "../pages/login-page";
import { useSession } from "./session-context";

/** Signed out, every address is the sign-in page — /login, as the back-office has it. */
export function OnlySignedIn() {
  return useSession().signedIn ? <AppLayout /> : <Navigate to="/login" replace />;
}

/** And signed in, /login is not an address at all. */
export function OnlySignedOut() {
  return useSession().signedIn ? <Navigate to="/family" replace /> : <LoginPage />;
}
