import type { ApiError } from "@atomprive/api-client";
import {
  useCycle,
  usePutTheCycleBack,
  useSetCycle,
  type DeclarationCycleView,
  type DeclarationCycleViewCadence,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ChoiceCards, type Choice } from "../../components/choice-cards";

/**
 * How often the firm's declarations are wanted, in the firm's own words.
 *
 * <p>One cycle, for all of them. Each declaration used to carry its own, which was nine answers to one
 * question and a compliance calendar nobody could hold in their head.
 *
 * <p>All four shown at once rather than hidden behind a dropdown that opened over the dialog, and each
 * saying which days it lands on — the days are the question somebody opened this to answer, and they are
 * no longer anything to type: the first of the month, of the quarter, of the half, of the year.
 *
 * <p>Opened from the register rather than from Configuration, because the permission that lets somebody
 * chase a declaration is the permission that lets them say how often it is wanted.
 */
const CADENCES: Choice<DeclarationCycleViewCadence>[] = [
  { value: "MONTHLY", label: "Monthly", description: "The 1st, every month" },
  { value: "QUARTERLY", label: "Quarterly", description: "1 Jan, Apr, Jul, Oct" },
  { value: "SIX_MONTHLY", label: "Six-monthly", description: "1 Jan and 1 Jul" },
  { value: "ANNUAL", label: "Yearly", description: "1 Jan" },
];

export function HowOftenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cycle = useCycle<DeclarationCycleView, ApiError>({ query: { enabled: open } });

  return (
    <Dialog
      open={open}
      title="How often the declarations are wanted"
      description="Every declaration, for everybody. Changing it moves every next-due date at once."
      onClose={onClose}
    >
      {cycle.isError && <Alert tone="danger">{cycle.error.message}</Alert>}
      {cycle.isPending ? (
        <p className="text-sm text-ink-muted">Reading the firm's cycle…</p>
      ) : (
        // Keyed on the firm's own answer, so putting the cycle back leaves the cards showing what was
        // put back rather than the choice that was on screen a moment earlier.
        <TheCycle
          key={cycle.data?.cadence}
          now={cycle.data}
          onSaved={() => void cycle.refetch()}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

/** The four of them, with the firm's own ticked. */
function TheCycle({ now, onSaved, onClose }: {
  now: DeclarationCycleView | undefined;
  onSaved: () => void;
  onClose: () => void;
}) {
  const set = useSetCycle<ApiError>({ mutation: { onSuccess: () => { onSaved(); onClose(); } } });
  const back = usePutTheCycleBack<ApiError>({ mutation: { onSuccess: onSaved } });
  const [cadence, setCadence] = useState<DeclarationCycleViewCadence>(now?.cadence ?? "ANNUAL");
  const refused = set.isError ? set.error : back.isError ? back.error : null;
  // Nothing to save until something changes, so Save is a button that means something when it is on.
  const changed = now != null && cadence !== now.cadence;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        set.mutate({ data: { cadence } });
      }}
    >
      <ChoiceCards
        name="declaration-cadence"
        legend="How often"
        value={cadence}
        onChange={setCadence}
        choices={CADENCES}
      />
      {refused && <Alert tone="danger">{refused.message}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Whose answer is in force, so somebody changing it sees what they are leaving. */}
        <p className="text-xs text-ink-muted">
          {now?.setByTheFirm
            ? `Set by ${now.changedByName ?? "the firm"} · was ${now.asShipped}`
            : "As it shipped"}
        </p>
        <div className="ms-auto flex items-center gap-2">
          {now?.setByTheFirm && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={back.isPending}
              onClick={() => back.mutate()}
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Put back
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!changed || set.isPending}>
            {set.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
