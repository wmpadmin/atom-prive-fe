import type { CatalogueEntryCategoriesItem, FormRowStatus } from "@atomprive/api-client/backoffice";

/**
 * Where a form has got to. Nobody sets this by hand: it follows what has been filled in, and once the form is with
 * the client it follows the day it was due back. It becomes complete when their signed copy comes in.
 */
export function formStatus(
  status: FormRowStatus | "NOT_STARTED",
  dueOn: string | null,
): { label: string; tone: "neutral" | "warning" | "danger" | "success" } {
  if (status === "SUBMITTED") return { label: "Complete", tone: "success" };
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
