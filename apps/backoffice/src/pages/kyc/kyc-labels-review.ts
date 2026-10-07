import type { KycRequirement, ReviewRow } from "@atomprive/api-client/backoffice";

type Standing = ReviewRow["standing"];

/**
 * What Compliance have to do about a client next, in their words rather than the record's.
 *
 * <p>"Ready" is the one that matters: it is the only standing where somebody can act now, so it is the only
 * one the eye should be caught by.
 */
export const standingLabels: Record<Standing, string> = {
  NOT_STARTED: "Nothing in yet",
  IN_REVIEW: "In review",
  RE_UPLOAD: "Re-upload",
  READY: "Ready",
  REJECTED: "Rejected",
  EXPIRED: "Run out",
  APPROVED: "Approved",
};

export const standingTones: Record<Standing, "neutral" | "info" | "success" | "warning" | "danger"> = {
  NOT_STARTED: "neutral",
  IN_REVIEW: "info",
  RE_UPLOAD: "warning",
  READY: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
  APPROVED: "success",
};

/** The order the queue reads in: what can be acted on first, what the firm is waiting on last. */
export const standings: Standing[] = ["READY", "IN_REVIEW", "RE_UPLOAD", "EXPIRED", "REJECTED", "NOT_STARTED",
  "APPROVED"];

type PaperStanding = KycRequirement["stands"];

/** Where one paper has got to, said as the person chasing it would say it. */
export const paperLabels: Record<PaperStanding, string> = {
  NOT_SENT: "Not sent yet",
  AWAITING_REVIEW: "Waiting on Compliance",
  RE_UPLOAD_REQUESTED: "Asked for again",
  REJECTED: "Refused",
  APPROVED: "Approved",
  EXPIRED: "Run out",
};

/**
 * Who the firm is waiting on for this paper: the client, Compliance, or nobody. It is the thing somebody
 * working the file wants to know before anything else, because it says whose move it is.
 */
export const paperWaitsOn: Record<PaperStanding, "client" | "compliance" | "nobody"> = {
  NOT_SENT: "client",
  AWAITING_REVIEW: "compliance",
  RE_UPLOAD_REQUESTED: "client",
  REJECTED: "client",
  APPROVED: "nobody",
  EXPIRED: "client",
};
