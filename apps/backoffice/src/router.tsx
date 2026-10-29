import { Navigate, createBrowserRouter } from "react-router";
import { AppLayout } from "./app-layout";
import { Landing } from "./pages/landing";
import { RequireAuthority, RequireSignIn } from "./auth/guards";
import { MyClientsPage } from "./pages/advisor/my-clients-page";
import { ProposalPage } from "./pages/advisor/proposal-page";
import { AmlClientPage } from "./pages/aml/aml-client-page";
import { AmlMatrixPage } from "./pages/aml/aml-matrix-page";
import { AmlRiskPage } from "./pages/aml/aml-risk-page";
import { TradeLogsPage } from "./pages/portfolios/trade-logs-page";
import { AuditLogPage } from "./pages/audit-log/audit-log-page";
import { IngestionMonitoringPage } from "./pages/bank-syncs/ingestion-monitoring-page";
import { SyncErrorsPage } from "./pages/bank-syncs/sync-errors-page";
import { SyncRunsPage } from "./pages/bank-syncs/sync-runs-page";
import { DashboardPage } from "./pages/dashboard/dashboard-page";
import { DeliveriesPage } from "./pages/notifications/deliveries-page";
import { ChangePasswordPage } from "./pages/change-password-page";
import { ConfigPage } from "./pages/config/config-page";
import { ClientPage } from "./pages/clients/client-page";
import { ClientsPage } from "./pages/clients/clients-page";
import { ClientKycPage } from "./pages/kyc/client-kyc-page";
import { ReviewDocumentPage } from "./pages/kyc/review-document-page";
import { KycDocumentReviewPage } from "./pages/kyc/kyc-documents-page";
import { KycReviewQueuePage } from "./pages/kyc/kyc-queue-page";
import { KycChecklistPage } from "./pages/kyc/kyc-checklist-page";
import { TrailsPage } from "./pages/trails/trails-page";
import { TrailClientPage } from "./pages/trails/trail-client-page";
import { TrailItemPage } from "./pages/trails/trail-item-page";
import { DocumentPage } from "./pages/forms/document-page";
import { FormPage } from "./pages/forms/form-page";
import { FormsPage } from "./pages/forms/forms-page";
import { MyDeclarationPage } from "./pages/my-declarations/my-declaration-page";
import { MyDeclarationsPage } from "./pages/my-declarations/my-declarations-page";
import { StaffDeclarationsPage } from "./pages/staff-declarations/staff-declarations-page";
import { StaffTrackerPage } from "./pages/staff-tracker/staff-tracker-page";
import { SettingsPage } from "./pages/settings-page";
import {
  ONBOARDS_CLIENTS,
  ANSWERS_MOVE_PLANS,
  APPROVES_PROPOSALS,
  ONBOARDS_EVERY_CLIENT,
  OPENS_CLIENT_DOCUMENTS,
  UPLOADS_CLIENT_DOCUMENTS,
  OPENS_CLIENT_FILES,
  READS_CLIENT_PORTFOLIOS,
  READS_CLIENT_FORMS,
  READS_AML_MATRIX,
  READS_AML_RISK,
  READS_PROPOSALS,
  STARTS_PROPOSALS,
} from "./lib/permissions";
import { ForgotPasswordPage } from "./pages/sign-in/forgot-password-page";
import { LoginPage } from "./pages/sign-in/login-page";
import { ResetPasswordPage } from "./pages/sign-in/reset-password-page";
import { OnboardingCasePage } from "./pages/onboarding/onboarding-case-page";
import { PostOnboardingPage } from "./pages/onboarding/post-onboarding-page";
import { ModelDetailPage } from "./pages/portfolios/model-detail-page";
import { ManagementInformationPage } from "./pages/portfolios/management-information-page";
import { PortfolioReportsPage } from "./pages/portfolios/reports-page";
import { PortfolioSettingsPage } from "./pages/portfolios/portfolio-settings-page";
import { ModelPerformancePage } from "./pages/portfolios/model-performance-page";
import { BulkRebalancingPage } from "./pages/portfolios/bulk-rebalancing-page";
import { DriftBreachesPage } from "./pages/portfolios/drift-page";
import { ModelPortfoliosPage } from "./pages/portfolios/model-portfolios-page";
import { ClientPortfolioPage } from "./pages/portfolios/client-portfolio-page";
import { DailyTrackerChangePage, DailyTrackerDayPage } from "./pages/portfolios/daily-tracker-day-page";
import { ClientMovesPage } from "./pages/portfolios/client-moves-page";
import { ApprovalsPage } from "./pages/portfolios/approvals-page";
import { PortfolioClientsPage } from "./pages/portfolios/portfolio-clients-page";
import { RolesPage } from "./pages/roles/roles-page";
import { UserDetailPage } from "./pages/users/user-detail-page";
import { UsersPage } from "./pages/users/users-page";
import { WorkspacePage } from "./pages/workspace-page";
import { SignaturePackPage } from "./pages/to-sign/signature-pack-page";
import { ToSignPage } from "./pages/to-sign/to-sign-page";
import { ClientDocumentsPage } from "./pages/client-documents/client-documents-page";
import { ArchivedClientsPage } from "./pages/clients/archived-clients-page";
import { DeactivationRequestsPage } from "./pages/clients/deactivation-requests-page";

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
          { index: true, element: <Landing /> },
          // Everyone at the firm signs the same nine, so their own need no permission beyond being signed in.
          { path: "my-declarations", element: <MyDeclarationsPage /> },
          { path: "my-declarations/:kind", element: <MyDeclarationPage /> },
          // Somebody's own account, so it asks for nothing beyond being signed in.
          { path: "settings", element: <SettingsPage /> },
          // Whoever runs the platform gets the firm's figures here; everybody else gets their own day.
          { path: "dashboard", element: <DashboardPage /> },
          {
            // The delivery log is the platform's own, not a client screen: the endpoint behind it asks for
            // MANAGE_CONFIGURATION:VIEW (DeliveryController), and the sidebar already offers it on that.
            // The route asked for VIEW_ALL_CLIENTS:VIEW, which is held by desks that endpoint refuses — so
            // a reader let through here met a refusal rather than the screen, and the repo disagreed with
            // itself about who the log is for.
            element: <RequireAuthority authority="MANAGE_CONFIGURATION:VIEW" />,
            children: [{ path: "notifications", element: <DeliveriesPage /> }],
          },
          {
            // The trails are a record of what was done, not a client screen: the sidebar offers them on
            // VIEW_AUDIT_LOG:VIEW, which is the Admin's and Compliance's. The route asked for
            // VIEW_ALL_CLIENTS:VIEW, which every role holds — so a desk with no business reading the
            // trail could open it by address, and the proposals tab then met a refusal from an endpoint
            // that never admitted them.
            element: <RequireAuthority authority="VIEW_AUDIT_LOG:VIEW" />,
            children: [
              { path: "trails", element: <TrailsPage /> },
              // Three screens, three addresses. A row that expands in place has no address, so the back
              // button, a bookmark and a link pasted into a message all stop working.
              { path: "trails/:trail/:customerId", element: <TrailClientPage /> },
              { path: "trails/:trail/:customerId/:itemId", element: <TrailItemPage /> },
              // The addresses these trails had for months still work and land on their own tab, so a
              // bookmark or a link in somebody's notes is not a dead end.
              { path: "proposal-trail", element: <Navigate to="/trails?trail=proposals" replace /> },
              // Family cross-access was never built — no grant was ever made, so every row on that
              // screen was stand-in sample data. The screen is gone; the address lands on the trails.
              { path: "family-access", element: <Navigate to="/trails" replace /> },
            ],
          },
          {
            // The whole book, read as a directory. A relationship manager works from it to onboard but is not given a
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
          // Adding an account holder by hand is gone, screen and address both. Somebody does not join an
          // account because a desk typed their name on a form: they are invited from the client's family
          // tab, they come in, and they are onboarded with their own papers and their own checks. The API
          // still accepts a holder on a submitted case — that is how onboarding itself adds the second
          // person — and nothing in the back-office asks it to any more.
          {
            // KYC sign-off is Compliance's, and Compliance have no sight of every client, so it cannot sit
            // under VIEW_ALL_CLIENTS. Operations may look at where a client's papers have got to.
            element: <RequireAuthority authority="APPROVE_ONBOARDING:VIEW" />,
            children: [
              { path: "kyc", element: <KycReviewQueuePage /> },
              // Compliance read the client's case here rather than under Client onboarding, which is
              // Operations' own screen and closed to them.
              { path: "kyc/cases/:caseId", element: <OnboardingCasePage /> },
              // A client's form, read here. Compliance change none of it: every endpoint that writes asks
              // for a permission they do not hold.
              { path: "kyc/forms/:formId", element: <FormPage /> },
              // What the KYC waits on, which the firm keeps. Under VIEW rather than CHANGE so Operations
              // may read what is being waited on; every write behind it asks for CHANGE on its own.
              { path: "kyc-checklist", element: <KycChecklistPage /> },
            ],
          },
          {
            // The papers themselves, reviewed one by one. Its own screen, not a tab on the queue — and its
            // own guard, because the list behind it asks for CHANGE (KycController.listKycDocuments) while
            // the screens above ask only for VIEW. Left in that block, Operations passed the route on their
            // VIEW_ONLY, loaded the page, and met a 403 where the table should have been.
            element: <RequireAuthority authority="APPROVE_ONBOARDING:CHANGE" />,
            children: [{ path: "kyc-documents", element: <KycDocumentReviewPage /> }],
          },
          {
            // Answering a deactivation and reading the archive are the same authority, because they are the
            // same job: deciding whether the firm acts for somebody. The Admin's alone.
            element: <RequireAuthority authority="MANAGE_USERS_AND_ROLES:CHANGE" />,
            children: [
              { path: "deactivation-requests", element: <DeactivationRequestsPage /> },
              { path: "archived-clients", element: <ArchivedClientsPage /> },
            ],
          },
          {
            // A client's papers are opened both by Compliance, who decide on them, and by the relationship manager who
            // puts them on file.
            element: <RequireAuthority authority={OPENS_CLIENT_DOCUMENTS} />,
            children: [
              { path: "kyc/:customerId", element: <ClientKycPage /> },
              // A paper is read and decided on its own screen, where it has the width to be read.
              { path: "kyc/:customerId/documents/:documentId", element: <ReviewDocumentPage /> },
            ],
          },
          {
            // Whoever puts a client's papers on file, which is the same set the menu offers it to. This read
            // OPENS_CLIENT_DOCUMENTS once, which is wider: it let Compliance in on APPROVE_ONBOARDING, so a
            // typed address still reached a screen the menu had stopped offering them. Compliance decide on
            // these papers from the review queue and the document review; this is where they come from.
            element: <RequireAuthority authority={UPLOADS_CLIENT_DOCUMENTS} />,
            children: [{ path: "client-documents", element: <ClientDocumentsPage /> }],
          },
          {
            // Looking after clients of your own is not the same as seeing every client: a relationship manager has
            // only the first, so these can't sit under VIEW_ALL_CLIENTS or every relationship manager screen
            // bounces back home.
            element: <RequireAuthority authority={OPENS_CLIENT_FILES} />,
            children: [
              { path: "my-clients", element: <MyClientsPage /> },
              { path: "my-clients/:clientId", element: <ClientPage /> },
            ],
          },
          {
            // Four jobs reach this: whoever writes proposals, whoever answers them for their own
            // clients, whoever answers for the firm, and Compliance, who oversee the advice and do
            // neither. Writing is closed to all but the first, on the route below.
            element: <RequireAuthority authority={READS_PROPOSALS} />,
            children: [
              { path: "proposals", element: <Navigate to="/approvals?queue=proposals" replace /> },
              { path: "proposals/:proposalId", element: <ProposalPage /> },
            ],
          },
          {
            // Every bulk rebalance, read by the desk that raises them and by the managers who answer them.
            // The blotter stood here: orders raised, passed by Compliance and placed by Operations. Bulk
            // rebalancing was the only thing that fed it and it feeds it no longer — it asks the client's
            // manager instead — so what is left is the record of those askings.
            element: <RequireAuthority authority={READS_PROPOSALS} />,
            children: [{ path: "trade-logs", element: <TradeLogsPage /> }],
          },
          // Where the blotter used to be. A link in somebody's notes, or a tab they left open, lands on
          // the screen that replaced it rather than on nothing.
          { path: "trade-orders", element: <Navigate to="/trade-logs" replace /> },
          {
            // Where clients sit on the firm's AML sheet is read by whoever scores them and by whoever
            // oversees the scoring; writing the sheet itself is a permission of its own.
            element: <RequireAuthority authority={READS_AML_RISK} />,
            children: [
              { path: "aml-risk", element: <AmlRiskPage /> },
              { path: "aml-risk/clients/:customerId", element: <AmlClientPage /> },
            ],
          },
          {
            // Open to whoever may read the sheet, not only whoever may write it: somebody scoring a client
            // has to be able to see what they are scoring on. The screen itself offers no edit to a reader.
            element: <RequireAuthority authority={READS_AML_MATRIX} />,
            children: [{ path: "aml-risk/matrix", element: <AmlMatrixPage /> }],
          },
          {
            // Everything waiting on somebody, on one screen. Open to whoever holds any one of the three
            // permissions its tabs sit behind; the screen draws only the tabs that reader may open, so
            // the gate here is deliberately the widest of them rather than all three.
            element: <RequireAuthority authority={[...ANSWERS_MOVE_PLANS, ...READS_PROPOSALS,
              ...READS_CLIENT_PORTFOLIOS]} />,
            children: [{ path: "approvals", element: <ApprovalsPage /> }],
          },
          {
            // Answering a plan to move money is its own permission, narrower than reading a portfolio:
            // whoever may read every client's figures is not thereby somebody who may move their money.
            element: <RequireAuthority authority={ANSWERS_MOVE_PLANS} />,
            children: [
              // One client's moves, on a screen of their own rather than in a drawer under their name.
              { path: "moves-to-approve/:customerId", element: <ClientMovesPage /> },
              // The four queues are tabs on one screen now. Their old addresses keep arriving, because
              // every bell already sent carries one and those notices are rows in a database rather than
              // links that can be rewritten.
              // Named, because this queue is still here: money moves are the client-requests tab. Sent to
              // /approvals with nothing said, the screen falls back to the first tab the reader may open
              // — Proposals, for the relationship manager who raised the move — so an old bell about a
              // money move opened the wrong queue and said nothing about why.
              { path: "moves-to-approve", element: <Navigate to="/approvals?queue=client-requests" replace /> },
              { path: "restores-to-approve", element: <Navigate to="/approvals?queue=restores" replace /> },
              { path: "allocations-to-approve", element: <Navigate to="/approvals?queue=figures" replace /> },
              // Where the screen used to live. Every bell sent before it was renamed carries this path,
              // and those notices are rows in a database rather than links that can be rewritten — so the
              // old address has to keep arriving somewhere rather than at a page that is not there.
              // Straight at the queue rather than through its sibling: one old address depending on
              // another staying right is two things to get wrong instead of one.
              { path: "money-moves", element: <Navigate to="/approvals?queue=client-requests" replace /> },
            ],
          },
          {
            // Answering is its own permission: whoever answers a proposal writes none.
            element: <RequireAuthority authority={APPROVES_PROPOSALS} />,
            // The queue is a view of the proposals list now, not a screen of its own. The address stays,
            // because it is in people's history and in older notification links.
            children: [{
              path: "manager-review",
              element: <Navigate to="/approvals?queue=proposals&tab=waitingOnMe" replace />,
            }],
          },
          {
            // Written by whoever reads the firm's whole book, and by nobody else. Held here as well as
            // on the button, so the address cannot be typed into a refusal on save.
            element: <RequireAuthority authority={STARTS_PROPOSALS} />,
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
            // same list the API guards it with: a relationship manager opens their own clients' forms and Compliance read
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
              // One client's portfolio, written down and read against its model. This is where a client
              // names arrives: the drift queue, the dashboard, the client file and the trading panel all
              // link to a client and expect to arrive at what they hold, not at a form.
              { path: "portfolio-clients/:customerId", element: <ClientPortfolioPage /> },
              // One day of the tracker, on its own. A drawer under the row buried the rest of the table
              // under a table of its own; this is the same figures with room to be read.
              { path: "portfolio-clients/:customerId/days/:on", element: <DailyTrackerDayPage /> },
              {
                path: "portfolio-clients/:customerId/days/:on/changes/:revision",
                element: <DailyTrackerChangePage />,
              },
              // Working their Net AUM out, which is a dialog over the list rather than a screen of its
              // own. Its own address all the same, so a sitting can be left and come back to, and so the
              // list can send somebody nobody has written an allocation down for straight into it.
              { path: "portfolio-clients/:customerId/net-aum", element: <PortfolioClientsPage /> },
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
              { path: "model-changes", element: <Navigate to="/approvals?queue=model-changes" replace /> },
              { path: "model-performance", element: <ModelPerformancePage /> },
              // The firm does not want a risk screen. Its figures are right now — a client joining the
              // plan is no longer counted as something the plan earned — so this is a decision about
              // what the desk reads rather than about what the platform can work out. A link in
              // somebody's notes, or a tab they left open, lands on how the plans are doing.
              { path: "model-risk", element: <Navigate to="/model-performance" replace /> },
              { path: "reports", element: <PortfolioReportsPage /> },
              { path: "mis", element: <ManagementInformationPage /> },
              { path: "portfolio-settings", element: <PortfolioSettingsPage /> },
              // The firm keeps no indices any more. A link in somebody's notes, or a tab they left open,
              // lands on the portfolio rules rather than on nothing.
              { path: "benchmarks", element: <Navigate to="/portfolio-settings" replace /> },
              { path: "model-portfolios/:modelId", element: <ModelDetailPage /> },
            ],
          },
          {
            // Operations keep the firm-wide register: they chase what is outstanding and hold the signed
            // copies. That is its own permission, not a corner of managing staff.
            element: <RequireAuthority authority="VIEW_STAFF_DECLARATIONS:VIEW" />,
            children: [
              { path: "staff-declarations", element: <StaffDeclarationsPage /> },
              // Empty until the firm says what belongs on it; the declarations go in here.
              { path: "staff-tracker", element: <StaffTrackerPage /> },
            ],
          },
          {
            // Signing is the relationship manager's half of a pack; Operations follow the same packs from a client's file.
            element: <RequireAuthority authority={ONBOARDS_CLIENTS} />,
            children: [
              { path: "to-sign", element: <ToSignPage /> },
              { path: "to-sign/:packId", element: <SignaturePackPage /> },
            ],
          },
          {
            // What every signed-off client is owed. It is the whole book's, so it stays with Operations
            // rather than following a relationship manager who onboards their own clients.
            element: <RequireAuthority authority={ONBOARDS_EVERY_CLIENT} />,
            children: [{ path: "post-onboarding", element: <PostOnboardingPage /> }],
          },
          {
            // Onboarding is Operations' and the relationship manager's alike; the relationship manager is held to
            // their own clients by the API, which answers another relationship manager's case as though it
            // were not there.
            element: <RequireAuthority authority={ONBOARDS_CLIENTS} />,
            children: [
              // There is no list of cases any more: the firm asked for one list of clients, and a case's
              // stage is a column on it. What stays here is the case itself and the pages hung off it.
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
            children: [
              { path: "audit-log", element: <AuditLogPage /> },
              // The same page, held to one family of actions. Its own address because it is its own
              // question: not "what has the firm done" but "who has been reading whose money".
              {
                path: "family-access-trail",
                element: (
                  <AuditLogPage
                    actionPrefix="access."
                    title="Family access trail"
                    description="Every request, decision and reading of one client's accounts by another. Searchable by client, event and date."
                  />
                ),
              },
            ],
          },
        ],
      },
    ],
  },
]);
