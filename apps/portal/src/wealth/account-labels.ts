import type { AccountRow } from "@atomprive/api-client/portal";
import { accountKind } from "../lib/money";

/** What the client called the account, or the bank and the kind of account where they named it nothing. */
export function accountName(one: AccountRow) {
  return one.nickname?.trim() || `${one.bankName} ${accountKind(one.accountType)}`;
}

/** A balance with its currency in front, to the penny: USD 12,500.00. */
export function balance(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}
