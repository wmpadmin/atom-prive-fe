import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  useClientOnThatModel,
  useGetClientPortfolio,
  useListModelPortfolios,
  useSetClientModelPortfolio,
  type ModelRow,
  type ModelsPage,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { ClassStandingTable } from "./class-standing-table";
import { BOX, type StepProps } from "./portfolio-setup-dialog";

/**
 * The plan this client's money is read against, and what it makes of the money just written down.
 *
 * <p>Last, because every figure in the table below is a share of the Net AUM the steps before it worked
 * out: a model asks for thirty per cent of something, and until that something is known it asks for
 * nothing anybody can act on.
 *
 * <p>The table is shown before the model is saved, not after. Picking one is a decision about this client,
 * and the only thing that makes it is seeing what it would do to their money — so it is read first and
 * kept second.
 */
export function ModelStep({ customerId, onDone, onBack }: StepProps) {
  const queryClient = useQueryClient();
  const standing = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [busy, setBusy] = useState(false);
  const put = useSetClientModelPortfolio<ApiError>();

  // Null until somebody picks: whatever they are already on stands until then.
  const [chosen, setChosen] = useState<string | null>(null);
  const on = standing.data?.modelPortfolioId ?? "";
  const model = chosen ?? on;
  // Read against a model they are not on yet, so the table says what it would do before it does it.
  const tryingOn = model !== "" && model !== on;
  const preview = useClientOnThatModel<PortfolioStanding, ApiError>(customerId, tryingOn ? model : "", {
    query: { enabled: tryingOn },
  });
  const read = tryingOn ? preview.data : standing.data;

  // A plan nobody is on yet, and the ones already retired, are not plans to put somebody on.
  const choices = (models.data?.items ?? []).filter(
    (one: ModelRow) => one.status === "LIVE" || one.id === on,
  );

  async function save() {
    setErrors(noErrors);
    setBusy(true);
    try {
      if (model !== on) {
        await put.mutateAsync({ customerId, data: { modelPortfolioId: model || null } });
        await queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) });
      }
      onDone();
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
    finally {
      setBusy(false);
    }
  }

  if (standing.isError) {
    return <Alert tone="danger">{standing.error.message}</Alert>;
  }

  return (
    <div className="flex flex-1 flex-col space-y-6">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor="client-model" className="text-xs font-semibold text-ink-soft">
          Measured against
        </label>
        <SelectInput
          id="client-model"
          className={cn(BOX, "w-auto")}
          value={model}
          onChange={(event) => setChosen(event.target.value)}
        >
          <option value="">No model — nothing to read it against</option>
          {choices.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </SelectInput>
      </div>

      {model === "" && (
        <Alert tone="info">
          Pick a plan to see what it asks of this client&apos;s money. Nothing is saved until you finish.
        </Alert>
      )}

      {tryingOn && preview.isError && <Alert tone="danger">{preview.error.message}</Alert>}

      {model !== "" && read && (
        <section className="rounded-2xl border border-line bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-4 py-2">
            <h2 className="font-semibold text-ink">{read.modelName ?? "This model"}</h2>
            <p className="text-xs text-ink-muted">
              {tryingOn ? "Not saved yet" : "What they are measured against"}
            </p>
          </header>
          <div className="overflow-x-auto">
            <ClassStandingTable
              classes={read.classes}
              currency={read.currency}
              suggestions={!read.customModel}
              underManagement={read.underManagement}
              unwritten={read.unwritten}
            />
          </div>
        </section>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" size="lg" type="button" onClick={onBack}>
          Back
        </Button>
        <Button type="button" size="lg" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : (model === on ? "Done" : "Put them on this plan")}
        </Button>
      </div>
    </div>
  );
}
