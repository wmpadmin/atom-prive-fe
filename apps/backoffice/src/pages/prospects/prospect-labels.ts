import type {
  FollowUpStatusAfter,
  FollowUpMethod,
  ProspectDetailLostReason,
  ProspectRowOnboardingStage,
  ProspectRowSource,
  ProspectRowStatus,
} from "@atomprive/api-client/backoffice";

export type OnboardingStage = NonNullable<ProspectRowOnboardingStage>;

/** Where a converted prospect has got to on the way to being a client (23 Nov 2026), in the firm's words. */
export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  FILLING_FORMS: "Filling forms",
  DOCUMENTS_PENDING: "Documents pending",
  INCOME_CHECK: "Wealth check",
  WITH_COMPLIANCE: "Submitted to Compliance",
  COMPLIANCE_REVIEW: "Compliance review",
  MORE_DOCUMENTS: "Additional documents required",
  REJECTED: "Rejected",
  AGREEMENT_PENDING: "Agreement pending",
  ONBOARDED: "Onboarded",
};

/** Which of the five stages it is, as the tracker on the prospect counts them (Met is the first; no agreement yet). */
export const ONBOARDING_STAGE_STEP: Record<OnboardingStage, string> = {
  FILLING_FORMS: "Step 2 of 5",
  DOCUMENTS_PENDING: "Step 2 of 5",
  INCOME_CHECK: "Step 3 of 5",
  WITH_COMPLIANCE: "Step 4 of 5",
  COMPLIANCE_REVIEW: "Step 4 of 5",
  MORE_DOCUMENTS: "Step 4 of 5",
  REJECTED: "Step 4 of 5",
  AGREEMENT_PENDING: "Step 5 of 5",
  ONBOARDED: "Step 5 of 5",
};

export const ONBOARDING_STAGE_PILLS: Record<OnboardingStage, string> = {
  FILLING_FORMS: "bg-primary-50 text-primary-700",
  DOCUMENTS_PENDING: "bg-primary-50 text-primary-700",
  INCOME_CHECK: "bg-primary-50 text-primary-700",
  WITH_COMPLIANCE: "bg-amber-50 text-amber-700",
  COMPLIANCE_REVIEW: "bg-amber-50 text-amber-700",
  MORE_DOCUMENTS: "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-50 text-red-700",
  AGREEMENT_PENDING: "bg-violet-50 text-violet-700",
  ONBOARDED: "bg-emerald-50 text-emerald-700",
};

export const STATUS_LABELS: Record<ProspectRowStatus, string> = {
  DRAFT: "Draft",
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
  DRAFT: "border border-dashed border-slate-300 bg-white text-slate-500",
  NEW: "bg-primary-50 text-primary-700",
  IN_DISCUSSION: "bg-amber-50 text-amber-700",
  FOLLOW_UP: "bg-violet-50 text-violet-700",
  QUALIFIED: "bg-emerald-50 text-emerald-700",
  CONVERTED: "bg-slate-100 text-slate-600",
  LOST: "bg-red-50 text-red-700",
};

export const SOURCE_LABELS: Record<NonNullable<ProspectRowSource>, string> = {
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
