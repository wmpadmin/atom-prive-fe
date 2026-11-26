import { ApiError, http } from "@atomprive/api-client";
import { useQuery } from "@tanstack/react-query";

/** How often a paper is asked for (26 Nov 2026), as the server keeps it. */
export type Frequency = "ONCE_BEFORE_ONBOARDING" | "ONCE_AFTER_ONBOARDING" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

/** Where a paper on a client's list stands against how often it is asked. */
export type Due = "NONE" | "UPCOMING" | "DUE_SOON" | "OVERDUE" | "AFTER_ONBOARDING";

/**
 * One paper on one client's list and when it is next asked for (26 Nov 2026): read with a hand-written call until the
 * API client is next generated.
 */
export type FreshCopy = {
  customerId: string;
  clientName: string;
  clientCode: string;
  clientType: "INDIVIDUAL" | "ENTITY";
  paperId: string;
  paper: string;
  frequency: Frequency;
  lastApproved: string | null;
  dueOn: string | null;
  due: Due;
  rms: string[];
  reminded: string[];
};

export const HOW_OFTEN: Record<Frequency, string> = {
  ONCE_BEFORE_ONBOARDING: "Once, before onboarding",
  ONCE_AFTER_ONBOARDING: "Once, after onboarding",
  MONTHLY: "Every month",
  QUARTERLY: "Every quarter",
  HALF_YEARLY: "Twice a year",
  YEARLY: "Once a year",
};

/** Every paper due again within 30 days or overdue, soonest first: the KYC review queue's Due again tab. */
export function useDueAgain(enabled = true) {
  return useQuery<FreshCopy[], ApiError>({
    queryKey: ["/api/backoffice/kyc/due-again"],
    queryFn: () => http<FreshCopy[]>("/api/backoffice/kyc/due-again"),
    enabled,
  });
}

/** Every paper on one client's list with how often it is asked and when next, for their KYC file. */
export function useClientFreshCopies(customerId: string) {
  return useQuery<FreshCopy[], ApiError>({
    queryKey: ["/api/backoffice/kyc/clients", customerId, "fresh-copies"],
    queryFn: () => http<FreshCopy[]>(`/api/backoffice/kyc/clients/${customerId}/fresh-copies`),
  });
}

/** Whole days from today to a date (negative once it has passed), read as calendar days where the reader is. */
export function daysUntil(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const due = Date.UTC(year!, month! - 1, day!);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}

/** The status a line is shown with, such as "Overdue 24 days", "Due in 12 days" or "Due today". */
export function dueStatus(line: Pick<FreshCopy, "due" | "dueOn">) {
  if (line.due === "AFTER_ONBOARDING") return "Due now · after onboarding";
  if (!line.dueOn) return "";
  const days = daysUntil(line.dueOn);
  if (days < 0) return `Overdue ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}
