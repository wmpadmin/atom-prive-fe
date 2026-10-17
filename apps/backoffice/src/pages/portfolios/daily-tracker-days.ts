import type { ValuationPoint } from "@atomprive/api-client/backoffice";

/**
 * A day on the line, with what changed between it and the day before.
 *
 * <p>Built here rather than on either screen that reads it. The tracker lists the days and a day of its own
 * opens one of them, and a day worked out twice is two answers waiting to differ — the movement in
 * particular, which is read close against close and not against a figure from the middle of a day.
 */
export type Day = {
  on: string;
  worth: number;
  /** What it moved by since the day before; nothing on the first day, which has no day before it. */
  moved: number | null;
  /** That movement as a share of what it opened at; nothing where it opened at nothing. */
  movedShare: number | null;
  holdings: Record<string, number>;
  /** What each sub-asset was worth, by class. Empty for a day written before the platform kept it. */
  lines: Record<string, Record<string, number>>;
  /** The day before's lines, so a movement can be read without hunting back up the list. */
  linesBefore: Record<string, Record<string, number>>;
  /**
   * Every change written down on this day, in the order they were made.
   *
   * <p>A day is read by the one it closed on; these are what it took to get there. One of them is the
   * close, so a day nobody touched twice has a list of one.
   */
  versions: ValuationPoint[];
};

/** The change a day ended on, which is the figure every other screen reads that day by. */
export function closeOf(versions: ValuationPoint[]) {
  return versions.find((one) => one.closedTheDay) ?? versions[versions.length - 1];
}

export function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Every day the points cover, oldest first, each knowing what the day before it closed on. */
export function daysFrom(points: ValuationPoint[]): Day[] {
  const byDay = new Map<string, ValuationPoint[]>();
  for (const point of points) {
    const had = byDay.get(point.valuedOn);
    if (had) had.push(point);
    else byDay.set(point.valuedOn, [point]);
  }
  const dates = [...byDay.keys()];
  return dates.map((on, at) => {
    const versions = byDay.get(on) ?? [];
    const close = closeOf(versions);
    const earlier = at === 0 ? null : byDay.get(dates[at - 1]);
    const before = earlier == null ? null : closeOf(earlier);
    const moved = before === null ? null : close.underManagement - before.underManagement;
    return {
      on,
      worth: close.underManagement,
      moved,
      movedShare: (moved === null || before === null || before.underManagement === 0)
        ? null : (moved / before.underManagement) * 100,
      holdings: close.holdings ?? {},
      lines: close.lines ?? {},
      linesBefore: before?.lines ?? {},
      versions,
    };
  });
}

/**
 * One version of the figures, and the one written immediately before it.
 *
 * <p>A day written several times has figures for each of them, and the tracker only ever showed the one it
 * closed on — so a change made at eleven and corrected at noon left nothing on screen but the correction.
 * Reading a version against the one before it is also what the day's own list of changes measures by, so
 * the two agree.
 */
export function versionAndTheOneBefore(points: ValuationPoint[], revision: number) {
  const inOrder = [...points].sort((first, second) => first.revision - second.revision);
  const at = inOrder.findIndex((one) => one.revision === revision);
  if (at < 0) return null;
  return { version: inOrder[at], before: at === 0 ? null : inOrder[at - 1] };
}
