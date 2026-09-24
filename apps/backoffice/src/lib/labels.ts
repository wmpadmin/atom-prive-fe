import type { StaffUserSummaryRolesItem, StaffUserSummaryStatus } from "@atomprive/api-client/backoffice";

export type StaffRole = StaffUserSummaryRolesItem;
export type StaffStatus = StaffUserSummaryStatus;

// Matches the staff_role table; the Permission matrix screen reads names from the API instead.
export const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Admin",
  ADVISOR: "Advisor",
  ADVISOR_HEAD: "Head of Advisory",
  COMPLIANCE: "Compliance",
  COMPLIANCE_HEAD: "Head of Compliance",
  OPERATIONS: "Operations",
  OPERATIONS_HEAD: "Head of Operations",
  PORTFOLIO_MANAGER: "Portfolio Manager",
  PORTFOLIO_MANAGER_HEAD: "Head of Product Portfolio",
};

/** Whoever runs a team. They do the team's ordinary work, with the team's own screens on top. */
export function runsATeam(held: StaffRole[]) {
  return held.some((role) => role.endsWith("_HEAD"));
}

/**
 * The roles somebody actually works in. Running a team is not a workspace of its own: the head signs into
 * their team's, holding the team's powers and the head's together.
 */
export function workspacesIn(held: StaffRole[]): WorkspaceRole[] {
  return held.filter((role): role is WorkspaceRole => !role.endsWith("_HEAD"));
}

/** A role somebody signs in to work in. Running a team is held on top of one of these, never instead. */
export type WorkspaceRole = Exclude<StaffRole, `${string}_HEAD`>;

/** The team a head role runs. */
export const headOf: Partial<Record<StaffRole, StaffRole>> = {
  ADVISOR_HEAD: "ADVISOR",
  COMPLIANCE_HEAD: "COMPLIANCE",
  OPERATIONS_HEAD: "OPERATIONS",
  PORTFOLIO_MANAGER_HEAD: "PORTFOLIO_MANAGER",
};

/** The four teams a staff member works on, and the head role each one can be given. */
export const teamRoles = [
  { team: "ADVISOR", head: "ADVISOR_HEAD" },
  { team: "OPERATIONS", head: "OPERATIONS_HEAD" },
  { team: "COMPLIANCE", head: "COMPLIANCE_HEAD" },
  { team: "PORTFOLIO_MANAGER", head: "PORTFOLIO_MANAGER_HEAD" },
] as const satisfies readonly { team: StaffRole; head: StaffRole }[];

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
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

/** "17 Sept 2026". */
export function formatDate(value: string) {
  return day.format(new Date(value));
}

/** A file size as people read it, for a document attached to a form. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
