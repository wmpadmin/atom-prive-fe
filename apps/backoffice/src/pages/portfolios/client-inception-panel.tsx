import { ApiError } from "@atomprive/api-client";
import {
  getListClientCashflowsQueryKey,
  getListClientReturnsQueryKey,
  useListClientCashflows,
  useSetClientInception,
  type CashflowList,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asDate } from "./inception";

/** As far back as a start date may be put. A firm older than this is not one this screen is correcting. */
function yearsAgo(years: number) {
  const then = new Date();
  then.setFullYear(then.getFullYear() - years);
  return then;
}

/**
 * The day the firm started managing this client's money, and the one rule that follows from it.
 *
 * <p>Every client's figures begin somewhere, and until somebody says where, nothing can tell a day the
 * firm was managing the money from a day it wasn't. Money dated before that day moved somewhere else —
 * at another firm, or on a day somebody mistyped — and left on the record it bends every return that
 * crosses it while looking exactly like a figure anybody could trust.
 *
 * <p>Said here rather than asked for, and through no approval queue, because the date changes nothing the
 * client holds: not a rupee moves between anything, and nobody is being asked to agree to a statement of
 * what the client has. What it does is narrow what may be written next.
 *
 * <p>Changing it afterwards is refused by the server where something already sits before the new day,
 * which is the only way it could ever strand a figure. Unsaying it is allowed, because a date typed
 * wrongly would otherwise refuse every earlier figure for ever with no way back.
 */
export function ClientInceptionPanel({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const listed = useListClientCashflows<CashflowList, ApiError>(customerId);
  const saved = listed.data?.inceptionOn ?? null;
  const [editing, setEditing] = useState(false);
  // What is on file is what the field opens on, so somebody moving a date by a day doesn't type it
  // again. Set where the editing starts rather than kept in step with the server afterwards: a date
  // half-typed when somebody else's save landed would otherwise be wiped under the cursor.
  const [on, setOn] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  function done() {
    setEditing(false);
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getListClientCashflowsQueryKey(customerId) });
    // Since inception is a window this date names, so every return is a stale read the moment it moves.
    void queryClient.invalidateQueries({ queryKey: getListClientReturnsQueryKey(customerId) });
  }
  const set = useSetClientInception<ApiError>({
    mutation: { onSuccess: done, onError: (caught: ApiError) => setErrors(toFormErrors(caught)) },
  });

  function save(inceptionOn: string | null) {
    setErrors(noErrors);
    set.mutate({ customerId, data: { inceptionOn } });
  }

  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Since when</h2>
          <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
            The day the firm started managing this client's money. Nothing about the portfolio can be
            dated before it, so money that moved at another firm cannot be written down here as something
            this one earned.
          </p>
        </div>
        {!editing && (
          <div className="ml-auto flex items-end gap-3">
            <p className="text-sm text-ink">
              {listed.isPending ? (
                <span className="text-ink-muted">Reading…</span>
              ) : saved ? (
                <span className="font-medium tabular-nums">{saved}</span>
              ) : (
                <span className="text-amber-700">Nobody has said yet</span>
              )}
            </p>
            <Button size="sm" variant="secondary"
              onClick={() => { setErrors(noErrors); setOn(saved ?? ""); setEditing(true); }}>
              {saved ? "Change it" : "Say when"}
            </Button>
          </div>
        )}
      </div>

      {errors.form && <div className="mt-3"><Alert tone="danger">{errors.form}</Alert></div>}
      {errors.fields.inceptionOn && (
        <div className="mt-3"><Alert tone="danger">{errors.fields.inceptionOn}</Alert></div>
      )}

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              The day it started
            </span>
            <span className="mt-1 block w-44">
              <DateInput id="inception-on" name="inceptionOn" value={on}
                min={yearsAgo(40)} max={new Date()}
                aria-invalid={Boolean(errors.fields.inceptionOn)}
                onChange={(next) => setOn(next ?? "")} />
            </span>
          </label>
          <Button size="sm" disabled={on === "" || set.isPending} onClick={() => save(on)}>
            {set.isPending ? "Saving…" : "Save it"}
          </Button>
          {/* A date typed wrongly refuses every earlier figure until it is taken back off, so taking it
              back off has to be one button rather than a trip to whoever holds the database. */}
          {saved && (
            <Button size="sm" variant="secondary" disabled={set.isPending} onClick={() => save(null)}>
              Unsay it
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={set.isPending}
            onClick={() => { setEditing(false); setOn(saved ?? ""); setErrors(noErrors); }}>
            Cancel
          </Button>
        </div>
      )}

      {saved && !editing && asDate(saved) && (
        <p className="mt-2 text-xs text-ink-muted">
          Money and valuations before {saved} are refused, here and everywhere else they are written.
        </p>
      )}
    </section>
  );
}
