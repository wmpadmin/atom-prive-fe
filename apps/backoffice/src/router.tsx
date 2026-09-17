import { createBrowserRouter } from "react-router";
import { AppLayout } from "./app-layout";
import { RequireAuthority, RequireSignIn } from "./auth/guards";
import { AuditLogPage } from "./pages/audit-log/audit-log-page";
import { ChangePasswordPage } from "./pages/change-password-page";
import { ConfigPage } from "./pages/config/config-page";
import { HomePage } from "./pages/home-page";
import { LoginPage } from "./pages/login-page";
import { OnboardingCasePage } from "./pages/onboarding/onboarding-case-page";
import { OnboardingListPage } from "./pages/onboarding/onboarding-list-page";
import { RolesPage } from "./pages/roles/roles-page";
import { UserDetailPage } from "./pages/users/user-detail-page";
import { UsersPage } from "./pages/users/users-page";
import { WorkspacePage } from "./pages/workspace-page";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
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
          {
            element: <RequireAuthority authority="ONBOARD_CLIENTS:VIEW" />,
            children: [
              { path: "onboarding", element: <OnboardingListPage /> },
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
