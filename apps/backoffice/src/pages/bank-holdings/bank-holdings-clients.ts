import type { BankHoldingsBank } from "@atomprive/api-client/backoffice";

/** The address key for the files no client has been named on yet. */
export const NO_CLIENT = "none";

/** One client and every bank whose holdings file names them, newest upload first. */
export type ClientBanks = {
  key: string;
  name: string;
  named: boolean;
  banks: BankHoldingsBank[];
  latest: BankHoldingsBank;
};

export function clientKey(one: BankHoldingsBank) {
  return one.clientId ?? NO_CLIENT;
}

export function clientLabel(one: BankHoldingsBank) {
  return one.clientName ?? "No client set";
}

/** The banks' files grouped by the client each names; the unnamed ones last, under "No client set". */
export function byClient(banks: BankHoldingsBank[]): ClientBanks[] {
  const groups = new Map<string, BankHoldingsBank[]>();
  for (const one of banks) {
    const key = clientKey(one);
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const first = sorted[0]!;
      return { key, name: clientLabel(first), named: key !== NO_CLIENT, banks: sorted, latest: first };
    })
    .sort((a, b) => (a.named === b.named ? a.name.localeCompare(b.name) : a.named ? -1 : 1));
}

/** "4 banks", "1 bank". */
export function bankCount(count: number) {
  return `${count} ${count === 1 ? "bank" : "banks"}`;
}
