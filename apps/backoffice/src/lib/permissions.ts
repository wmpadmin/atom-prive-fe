import type { PermissionGrantPermission, StaffProfile } from "@atomprive/api-client/backoffice";

/**
 * An authority the API checks, such as "MANAGE_USERS_AND_ROLES:CHANGE" (see AccessLevel.java). Menus and
 * buttons check the same strings, so nobody is offered an action the API would refuse.
 */
export type Authority = `${PermissionGrantPermission}:${"VIEW" | "CHANGE" | "OWN_CLIENTS" | "ASSIGNED"}`;

export function hasAuthority(user: StaffProfile, authority: Authority) {
  return user.permissions.includes(authority);
}
