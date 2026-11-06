import { dayOf, writeDay, writeMoment } from "./display";

/**
 * A date as the client asked for it — as the firm writes them, 26 Oct 2026, unless they chose otherwise.
 *
 * <p>Its own file, small as it is, because the screens that use it are components and a module that
 * exports both a component and a plain function loses hot reloading for the whole file.
 */
export function when(at: string) {
  return writeDay(at);
}

/**
 * A date with the time on it: 26 Oct 2026, 14:32.
 *
 * <p>For an audit log and nowhere else. Everywhere a client reads a date — joined, granted, expires — the
 * day is the whole of the fact, and a time of day on it is noise. In a log it is the fact: two reads on the
 * same day are two rows, and without the clock they read as one thing recorded twice.
 */
export function exactly(at: string) {
  return writeMoment(at);
}

/** Just the day, as yyyy-mm-dd, for comparing against a date input's value. */
export function asDay(at: string) {
  return dayOf(at);
}
