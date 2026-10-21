import type { ClientHoldings, MoveLegRequest, SubClassGroup } from "@atomprive/api-client/backoffice";
import { Button, SelectInput, TextInput } from "@atomprive/ui";
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

/** A row counts once it says where the money leaves, where it lands, and how much of it moves. */
export function isAsked(row: AskedRow) {
  return row.fromClass !== "" && row.toClass !== "" && Number(row.amount) > 0;
}

/** The rows as the API takes them. */
export function legsFromRows(rows: AskedRow[], holdings: ClientHoldings | undefined): MoveLegRequest[] {
  return rows.filter(isAsked).map((row) => ({
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
 * The sub-assets a class is split into.
 *
 * @param alsoUnheld whether to offer the ones the model names that the client holds nothing in. Money has
 * to be able to land somewhere it is not yet, or no asking could ever start a holding; it can only come
 * out of somewhere it already is.
 */
function subsOf(holdings: ClientHoldings | undefined, assetClass: string, alsoUnheld: boolean) {
  const named = groupsOf(holdings, assetClass)
    .map((group) => group.subClass)
    .filter((one): one is string => one !== null);
  if (!alsoUnheld) {
    return named;
  }
  const model = (holdings?.modelSubClasses?.[assetClass] ?? []).map((line) => line.name);
  return [...named, ...model.filter((one) => !named.includes(one))];
}

/** And the lines inside one of those, where the model goes that deep. Most sub-assets have none. */
function insideOf(holdings: ClientHoldings | undefined, assetClass: string, sub: string) {
  const group = groupsOf(holdings, assetClass).find((one) => one.subClass === sub);
  return (group?.inside ?? [])
    .map((one) => one.subSubClass)
    .filter((one): one is string => one !== null);
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
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="pr-3 pb-2">Out of</th>
              <th scope="col" className="px-3 pb-2">Into</th>
              <th scope="col" className="px-3 pb-2">Amount</th>
              <th scope="col" className="pb-2 pl-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, at) => (
              <tr key={at} className="align-top">
                <td className="space-y-2 pr-3 pb-3">
                  <SelectInput
                    aria-label={`Asset class the money leaves on row ${at + 1}`}
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
                      aria-label={`Sub-asset the money leaves on row ${at + 1}`}
                      value={row.fromSub}
                      disabled={disabled}
                      onChange={(event) => change(at, { fromSub: event.target.value, fromSubSub: "" })}
                    >
                      <option value="">The whole class</option>
                      {subsOf(holdings, row.fromClass, false).map((one) => (
                        <option key={one} value={one}>{one}</option>
                      ))}
                    </SelectInput>
                  )}
                  {row.fromSub !== "" && insideOf(holdings, row.fromClass, row.fromSub).length > 0 && (
                    <SelectInput
                      aria-label={`Line the money leaves on row ${at + 1}`}
                      value={row.fromSubSub}
                      disabled={disabled}
                      onChange={(event) => change(at, { fromSubSub: event.target.value })}
                    >
                      <option value="">The whole sub-asset</option>
                      {insideOf(holdings, row.fromClass, row.fromSub).map((one) => (
                        <option key={one} value={one}>{one}</option>
                      ))}
                    </SelectInput>
                  )}
                </td>
                <td className="space-y-2 px-3 pb-3">
                  <SelectInput
                    aria-label={`Asset class the money goes to on row ${at + 1}`}
                    value={row.toClass}
                    disabled={disabled}
                    onChange={(event) =>
                      change(at, { toClass: event.target.value, toSub: "", toSubSub: "" })}
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
                      aria-label={`Sub-asset the money goes to on row ${at + 1}`}
                      value={row.toSub}
                      disabled={disabled}
                      onChange={(event) => change(at, { toSub: event.target.value, toSubSub: "" })}
                    >
                      <option value="">The whole class</option>
                      {subsOf(holdings, row.toClass, true).map((one) => (
                        <option key={one} value={one}>{one}</option>
                      ))}
                    </SelectInput>
                  )}
                  {row.toSub !== "" && insideOf(holdings, row.toClass, row.toSub).length > 0 && (
                    <SelectInput
                      aria-label={`Line the money goes to on row ${at + 1}`}
                      value={row.toSubSub}
                      disabled={disabled}
                      onChange={(event) => change(at, { toSubSub: event.target.value })}
                    >
                      <option value="">The whole sub-asset</option>
                      {insideOf(holdings, row.toClass, row.toSub).map((one) => (
                        <option key={one} value={one}>{one}</option>
                      ))}
                    </SelectInput>
                  )}
                </td>
                <td className="px-3 pb-3">
                  <TextInput
                    aria-label={`Amount on row ${at + 1}`}
                    inputMode="decimal"
                    placeholder={holdings?.currency ?? ""}
                    value={row.amount}
                    disabled={disabled}
                    onChange={(event) => change(at, { amount: asFigure(event.target.value, row.amount) })}
                  />
                </td>
                <td className="pb-3 pl-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={disabled || rows.length === 1}
                    aria-label={`Remove row ${at + 1}`}
                    onClick={() => onChange(rows.filter((_, index) => index !== at))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
