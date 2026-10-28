import { Card } from "@atomprive/ui";
import { Navigate } from "react-router";
import { useStaffUser } from "../auth/session";
import { roleLabels } from "../lib/labels";
import { advisesClients, hasAuthority } from "../lib/permissions";

export function HomePage() {
  const user = useStaffUser();
  // The portfolio desk opens on its own book. Asked of the role somebody is working in rather than of
  // what they may reach: an administrator can reach these screens too, and sending them here would take
  // them off their own first screen. Somebody signing in as a portfolio manager came to read clients
  // against their plans.
  if (user.activeRole === "PORTFOLIO_MANAGER") {
    return <Navigate to="/portfolio-clients" replace />;
  }
  if (hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW")) {
    return <Navigate to="/users" replace />;
  }
  // Whoever onboards clients opens on the clients list, which is where onboarding is now read and
  // started from. It used to be a list of cases of its own; that list is gone.
  if (hasAuthority(user, "ONBOARD_CLIENTS:VIEW")) {
    return <Navigate to="/clients" replace />;
  }
  // Compliance open on the queue their day is worked from. They used to land on the audit log, because
  // holding VIEW_AUDIT_LOG was the first thing below that matched them — a true answer to "what may they
  // read" and the wrong answer to "what did they come here to do". The audit log is read when a question
  // is asked of it; the KYC queue is read every morning.
  //
  // Asked of the role being worked in, like the portfolio desk above, and of the authority that opens the
  // screen as well: an Admin may take APPROVE_ONBOARDING away from the role, and a first screen that
  // refuses the person it was chosen for is worse than the plain one below. Without it they fall through
  // to the audit log exactly as before.
  if (user.activeRole === "COMPLIANCE" && hasAuthority(user, "APPROVE_ONBOARDING:CHANGE")) {
    return <Navigate to="/kyc" replace />;
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
