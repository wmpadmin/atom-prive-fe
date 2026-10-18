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

/** A sub-asset nobody has grouped is a real place for money to be, and it needs a name to be named by. */
export function named(subClass: string | null) {
  return subClass ?? "what is not grouped";
}

/**
 * By how much a leg would leave its destination past the most that line may hold, or nothing if it would not.
 *
 * <p>Filling a line to the end of its band is offered on purpose and going past it is a decision rather
 * than a mistake, so it is said and not refused. The ceiling is the platform's own figure, the same one it
 * reads the line's breach against, so this cannot call a line fine where the table beside it calls it
 * breached.
 */
export function pastItsBand(leg: PlannedLeg) {
  if (leg.landsOnMayHold === null) return 0;
  const over = leg.landsOnHeldNow + leg.amount - leg.landsOnMayHold;
  // A whole unit or it is nothing: a ceiling worked out as a share lands a hair either side of its figure,
  // and a leg filling a line exactly to the end of its band is not an overshoot worth a line of warning.
  return over < 1 ? 0 : over;
}
