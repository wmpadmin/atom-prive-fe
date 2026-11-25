/**
 * How the Structured Products screens write their figures (25 Nov 2026). The server works every figure out; these only
 * set them down: money compact in the screen's currency, a sum of money put into the line that names it, dates as the
 * design writes them, and moves signed with a true minus.
 */

/** Money as the screens write it: "$19.5M", "€412K", "$758" (whole units below a thousand). */
export function compact(amount: number, currency: string) {
  const digits = Math.abs(amount) < 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: digits }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: digits }).format(amount);
  }
}

/** A change in money, signed: "+$40K", "−$420K". */
export function signedMoney(amount: number, currency: string) {
  if (amount === 0) return compact(0, currency);
  return `${amount > 0 ? "+" : "−"}${compact(Math.abs(amount), currency)}`;
}

/**
 * A line from the server with the sum of money it names put in: {amount} stands for it, written in the screen's
 * currency so that it follows the currency picked at the top as the figures do. Nothing where there is no line.
 */
export function withAmount(text: string | null | undefined, amount: number | null | undefined, currency: string) {
  if (!text) return null;
  return text.replaceAll("{amount}", amount == null ? "—" : compact(amount, currency));
}

/** A percent as the server rounded it: "4.8%", "10.54%". */
export function percent(value: number | null | undefined) {
  return value == null ? "—" : `${value}%`;
}

/** The months as the designs shorten them: "Sep", where some browsers write "Sept". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const at = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(at.getTime()) ? null : { day: at.getUTCDate(), month: MONTHS[at.getUTCMonth()]!, year: at.getUTCFullYear() };
}

/** "02 Dec", as the design dates an event this year or next. */
export function dayMonth(iso: string) {
  const at = parts(iso);
  return at ? `${String(at.day).padStart(2, "0")} ${at.month}` : "—";
}

/** "30 Jun 2028". */
export function fullDay(iso: string) {
  const at = parts(iso);
  return at ? `${at.day} ${at.month} ${at.year}` : "—";
}

/** A note's next event as the table writes it: "Autocall obs 15 Dec", or "Matures 30 Jun 2028". */
export function nextEventText(kind: string, on: string) {
  return kind === "Matures" ? `Matures ${fullDay(on)}` : `${kind} ${dayMonth(on)}`;
}

/** The worst-of level as the table writes it: "AAPL 112.0%", or "103.1%" for a single underlying. */
export function levelText(worst: string | null | undefined, level: number | null | undefined) {
  if (level == null) return "—";
  return `${worst ? `${worst} ` : ""}${level.toFixed(1)}%`;
}

/**
 * A figure across the top as its unit writes it: money compact, a percent, years, a count of notes, a date, or so many
 * of the notes it counts ("6 of 8").
 */
export function kpiValue(one: { unit: string; value: number | null; on: string | null; notes?: string[] }, currency: string) {
  if (one.unit === "DATE") return one.on ? dayMonth(one.on) : "—";
  if (one.value == null) return "—";
  if (one.unit === "OUT_OF") return `${one.value} of ${one.notes?.length ?? "—"}`;
  if (one.unit === "MONEY") return compact(one.value, currency);
  if (one.unit === "PERCENT") return percent(one.value);
  if (one.unit === "YEARS") return `${one.value} yrs`;
  if (one.unit === "NOTES") return `${one.value} note${one.value === 1 ? "" : "s"}`;
  return one.value.toLocaleString("en-US");
}

/** "Jun 2029", as the fixed income design writes a maturity. */
export function monthYear(iso: string) {
  const at = parts(iso);
  return at ? `${at.month} ${at.year}` : "—";
}

/** A number from a bank's sheet, every digit it was sent with. */
export function asSent(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/** A change written green when it gains and red when it loses. */
export function signTone(value: number | null | undefined) {
  if (value == null || value === 0) return undefined;
  return value > 0 ? "text-emerald-700" : "text-red-700";
}

/** A figure written in the colour of its note's status, as the server judged it. */
export function statusText(statusTone: string | null | undefined) {
  return statusTone === "DANGER" ? "text-red-700" : statusTone === "WARN" ? "text-amber-700" : undefined;
}

/** The tone of a status or tag, as the app's pills colour them. */
export function toneClass(tone: string | null | undefined) {
  switch (tone) {
    case "OK":
    case "UP":
      return "bg-emerald-50 text-emerald-700";
    case "WARN":
      return "bg-amber-50 text-amber-800";
    case "DANGER":
    case "DOWN":
      return "bg-red-50 text-red-700";
    case "INFO":
      return "bg-primary-50 text-primary-700";
    default:
      return "bg-slate-100 text-ink-soft";
  }
}
