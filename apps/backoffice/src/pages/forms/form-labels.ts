import type { CaseFormRow, CatalogueEntryCategoriesItem, FormRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";

/**
 * Where a form has got to. Nobody sets this by hand: Operations fill it in and send it for KYC review, and it
 * goes to the client only once Compliance have passed it. It becomes complete when their signed copy comes in.
 */
export function formStatus(
  status: FormRowStatus | "NOT_STARTED",
  dueOn: string | null,
): { label: string; tone: "neutral" | "warning" | "danger" | "success" } {
  if (status === "SUBMITTED") return { label: "Complete", tone: "success" };
  if (status === "AWAITING_COMPLIANCE") return { label: "KYC review", tone: "warning" };
  if (status === "REJECTED") return { label: "Sent back", tone: "danger" };
  if (status !== "WAITING_ON_CLIENT") return { label: "Pending", tone: "neutral" };
  // Due at the end of the day it was asked for.
  const overdue = dueOn !== null && new Date(`${dueOn}T23:59:59`) < new Date();
  return overdue ? { label: "Overdue", tone: "danger" } : { label: "Waiting on client", tone: "warning" };
}

/**
 * Whether Operations still type on this form here. A form they have sent for review, one out with the client
 * and one already finished are all read: what is on them is what went out, and changing that quietly would
 * make the copy somebody else is holding a different document.
 */
export function stillBeingFilledIn(status: CaseFormRow["status"]) {
  return status === "NOT_STARTED" || status === "DRAFT" || status === "REJECTED";
}

export const formCategories = ["ENTITY", "JOINT", "INDIVIDUAL"] as const satisfies readonly CatalogueEntryCategoriesItem[];

export const categoryLabels: Record<CatalogueEntryCategoriesItem, string> = {
  ENTITY: "Entity",
  JOINT: "Joint",
  INDIVIDUAL: "Individual",
};

/** The line under a form's name, saying where it has got to. */
export function progressLine(form: CaseFormRow) {
  if (form.status === "SUBMITTED") {
    return `Completed · Submitted ${form.submittedAt ? formatDate(form.submittedAt) : ""}`.trim();
  }
  if (form.status === "NOT_STARTED") {
    return "Pending completion · Not started";
  }
  if (form.status === "AWAITING_COMPLIANCE") {
    return "Filled in · with compliance for KYC review";
  }
  // What compliance decided is what Operations have to act on, so it is the line rather than a note beside
  // it: sent back, they put it right; passed, they know the client has it because compliance let it go.
  if (form.status === "REJECTED") {
    return said("Sent back by compliance", form);
  }
  if (form.status === "WAITING_ON_CLIENT" && form.compliance?.approved) {
    return said("Approved by compliance · awaiting client signature", form);
  }
  const requested = form.requestedOn ? ` · Requested ${formatDate(form.requestedOn)}` : "";
  return form.status === "WAITING_ON_CLIENT" ? `Awaiting client signature${requested}` : `Pending completion${requested}`;
}

/** A decision, said with who took it, when, and anything they wrote. */
function said(what: string, form: CaseFormRow) {
  const decision = form.compliance;
  if (!decision) return what;
  const parts = [`${what} · ${decision.decidedBy}, ${formatDate(decision.decidedAt)}`];
  if (decision.comment) parts.push(decision.comment);
  return parts.join(" · ");
}
