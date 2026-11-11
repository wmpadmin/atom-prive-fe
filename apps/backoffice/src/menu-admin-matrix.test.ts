import { describe, expect, it } from "vitest";
import { menuFor } from "./menu";
import { groupMenu } from "./menu-groups";

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

  it("keeps the firm's order, the dashboard first and staff users heading the first section", () => {
    const { groups } = groupMenu(menuFor(anAdmin(ADMIN_PERMISSIONS)), "ADMIN");
    expect(groups[0].items[0].to).toBe("/dashboard");
    expect(groups[1].label).toBe("Staff & access");
    expect(groups[1].items[0].to).toBe("/users");
  });
});

describe("the sidebar's headings", () => {
  it("draw every screen the menu gives, and only those, a screen nobody filed going under More", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    const unfiled = { ...items[0], to: "/somewhere-new", label: "Somewhere new" };
    const { groups, footer } = groupMenu([...items, unfiled], "ADMIN");
    const drawn = [...groups.flatMap((group) => group.items), ...footer].map((item) => item.to);
    expect(drawn.sort()).toEqual([...items.map((item) => item.to), "/somewhere-new"].sort());
    expect(groups.find((group) => group.key === "more")?.items.map((item) => item.to)).toEqual(["/somewhere-new"]);
  });

  it("keep the menu's own order under each heading", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    const order = items.map((item) => item.to);
    for (const group of groupMenu(items, "ADMIN").groups) {
      const at = group.items.map((item) => order.indexOf(item.to));
      expect(at).toEqual([...at].sort((a, b) => a - b));
    }
  });
});
