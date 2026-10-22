import { Button, SelectInput, TextInput } from "@atomprive/ui";
import { Plus, X } from "lucide-react";
import { asFigure } from "../../lib/figures";
import { figure } from "../portfolios/money-words";
import { EMPTY_LEG, type Choice, type TypedLeg } from "./proposal-leg-values";

/** A choice as the picker reads it: what it is called, and what is in it where anything is. */
function said(choice: Choice) {
  return choice.held === null ? `${choice.said} — nothing held yet` : `${choice.said} — ${figure(choice.held)}`;
}

/**
 * Writing a proposal out leg by leg: out of one line of the portfolio, into another, for an amount.
 *
 * <p>It used to ask for one end at a time — a holding, "reduce" or "increase", and a weight — so a proposal
 * said what to do to each line and never which money went where. Nothing could be carried out from it, and
 * somebody had to read it and raise the move by hand.
 *
 * <p>Both ends are picked from the client's own allocation rather than typed. A part-written leg is simply
 * not sent, so a spare row can be left open without becoming something nobody meant to propose.
 */
export function ProposalLegEditor({
  legs,
  from,
  into,
  disabled,
  waiting,
  onChange,
}: {
  legs: TypedLeg[];
  from: Choice[];
  into: Choice[];
  disabled: boolean;
  /** Said where there is no client yet, because an empty picker on its own looks like a fault. */
  waiting: string | null;
  onChange: (legs: TypedLeg[]) => void;
}) {
  const change = (at: number, part: Partial<TypedLeg>) =>
    onChange(legs.map((leg, index) => (index === at ? { ...leg, ...part } : leg)));

  if (waiting !== null) {
    return <p className="text-sm text-ink-muted">{waiting}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="pr-3 pb-2">
                Out of
              </th>
              <th scope="col" className="px-3 pb-2">
                Into
              </th>
              <th scope="col" className="px-3 pb-2">
                Amount
              </th>
              <th scope="col" className="pb-2 pl-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg, at) => (
              <tr key={at}>
                <td className="pr-3 pb-2">
                  <SelectInput
                    aria-label={`Where the money leaves on leg ${at + 1}`}
                    value={leg.from}
                    disabled={disabled}
                    onChange={(event) => change(at, { from: event.target.value })}
                  >
                    <option value="">Choose where it leaves</option>
                    {from.map((one) => (
                      <option key={one.key} value={one.key}>
                        {said(one)}
                      </option>
                    ))}
                  </SelectInput>
                </td>
                <td className="px-3 pb-2">
                  <SelectInput
                    aria-label={`Where the money goes on leg ${at + 1}`}
                    value={leg.to}
                    disabled={disabled}
                    onChange={(event) => change(at, { to: event.target.value })}
                  >
                    <option value="">Choose where it goes</option>
                    {/* Not back into where it came from: that is a leg that moves nothing. */}
                    {into.filter((one) => one.key !== leg.from).map((one) => (
                      <option key={one.key} value={one.key}>
                        {said(one)}
                      </option>
                    ))}
                  </SelectInput>
                </td>
                <td className="px-3 pb-2">
                  <TextInput
                    aria-label={`Amount on leg ${at + 1}`}
                    inputMode="decimal"
                    value={leg.amount}
                    disabled={disabled}
                    onChange={(event) => change(at, { amount: asFigure(event.target.value, leg.amount) })}
                  />
                </td>
                <td className="pb-2 pl-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={disabled || legs.length === 1}
                    aria-label={`Remove leg ${at + 1}`}
                    onClick={() => onChange(legs.filter((_, index) => index !== at))}
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
        onClick={() => onChange([...legs, { ...EMPTY_LEG }])}
      >
        <Plus aria-hidden="true" />
        Add a leg
      </Button>
    </div>
  );
}
