import { ApiError } from "@atomprive/api-client";
import { useGetModelPortfolio, type AllocationRow, type ModelDetail } from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  driftLabel,
  modelStatusLabels,
  standingLabels,
  standingTones,
  type DriftStanding,
  type ModelStatus,
} from "./portfolio-labels";

/**
 * One plan read in full. The table is the plan itself — a class, then the lines the committee settled inside
 * it — set against what the money on it is actually doing.
 */
export function ModelDetailPage() {
  const { modelId = "" } = useParams();
  const detail = useGetModelPortfolio<ModelDetail, ApiError>(modelId);
  const assetClasses = useAssetClasses();

  if (detail.isError) return <Alert tone="danger">{detail.error.message}</Alert>;
  if (!detail.data) {
    return <p className="py-10 text-center text-sm text-ink-muted">Reading the plan…</p>;
  }
  const { summary, allocations, composition, revisions, assignedPortfolios, measuredPortfolios } = detail.data;

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
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[1.625rem] font-bold">{summary.name}</h1>
          <Badge tone={summary.status === "LIVE" ? "success" : summary.status === "DRAFT" ? "warning" : "neutral"}>
            v{summary.revision} · {modelStatusLabels[summary.status as ModelStatus].toLowerCase()}
          </Badge>
        </div>
        {summary.description && <p className="mt-1 text-sm text-ink-muted">{summary.description}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-line bg-white">
          <div className="px-6 pt-5">
            <h2 className="text-base font-bold">Target weights &amp; tolerance bands</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {measuredPortfolios === 0
                ? assignedPortfolios === 0
                  ? "No client is measured against this plan yet."
                  : `None of the ${assignedPortfolios} assigned portfolios has holdings written down, so there is nothing to average.`
                : `Actual is the average across ${measuredPortfolios} of ${assignedPortfolios} assigned ${assignedPortfolios === 1 ? "portfolio" : "portfolios"}.`}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-slate-50/60 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2.5 pr-4 pl-6">Allocation level</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Target</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Band</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Actual avg</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Deviation</th>
                  <th scope="col" className="py-2.5 pr-6 pl-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-ink-muted">
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
      <td className="px-4 py-3 text-right whitespace-nowrap font-normal tabular-nums">
        {row.actualAverage === null ? <span className="text-ink-muted">—</span> : percent(row.actualAverage)}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
          row.deviation === null
            ? "text-ink-muted"
            : row.standing === "BREACHED"
              ? "text-rose-700"
              : row.deviation < 0
                ? "text-ink-soft"
                : "text-emerald-700",
        )}
      >
        {row.deviation === null ? "—" : driftLabel(row.deviation)}
      </td>
      <td className="py-3 pr-6 pl-4">
        {row.standing === null ? (
          <span className="text-xs font-normal text-ink-muted">Not measured</span>
        ) : (
          <Badge tone={standingTones[row.standing as DriftStanding]}>
            {standingLabels[row.standing as DriftStanding]}
          </Badge>
        )}
      </td>
    </tr>
  );
}

/** "42.0%" — a plan is written to one place, because a tenth of a point is a real decision. */
function percent(figure: number) {
  return `${figure.toFixed(1)}%`;
}
