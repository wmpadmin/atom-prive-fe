import { ApiError, http } from "@atomprive/api-client";
import type { StaffMember } from "@atomprive/api-client/backoffice";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

/**
 * Which Operations people look after which clients and prospects (26 Nov 2026), set by the Head of Operations or an
 * Admin. Read with hand-written calls until the API client is next generated.
 */
export type OperationsPerson = StaffMember & { looksAfter: number };

export type OperationsAssigned = {
  clients: Record<string, StaffMember[]>;
  prospects: Record<string, StaffMember[]>;
  /** Whether the reader may assign and take people off: the Head of Operations, or an Admin. The server decides. */
  mayAssign: boolean;
};

export type OperationsAssignOutcome = { assigned: number; unchanged: number };

const BASE = "/api/backoffice/operations";

/** Everything cached about Operations assignments starts with this, so one invalidation refreshes every screen. */
export const OPERATIONS_KEY = [BASE] as const;

/** Every Operations person, to choose from, with how many clients and prospects each looks after. */
export function useOperationsPeople(enabled = true) {
  return useQuery<OperationsPerson[], ApiError>({
    queryKey: [...OPERATIONS_KEY, "people"],
    queryFn: () => http<OperationsPerson[]>(`${BASE}/people`),
    enabled,
    staleTime: 60_000,
  });
}

/** Who looks after the clients and prospects named, and whether the reader may change it. */
export function useOperationsAssigned(
  { customerIds = [], prospectIds = [] }: { customerIds?: string[]; prospectIds?: string[] },
  enabled = true,
) {
  const query = new URLSearchParams();
  customerIds.forEach((id) => query.append("customerIds", id));
  prospectIds.forEach((id) => query.append("prospectIds", id));
  return useQuery<OperationsAssigned, ApiError>({
    queryKey: [...OPERATIONS_KEY, "assignments", customerIds, prospectIds],
    queryFn: () => http<OperationsAssigned>(`${BASE}/assignments?${query.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Gives the clients and prospects the people named; those already on them stay. Each person is emailed. */
export function assignOperations(body: { customerIds?: string[]; prospectIds?: string[]; staffIds: string[] }) {
  return http<OperationsAssignOutcome>(`${BASE}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Takes one Operations person off a client (and off the prospect it was). */
export function removeOperationsFromClient(customerId: string, staffId: string) {
  return http<void>(`${BASE}/clients/${customerId}/people/${staffId}`, { method: "DELETE" });
}

/** Takes one Operations person off a prospect. */
export function removeOperationsFromProspect(prospectId: string, staffId: string) {
  return http<void>(`${BASE}/prospects/${prospectId}/people/${staffId}`, { method: "DELETE" });
}

/** The success line after assigning, as the other assign dialogs say theirs. */
export function operationsNotice({ assigned, unchanged }: OperationsAssignOutcome) {
  if (assigned === 0) return "Nothing changed: everyone chosen already looks after them.";
  const added = assigned === 1 ? "1 assignment added" : `${assigned} assignments added`;
  return unchanged > 0 ? `${added}; ${unchanged} already in place.` : `${added}. Each person has been emailed.`;
}
