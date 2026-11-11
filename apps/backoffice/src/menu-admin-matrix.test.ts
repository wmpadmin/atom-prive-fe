import { describe, expect, it } from "vitest";
import { menuFor } from "./menu";
import { arrangeMenu } from "./menu-groups";

/** The permissions the ADMIN role holds at FULL, as the firm's matrix grants them. */
const ADMIN_PERMISSIONS = [
  "APPROVE_ONBOARDING", "APPROVE_PORTFOLIO_CHANGES", "ASSIGN_ADVISORS", "ASSIGN_PORTFOLIO_MANAGERS",
  "ASSIGN_WORK", "EXPORT_CUSTOMER_DATA", "FILL_CLIENT_FORMS", "MANAGE_AML_MATRIX", "MANAGE_ASSET_CLASSES",
  "MANAGE_BANK_FEEDS", "MANAGE_CONFIGURATION", "MANAGE_USERS_AND_ROLES", "ONBOARD_CLIENTS", "RATE_AML_RISK",
  "SEND_PROPOSALS", "UPLOAD_CLIENT_DOCUMENTS", "VIEW_ALL_CLIENTS", "VIEW_AUDIT_LOG", "VIEW_CUSTOMER_PROFILE",
  "VIEW_STAFF_DECLARATIONS",
].flatMap((one) => [`${one}:VIEW`, `${one}:CHANGE`]);

const anAdmin = (permissions: string[]) =>
  ({ activeRole: "ADMIN", permissions } as unknown as Parameters<typeof menuFor>[0]);

describe("an Admin's menu", () => {
  it("carries the client directory under the name every other desk reads it by", () => {
    const clients = menuFor(anAdmin(ADMIN_PERMISSIONS)).find((item) => item.to === "/clients");
    expect(clients?.label).toBe("All clients");
  });

  it("takes the client directory away the moment the matrix does", () => {
    const narrowed = ADMIN_PERMISSIONS.filter((one) => !one.startsWith("VIEW_ALL_CLIENTS"));
    expect(menuFor(anAdmin(narrowed)).map((item) => item.to)).not.toContain("/clients");
  });

  it("stays the firm's own list rather than everything the matrix would allow", () => {
    // The hand-written list is the whole answer for an Admin, which is what keeps a screen added later
    // from appearing on their menu on its own. These are screens the ADMIN role has permission for and
    // is still deliberately not given.
    const where = menuFor(anAdmin(ADMIN_PERMISSIONS)).map((item) => item.to);
    for (const notTheirs of ["/forms", "/trade-logs", "/kyc", "/kyc-checklist",
      "/kyc-documents", "/post-onboarding", "/trails", "/notifications", "/client-documents", "/sync-errors"]) {
      expect(where).not.toContain(notTheirs);
    }
  });

  it("is the nineteen screens the firm gives an Admin, and no more", () => {
    // In the order of the sidebar's headings since 11 Nov 2026: the top block, staff and access, clients,
    // the platform, oversight, and the person's own.
    expect(menuFor(anAdmin(ADMIN_PERMISSIONS)).map((item) => item.to)).toEqual([
      "/dashboard", "/approvals", "/assistant", "/users", "/roles", "/staff-tracker", "/clients",
      "/deactivation-requests", "/archived-clients", "/config", "/ingestion", "/holdings-check", "/reports",
      "/family-access-trail", "/audit-log", "/my-clearances", "/my-declarations", "/support", "/settings",
    ]);
  });

  /*
   * My clearance requests is on the Admin's menu even though the Admin desk is never one of the four a
   * client's clearance is put to. It is there because it follows the person rather than the desk: every
   * administrator at this firm also sits at Compliance, Operations and the rest, so their list has rows
   * in it. An administrator who holds nothing else sees an empty list, which is the truth about them.
   */

  it("keeps the firm's order, the dashboard first and staff users first after the top block", () => {
    const { list } = arrangeMenu(menuFor(anAdmin(ADMIN_PERMISSIONS)), "ADMIN");
    expect(list.slice(0, 4).map((item) => item.to)).toEqual(["/dashboard", "/approvals", "/assistant", "/users"]);
  });
});

describe("the sidebar's list", () => {
  it("draws every screen the menu gives, and only those, once, a screen nobody filed after the desk's own", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    const unfiled = { ...items[0], to: "/somewhere-new", label: "Somewhere new" };
    const { list, footer } = arrangeMenu([...items, unfiled], "ADMIN");
    const drawn = [...list, ...footer].map((item) => item.to);
    expect([...drawn].sort()).toEqual([...items.map((item) => item.to), "/somewhere-new"].sort());
    // After the runs, before the person's own.
    expect(drawn.indexOf("/somewhere-new")).toBe(drawn.indexOf("/my-clearances") - 1);
  });

  it("is, for an Admin, the order ADMINS_MENU writes", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    const { list, footer } = arrangeMenu(items, "ADMIN");
    const footed = new Set(footer.map((item) => item.to));
    expect(list.map((item) => item.to)).toEqual(items.map((item) => item.to).filter((to) => !footed.has(to)));
  });
});

describe("the portfolio desk's sidebar", () => {
  const aManager = { activeRole: "PORTFOLIO_MANAGER", permissions: [
    "VIEW_CUSTOMER_PROFILE:ASSIGNED", "VIEW_ALL_CLIENTS:VIEW", "SEND_PROPOSALS:VIEW", "SEND_PROPOSALS:CHANGE",
    "APPROVE_PORTFOLIO_CHANGES:VIEW", "APPROVE_PORTFOLIO_CHANGES:CHANGE",
  ] } as unknown as Parameters<typeof menuFor>[0];

  it("leaves out Client list and Clients, though the menu still gives them for Settings", () => {
    const items = menuFor(aManager).map((item) => item.to);
    expect(items).toEqual(expect.arrayContaining(["/book", "/portfolio-clients"]));
    const { list, footer } = arrangeMenu(menuFor(aManager), "PORTFOLIO_MANAGER");
    const drawn = [...list, ...footer].map((item) => item.to);
    expect(drawn).not.toContain("/book");
    expect(drawn).not.toContain("/portfolio-clients");
    expect(drawn.slice(0, 5)).toEqual(["/dashboard", "/approvals", "/assistant", "/book-overview", "/client-directory"]);
  });
});
