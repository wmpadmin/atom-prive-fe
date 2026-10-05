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

/**
 * Enough to follow onboarding cases, the same set ClientOnboardingController lets through: Operations, who
 * follow every case, and an advisor, who follows the clients they look after themselves.
 */
export const ONBOARDS_CLIENTS: Authority[] = ["ONBOARD_CLIENTS:VIEW", "ONBOARD_CLIENTS:OWN_CLIENTS"];

/**
 * Enough to enter and submit a client's details. Operations do it for every client; an advisor does it for
 * the clients they look after themselves. Filling in the client's forms is Operations' alone — that stays
 * ONBOARD_CLIENTS:CHANGE.
 */
export const ONBOARDS_CLIENTS_CHANGE: Authority[] = ["ONBOARD_CLIENTS:CHANGE", "ONBOARD_CLIENTS:OWN_CLIENTS"];

/**
 * Onboarding across the whole book rather than an advisor's own clients. The post-onboarding notice is every
 * client's pack, so it belongs to whoever follows all of them and not to an advisor who onboards their own.
 */
export const ONBOARDS_EVERY_CLIENT: Authority[] = ["ONBOARD_CLIENTS:VIEW", "ONBOARD_CLIENTS:CHANGE"];

/** Enough to put a client's papers on file: Compliance for any client, an advisor for their own. */
export const UPLOADS_CLIENT_DOCUMENTS: Authority[] = [
  "UPLOAD_CLIENT_DOCUMENTS:CHANGE",
  "UPLOAD_CLIENT_DOCUMENTS:OWN_CLIENTS",
];

/** Enough to open a client's papers: whoever decides on them, and whoever puts them on file. */
export const OPENS_CLIENT_DOCUMENTS: Authority[] = ["APPROVE_ONBOARDING:VIEW", ...UPLOADS_CLIENT_DOCUMENTS];

/** Enough to write proposals, the same set ProposalController lets through. */
/**
 * Who may open a client's form or the wording of a document. The same list the API guards those screens with:
 * Operations and Admin fill them, an advisor works on their own clients' and signs them, and Compliance read
 * them without touching them. Anybody this does not name is not offered the click in the first place.
 */
export const READS_CLIENT_FORMS: Authority[] = [
  "FILL_CLIENT_FORMS:VIEW",
  "ONBOARD_CLIENTS:VIEW",
  "ONBOARD_CLIENTS:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
];

/** Who may type on one: Operations and Admin on any, an advisor on their own clients'. */
export const FILLS_CLIENT_FORMS: Authority[] = ["FILL_CLIENT_FORMS:CHANGE", "FILL_CLIENT_FORMS:OWN_CLIENTS"];

export const WRITES_PROPOSALS: Authority[] = ["SEND_PROPOSALS:OWN_CLIENTS", "SEND_PROPOSALS:ASSIGNED", "SEND_PROPOSALS:CHANGE"];

/** Enough to read proposals: whoever writes them, and Compliance, who oversee the advice the firm gives. */
export const READS_PROPOSALS: Authority[] = ["SEND_PROPOSALS:VIEW", ...WRITES_PROPOSALS];

/** Whoever may pass a proposal to the client, or send it back to the advisor who wrote it. */
export const APPROVES_PROPOSALS: Authority[] = ["APPROVE_PROPOSALS:CHANGE", "APPROVE_PROPOSALS:OWN_CLIENTS"];

/** Reading how the firm invests, which follows reading a client's portfolio rather than writing proposals. */
export const READS_CLIENT_PORTFOLIOS: Authority[] = [
  "VIEW_CUSTOMER_PROFILE:VIEW",
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:ASSIGNED",
];

/** Whoever may write proposals for their own clients. */
export function writesProposals(user: StaffProfile) {
  return hasAnyAuthority(user, ...WRITES_PROPOSALS);
}

/**
 * Where a client lives for whoever is looking, which is not the same screen for everybody.
 *
 * <p>An advisor is kept off the directory of every client — theirs are under My clients — so a link that
 * always said /clients would bounce them away from their own client's file. A portfolio manager is kept off
 * it too, and does not have a servicing file to be sent to at all: their work on a client is the portfolio,
 * so that is the client as they know one.
 */
export function clientFileHref(user: { activeRole?: string | null }, clientId: string) {
  if (user.activeRole === "ADVISOR") return `/my-clients/${clientId}`;
  if (user.activeRole === "PORTFOLIO_MANAGER") return `/portfolio-clients/${clientId}`;
  return `/clients/${clientId}`;
}
