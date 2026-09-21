import { ApiError } from "@atomprive/api-client";
import { useListMyClients, type CustomerPage, type ListMyClientsKycStatus } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { formatRelative } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { kycStatusLabels, kycStatusTones, kycStatuses } from "../clients/client-labels";

/** The clients this advisor looks after, and nobody else's (#77). */
export function MyClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kycStatus, setKycStatus] = useState<ListMyClientsKycStatus | "">("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const query = useDebouncedValue(search.trim());

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(0);
  }

  const clients = useListMyClients<CustomerPage, ApiError>(
    { query: query || undefined, kycStatus: kycStatus || undefined, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  if (clients.isError) {
    return <Alert tone="danger">{clients.error.message}</Alert>;
  }
  const total = clients.data?.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">My clients</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Only the clients assigned to you. Open one to see their portfolio and write a proposal.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <TextInput
            id="my-client-search"
            name="query"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search name, email or code"
            className="max-w-xs"
            aria-label="Search my clients"
          />
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            KYC
            <SelectInput
              id="my-client-kyc"
              name="kycStatus"
              value={kycStatus}
              onChange={(event) => {
                setKycStatus(event.target.value as ListMyClientsKycStatus | "");
                setPage(0);
              }}
              className="w-auto"
            >
              <option value="">All KYC statuses</option>
              {kycStatuses.map((status) => (
                <option key={status} value={status}>
                  {kycStatusLabels[status]}
                </option>
              ))}
            </SelectInput>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Client code</th>
                <th scope="col" className="px-4 py-3">Net worth</th>
                <th scope="col" className="px-4 py-3">Top allocation</th>
                <th scope="col" className="px-4 py-3">KYC</th>
                <th scope="col" className="py-3 pr-5 pl-4">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!clients.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading your clients…</td>
                </tr>
              )}
              {clients.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {query || kycStatus ? "No client matches these filters." : "No clients are assigned to you yet."}
                  </td>
                </tr>
              )}
              {(clients.data?.items ?? []).map((client) => (
                // The row opens the client, the same as its name does.
                <tr
                  key={client.id}
                  onClick={() => void navigate(`/my-clients/${client.id}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.fullName} />
                      <div className="min-w-0">
                        <Link to={`/my-clients/${client.id}`} onClick={(event) => event.stopPropagation()} className="block truncate font-semibold hover:text-primary-600">
                          {client.fullName}
                        </Link>
                        <span className="block truncate text-xs text-ink-muted">{client.email ?? "No email"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-soft">{client.code}</td>
                  {/* Net worth and allocation come from the custodian feeds, which aren't connected yet. */}
                  <td className="px-4 py-3 text-ink-muted" title="Filled in once the bank feeds are connected">—</td>
                  <td className="px-4 py-3 text-ink-muted" title="Filled in once the bank feeds are connected">—</td>
                  <td className="px-4 py-3">
                    <Badge tone={kycStatusTones[client.kycStatus]}>{kycStatusLabels[client.kycStatus]}</Badge>
                  </td>
                  <td className="py-3 pr-5 pl-4 whitespace-nowrap text-ink-soft">{formatRelative(client.lastLoginAt, "Never")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={changePageSize}
              noun={["client", "clients"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
