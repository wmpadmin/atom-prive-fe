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
import { Link, useNavigate, useParams } from "react-router";
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
            <th scope="col" className="px-4 py-3 text-right font-semibold">Return</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">AUM</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Drift</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Last rebalanced</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </>
        }
        columns={10}
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
              <td className="px-4 py-3 text-right text-ink-muted">{NOTHING_YET}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {standing && standing.underManagement > 0 ? (
                  <span className="font-semibold text-ink">
                    {underManagementLabel(standing.underManagement, standing.currency)}
                  </span>
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-semibold whitespace-nowrap",
                  // The ink follows the standing; the sign already says which side of the target it went.
                  standing?.standing == null ? "text-ink-muted" : driftTones[standing.standing],
                )}
              >
                {standing?.drift == null ? NOTHING_YET : driftLabel(standing.drift)}
              </td>
              <td className="px-4 py-3">
                {standing?.standing ? (
                  <Badge tone={standingTones[standing.standing]}>{standingLabels[standing.standing]}</Badge>
                ) : (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                )}
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
          onClose={() => {
            void navigate("/portfolio-clients");
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
