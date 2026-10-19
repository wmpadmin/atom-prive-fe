/**
 * The sidebar, read as the three things the firm does rather than one list of thirty-six screens.
 *
 * <p>A flat menu says every screen is the same distance from every other, which is the one thing that is
 * not true of them. Grouped, somebody can find a screen by what they are trying to do, and one group at a
 * time the list is short enough to read.
 *
 * <p>The line between the second and the third is whether a screen has anything to do with a client. The
 * platform and the people who run it exist before any client does — reference data, access, staff, feeds,
 * and the logs of all of it. Everything else begins with a client and reads forward from one, including
 * the figures that look firm-wide: a model's performance is its clients' valuations added up, and the
 * dashboard's tiles are counts of them.
 */

/** One of the three. */
export type GroupKey = "1" | "2" | "3";

/** A group: what it is called, and its screens in the order the work is actually done. */
export type MenuGroup = { key: GroupKey; title: string; routes: string[] };

export const MENU_GROUPS: MenuGroup[] = [
  {
    key: "1",
    title: "Meeting 1 — Managing money against a plan",
    /*
     * Four screens, and the firm has said four. The whole of what it does with money that is already
     * under management: the plans, the clients measured against them, what has wandered out of its band,
     * and putting several back in one sitting.
     *
     * <p>Two things it leans on sit in the second group rather than here, because they are the firm's own
     * setup rather than this work: the bands that decide what counts as a breach, and the rules a
     * rebalance drafts by. Worth having set before this is shown.
     */
    routes: ["/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing"],
  },
  {
    key: "2",
    title: "Meeting 2 — Running the platform",
    /*
     * What exists before any client does, and would still exist with none: the firm's reference data and
     * the rules read off it, who may do what, the people who do it, the feeds that carry figures in, and
     * the record of every change to the lot.
     *
     * <p>It can be shown on an empty system, which is why it comes before the client journey — that one
     * borrows this one's staff accounts, its access levels and its mail templates.
     */
    routes: [
      "/config", "/portfolio-settings", "/roles", "/users", "/settings",
      "/ingestion", "/sync-errors", "/notifications",
      "/my-declarations", "/staff-declarations", "/staff-tracker", "/audit-log",
    ],
  },
  {
    key: "3",
    title: "Meeting 3 — Clients, advice and what comes of it",
    /*
     * Everything that begins with a client. One from an empty form pack to a piece of advice signed off
     * and sent, in the order the firm does it — then the orders that advice raises, and the reads that
     * come back off all of it.
     *
     * <p>The model-level figures belong here rather than beside the models themselves: a plan's
     * performance and its risk are its clients' valuations added up, and the dashboard is counts of them.
     * Nothing on a plan has a return until somebody is on it.
     */
    routes: [
      "/forms", "/onboarding", "/clients", "/my-clients",
      "/to-sign", "/client-documents", "/kyc-documents", "/kyc", "/post-onboarding",
      "/proposals", "/model-changes", "/moves-to-approve", "/restores-to-approve", "/trade-orders",
      "/model-performance", "/model-risk", "/reports", "/dashboard",
      "/proposal-trail", "/family-access",
    ],
  },
];
