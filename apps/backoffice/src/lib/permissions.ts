import type { PermissionGrantPermission, StaffProfile } from "@atomprive/api-client/backoffice";

/**
 * An authority the API checks, such as "MANAGE_USERS_AND_ROLES:CHANGE" (see AccessLevel.java). Menus and
 * buttons check the same strings, so nobody is offered an action the API would refuse.
 */
export type Authority = `${PermissionGrantPermission}:${"VIEW" | "CHANGE" | "OWN_CLIENTS" | "ASSIGNED"}`;

export function hasAuthority(user: StaffProfile, authority: Authority) {
  return user.permissions.includes(authority);
}

/** True when the person holds any one of these, for screens several access levels can open. */
export function hasAnyAuthority(user: StaffProfile, ...authorities: Authority[]) {
  return authorities.some((authority) => hasAuthority(user, authority));
}

/** Whoever looks after clients of their own: an advisor, or anyone given the same level. */
export function advisesClients(user: StaffProfile) {
  return hasAnyAuthority(user, "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS", "VIEW_CUSTOMER_PROFILE:ASSIGNED");
}

/**
 * Enough to open a client's file, the same set CustomerController lets through: their own advisor, someone
 * assigned to them, or anyone who reads every client.
 */
export const OPENS_CLIENT_FILES: Authority[] = [
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:ASSIGNED",
  "VIEW_CUSTOMER_PROFILE:VIEW",
  "VIEW_ALL_CLIENTS:VIEW",
];

/** Enough to write proposals, the same set ProposalController lets through. */
export const WRITES_PROPOSALS: Authority[] = ["SEND_PROPOSALS:OWN_CLIENTS", "SEND_PROPOSALS:ASSIGNED", "SEND_PROPOSALS:CHANGE"];

/** Whoever may write proposals for their own clients. */
export function writesProposals(user: StaffProfile) {
  return hasAnyAuthority(user, ...WRITES_PROPOSALS);
}
