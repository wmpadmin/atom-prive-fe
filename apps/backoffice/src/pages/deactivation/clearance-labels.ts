import type { ClearanceRowStanding } from "@atomprive/api-client/backoffice";

/**
 * What each answer is called on screen, and what colour it carries.
 *
 * <p>In one place because four screens show the same four words — the client's own file, the desk's
 * list, the shared pipeline and the Admin's review. Four copies of "Go ahead" is how one of them comes
 * to say something slightly different from the others.
 */
export const standingLabels: Record<ClearanceRowStanding, string> = {
  AWAITED: "Not answered",
  GO_AHEAD: "Go ahead",
  PENDING: "Still pending",
  BLOCKED: "Blocked",
};

export const standingTones: Record<ClearanceRowStanding, "success" | "warning" | "danger" | "neutral"> = {
  AWAITED: "neutral",
  GO_AHEAD: "success",
  PENDING: "warning",
  BLOCKED: "danger",
};

/** How a deadline reads: the days left, or how far past it already is. */
export function deadlineSaid(daysLeft: number | null, overdue: boolean) {
  if (daysLeft === null) return null;
  if (overdue) return `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} overdue`;
  if (daysLeft === 0) return "due today";
  return `${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining`;
}
