import { ApiError } from "@atomprive/api-client";
import {
  getListModelPortfoliosQueryKey,
  useCopyModelPortfolio,
  useCreateModelPortfolio,
  useDeleteModelPortfolio,
  useListModelPortfolios,
  type ModelRow,
  type ModelsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, IconButton, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { ModelDialog } from "./model-dialog";
import { formatRelative } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  averageDriftLabel,
  modelStatusLabels,
  modelStatusTones,
  underManagementLabel,
  type ModelStatus,
  riskProfileLabel,
} from "./portfolio-labels";

export function ModelPortfoliosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const { all } = useAssetClasses();
  // Every class, not only those still in use: a model written before one was retired still targets it, and a
  // bar that quietly left the slice out would show a plan that no longer came to 100%.
  const codes = all.map((one) => one.code);
  // The same thing the API asks for before it writes one, so nobody is offered a button that refuses
  // them. Writing a model and changing one are held to one permission there, and so to one here.
  const canWrite = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const [writing, setWriting] = useState(false);
  const [removing, setRemoving] = useState<ModelRow | null>(null);
  /** The model being copied, and what the copy is to be called. */
  const [copying, setCopying] = useState<ModelRow | null>(null);
  const [called, setCalled] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [search, setSearch] = useState("");

  function kept() {
    setWriting(false);
    setRemoving(null);
    setCopying(null);
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
  }
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useCreateModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const remove = useDeleteModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const copy = useCopyModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = create.isPending || remove.isPending || copy.isPending;

  if (models.isError) {
    return <Alert tone="danger">{models.error.message}</Alert>;
  }
  const rows = models.data?.items ?? [];
  const looking = search.trim().toLowerCase();
  const shown = looking
    ? rows.filter((model) =>
        `${model.name} ${model.description ?? ""} ${riskProfileLabel(model.riskProfile)}`.toLowerCase().includes(looking),
      )
    : rows;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model portfolios"
        lead="What a client's money is supposed to be spread across, and how far it may wander before somebody looks."
      >
        {canWrite && (
          <Button
            onClick={() => {
              setErrors(noErrors);
              setWriting(true);
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
          // The whole line opens the plan, not the word Open alone: a row that answers only to its last
          // column reads as a list to be looked at rather than a way through to the plan behind it.
          <tr
            key={model.id}
            onClick={() => void navigate(`/model-portfolios/${model.id}`)}
            className="cursor-pointer border-t border-line hover:bg-slate-50/60"
          >
            <td className="px-5 py-3">
              <p className="font-semibold text-ink">{model.name}</p>
              <div className="mt-1.5 flex h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                {codes.filter((assetClass) => model.targets[assetClass]).map((assetClass) => (
                  <span
                    key={assetClass}
                    className={cn("h-full", barFor(assetClass, all))}
                    style={{ width: `${model.targets[assetClass]}%` }}
                  />
                ))}
              </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">{riskProfileLabel(model.riskProfile)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{model.clients}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {model.aumTracked > 0 ? (
                <span className="font-semibold text-ink">
                  {underManagementLabel(model.aumTracked, model.aumCurrency)}
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
              {/* A client whose currency has no rate on file is missing from the total, so the total says so
                  rather than quietly being short. */}
              {model.aumUnconverted > 0 && (
                <span className="mt-0.5 block text-2xs font-normal text-amber-700">
                  {model.aumUnconverted} not converted
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-ink-soft">v{model.revision}</td>
            <td
              className={cn(
                "px-4 py-3 text-right font-semibold whitespace-nowrap",
                // Past what is allowed, not level with it — the rule everywhere else. At exactly the
                // breach figure a model was drawn in red while every screen that asked the API called the
                // same drift sound.
                model.averageDrift == null
                  ? "text-ink-muted"
                  : model.averageDrift > model.breachAt
                    ? "text-red-600"
                    : model.averageDrift > model.watchAt
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
            {/* Stops the row opening underneath it: the line is a way through to the plan, and a press
                meant for the copy is not a press meant for the plan. */}
            <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
              {canWrite && (
                <IconButton
                  label={`Make a copy of ${model.name}`}
                  onClick={() => {
                    setErrors(noErrors);
                    setCopying(model);
                    setCalled(`Copy of ${model.name}`);
                  }}
                >
                  <Copy aria-hidden="true" className="size-4" />
                </IconButton>
              )}
            </td>
          </tr>
        ))}
      </RecordList>

      {/* Writing one only. Changing a model is opened from the model's own page, which has to ask for a
          sign-off before it writes: every client on a live plan is measured by it, so a change to one is
          answered by somebody rather than typed. A model nobody is on yet has nobody to answer for. */}
      {writing && (
        <ModelDialog
          model={null}
          errors={errors}
          busy={busy}
          onClose={() => setWriting(false)}
          onSave={(data) => create.mutate({ data })}
        />
      )}

      {/* Most models the firm writes are a model it already has with two things changed. Typed again
          from an empty form, every target, every band and every line inside every class is entered a
          second time. */}
      <Dialog
        open={copying !== null}
        title={copying ? `Make a copy of ${copying.name}?` : "Make a copy?"}
        onClose={() => setCopying(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            The copy takes everything this plan says — its targets, its bands, and the lines inside each
            class. It arrives as a draft with nobody on it, so it can be changed before anybody is
            measured against it. {copying?.name} is left exactly as it is.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field id="copy-name" label="What the copy is called" error={errors.fields.name} required>
            <TextInput
              id="copy-name"
              value={called}
              aria-invalid={Boolean(errors.fields.name)}
              onChange={(event) => setCalled(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCopying(null)}>Cancel</Button>
            <Button
              disabled={called.trim() === "" || busy}
              onClick={() => copying && copy.mutate({ id: copying.id, data: { name: called.trim() } })}
            >
              {copy.isPending ? "Copying…" : "Make the copy"}
            </Button>
          </div>
        </div>
      </Dialog>

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

