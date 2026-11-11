import type { StaffRole } from "./lib/labels";
import type { menuFor } from "./menu";

/** One entry of the menu as {@link menuFor} gives it, with whatever sits under it. */
export type MenuEntry = ReturnType<typeof menuFor>[number];

/**
 * The runs the sidebar draws each desk's menu in, one after another: which screens belong together, so they sit
 * together in the one list.
 *
 * <p>Drawn without headings. The sidebar had a small folding heading over each run for a day (11 Nov 2026);
 * the user took them out the same day and kept the order they gave. So this decides only where a screen falls
 * in the list, never whether it is there: which screens somebody sees is still {@link menuFor}'s answer alone —
 * permissions, the desk's own exclusions, MENU_ORDER and the Admin's ADMINS_MENU — and within a run they keep
 * the order it gave them. A screen this file does not place is not dropped: it is drawn after the runs, so a
 * screen added later is on the menu the day it is built, even before anybody files it here.
 */
const HEADINGS: Partial<Record<StaffRole, { key: string; routes: string[] }[]>> = {
  PORTFOLIO_MANAGER: [
    { key: "clients", routes: ["/book-overview", "/client-directory"] },
    { key: "portfolios", routes: ["/model-portfolios", "/model-performance", "/drift", "/bulk-rebalancing"] },
    { key: "reports", routes: ["/mis", "/reports", "/trade-logs"] },
  ],
  ADVISOR: [
    { key: "clients", routes: ["/client-management", "/prospective-clients", "/my-clients"] },
    { key: "client-work", routes: ["/forms", "/client-documents", "/trade-logs"] },
  ],
  COMPLIANCE: [
    { key: "kyc", routes: ["/kyc", "/clients", "/kyc-documents", "/kyc-checklist"] },
    { key: "oversight", routes: ["/trails", "/family-access-trail", "/audit-log", "/aml-risk"] },
  ],
  OPERATIONS: [
    { key: "clients",
      routes: ["/client-management", "/prospective-clients", "/clients", "/deactivation-requests", "/archived-clients"] },
    { key: "onboarding", routes: ["/forms", "/client-documents", "/post-onboarding"] },
    { key: "feeds", routes: ["/ingestion", "/sync-errors", "/holdings-check"] },
  ],
  ADMIN: [
    { key: "staff", routes: ["/users", "/roles", "/staff-tracker", "/staff-declarations"] },
    { key: "clients",
      routes: ["/client-management", "/prospective-clients", "/clients", "/deactivation-requests", "/archived-clients"] },
    { key: "platform", routes: ["/config", "/ingestion", "/holdings-check"] },
    { key: "oversight", routes: ["/reports", "/family-access-trail", "/audit-log"] },
  ],
  IT_ADMIN: [
    { key: "access", routes: ["/sign-in-as", "/bank-credentials"] },
    { key: "clients", routes: ["/clients"] },
    { key: "oversight", routes: ["/trails", "/family-access-trail", "/audit-log"] },
  ],
};

/**
 * Screens kept off the sidebar though their pages stay: reached from links on other screens rather than from the
 * menu. The portfolio desk's Client list (/book) and Clients (/portfolio-clients) were taken off on 11 Nov 2026 at
 * the user's request — the Book Overview and the Client Directory are the desk's way into its clients now. Their
 * routes, permissions and inner screens are untouched; an inner screen opened from Drift still lights Drift, and
 * one opened from anywhere else lights nothing rather than an entry that is not there.
 */
export const OFF_THE_SIDEBAR = ["/book", "/portfolio-clients"];

/** What every desk starts from, at the top of the list. */
export const TOP = ["/dashboard", "/approvals", "/assistant"];

/** The person's own, last in the list for every desk. */
export const YOUR_OWN = ["/my-clearances", "/my-declarations"];

/** Pinned at the foot of the sidebar, above the account. */
export const FOOTER = ["/portfolio-settings", "/support", "/settings"];

/**
 * The menu as the sidebar draws it: the top block, the desk's runs, anything unplaced, the person's own — one
 * flat list — and the footer apart.
 */
export function arrangeMenu(everything: MenuEntry[], role: StaffRole | null) {
  const items = everything.filter((item) => !OFF_THE_SIDEBAR.includes(item.to));
  const runs = (role && HEADINGS[role]) ?? [];
  const placed = new Set([...TOP, ...YOUR_OWN, ...FOOTER, ...runs.flatMap((one) => one.routes)]);
  const pick = (routes: string[]) => items.filter((item) => routes.includes(item.to));
  const list = [
    ...pick(TOP),
    ...runs.flatMap((one) => pick(one.routes)),
    ...items.filter((item) => !placed.has(item.to)),
    ...pick(YOUR_OWN),
  ];
  // The foot in its own order, settings for the desk before the person's own, whatever order the menu holds them in.
  const footer = FOOTER.map((route) => items.find((item) => item.to === route)).filter((item) => item !== undefined);
  return { list, footer };
}
