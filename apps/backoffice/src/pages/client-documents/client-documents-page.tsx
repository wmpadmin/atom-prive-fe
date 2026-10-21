import type { ApiError } from "@atomprive/api-client";
import { useListClientFiles, type CustomerPage } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, TextInput } from "@atomprive/ui";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { hasAnyAuthority, hasAuthority, UPLOADS_CLIENT_DOCUMENTS } from "../../lib/permissions";
import { kycStatusLabels, kycStatusTones } from "../clients/client-labels";
import { formatDate } from "../../lib/labels";

/**
 * Where a client's papers are put on file (#83). One client at a time, because a document is only worth
 * keeping against the client it belongs to.
 *
 * <p>Whose clients depends on whose job it is. Compliance own KYC for the whole firm, so they see every
 * client; an advisor is held to their own. This listed only the signed-in person's own clients whoever
 * they were, which left Compliance looking at "no clients are assigned to you yet" and no way to reach
 * anybody — on the one screen their job is done from.
 */
export function ClientDocumentsPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  // Offered rather than fixed, so this footer reads like every other one in the portal.
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const user = useStaffUser();
  // Three different jobs on one screen: Compliance add and decide, an advisor adds for their own clients,
  // Operations read every client's to service them and add to none.
  const mayAdd = hasAnyAuthority(user, ...UPLOADS_CLIENT_DOCUMENTS);
  const everyClient = hasAuthority(user, "UPLOAD_CLIENT_DOCUMENTS:CHANGE") || !mayAdd;
  // One list, scoped by the API the same way putting a paper on a file is scoped — so a client somebody
  // may act for is a client they can find. The All clients list answers a different question and narrows
  // a restricted client away from everybody but whoever runs the firm.
  const clients = useListClientFiles<CustomerPage, ApiError>(
    { query: query.trim() || undefined, page, size },
    { query: { placeholderData: (held) => held } },
  );
  const rows = clients.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Client documents</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {!mayAdd
            ? "Every client's passports, identity papers and proof of address. Open a client to read what is on file and download it. Compliance put them on file and decide on them."
            : everyClient
              ? "Every client's passports, identity papers and proof of address. Open a client to see what is on file, add to it, and decide on what is there."
              : "Your clients' passports, identity papers and proof of address. Open a client to see what is on file and add to it. Compliance check them and decide."}
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
              // Carries where it was opened from, so Back goes to this list and not to whichever
              // KYC screen the reader happens to have the permission for.
              to={`/kyc/${client.id}?from=documents`}
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
        {clients.isPending && (
          <li className="text-sm text-ink-muted">
            {everyClient ? "Loading the clients…" : "Loading your clients…"}
          </li>
        )}
        {clients.data && rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
            {query
              ? everyClient
                ? "No client matches that."
                : "No client of yours matches that."
              : everyClient
                ? "No clients have been registered yet."
                : "No clients are assigned to you yet."}
          </li>
        )}
      </ul>

      {clients.data && clients.data.totalItems > clients.data.size && (
        <Pagination
          page={clients.data.page}
          pageSize={clients.data.size}
          totalItems={clients.data.totalItems}
          onPageChange={setPage}
          pageSizes={PAGE_SIZES}
          onPageSizeChange={(next) => {
            setSize(next);
            setPage(0);
          }}
          noun={["client", "clients"]}
        />
      )}
    </div>
  );
}
