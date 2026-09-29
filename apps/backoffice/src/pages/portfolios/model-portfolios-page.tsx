import { ApiError } from "@atomprive/api-client";
import {
  getListModelPortfoliosQueryKey,
  useCreateModelPortfolio,
  useDeleteModelPortfolio,
  useListModelPortfolios,
  useUpdateModelPortfolio,
  type ModelRow,
  type ModelsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextArea, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { formatRelative } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import {
  ASSET_CLASSES,
  assetClassBars,
  assetClassLabels,
  averageDriftLabel,
  modelStatusLabels,
  modelStatusTones,
  underManagementLabel,
  type AssetClass,
  type ModelStatus,
} from "./portfolio-labels";

/** A model as the form holds it: every target typed, so an empty box reads as nothing rather than zero. */
type Targets = Record<AssetClass, string>;

const NO_TARGETS: Targets = { EQUITIES: "", FIXED_INCOME: "", ALTERNATIVES: "", CASH: "" };

function targetsOf(model: ModelRow): Targets {
  const typed = { ...NO_TARGETS };
  for (const assetClass of ASSET_CLASSES) {
    const target = model.targets[assetClass];
    if (target !== undefined) typed[assetClass] = String(target);
  }
  return typed;
}

function adds(targets: Targets) {
  return ASSET_CLASSES.reduce((total, assetClass) => total + (Number(targets[assetClass]) || 0), 0);
}

/**
 * The models the firm invests against (#59): what each one targets in every asset class, and how far a
 * portfolio may wander from those targets before somebody should look at it.
 */
export function ModelPortfoliosPage() {
  const queryClient = useQueryClient();
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const canChange = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const [editing, setEditing] = useState<ModelRow | "new" | null>(null);
  const [removing, setRemoving] = useState<ModelRow | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [search, setSearch] = useState("");

  function kept() {
    setEditing(null);
    setRemoving(null);
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
  }
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useCreateModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const update = useUpdateModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const remove = useDeleteModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = create.isPending || update.isPending || remove.isPending;

  if (models.isError) {
    return <Alert tone="danger">{models.error.message}</Alert>;
  }
  const rows = models.data?.items ?? [];
  const looking = search.trim().toLowerCase();
  const shown = looking
    ? rows.filter((model) =>
        `${model.name} ${model.description ?? ""} ${model.riskProfile}`.toLowerCase().includes(looking),
      )
    : rows;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model portfolios"
        lead="What a client's money is supposed to be spread across, and how far it may wander before somebody looks."
      >
        {canChange && (
          <Button
            onClick={() => {
              setErrors(noErrors);
              setEditing("new");
            }}
          >
            <Plus aria-hidden="true" />
            New model
          </Button>
        )}
      </ListPageHeader>

      <RecordList
        caption="Model portfolios"
        subtitle="By name"
        filters={
          <label className="w-full max-w-sm">
            <span className="sr-only">Search models</span>
            <TextInput
              id="model-search"
              value={search}
              placeholder="Search models"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        }
        filtered={search.trim() !== ""}
        onClear={() => setSearch("")}
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">Model</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Risk profile</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Clients</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">AUM tracked</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Revision</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Avg drift</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Last updated</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </>
        }
        columns={9}
        loading={models.isLoading}
        empty={
          shown.length > 0 ? undefined : search.trim() ? (
            "No model matches what you searched for."
          ) : (
            "No model portfolios yet. A client measured against none has nothing to drift from."
          )
        }
        page={0}
        size={shown.length || 1}
        total={0}
        noun={["model", "models"]}
        onPage={() => undefined}
        onSize={() => undefined}
      >
        {shown.map((model) => (
          <tr key={model.id} className="border-t border-line">
            <td className="px-5 py-3">
              <p className="font-semibold text-ink">{model.name}</p>
              {model.description && <p className="text-xs text-ink-muted">{model.description}</p>}
              <div className="mt-1.5 flex h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                {ASSET_CLASSES.filter((assetClass) => model.targets[assetClass]).map((assetClass) => (
                  <span
                    key={assetClass}
                    className={cn("h-full", assetClassBars[assetClass])}
                    style={{ width: `${model.targets[assetClass]}%` }}
                  />
                ))}
              </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">{model.riskProfile}</td>
            <td className="px-4 py-3 text-right tabular-nums">{model.clients}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {model.aumTracked > 0 ? (
                <span className="font-semibold text-ink">{underManagementLabel(model.aumTracked, "USD")}</span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-ink-soft">v{model.revision}</td>
            <td
              className={cn(
                "px-4 py-3 text-right font-semibold whitespace-nowrap",
                model.averageDrift == null
                  ? "text-ink-muted"
                  : model.averageDrift >= model.breachAt
                    ? "text-red-600"
                    : model.averageDrift >= model.watchAt
                      ? "text-amber-700"
                      : "text-emerald-700",
              )}
            >
              {model.averageDrift == null ? "—" : averageDriftLabel(model.averageDrift)}
            </td>
            <td className="px-4 py-3">
              <Badge tone={modelStatusTones[model.status as ModelStatus]}>
                {modelStatusLabels[model.status as ModelStatus]}
              </Badge>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(model.updatedAt)}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {canChange ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setErrors(noErrors);
                      setEditing(model);
                    }}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    Open
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => setRemoving(model)}
                    className="ml-2 text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <span className="text-sm text-ink-muted">Read only</span>
              )}
            </td>
          </tr>
        ))}
      </RecordList>

      {editing && (
        <ModelDialog
          model={editing === "new" ? null : editing}
          errors={errors}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(data) =>
            editing === "new"
              ? create.mutate({ data })
              : update.mutate({ id: editing.id, data })
          }
        />
      )}

      <Dialog open={removing !== null} title="Delete this model?" onClose={() => setRemoving(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {removing?.name} goes for good. A model clients are measured against can't be deleted; take them off
            it first.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => removing && remove.mutate({ id: removing.id })}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ModelDialog({
  model,
  errors,
  busy,
  onClose,
  onSave,
}: {
  model: ModelRow | null;
  errors: FormErrors;
  busy: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string | null;
    riskProfile: string;
    status: ModelStatus;
    targets: Record<string, number>;
    watchAt: number;
    edgeAt: number;
    breachAt: number;
  }) => void;
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [description, setDescription] = useState(model?.description ?? "");
  const [riskProfile, setRiskProfile] = useState(model?.riskProfile ?? "");
  const [status, setStatus] = useState<ModelStatus>((model?.status as ModelStatus) ?? "LIVE");
  const [targets, setTargets] = useState<Targets>(model ? targetsOf(model) : NO_TARGETS);
  const [watchAt, setWatchAt] = useState(String(model?.watchAt ?? 2));
  const [edgeAt, setEdgeAt] = useState(String(model?.edgeAt ?? 4));
  const [breachAt, setBreachAt] = useState(String(model?.breachAt ?? 6));
  const total = adds(targets);

  function submit(event: FormEvent) {
    event.preventDefault();
    const wanted: Record<string, number> = {};
    for (const assetClass of ASSET_CLASSES) {
      if (targets[assetClass].trim()) wanted[assetClass] = Number(targets[assetClass]);
    }
    onSave({
      name,
      description: description.trim() || null,
      riskProfile,
      status,
      targets: wanted,
      watchAt: Number(watchAt),
      edgeAt: Number(edgeAt),
      breachAt: Number(breachAt),
    });
  }

  return (
    <Dialog open title={model ? `Edit ${model.name}` : "New model portfolio"} size="lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="model-name" label="Name" required error={errors.fields.name}>
          <TextInput
            {...describedBy("model-name", errors.fields.name)}
            id="model-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field id="model-description" label="What it is for" error={errors.fields.description}>
          <TextArea
            id="model-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="model-risk" label="Risk profile" required error={errors.fields.riskProfile}>
            <TextInput
              {...describedBy("model-risk", errors.fields.riskProfile)}
              id="model-risk"
              placeholder="Balanced"
              value={riskProfile}
              onChange={(event) => setRiskProfile(event.target.value)}
            />
          </Field>
          <Field id="model-status" label="Status" required error={errors.fields.status}>
            <SelectInput
              id="model-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ModelStatus)}
            >
              <option value="DRAFT">Draft — still being written, nobody is measured against it</option>
              <option value="LIVE">Live — in use</option>
              <option value="RETIRED">Retired — nobody new goes on it</option>
            </SelectInput>
          </Field>
        </div>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Targets — they have to add up to 100%
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {ASSET_CLASSES.map((assetClass) => (
              <Field key={assetClass} id={`target-${assetClass}`} label={assetClassLabels[assetClass]}>
                <TextInput
                  id={`target-${assetClass}`}
                  inputMode="decimal"
                  value={targets[assetClass]}
                  onChange={(event) => setTargets({ ...targets, [assetClass]: event.target.value })}
                />
              </Field>
            ))}
          </div>
          <p className={cn("mt-1.5 text-xs", total === 100 ? "text-ink-muted" : "text-amber-700")}>
            They add up to {total}%.{total === 100 ? "" : " They have to add up to 100%."}
          </p>
          {errors.fields.targets && <p className="mt-1 text-xs text-red-600">{errors.fields.targets}</p>}
        </fieldset>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            How far is too far, in percentage points
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field id="watch-at" label="Worth watching from" error={errors.fields.watchAt}>
              <TextInput id="watch-at" inputMode="decimal" value={watchAt} onChange={(event) => setWatchAt(event.target.value)} />
            </Field>
            <Field id="edge-at" label="At the edge from" error={errors.fields.edgeAt}>
              <TextInput id="edge-at" inputMode="decimal" value={edgeAt} onChange={(event) => setEdgeAt(event.target.value)} />
            </Field>
            <Field id="breach-at" label="Breached from" error={errors.fields.breachAt}>
              <TextInput id="breach-at" inputMode="decimal" value={breachAt} onChange={(event) => setBreachAt(event.target.value)} />
            </Field>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : model ? "Save the model" : "Create the model"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
