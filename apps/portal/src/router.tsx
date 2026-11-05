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
import { OnlySignedIn, OnlySignedOut } from "./auth/guards";

/**
 * Signed out, there is one screen; signed in, there is the rest.
 *
 * <p>No dashboard. A client's landing place is their family group, because that is what this portal is for
 * today — the firm's money screens are read in the back-office, and giving a client a page of their own
 * would mean building what it shows first.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <OnlySignedOut /> },
  // Open to anybody holding a link, signed in or not: the person arriving has no account yet, which
  // is the entire point of an invitation.
  { path: "/join/:token", element: <JoinPage /> },
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
