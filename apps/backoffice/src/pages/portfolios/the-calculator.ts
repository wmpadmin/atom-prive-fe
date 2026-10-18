import type {
  AllocationClass,
  AllocationRequest,
  ClientHoldings,
  ClientLoans,
  ClientNonFinancialAssets,
  NonFinancialAssetRequest,
} from "@atomprive/api-client/backoffice";

/**
 * What the Net AUM calculator says, as one value.
 *
 * <p>It is typed over two screens and it is one act: the lines and the loan on the first, the things
 * nobody manages on the second. Sent as two it was written as two — the lines waited on whoever looks
 * after the client while the loan beside them landed at once, which is half an act landing. So the two
 * screens fill in one of these and it is sent once, written outright the first time and asked for every
 * time after.
 */
export type Calculator = AllocationRequest;

/**
 * To the penny the figures are kept in. A sum carried at full floating-point precision is refused by the
 * API, which works the same figure out to two places from the same lines.
 */
export function toThePenny(figure: number) {
  return Math.round(figure * 100) / 100;
}

/** What the client holds today, in the shape the calculator sends — ids and all, so nothing is reworded. */
export function linesOnFile(holdings: ClientHoldings | undefined): AllocationClass[] {
  return (holdings?.classes ?? []).map((klass) => ({
    assetClass: klass.assetClass,
    lines: klass.subClasses.flatMap((group) => group.positions).map((one) => ({
      id: one.id,
      name: (one.subClass ?? one.name).trim(),
      valueAmount: one.valueAmount,
    })),
  }));
}

/**
 * What the client owes today, as the one figure the calculator keeps.
 *
 * <p>Null where they have several, which is the one case this box does not speak for: it would edit
 * something it does not name. Those are left exactly as they are.
 */
export function loanOnFile(owed: ClientLoans | undefined): number | null {
  const loans = owed?.loans ?? [];
  return (loans.length > 1) ? null : toThePenny(owed?.total ?? 0);
}

export function ownedOnFile(owned: ClientNonFinancialAssets | undefined): NonFinancialAssetRequest[] {
  return (owned?.items ?? []).map((one) => ({
    item: one.item,
    description: one.description ?? null,
    valueAmount: one.valueAmount,
  }));
}

/** One line of the calculator, written out so two readings of it can be set side by side. */
function said(allocation: Calculator) {
  const lines = allocation.classes.flatMap((klass) =>
    klass.lines.map((line) => `${klass.assetClass}\t${line.name.trim()}\t${toThePenny(line.valueAmount)}`));
  // Sorted, because the order lines are sent in is the order the screen happens to lay them out and not
  // something anybody typed. Two screens that list one class's lines differently hold the same figures.
  return lines.sort().join("\n");
}

function owns(items: NonFinancialAssetRequest[]) {
  return items
    .map((one) => `${one.item.trim()}\t${(one.description ?? "").trim()}\t${toThePenny(one.valueAmount)}`)
    .sort()
    .join("\n");
}

/**
 * Whether what is being sent says anything the client's figures do not already say.
 *
 * <p>Nothing is asked for where nothing changed: somebody who opens the calculator to read it, or who
 * clears a box and types the same figure back into it, has changed nothing and owes nobody an answer.
 * A request raised for that would put a real decision in front of whoever looks after the client with
 * nothing in it to decide.
 *
 * <p>Null is not nought. A part the sender is not carrying — the loan on a client who has several, the
 * list on a walk that never reached it — is left alone and so cannot differ.
 */
export function saysSomethingNew(sending: Calculator, onFile: Calculator) {
  if (said(sending) !== said(onFile)) return true;
  if ((sending.currency ?? "") !== (onFile.currency ?? "")) return true;
  if (sending.loanAmount !== null && onFile.loanAmount !== null
    && toThePenny(sending.loanAmount) !== toThePenny(onFile.loanAmount)) {
    return true;
  }
  if (sending.ownedOutright !== null
    && owns(sending.ownedOutright) !== owns(onFile.ownedOutright ?? [])) {
    return true;
  }
  return false;
}
