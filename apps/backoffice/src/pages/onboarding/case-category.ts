import type { CaseSummary, CatalogueEntryCategoriesItem } from "@atomprive/api-client/backoffice";
import type { FormApplication } from "./application";

/**
 * Which of the three form packs a case needs. It follows from the application itself: an entity is an entity, and
 * an individual application with more than one holder is a joint account.
 */
export function categoryOf(summary: CaseSummary): CatalogueEntryCategoriesItem {
  if (summary.clientType === "ENTITY") return "ENTITY";
  return summary.accountHolders > 1 ? "JOINT" : "INDIVIDUAL";
}

/**
 * The same rule while the application is still being written, so the wizard can say what it is becoming: an
 * entity is an entity, one account holder is an individual, and a second holder makes it a joint account.
 */
export function categoryBeingEntered(application: FormApplication): CatalogueEntryCategoriesItem | null {
  if (application.clientType === "ENTITY") return "ENTITY";
  if (application.clientType !== "INDIVIDUAL") return null;
  return application.holders.length > 1 ? "JOINT" : "INDIVIDUAL";
}

export const categoryLabels: Record<CatalogueEntryCategoriesItem, string> = {
  ENTITY: "Entity",
  JOINT: "Joint",
  INDIVIDUAL: "Individual",
};

/** How a due date reads next to the date itself: "in 28d", "9d overdue", "7d early". */
export function dueLabel(dueOn: string | null, submittedAt: string | null): { text: string; tone: "plain" | "warn" | "late" } {
  if (!dueOn) return { text: submittedAt ? "" : "No date set", tone: "plain" };
  const due = new Date(`${dueOn}T00:00:00`);
  const against = submittedAt ? new Date(submittedAt) : new Date();
  const days = Math.round((due.setHours(0, 0, 0, 0) - against.setHours(0, 0, 0, 0)) / 86_400_000);
  if (submittedAt) {
    if (days > 0) return { text: `${days}d early`, tone: "plain" };
    if (days === 0) return { text: "on time", tone: "plain" };
    return { text: `${-days}d late`, tone: "warn" };
  }
  if (days < 0) return { text: `${-days}d overdue`, tone: "late" };
  if (days === 0) return { text: "due today", tone: "warn" };
  if (days === 1) return { text: "due tomorrow", tone: "warn" };
  return { text: `in ${days}d`, tone: "plain" };
}
