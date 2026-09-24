import type { ApiError } from "@atomprive/api-client";
import { useListMyClients, type CustomerPage } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, TextInput } from "@atomprive/ui";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { kycStatusLabels, kycStatusTones } from "../clients/client-labels";
import { formatDate } from "../../lib/labels";

/**
 * Where an advisor puts their clients' papers on file (#39). One client at a time, because a document is
 * only worth keeping against the client it belongs to.
 */
export function ClientDocumentsPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const clients = useListMyClients<CustomerPage, ApiError>(
    { query: query.trim() || undefined, page, size: 10 },
    { query: { placeholderData: (kept) => kept } },
  );
  const rows = clients.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Client documents</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your clients' passports, identity papers and proof of address. Open a client to see what is on file and
          add to it. Compliance check them and decide.
        </p>
      </header>

      {clients.isError && <Alert tone="danger">{clients.error.message}</Alert>}

      <div className="relative max-w-sm">
        <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <TextInput
          id="find-client"
          aria-label="Search your clients"
          placeholder="Search name, email or code"
          className="pl-9"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </div>

      <ul className="space-y-2">
        {rows.map((client) => (
          <li key={client.id}>
            <Link
              to={`/kyc/${client.id}`}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 transition-colors hover:border-primary-600"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{client.fullName}</span>
                <span className="block text-xs text-ink-muted">
                  {client.code} · registered {formatDate(client.registeredAt)}
                </span>
              </span>
              <Badge tone={kycStatusTones[client.kycStatus]}>{kycStatusLabels[client.kycStatus]}</Badge>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
        {clients.isPending && <li className="text-sm text-ink-muted">Loading your clients…</li>}
        {clients.data && rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
            {query ? "No client of yours matches that." : "No clients are assigned to you yet."}
          </li>
        )}
      </ul>

      {clients.data && clients.data.totalItems > clients.data.size && (
        <Pagination
          page={clients.data.page}
          pageSize={clients.data.size}
          totalItems={clients.data.totalItems}
          onPageChange={setPage}
          noun={["client", "clients"]}
        />
      )}
    </div>
  );
}
