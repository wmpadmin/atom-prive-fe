import type { LineRequestAction } from "@atomprive/api-client/backoffice";
import { Button, SelectInput, TextInput } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { asFigure } from "../../lib/figures";
import { EMPTY_LINE, type TypedLine } from "./proposal-line-values";

const ACTIONS: { value: LineRequestAction; label: string }[] = [
  { value: "REDUCE", label: "Reduce" },
  { value: "INCREASE", label: "Increase" },
  { value: "HOLD", label: "Hold" },
];

/**
 * Writing a proposal out holding by holding. A part-written line is simply not sent, so an advisor can leave
 * a spare row open without it becoming a change they never meant to propose.
 */
export function ProposalLineEditor({
  lines,
  disabled,
  onChange,
}: {
  lines: TypedLine[];
  disabled: boolean;
  onChange: (lines: TypedLine[]) => void;
}) {
  const change = (at: number, part: Partial<TypedLine>) =>
    onChange(lines.map((line, index) => (index === at ? { ...line, ...part } : line)));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="pr-3 pb-2">
                Asset
              </th>
              <th scope="col" className="px-3 pb-2">
                Action
              </th>
              <th scope="col" className="px-3 pb-2">
                Amount
              </th>
              <th scope="col" className="px-3 pb-2">
                Weight now
              </th>
              <th scope="col" className="px-3 pb-2">
                Weight after
              </th>
              <th scope="col" className="pb-2 pl-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, at) => (
              <tr key={at}>
                <td className="pr-3 pb-2">
                  <TextInput
                    aria-label={`Holding on line ${at + 1}`}
                    value={line.asset}
                    disabled={disabled}
                    placeholder="Global Equity Fund"
                    onChange={(event) => change(at, { asset: event.target.value })}
                  />
                </td>
                <td className="px-3 pb-2">
                  <SelectInput
                    aria-label={`What to do on line ${at + 1}`}
                    value={line.action}
                    disabled={disabled}
                    onChange={(event) => change(at, { action: event.target.value as LineRequestAction })}
                  >
                    {ACTIONS.map((one) => (
                      <option key={one.value} value={one.value}>
                        {one.label}
                      </option>
                    ))}
                  </SelectInput>
                </td>
                <td className="px-3 pb-2">
                  {/* A hold moves nothing, so there is no amount to ask for. */}
                  <TextInput
                    aria-label={`Amount on line ${at + 1}`}
                    inputMode="decimal"
                    value={line.action === "HOLD" ? "" : line.amount}
                    disabled={disabled || line.action === "HOLD"}
                    placeholder={line.action === "HOLD" ? "—" : ""}
                    onChange={(event) => change(at, { amount: asFigure(event.target.value, line.amount) })}
                  />
                </td>
                <td className="px-3 pb-2">
                  <TextInput
                    aria-label={`Weight now on line ${at + 1}`}
                    inputMode="decimal"
                    value={line.weightFrom}
                    disabled={disabled}
                    onChange={(event) => change(at, { weightFrom: asFigure(event.target.value, line.weightFrom) })}
                  />
                </td>
                <td className="px-3 pb-2">
                  <TextInput
                    aria-label={`Weight after on line ${at + 1}`}
                    inputMode="decimal"
                    value={line.weightTo}
                    disabled={disabled}
                    onChange={(event) => change(at, { weightTo: asFigure(event.target.value, line.weightTo) })}
                  />
                </td>
                <td className="pb-2 pl-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={disabled || lines.length === 1}
                    aria-label={`Remove line ${at + 1}`}
                    onClick={() => onChange(lines.filter((_, index) => index !== at))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        disabled={disabled}
        onClick={() => onChange([...lines, { ...EMPTY_LINE }])}
      >
        <Plus aria-hidden="true" />
        Add a line
      </Button>
    </div>
  );
}
