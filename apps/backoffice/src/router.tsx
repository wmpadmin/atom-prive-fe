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
import { ClientKycPage } from "./pages/kyc/client-kyc-page";
import { KycDocumentReviewPage } from "./pages/kyc/kyc-documents-page";
import { KycReviewQueuePage } from "./pages/kyc/kyc-queue-page";
import { DocumentPage } from "./pages/forms/document-page";
import { FormPage } from "./pages/forms/form-page";
import { FormsPage } from "./pages/forms/forms-page";
import { MyDeclarationPage } from "./pages/my-declarations/my-declaration-page";
import { MyDeclarationsPage } from "./pages/my-declarations/my-declarations-page";
import { StaffDeclarationsPage } from "./pages/staff-declarations/staff-declarations-page";
import { HomePage } from "./pages/home-page";
import {
  ONBOARDS_CLIENTS,
  OPENS_CLIENT_DOCUMENTS,
  OPENS_CLIENT_FILES,
  UPLOADS_CLIENT_DOCUMENTS,
  READS_PROPOSALS,
  WRITES_PROPOSALS,
} from "./lib/permissions";
import { ForgotPasswordPage } from "./pages/sign-in/forgot-password-page";
import { LoginPage } from "./pages/sign-in/login-page";
import { ResetPasswordPage } from "./pages/sign-in/reset-password-page";
import { OnboardingCasePage } from "./pages/onboarding/onboarding-case-page";
import { OnboardingListPage } from "./pages/onboarding/onboarding-list-page";
import { RolesPage } from "./pages/roles/roles-page";
import { UserDetailPage } from "./pages/users/user-detail-page";
import { UsersPage } from "./pages/users/users-page";
import { WorkspacePage } from "./pages/workspace-page";
import { SignaturePackPage } from "./pages/to-sign/signature-pack-page";
import { ToSignPage } from "./pages/to-sign/to-sign-page";
import { ClientDocumentsPage } from "./pages/client-documents/client-documents-page";

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
            // KYC review is Compliance's, and Compliance have no sight of every client, so it cannot sit under
            // VIEW_ALL_CLIENTS. Operations may look at where a client's papers have got to; only Compliance decide.
            element: <RequireAuthority authority="APPROVE_ONBOARDING:VIEW" />,
            children: [
              { path: "kyc", element: <KycReviewQueuePage /> },
              // The papers themselves, reviewed one by one. Its own screen, not a tab on the queue.
              { path: "kyc-documents", element: <KycDocumentReviewPage /> },
              // Compliance read the client's case here rather than under Client onboarding, which is
              // Operations' own screen and closed to them.
              { path: "kyc/cases/:caseId", element: <OnboardingCasePage /> },
              // A signed form waiting on their decision. Read here, decided here; the API opens them nothing
              // that is still being filled in.
              { path: "kyc/forms/:formId", element: <FormPage /> },
            ],
          },
          {
            // A client's papers are opened both by Compliance, who decide on them, and by the advisor who
            // puts them on file.
            element: <RequireAuthority authority={OPENS_CLIENT_DOCUMENTS} />,
            children: [{ path: "kyc/:customerId", element: <ClientKycPage /> }],
          },
          {
            element: <RequireAuthority authority={UPLOADS_CLIENT_DOCUMENTS} />,
            children: [{ path: "client-documents", element: <ClientDocumentsPage /> }],
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
            // Compliance read the firm's advice; writing it stays with whoever advises the client.
            element: <RequireAuthority authority={READS_PROPOSALS} />,
            children: [
              { path: "proposals", element: <ProposalsPage /> },
              { path: "proposals/:proposalId", element: <ProposalPage /> },
            ],
          },
          {
            element: <RequireAuthority authority={WRITES_PROPOSALS} />,
            children: [
              { path: "proposals/new", element: <ProposalPage /> },
            ],
          },
          {
            // The bank feeds are the head's: staff work from what has come in, not from the connections.
            element: <RequireAuthority authority="MANAGE_BANK_FEEDS:VIEW" />,
            children: [{ path: "bank-syncs", element: <SyncRunsPage /> }],
          },
          {
            // Filling a client's forms is its own job, separate from onboarding them.
            element: <RequireAuthority authority="FILL_CLIENT_FORMS:VIEW" />,
            children: [
              { path: "forms", element: <FormsPage /> },
              { path: "forms/:formId", element: <FormPage /> },
              // The same two screens reached from a client rather than a case, so Back returns to the client.
              { path: "clients/:clientId/forms/:formId", element: <FormPage /> },
              { path: "clients/:clientId/documents/:kind", element: <DocumentPage /> },
            ],
          },
          {
            // The firm-wide register of declarations is oversight, so it follows managing staff.
            element: <RequireAuthority authority="MANAGE_USERS_AND_ROLES:VIEW" />,
            children: [{ path: "staff-declarations", element: <StaffDeclarationsPage /> }],
          },
          {
            // Signing is the advisor's half of a pack; Operations follow the same packs from a client's file.
            element: <RequireAuthority authority={ONBOARDS_CLIENTS} />,
            children: [
              { path: "to-sign", element: <ToSignPage /> },
              { path: "to-sign/:packId", element: <SignaturePackPage /> },
            ],
          },
          {
            // Onboarding is Operations' and the advisor's alike; the advisor is held to their own clients
            // by the API, which answers another advisor's case as though it were not there.
            element: <RequireAuthority authority={ONBOARDS_CLIENTS} />,
            children: [
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
