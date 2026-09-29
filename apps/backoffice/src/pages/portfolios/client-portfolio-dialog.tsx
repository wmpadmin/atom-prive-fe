import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useListModelPortfolios,
  useRecordRebalance,
  useSetClientHoldings,
  useSetClientModelPortfolio,
  type ModelsPage,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, SelectInput, TextInput, describedBy } from "@atomprive/ui";
import { useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { ASSET_CLASSES, assetClassLabels, type AssetClass } from "./portfolio-labels";

type Held = Record<AssetClass, string>;

const NOTHING: Held = { EQUITIES: "", FIXED_INCOME: "", ALTERNATIVES: "", CASH: "" };

function heldFrom(standing: PortfolioStanding | undefined): Held {
  const typed = { ...NOTHING };
  for (const assetClass of ASSET_CLASSES) {
    const value = standing?.holdings[assetClass];
    if (value !== undefined) typed[assetClass] = String(value);
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
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [held, setHeld] = useState<Held | null>(null);
  const [rebalancedOn, setRebalancedOn] = useState<string | null>(null);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const kept = () => {
    setErrors(noErrors);
    void standing.refetch();
    onSaved();
  };
  const setModel = useSetClientModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const setHoldings = useSetClientHoldings<ApiError>({ mutation: { onSuccess: kept, onError } });
  const rebalanced = useRecordRebalance<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = setModel.isPending || setHoldings.isPending || rebalanced.isPending;

  // The boxes start from what is on file, and stay as they are typed from then on.
  const holdings = held ?? heldFrom(standing.data);
  const on = rebalancedOn ?? standing.data?.lastRebalancedOn ?? "";
  const total = ASSET_CLASSES.reduce((sum, assetClass) => sum + (Number(holdings[assetClass]) || 0), 0);

  function save() {
    const wanted: Record<string, number> = {};
    for (const assetClass of ASSET_CLASSES) {
      if (holdings[assetClass].trim()) wanted[assetClass] = Number(holdings[assetClass]);
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
            Written down by hand: no custodian feed delivers these yet.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {ASSET_CLASSES.map((assetClass) => (
              <Field key={assetClass} id={`holding-${assetClass}`} label={assetClassLabels[assetClass]}>
                <TextInput
                  {...describedBy(`holding-${assetClass}`, errors.fields.holdings)}
                  id={`holding-${assetClass}`}
                  inputMode="decimal"
                  value={holdings[assetClass]}
                  onChange={(event) => setHeld({ ...holdings, [assetClass]: event.target.value })}
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

        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
