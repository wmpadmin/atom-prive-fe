import { ApiError } from "@atomprive/api-client";
import {
  getGetModelPortfolioQueryKey,
  getListModelPortfoliosQueryKey,
  useDeleteModelPortfolio,
  useGetModelPortfolio,
  useAskToEditModel,
  useUpdateModelPortfolio,
  type AllocationRow,
  type ModelDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, PencilLine, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { ModelDialog } from "./model-dialog";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  modelStatusLabels,
  type ModelStatus,
} from "./portfolio-labels";

/**
 * One plan read in full. The table is the plan itself — a class, then the lines the committee settled inside
 * it — set against what the money on it is actually doing.
 */
export function ModelDetailPage() {
  const { modelId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useGetModelPortfolio<ModelDetail, ApiError>(modelId);
  const assetClasses = useAssetClasses();
  // Changing a plan and deleting one are done on the plan, where whoever is doing it can see what they are
  // changing. The list only lists.
  const canChange = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  function kept() {
    setEditing(false);
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getGetModelPortfolioQueryKey(modelId) });
    void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
  }

  const update = useUpdateModelPortfolio<ApiError>({
    mutation: { onSuccess: kept, onError: (caught) => setErrors(toFormErrors(caught)) },
  });
  // A live plan is what every client on it is judged by, so changing it is signed off by a second pair
  // of hands. A draft is a plan still being written and nobody is measured against one.
  const askToEdit = useAskToEditModel<ApiError>({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        setErrors(noErrors);
        setAsked(true);
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });
  /** Whether the last press raised an ask rather than writing, so the page can say so. */
  const [asked, setAsked] = useState(false);
  /** Why it should change, which only a live plan needs and only a live plan shows a box for. */
  const [why, setWhy] = useState("");
  const remove = useDeleteModelPortfolio<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
        void navigate("/model-portfolios");
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });
  const busy = update.isPending || remove.isPending || askToEdit.isPending;

  if (detail.isError) return <Alert tone="danger">{detail.error.message}</Alert>;
  if (!detail.data) {
    return <p className="py-10 text-center text-sm text-ink-muted">Reading the plan…</p>;
  }
  const { summary, allocations, composition, revisions, assignedPortfolios } = detail.data;

  return (
    <div className="space-y-6">
      <header>
        <nav className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link to="/model-portfolios" className="font-medium text-primary-700 hover:underline">
            Model portfolios
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span className="text-ink">{summary.name}</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.625rem] font-bold">{summary.name}</h1>
            <Badge tone={summary.status === "LIVE" ? "success" : summary.status === "DRAFT" ? "warning" : "neutral"}>
              v{summary.revision} · {modelStatusLabels[summary.status as ModelStatus].toLowerCase()}
            </Badge>
          </div>
          {canChange && (
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <PencilLine aria-hidden="true" />
                Edit
              </Button>
              <Button variant="ghost" onClick={() => setRemoving(true)}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </div>
          )}
        </div>
        {summary.description && <p className="mt-1 text-sm text-ink-muted">{summary.description}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-line bg-white">
          <div className="px-6 pt-5">
            <h2 className="text-base font-bold">Target weights &amp; tolerance bands</h2>
            {/* What the plan asks for, and nothing about who is on it: a client's drift moves with their
                money, and reading it here made a fixed plan look like it was moving. */}
            <p className="mt-0.5 text-xs text-ink-muted">
              What this plan asks for. How far any client has wandered from it is on their own portfolio.
              {assignedPortfolios > 0
                && ` ${assignedPortfolios} ${assignedPortfolios === 1 ? "portfolio is" : "portfolios are"} on it.`}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-slate-50/60 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2.5 pr-4 pl-6">Allocation level</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Target allocation</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Band</th>
                  {/* What the clients on this plan are actually holding used to sit here, and reading it on
                      a page named after the model had the plan looking like it moved every time somebody
                      edited a holding. The plan is fixed; drift is a fact about a client, and belongs on
                      the client. */}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-ink-muted">
                      This plan has no targets yet.
                    </td>
                  </tr>
                )}
                {allocations.map((row) => (
                  <Row key={`${row.assetClass}-${row.subClass ?? ""}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-bold">Composition</h2>
            {/* The plan drawn as one bar, in the colours every other screen draws these classes in. */}
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {composition.map((slice) => (
                <span
                  key={slice.assetClass}
                  className={cn("h-full", barFor(slice.assetClass, assetClasses.all))}
                  style={{ width: `${Math.min(slice.target, 100)}%` }}
                />
              ))}
            </div>
            <dl className="mt-4 space-y-2">
              {composition.map((slice) => (
                <div key={slice.assetClass} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 shrink-0 rounded-sm", barFor(slice.assetClass, assetClasses.all))}
                  />
                  <dt className="flex-1 text-ink-soft">{slice.label}</dt>
                  <dd className="font-semibold tabular-nums">{percent(slice.target)}</dd>
                </div>
              ))}
              {composition.length === 0 && <p className="text-sm text-ink-muted">Nothing is targeted yet.</p>}
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-bold">Version history</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              A plan is versioned rather than edited: changing a live plan re-judges every client on it.
            </p>
            <ol className="mt-4 divide-y divide-line">
              {revisions.map((one) => (
                <li key={one.revision} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-ink-soft tabular-nums">
                    v{one.revision}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{one.summary}</span>
                    <span className="block text-xs text-ink-muted">
                      {one.changedBy ?? "Unknown"} · {formatDate(one.changedAt)}
                    </span>
                  </span>
                </li>
              ))}
              {revisions.length === 0 && (
                <li className="py-3 text-sm text-ink-muted">
                  Nothing has been settled on this plan since the platform started keeping a history.
                </li>
              )}
            </ol>
          </section>
        </div>
      </div>
      {/* Said on the page rather than in a notice that fades: nothing about the plan has changed, and a
          reader who pressed Save and saw nothing move would reasonably think the press failed. */}
      {asked && (
        <Alert tone="info">
          Your change is waiting to be signed off. Nothing on this plan has changed yet — it is on{" "}
          <Link to="/model-edits-to-approve" className="font-semibold underline underline-offset-2">
            Model changes to approve
          </Link>
          {" "}until somebody else answers it.
        </Alert>
      )}
      {editing && (
        <ModelDialog
          model={summary}
          errors={errors}
          busy={busy}
          onClose={() => {
            setEditing(false);
            setErrors(noErrors);
          }}
          onSave={(data) => {
            setAsked(false);
            if (summary.status === "LIVE") {
              askToEdit.mutate({ id: modelId, data: { model: data, why: why.trim() } });
            }
            else {
              update.mutate({ id: modelId, data });
            }
          }}
          signOff={summary.status === "LIVE"
            ? { why, onWhy: setWhy, holders: assignedPortfolios }
            : undefined}
        />
      )}

      <Dialog open={removing} title="Delete this model?" onClose={() => setRemoving(false)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {summary.name} goes for good. A model clients are measured against can't be deleted; take them off
            it first.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => remove.mutate({ id: modelId })}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Row({ row }: { row: AllocationRow }) {
  const inside = row.depth > 0;
  return (
    <tr className={cn(inside ? "bg-white" : "bg-white font-semibold")}>
      <th
        scope="row"
        className={cn("py-3 pr-4 text-left", inside ? "pl-12 font-normal text-ink-soft" : "pl-6 text-ink")}
      >
        {row.label}
      </th>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{percent(row.target)}</td>
      {/* The band is the class's, shown on its lines too: tolerance is set per class, not per line. */}
      <td className="px-4 py-3 text-right whitespace-nowrap font-normal tabular-nums text-ink-muted">
        ±{percent(row.band.breachAt)}
      </td>
    </tr>
  );
}

/** "42.0%" — a plan is written to one place, because a tenth of a point is a real decision. */
function percent(figure: number) {
  return `${figure.toFixed(1)}%`;
}
