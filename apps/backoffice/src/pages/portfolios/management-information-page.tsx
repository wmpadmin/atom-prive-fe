import { ApiError } from "@atomprive/api-client";
import { useGetManagementInformation, type ManagementFigures } from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { useBookPanel } from "../../components/book-panel";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import type { FigureDetail } from "../client-workspace/figure-panel";
import { ModelClients } from "./book-panel-lists";
import { underManagementLabel } from "./portfolio-labels";

const workspace = (customerId: string) => `/client-workspace/${customerId}`;

/**
 * The firm's own figures, for the partners rather than for the working day: how much, which way it is
 * moving, and how busy. Read only — nothing on this screen changes a client.
 */
export function ManagementInformationPage() {
  const figures = useGetManagementInformation<ManagementFigures, ApiError>();
  // Read off the figures before the two returns below, because usePagedRows is a hook and a hook cannot be
  // called on only some of a component's renders. Optional chaining carries it while nothing is counted yet.
  const byModel = figures.data?.byModel ?? [];
  const paged = usePagedRows(byModel);
  const panel = useBookPanel();

  if (figures.isError) return <Alert tone="danger">{figures.error.message}</Alert>;
  if (!figures.data) {
    return <p className="py-10 text-center text-sm text-ink-muted">Counting…</p>;
  }
  const { underModels, currency, clientsOnAModel, clientsAltogether, rebalancedThisMonth, quarter, asOf } =
    figures.data;
  const withoutAPlan = clientsAltogether - clientsOnAModel;
  const asAt = `As at ${formatDate(asOf)}, in ${currency}.`;
  const open = panel ? (name: string, figure: FigureDetail) => () => panel({ name, figure }) : undefined;
  const modelShares = { shape: "shares" as const, items: byModel.map((row) => ({ name: row.modelName, value: row.assets })) };
  const modelTable = (title: string): FigureDetail["table"] => ({
    title,
    columns: ["Model", "Clients", "Value", "Share"],
    rows: byModel.map((row) => [row.modelName, row.clients, underManagementLabel(row.assets, currency), `${row.share.toFixed(0)}%`]),
    links: byModel.map((row) => `/model-portfolios/${row.modelPortfolioId}`),
  });
  const quarterFigure: FigureDetail = {
    label: "Money moved",
    value: signed(quarter.net, currency),
    note: `Paid in less taken out, ${formatDate(quarter.from)} to ${formatDate(quarter.to)}, in ${currency}. Totals only: these figures carry no per-client flows, so the clients behind them are not listed.`,
    facts: [
      { label: "Paid in", value: `+${underManagementLabel(quarter.paidIn, currency)}` },
      { label: "Taken out", value: `−${underManagementLabel(quarter.takenOut, currency)}` },
      { label: "Net", value: signed(quarter.net, currency) },
    ],
    chart: { title: "Paid in and taken out", kind: "bar", format: "money", currency,
      data: { shape: "series", categories: ["Paid in", "Taken out"], series: [{ name: "This quarter", values: [quarter.paidIn, quarter.takenOut] }] } },
  };
  const openModel = (row: (typeof byModel)[number]) => panel?.({ name: row.modelName, figure: {
    label: "Model",
    value: underManagementLabel(row.assets, currency),
    note: `What the clients on ${row.modelName} hold, ${row.share.toFixed(0)}% of everything under models. ${asAt}`,
    facts: [
      { label: "Clients", value: String(row.clients) },
      { label: "Share", value: `${row.share.toFixed(0)}%` },
    ],
    link: { to: `/model-portfolios/${row.modelPortfolioId}`, label: "Open the model" },
    more: <ModelClients modelId={row.modelPortfolioId} linkFor={workspace} />,
  } });

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="MIS"
        lead={`The firm, not a client. How much, which way it is moving, and how busy. As at ${formatDate(asOf)}, in ${currency}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Under models" value={underManagementLabel(underModels, currency)}
          onClick={open?.("Under models", {
            label: "MIS",
            value: underManagementLabel(underModels, currency),
            note: `What every client on a model holds, added up. ${asAt}`,
            facts: [
              { label: "Models in use", value: String(byModel.length) },
              { label: "Clients on a model", value: String(clientsOnAModel) },
            ],
            chart: byModel.length > 0 ? { title: "Assets by model", data: modelShares, kind: "donut", format: "money", currency } : undefined,
            table: modelTable("The models behind it"),
          })} />
        <Tile
          label="Net in this quarter"
          value={signed(quarter.net, currency)}
          tone={quarter.net < 0 ? "bad" : quarter.net > 0 ? "good" : undefined}
          onClick={open?.("Net in this quarter", quarterFigure)}
        />
        <Tile label="Clients on a model" value={`${clientsOnAModel} / ${clientsAltogether}`}
          onClick={open?.("Clients on a model", {
            label: "MIS",
            value: `${clientsOnAModel} / ${clientsAltogether}`,
            note: `Clients measured against a model, out of all clients. ${asAt}`,
            facts: [
              { label: "On a model", value: String(clientsOnAModel) },
              { label: "On no model", value: String(withoutAPlan) },
              { label: "All clients", value: String(clientsAltogether) },
            ],
            chart: { title: "Clients on and off a model", kind: "donut", format: "number",
              data: { shape: "shares", items: [{ name: "On a model", value: clientsOnAModel }, { name: "On no model", value: withoutAPlan }] } },
            table: modelTable("Clients by model"),
          })} />
        <Tile label="Rebalances this month" value={String(rebalancedThisMonth)}
          onClick={open?.("Rebalances this month", {
            label: "MIS",
            value: String(rebalancedThisMonth),
            note: "Portfolios recorded as put back to their model this month. The figure is a count only: it names no clients and no trades.",
            link: { to: "/bulk-rebalancing", label: "Open bulk rebalancing" },
          })} />
      </div>

      {/* The deck calls this the number to watch, so it is said in words and not left to be subtracted. */}
      {withoutAPlan > 0 && (
        <Alert tone="warning">
          {withoutAPlan === 1 ? "One client sits" : `${withoutAPlan} clients sit`} on no model. Nothing can
          drift and nothing can deviate for them, so they are invisible to every other screen here. That gap is
          a management question, not a technical one.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-line bg-white">
          <div className="px-6 pt-5">
            <h2 className="text-base font-bold">Assets by model</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Biggest first. Only the plans somebody is actually on.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2.5 pr-4 pl-6">Model</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Clients</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Value</th>
                  <th scope="col" className="py-2.5 pr-6 pl-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byModel.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-ink-muted">
                      No client is on a model yet.
                    </td>
                  </tr>
                )}
                {paged.shown.map((row) => (
                  <tr key={row.modelPortfolioId} className={panel ? "cursor-pointer hover:bg-canvas" : undefined}
                    onClick={panel ? () => openModel(row) : undefined}
                    onKeyDown={panel ? (event) => { if (event.key === "Enter") openModel(row); } : undefined}
                    tabIndex={panel ? 0 : undefined}>
                    <th scope="row" className="py-3 pr-4 pl-6 text-left font-semibold">
                      {row.modelName}
                      {/* The share drawn under the name, so the shape of the book reads without arithmetic. */}
                      <span aria-hidden="true" className="mt-1.5 block h-1 w-40 max-w-full rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-primary-600"
                          style={{ width: `${Math.min(row.share, 100)}%` }}
                        />
                      </span>
                    </th>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-ink-soft">{row.clients}</td>
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
                      {underManagementLabel(row.assets, currency)}
                    </td>
                    <td className="py-3 pr-6 pl-4 text-right align-top font-semibold tabular-nums">
                      {row.share.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Outside the scrolling box, so the way through the list does not slide sideways with the
              columns. Each row's share is the server's own figure against the whole book, so it reads the
              same whichever page is open. */}
          <PagedFooter paged={paged} noun={["model", "models"]} />
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-base font-bold">Money moved</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            This quarter: {formatDate(quarter.from)} to {formatDate(quarter.to)}.
          </p>
          <dl className="mt-4 divide-y divide-line">
            <Moved label="Paid in" value={quarter.paidIn} currency={currency} sign="+" tone="good"
              onClick={open?.("Paid in this quarter", { ...quarterFigure, value: `+${underManagementLabel(quarter.paidIn, currency)}` })} />
            <Moved label="Taken out" value={quarter.takenOut} currency={currency} sign="−" tone="bad"
              onClick={open?.("Taken out this quarter", { ...quarterFigure, value: `−${underManagementLabel(quarter.takenOut, currency)}` })} />
            <Moved label="Net" value={Math.abs(quarter.net)} currency={currency} sign={quarter.net < 0 ? "−" : "+"} strong
              onClick={open?.("Net in this quarter", quarterFigure)} />
          </dl>
          {/* Nothing records what a rebalance actually traded, so the figure is not invented. */}
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            What rebalances traded is not here: the platform records the day a portfolio was put back to its
            model, not the trades it took to do it.
          </p>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, onClick }: { label: string; value: string; tone?: "good" | "bad"; onClick?: () => void }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white px-5 py-4", onClick && "cursor-pointer hover:border-primary-300")}
      {...clickable(onClick)}>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "bad" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Moved({
  label,
  value,
  currency,
  sign,
  tone,
  strong = false,
  onClick,
}: {
  label: string;
  value: number;
  currency: string;
  sign: string;
  tone?: "good" | "bad";
  strong?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2.5", onClick && "cursor-pointer hover:bg-canvas")}
      {...clickable(onClick)}>
      <dt className={cn("text-sm", strong ? "font-semibold text-ink" : "text-ink-soft")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-bold" : "text-sm font-medium",
          tone === "bad" ? "text-rose-700" : tone === "good" ? "text-emerald-700" : "text-ink",
        )}
      >
        {sign}
        {underManagementLabel(value, currency)}
      </dd>
    </div>
  );
}

/** A net figure carries its direction: money leaving the firm is not the same news as money arriving. */
function signed(net: number, currency: string) {
  return `${net < 0 ? "−" : "+"}${underManagementLabel(Math.abs(net), currency)}`;
}

/** What makes a tile or a line open the side panel: a button to the keyboard as well as to the mouse. */
function clickable(onClick?: () => void) {
  return onClick ? {
    role: "button" as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (event: { key: string }) => { if (event.key === "Enter") onClick(); },
  } : {};
}
