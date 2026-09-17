import type { StaffUserSummaryRolesItem, StaffUserSummaryStatus } from "@atomprive/api-client/backoffice";

export type StaffRole = StaffUserSummaryRolesItem;
export type StaffStatus = StaffUserSummaryStatus;

// Matches the staff_role table; the Permission matrix screen reads names from the API instead.
export const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Admin",
  ADVISOR: "Advisor",
  COMPLIANCE: "Compliance",
  OPERATIONS: "Operations",
  PORTFOLIO_MANAGER: "Portfolio Manager",
};

export const roles = Object.keys(roleLabels) as StaffRole[];

/** Every role someone holds, e.g. "Advisor, Compliance". */
export function roleList(held: StaffRole[]) {
  return held.map((role) => roleLabels[role]).join(", ");
}

export const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  DEACTIVATED: "Deactivated",
};

export const statuses = Object.keys(statusLabels) as StaffStatus[];

/** A role code from the API as shown on screen, including roles this list doesn't have yet ("FAMILY_MEMBER" → "Family member"). */
export function roleLabel(code: string) {
  return roleLabels[code as StaffRole] ?? code.charAt(0) + code.slice(1).toLowerCase().replaceAll("_", " ");
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
