import type { CaseSummary } from "@atomprive/api-client/backoffice";
import { countryName } from "../../lib/countries";
import { categoryLabels, categoryOf } from "./case-category";

export type CaseStatus = CaseSummary["status"];

export const caseStatusLabels: Record<CaseStatus, string> = {
  IN_PROCESS: "In process",
  COMPLETED: "Completed",
};

export const caseStatuses = Object.keys(caseStatusLabels) as CaseStatus[];

/** What's shown under the client's name, such as "Individual · Joint · India". */
export function caseSubtitle(summary: CaseSummary) {
  // One category, not two: an individual application becomes joint the moment a second holder is added.
  const parts = [categoryLabels[categoryOf(summary)]];
  if (summary.countryCode) parts.push(countryName(summary.countryCode));
  return parts.join(" · ");
}

/** Up to two initials, skipping symbols such as the "&" in "Arjun & Sara Kapoor". */
export function initialsOf(name: string) {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}


/**
 * Where Back goes from a case: All clients, which is the only list of them there is now.
 *
 * <p>It used to carry the case list's own search and page back with it, so a reader returned to the view
 * they left. That search belonged to the case list's filters — a status and a manager — and All clients
 * has neither, so carrying it would apply nothing and look like it had applied something.
 */
export function listHref() {
  return "/clients";
}
