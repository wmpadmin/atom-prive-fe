import type { ProposalRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";

/**
 * Where a proposal has got to, in the words a reader uses.
 *
 * <p>There were seven of these, because a proposal travelled between three desks with a fortnight's clock
 * over the last leg. It makes one journey now — written, waiting on one person, answered — and the labels
 * say whose desk it is on rather than which stage of a process it has reached.
 */
export const proposalStatusLabels: Record<ProposalRowStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Waiting on the relationship manager",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * The same label, naming the person it waits on where the server could say who.
 *
 * <p>"Waiting on the relationship manager" told a reader the desk but not the door. A client may have
 * two, and the manager who raised it is not one of them — so the name has to come from the proposal
 * rather than from the name beside it on the row, which is whoever wrote it.
 */
export function proposalStanding(status: ProposalRowStatus, waitingOn: string | null | undefined) {
  return status === "PENDING" && waitingOn
    ? `Waiting on ${waitingOn}`
    : proposalStatusLabels[status];
}

export const proposalStatusTones: Record<ProposalRowStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  PENDING: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

/**
 * What has become of it, for the column headed "Sent".
 *
 * <p>One moment now. Sent and submitted used to be two, because a proposal could stop at a manager's desk
 * on the way to the client — so this had to explain where a proposal was that had left its author and
 * reached nobody. There is no such place any more.
 */
export function sentLabel(sentAt: string | null) {
  return sentAt ? formatDate(sentAt) : "Not sent yet";
}

/**
 * Who answered it, and when.
 *
 * <p>Said whether or not they wrote a reason. An agreement needs none — only a refusal owes one — so on
 * most approved proposals the only place a name appeared was a note that was never written, and the
 * second relationship manager of a client would find the buttons gone with nothing saying who had been
 * there first.
 */
export function answeredLabel(status: ProposalRowStatus, answeredByName: string | null, decidedAt: string | null,
  fromRebalance = false) {
  // Agreed, not approved, where agreeing moved nothing. A rebalance says only what to sell; the money
  // moves as the portfolio desk places it, so "approved" over one of these reads as work already done.
  const said = status !== "APPROVED" ? "Rejected" : fromRebalance ? "Agreed" : "Approved";
  const who = `${said} by ${answeredByName ?? "their relationship manager"}`;
  return decidedAt ? `${who} on ${formatDate(decidedAt)}` : who;
}

/**
 * Where it stands in time: waiting, or what was decided and when.
 *
 * <p>It used to count down a fortnight, because the client had that long to answer. Nothing runs out now —
 * a proposal waits with its relationship manager until they answer it — so the column says how long it has
 * been waiting rather than how long is left.
 */
export function standingLabel(status: ProposalRowStatus, sentAt: string | null, decidedAt: string | null,
  fromRebalance = false, openForPlacing = false) {
  if (status === "APPROVED" || status === "REJECTED") {
    // A rebalance still being placed is not finished work, and a column that called it Approved put it
    // beside proposals whose money had actually moved.
    const said = status !== "APPROVED" ? "Rejected"
      : openForPlacing ? "Being placed" : fromRebalance ? "Placed" : "Approved";
    return decidedAt ? `${said} ${formatDate(decidedAt)}` : said;
  }
  if (status === "DRAFT" || !sentAt) return "Not sent yet";
  const days = Math.floor((Date.now() - new Date(sentAt).getTime()) / 86_400_000);
  if (days <= 0) return "Sent today";
  return days === 1 ? "Waiting 1 day" : `Waiting ${days} days`;
}

export function formatValue(amount: number | null, currency: string | null) {
  if (amount === null) return "—";
  const millions = amount / 1_000_000;
  const shown = millions >= 1 ? `${Number(millions.toFixed(millions >= 10 ? 0 : 1))}M` : amount.toLocaleString("en-GB");
  return `${currency ?? ""} ${shown}`.trim();
}
