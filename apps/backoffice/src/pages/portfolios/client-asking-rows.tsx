import type { ClientHoldings, MoveLegRequest, SubClassGroup } from "@atomprive/api-client/backoffice";
import { Button, Field, SelectInput, TextInput } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { asFigure } from "../../lib/figures";

/**
 * One line of what a client asked for, as the form holds it.
 *
 * <p>Each end is three boxes rather than one, because that is how the firm names a holding: the class, the
 * sub-asset inside it, and the line inside that where the model goes that deep. A single picker listing
 * every line of a large portfolio is a list nobody can find anything in.
 */
export type AskedRow = {
  fromClass: string;
  fromSub: string;
  fromSubSub: string;
  toClass: string;
  toSub: string;
  toSubSub: string;
  amount: string;
};

export const EMPTY_ROW: AskedRow = {
  fromClass: "", fromSub: "", fromSubSub: "", toClass: "", toSub: "", toSubSub: "", amount: "",
};

/**
 * A row counts once both ends name a place in its own right and an amount is written.
 *
 * <p>A class split into sub-assets is not such a place, and neither is a sub-asset split into lines: the
 * money is in what is inside them. Sent anyway, the server refuses it — and a button that cannot work is
 * worse than one that waits.
 */
export function isAsked(row: AskedRow, holdings?: ClientHoldings) {
  if (row.fromClass === "" || row.toClass === "" || !(Number(row.amount) > 0)) {
    return false;
  }
  const out = row.fromSubSub !== "" ? "" : row.fromSub;
  const into = row.toSubSub !== "" ? "" : row.toSub;
  return !(row.fromSubSub === "" && broken(holdings, row.fromClass, out))
    && !(row.toSubSub === "" && broken(holdings, row.toClass, into));
}

/** The rows as the API takes them. */
export function legsFromRows(rows: AskedRow[], holdings: ClientHoldings | undefined): MoveLegRequest[] {
  return rows.filter((row) => isAsked(row, holdings)).map((row) => ({
    fromAssetClass: row.fromClass,
    fromSubClass: row.fromSub || null,
    fromSubSubClass: row.fromSubSub || null,
    toAssetClass: row.toClass,
    toSubClass: row.toSub || null,
    toSubSubClass: row.toSubSub || null,
    amount: Number(row.amount),
    // What the line held as this screen read it, so a figure that moves between the writing and the
    // answering is noticed at the answer rather than written over.
    heldWhenRaised: heldIn(holdings, row.fromClass, row.fromSub, row.fromSubSub),
  }));
}

/** Both ends read the same way, so a leg cannot leave somewhere it is not allowed to land. */
function groupsOf(holdings: ClientHoldings | undefined, assetClass: string): SubClassGroup[] {
  const klass = (holdings?.classes ?? []).find((one) => one.assetClass === assetClass);
  return klass?.subClasses ?? [];
}

function heldIn(holdings: ClientHoldings | undefined, assetClass: string, sub: string, subSub: string) {
  const groups = groupsOf(holdings, assetClass);
  const group = groups.find((one) => one.subClass === sub);
  if (sub === "") {
    const klass = (holdings?.classes ?? []).find((one) => one.assetClass === assetClass);
    return klass?.valueAmount ?? null;
  }
  if (subSub === "") {
    return group?.valueAmount ?? null;
  }
  return group?.inside.find((one) => one.subSubClass === subSub)?.valueAmount ?? null;
}

/**
 * The sub-assets a class is split into, as one end of a leg may name them.
 *
 * <p>Money comes out of somewhere it already is and may land somewhere it is not yet, so the two ends do
 * not offer the same list: the source offers what the client holds, and the destination offers that plus
 * the lines the model names them nothing in — otherwise a holding could never be started.
 *
 * <p>A sub-asset broken into lines is offered either way, but only as the way to those lines: its own
 * money sits in them, so nothing can come out of it and nothing sent to it would sit anywhere.
 */
