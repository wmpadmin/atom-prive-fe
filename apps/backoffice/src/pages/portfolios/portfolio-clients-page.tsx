import { ApiError } from "@atomprive/api-client";
import {
  useListCustomerAdvisors,
  useListCustomers,
  useListPortfolioStandings,
  type CustomerPage,
  type CustomerRow,
  type PortfolioStanding,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { useColumnDrag } from "../../lib/column-drag";
import { useTableView } from "../../lib/table-view";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { formatDate } from "../../lib/labels";
import { StaffStack } from "../clients/staff-stack";
import { ClientSearch } from "../clients/client-search";
import { PortfolioSetupDialog } from "./portfolio-setup-dialog";
import { isSetUp } from "./set-up";
import {
  driftLabel,
  driftTones,
  standingLabels,
  standingTones,
  underManagementLabel,
} from "./portfolio-labels";

/** Nothing is known about it yet, which is said the same way in every column that has nothing. */
const NOTHING_YET = "—";

/**
 * A return, signed, with what it is made of said on hover.
 *
 * <p>The sign is carried by the figure rather than by a colour alone: a reader who cannot tell red from
 * green still has to be able to tell a gain from a loss, and a minus sign is not something a screenshot or
 * a printout loses.
 *
 * <p>How many days it is made of is worth having to hand, because the same two per cent is a fine month
 * and a poor decade. It goes in the title rather than on the row, where it would be a column of noise
 * beside the one figure anybody came to read.
 */
/**
 * What the money earned, and whether anybody can tell.
 *
 * <p>A return works by taking money paid in and taken out back out of the answer, and it can only take
 * out what somebody recorded. With nothing on file every penny of the change is read as earnings — so a
 * client whose figures were written at 728 one day and 28,640 the next reads as having earned 3,831%,
 * and this cell called that a return with money in and out kept out of it.
 *
 * <p>None on file does not make the figure wrong: a client who neither paid in nor took out has none
 * either, and theirs is exactly right. It is the one thing that separates a return nobody can check from
 * one nobody needs to, so it is said rather than guessed at — and the figure stays, because hiding it
 * would lose a real return to save a reader from a doubtful one.
 */
function Earned({ percent, days, flows }: { percent: number; days: number; flows: number }) {
  const unchecked = flows === 0;
  return (
    <span
      className={cn("font-semibold", percent < 0 ? "text-red-600" : "text-ink")}
      title={unchecked
        ? `Over ${days} ${days === 1 ? "day" : "days"} on file. No money in or out was recorded over this `
          + "period, so the whole of the change is being read as something the money earned. If any of it "
          + "was paid in, record it and this figure will drop to what was actually earned."
        : `Over ${days} ${days === 1 ? "day" : "days"} on file, with ${flows} `
          + `${flows === 1 ? "movement" : "movements"} of money in or out kept out of the answer.`}
    >
      {percent > 0 ? "+" : ""}{percent.toFixed(2)}%
      {/* Marked, not hidden. The reader needs to know the platform cannot vouch for it. */}
      {unchecked && <span aria-hidden="true" className="ml-1 font-normal text-amber-600">*</span>}
      {unchecked && <span className="sr-only"> (no money in or out recorded over this period)</span>}
    </span>
  );
}

/**
 * The book, read for portfolio work: every client the firm has, whoever advises them.
 *
 * <p>The columns to the right of the advisor are what managing a portfolio is done from — what the client
 * holds, what it is worth, how far it has drifted from its model and when it was last put back. All of it is
 * worked out from what has been written down: a model carries its targets and its tolerance bands, and the
 * standing against them is the platform's own answer rather than a figure typed on this screen.
 *
 * <p>What is written down still arrives by hand. No custodian feed delivers holdings, so a client's are
 * recorded here: the dialog this list opens is where they are entered, the model chosen and a rebalance
 * dated. Until somebody has done that for a client, their columns are empty, and they say so rather than
 * reading as a portfolio worth nothing.
 */
/** One client's row, gathered once so every column is written against the same reading of them. */
type Row = {
  client: CustomerRow;
  standing: PortfolioStanding | undefined;
  /** Where the row goes when it is opened, which two columns both link to. */
  opens: string;
  done: boolean;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Written as a list rather than as nine pairs of tags because a reader can now reorder them: a
 * heading and the cells under it have to travel together, and the only way to be sure they do is for
 * each column to be one thing that knows both.
 *
 * <p>The client is not here, and neither is the way in at the end. A row with no client on it cannot be
 * told from any other row, and an action with no heading cannot be dragged or found in a list — so
 * those two are drawn where they are, and everything between them is the reader's to arrange.
 */
const MOVABLE: {
  id: string;
  label: string;
  align: "left" | "right";
  cell: (row: Row) => ReactNode;
}[] = [
  {
    id: "advisor",
    label: "Advisor",
    align: "left",
    cell: ({ client }) => <StaffStack people={client.advisors} desk="advisors" />,
  },
  {
    id: "risk",
    label: "Risk profile",
    align: "left",
    cell: ({ standing }) => standing?.modelName ?? <span className="text-ink-muted">{NOTHING_YET}</span>,
  },
  {
    id: "return",
    label: "Return",
    align: "right",
    /*
     * One column, two figures stacked. Side by side they were two columns of a table already eleven
     * wide, under a heading that had to break over two lines to fit — and a reader looking for the one
     * figure they came for had to find which of two "Return" columns it was in. The whole of it reads
     * first; the rate per year sits under it in small, which is the order somebody asks them in.
     *
     * Nothing is not nought. A client whose holdings were written down once has one photograph and no
     * period at all, and a nought beside their name would read as a year of going nowhere rather than
     * as a question nobody can answer yet. Under a year there is no yearly rate to put underneath
     * either: eleven days of three per cent annualises to something near a hundred and seventy, which
     * is not wrong so much as it is not an answer.
     *
     * Nothing either for a client on no model. A return is worked out from what somebody wrote down, so
     * a figure here beside an empty Risk profile reads as performance against a plan that does not
     * exist.
     */
    cell: ({ standing }) => (standing?.earned && standing.modelName ? (
      <>
        <Earned percent={standing.earned.sinceInception} days={standing.earned.days}
          flows={standing.earned.flows} />
        {standing.earned.perYear != null && (
          <span className="mt-0.5 block text-2xs text-ink-muted">
            {standing.earned.perYear > 0 ? "+" : ""}
            {standing.earned.perYear.toFixed(2)}% a year
          </span>
        )}
      </>
    ) : (
      <span className="text-ink-muted">{NOTHING_YET}</span>
    )),
  },
  {
    id: "aum",
    label: "AUM",
    align: "right",
    cell: ({ standing }) => (standing && standing.underManagement > 0 ? (
      <span className="font-semibold text-ink">
        {underManagementLabel(standing.underManagement, standing.currency)}
      </span>
    ) : (
      <span className="text-ink-muted">{NOTHING_YET}</span>
    )),
  },
  {
    id: "drift",
    label: "Drift",
    align: "right",
    /*
     * The same gap twice, stacked rather than side by side. Money is what has to change hands and reads
     * first; points are what the band is written in and what the verdict beside it is read off, so they
     * sit under in small. The sign is the same on both: drift is what is held less what is asked for,
     * so a plus is money the class holds over its target and a minus is money it is short of.
     *
     * Nothing is signed where there is nothing to sign. A class exactly on its target is not nought
     * over and not nought short, and "−USD 0" is a minus sign doing no work.
     */
    cell: ({ standing }) => (standing?.drift == null ? (
      <span className="text-ink-muted">{NOTHING_YET}</span>
    ) : (
      <span title={standing.driftValue == null ? undefined
        : "The class furthest from its target is "
          + `${underManagementLabel(Math.abs(standing.driftValue), standing.currency)} `
          + (standing.driftValue > 0 ? "over" : "short of") + " what the model asks of it."}>
        {standing.driftValue == null ? NOTHING_YET : (
          <>
            {standing.driftValue > 0 ? "+" : standing.driftValue < 0 ? "−" : ""}
            {underManagementLabel(Math.abs(standing.driftValue), standing.currency)}
          </>
        )}
        <span className="mt-0.5 block text-2xs font-normal opacity-75">
          {driftLabel(standing.drift)}
        </span>
      </span>
    )),
  },
  {
    id: "status",
    label: "Status",
    align: "left",
    cell: ({ standing }) => (standing?.standing ? (
      <Badge tone={standingTones[standing.standing]}>{standingLabels[standing.standing]}</Badge>
    ) : (
      <span className="text-ink-muted">{NOTHING_YET}</span>
    )),
  },
  {
    id: "registered",
    label: "Registered",
    align: "left",
    /*
     * When they became a client, which is the moment the firm has a record of. It comes with the row
     * rather than with the standing: a client who has had nothing written down yet still has a day they
     * arrived.
     *
     * "Registered", the same word the servicing clients list uses for the same field. Two screens naming
     * one date two ways makes a reader wonder which one they are looking at.
     */
    cell: ({ client }) => formatDate(client.registeredAt),
  },
];

/** What the drift column paints its figure in, which depends on the verdict rather than the sign. */
function toneOf(id: string, standing: PortfolioStanding | undefined) {
  if (id !== "drift") return undefined;
  return standing?.standing == null ? "text-ink-muted" : driftTones[standing.standing];
}

export function PortfolioClientsPage() {
  const navigate = useNavigate();
  const { params, update } = useListAddress();
  // Whose Net AUM is being worked out, taken from the address. It is a dialog over this list rather than
  // a screen of its own, but it keeps an address so a sitting half way through can be left and come back
  // to, and so a row can send somebody straight into it.
  const { customerId: settingUp } = useParams();
  // What the way in asked for: which step to open on, and where closing it should put somebody back.
  // Opened from a client's own portfolio there is a screen to go back to, and sending them to the list
  // instead takes away the one they were working on.
  const address = useSearchParams()[0];
  const openAt = (["1", "2", "3", "4"].includes(address.get("at") ?? "")
    ? Number(address.get("at")) : undefined) as 1 | 2 | 3 | 4 | undefined;
  const backTo = address.get("from") === "portfolio" && settingUp
    ? `/portfolio-clients/${settingUp}` : "/portfolio-clients";
  const query = params.get("q") ?? "";
  const advisorId = params.get("advisor") ?? "";
  const page = Number(params.get("page")) || 0;
  const size = Number(params.get("size")) || PAGE_SIZES[0]!;
  const typed = useTypedSearch(query, update);
  const filtered = query !== "" || advisorId !== "";

  // How this reader has arranged the table, read back out of their own browser. Nobody else sees it and
  // nothing about a client depends on it, which is why it is kept there rather than against the account.
  const view = useTableView("portfolio-clients", MOVABLE.map((one) => one.id));
  // Which heading is being dragged, so the one under the cursor can say it will take the drop.
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  function clearFilters() {
    typed.clear();
    update({ q: null, advisor: null });
  }

  const advisors = useListCustomerAdvisors<StaffMember[], ApiError>();
  /*
   * Every holder of a joint account, in their own right.
   *
   * <p>This is a list of portfolios, not of people. A joint account is one household and two portfolios,
   * each measured against its own plan and drifting from it on its own — so answered once per household
   * the desk loses a portfolio it manages. It showed: the plans counted fourteen clients between them
   * and this list showed eleven, with nothing on either screen to say where the other three went.
   *
   * <p>The servicing list still answers once per household, which is right for it: that one is a list of
   * people, and the row names everyone who holds the account.
   */
  const clients = useListCustomers<CustomerPage, ApiError>(
    { query: query || undefined, advisorId: advisorId || undefined, everyHolder: true, page, size },
    { query: { placeholderData: keepPreviousData } },
  );
  const onThisPage = (clients.data?.items ?? []).map((client) => client.id);
  // One request for the page, rather than one per row.
  const standings = useListPortfolioStandings<{ items: PortfolioStanding[] }, ApiError>(
    { customerIds: onThisPage },
    { query: { enabled: onThisPage.length > 0, placeholderData: keepPreviousData } },
  );
  const standingOf = new Map((standings.data?.items ?? []).map((one) => [one.customerId, one]));

  if (clients.isError) {
    return <Alert tone="danger">{clients.error.message}</Alert>;
  }
  const rows = clients.data?.items ?? [];

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Clients"
        lead="Every client the firm has, with who advises them and how their portfolio stands."
      />

      {/* Above the table rather than inside it: which of their arrangements a reader is in is the first
          thing they need to know, before anything the table says. */}
      <ViewTabs
        views={view.views}
        current={view.current}
        edited={view.current === null ? view.arranged : view.changed}
        onPick={(name) => (name === null ? view.reset() : view.apply(name))}
        onSave={view.saveAs}
        onDelete={view.remove}
      />

      <RecordList
        caption="Clients"
        subtitle="Newest first"
        search={
          <ClientSearch
            value={typed.search}
            filters={{ advisorId: advisorId || undefined, everyHolder: true }}
            onChange={typed.change}
            onSearch={typed.apply}
          />
        }
        filters={
          <>
            <label>
              <span className="sr-only">Advisor</span>
              <SelectInput
                id="portfolio-client-advisor"
                value={advisorId}
                onChange={(event) => update({ advisor: event.target.value })}
                className="w-auto"
              >
                <option value="">All advisors</option>
                {(advisors.data ?? []).map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.fullName}
                  </option>
                ))}
              </SelectInput>
            </label>

            {/* Beside the filters, because arranging the table is the same kind of act as narrowing it:
                both are about what this reader wants in front of them rather than about any client. */}
            <ColumnPicker
              columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
              shown={new Set(view.shown)}
              order={view.order}
              arranged={view.arranged}
              onChange={(next) => {
                for (const one of MOVABLE) {
                  if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                }
              }}
              onMove={view.move}
              onReset={view.reset}
            />
          </>
        }
        filtered={filtered}
        onClear={clearFilters}
        head={
          <>
            {/* The client stays where it is. A row with no client on it cannot be told from any other
                row, so this one is not offered to be moved or taken off. */}
            <th scope="col" className="px-5 py-3 text-left font-semibold">Client</th>
            {shownColumns.map((column, at) => (
              <th
                key={column.id}
                scope="col"
                {...drag.headingProps(column.id)}
                className={cn(
                  "cursor-grab touch-none px-4 py-3 font-semibold select-none",
                  column.align === "right" ? "text-right" : "text-left",
                  drag.dragging === column.id && "cursor-grabbing opacity-40",
                  drag.over === column.id && "bg-primary-50",
                )}
                title={`Drag to move ${column.label}`}
              >
                {column.label}
                <span className="sr-only">
                  , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                </span>
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={shownColumns.length + 2}
        loading={clients.isLoading}
        stale={clients.isPlaceholderData}
        empty={
          // Said only when there is genuinely nothing: the list draws this row whenever it is given one.
          rows.length > 0 ? undefined : filtered ? (
            <ClearFiltersLink onClear={clearFilters}>No client matches what you searched for.</ClearFiltersLink>
          ) : (
            "No clients yet."
          )
        }
        page={page}
        size={size}
        total={clients.data?.totalItems ?? 0}
        noun={["client", "clients"]}
        onPage={(next) => update({ page: String(next) })}
        onSize={(next) => update({ size: String(next), page: "0" })}
      >
        {rows.map((client: CustomerRow) => {
          const standing = standingOf.get(client.id);
          // Whether the calculator has been worked through to the end: the figures and the plan both.
          const done = isSetUp(standing);
          // Finished opens at the portfolio, which is what there is to read. Unfinished goes back into the
          // calculator, at whichever step the writing stopped.
          const opens = done
            ? `/portfolio-clients/${client.id}`
            : `/portfolio-clients/${client.id}/net-aum`;
          // What a client holds is drawn as a share of what is written down. There is more to come that
          // belongs in that figure — borrowing, and what is held but not managed — so what it would say
          // today is not what it will say, and a spread nobody can act on is better not drawn at all.
          return (
            // The row opens the portfolio, the same as the client's name and Open do. This is the book read
            // for portfolio work: the servicing file — their papers, their family, their onboarding — is
            // somebody else's screen, and a name that opened it sent the reader out of their own job.
            <tr
              key={client.id}
              onClick={() => void navigate(opens)}
              className="cursor-pointer border-t border-line hover:bg-slate-50/60"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={client.fullName} />
                  <div>
                    <Link
                      to={opens}
                      className="font-semibold text-ink hover:text-primary-600"
                    >
                      {client.fullName}
                    </Link>
                    <p className="text-xs text-ink-muted">{client.code}</p>
                  </div>
                </div>
              </td>
              {/* The cells in the order the headings are in, out of the one list that holds both: a
                  heading and what sits under it cannot drift apart if neither is written twice. */}
              {shownColumns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-4 py-3",
                    column.align === "right" && "text-right whitespace-nowrap tabular-nums",
                    column.id === "drift" && "font-semibold",
                    toneOf(column.id, standing),
                  )}
                >
                  {column.cell({ client, standing, opens, done })}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                <Link
                  to={opens}
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  {done ? "Open" : "Assign"}
                </Link>
              </td>
            </tr>
          );
        })}
      </RecordList>

      {settingUp && (
        <PortfolioSetupDialog
          customerId={settingUp}
          openAt={openAt}
          onClose={() => {
            void navigate(backTo);
            // What was written reaches the row it was written for without a reload.
            void standings.refetch();
          }}
          /* Finished is not the same as closed. Somebody who has worked the Net AUM out and put the client
             on a plan is taken to the portfolio itself, which is what all that typing was for; the X and
             Escape put them back on the list they came from. */
          onFinish={() => void navigate(`/portfolio-clients/${settingUp}`)}
        />
      )}
    </div>
  );
}
