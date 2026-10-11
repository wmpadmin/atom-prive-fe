import { ApiError } from "@atomprive/api-client";
import {
  useListModelChangesForClient,
  useListModelPortfolios,
  useRequestModelChange,
  useWithdrawModelChange,
  type ModelChangeRow,
  type ModelsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextArea } from "@atomprive/ui";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatDateTime } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

const TONES: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/**
 * Asking for this client to be put on another model, and what has been asked before.
 *
 * <p>An advisor who thinks a client is on the wrong plan had nowhere to say so: a proposal is written for
 * the client and changes nothing here. Asking is not moving — somebody who may move them answers it, and
 * their yes is the move.
 */
export function AskToChangeTheModel({
  customerId,
  onModelId,
  onModelName,
}: {
  customerId: string;
  onModelId: string | null;
  /** What they are on now, so the request reads as a change rather than as a bare choice. */
  onModelName: string;
}) {
  const user = useStaffUser();
  const [asking, setAsking] = useState(false);
  const [wanted, setWanted] = useState("");
  const [why, setWhy] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const asked = useListModelChangesForClient<ModelChangeRow[], ApiError>(customerId);
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const kept = () => {
    setAsking(false);
    setWanted("");
    setWhy("");
    setErrors(noErrors);
    void asked.refetch();
  };
  const raise = useRequestModelChange<ApiError>({
    mutation: { onSuccess: kept, onError: (caught: ApiError) => setErrors(toFormErrors(caught)) },
  });
  const takeBack = useWithdrawModelChange<ApiError>({ mutation: { onSuccess: kept } });

  const history = asked.data ?? [];
  const open = history.find((one) => one.status === "PENDING");
  // A draft cannot be asked for, and neither can the model they are already on.
  const choices = (models.data?.items ?? []).filter(
    (model) => model.status !== "DRAFT" && model.id !== onModelId,
  );

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Changing the model</h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">
            Ask for this client to be measured against a different plan. Whoever may move them answers it,
            and their yes is what moves them.
          </p>
        </div>
        {!open && (
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Ask to change the model
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {open.fromModelName} <span aria-hidden="true" className="mx-1 text-ink-muted">→</span>{" "}
                {open.toModelName}
              </p>
              <p className="mt-1 max-w-prose text-sm text-ink-soft">{open.why}</p>
              <p className="mt-1 text-xs text-ink-muted">
                Asked by {open.raisedByName} · {formatDateTime(open.raisedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="warning">{open.statusLabel}</Badge>
              {/* Taken back by whoever asked, and by nobody else. */}
              {open.raisedBy === user.id && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={takeBack.isPending}
                  onClick={() => takeBack.mutate({ id: open.id })}
                >
                  {takeBack.isPending ? "Taking it back…" : "Take it back"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {history.filter((one) => one.status !== "PENDING").length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {history
            .filter((one) => one.status !== "PENDING")
            .map((one) => (
              <li key={one.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-ink-muted">{one.fromModelName}</span>
                  <span aria-hidden="true" className="mx-1.5 text-ink-muted">→</span>
                  <span className="font-medium">{one.toModelName}</span>
                  <span className="block text-xs text-ink-muted">
                    Asked by {one.raisedByName}
                    {one.decidedByName ? ` · ${one.statusLabel.toLowerCase()} by ${one.decidedByName}` : ""}
                    {one.decisionNote ? ` — ${one.decisionNote}` : ""}
                  </span>
                </span>
                <Badge tone={TONES[one.status] ?? "neutral"}>{one.statusLabel}</Badge>
              </li>
            ))}
        </ul>
      )}

      <Dialog open={asking} title="Ask to change the model" onClose={() => setAsking(false)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            They are on {onModelName} now. Nothing moves until somebody answers this.
          </p>
          <Field id="wanted-model" label="Put them on" error={errors.fields.modelPortfolioId} required>
            <SelectInput id="wanted-model" value={wanted} onChange={(event) => setWanted(event.target.value)}>
              <option value="">Choose a model</option>
              {onModelId !== null && <option value="none">No model — nothing to drift from</option>}
              {choices.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="why-move" label="Why" error={errors.fields.why} required>
            <TextArea
              id="why-move"
              rows={3}
              value={why}
              placeholder="They have told us they want more equity exposure."
              onChange={(event) => setWhy(event.target.value)}
            />
          </Field>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button
              disabled={wanted === "" || why.trim() === "" || raise.isPending}
              onClick={() =>
                raise.mutate({
                  data: {
                    customerId,
                    modelPortfolioId: wanted === "none" ? null : wanted,
                    why: why.trim(),
                  },
                })
              }
            >
              {raise.isPending ? "Asking…" : "Ask"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
