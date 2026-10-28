/**
 * Money, written the way a statement writes it.
 *
 * <p>Its own file because the screens that use it are components, and a module exporting both a component
 * and a plain function loses hot reloading for everything in it.
 */
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** The same, with its sign kept, for a line of a statement where direction is the point. */
export function signed(amount: number, currency: string) {
  const drawn = money(Math.abs(amount), currency);
  return amount < 0 ? `−${drawn}` : `+${drawn}`;
}

/** Two letters off a bank's name, for the square beside it. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return (words[0] ?? "").slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/** What the firm calls a kind of account, rather than the code it stores. */
export function accountKind(type: string) {
  const known: Record<string, string> = {
    CURRENT: "Current",
    SAVINGS: "Savings",
    CUSTODY: "Custody",
    INVESTMENT: "Investment",
  };
  return known[type] ?? type;
}
