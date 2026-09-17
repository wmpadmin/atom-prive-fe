import { Navigate, Outlet, useLocation } from "react-router";
import { hasAuthority, type Authority } from "../lib/permissions";
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

/** Sends people without this authority home, including when an Admin has just reduced their access (#75). */
export function RequireAuthority({ authority }: { authority: Authority }) {
  const { state } = useSession();
  if (state.status === "signedIn" && !hasAuthority(state.user, authority)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
