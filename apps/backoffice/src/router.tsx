import { createBrowserRouter } from "react-router";
import { AppLayout } from "./app-layout";
import { RequireAuthority, RequireSignIn } from "./auth/guards";
import { MyClientsPage } from "./pages/advisor/my-clients-page";
import { ProposalPage } from "./pages/advisor/proposal-page";
import { ManagerReviewPage } from "./pages/advisor/manager-review-page";
import { ProposalsPage } from "./pages/advisor/proposals-page";
import { AuditLogPage } from "./pages/audit-log/audit-log-page";
import { IngestionMonitoringPage } from "./pages/bank-syncs/ingestion-monitoring-page";
import { SyncErrorsPage } from "./pages/bank-syncs/sync-errors-page";
import { SyncRunsPage } from "./pages/bank-syncs/sync-runs-page";
import { DashboardPage } from "./pages/dashboard/dashboard-page";
import { DeliveriesPage } from "./pages/notifications/deliveries-page";
import { ChangePasswordPage } from "./pages/change-password-page";
import { ConfigPage } from "./pages/config/config-page";
import { AddAccountHolderPage } from "./pages/clients/add-account-holder-page";
import { ClientPage } from "./pages/clients/client-page";
import { ClientsPage } from "./pages/clients/clients-page";
import { ClientKycPage } from "./pages/kyc/client-kyc-page";
import { ReviewDocumentPage } from "./pages/kyc/review-document-page";
import { KycDocumentReviewPage } from "./pages/kyc/kyc-documents-page";
import { KycReviewQueuePage } from "./pages/kyc/kyc-queue-page";
import { DocumentPage } from "./pages/forms/document-page";
import { FormPage } from "./pages/forms/form-page";
import { FormsPage } from "./pages/forms/forms-page";
import { MyDeclarationPage } from "./pages/my-declarations/my-declaration-page";
import { MyDeclarationsPage } from "./pages/my-declarations/my-declarations-page";
import { StaffDeclarationsPage } from "./pages/staff-declarations/staff-declarations-page";
import { HomePage } from "./pages/home-page";
import { SettingsPage } from "./pages/settings-page";
import {
  ONBOARDS_CLIENTS,
  ONBOARDS_CLIENTS_CHANGE,
  APPROVES_PROPOSALS,
  ONBOARDS_EVERY_CLIENT,
  OPENS_CLIENT_DOCUMENTS,
  OPENS_CLIENT_FILES,
  READS_CLIENT_PORTFOLIOS,
  READS_CLIENT_FORMS,
  READS_PROPOSALS,
  UPLOADS_CLIENT_DOCUMENTS,
  WRITES_PROPOSALS,
} from "./lib/permissions";
import { ForgotPasswordPage } from "./pages/sign-in/forgot-password-page";
import { LoginPage } from "./pages/sign-in/login-page";
import { ResetPasswordPage } from "./pages/sign-in/reset-password-page";
import { OnboardingCasePage } from "./pages/onboarding/onboarding-case-page";
import { OnboardingListPage } from "./pages/onboarding/onboarding-list-page";
import { PostOnboardingPage } from "./pages/onboarding/post-onboarding-page";
import { BenchmarksPage } from "./pages/portfolios/benchmarks-page";
import { ModelDetailPage } from "./pages/portfolios/model-detail-page";
import { ModelRiskPage } from "./pages/portfolios/model-risk-page";
import { ManagementInformationPage } from "./pages/portfolios/management-information-page";
import { PortfolioReportsPage } from "./pages/portfolios/reports-page";
import { PortfolioSettingsPage } from "./pages/portfolios/portfolio-settings-page";
import { ModelPerformancePage } from "./pages/portfolios/model-performance-page";
import { BulkRebalancingPage } from "./pages/portfolios/bulk-rebalancing-page";
import { DriftBreachesPage } from "./pages/portfolios/drift-page";
import { ModelPortfoliosPage } from "./pages/portfolios/model-portfolios-page";
import { ClientPortfolioPage } from "./pages/portfolios/client-portfolio-page";
import { PortfolioClientsPage } from "./pages/portfolios/portfolio-clients-page";
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
          // Somebody's own account, so it asks for nothing beyond being signed in.
          { path: "settings", element: <SettingsPage /> },
          // Whoever runs the platform gets the firm's figures here; everybody else gets their own day.
          { path: "dashboard", element: <DashboardPage /> },
          {
            element: <RequireAuthority authority="VIEW_ALL_CLIENTS:VIEW" />,
            children: [
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
            ],
          },
          {
            // The whole book, read as a directory. An advisor works from it to onboard but is not given a
            // screen onto every client's file: theirs are under My clients, and the API answers the same way.
            //
            // A portfolio manager is kept off it for a different reason: servicing a client — their papers,
            // their family, their onboarding — is not their work at all. The menu has always said so by not
            // offering the screen; this is what makes it true of the address as well.
            element: <RequireAuthority authority="VIEW_ALL_CLIENTS:VIEW" notFor={["ADVISOR", "PORTFOLIO_MANAGER"]} />,
            children: [
              { path: "clients", element: <ClientsPage /> },
              { path: "clients/:clientId", element: <ClientPage /> },
            ],
          },
          {
            // Adding somebody to an open account is onboarding them onto it, so it goes on the permission
            // onboarding goes on rather than on being able to read the client list.
            element: <RequireAuthority authority={ONBOARDS_CLIENTS_CHANGE} />,
            children: [{ path: "clients/:clientId/account-holders/new", element: <AddAccountHolderPage /> }],
          },
          {
            // KYC sign-off is Compliance's, and Compliance have no sight of every client, so it cannot sit
            // under VIEW_ALL_CLIENTS. Operations may look at where a client's papers have got to.
            element: <RequireAuthority authority="APPROVE_ONBOARDING:VIEW" />,
            children: [
              { path: "kyc", element: <KycReviewQueuePage /> },
              // The papers themselves, reviewed one by one. Its own screen, not a tab on the queue.
              { path: "kyc-documents", element: <KycDocumentReviewPage /> },
              // Compliance read the client's case here rather than under Client onboarding, which is
              // Operations' own screen and closed to them.
              { path: "kyc/cases/:caseId", element: <OnboardingCasePage /> },
              // A client's form, read here. Compliance change none of it: every endpoint that writes asks
              // for a permission they do not hold.
              { path: "kyc/forms/:formId", element: <FormPage /> },
            ],
          },
          {
            // A client's papers are opened both by Compliance, who decide on them, and by the advisor who
            // puts them on file.
            element: <RequireAuthority authority={OPENS_CLIENT_DOCUMENTS} />,
            children: [
              { path: "kyc/:customerId", element: <ClientKycPage /> },
              // A paper is read and decided on its own screen, where it has the width to be read.
              { path: "kyc/:customerId/documents/:documentId", element: <ReviewDocumentPage /> },
            ],
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
            // Compliance and the Portfolio Manager read the firm's advice; writing it stays with whoever
            // advises the client, which is why only the writing route below is closed to them.
            element: <RequireAuthority authority={READS_PROPOSALS} />,
            children: [
              { path: "proposals", element: <ProposalsPage /> },
              { path: "proposals/:proposalId", element: <ProposalPage /> },
            ],
          },
          {
            // Giving a sign-off is its own permission: whoever passes a proposal need not write any.
            element: <RequireAuthority authority={APPROVES_PROPOSALS} />,
            children: [{ path: "manager-review", element: <ManagerReviewPage /> }],
          },
          {
            // The portfolio manager writes proposals too, which the firm confirmed. They hold it at full, so
            // theirs is the whole book rather than an assigned list.
            element: <RequireAuthority authority={WRITES_PROPOSALS} />,
            children: [
              { path: "proposals/new", element: <ProposalPage /> },
            ],
          },
          {
            // The bank feeds are the head's: staff work from what has come in, not from the connections.
            element: <RequireAuthority authority="MANAGE_BANK_FEEDS:VIEW" />,
            children: [
              // The feeds themselves, then the run-by-run log behind them.
              { path: "ingestion", element: <IngestionMonitoringPage /> },
              { path: "bank-syncs", element: <SyncRunsPage /> },
              // What has gone wrong, on its own: the part of the log somebody has to act on.
              { path: "sync-errors", element: <SyncErrorsPage /> },
            ],
          },
          {
            // The queue of forms to fill is Operations' own work, so it stays on their permission.
            element: <RequireAuthority authority="FILL_CLIENT_FORMS:VIEW" />,
            children: [
              { path: "forms", element: <FormsPage /> },
              { path: "forms/:formId", element: <FormPage /> },
            ],
          },
          {
            // One client's form, reached from the client. Wider than the queue above, and deliberately the
            // same list the API guards it with: an advisor opens their own clients' forms and Compliance read
            // any of them. What each of them may change is decided on the screen, not here.
            element: <RequireAuthority authority={READS_CLIENT_FORMS} />,
            children: [
              { path: "clients/:clientId/forms/:formId", element: <FormPage /> },
              { path: "clients/:clientId/documents/:kind", element: <DocumentPage /> },
            ],
          },
          {
            // The book read for portfolio work. It is the same clients as All clients, set out for a
            // different job, so it goes on the same permission.
            element: <RequireAuthority authority="VIEW_ALL_CLIENTS:VIEW" />,
            children: [
              { path: "portfolio-clients", element: <PortfolioClientsPage /> },
              // One client's portfolio, written down and read against its model. Its own address, so a
              // sitting over it can be left and come back to, and linked to from the queues.
              { path: "portfolio-clients/:customerId", element: <ClientPortfolioPage /> },
            ],
          },
          {
            // How the firm invests is read by whoever may read a client's portfolio; changing a model is
            // the product team's, which the buttons on the screen follow.
            element: <RequireAuthority authority={READS_CLIENT_PORTFOLIOS} />,
            children: [
              { path: "model-portfolios", element: <ModelPortfoliosPage /> },
              { path: "drift", element: <DriftBreachesPage /> },
              { path: "bulk-rebalancing", element: <BulkRebalancingPage /> },
              { path: "model-performance", element: <ModelPerformancePage /> },
              { path: "model-risk", element: <ModelRiskPage /> },
              { path: "reports", element: <PortfolioReportsPage /> },
              { path: "mis", element: <ManagementInformationPage /> },
              { path: "portfolio-settings", element: <PortfolioSettingsPage /> },
              { path: "benchmarks", element: <BenchmarksPage /> },
              { path: "model-portfolios/:modelId", element: <ModelDetailPage /> },
            ],
          },
          {
            // Operations keep the firm-wide register: they chase what is outstanding and hold the signed
            // copies. That is its own permission, not a corner of managing staff.
            element: <RequireAuthority authority="VIEW_STAFF_DECLARATIONS:VIEW" />,
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
            // What every signed-off client is owed. It is the whole book's, so it stays with Operations
            // rather than following an advisor who onboards their own clients.
            element: <RequireAuthority authority={ONBOARDS_EVERY_CLIENT} />,
            children: [{ path: "post-onboarding", element: <PostOnboardingPage /> }],
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
