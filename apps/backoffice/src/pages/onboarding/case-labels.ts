import type { CaseSummary } from "@atomprive/api-client/backoffice";
import { countryName } from "../../lib/countries";

export type CaseStatus = CaseSummary["status"];

export const caseStatusLabels: Record<CaseStatus, string> = {
  IN_PROCESS: "In process",
  COMPLETED: "Completed",
};

export const caseStatuses = Object.keys(caseStatusLabels) as CaseStatus[];

/** What's shown under the client's name, such as "Individual · Joint · India". */
export function caseSubtitle(summary: CaseSummary) {
  const parts = [summary.clientType === "ENTITY" ? "Entity" : "Individual"];
  if (summary.clientType === "INDIVIDUAL" && summary.accountHolders > 1) parts.push("Joint");
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

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function formatDay(value: string) {
  return day.format(new Date(value));
}

/** The case list as it was left, with its search, filter and page, for links back to it from a case. */
export function listHref(state: unknown) {
  const search = (state as { list?: unknown } | null)?.list;
  return typeof search === "string" && search.startsWith("?") ? `/onboarding${search}` : "/onboarding";
}
