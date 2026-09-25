import type { AdvisorAssignment, CustomerRow } from "@atomprive/api-client/backoffice";

export type KycStatus = CustomerRow["kycStatus"];

export const kycStatusLabels: Record<KycStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export const kycStatuses = Object.keys(kycStatusLabels) as KycStatus[];

export const kycStatusTones: Record<KycStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  NOT_SUBMITTED: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
};

export const clientTypeLabels: Record<CustomerRow["type"], string> = {
  INDIVIDUAL: "Individual",
  ENTITY: "Entity",
};

/**
 * What kind of account a client holds. A joint account is two people on one application rather than a kind of
 * client record, so it is worked out from who else came in with them.
 */
export const clientKindLabels: Record<CustomerRow["clientType"], string> = {
  INDIVIDUAL: "Individual",
  JOINT: "Joint",
  ENTITY: "Entity",
};

/** All clients as it was left, with its search, filters and page, for links back to it from a client. */
export function clientsHref(state: unknown) {
  const search = (state as { list?: unknown } | null)?.list;
  return typeof search === "string" && search.startsWith("?") ? `/clients${search}` : "/clients";
}

/** What an assignment did, such as "Karan Shah was added to 3 clients. Karan Shah has been emailed." */
export function assignmentNotice({ advisor, assigned, unchanged, email }: AdvisorAssignment) {
  const clients = (count: number) => (count === 1 ? "1 client" : `${count} clients`);
  const parts: string[] = [];
  if (assigned > 0) parts.push(`${advisor.fullName} was added to ${clients(assigned)}.`);
  if (unchanged > 0) parts.push(`${clients(unchanged)} already had ${advisor.fullName} as an advisor.`);
  if (email === "SENT") parts.push(`${advisor.fullName} has been emailed.`);
  if (email === "NO_WORDING") {
    parts.push(`${advisor.fullName} wasn't emailed, because the “Clients assigned to you” email has no wording yet. Add it under Config data, Email templates.`);
  }
  if (email === "FAILED") parts.push(`The email to ${advisor.fullName} couldn't be sent.`);
  return parts.join(" ");
}
