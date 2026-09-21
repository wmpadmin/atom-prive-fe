import { createBrowserRouter } from "react-router";
import { AppLayout } from "./app-layout";
import { RequireAuthority, RequireSignIn } from "./auth/guards";
import { MyClientsPage } from "./pages/advisor/my-clients-page";
import { ProposalPage } from "./pages/advisor/proposal-page";
import { ProposalsPage } from "./pages/advisor/proposals-page";
import { AuditLogPage } from "./pages/audit-log/audit-log-page";
import { SyncRunsPage } from "./pages/bank-syncs/sync-runs-page";
import { DashboardPage } from "./pages/dashboard/dashboard-page";
import { DeliveriesPage } from "./pages/notifications/deliveries-page";
import { ChangePasswordPage } from "./pages/change-password-page";
import { ConfigPage } from "./pages/config/config-page";
import { ClientPage } from "./pages/clients/client-page";
import { ClientsPage } from "./pages/clients/clients-page";
import { DocumentPage } from "./pages/forms/document-page";
import { FormPage } from "./pages/forms/form-page";
import { FormsPage } from "./pages/forms/forms-page";
import { MyDeclarationPage } from "./pages/my-declarations/my-declaration-page";
import { MyDeclarationsPage } from "./pages/my-declarations/my-declarations-page";
import { StaffDeclarationsPage } from "./pages/staff-declarations/staff-declarations-page";
import { HomePage } from "./pages/home-page";
import { OPENS_CLIENT_FILES, WRITES_PROPOSALS } from "./lib/permissions";
import { ForgotPasswordPage } from "./pages/sign-in/forgot-password-page";
import { LoginPage } from "./pages/sign-in/login-page";
import { ResetPasswordPage } from "./pages/sign-in/reset-password-page";
import { OnboardingCasePage } from "./pages/onboarding/onboarding-case-page";
import { OnboardingListPage } from "./pages/onboarding/onboarding-list-page";
import { RolesPage } from "./pages/roles/roles-page";
import { UserDetailPage } from "./pages/users/user-detail-page";
import { UsersPage } from "./pages/users/users-page";
import { WorkspacePage } from "./pages/workspace-page";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <RequireSignIn />,
    children: [
      { path: "/change-password", element: <ChangePasswordPage /> },
      { path: "/workspace", element: <WorkspacePage /> },
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          // Everyone at the firm signs the same nine, so their own need no permission beyond being signed in.
          { path: "my-declarations", element: <MyDeclarationsPage /> },
          { path: "my-declarations/:kind", element: <MyDeclarationPage /> },
          {
            element: <RequireAuthority authority="VIEW_ALL_CLIENTS:VIEW" />,
            children: [
              // Hidden for now at your request: off the menu, and Admins land on Staff users. Put the nav entry
              // back in app-layout.tsx to show it again.
              { path: "dashboard", element: <DashboardPage /> },
              { path: "clients", element: <ClientsPage /> },
              { path: "bank-syncs", element: <SyncRunsPage /> },
              { path: "notifications", element: <DeliveriesPage /> },
              {
                path: "family-access",
                element: (
                  <AuditLogPage
                    actionPrefix="access."
                    title="Family access trail"
                    description="Every cross-access event: asked for, opened, approved, read under a grant, revoked. Searchable by person, action and date."
                  />
                ),
              },
              {
                path: "proposal-trail",
                element: (
                  <AuditLogPage
                    actionPrefix="proposal."
                    title="Proposal trail"
                    description="Every proposal from draft to sign-off, sent, opened and answered, with who did it and when."
                  />
                ),
              },
              { path: "clients/:clientId", element: <ClientPage /> },
            ],
          },
          {
            // Looking after clients of your own is not the same as seeing every client: an advisor has only the
            // first, so these can't sit under VIEW_ALL_CLIENTS or every advisor screen bounces back home.
            element: <RequireAuthority authority={OPENS_CLIENT_FILES} />,
            children: [
              { path: "my-clients", element: <MyClientsPage /> },
              { path: "my-clients/:clientId", element: <ClientPage /> },
            ],
          },
          {
            element: <RequireAuthority authority={WRITES_PROPOSALS} />,
            children: [
              { path: "proposals", element: <ProposalsPage /> },
              { path: "proposals/new", element: <ProposalPage /> },
              { path: "proposals/:proposalId", element: <ProposalPage /> },
            ],
          },
          {
            element: <RequireAuthority authority="ONBOARD_CLIENTS:VIEW" />,
            children: [
              { path: "forms", element: <FormsPage /> },
              { path: "staff-declarations", element: <StaffDeclarationsPage /> },
              { path: "forms/:formId", element: <FormPage /> },
              { path: "onboarding", element: <OnboardingListPage /> },
              // A form opened from a case's checklist lives under that case, so the menu keeps saying
              // Client onboarding and Back knows where to return to even after a refresh.
              { path: "onboarding/:caseId/forms/:formId", element: <FormPage /> },
              // The documents that are only signed have no form to fill in, just wording to read before sending.
              { path: "onboarding/:caseId/documents/:kind", element: <DocumentPage /> },
              // "new" starts a case; the page stays mounted when the first save gives the case its id.
              { path: "onboarding/:caseId", element: <OnboardingCasePage /> },
            ],
          },
          {
            element: <RequireAuthority authority="MANAGE_USERS_AND_ROLES:VIEW" />,
            children: [
              { path: "users", element: <UsersPage /> },
              { path: "users/:userId", element: <UserDetailPage /> },
              { path: "roles", element: <RolesPage /> },
            ],
          },
          {
            element: <RequireAuthority authority="MANAGE_CONFIGURATION:VIEW" />,
            children: [{ path: "config", element: <ConfigPage /> }],
          },
          {
            element: <RequireAuthority authority="VIEW_AUDIT_LOG:VIEW" />,
            children: [{ path: "audit-log", element: <AuditLogPage /> }],
          },
        ],
      },
    ],
  },
]);
