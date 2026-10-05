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
import { Link, useNavigate } from "react-router";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { formatDate } from "../../lib/labels";
import { AdvisorChips } from "../clients/advisor-chips";
import { barFor, useAssetClasses } from "./asset-classes";
import { ClientSearch } from "../clients/client-search";
import {
  driftLabel,
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
  const assetClasses = useAssetClasses();
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

      <Alert tone="info">
        <span className="font-semibold">Holdings are written down by hand.</span> No custodian feed delivers
        them yet, so a client's portfolio is empty until somebody records it. Open a client to put them on a
        model and write down what they hold; drift follows from those two. Each writing down is also the one
        point the platform learns a value at, so return reads over as many days as somebody has recorded.
      </Alert>

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
            <th scope="col" className="px-4 py-3 text-left font-semibold">Asset allocations</th>
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
          const shares = standing?.shares ?? {};
          // In the firm's own order, so one client's spread reads the same way as the next one's.
          const spread = assetClasses.all.map((one) => one.code).filter((assetClass) => shares[assetClass]);
          return (
            // The row opens the portfolio, the same as the client's name and Open do. This is the book read
            // for portfolio work: the servicing file — their papers, their family, their onboarding — is
            // somebody else's screen, and a name that opened it sent the reader out of their own job.
            <tr
              key={client.id}
              onClick={() => void navigate(`/portfolio-clients/${client.id}`)}
              className="cursor-pointer border-t border-line hover:bg-slate-50/60"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={client.fullName} />
                  <div>
                    <Link
                      to={`/portfolio-clients/${client.id}`}
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
              <td className="px-4 py-3">
                {spread.length === 0 ? (
                  <span className="text-ink-muted">{NOTHING_YET}</span>
                ) : (
                  <div className="min-w-36">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                      {spread.map((assetClass) => (
                        <span
                          key={assetClass}
                          className={cn("h-full", barFor(assetClass, assetClasses.all))}
                          style={{ width: `${shares[assetClass]}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-2xs whitespace-nowrap text-ink-muted">
                      {spread
                        .map((assetClass) => `${assetClasses.shortNames[assetClass] ?? assetClass} ${Math.round(shares[assetClass]!)}%`)
                        .join(" · ")}
                    </p>
                  </div>
                )}
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
                  standing?.drift == null
                    ? "text-ink-muted"
                    : standing.drift > 0
                      ? "text-emerald-700"
                      : standing.drift < 0
                        ? "text-red-600"
                        : "text-ink",
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
                  to={`/portfolio-clients/${client.id}`}
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  {standing?.modelPortfolioId ? "Open" : "Assign"}
                </Link>
              </td>
            </tr>
          );
        })}
      </RecordList>

    </div>
  );
}
