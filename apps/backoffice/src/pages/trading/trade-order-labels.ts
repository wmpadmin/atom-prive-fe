import type { TradeOrderRowStatus } from "@atomprive/api-client/backoffice";

export const orderStatusLabels: Record<TradeOrderRowStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "With Compliance",
  APPROVED: "Passed",
  REJECTED: "Refused",
  SENT: "At the bank",
  EXECUTED: "Done",
  SETTLED: "Settled",
  CANCELLED: "Stopped",
};

export const orderStatusTones: Record<
  TradeOrderRowStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  SENT: "info",
  EXECUTED: "success",
  SETTLED: "success",
  CANCELLED: "neutral",
};

/** Money as the blotter writes it: grouped thousands, two decimal places. */
export function orderAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Whose move it is next. A blotter read by three different teams has to say so, or each of them assumes it
 * is one of the others'.
 */
export function waitingOn(status: TradeOrderRowStatus) {
  switch (status) {
    case "DRAFT":
      return "Not put to anybody yet";
    case "PENDING_REVIEW":
      return "Waiting on Compliance";
    case "APPROVED":
      return "Waiting on Operations";
    case "SENT":
      return "Waiting on the bank";
    case "EXECUTED":
      return "Waiting to settle";
    default:
      return null;
  }
}
