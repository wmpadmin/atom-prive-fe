import { writeDate, writeDay } from "../lib/display";

/**
 * The colours an asset class is drawn in, in the order the firm lists its classes — the same hues the firm's
 * own overview draws them in, so a client and their manager see one picture. A slice is never told apart by
 * colour alone: the legend beside it names it.
 */
export const INK = ["#2563eb", "#38bdf8", "#fbbf24", "#8b5cf6", "#cbd5e1", "#10b981", "#fb7185", "#14b8a6", "#818cf8", "#fb923c"];

/** A large figure kept short for a chart or a tile: 4.2M, 850K. With a currency, AUD 4.2M. */
export function compact(amount: number, currency?: string, step?: number) {
  const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digitsFor(amount, step) }).format(amount);
  return currency ? `${currency} ${short}` : short;
}

/**
 * Decimals enough for a chart's neighbouring ticks to read differently: 20,000 apart at 8.5M needs 8.52M, where one
 * decimal would print 8.5M four times. One decimal where there is no step to tell apart.
 */
function digitsFor(amount: number, step?: number) {
  if (!step) return 1;
  const size = Math.abs(amount) >= 1000 ? 10 ** (3 * Math.floor(Math.log10(Math.abs(amount)) / 3)) : 1;
  // The fewest decimals that write the step exactly: 25,000 at millions is 0.025, so three, not a rounded 8.48M.
  for (let digits = 0; digits < 3; digits++) {
    const scaled = (step / size) * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return digits;
  }
  return 3;
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
  return writeDate(day, { month: "short" });
}

/** A day as the client asked for it; as the firm writes it, 5 Nov 2026, unless they chose otherwise. */
export function day(at: string | null | undefined) {
  return at ? writeDay(at) : "—";
}
