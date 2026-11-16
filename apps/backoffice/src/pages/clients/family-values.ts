import { ApiError } from "@atomprive/api-client";
import { useGetFamilyWealth, type FamilyMember, type FamilyWealth } from "@atomprive/api-client/backoffice";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";

/** What each member's managed portfolio is worth, where the reader may see a family's money. */
export function useFamilyValues(clientId: string) {
  const sees = hasAuthority(useStaffUser(), "VIEW_FAMILY_WEALTH:VIEW");
  const wealth = useGetFamilyWealth<FamilyWealth, ApiError>(clientId, undefined, { query: { enabled: sees, retry: false } });
  const byMember = new Map((wealth.data?.members ?? []).map((one) => [one.customerId, one.managed]));
  return { sees, wealth: wealth.data ?? null, valueOf: (id: string) => byMember.get(id) ?? null };
}

/** A whole figure with its currency: USD 1,820,000. */
export function amount(currency: string, value: number | null) {
  return value === null ? null : `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * What somebody is to the family: the holder, a co-holder, or whose relative they are ("Rahul's sibling", "Sarah's
 * spouse"). A bare "Spouse" reads as the holder's, so the person they hang off is always named.
 */
export function roleOf(member: FamilyMember, labelFor: (code: string | null | undefined) => string) {
  if (member.primaryHolder) return "Primary holder";
  if (member.accountHolder) return "Joint holder";
  if (member.parentName && member.relationship) return `${firstName(member.parentName)}'s ${labelFor(member.relationship).toLowerCase()}`;
  return member.relationshipToPrimary ?? labelFor(member.relationship);
}

/** What an invitation asks somebody to join as, named against whose relative: "Rahul's spouse". */
export function invitedAs(invitation: { inviteUnder: string | null; relationship: string }, family: FamilyMember[]) {
  const under = family.find((one) => one.id === invitation.inviteUnder) ?? family.find((one) => one.primaryHolder);
  return under ? `${firstName(under.fullName)}'s ${invitation.relationship.toLowerCase()}` : invitation.relationship;
}

/** "Rahul" off "Rahul Family" or "Rahul Mehta": the name a relative is called by in "Rahul's sibling". */
function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
