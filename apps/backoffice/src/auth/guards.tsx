import { Navigate, Outlet, useLocation } from "react-router";
import { hasAnyAuthority, type Authority } from "../lib/permissions";
import { useSession } from "./session";

export function RequireSignIn() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status === "loading") {
    return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  }
  if (state.status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (state.user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  // Someone holding several roles picks one before anything else.
  if (!state.user.mustChangePassword && state.user.activeRole === null && location.pathname !== "/workspace") {
    return <Navigate to="/workspace" replace />;
  }
  return <Outlet />;
}

/**
 * Sends people without this authority home, including when an Admin has just reduced their access (#75). Give it
 * several for a screen that more than one access level opens, and holding any one of them is enough.
 */
export function RequireAuthority({ authority }: { authority: Authority | Authority[] }) {
  const { state } = useSession();
  const enough = Array.isArray(authority) ? authority : [authority];
  if (state.status === "signedIn" && !hasAnyAuthority(state.user, ...enough)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
