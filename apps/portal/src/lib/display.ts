import type { MyPreferences } from "@atomprive/api-client/portal";

/**
 * How this client asked for their screens to be written: the currency figures are shown in, how a date is
 * written and which clock it is read against.
 *
 * <p>Held here rather than passed down every screen, because a date is written in a hundred places and every
 * one of them would otherwise need the client's choice handed to it. The new look sets it once it has read
 * the client's answer and puts it back the way the firm writes things when the client leaves for the classic
 * portal, which writes things the firm's way and nothing else.
 *
 * <p>Nothing here decides anything about money. The rates are the server's, read once with the answer, and a
 * currency the server sent no rate for is shown as it is held rather than at a guessed one.
 */
export type Display = {
  currency: string | null;
  rates: Record<string, number>;
  dateFormat: string;
  timeZone: string | null;
};

export const AS_THE_FIRM_WRITES: Display = { currency: null, rates: {}, dateFormat: "DAY_MONTH_YEAR", timeZone: null };

let current: Display = AS_THE_FIRM_WRITES;

export function setDisplay(chosen: Display) {
  current = chosen;
}

/** The client's answer from the server, in the shape this module keeps. */
export function displayFrom(answer: MyPreferences): Display {
  return {
    currency: answer.reportingCurrency,
    rates: Object.fromEntries(Object.entries(answer.rates).map(([code, rate]) => [code, Number(rate)])),
    dateFormat: answer.dateFormat,
    timeZone: answer.timeZone,
  };
}

/** A short key that changes whenever the answer does, so the screens under it are drawn again. */
export function displayKey(shown: Display) {
  return `${shown.currency ?? "-"}|${shown.dateFormat}|${shown.timeZone ?? "-"}`;
}

/**
 * How many of the chosen currency one unit of this one buys, or nothing where figures in it stay as they are
 * held: no currency chosen, or no rate on file for this one.
 */
export function rateFrom(currency: string): number | null {
  if (!current.currency || current.currency === currency) return null;
  return current.rates[currency] ?? null;
}

/** The currency a figure held in this one is shown in. */
export function shownCurrency(currency: string) {
  return rateFrom(currency) === null ? currency : (current.currency ?? currency);
}

/** Whether figures held in this currency are being shown in another. */
export function restating(currency: string) {
  return rateFrom(currency) !== null;
}

// A day on its own, "2026-11-05", is a day and not an instant: read against any clock but UTC, it would slip to
// the day before for everybody west of Greenwich.
const JUST_A_DAY = /^\d{4}-\d{2}-\d{2}$/;

function zoneFor(at: string) {
  return JUST_A_DAY.test(at) ? "UTC" : (current.timeZone ?? undefined);
}

function dayParts(): [string, Intl.DateTimeFormatOptions] {
  switch (current.dateFormat) {
    case "DD_MM_YYYY":
      return ["en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }];
    case "MM_DD_YYYY":
      return ["en-US", { day: "2-digit", month: "2-digit", year: "numeric" }];
    case "YYYY_MM_DD":
      return ["en-CA", { day: "2-digit", month: "2-digit", year: "numeric" }];
    default:
      return ["en-GB", { day: "numeric", month: "short", year: "numeric" }];
  }
}

/** A day the way the client asked for it: 5 Nov 2026, 05/11/2026, 11/05/2026 or 2026-11-05. */
export function writeDay(at: string) {
  const [locale, parts] = dayParts();
  return new Date(at).toLocaleDateString(locale, { ...parts, timeZone: zoneFor(at) });
}

/** A day and the time on it, on the client's clock: 5 Nov 2026, 14:32. */
export function writeMoment(at: string) {
  const [locale, parts] = dayParts();
  return new Date(at).toLocaleString(locale, {
    ...parts,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zoneFor(at),
  });
}

/**
 * Anything else written off a date — a month on a chart's axis, a weekday on a heading — keeping the firm's
 * shape for it but read against the client's clock.
 */
export function writeDate(at: string, options: Intl.DateTimeFormatOptions, locale = "en-GB") {
  const timeZone = zoneFor(at);
  return options.hour !== undefined
    ? new Date(at).toLocaleString(locale, { ...options, timeZone })
    : new Date(at).toLocaleDateString(locale, { ...options, timeZone });
}

/** Just the day on the client's clock, as yyyy-mm-dd, for comparing against a date input's value. */
export function dayOf(at: string) {
  return new Date(at).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zoneFor(at) });
}
