import type { ProposalRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";

export const proposalStatusLabels: Record<ProposalRowStatus, string> = {
  DRAFT: "Draft",
  PENDING_MANAGER_REVIEW: "Pending manager review",
  PENDING_REVIEW: "Pending client review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export const proposalStatusTones: Record<ProposalRowStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  PENDING_MANAGER_REVIEW: "warning",
  PENDING_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
};

/**
 * "2 days left" while the client still has it, and once they have answered, what they said and when — the
 * column is about where a proposal stands in time, and for a decided one that is the day it was decided.
 */
export function expiryLabel(expiresAt: string | null, status: ProposalRowStatus, decidedAt?: string | null) {
  if (status === "APPROVED" || status === "REJECTED") {
    const said = status === "APPROVED" ? "Approved" : "Rejected";
    return decidedAt ? `${said} ${formatDate(decidedAt)}` : said;
  }
  if (status === "EXPIRED") return "Expired";
  if (!expiresAt) return "Not sent yet";
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Expires today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function formatValue(amount: number | null, currency: string | null) {
  if (amount === null) return "—";
  const millions = amount / 1_000_000;
  const shown = millions >= 1 ? `${Number(millions.toFixed(millions >= 10 ? 0 : 1))}M` : amount.toLocaleString("en-GB");
  return `${currency ?? ""} ${shown}`.trim();
}
