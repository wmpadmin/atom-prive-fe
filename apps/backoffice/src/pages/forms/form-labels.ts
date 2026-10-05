import type { CaseFormRow, CatalogueEntryCategoriesItem, FormRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";

/**
 * Where a form has got to. Nobody sets this by hand. Operations or the client's own advisor fill it in, and
 * the last answer is what sends it: it goes to that client's advisor to sign, and their signature finishes it.
 * An advisor who finds something wrong sends it back to whoever wrote it, saying what has to be put right.
 */
export function formStatus(
  status: FormRowStatus | "NOT_STARTED",
  dueOn: string | null,
): { label: string; tone: "neutral" | "warning" | "danger" | "success" } {
  if (status === "SUBMITTED") return { label: "Complete", tone: "success" };
  if (status === "SENT_BACK") return { label: "Sent back", tone: "danger" };
  if (status === "AWAITING_SIGNATURE") return { label: "With the advisor", tone: "warning" };
  if (status !== "WAITING_ON_CLIENT") return { label: "Pending", tone: "neutral" };
  // Due at the end of the day it was asked for.
  const overdue = dueOn !== null && new Date(`${dueOn}T23:59:59`) < new Date();
  return overdue ? { label: "Overdue", tone: "danger" } : { label: "Waiting on client", tone: "warning" };
}

/**
 * Whether anybody still types on this form. One with the advisor, one out with the client and one already
 * finished are all read: what is on them is what went out, and changing that quietly would make the copy
 * somebody else is holding a different document.
 */
export function stillBeingFilledIn(status: CaseFormRow["status"]) {
  return status === "NOT_STARTED" || status === "DRAFT" || status === "SENT_BACK";
}

export const formCategories = ["ENTITY", "JOINT", "INDIVIDUAL"] as const satisfies readonly CatalogueEntryCategoriesItem[];

export const categoryLabels: Record<CatalogueEntryCategoriesItem, string> = {
  ENTITY: "Entity",
  JOINT: "Joint",
  INDIVIDUAL: "Individual",
};

/** The line under a form's name, saying where it has got to and whose move it is. */
export function progressLine(form: CaseFormRow) {
  if (form.status === "SUBMITTED") {
    return `Completed · Signed ${form.submittedAt ? formatDate(form.submittedAt) : ""}`.trim();
  }
  if (form.status === "NOT_STARTED") {
    return "Pending completion · Not started";
  }
  // Sent back is the one state where somebody has to do something and the reason is the whole message, so it
  // is the line itself rather than a note beside it.
  if (form.status === "SENT_BACK") {
    const by = form.sentBackBy ? ` by ${form.sentBackBy}` : "";
    const when = form.sentBackAt ? `, ${formatDate(form.sentBackAt)}` : "";
    return `Sent back${by}${when}${form.sentBackReason ? ` · ${form.sentBackReason}` : ""}`;
  }
  if (form.status === "AWAITING_SIGNATURE") {
    return `With the advisor to sign${form.writtenBy ? ` · filled in by ${form.writtenBy}` : ""}`;
  }
  const requested = form.requestedOn ? ` · Requested ${formatDate(form.requestedOn)}` : "";
  if (form.status === "WAITING_ON_CLIENT") return `Awaiting client signature${requested}`;
  // A draft says who has it, so neither side has to ask the other whose move it is.
  return `Pending completion${form.writtenBy ? ` · with ${form.writtenBy}` : requested}`;
}
