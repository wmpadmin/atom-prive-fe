/**
 * The colours an asset class is drawn in, in the order the firm lists its classes — the same hues the firm's
 * own overview draws them in, so a client and their manager see one picture. A slice is never told apart by
 * colour alone: the legend beside it names it.
 */
export const INK = ["#2563eb", "#38bdf8", "#fbbf24", "#8b5cf6", "#cbd5e1", "#10b981", "#fb7185", "#14b8a6", "#818cf8", "#fb923c"];

/** A large figure kept short for a chart or a tile: 4.2M, 850K. With a currency, AUD 4.2M. */
export function compact(amount: number, currency?: string) {
  const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
  return currency ? `${currency} ${short}` : short;
}

/** A whole amount with its currency in front, the way the tiles write it: AUD 4,200,000. */
export function whole(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount)}`;
}

/** A return as a signed percentage: +5.23%. */
export function percent(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}

/** The short name of the month a day falls in: Jan, Feb. */
export function monthOf(day: string) {
  return new Date(day).toLocaleDateString("en-GB", { month: "short" });
}
