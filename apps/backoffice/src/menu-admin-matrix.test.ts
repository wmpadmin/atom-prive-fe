import { describe, expect, it } from "vitest";
import { menuFor } from "./menu";

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
    for (const notTheirs of ["/approvals", "/forms", "/ingestion", "/trade-logs", "/kyc", "/kyc-checklist",
      "/kyc-documents", "/post-onboarding", "/trails", "/notifications", "/family-access-trail",
      "/client-documents", "/sync-errors"]) {
      expect(where).not.toContain(notTheirs);
    }
  });

  it("is the ten screens the firm gives an Admin, and no more", () => {
    expect(menuFor(anAdmin(ADMIN_PERMISSIONS)).map((item) => item.to)).toEqual([
      "/users", "/clients", "/deactivation-requests", "/archived-clients", "/roles", "/config",
      "/staff-tracker", "/audit-log", "/my-declarations", "/settings",
    ]);
  });

  it("keeps the firm's order, staff users first", () => {
    expect(menuFor(anAdmin(ADMIN_PERMISSIONS))[0]?.to).toBe("/users");
  });
});
