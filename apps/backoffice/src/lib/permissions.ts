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

/** Whoever looks after clients of their own: a relationship manager, or anyone given the same level. */
export function advisesClients(user: StaffProfile) {
  return hasAnyAuthority(user, "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS", "VIEW_CUSTOMER_PROFILE:ASSIGNED");
}

/**
 * Enough to open a client's file, the same set CustomerController lets through: their own relationship
 * manager, someone assigned to them, or anyone who reads every client.
 */
export const OPENS_CLIENT_FILES: Authority[] = [
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:ASSIGNED",
  "VIEW_CUSTOMER_PROFILE:VIEW",
  "VIEW_ALL_CLIENTS:VIEW",
];

/**
 * Enough to follow onboarding cases, the same set ClientOnboardingController lets through: Operations, who
 * follow every case, and a relationship manager, who follows the clients they look after themselves.
 */
export const ONBOARDS_CLIENTS: Authority[] = ["ONBOARD_CLIENTS:VIEW", "ONBOARD_CLIENTS:OWN_CLIENTS"];

/**
 * Enough to enter and submit a client's details. Operations do it for every client; a relationship manager
 * does it for the clients they look after themselves. Filling in the client's forms is Operations' alone — that stays
 * ONBOARD_CLIENTS:CHANGE.
 */
export const ONBOARDS_CLIENTS_CHANGE: Authority[] = ["ONBOARD_CLIENTS:CHANGE", "ONBOARD_CLIENTS:OWN_CLIENTS"];

/**
 * Whoever has a client's forms sent to them to sign: the relationship manager, who signs for their own.
 *
 * <p>Named for the job rather than borrowed from another one. This screen was reached through the
 * proposals permission, which has nothing to do with signing a client's papers — it happened to be held
 * by the same role, so it worked, and a change to who answers proposals would have taken the signing
 * screen off their menu without anybody touching it.
 */
export const SIGNS_CLIENT_FORMS: Authority[] = ["ONBOARD_CLIENTS:OWN_CLIENTS"];

/**
 * Onboarding across the whole book rather than a relationship manager's own clients. The post-onboarding
 * notice is every client's pack, so it belongs to whoever follows all of them and not to a relationship
 * manager who onboards their own.
 */
export const ONBOARDS_EVERY_CLIENT: Authority[] = ["ONBOARD_CLIENTS:VIEW", "ONBOARD_CLIENTS:CHANGE"];

/**
 * Enough to put somebody else down as the client's relationship manager, the same set ClientOnboardingController
 * works a case for. A relationship manager without one of these onboards their own clients and has to name
 * themselves, so offering them the whole list is offering a choice that is then refused.
 */
export const NAMES_ANY_RELATIONSHIP_MANAGER: Authority[] = [
  ...ONBOARDS_EVERY_CLIENT,
  "APPROVE_ONBOARDING:VIEW",
  "APPROVE_ONBOARDING:CHANGE",
];

/** Enough to put a client's papers on file: Compliance for any client, a relationship manager for their own. */
export const UPLOADS_CLIENT_DOCUMENTS: Authority[] = [
  "UPLOAD_CLIENT_DOCUMENTS:CHANGE",
  "UPLOAD_CLIENT_DOCUMENTS:OWN_CLIENTS",
];

/** Enough to open a client's papers: whoever decides on them, and whoever puts them on file. */
export const OPENS_CLIENT_DOCUMENTS: Authority[] = ["APPROVE_ONBOARDING:VIEW", ...UPLOADS_CLIENT_DOCUMENTS];

/** Enough to write proposals, the same set ProposalController lets through. */
/**
 * Who may open a client's form or the wording of a document. The same list the API guards those screens with:
 * Operations and Admin fill them, a relationship manager works on their own clients' and signs them, and Compliance
 * read them without touching them. Anybody this does not name is not offered the click in the first place.
 */
export const READS_CLIENT_FORMS: Authority[] = [
  "FILL_CLIENT_FORMS:VIEW",
  "ONBOARD_CLIENTS:VIEW",
  "ONBOARD_CLIENTS:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  // Compliance read a client's forms from the client's own file — the only way they reach one, since they have
  // no Forms screen of their own. They hold nothing that fills a form in, so reading is the whole of it. The
  // API has always served them a form; this is what stops the screen turning them away before it asks.
  "APPROVE_ONBOARDING:CHANGE",
];

/** Who may type on one: Operations and Admin on any, a relationship manager on their own clients'. */
export const FILLS_CLIENT_FORMS: Authority[] = ["FILL_CLIENT_FORMS:CHANGE", "FILL_CLIENT_FORMS:OWN_CLIENTS"];

/**
 * Who writes proposals: whoever reads the firm's whole book.
 *
 * <p>It used to be the other way round, and this list used to be the three levels held to a set of
 * clients. A proposal was a letter to the client in the voice of whoever looked after them. It moves that
 * client's money on a yes now, so it is written by whoever sees the position across the firm, and it is
 * answered by the one person who may speak for that client — which keeps the rule that matters whole:
 * writing it and agreeing to it are two people.
 */
export const WRITES_PROPOSALS: Authority[] = ["SEND_PROPOSALS:CHANGE"];

/** Starting one and writing one are the same job now, and the same permission. */
export const STARTS_PROPOSALS: Authority[] = WRITES_PROPOSALS;

/**
 * Enough to open the proposals screen at all.
 *
 * <p>Four different jobs reach it: whoever writes them, whoever answers them for their own clients,
 * whoever answers for the whole firm, and Compliance, who oversee the advice and do neither. Leaving the
 * answering out shut the relationship manager — who now writes none and answers all of theirs — out of
 * the only screen they have here.
 */
