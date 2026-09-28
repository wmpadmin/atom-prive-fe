import type { BankFeed } from "@atomprive/api-client/backoffice";

/** How a bank delivers its data, as the firm's own paperwork names it. */
export const connectionLabels: Record<string, string> = {
  SFTP: "SFTP",
  REST_API: "API",
  MANUAL_UPLOAD: "Uploaded file",
};

/** How often a feed is pulled. A bank that sends files by hand syncs when Operations upload one. */
export const scheduleLabels: Record<string, string> = {
  HOURLY: "Hourly",
  EVERY_6_HOURS: "Every 6 hours",
  TWICE_A_DAY: "Twice a day",
  ONCE_A_DAY: "Once a day",
  ON_UPLOAD: "On upload",
};

/**
 * Where a feed stands. Not the outcome of its last run alone: a feed that has been failing for days is a
 * different thing from one that failed once, and a feed switched off is not failing at all.
 */
export function feedStanding(feed: BankFeed): { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } {
  if (!feed.enabled) return { label: "Switched off", tone: "neutral" };
  if (feed.failingForDays) return { label: "Failing for days", tone: "danger" };
  if (feed.lastOutcome === "FAILED") return { label: "Failed", tone: "danger" };
  if (feed.lastOutcome === "RUNNING") return { label: "Running", tone: "info" };
  if (feed.lastOutcome === "SUCCEEDED") return { label: "Synced", tone: "success" };
  return { label: "Never run", tone: "neutral" };
}
