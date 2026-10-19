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
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { formatDate } from "../../lib/labels";
import { AdvisorChips } from "../clients/advisor-chips";
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
function Earned({ percent, days }: { percent: number; days: number }) {
  return (
    <span
      className={cn("font-semibold", percent < 0 ? "text-red-600" : "text-ink")}
      title={`Over ${days} ${days === 1 ? "day" : "days"} on file, with money paid in and taken out kept `
        + "out of the answer."}
    >
      {percent > 0 ? "+" : ""}{percent.toFixed(2)}%
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

  function clearFilters() {
    typed.clear();
    update({ q: null, advisor: null });
  }

  const advisors = useListCustomerAdvisors<StaffMember[], ApiError>();
  const clients = useListCustomers<CustomerPage, ApiError>(
    { query: query || undefined, advisorId: advisorId || undefined, page, size },
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

      <RecordList
        caption="Clients"
        subtitle="Newest first"
        filters={
          <>
            <ClientSearch
              value={typed.search}
              filters={{ advisorId: advisorId || undefined }}
              onChange={typed.change}
              onSearch={typed.apply}
            />
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

          </>
        }
        filtered={filtered}
        onClear={clearFilters}
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">Client</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Advisor</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Risk profile</th>
            {/* One column, two figures stacked. Side by side they were two columns of a table already
                eleven wide, under a heading that had to break over two lines to fit — and a reader
                looking for the one figure they came for had to find which of two "Return" columns it
                was in. The whole of it reads first; the rate per year sits under it in small, which is
                the order somebody asks them in. */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Return</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">AUM</th>
            {/* The same gap twice, stacked rather than side by side. Money is what has to change hands
                and reads first; points are what the band is written in and what the verdict beside it is
                read off, so they sit under in small. */}
            <th scope="col" className="px-4 py-3 text-right font-semibold">Drift</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
            {/* The two dates together, because they are read as a pair: how long the firm has had them,
                and how long since anybody touched it. */}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Onboarded</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Last rebalanced</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={11}
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
              <td className="px-4 py-3">
                <AdvisorChips advisors={client.advisors} />
              </td>
              <td className="px-4 py-3">
                {standing?.modelName ?? <span className="text-ink-muted">{NOTHING_YET}</span>}
              </td>
              {/* Nothing is not nought. A client whose holdings were written down once has one
                  photograph and no period at all, and a nought beside their name would read as a year of
                  going nowhere rather than as a question nobody can answer yet.

                  Under a year there is no yearly rate to put underneath: eleven days of three per cent
                  annualises to something near a hundred and seventy, which is not wrong so much as it is
                  not an answer. The line simply is not drawn, and the hover says why. */}
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {standing?.earned ? (
                  <>
                    <Earned percent={standing.earned.sinceInception} days={standing.earned.days} />
                    {standing.earned.perYear != null && (
                      <span className="mt-0.5 block text-2xs text-ink-muted">
                        {standing.earned.perYear > 0 ? "+" : ""}
                        {standing.earned.perYear.toFixed(2)}% a year
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {standing && standing.underManagement > 0 ? (
                  <span className="font-semibold text-ink">
                    {underManagementLabel(standing.underManagement, standing.currency)}
                  </span>
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
              </td>
              {/* The money first, because that is the figure somebody acts on, and the points under it
                  because that is what the band is written in and what the verdict beside it is read off.
                  The sign is the same on both: drift is what is held less what is asked for, so a plus is
                  money the class holds over its target and a minus is money it is short of.

                  Nothing is signed where there is nothing to sign. A class exactly on its target is not
                  nought over and not nought short, and "−USD 0" is a minus sign doing no work. */}
              <td
                className={cn(
                  "px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
                  standing?.standing == null ? "text-ink-muted" : driftTones[standing.standing],
                )}
              >
                {standing?.drift == null ? (
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
                )}
              </td>
              <td className="px-4 py-3">
                {standing?.standing ? (
                  <Badge tone={standingTones[standing.standing]}>{standingLabels[standing.standing]}</Badge>
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
              </td>
              {/* When they became a client, which is the moment the firm has a record of. It comes with
                  the row rather than with the standing: a client who has had nothing written down yet
                  still has a day they arrived. */}
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                {formatDate(client.registeredAt)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                {standing?.lastRebalancedOn ? (
                  formatDate(standing.lastRebalancedOn)
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
              </td>
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