function subsOf(holdings: ClientHoldings | undefined, assetClass: string, alsoUnheld: boolean) {
  const named = groupsOf(holdings, assetClass)
    .filter((group) => group.inside.length > 0 || alsoUnheld || group.valueAmount > 0)
    .map((group) => group.subClass)
    .filter((one): one is string => one !== null);
  if (!alsoUnheld) {
    return named;
  }
  const model = (holdings?.modelSubClasses?.[assetClass] ?? []).map((line) => line.name);
  return [...named, ...model.filter((one) => !named.includes(one))];
}

/** And the lines inside one of those, where the model goes that deep. Most sub-assets have none. */
function insideOf(holdings: ClientHoldings | undefined, assetClass: string, sub: string,
    alsoUnheld: boolean) {
  const group = groupsOf(holdings, assetClass).find((one) => one.subClass === sub);
  return (group?.inside ?? [])
    .filter((one) => alsoUnheld || one.valueAmount > 0)
    .map((one) => one.subSubClass)
    .filter((one): one is string => one !== null);
}

/** What the line the money is coming out of holds today, as a sentence for the box beside it. */
function holds(holdings: ClientHoldings | undefined, row: AskedRow) {
  const has = heldIn(holdings, row.fromClass, row.fromSub, row.fromSubSub);
  if (has === null) {
    return undefined;
  }
  return `Holds ${has.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whether what has been chosen is a place in its own right, rather than the way to the places inside it. */
function broken(holdings: ClientHoldings | undefined, assetClass: string, sub: string) {
  if (sub === "") {
    return groupsOf(holdings, assetClass).length > 0;
  }
  const group = groupsOf(holdings, assetClass).find((one) => one.subClass === sub);
  return (group?.inside.length ?? 0) > 0;
}

/**
 * What a client asked for, line by line.
 *
 * <p>Written as rows rather than pressed on the portfolio behind it: a client rings and says what they
 * want moved, and what they say is not always about a line the firm thinks is out of place.
 */
export function ClientAskingRows({ holdings, rows, disabled, onChange }: {
  holdings: ClientHoldings | undefined;
  rows: AskedRow[];
  disabled: boolean;
  onChange: (rows: AskedRow[]) => void;
}) {
  const classes = holdings?.classes ?? [];
  // Choosing a class again empties what was chosen under it: a sub-asset belongs to one class, and left
  // standing it would name a line that class has never had.
  const change = (at: number, part: Partial<AskedRow>) =>
    onChange(rows.map((row, index) => (index === at ? { ...row, ...part } : row)));

  return (
    <div className="space-y-3">
      {/* Rows as blocks rather than a table. A table of these needs a scrolling box to hold six pickers
          across, and a box that scrolls clips what opens inside it — so the list of classes was being cut
          off at the edge of the row it belonged to. */}
      {rows.map((row, at) => (
        <div key={at} className="rounded-xl border border-line bg-canvas/60 p-4">
          {/* Named for whoever is reading it aloud. On screen the blocks are told apart by being blocks,
              and a heading over each one only repeats what the borders already say. */}
          <h4 className="sr-only">{rows.length === 1 ? "What moves" : `Line ${at + 1}`}</h4>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_10rem_auto]">
            <Field id={`out-of-${at}`} label="Out of">
              <div className="space-y-2">
                <SelectInput
                  id={`out-of-${at}`}
                  aria-label={`Asset class the money leaves on line ${at + 1}`}
                  value={row.fromClass}
                  disabled={disabled}
                  onChange={(event) =>
                    change(at, { fromClass: event.target.value, fromSub: "", fromSubSub: "" })}
                >
                  <option value="">Asset class</option>
                  {classes.map((one) => (
                    <option key={one.assetClass} value={one.assetClass}>
                      {one.assetClassName || one.assetClass}
                    </option>
                  ))}
                </SelectInput>
                {row.fromClass !== "" && subsOf(holdings, row.fromClass, false).length > 0 && (
                  <SelectInput
                    aria-label={`Sub-asset the money leaves on line ${at + 1}`}
                    value={row.fromSub}
                    disabled={disabled}
                    onChange={(event) => change(at, { fromSub: event.target.value, fromSubSub: "" })}
                  >
                    <option value="">Sub-asset</option>
                    {subsOf(holdings, row.fromClass, false).map((one) => (
                      <option key={one} value={one}>{one}</option>
                    ))}
                  </SelectInput>
                )}
                {row.fromSub !== "" && insideOf(holdings, row.fromClass, row.fromSub, false).length > 0 && (
                  <SelectInput
                    aria-label={`Line the money leaves on line ${at + 1}`}
                    value={row.fromSubSub}
                    disabled={disabled}
                    onChange={(event) => change(at, { fromSubSub: event.target.value })}
                  >
                    <option value="">Line</option>
                    {insideOf(holdings, row.fromClass, row.fromSub, false).map((one) => (
                      <option key={one} value={one}>{one}</option>
                    ))}
                  </SelectInput>
                )}
              </div>
            </Field>
            <Field id={`into-${at}`} label="Into">
              <div className="space-y-2">
                <SelectInput
                  id={`into-${at}`}
                  aria-label={`Asset class the money goes to on line ${at + 1}`}
                  value={row.toClass}
                  disabled={disabled}
                  onChange={(event) => change(at, { toClass: event.target.value, toSub: "", toSubSub: "" })}
                >
                  <option value="">Asset class</option>
                  {classes.map((one) => (
                    <option key={one.assetClass} value={one.assetClass}>
                      {one.assetClassName || one.assetClass}
                    </option>
                  ))}
                </SelectInput>
                {row.toClass !== "" && subsOf(holdings, row.toClass, true).length > 0 && (
                  <SelectInput
                    aria-label={`Sub-asset the money goes to on line ${at + 1}`}
                    value={row.toSub}
                    disabled={disabled}
                    onChange={(event) => change(at, { toSub: event.target.value, toSubSub: "" })}
                  >
                    <option value="">Sub-asset</option>
                    {subsOf(holdings, row.toClass, true).map((one) => (
                      <option key={one} value={one}>{one}</option>
                    ))}
                  </SelectInput>
                )}
                {row.toSub !== "" && insideOf(holdings, row.toClass, row.toSub, true).length > 0 && (
                  <SelectInput
                    aria-label={`Line the money goes to on line ${at + 1}`}
                    value={row.toSubSub}
                    disabled={disabled}
                    onChange={(event) => change(at, { toSubSub: event.target.value })}
                  >
                    <option value="">Line</option>
                    {insideOf(holdings, row.toClass, row.toSub, true).map((one) => (
                      <option key={one} value={one}>{one}</option>
                    ))}
                  </SelectInput>
                )}
              </div>
            </Field>
            {/* What the chosen line holds, said beside the box rather than checked in it. The server
                refuses an amount a line cannot give, and it is the only place that rule lives; saying the
                figure here is what stops somebody meeting that refusal in the first place. */}
            <Field
              id={`amount-${at}`}
              label={`Amount${holdings?.currency ? ` (${holdings.currency})` : ""}`}
              hint={row.fromClass === "" ? undefined : holds(holdings, row)}
            >
              <TextInput
                id={`amount-${at}`}
                inputMode="decimal"
                value={row.amount}
                disabled={disabled}
                onChange={(event) => change(at, { amount: asFigure(event.target.value, row.amount) })}
              />
            </Field>
            {/* In the row rather than above it. Sat in a header of its own it came down directly over the
                amount, and the whole column read as though it had been pushed out of line. The label here
                is the other columns' label, taking up its height and saying nothing — which is what keeps
                the button on the same line as the boxes it belongs to. */}
            <div>
              <span aria-hidden="true"
                className="block text-2xs font-semibold tracking-wider text-transparent uppercase select-none">
                Remove
              </span>
              <div className="mt-1.5">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={disabled || rows.length === 1}
                  aria-label={`Remove line ${at + 1}`}
                  onClick={() => onChange(rows.filter((_, index) => index !== at))}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {/* A client asks for several things in one telephone call as often as for one. */}
      <Button
        variant="secondary"
        size="sm"
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, { ...EMPTY_ROW }])}
      >
        <Plus aria-hidden="true" />
        Add another
      </Button>
    </div>
  );
}
