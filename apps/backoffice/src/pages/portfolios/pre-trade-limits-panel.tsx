import { ApiError } from "@atomprive/api-client";
import {
  useListPreTradeLimits,
  useSetPreTradeLimits,
  type PreTradeLimitRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, TextInput, describedBy } from "@atomprive/ui";
import { useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

/**
 * The firm's hard ceiling per asset class, checked before a trade order goes anywhere.
 *
 * <p>Its own panel with its own Save, because it is its own record: the rest of this screen is one row of
 * defaults, and these are a row per class that the firm adds to and takes away from.
 *
 * <p>Left empty, nothing is checked. That is the honest starting state — a ceiling the platform invented
 * would be flagging trades on a judgement nobody here is qualified to make.
 */
export function PreTradeLimitsPanel({ mayChange }: { mayChange: boolean }) {
  const limits = useListPreTradeLimits<PreTradeLimitRow[], ApiError>();
  const [typed, setTyped] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [saved, setSaved] = useState(false);
  const set = useSetPreTradeLimits<ApiError>({
    mutation: {
      onSuccess: () => {
        setTyped(null);
        setErrors(noErrors);
        setSaved(true);
        void limits.refetch();
      },
      onError: (caught: ApiError) => {
        setSaved(false);
        setErrors(toFormErrors(caught));
      },
    },
  });

  const rows = limits.data ?? [];
  // What is on file until somebody types, so the boxes do not empty themselves while the page reloads.
  const onFile: Record<string, string> = Object.fromEntries(
    rows.map((row) => [row.assetClass, row.maxShare == null ? "" : String(row.maxShare)]),
  );
  const shown = typed ?? onFile;
  const changed = typed !== null && JSON.stringify(typed) !== JSON.stringify(onFile);
  const capped = rows.filter((row) => row.maxShare != null).length;

  function save() {
    // A box left empty is a class the firm does not cap, which is how a ceiling is taken off again.
    const wanted: Record<string, number> = {};
    for (const [assetClass, value] of Object.entries(shown)) {
      if (value.trim()) wanted[assetClass] = Number(value);
    }
    set.mutate({ data: { limits: wanted } });
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Pre-trade limits</h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            The most of a portfolio the firm will let sit in a class, whatever that client's model says. An
            order that would take a class past its ceiling is flagged to Compliance — it is never refused,
            because whether to place it is their judgement and not the platform's.
          </p>
        </div>
        {capped > 0 && (
          <p className="text-xs text-ink-muted">
            {capped} of {rows.length} capped
          </p>
        )}
      </div>

      {/* Said plainly rather than left to be worked out from a screen of empty boxes. */}
      {!limits.isPending && capped === 0 && !changed && (
        <div className="mt-4">
          <Alert tone="info">
            Nothing is capped, so no order is checked. Put a figure against a class to start checking it.
          </Alert>
        </div>
      )}
      {errors.form && (
        <div className="mt-4">
          <Alert tone="danger">{errors.form}</Alert>
        </div>
      )}
      {errors.fields.limits && (
        <div className="mt-4">
          <Alert tone="danger">{errors.fields.limits}</Alert>
        </div>
      )}
      {saved && !changed && (
        <div className="mt-4">
          <Alert tone="success">Saved. Every open order is read against these from now on.</Alert>
        </div>
      )}

      {limits.isPending ? (
        <p className="mt-4 text-sm text-ink-muted">Reading the firm's limits…</p>
      ) : (
        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <label key={row.assetClass} className="min-w-0">
              <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {row.assetClassName}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <TextInput
                  inputMode="decimal"
                  placeholder="Not capped"
                  disabled={!mayChange}
                  value={shown[row.assetClass] ?? ""}
                  {...describedBy(`limit-${row.assetClass}`, errors.fields.limits)}
                  onChange={(event) =>
                    setTyped({ ...shown, [row.assetClass]: event.target.value.replace(/[^0-9.]/g, "") })
                  }
                />
                <span className="shrink-0 text-sm text-ink-muted">%</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {mayChange && (
        <div className="mt-5 flex items-center justify-end gap-3">
          {changed && (
            <Button variant="secondary" onClick={() => setTyped(null)}>
              Discard
            </Button>
          )}
          <Button disabled={!changed || set.isPending} onClick={save}>
            {set.isPending ? "Saving…" : "Save the limits"}
          </Button>
        </div>
      )}
    </section>
  );
}
