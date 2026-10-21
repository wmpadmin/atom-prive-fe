import type { ApiError } from "@atomprive/api-client";
import {
  useCycle,
  usePutTheCycleBack,
  useSetCycle,
  type DeclarationCycleView,
  type DeclarationCycleViewCadence,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, SelectInput, TextInput } from "@atomprive/ui";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

/**
 * How often the firm's declarations are wanted, in the firm's own words.
 *
 * <p>One cycle, for all of them. Each declaration used to carry its own — yearly on 31 January, quarterly,
 * one on appointment, one once on joining — which was nine answers to one question and a compliance
 * calendar nobody could hold in their head. The firm names a day, and everybody's fall due on it.
 *
 * <p>Opened from the register rather than from Configuration, because the permission that lets somebody
 * chase a declaration is the permission that lets them say how often it is wanted: the same people, on the
 * screen where they already notice that a cycle is wrong.
 */
const CADENCES: { id: DeclarationCycleViewCadence; label: string }[] = [
  { id: "MONTHLY", label: "Monthly" },
  { id: "QUARTERLY", label: "Quarterly" },
  { id: "SIX_MONTHLY", label: "Six-monthly" },
  { id: "ANNUAL", label: "Yearly" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HowOftenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cycle = useCycle<DeclarationCycleView, ApiError>({ query: { enabled: open } });
  const [editing, setEditing] = useState(false);

  return (
    <Dialog
      open={open}
      size="lg"
      title="How often the declarations are wanted"
      description={
        "One cycle, for every declaration the firm asks its staff to sign. Changing it takes effect at "
        + "once, on everybody: nothing records the cycle a signature was given under, so moving the firm "
        + "from yearly to monthly moves every next-due date it holds."
      }
      onClose={onClose}
    >
      {cycle.isError && <Alert tone="danger">{cycle.error.message}</Alert>}
      {cycle.isPending ? (
        <p className="text-sm text-ink-muted">Reading the firm's cycle…</p>
      ) : editing ? (
        <TheCycle
          now={cycle.data}
          onDone={() => setEditing(false)}
          onSaved={() => void cycle.refetch()}
        />
      ) : (
        <AtRest
          now={cycle.data}
          onChange={() => setEditing(true)}
          onPutBack={() => void cycle.refetch()}
        />
      )}
    </Dialog>
  );
}

/** The cycle as it sits: what it is, and whose answer that is. */
function AtRest({ now, onChange, onPutBack }: {
  now: DeclarationCycleView | undefined;
  onChange: () => void;
  onPutBack: () => void;
}) {
  const back = usePutTheCycleBack<ApiError>({ mutation: { onSuccess: onPutBack } });
  if (!now) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Every declaration</p>
        <p className="mt-0.5 text-sm text-ink-muted">{now.said}</p>
        {/* Whose answer it is, and what it would go back to. Somebody changing a cycle wants to know
            whether they are changing the firm's own decision or the one it arrived with. */}
        {now.setByTheFirm && (
          <p className="mt-0.5 text-xs text-ink-muted">
            Set by {now.changedByName ?? "the firm"} · was {now.asShipped}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {now.setByTheFirm && (
          <Button
            variant="secondary"
            size="sm"
            disabled={back.isPending}
            onClick={() => back.mutate()}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Put back
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}

/** Being changed: how often, and by which day of the year. */
function TheCycle({ now, onDone, onSaved }: {
  now: DeclarationCycleView | undefined;
  onDone: () => void;
  onSaved: () => void;
}) {
  const set = useSetCycle<ApiError>({
    mutation: {
      onSuccess: () => {
        onSaved();
        onDone();
      },
    },
  });
  const [cadence, setCadence] = useState<DeclarationCycleViewCadence>(now?.cadence ?? "ANNUAL");
  // A day of the YEAR, not a day in one: "the 31st of January" is the rule, and 31 January 2026 is only
  // the first time it comes round. So it is a month and a day rather than a date picker.
  const [month, setMonth] = useState(String(now?.dueMonth ?? 1));
  const [day, setDay] = useState(String(now?.dueDay ?? 31));
  const refused = set.isError ? set.error : null;
  // A monthly cycle lands in every month, so the month it is anchored in decides nothing. Asked for on
  // the others, where it decides which months the cycle falls in: quarterly from March is March, June,
  // September, December.
  const monthMatters = cadence !== "MONTHLY";

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        set.mutate({ data: { cadence, dueMonth: Number(month), dueDay: Number(day) } });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            How often
          </span>
          <SelectInput
            id="declaration-cadence"
            value={cadence}
            onChange={(event) => setCadence(event.target.value as DeclarationCycleViewCadence)}
            className="w-56"
          >
            {CADENCES.map((one) => (
              <option key={one.id} value={one.id}>{one.label}</option>
            ))}
          </SelectInput>
        </label>
        {monthMatters && (
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Month
            </span>
            <SelectInput
              id="declaration-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-28"
            >
              {MONTHS.map((name, at) => (
                <option key={name} value={String(at + 1)}>{name}</option>
              ))}
            </SelectInput>
          </label>
        )}
        <label className="block">
          <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Day
          </span>
          <TextInput
            id="declaration-day"
            inputMode="numeric"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="w-20"
          />
        </label>
      </div>
      {/* Said where it is chosen rather than only in the dialog's own blurb: the 31st, stepped quarterly,
          is the end of every quarter, and that is the whole reason the day is a day of the year. */}
      <p className="text-xs text-ink-muted">
        {cadence === "MONTHLY"
          ? "Every month, on that day — the last of the month where the month is too short for it."
          : "A day the month is too short for falls on that month's last, so the 31st every three months "
            + "is the end of each quarter."}
      </p>
      {refused && <Alert tone="danger">{refused.message}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={set.isPending}>
          {set.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
