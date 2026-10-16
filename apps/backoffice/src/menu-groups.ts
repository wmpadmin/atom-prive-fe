/**
 * The sidebar, read as the three stories the platform tells rather than one list of thirty-five screens.
 *
 * <p>A flat menu says every screen is the same distance from every other, which is the one thing that is
 * not true of these: a plan is written before a client is measured against it, a staff account exists
 * before it signs anything, and a client is onboarded before advice is sent to them. Grouped, somebody
 * looking for a screen can find it by what they are trying to do; one group at a time, the list is short
 * enough to read.
 *
 * <p>The grouping is by data flow — which screen produces what another consumes — so a group can be read
 * top to bottom without reaching into a later one for where a figure came from.
 */

/** One of the three. */
export type GroupKey = "1" | "2" | "3";

/** A group: what it is called, and its screens in the order the work is actually done. */
export type MenuGroup = { key: GroupKey; title: string; routes: string[] };

export const MENU_GROUPS: MenuGroup[] = [
  {
    key: "1",
    title: "Portfolio management",
    /*
     * The firm writes a plan down, puts clients on it, watches them wander off it, and puts them back.
     * Settings first because it writes the bands that decide what counts as a breach; the blotter, model
     * changes, performance, risk, reports and the dashboard after, because each is a read of what the
     * screens before them wrote.
     */
    routes: [
      "/portfolio-clients", "/model-portfolios", "/drift", "/bulk-rebalancing", "/portfolio-settings",
      "/trade-orders", "/model-changes", "/model-performance", "/model-risk", "/reports", "/dashboard",
    ],
  },
  {
    key: "2",
    title: "Running the platform",
    /*
     * Two roots that need no data at all — the firm's reference data and the permission matrix — and
     * everything that grows out of them: bank feeds and their failures, staff accounts, the declarations
     * those accounts owe, the mail that chases them, and the log that records the lot.
     */
    routes: [
      "/config", "/ingestion", "/sync-errors", "/roles", "/users", "/settings", "/my-declarations",
      "/staff-declarations", "/staff-tracker", "/notifications", "/audit-log",
    ],
  },
  {
    key: "3",
    title: "Onboarding to signed advice",
    /*
     * One client from an empty form pack to a piece of advice signed off and sent, in the order the firm
     * does it, ending on the two trails that read back the activity it has just made.
     */
    routes: [
      "/forms", "/onboarding", "/clients", "/my-clients", "/to-sign", "/client-documents",
      "/kyc-documents", "/kyc", "/post-onboarding", "/proposals", "/manager-review", "/proposal-trail",
      "/family-access",
    ],
  },
];
