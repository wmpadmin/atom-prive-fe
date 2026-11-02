import type {
  FollowUpStatusAfter,
  FollowUpMethod,
  ProspectDetailLostReason,
  ProspectRowSource,
  ProspectRowStatus,
} from "@atomprive/api-client/backoffice";

export const STATUS_LABELS: Record<ProspectRowStatus, string> = {
  NEW: "New",
  IN_DISCUSSION: "In Discussion",
  FOLLOW_UP: "Follow Up",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};

/** The four a prospect is worked through by hand; Converted and Lost close them and have buttons of their own. */
export const OPEN_STATUSES: ProspectRowStatus[] = ["NEW", "IN_DISCUSSION", "FOLLOW_UP", "QUALIFIED"];

/** Each status its own colour, as in the firm's picture: blue, amber, violet, green; grey once closed. */
export const STATUS_PILLS: Record<ProspectRowStatus, string> = {
  NEW: "bg-primary-50 text-primary-700",
  IN_DISCUSSION: "bg-amber-50 text-amber-700",
  FOLLOW_UP: "bg-violet-50 text-violet-700",
  QUALIFIED: "bg-emerald-50 text-emerald-700",
  CONVERTED: "bg-slate-100 text-slate-600",
  LOST: "bg-red-50 text-red-700",
};

export const SOURCE_LABELS: Record<ProspectRowSource, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  EVENT: "Event",
  WALK_IN: "Walk-in",
  OTHER: "Other",
};

export const METHOD_LABELS: Record<FollowUpMethod, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  MESSAGE: "Message",
  NOTE: "Note",
};

export const LOST_REASONS: Record<NonNullable<ProspectDetailLostReason>, string> = {
  NOT_INTERESTED: "Not interested",
  WENT_ELSEWHERE: "Went elsewhere",
  NOT_ELIGIBLE: "Not eligible",
  NO_REPLY: "Could not reach them",
  OTHER: "Other",
};

export function statusLabel(status: ProspectRowStatus | FollowUpStatusAfter) {
  return STATUS_LABELS[status];
}
