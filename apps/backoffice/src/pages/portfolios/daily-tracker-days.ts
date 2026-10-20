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
  /**
   * The day before on file, with what each of its sub-assets closed at.
   *
   * <p>Null where there is no day before — the first holdings ever written down for this client. Carried
   * rather than hunted back up the list, because the first change of a day has to be read against
   * something and the only honest something is how the day before ended.
   *
   * <p>Its lines can be empty while the day itself exists: a day written before the platform kept
   * sub-asset figures has a total and nothing under it. That is not the same as a day that held nothing,
   * and reading one as the other would print every line of today as money arriving from nowhere.
   */
  dayBefore: { on: string; lines: Record<string, Record<string, number>> } | null;
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
      dayBefore: (before === null || earlier === null)
        ? null
        : { on: dates[at - 1], lines: before.lines ?? {} },
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

/** One line that gained or lost between two changes, named the way the holdings screen names it. */
export type Shift = {
  /** The class code, so the screen can name it the way every other screen names it. */
  assetClass: string;
  /** The sub-asset inside that class. */
  line: string;
  /** Positive where the line gained, negative where it lost. */
  by: number;
};

/**
 * What actually changed between one version of a client's figures and the one before it.
 *
 * <p>Said as lines rather than as a total, because the total is usually the one thing that did not
 * change. Money moved between sub-assets leaves the portfolio worth exactly what it was worth before, so
 * a list of changes read by their totals printed the same figure eight times over and "0.00" beside each
 * of them — eight rows saying nothing happened on a day eight things happened.
 *
 * <p>A line that appears is a gain from nothing and a line that disappears is a loss to nothing; both
 * are movements and both are listed, because a sub-asset being opened or emptied is exactly the kind of
 * thing somebody is looking for when they open a day.
 */
export function shiftsBetween(
  now: Record<string, Record<string, number>>,
  before: Record<string, Record<string, number>> | null,
): Shift[] {
  if (before === null) return [];
  const every = new Map<string, { now: number; before: number }>();
  const read = (from: Record<string, Record<string, number>>, which: "now" | "before") => {
    for (const [assetClass, lines] of Object.entries(from)) {
      for (const [line, amount] of Object.entries(lines)) {
        const key = `${assetClass}\u0000${line}`;
        const had = every.get(key) ?? { now: 0, before: 0 };
        had[which] = amount;
        every.set(key, had);
      }
    }
  };
  read(now, "now");
  read(before, "before");
  const shifts: Shift[] = [];
  for (const [key, both] of every) {
    const by = both.now - both.before;
    // A penny either way is rounding rather than a movement, and listing it would bury the one that is.
    if (Math.abs(by) < 0.005) continue;
    const [assetClass, line] = key.split("\u0000");
    shifts.push({ assetClass, line, by });
  }
  // What was taken out first and what it went into after, which is the order somebody reads the sentence
  // in: out of here, into there.
  return shifts.sort((first, second) => first.by - second.by);
}

/**
 * What a change was measured against, said so the screen can name it rather than go quiet.
 *
 * <p>A change with nothing to show is three different facts wearing one face: the first holdings ever
 * written for a client, a day whose predecessor on file predates sub-asset figures, and a change that
 * genuinely moved nothing. The screen used to print one phrase for all three — under the heading "Money
 * came out of", where it answered a question nobody had asked.
 */
export type Basis =
  /** Against the change written immediately before it, on the same day. */
  | { kind: "earlier-change" }
  /** The first change of a day, against how the day before on file ended. */
  | { kind: "day-before"; on: string }
  /** The first holdings ever written down for this client: there is nothing to measure against. */
  | { kind: "nothing-before" }
  /** A day before exists, but it was written before sub-asset figures were kept. */
  | { kind: "no-lines-before"; on: string };

/** One change on a day: what it took out, what it put in, how much that was, and what it was read against. */
export type DayChange = {
  version: ValuationPoint;
  /** Lines that lost, biggest loss first. */
  out: Shift[];
  /** Lines that gained. */
  into: Shift[];
  /**
   * What the change moved.
   *
   * <p>What came out of the lines that lost — or, where a change only added money, what went into the
   * ones that gained, since the two sides do not match then and the larger of them is the movement.
   */
  shifted: number;
  basis: Basis;
};

/**
 * Every change on a day, each read against the right thing.
 *
 * <p>Worked out once here and read by both the figure at the top of the day and the table under it. The
 * table used to do it inline and the figure at the top did something else entirely — so a day could say
 * nothing moved above a list of what had moved.
 *
 * <p>The first change of a day is read against how the day before on file ended, which is what the page
 * has always told its readers it does. Measured against nothing, the opening change of every day came out
 * blank: the first thing written on a day is usually the whole of what happened on it, and on a day
 * written once it was the whole page.
 */
export function changesIn(day: Day): DayChange[] {
  return day.versions.map((version, at) => {
    const earlier = at === 0 ? null : day.versions[at - 1];
    const basis: Basis = earlier !== null ? { kind: "earlier-change" }
      : day.dayBefore === null ? { kind: "nothing-before" }
        : Object.keys(day.dayBefore.lines).length === 0
          ? { kind: "no-lines-before", on: day.dayBefore.on }
          : { kind: "day-before", on: day.dayBefore.on };
    const before = earlier !== null ? earlier.lines ?? {}
      : basis.kind === "day-before" ? day.dayBefore?.lines ?? {} : null;
    const shifts = shiftsBetween(version.lines ?? {}, before);
    const out = shifts.filter((shift) => shift.by < 0);
    const into = shifts.filter((shift) => shift.by > 0);
    return {
      version,
      out,
      into,
      shifted: Math.max(
        out.reduce((sum, shift) => sum - shift.by, 0),
        into.reduce((sum, shift) => sum + shift.by, 0)),
      basis,
    };
  });
}

/**
 * What the day moved between its own lines, which is not what the day's total did.
 *
 * <p>Money taken out of one sub-asset and put into another leaves the portfolio worth exactly what it was
 * worth before. A day that moved 280 between holdings and took nothing in or out has a total that did not
 * budge, and a day read by its total alone says nothing happened — which is what it said, in bold, above
 * the list of what happened.
 */
export function movedWithin(changes: DayChange[]) {
  return changes.reduce((sum, change) => sum + change.shifted, 0);
}
