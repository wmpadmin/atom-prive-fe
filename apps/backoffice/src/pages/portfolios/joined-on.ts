/**
 * The day a client joined the firm, as the screens that must not let anybody write before it read it.
 *
 * <p>One place, because two screens enforce the same date — the calendar that refuses to open on an
 * earlier day, and the sentence that says why — and a date parsed twice is two dates that will one day
 * disagree about which side of midnight they are on.
 */

/** "2025-04-01" as a local date, so the day doesn't move with the time zone. A bad date reads as none. */
export function asDate(value: string | null | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * The earliest day a figure about this client may be dated: the day they joined, or the floor the screen
 * would use anyway where there is no client to read one from.
 */
export function noEarlierThan(joinedOn: string | null | undefined, floor: Date): Date {
  const joined = asDate(joinedOn);
  return joined && joined > floor ? joined : floor;
}
