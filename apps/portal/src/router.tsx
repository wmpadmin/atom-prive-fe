import { createBrowserRouter, Navigate } from "react-router";
import { AccessPage } from "./pages/access-page";
import { AccessRequestPage } from "./pages/access-request-page";
import { AccountPage } from "./pages/account-page";
import { AccountsPage } from "./pages/accounts-page";
import { AskAccessPage } from "./pages/ask-access-page";
import { JoinPage } from "./pages/join-page";
import { PermissionsPage } from "./pages/permissions-page";
import { MyFamilyPage } from "./pages/my-family-page";
import { RequestPage } from "./pages/request-page";
import { ReportsPage } from "./pages/reports-page";
import { RequestsPage } from "./pages/requests-page";
import { SentAccessPage } from "./pages/sent-access-page";
import { SettingsPage } from "./pages/settings-page";
import { OnlySignedIn, OnlySignedInNewLook, OnlySignedOut } from "./auth/guards";
import { DashboardPage } from "./wealth/dashboard-page";
import { AccountPage as NewAccountPage } from "./wealth/account-page";
import { AccountsPage as NewAccountsPage } from "./wealth/accounts-page";
import { DocumentsPage } from "./wealth/documents-page";
import { KycPage } from "./wealth/kyc-page";
import { FormSignPage } from "./wealth/form-sign-page";
import { SupportViewPage } from "./wealth/support-view-page";
import { SupportPage } from "./wealth/support-page";
import { SupportTicketPage } from "./wealth/support-ticket-page";
import { AuditLogPage } from "./wealth/audit-log-page";
import { ActivityPage } from "./wealth/activity-page";
import { AccessRequestsPage } from "./wealth/access-requests-page";
import { FamilyAccessPage } from "./wealth/family-access-page";
import { FamilyWealthPage } from "./wealth/family-wealth-page";
import { FormsPage } from "./wealth/forms-page";
import { HoldingsPage } from "./wealth/holdings-page";
import { PortfolioPage } from "./wealth/portfolio-page";
import { ProposalPage } from "./wealth/proposal-page";
import { ProposalsPage } from "./wealth/proposals-page";
import { SecurityPage } from "./wealth/security-page";
import { ReportsPage as NewReportsPage } from "./wealth/reports-page";
import { SettingsPage as NewSettingsPage } from "./wealth/settings-page";

/**
 * Signed out, there is one screen; signed in, there is the rest.
 *
 * <p>No dashboard. A client's landing place is their family group, because that is what this portal is for
 * today — the firm's money screens are read in the back-office, and giving a client a page of their own
 * would mean building what it shows first.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <OnlySignedOut /> },
  { path: "/support-view", element: <SupportViewPage /> },
  // Open to anybody holding a link, signed in or not: the person arriving has no account yet, which
  // is the entire point of an invitation.
  { path: "/join/:token", element: <JoinPage /> },
  // The new look of the portal, at its own address beside the classic one so the two can be compared. Its
  // screens arrive one at a time; the menu shows the rest greyed until they do.
  {
    path: "/new",
    element: <OnlySignedInNewLook />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "holdings", element: <HoldingsPage /> },
      { path: "accounts", element: <NewAccountsPage /> },
      { path: "accounts/:id", element: <NewAccountPage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "forms", element: <FormsPage /> },
      { path: "kyc", element: <KycPage /> },
      { path: "family-wealth", element: <FamilyWealthPage /> },
      { path: "family-access", element: <FamilyAccessPage /> },
      { path: "access-requests", element: <AccessRequestsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "audit-log", element: <AuditLogPage /> },
      { path: "proposals", element: <ProposalsPage /> },
      { path: "proposals/:id", element: <ProposalPage /> },
      { path: "security", element: <SecurityPage /> },
      { path: "reports", element: <NewReportsPage /> },
      { path: "settings", element: <NewSettingsPage /> },
      { path: "support", element: <SupportPage /> },
      { path: "support/:id", element: <SupportTicketPage /> },
      { path: "forms/pack/:kind", element: <FormSignPage /> },
      { path: "forms/:id", element: <FormSignPage /> },
    ],
  },
  {
    path: "/",
    element: <OnlySignedIn />,
    children: [
      { index: true, element: <Navigate to="/family" replace /> },
      { path: "family", element: <MyFamilyPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "accounts/:id", element: <AccountPage /> },
      { path: "access", element: <AccessPage /> },
      // Both static paths before the dynamic one. React Router ranks them above it anyway, and keeping
      // them in this order means somebody reading the file sees why /access/new is not a request id.
      { path: "access/new", element: <AskAccessPage /> },
      { path: "access/sent", element: <SentAccessPage /> },
      { path: "access/:id", element: <AccessRequestPage /> },
      { path: "permissions", element: <PermissionsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "requests", element: <RequestsPage /> },
      { path: "requests/:id", element: <RequestPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
