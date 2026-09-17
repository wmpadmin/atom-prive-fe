import { Card } from "@atomprive/ui";
import { Navigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { roleLabels } from "../lib/labels";
import { hasAuthority } from "../lib/permissions";

export function HomePage() {
  const user = useStaffUser();
  if (hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW")) {
    return <Navigate to="/users" replace />;
  }
  return (
    <Card title={`Welcome, ${user.fullName}`}>
      <p className="text-sm text-slate-600">
        You're signed in as {roleLabels[user.role]}. Your screens will appear in the menu as they're released.
      </p>
    </Card>
  );
}
