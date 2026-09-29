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
import { useState } from "react";
import { Link } from "react-router";
import { ClearFiltersLink, ListPageHeader, RecordList } from "../../components/record-list";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { useListAddress, useTypedSearch } from "../../lib/use-list-address";
import { formatDate } from "../../lib/labels";
import { AdvisorChips } from "../clients/advisor-chips";
import { ClientSearch } from "../clients/client-search";
import { ClientPortfolioDialog } from "./client-portfolio-dialog";
import {
  ASSET_CLASSES,
  assetClassBars,
  assetClassShort,
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
 * holds, what it is worth, how far it has drifted from its model and when it was last put back. None of it
 * is known here yet: no custodian feed delivers holdings, and no model portfolio carries a target to drift
 * from. They are drawn all the same, and say plainly that they are empty, so the screen is the shape it will
 * keep rather than one that has to be rebuilt around them later.
 */
export function PortfolioClientsPage() {
  const { params, update } = useListAddress();
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

  const [editing, setEditing] = useState<CustomerRow | null>(null);
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
        model and write down what they hold; drift follows from those two. Return needs a history of
        valuations, which nothing keeps yet.
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
          const spread = ASSET_CLASSES.filter((assetClass) => shares[assetClass]);
          return (
            <tr key={client.id} className="border-t border-line">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={client.fullName} />
                  <div>
                    <Link to={`/clients/${client.id}`} className="font-semibold text-ink hover:text-primary-600">
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
                          className={cn("h-full", assetClassBars[assetClass])}
                          style={{ width: `${shares[assetClass]}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-2xs whitespace-nowrap text-ink-muted">
                      {spread
                        .map((assetClass) => `${assetClassShort[assetClass]} ${Math.round(shares[assetClass]!)}%`)
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
                <button
                  type="button"
                  onClick={() => setEditing(client)}
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  {standing?.modelPortfolioId ? "Open" : "Assign"}
                </button>
              </td>
            </tr>
          );
        })}
      </RecordList>

      {editing && (
        <ClientPortfolioDialog
          customerId={editing.id}
          clientName={editing.fullName}
          onClose={() => setEditing(null)}
          onSaved={() => void standings.refetch()}
        />
      )}
    </div>
  );
}
