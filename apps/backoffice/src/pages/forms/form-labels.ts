import type { CaseFormRow, CatalogueEntryCategoriesItem, FormRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";

/**
 * Where a form has got to. Nobody sets this by hand: it follows what has been filled in, and once the form is with
 * the client it follows the day it was due back. It becomes complete when their signed copy comes in.
 */
export function formStatus(
  status: FormRowStatus | "NOT_STARTED",
  dueOn: string | null,
): { label: string; tone: "neutral" | "warning" | "danger" | "success" } {
  if (status === "SUBMITTED") return { label: "Complete", tone: "success" };
  if (status === "AWAITING_COMPLIANCE") return { label: "With compliance", tone: "warning" };
  if (status === "REJECTED") return { label: "Sent back", tone: "danger" };
  if (status !== "WAITING_ON_CLIENT") return { label: "Pending", tone: "neutral" };
  // Due at the end of the day it was asked for.
  const overdue = dueOn !== null && new Date(`${dueOn}T23:59:59`) < new Date();
  return overdue ? { label: "Overdue", tone: "danger" } : { label: "Waiting on client", tone: "warning" };
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
    return "Signed · with compliance to review";
  }
  // The reason is what Operations have to act on, so it is the line rather than a note beside it.
  if (form.status === "REJECTED") {
    return `Sent back by compliance${form.compliance?.comment ? ` · ${form.compliance.comment}` : ""}`;
  }
  const requested = form.requestedOn ? ` · Requested ${formatDate(form.requestedOn)}` : "";
  return form.status === "WAITING_ON_CLIENT" ? `Awaiting client signature${requested}` : `Pending completion${requested}`;
}
