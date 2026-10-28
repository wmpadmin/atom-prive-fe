import { Navigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { preference } from "../lib/preferences";
import { menuFor } from "../menu";
import { HomePage } from "./home-page";

/**
 * What a reader sees when they open the back office.
 *
 * <p>Their own home screen unless they have asked to open somewhere else, which is a setting on Settings.
 *
 * <p>The chosen screen is checked against their own menu before they are sent to it, and that check is
 * the whole reason this is not a one-liner: every screen behind an authority bounces a reader who lacks
 * it back to "/", so a stored choice their role may not open would send them here, here would send them
 * there, and the two would volley until the tab gave up. Offering only what their menu offers makes that
 * impossible rather than unlikely — and a role changed since they chose simply lands them home again.
 */
export function Landing() {
  const user = useStaffUser();
  const wanted = preference("landing");
  const theirs = wanted !== "home" && menuFor(user).some((item) => item.to === wanted);
  return theirs ? <Navigate to={wanted} replace /> : <HomePage />;
}
