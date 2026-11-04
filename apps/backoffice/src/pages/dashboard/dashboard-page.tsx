import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, hasAuthority } from "../../lib/permissions";
import { AdvisorDashboard } from "../advisor/advisor-dashboard";
import { ComplianceDashboard } from "../compliance/compliance-dashboard";
import { PortfolioManagerDashboard } from "../portfolios/portfolio-manager-dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { OperationsDashboard } from "./operations-dashboard";

/**
 * The dashboard belonging to whoever asked for it. The firm-wide figures are the Admin's — the API answers
 * nobody else for them — so everybody else is shown their own day instead of a screen that would refuse them.
 * A portfolio manager's day is their models and what has wandered off them, which is a different question
 * from a relationship manager's clients and advice, and both are different again from a compliance
 * officer's, who looks after no clients and writes no advice but owns the firm's KYC and its AML scoring.
 */
export function DashboardPage() {
  const user = useStaffUser();
  const runsThePlatform = hasAuthority(user, "MANAGE_USERS_AND_ROLES:VIEW");
  const managesPortfolios = user.roles.includes("PORTFOLIO_MANAGER");
  // Read off the role being worked in, like the portfolio desk below. Compliance fell through to the
  // relationship manager's screen, which is written about clients somebody looks after and advice they
  // wrote — a compliance officer has neither, so three of its six figures could never say anything.
  const checksTheFirm = user.activeRole === "COMPLIANCE";

  // Asked first, and of the role being worked in: the firm's administrators also hold the portfolio desk,
  // and signed in as Admin they came for the firm as a whole, not for one desk's book.
  if (user.activeRole === "ADMIN" && runsThePlatform) {
    return <AdminDashboard />;
  }
  if (user.activeRole === "OPERATIONS" && hasAnyAuthority(user, "ONBOARD_CLIENTS:VIEW", "ONBOARD_CLIENTS:CHANGE")) {
    return <OperationsDashboard />;
  }
  if (checksTheFirm) {
    return <ComplianceDashboard />;
  }
  if (managesPortfolios) {
    return <PortfolioManagerDashboard />;
  }
  if (!runsThePlatform) {
    return <AdvisorDashboard />;
  }
  return <AdminDashboard />;
}
