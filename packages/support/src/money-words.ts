import type { PlannedLeg } from "@atomprive/api-client/backoffice";

/**
 * The words and figures the approval queues share.
 *
 * <p>Their own file, because the screens that read them are several and a helper exported beside a
 * component stops that component refreshing as it is edited.
 */

/** Money, written the way every other portfolio screen writes it. */
export function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The same figure without the currency on it, for a column of them.
 *
 * <p>A table of money says what it is written in once, above or below it; repeated down every row it is
 * three characters of noise a line and the figures stop lining up.
 */
export function figure(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A sub-asset nobody has grouped is a real place for money to be, and it needs a name to be named by.
 *
 * <p>Named by its class where one is to hand, because two classes can each hold something nobody has
 * grouped and "what is not grouped" said twice in a list is two lines a reader cannot tell apart.
 */
export function named(subClass: string | null, assetClass?: string,
    subSubClass?: string | null): string {
  // The line itself, with the sub-asset around it where there is one. The plan goes three deep, so a
  // move between two lines inside one sub-asset read "Indian equities → Indian equities" for the whole
  // amount: a sentence that looks like a fault in the screen rather than a plan, and that tells the
  // person answering it nothing about where the money actually lands.
  if (subSubClass != null && subSubClass !== "") {
    return `${named(subClass, assetClass)} · ${subSubClass}`;
  }
  if (subClass !== null) return subClass;
  return assetClass === undefined ? "what is not grouped" : `${assetClass}, not grouped`;
}

/**
 * A line of the portfolio as a plan would leave it.
 *
 * <p>What the reader is actually weighing. A plan's legs are written one per movement, so three legs out
 * of one line say that line's name three times and its figure not at all — and the sum that decides the
 * answer, what the line is left holding, is done in the reader's head.
 */
export type NettedLine = {
  /** What to call it on screen, the same words the legs above it use. */
  name: string;
  /** What it holds as the queue is read. */
  holdsNow: number;
  /** What it would hold were this plan approved. */
  wouldHold: number;
  /** The most the model lets it hold, or null where nothing holds it to anything. */
  mayHold: number | null;
  /** What it held when the plan was raised, where that is no longer what it holds. */
  heldWhenRaised: number | null;
  /**
   * What OTHER plans waiting on this client would put into it, less what they would take out.
   *
   * <p>Not refused and not netted into the figures below — this plan is still weighed on its own, and a
   * line may take money from two places. Said because the alternative is what happened: each plan sat
   * inside the band alone, and whoever answered the second had nothing telling them the first was coming.
   */
  askedByOthers: number;
};

/**
 * Every line a plan touches, once each, with what it would be left holding.
 *
 * <p>The server reads each line's holding from one map and copies it onto every leg that names it, so a
 * line appearing three times reports the same figure three times rather than running itself down. The
 * first of them is therefore the line's holding, and the movements are added to it — which is also why a
 * line that money leaves in one leg and arrives in by another nets out correctly rather than counting its
 * holding twice.
 *
 * <p>In the order the legs name them, sources before destinations, so the list below the table reads in
 * the order the table above it was read.
 */
export function netted(legs: PlannedLeg[]): NettedLine[] {
  const lines = new Map<string, NettedLine>();
  // Keyed the way the server keys a line — class, sub-asset and the line inside it, not the name on
  // screen — so two classes each holding something nobody has grouped stay two lines rather than
  // collapsing into one.
  //
  // All three parts, because the plan goes three deep. Keyed by two, two legs naming different lines
  // inside one sub-asset collapsed into a single row: the table said one line where there were two, gave
  // it a "would hold" figure that was neither of theirs, and the band warning underneath was read against
  // that wrong figure. Somebody agreed to money landing somewhere this table never named.
  const line = (assetClass: string, subClass: string | null, subSubClass: string | null,
      holdsNow: number) => {
    const key = `${assetClass}\t${subClass ?? ""}\t${subSubClass ?? ""}`;
    const had = lines.get(key);
    if (had) return had;
    const made: NettedLine = {
      name: named(subClass, assetClass, subSubClass),
      holdsNow,
      wouldHold: holdsNow,
      mayHold: null,
      heldWhenRaised: null,
      askedByOthers: 0,
    };
    lines.set(key, made);
    return made;
  };
  for (const leg of legs) {
    const from = line(leg.fromAssetClass, leg.fromSubClass, leg.fromSubSubClass, leg.heldNow);
    from.wouldHold -= leg.amount;
    // Said against the line rather than the movement: it is the line whose figure has changed under the
    // plan, and a line named by three legs would otherwise say it three times.
    if (leg.figuresMoved) from.heldWhenRaised = leg.heldWhenRaised;
    const into = line(leg.toAssetClass, leg.toSubClass, leg.toSubSubClass, leg.landsOnHeldNow);
    into.wouldHold += leg.amount;
    if (leg.landsOnMayHold !== null) into.mayHold = leg.landsOnMayHold;
    // The server says this per leg, and every leg landing in one line says the same figure about it — it
    // is a fact about the line, not about the movement. Taken rather than added up.
    into.askedByOthers = leg.landsOnAskedByOthers;
  }
  return [...lines.values()];
}

/**
 * By how much a line would be left past the most it may hold, or nothing if it would not.
 *
 * <p>Read against what the line is LEFT holding rather than against one movement into it, because two
 * legs landing in one line are one overshoot and not two: measured a leg at a time, each could sit inside
 * the band while the pair of them together did not.
 *
 * <p>Filling a line to the end of its band is offered on purpose and going past it is a decision rather
 * than a mistake, so it is said and not refused.
 */
export function overItsBand(line: NettedLine) {
  if (line.mayHold === null) return 0;
  const over = line.wouldHold - line.mayHold;
  // A whole unit or it is nothing: a ceiling worked out as a share lands a hair either side of its figure,
  // and a line filled exactly to the end of its band is not an overshoot worth a line of warning.
  return over < 1 ? 0 : over;
}
