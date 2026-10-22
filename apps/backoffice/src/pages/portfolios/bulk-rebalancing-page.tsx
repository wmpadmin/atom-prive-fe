import { ApiError } from "@atomprive/api-client";
import {
  useListModelPortfolios,
  useListRebalancing,
  useRaiseProposalsFromRebalancing,
  useRecordBulkRebalance,
  type BulkProposalsRaised,
  type BulkRebalancing,
  type ClientRebalance,
  type ModelsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, DateInput, Dialog, SelectInput, cn } from "@atomprive/ui";
import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { hasAnyAuthority, WRITES_PROPOSALS } from "../../lib/permissions";
import { formatDate } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { ClassStandingTable } from "./class-standing-table";
import { driftLabel, driftTones, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";
import { AdvisorStack } from "../clients/advisor-stack";

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
  /** Whether the dialog that asks for the date, and writes it, is open. */
  const [recording, setRecording] = useState(false);

  const models = useListModelPortfolios<ModelsPage, ApiError>();
  // The screen opens on a plan rather than on an empty picker. Nobody arrives here to choose nothing, and
  // a page whose every figure reads "—" until a dropdown is touched looks broken rather than unanswered.
  // The first live plan, in the order the list already sorts them; a draft takes no clients, so a screen
  // opening on one would be a screen opening on nobody.
  const live = (models.data?.items ?? []).filter((one) => one.status === "LIVE");
  const opensOn = live[0]?.id ?? "";
  useEffect(() => {
    if (modelId === "" && opensOn !== "") {
      setModelId(opensOn);
    }
  }, [modelId, opensOn]);
  const rebalancing = useListRebalancing<BulkRebalancing, ApiError>(modelId, {
    query: { enabled: modelId !== "" },
  });
  const record = useRecordBulkRebalance<ApiError>({
    mutation: {
      onSuccess: () => {
        setChosen(new Set());
        setRecording(false);
        void rebalancing.refetch();
      },
    },
  });
  const [raised, setRaised] = useState<BulkProposalsRaised | null>(null);
  // One proposal a client, each carrying every sell that client's rebalance calls for, sent to the person
  // who looks after them. It used to write trade orders straight to the blotter, which sold a client's
  // holdings without their relationship manager ever having agreed to it.
  const proposals = useRaiseProposalsFromRebalancing<ApiError>({
    mutation: { onSuccess: (result) => setRaised(result) },
  });

  const user = useStaffUser();
  const mayAsk = hasAnyAuthority(user, ...WRITES_PROPOSALS);

  const clients = rebalancing.data?.clients ?? [];
  // The model's whole list arrives in one piece, so the page is taken here rather than asked for.
  const paged = usePagedRows(clients);
  // Only a portfolio that has actually wandered is worth putting back, so only those can be chosen. Counted
  // over everyone on the model and not the page: ticking the box in the heading is a decision about the
  // model's clients, and one that reached only as far as the page would quietly ask for fewer rebalances
  // than the button beside it says.
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
            // One width, whatever is chosen. Sized to its contents it was narrower than the word above
            // it, and it changed width every time the model changed — the one control on the screen, and
            // it moved as you used it.
            className="w-64"
            onChange={(event) => {
              setModelId(event.target.value);
              setChosen(new Set());
              setRaised(null);
            }}
          >
            {/* Drawn only while nothing is chosen: the moment before the list arrives, and the case
                where no plan is live to open on. Once the screen has settled on a plan it is the one
                control on the page that does nothing — choosing it empties the picker, and the screen
                puts the same plan straight back. */}
            {modelId === "" && <option value="">Choose a model</option>}
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
                {/* One question a client, to the person who speaks to them. Answered whole: agreed to,
                    every sell the model asks of that client is carried out into cash; turned down, none of
                    them is. Where the money goes afterwards is this desk's to decide. */}
                {mayAsk && (
                  <Button
                    variant="secondary"
                    disabled={proposals.isPending}
                    onClick={() =>
                      proposals.mutate({
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
                    {proposals.isPending
                      ? "Asking…"
                      : chosen.size === 0
                        ? "Ask every manager"
                        : `Ask for ${chosen.size}`}
                  </Button>
                )}
                {/* The date is asked for inside the dialog, not over the table.
                    Standing in the toolbar it read as a filter over the rows below — and choosing a day
                    and watching the "Last put back" column stay where it was read as a filter that did not
                    work. Asked when the button is pressed, it can only be the date being written. */}
                <Button
                  className="border-l border-line pl-3"
                  disabled={chosen.size === 0 || record.isPending}
                  onClick={() => setRecording(true)}
                >
                  {chosen.size === 0
                    ? "Record no rebalances"
                    : `Record ${chosen.size} rebalance${chosen.size === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>

            {proposals.isError && (
              <div className="px-5 pt-4">
                <Alert tone="danger">{proposals.error.message}</Alert>
              </div>
            )}

            {raised && (
              <div className="space-y-2 px-5 pt-4">
                {/* Only what was asked. Why somebody was NOT asked is said on their own row, in the
                    Request column, where the decision to tick them is made — said twice it was a banner
                    repeating what the table already showed. */}
                {raised.raised.length > 0 && (
                  <Alert tone="success">
                    {`${raised.raised.length} proposal${raised.raised.length === 1 ? "" : "s"} sent, one a client, each to the person who looks after them. Nothing sells until they agree.`}{" "}
                    <Link to="/proposals" className="font-semibold underline">
                      Open the proposals
                    </Link>
                  </Alert>
                )}
                {/* Who was asked, and for how much. A line a client each, because "four proposals sent"
                    over a table of twelve clients is a sentence somebody has to do arithmetic on. */}
                {raised.raised.length > 0 && (
                  <ul className="space-y-1 text-xs text-ink-soft">
                    {raised.raised.map((one) => (
                      <li key={one.id}>
                        <span className="font-semibold">{one.customerName}</span>{" "}
                        — {one.reference}, selling out of {one.classes}{" "}
                        {one.classes === 1 ? "class" : "classes"}, {one.currency}{" "}
                        {one.total.toLocaleString("en-US", { minimumFractionDigits: 2,
                          maximumFractionDigits: 2 })} in all
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              {/* Laid out to a fixed grid. Sized to their contents, a list of one client crowded six
                  columns into the left third of the card and parked the button a hand's width away from
                  the row it belongs to. */}
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[22%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                </colgroup>
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
                    {/* Who is about to be asked. Raising a rebalance sends each of these clients to their
                        own manager to answer, and a list with no sign of who that is hides what the
                        press does. */}
                    <th scope="col" className="px-4 py-3">Advisors</th>
                    <th scope="col" className="px-4 py-3 text-right">AUM</th>
                    {/* A figure read from the right meeting a badge read from the left: without a gutter
                        of their own the two sat against each other and read as one column. */}
                    <th scope="col" className="py-3 pr-6 pl-4 text-right">Drift</th>
                    <th scope="col" className="py-3 pr-4 pl-6">Standing</th>
                    <th scope="col" className="px-4 py-3">Request</th>
                    <th scope="col" className="py-3 pr-5 pl-4 text-right">
                      <span className="sr-only">Trade list</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-ink-muted">
                        Nobody is measured against this model yet.
                      </td>
                    </tr>
                  )}
                  {paged.shown.map((client) => (
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
            {/* Outside the scrolling box, so the way through the list does not slide sideways with the
                columns. What is ticked survives turning the page — the count on the buttons above is
                everyone chosen, not everyone chosen here. */}
            {clients.length > 0 && <PagedFooter paged={paged} noun={["client", "clients"]} />}
          </section>
        </>
      )}

      {/* Asked at the moment of writing it, so the date can only be read as part of what is being written.
          "Put back on" sitting over the table was taken for a filter three times over. */}
      <Dialog
        open={recording}
        title={`Record ${chosen.size} rebalance${chosen.size === 1 ? "" : "s"}?`}
        onClose={() => setRecording(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            This writes the date onto {chosen.size === 1 ? "that client" : "those clients"}, so drift is read
            as how far {chosen.size === 1 ? "their portfolio has" : "their portfolios have"} wandered since.
            It is a record of trades somebody has already done — it places nothing.
          </p>
          <label className="block">
            <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              The day the trades were done
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
          {record.isError && <Alert tone="danger">{record.error.message}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRecording(false)}>
              Cancel
            </Button>
            <Button
              disabled={!on || record.isPending}
              onClick={() => record.mutate({ id: modelId, data: { customerIds: [...chosen], on } })}
            >
              {record.isPending ? "Recording…" : `Record ${on ? formatDate(on) : "…"}`}
            </Button>
          </div>
        </div>
      </Dialog>
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
  // Nor one already asked about. The money has not moved yet, so they still read as breached with the
  // same trades beside them — and without this the screen offers a press the server then refuses.
  const asked = client.requestStanding !== "NONE";
  return (
    <>
      <tr className={cn(chosen && "bg-primary-50/40")}>
        <td className="py-3 pr-3 pl-5">
          <input
            type="checkbox"
            aria-label={`Put ${client.clientName} back`}
            checked={chosen && !asked}
            disabled={settled || asked}
            onChange={onToggle}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={client.clientName} />
            <div className="min-w-0">
              <span className="block truncate font-medium">{client.clientName}</span>
              <span className="block font-mono text-xs text-ink-muted">{client.clientCode}</span>
            </div>
          </div>
        </td>
        {/* The same faces and the same one name the clients list draws, so a reader who has learnt one
            has learnt the other. */}
        <td className="px-4 py-3">
          <AdvisorStack advisors={client.advisors} />
        </td>
        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
          {underManagementLabel(client.underManagement, client.currency)}
        </td>
        <td
          className={cn(
            "py-3 pr-6 pl-4 text-right font-semibold whitespace-nowrap",
            // Coloured by where the portfolio stands, not by the sign of the figure: drift is how far it
            // has wandered either way, so it is never negative and used to read green at its very worst.
            client.standing == null ? "text-ink-muted" : driftTones[client.standing],
          )}
        >
          {client.drift == null ? "—" : driftLabel(client.drift)}
        </td>
        <td className="py-3 pr-4 pl-6">
          {client.standing ? (
            <Badge tone={standingTones[client.standing]}>{standingLabels[client.standing]}</Badge>
          ) : (
            <span className="text-ink-muted">Nothing written down</span>
          )}
        </td>
        {/* Where their request has got to. Said on the row because the row is where somebody decides
            whether to tick them, and a client whose manager has already agreed still reads as breached
            with the same trades beside them — the money does not move until the desk places it. */}
        <td className="px-4 py-3 whitespace-nowrap">
          {client.requestStanding === "BEING_PLACED" ? (
            <Badge tone="success">Agreed · being placed</Badge>
          ) : client.requestStanding === "WAITING" ? (
            <Badge tone="info">Waiting on their manager</Badge>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </td>
        <td className="py-3 pr-5 pl-4 text-right">
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {open ? "Hide" : "Trade list"}
          </Button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-canvas px-5 py-4">
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
      <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "danger" ? "text-red-700" : "text-ink")}>
        {children}
      </dd>
    </div>
  );
}
