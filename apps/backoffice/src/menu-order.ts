/**
 * The order the sidebar lists its screens in.
 *
 * <p>An order rather than a shape. The menu used to be folded into three named sections, and reading it
 * meant opening one of them first: a reader who knew the name of the screen they wanted still had to
 * guess which section the firm had filed it under. It is one list now, and the only thing this file
 * decides is what comes before what.
 *
 * <p>The order is the order the work is done in, not the order the entries happen to be declared in:
 * managing money against a plan, then the firm's own setup and the people who run it, then everything
 * that begins with a client and reads forward from one.
 *
 * <p>A screen left out of this list is not hidden. It is drawn after the ones named here, in whatever
 * order it was declared — because a menu built only from a hand-written list loses a screen the day
 * somebody adds one and forgets this file, which has happened here before: two approval queues existed,
 * worked, and could be reached by nothing but a typed address.
 */
export const MENU_ORDER: string[] = [
  // What the firm does with money already under management.
  "/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing",

  // What exists before any client does, and would still exist with none.
  "/config", "/portfolio-settings", "/roles", "/users", "/settings",
  "/ingestion", "/sync-errors", "/notifications",
  "/my-declarations", "/staff-declarations", "/staff-tracker", "/audit-log",

  // Everything that begins with a client: one from an empty form pack to advice signed off and sent,
  // then the orders that advice raises, and the reads that come back off all of it.
  "/forms", "/onboarding", "/clients", "/my-clients",
  "/to-sign", "/client-documents", "/kyc-documents", "/kyc", "/post-onboarding",
  "/approvals", "/trade-orders",
  "/model-performance", "/model-risk", "/reports", "/dashboard",
  "/proposal-trail", "/family-access",
];
