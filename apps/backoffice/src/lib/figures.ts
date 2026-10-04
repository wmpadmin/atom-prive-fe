/**
 * What a figure box accepts as it is typed: digits and at most one decimal point, with any grouping commas
 * dropped so a figure pasted from a statement still lands. Anything else never reaches the box.
 *
 * <p>A native number box is not enough on its own. It accepts "e", because that is how a number may be
 * written in scientific notation, and then reports its value as empty — so a figure somebody fumbled is
 * quietly dropped rather than questioned.
 *
 * @param typed what the box would now hold
 * @param was what it held before, which is kept when the new text is not part of a figure
 */
export function asFigure(typed: string, was: string) {
  const cleaned = typed.replace(/[,\s]/g, "");
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : was;
}
