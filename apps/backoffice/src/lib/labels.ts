import type { StaffUserSummaryRolesItem, StaffUserSummaryStatus } from "@atomprive/api-client/backoffice";
import { preference, type DateFormat } from "./preferences";

export type StaffRole = StaffUserSummaryRolesItem;
export type StaffStatus = StaffUserSummaryStatus;

// Matches the staff_role table; the Permission matrix screen reads names from the API instead.
export const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Admin",
  ADVISOR: "Relationship Manager",
  COMPLIANCE: "Compliance",
  OPERATIONS: "Operations",
  PORTFOLIO_MANAGER: "Portfolio Manager",
};

export const roles = Object.keys(roleLabels) as StaffRole[];

/** Every role someone holds, e.g. "Relationship Manager, Compliance". */
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

/*
 * How a date reads is the reader's own setting, so the formatters are built from it rather than fixed.
 *
 * <p>Built once per shape and kept, because an Intl formatter is expensive to make and these are called
 * on every row of every table. The preference is read at the moment it is needed rather than subscribed
 * to: a reader who changes it sees it as they move around the platform, which is what somebody changing
 * it once expects, and it costs nothing to the fifteen tables that would otherwise have to listen.
 */
const DATE_SHAPES: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  medium: { day: "numeric", month: "short", year: "numeric" },
  dmy: { day: "2-digit", month: "2-digit", year: "numeric" },
  mdy: { month: "2-digit", day: "2-digit", year: "numeric" },
  iso: { year: "numeric", month: "2-digit", day: "2-digit" },
};

const kept = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, options: Intl.DateTimeFormatOptions, locale = "en-GB") {
  const held = kept.get(key);
  if (held) return held;
  const made = new Intl.DateTimeFormat(locale, options);
  kept.set(key, made);
  return made;
}

function dayFormatter() {
  const shape = preference("dateFormat");
  // ISO is the one shape no locale gives on its own: en-CA happens to write exactly 2026-10-28.
  return formatter(`day.${shape}`, DATE_SHAPES[shape], shape === "iso" ? "en-CA" : "en-GB");
}

function dateTimeFormatter() {
  const shape = preference("dateFormat");
  const clock = preference("timeFormat");
  return formatter(`dateTime.${shape}.${clock}`, { ...DATE_SHAPES[shape], hour: "2-digit", minute: "2-digit", hour12: clock === "12" }, shape === "iso" ? "en-CA" : "en-GB");
}

export function formatDateTime(value: string | null | undefined, fallback = "Never") {
  return value ? dateTimeFormatter().format(new Date(value)) : fallback;
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
  return dayFormatter().format(new Date(value));
}

/** "17 Sept 2026". */
export function formatDate(value: string) {
  return dayFormatter().format(new Date(value));
}

/** A file size as people read it, for a document attached to a form. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
