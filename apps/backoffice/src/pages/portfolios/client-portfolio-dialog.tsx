import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useListModelPortfolios,
  useRecordRebalance,
  useRecordReview,
  useSetClientHoldings,
  useSetClientModelPortfolio,
  type ModelsPage,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, SelectInput, TextInput, describedBy } from "@atomprive/ui";
import { useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { ClassStandingTable } from "./class-standing-table";
import { ClientHoldingsPanel } from "./client-holdings-panel";
import { asFigure } from "../../lib/figures";
import { useAssetClasses } from "./asset-classes";

/** A box per class, keyed by code, since which classes there are is the firm's to decide. */
type Held = Record<string, string>;

/**
 * The boxes as they start: a blank for every class still in use, plus anything the client is already counted
 * under. A class the firm has retired is shown while a figure sits in it, because it has to be movable; it is
 * simply not offered on a portfolio that has nothing in it.
 */
function heldFrom(standing: PortfolioStanding | undefined, codes: string[]): Held {
  const typed: Held = {};
  for (const assetClass of codes) typed[assetClass] = "";
  for (const [assetClass, value] of Object.entries(standing?.holdings ?? {})) {
    typed[assetClass] = String(value);
  }
  return typed;
}

/** Today, as the calendar writes it, so a rebalance can be dated today but no later. */
function today() {
  const day = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/**
 * A client's portfolio: the model it is measured against, what it holds, and when it was last put back.
 *
 * <p>Holdings are written down by hand. No custodian feed delivers them yet; when one does it writes the same
 * figures, and this stays as the way to correct them.
 */
export function ClientPortfolioDialog({
  customerId,
  clientName,
  onClose,
  onSaved,
}: {
  customerId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const assetClasses = useAssetClasses();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [held, setHeld] = useState<Held | null>(null);
  const [rebalancedOn, setRebalancedOn] = useState<string | null>(null);
  const [reviewedOn, setReviewedOn] = useState<string | null>(null);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const kept = () => {
    setErrors(noErrors);
    void standing.refetch();
    onSaved();
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const setHoldings = useSetClientHoldings<ApiError>({ mutation: { onSuccess: kept, onError } });
  const rebalanced = useRecordRebalance<ApiError>({ mutation: { onSuccess: kept, onError } });
  const reviewed = useRecordReview<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = setModel.isPending || setHoldings.isPending || rebalanced.isPending || reviewed.isPending;

  // The boxes start from what is on file, and stay as they are typed from then on.
  const boxes = classesShown(assetClasses, standing.data);
  const holdings = held ?? heldFrom(standing.data, boxes);
  const on = rebalancedOn ?? standing.data?.lastRebalancedOn ?? "";
  const looked = reviewedOn ?? standing.data?.lastReviewedOn ?? "";
  const total = Object.values(holdings).reduce((sum, typed) => sum + (Number(typed) || 0), 0);

  function save() {
    const wanted: Record<string, number> = {};
    for (const [assetClass, typed] of Object.entries(holdings)) {
      if (typed.trim()) wanted[assetClass] = Number(typed);
    }
    setHoldings.mutate({ customerId, data: { holdings: wanted, currency: standing.data?.currency ?? "USD" } });
  }

  return (
    <Dialog open title={`${clientName}'s portfolio`} size="lg" onClose={onClose}>
      <div className="space-y-5">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}

        <Field id="client-model" label="Measured against">
          <SelectInput
            id="client-model"
            value={standing.data?.modelPortfolioId ?? ""}
            disabled={busy}
            onChange={(event) =>
              setModel.mutate({ customerId, data: { modelPortfolioId: event.target.value || null } })
            }
          >
            <option value="">No model — nothing to drift from</option>
            {(models.data?.items ?? []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What they hold, in {standing.data?.currency ?? "USD"}
          </legend>
          <p className="mt-1 text-xs text-ink-muted">
            Written down by hand: no custodian feed delivers these yet. A class listed holding by holding
            below takes its total from those holdings, so its figure here is worked out rather than typed.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boxes.map((assetClass) => (
              <Field
                key={assetClass}
                id={`holding-${assetClass}`}
                label={assetClasses.names[assetClass] ?? assetClass}
              >
                <TextInput
                  {...describedBy(`holding-${assetClass}`, errors.fields.holdings)}
                  id={`holding-${assetClass}`}
                  inputMode="decimal"
                  value={holdings[assetClass]}
                  onChange={(event) =>
                    setHeld({ ...holdings, [assetClass]: asFigure(event.target.value, holdings[assetClass]) })
                  }
                />
              </Field>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {total > 0 ? `Adds up to ${total.toLocaleString()}.` : "Nothing written down yet."}
            </p>
            <Button size="sm" disabled={busy} onClick={save}>
              {setHoldings.isPending ? "Saving…" : "Save the holdings"}
            </Button>
          </div>
        </fieldset>

        <ClientHoldingsPanel customerId={customerId} onChanged={kept} />

        {standing.data && standing.data.classes.length > 0 && (
          <section>
            <h3 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Against the model
            </h3>
            <div className="mt-2">
              <ClassStandingTable
                classes={standing.data.classes}
                currency={standing.data.currency}
                underManagement={standing.data.underManagement}
              />
            </div>
          </section>
        )}

        <Field id="rebalanced-on" label="Last put back to the model" error={errors.fields.on}>
          <div className="flex items-end gap-2">
            <DateInput
              id="rebalanced-on"
              name="rebalancedOn"
              value={on}
              min={yearsAgo(20)}
              max={today()}
              onChange={setRebalancedOn}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !on}
              onClick={() => rebalanced.mutate({ customerId, data: { on } })}
            >
              {rebalanced.isPending ? "Recording…" : "Record it"}
            </Button>
          </div>
        </Field>

        {/* Reading the file is not the same as putting it back: a review can end in doing nothing at all. */}
        <Field
          id="reviewed-on"
          label="Last looked at"
          hint={
            standing.data?.lastReviewedOn
              ? standing.data.reviewOverdue
                ? "Due another look."
                : `Next due ${standing.data.reviewDueOn ?? ""}.`
              : "Nobody has read this file yet."
          }
          error={errors.fields.on}
        >
          <div className="flex items-end gap-2">
            <DateInput
              id="reviewed-on"
              name="reviewedOn"
              value={looked}
              min={yearsAgo(20)}
              max={today()}
              onChange={setReviewedOn}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !looked}
              onClick={() => reviewed.mutate({ customerId, data: { on: looked } })}
            >
              {reviewed.isPending ? "Recording…" : "Record it"}
            </Button>
          </div>
        </Field>

        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Which classes get a box: the ones the firm still uses, plus any retired one this client is already counted
 * under — that figure has to be movable, and a box that never appears is a figure nobody can take out.
 */
function classesShown(
  assetClasses: ReturnType<typeof useAssetClasses>,
  standing: PortfolioStanding | undefined,
): string[] {
  const held = new Set(Object.keys(standing?.holdings ?? {}));
  return assetClasses.all
    .filter((one) => one.retiredAt === null || held.has(one.code))
    .map((one) => one.code);
}
