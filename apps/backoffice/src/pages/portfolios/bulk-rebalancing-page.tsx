import { ApiError } from "@atomprive/api-client";
import {
  useDraftFromRebalancing,
  useListModelPortfolios,
  useListRebalancing,
  useRaiseTradeOrdersFromRebalancing,
  useRecordBulkRebalance,
  type BulkDrafted,
  type BulkRebalancing,
  type ClientRebalance,
  type ModelsPage,
  type OrdersRaised,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, DateInput, SelectInput, cn } from "@atomprive/ui";
import { FileSignature, Receipt } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { hasAnyAuthority, RAISES_ORDERS } from "../../lib/permissions";
import { formatDate } from "../../lib/labels";
import { ClassStandingTable } from "./class-standing-table";
import { driftLabel, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";

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
 * Putting a whole model back in one sitting (#R88 in the firm's own sheet: "apply model changes across all
 * clients assigned to a model, generate individualised trade lists").
 *
 * <p>Individualised is the point. A model says what share goes where, not what sum, so the same 30% equities
 * is a different cheque for a client with ten million and one with one. The list is worked down client by
 * client, and what is recorded is that each was put back — the platform never places the trade.
 */
export function BulkRebalancingPage() {
  const [modelId, setModelId] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [on, setOn] = useState<string>(new Date().toISOString().slice(0, 10));

  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const rebalancing = useListRebalancing<BulkRebalancing, ApiError>(modelId, {
    query: { enabled: modelId !== "" },
  });
  const record = useRecordBulkRebalance<ApiError>({
    mutation: {
      onSuccess: () => {
        setChosen(new Set());
        void rebalancing.refetch();
      },
    },
  });
  const [drafted, setDrafted] = useState<BulkDrafted | null>(null);
  const draft = useDraftFromRebalancing<ApiError>({
    mutation: { onSuccess: (result) => setDrafted(result) },
  });
  const [raised, setRaised] = useState<OrdersRaised | null>(null);
  const orders = useRaiseTradeOrdersFromRebalancing<ApiError>({
    mutation: { onSuccess: (result) => setRaised(result) },
  });

  const user = useStaffUser();
  const mayRaiseOrders = hasAnyAuthority(user, ...RAISES_ORDERS);

  const clients = rebalancing.data?.clients ?? [];
  // Only a portfolio that has actually wandered is worth putting back, so only those can be chosen.
  const worthDoing = clients.filter((client) => client.standing !== null && client.standing !== "WITHIN_BAND");
  const allChosen = worthDoing.length > 0 && worthDoing.every((client) => chosen.has(client.customerId));

  function toggle(customerId: string) {
    const next = new Set(chosen);
    if (next.has(customerId)) next.delete(customerId);
    else next.add(customerId);
    setChosen(next);
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Bulk rebalancing"
        lead="Everyone on one model, with what it would take to put each back. Advisory only — the platform never places a trade."
      />

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Model</span>
          <SelectInput
            id="bulk-model"
            value={modelId}
            className="w-auto"
            onChange={(event) => {
              setModelId(event.target.value);
              setChosen(new Set());
              // What was drafted was drafted for the model that was showing, so it goes with it.
              setDrafted(null);
              setRaised(null);
            }}
          >
            <option value="">Choose a model</option>
            {(models.data?.items ?? []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>

      {modelId === "" && (
        <Alert tone="info">Choose a model to see everyone measured against it and what each would need.</Alert>
      )}

      {rebalancing.isError && <Alert tone="danger">{rebalancing.error.message}</Alert>}

      {rebalancing.data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="On this model">{rebalancing.data.clients.length}</Fact>
            {/* Totals are in the currency the firm reports in. Each client's row below stays in theirs,
                because that is the cheque somebody actually writes. */}
            <Fact label="Under management">
              {underManagementLabel(rebalancing.data.underManagement, rebalancing.data.currency)}
            </Fact>
            <Fact label="To buy">
              {underManagementLabel(rebalancing.data.toBuy, rebalancing.data.currency)}
            </Fact>
            <Fact label="Breached" tone={rebalancing.data.breached > 0 ? "danger" : undefined}>
              {rebalancing.data.breached}
            </Fact>
          </dl>

          {rebalancing.data.unconverted > 0 && (
            <Alert tone="warning">
              {rebalancing.data.unconverted === 1
                ? "One client is held in a currency with no rate on file, so they are missing from the totals above."
                : `${rebalancing.data.unconverted} clients are held in a currency with no rate on file, so they are missing from the totals above.`}{" "}
              Their own rows below are unaffected.
            </Alert>
          )}

          <section className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">{rebalancing.data.modelName}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Worst first. Open a client for their own trade list.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label>
                  <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    Put back on
                  </span>
                  <DateInput
                    id="rebalanced-on"
                    name="on"
                    value={on}
                    min={yearsAgo(20)}
                    max={today()}
                    onChange={(next) => setOn(next ?? "")}
                  />
                </label>
                {/* Drafts, never a send: eighteen clients drifting the same way is still eighteen
                    conversations, and one button that posted them all would be the platform giving advice. */}
                <Button
                  variant="secondary"
                  disabled={draft.isPending}
                  onClick={() =>
                    draft.mutate({
                      data: { modelPortfolioId: modelId, modelName: rebalancing.data!.modelName },
                    })
                  }
                >
                  <FileSignature aria-hidden="true" />
                  {draft.isPending ? "Drafting…" : "Draft proposals"}
                </Button>
                {/* The same trades, as paper the dealing desk can act on — drafts, so each still goes past
                    Compliance. Whoever may not raise an order does not see the button. */}
                {mayRaiseOrders && (
                  <Button
                    variant="secondary"
                    disabled={orders.isPending}
                    onClick={() =>
                      orders.mutate({
                        data: {
                          modelPortfolioId: modelId,
                          // Whoever is ticked, or everybody on the model when nobody is.
                          customerIds: [...chosen],
                          // The server writes why on each one; the screen does not ask for a reason twice.
                          reason: null,
                        },
                      })
                    }
                  >
                    <Receipt aria-hidden="true" />
                    {orders.isPending
                      ? "Raising…"
                      : chosen.size === 0
                        ? "Raise orders for everyone"
                        : `Raise orders for ${chosen.size}`}
                  </Button>
                )}
                <Button
                  disabled={chosen.size === 0 || !on || record.isPending}
                  onClick={() =>
                    record.mutate({ id: modelId, data: { customerIds: [...chosen], on } })
                  }
                >
                  {record.isPending
                    ? "Recording…"
                    : `Record ${chosen.size || "no"} rebalance${chosen.size === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>

            {record.isError && (
              <div className="px-5 pt-4">
                <Alert tone="danger">{record.error.message}</Alert>
              </div>
            )}

            {/* The firm's own judgement is what makes a trade list possible; without it, nothing is drafted. */}
            {draft.isError && (
              <div className="px-5 pt-4">
                <Alert tone="warning">{draft.error.message}</Alert>
              </div>
            )}

            {drafted && (
              <div className="space-y-2 px-5 pt-4">
                <Alert tone="success">
                  {drafted.drafted.length === 0
                    ? "Nothing to draft."
                    : `${drafted.drafted.length} draft${drafted.drafted.length === 1 ? "" : "s"} written. Nothing has been sent — each one is opened, read and sent by the client's own advisor.`}{" "}
                  <Link to="/proposals" className="font-semibold underline">
                    Open proposals
                  </Link>
                </Alert>
                {/* Who was left out and why, so it is learnt here rather than from the drafts not being there. */}
                {drafted.skipped.length > 0 && (
                  <ul className="rounded-xl border border-line bg-slate-50/60 px-4 py-3 text-xs text-ink-soft">
                    {drafted.skipped.map((one) => (
                      <li key={one.customerId} className="py-0.5">
                        <span className="font-medium">{one.clientName}</span> — {one.skipped}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {orders.isError && (
              <div className="px-5 pt-4">
                <Alert tone="danger">{orders.error.message}</Alert>
              </div>
            )}

            {raised && (
              <div className="px-5 pt-4">
                <Alert tone={raised.raised === 0 ? "info" : "success"}>
                  {raised.raised === 0
                    ? "Nothing to raise — every portfolio asked for is where its model wants it, or its trades are under the smallest the firm raises."
                    : `${raised.raised} order${raised.raised === 1 ? "" : "s"} raised as draft${raised.raised === 1 ? "" : "s"}. Nothing is with Compliance until somebody submits it.`}{" "}
                  <Link to="/trade-orders" className="font-semibold underline">
                    Open the blotter
                  </Link>
                </Alert>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th scope="col" className="py-3 pr-3 pl-5">
                      <input
                        type="checkbox"
                        aria-label="Choose everyone that has wandered"
                        checked={allChosen}
                        disabled={worthDoing.length === 0}
                        onChange={() =>
                          setChosen(allChosen ? new Set() : new Set(worthDoing.map((one) => one.customerId)))
                        }
                      />
                    </th>
                    <th scope="col" className="px-4 py-3">Client</th>
                    <th scope="col" className="px-4 py-3 text-right">AUM</th>
                    <th scope="col" className="px-4 py-3 text-right">Drift</th>
                    <th scope="col" className="px-4 py-3">Standing</th>
                    <th scope="col" className="px-4 py-3">Last put back</th>
                    <th scope="col" className="py-3 pr-5 pl-4 text-right">
                      <span className="sr-only">Trade list</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                        Nobody is measured against this model yet.
                      </td>
                    </tr>
                  )}
                  {clients.map((client) => (
                    <Row
                      key={client.customerId}
                      client={client}
                      chosen={chosen.has(client.customerId)}
                      open={openClient === client.customerId}
                      onToggle={() => toggle(client.customerId)}
                      onOpen={() =>
                        setOpenClient(openClient === client.customerId ? null : client.customerId)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Row({
  client,
  chosen,
  open,
  onToggle,
  onOpen,
}: {
  client: ClientRebalance;
  chosen: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  // A portfolio where its model wants it has nothing to put back, so it cannot be chosen.
  const settled = client.standing === null || client.standing === "WITHIN_BAND";
  return (
    <>
      <tr className={cn(chosen && "bg-primary-50/40")}>
        <td className="py-3 pr-3 pl-5">
          <input
            type="checkbox"
            aria-label={`Put ${client.clientName} back`}
            checked={chosen}
            disabled={settled}
            onChange={onToggle}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={client.clientName} />
            <div>
              <span className="block font-medium">{client.clientName}</span>
              <span className="block font-mono text-xs text-ink-muted">{client.clientCode}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
          {underManagementLabel(client.underManagement, client.currency)}
        </td>
        <td
          className={cn(
            "px-4 py-3 text-right font-semibold whitespace-nowrap",
            client.drift == null ? "text-ink-muted" : client.drift > 0 ? "text-emerald-700" : "text-red-600",
          )}
        >
          {client.drift == null ? "—" : driftLabel(client.drift)}
        </td>
        <td className="px-4 py-3">
          {client.standing ? (
            <Badge tone={standingTones[client.standing]}>{standingLabels[client.standing]}</Badge>
          ) : (
            <span className="text-ink-muted">Nothing written down</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
          {client.lastRebalancedOn ? formatDate(client.lastRebalancedOn) : <span className="text-ink-muted">Never</span>}
        </td>
        <td className="py-3 pr-5 pl-4 text-right">
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {open ? "Hide" : "Trade list"}
          </Button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-canvas px-5 py-4">
            <ClassStandingTable
              classes={client.classes}
              currency={client.currency}
              underManagement={client.underManagement}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "danger" ? "text-danger-700" : "text-ink")}>
        {children}
      </dd>
    </div>
  );
}
