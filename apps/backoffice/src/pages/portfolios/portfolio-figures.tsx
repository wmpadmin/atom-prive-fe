import { ApiError } from "@atomprive/api-client";
import {
  useGetClientPortfolio,
  useListRebalancing,
  type BulkRebalancing,
  type ClassStanding,
  type ClientRebalance,
  type PortfolioStanding,
} from "@atomprive/api-client/backoffice";
import { Alert } from "@atomprive/ui";
import { FigureBody } from "../client-workspace/figure-panel";
import { ClassStandingTable } from "./class-standing-table";
import { clientsTable } from "./figure-opens";
import { driftLabel, standingLabels } from "./portfolio-labels";

/** A model's clients, read when the panel opens, with how each stands against the plan. */
export function ModelClientsMore({ modelId }: { modelId: string }) {
  const read = useListRebalancing<BulkRebalancing, ApiError>(modelId);
  if (read.isPending) return <p className="text-sm text-ink-muted">Reading the clients on this model…</p>;
  if (read.isError) return <Alert tone="danger">{read.error.message}</Alert>;
  if (read.data.clients.length === 0) return <p className="text-sm text-ink-muted">Nobody is measured against this model yet.</p>;
  return <FigureBody figure={{ label: "", table: clientsTable(read.data.clients, "Clients on this model") }} wide={false} />;
}

/** How each of a model's clients stands in one class, read when the panel opens. */
export function ModelClassMore({ modelId, assetClass, className }: { modelId: string; assetClass: string; className: string }) {
  const read = useListRebalancing<BulkRebalancing, ApiError>(modelId);
  if (read.isPending) return <p className="text-sm text-ink-muted">Reading the clients on this model…</p>;
  if (read.isError) return <Alert tone="danger">{read.error.message}</Alert>;
  const lines = read.data.clients
    .map((client) => ({ client, line: client.classes.find((one: ClassStanding) => one.assetClass === assetClass) }))
    .filter((one): one is { client: ClientRebalance; line: ClassStanding } => one.line !== undefined);
  if (lines.length === 0) return <p className="text-sm text-ink-muted">No client on this model has a reading in {className} yet.</p>;
  return (
    <FigureBody wide={false} figure={{
      label: "",
      table: {
        title: `Clients in ${className}`,
        columns: ["Client", "Target", "Held", "Drift", "Standing"],
        rows: lines.map(({ client, line }) => [
          client.clientName,
          `${line.targetShare.toFixed(2)}%`,
          `${line.actualShare.toFixed(2)}%`,
          driftLabel(line.drift),
          line.standing ? standingLabels[line.standing] : "—",
        ]),
        links: lines.map(({ client }) => `/client-workspace/${client.customerId}`),
      },
    }} />
  );
}

/**
 * A client's portfolio class by class, read when the panel opens. What the screen already holds is drawn until
 * the answer lands, as the trade list does.
 */
export function ClientStandingMore({ customerId, held }: { customerId: string; held?: ClientRebalance }) {
  const read = useGetClientPortfolio<PortfolioStanding, ApiError>(customerId);
  if (read.isError) return <Alert tone="danger">{read.error.message}</Alert>;
  const classes = read.data?.classes ?? held?.classes;
  if (!classes) return <p className="text-sm text-ink-muted">Reading the portfolio…</p>;
  if (classes.length === 0) return <p className="text-sm text-ink-muted">Nothing is held against a plan yet.</p>;
  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Against the model, class by class</h3>
      <div className="rounded-xl border border-line">
        <ClassStandingTable
          classes={classes}
          currency={read.data?.currency ?? held?.currency ?? ""}
          suggestions={read.data ? !read.data.customModel : true}
          underManagement={read.data?.underManagement ?? held?.underManagement ?? 0}
        />
      </div>
    </section>
  );
}
