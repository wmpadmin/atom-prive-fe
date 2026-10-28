import { cn } from "@atomprive/ui";
import { useSearchParams } from "react-router";
import { DataPrivacyTab } from "./settings/data-privacy-tab";
import { NotificationsTab } from "./settings/notifications-tab";
import { PreferencesTab } from "./settings/preferences-tab";
import { ProfileTab } from "./settings/profile-tab";
import { SecurityTab } from "./settings/security-tab";
import { SessionsTab } from "./settings/sessions-tab";
import { WorkspaceTab } from "./settings/workspace-tab";
import { useStaffUser } from "../auth/session";

/**
 * Everything somebody can change about their own account, in one place: who the platform has them down as,
 * their password, what reaches them, how their screens behave.
 *
 * <p>Nothing here is anybody else's — changing what a colleague may do is the Admin's, on the permission
 * matrix, and these tabs deliberately have no path to it. The two exceptions are the last two, which only
 * an Admin sees and which are about everybody rather than about them.
 *
 * <p>Not every control behind these tabs is wired, and the ones that are not say so where they sit rather
 * than in a note at the top. A reader should be able to press anything on this screen and have it either
 * work or tell them plainly that it does not yet.
 */
export function SettingsPage() {
  const user = useStaffUser();
  // Only an Admin, and only while they are working as one. Somebody who holds the role but is sitting at
  // another desk is at that desk, and the menu on either side of this screen already says so.
  const admin = user.activeRole === "ADMIN";
  const [params, setParams] = useSearchParams();

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
    { id: "workspace", label: "Workspace" },
    { id: "data", label: "Data & Privacy" },
    { id: "preferences", label: "Preferences" },
    // Everybody's sessions rather than this reader's own, which is why they are an Admin's alone.
    ...(admin ? [{ id: "staff-sessions", label: "Staff sessions" }] : []),
    ...(admin ? [{ id: "client-sessions", label: "Client sessions" }] : []),
  ];
  const asked = params.get("tab");
  const current = tabs.some((one) => one.id === asked) ? (asked as string) : "profile";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {admin
            ? "Your own account and how the platform behaves for you — and where everybody at the firm has signed in."
            : "Your own account and how the platform behaves for you. What you may do is set by an Admin."}
        </p>
      </header>

      {/* The tab lives in the address, so a reader can be sent straight to one and a reload stays put. */}
      <div role="tablist" aria-label="Which settings" className="flex gap-1 scroll-x-quietly border-b border-line">
        {tabs.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={current === one.id}
            onClick={() => setParams(one.id === "profile" ? {} : { tab: one.id }, { replace: true })}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              current === one.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {one.label}
          </button>
        ))}
      </div>

      {current === "profile" && <ProfileTab user={user} />}
      {current === "security" && <SecurityTab />}
      {current === "notifications" && <NotificationsTab />}
      {current === "workspace" && <WorkspaceTab user={user} />}
      {current === "data" && <DataPrivacyTab />}
      {current === "preferences" && <PreferencesTab />}
      {current === "staff-sessions" && <SessionsTab of="staff" />}
      {current === "client-sessions" && <SessionsTab of="clients" />}
    </div>
  );
}
