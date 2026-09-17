import type { StaffUserSummaryRole, StaffUserSummaryStatus } from "@atomprive/api-client/backoffice";

export type StaffRole = StaffUserSummaryRole;
export type StaffStatus = StaffUserSummaryStatus;

// Matches the staff_role table; the Permission matrix screen reads names from the API instead.
export const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Admin",
  ADVISOR: "Advisor",
  COMPLIANCE: "Compliance",
  OPERATIONS: "Operations",
};

export const roles = Object.keys(roleLabels) as StaffRole[];

export const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  DEACTIVATED: "Deactivated",
};

export const statuses = Object.keys(statusLabels) as StaffStatus[];

const actionLabels: Record<string, string> = {
  "staff.login.succeeded": "Signed in",
  "staff.login.failed": "Failed sign-in attempt",
  "staff.logout": "Signed out",
  "staff.password.changed": "Changed their password",
  "staff.user.created": "Added a user",
  "staff.user.updated": "Updated a user",
  "staff.user.deactivated": "Deactivated a user",
  "staff.user.password_reset": "Reset a user's password",
  "staff.users.exported": "Exported the staff list",
  "staff.role.permission_changed": "Changed a role's access",
  "staff.role.permissions_changed": "Changed role permissions",
  "staff.roles.exported": "Exported the permission matrix",
};

export function actionLabel(action: string) {
  return actionLabels[action] ?? action;
}

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatDateTime(value: string | null | undefined, fallback = "Never") {
  return value ? dateTime.format(new Date(value)) : fallback;
}

/** "Just now", "12 min ago", "3 hr ago", "2 days ago", then the date. */
export function formatRelative(value: string | null | undefined, fallback = "Never") {
  if (!value) return fallback;
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return dateOnly.format(new Date(value));
}
