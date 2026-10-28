/**
 * What an access request's state is called, and which side of one the reader is on.
 *
 * <p>Plain functions in a plain file, because the queue, the sent list and the details page are three views
 * of one row and a client who read "Refused" on one and "Rejected" on another would reasonably wonder
 * whether they were two different things.
 */
import type { RequestRow } from "@atomprive/api-client/portal";

export type Status = RequestRow["status"];

/** The firm's word for each state, and nobody's but the firm's. */
export const SAID: Record<Status, string> = {
  ASKED: "Pending",
  APPROVED: "Approved",
  REJECTED: "Refused",
  CANCELLED: "Withdrawn",
};

export const TONE = {
  ASKED: "waiting",
  APPROVED: "good",
  REJECTED: "bad",
  CANCELLED: "quiet",
} as const;

/** How many accounts a request was about, written out. */
export function accountsAsked(request: RequestRow) {
  return request.accountsAsked === 1 ? "1 account" : `${request.accountsAsked} accounts`;
}

/**
 * The other person in a request, whichever side the reader is on.
 *
 * <p>Never the reader. A row that says "Rahul Mehta asked Rahul Mehta" is a row read from the wrong side,
 * and this is the one place that decides which name a list shows.
 */
export function theOther(request: RequestRow) {
  return request.mine
    ? { name: request.ownerName, id: request.ownerId, photo: request.ownerPhoto }
    : { name: request.requesterName, id: request.requesterId, photo: request.requesterPhoto };
}

/** Which way round it went, in the order a client reads it. */
export function direction(request: RequestRow) {
  return request.mine ? "You asked" : "Asked you";
}
