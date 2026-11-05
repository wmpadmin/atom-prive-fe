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

/** What somebody is to the family, in a word: the holder, a co-holder, or their relationship. */
export function roleOf(member: FamilyMember, labelFor: (code: string | null | undefined) => string) {
  if (member.primaryHolder) return "Primary holder";
  if (member.accountHolder) return "Joint holder";
  return member.relationshipToPrimary ?? labelFor(member.relationship);
}
