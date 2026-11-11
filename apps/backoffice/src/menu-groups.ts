import type { StaffRole } from "./lib/labels";
import type { menuFor } from "./menu";

/** One entry of the menu as {@link menuFor} gives it, with whatever sits under it. */
export type MenuEntry = ReturnType<typeof menuFor>[number];

/** A heading and the entries under it; the top block has no heading. */
export type MenuGroup = { key: string; label: string | null; items: MenuEntry[] };

/**
 * The sidebar's headings, per desk: which screen sits under which heading.
 *
 * <p>Only where, never whether or in what order. Which screens somebody sees is still {@link menuFor}'s answer
 * alone — permissions, the desk's own exclusions, MENU_ORDER and the Admin's ADMINS_MENU — and under each
 * heading they stay in the order it gave them. A screen this file does not place is not dropped: it is drawn
 * under More, so a screen added later is on the menu the day it is built, even before anybody files it here.
 *
 * <p>Approved with the sidebar's redesign on 11 Nov 2026.
 */
const HEADINGS: Partial<Record<StaffRole, { key: string; label: string; routes: string[] }[]>> = {
  PORTFOLIO_MANAGER: [
    { key: "clients", label: "Clients", routes: ["/book-overview", "/client-directory", "/book", "/portfolio-clients"] },
    { key: "portfolios", label: "Portfolios", routes: ["/model-portfolios", "/model-performance", "/drift", "/bulk-rebalancing"] },
    { key: "reports", label: "Reports", routes: ["/mis", "/reports", "/trade-logs"] },
  ],
  ADVISOR: [
    { key: "clients", label: "Clients", routes: ["/client-management", "/prospective-clients", "/my-clients"] },
    { key: "client-work", label: "Client work", routes: ["/forms", "/client-documents", "/trade-logs"] },
  ],
  COMPLIANCE: [
    { key: "kyc", label: "KYC", routes: ["/kyc", "/clients", "/kyc-documents", "/kyc-checklist"] },
    { key: "oversight", label: "Oversight", routes: ["/trails", "/family-access-trail", "/audit-log", "/aml-risk"] },
  ],
  OPERATIONS: [
    { key: "clients", label: "Clients",
      routes: ["/client-management", "/prospective-clients", "/clients", "/deactivation-requests", "/archived-clients"] },
    { key: "onboarding", label: "Onboarding & documents", routes: ["/forms", "/client-documents", "/post-onboarding"] },
    { key: "feeds", label: "Bank feeds", routes: ["/ingestion", "/sync-errors", "/holdings-check"] },
  ],
  ADMIN: [
    { key: "staff", label: "Staff & access", routes: ["/users", "/roles", "/staff-tracker", "/staff-declarations"] },
    { key: "clients", label: "Clients",
      routes: ["/client-management", "/prospective-clients", "/clients", "/deactivation-requests", "/archived-clients"] },
    { key: "platform", label: "Platform", routes: ["/config", "/ingestion", "/holdings-check"] },
    { key: "oversight", label: "Oversight", routes: ["/reports", "/family-access-trail", "/audit-log"] },
  ],
  IT_ADMIN: [
    { key: "access", label: "Access", routes: ["/sign-in-as", "/bank-credentials"] },
    { key: "clients", label: "Clients", routes: ["/clients"] },
    { key: "oversight", label: "Oversight", routes: ["/trails", "/family-access-trail", "/audit-log"] },
  ],
};

/** What every desk starts from, above the headings. */
export const TOP = ["/dashboard", "/approvals", "/assistant"];

/** The person's own, the last heading for every desk. */
export const YOUR_OWN = ["/my-clearances", "/my-declarations"];

/** Pinned at the foot of the sidebar, above the account. */
export const FOOTER = ["/portfolio-settings", "/support", "/settings"];

/**
 * The menu as the sidebar draws it: the top block, the desk's headings, More for anything unplaced, the
 * person's own, and the footer apart.
 */
export function groupMenu(items: MenuEntry[], role: StaffRole | null) {
  const headings = (role && HEADINGS[role]) ?? [];
  const placed = new Set([...TOP, ...YOUR_OWN, ...FOOTER, ...headings.flatMap((one) => one.routes)]);
  const pick = (routes: string[]) => items.filter((item) => routes.includes(item.to));
  const groups: MenuGroup[] = [
    { key: "top", label: null, items: pick(TOP) },
    ...headings.map((one) => ({ key: one.key, label: one.label, items: pick(one.routes) })),
    { key: "more", label: "More", items: items.filter((item) => !placed.has(item.to)) },
    { key: "own", label: "Your own", items: pick(YOUR_OWN) },
  ].filter((group) => group.items.length > 0);
  // The foot in its own order, settings for the desk before the person's own, whatever order the menu holds them in.
  const footer = FOOTER.map((route) => items.find((item) => item.to === route)).filter((item) => item !== undefined);
  return { groups, footer };
}