export const READS_PROPOSALS: Authority[] = [
  "SEND_PROPOSALS:VIEW",
  "SEND_PROPOSALS:CHANGE",
  "APPROVE_PROPOSALS:CHANGE",
  "APPROVE_PROPOSALS:OWN_CLIENTS",
];

/**
 * Whether this person reads the firm's whole book of proposals rather than only their own clients'.
 *
 * <p>Asked the same way the API asks it, and asked in one place: a relationship manager is held to the
 * clients assigned to them, and everybody else here reads the lot. The screen has been wrong this way
 * once already, saying "your clients only" over a list full of other people's work.
 */
export function readsEveryAdvisors(user: StaffProfile) {
  return hasAnyAuthority(user, "SEND_PROPOSALS:VIEW", "SEND_PROPOSALS:CHANGE", "APPROVE_PROPOSALS:CHANGE");
}

/** Whoever writes the firm's money-laundering risk sheet: its lines, their weights and its bands. */
export const WRITES_AML_MATRIX: Authority[] = ["MANAGE_AML_MATRIX:CHANGE"];

/** Anyone who may look at the sheet. Whoever scores against it has to be able to read what they score on. */
export const READS_AML_MATRIX: Authority[] = ["MANAGE_AML_MATRIX:VIEW", ...WRITES_AML_MATRIX];

/** Whoever scores a client against it. */
export const RATES_AML_RISK: Authority[] = ["RATE_AML_RISK:CHANGE", "RATE_AML_RISK:OWN_CLIENTS"];

/** Anyone who may see where clients sit, whichever of the two jobs is theirs. */
export const READS_AML_RISK: Authority[] = ["RATE_AML_RISK:VIEW", ...RATES_AML_RISK];

/**
 * Whoever answers a proposal on a client's behalf.
 *
 * <p>Both authorities, always. A relationship manager holds only the own-clients one — which is exactly
 * who the queue narrows itself for — so gating any of this on the firm-wide string alone hides the screen
 * from the one person it is built for.
 */
export const APPROVES_PROPOSALS: Authority[] = ["APPROVE_PROPOSALS:CHANGE", "APPROVE_PROPOSALS:OWN_CLIENTS"];

/**
 * Whoever answers a plan to move a client's money.
 *
 * <p>Both authorities, always, and the same constant in the route, the menu and the page. A relationship manager
 * holds only the own-clients one — which is exactly who the queue narrows itself for — so gating any of the three on
 * the firm-wide string alone hides the screen from the one person it is built for.
 */
export const ANSWERS_MOVE_PLANS: Authority[] = [
  "APPROVE_PORTFOLIO_CHANGES:CHANGE",
  "APPROVE_PORTFOLIO_CHANGES:OWN_CLIENTS",
];

/**
 * Whoever writes down what a client asked for: the relationship manager, and nobody else.
 *
 * <p>The client speaks to one person at this firm and it is them. A portfolio manager who wrote these
 * would be a portfolio manager the client had spoken to, which is the relationship the firm keeps apart.
 */
export const RAISES_CLIENT_REQUESTS: Authority[] = ["APPROVE_PORTFOLIO_CHANGES:OWN_CLIENTS"];

/**
 * Whoever answers one: the portfolio manager, and nobody else — not the Admin, and not the desk that
 * wrote it down.
 *
 * <p>Its own permission rather than a level of the money-move one, because that one is the Admin's too
 * and a control two people can pass is a control one person can pass.
 */
export const ANSWERS_CLIENT_REQUESTS: Authority[] = ["APPROVE_CLIENT_REQUESTS:CHANGE"];

/** Everybody the client-request queue is for: the desk that writes them and the desk that answers them. */
export const READS_CLIENT_REQUESTS: Authority[] = [...ANSWERS_CLIENT_REQUESTS, ...RAISES_CLIENT_REQUESTS];

/** Reading how the firm invests, which follows reading a client's portfolio rather than writing proposals. */
export const READS_CLIENT_PORTFOLIOS: Authority[] = [
  "VIEW_CUSTOMER_PROFILE:VIEW",
  "VIEW_CUSTOMER_PROFILE:OWN_CLIENTS",
  "VIEW_CUSTOMER_PROFILE:ASSIGNED",
];

/** Whoever may write a proposal. */
export function writesProposals(user: StaffProfile) {
  return hasAnyAuthority(user, ...WRITES_PROPOSALS);
}

/**
 * Where a client lives for whoever is looking, which is not the same screen for everybody.
 *
 * <p>A relationship manager is kept off the directory of every client — theirs are under My clients — so a link that
 * always said /clients would bounce them away from their own client's file. A portfolio manager is kept off it too,
 * and does not have a servicing file to be sent to at all: their work on a client is the portfolio, so that is the
 * client as they know one.
 */
export function clientFileHref(user: { activeRole?: string | null }, clientId: string) {
  if (user.activeRole === "ADVISOR") return `/my-clients/${clientId}`;
  if (user.activeRole === "PORTFOLIO_MANAGER") return `/portfolio-clients/${clientId}`;
  return `/clients/${clientId}`;
}

/**
 * The list of clients this reader is allowed to open, which is not the same address for everybody.
 *
 * <p>The sibling of {@link clientFileHref}, and it exists for the same reason that one does: /clients is
 * closed to a relationship manager and to a portfolio manager, so sending either of them there is sending
 * them to a guard that bounces them home. Anything carried in the address — what somebody just typed into
 * the search box — is lost on the way.
 */
export function clientListHref(user: { activeRole?: string | null }, query?: string) {
  const where = user.activeRole === "ADVISOR" ? "/my-clients"
    : user.activeRole === "PORTFOLIO_MANAGER" ? "/portfolio-clients"
    : "/clients";
  return query ? `${where}?q=${encodeURIComponent(query)}` : where;
}
