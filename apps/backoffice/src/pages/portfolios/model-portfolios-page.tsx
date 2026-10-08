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
import { Alert, Badge, Button, Dialog, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
} from "./portfolio-labels";

export function ModelPortfoliosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const { all } = useAssetClasses();
  // Every class, not only those still in use: a model written before one was retired still targets it, and a
  // bar that quietly left the slice out would show a plan that no longer came to 100%.
  const codes = all.map((one) => one.code);
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
            <td className="px-4 py-3 whitespace-nowrap">{model.riskProfile}</td>
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

