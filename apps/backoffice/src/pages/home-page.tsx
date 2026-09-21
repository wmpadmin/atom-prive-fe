import { Card } from "@atomprive/ui";
import { Navigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { roleLabels } from "../lib/labels";
import { advisesClients, hasAuthority } from "../lib/permissions";

export function HomePage() {
  const user = useStaffUser();
  if (hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW")) {
    return <Navigate to="/users" replace />;
  }
  if (hasAuthority(user, "ONBOARD_CLIENTS:VIEW")) {
    return <Navigate to="/onboarding" replace />;
  }
  if (hasAuthority(user, "VIEW_AUDIT_LOG:VIEW")) {
    return <Navigate to="/audit-log" replace />;
  }
  if (advisesClients(user)) {
    return <Navigate to="/my-clients" replace />;
  }
  return (
    <Card title={`Welcome, ${user.fullName}`}>
      <p className="text-sm text-slate-600">
        You're signed in as {user.activeRole ? roleLabels[user.activeRole] : "staff"}. Your screens will appear in the menu as they're released.
      </p>
    </Card>
  );
}
