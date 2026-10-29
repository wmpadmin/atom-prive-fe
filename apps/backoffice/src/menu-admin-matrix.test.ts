import { describe, expect, it } from "vitest";
import { menuFor } from "./menu";

/** The twenty permissions the ADMIN role holds at FULL, as the firm's matrix grants them. */
const ADMIN_PERMISSIONS = [
  "APPROVE_ONBOARDING", "APPROVE_PORTFOLIO_CHANGES", "ASSIGN_ADVISORS", "ASSIGN_PORTFOLIO_MANAGERS",
  "ASSIGN_WORK", "EXPORT_CUSTOMER_DATA", "FILL_CLIENT_FORMS", "MANAGE_AML_MATRIX", "MANAGE_ASSET_CLASSES",
  "MANAGE_BANK_FEEDS", "MANAGE_CONFIGURATION", "MANAGE_USERS_AND_ROLES", "ONBOARD_CLIENTS", "RATE_AML_RISK",
  "SEND_PROPOSALS", "UPLOAD_CLIENT_DOCUMENTS", "VIEW_ALL_CLIENTS", "VIEW_AUDIT_LOG", "VIEW_CUSTOMER_PROFILE",
  "VIEW_STAFF_DECLARATIONS",
].flatMap((one) => [`${one}:VIEW`, `${one}:CHANGE`]);

const anAdmin = (permissions: string[]) =>
  ({ activeRole: "ADMIN", permissions } as unknown as Parameters<typeof menuFor>[0]);

describe("an Admin's menu is the permission matrix's answer", () => {
  it("gives the Admin the client directory the matrix opens to them", () => {
    const where = menuFor(anAdmin(ADMIN_PERMISSIONS)).map((item) => item.to);
    expect(where).toContain("/clients");
  });

  it("takes a screen away the moment the matrix does", () => {
    const narrowed = ADMIN_PERMISSIONS.filter((one) => !one.startsWith("VIEW_ALL_CLIENTS"));
    const where = menuFor(anAdmin(narrowed)).map((item) => item.to);
    expect(where).not.toContain("/clients");
  });

  it("keeps the firm's own order for what it named", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    expect(items[0]?.to).toBe("/users");
  });

  it("calls the client directory what every other desk calls it", () => {
    const items = menuFor(anAdmin(ADMIN_PERMISSIONS));
    expect(items.find((item) => item.to === "/clients")?.label).toBe("All clients");
  });
});
