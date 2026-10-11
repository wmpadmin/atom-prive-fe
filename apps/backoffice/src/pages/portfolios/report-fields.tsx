import { Field, SelectInput } from "@atomprive/ui";
import type { ReactNode } from "react";

/**
 * A choice that does not arise, shown as the dropdown it would have been.
 *
 * <p>A row of dropdowns with one of them turned into a line of prose reads as a row with a hole in it, so
 * the box stays. What changed is what it says: the one option it holds gives the reason, instead of making
 * somebody hunt for a line of small print to find out why they cannot touch it.
 */
export function NotAsked({ id, label, says }: { id: string; label: string; says: string }) {
  return (
    <Field id={id} label={label}>
      <SelectInput id={id} value="" disabled onChange={() => undefined}>
        <option value="">{says}</option>
      </SelectInput>
    </Field>
  );
}

/**
 * The fields of a report form, four across on a wide screen.
 *
 * <p>Shared by making one now and setting one to arrive by itself, so the two read as the same form asked
 * twice: their columns line up down the page, and a field means the same thing in both.
 */
export function ReportFields({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
