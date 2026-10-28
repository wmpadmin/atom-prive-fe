import { ApiError } from "@atomprive/api-client";
import {
  useListArchivedCustomers,
  useListDeactivations,
  useRestoreClient,
  type CustomerPage,
  type DeactivationQueue,
  type DeactivationRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Dialog, Pagination, TextInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { formatDate } from "../../lib/labels";

/**
 * The clients the firm has stopped acting for.
 *
 * <p>The only screen an archived client appears on, and nobody but the Admin has it. Everything of theirs
 * is still held in full — this is where it is read, and where it is put back while the ninety days last.
 *
 * <p>Two reads rather than one, and deliberately. The list of who is archived comes from the client
 * directory, which is what actually knows; who asked, who agreed and how long is left comes from the
 * request that archived them. Folding the second into the first would have put a queue's columns on the
 * client record, where the next person to archive a client by some other route would have found them
 * empty and wondered what they had broken.
 */
export function ArchivedClientsPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [restoring, setRestoring] = useState<{ id: string; name: string } | null>(null);

  const clients = useListArchivedCustomers<CustomerPage, ApiError>(
    { query: query.trim() || undefined, page, size },
    { query: { placeholderData: keepPreviousData } },
  );
  // Every answered request, which is where the dates and the window live. Small by nature: it is the
  // firm's deactivations, not its clients.
  const decided = useListDeactivations<DeactivationQueue, ApiError>({ decided: true });
  const byClient = new Map<string, DeactivationRow>();
  for (const row of decided.data?.items ?? []) {
    if (row.status === "APPROVED" && !row.restoredAt) {
      byClient.set(row.customerId, row);
    }
  }

  const rows = clients.data?.items ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[1.625rem] font-bold">Archived clients</h1>
        <p className="mt-1 max-w-[84ch] text-sm text-ink-muted">
          Clients the firm has stopped acting for. Nothing here has been deleted — every detail, document
          and record is held in full, and nobody but you can see them.
        </p>
      </header>

      {clients.isError && <Alert tone="danger">{clients.error.message}</Alert>}

      <div className="relative max-w-sm">
        <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <TextInput
          id="find-archived"
          aria-label="Search archived clients"
          placeholder="Search name, email or code"
          className="pl-9"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </div>

      {clients.isPending && <p className="text-sm text-ink-muted">Reading the archive…</p>}

      {clients.data && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="px-4 py-2.5 text-left">Client</th>
                <th className="px-4 py-2.5 text-left">Deactivated</th>
                <th className="px-4 py-2.5 text-left">On whose word</th>
                <th className="px-4 py-2.5 text-left">Restore</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {/* The headings stay when there is nothing to put under them. A table that vanishes
                  leaves a sentence floating on an empty screen, and the reader cannot tell an empty
                  queue from a screen that failed to draw. */}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                    {query ? "No archived client matches that." : "The firm has not deactivated any client."}
                  </td>
                </tr>
              )}
              {rows.map((client) => {
                const how = byClient.get(client.id);
                return (
                  <tr key={client.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={client.fullName} photo={client.photo} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink">{client.fullName}</span>
                          <span className="block text-xs text-ink-muted">{client.code}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {how?.decidedAt ? formatDate(how.decidedAt.slice(0, 10)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {how ? (
                        <>
                          Asked by {how.askedByName ?? "—"}
                          <span className="block text-xs text-ink-muted">
                            approved by {how.decidedByName ?? "—"}
                          </span>
                          {how.reason && (
                            <span className="mt-1 block max-w-[40ch] text-xs text-ink-soft italic">
                              {how.reason}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {how?.mayRestore ? (
                        <Badge tone="info">
                          {how.daysLeftToRestore} {how.daysLeftToRestore === 1 ? "day" : "days"} left
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Window closed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex gap-2">
                        {/* Reading them is not restoring them: the window shuts on the undo, not on the
                            record, and refusing the one person who may see an archived client the right to
                            look at them would be keeping a file nobody can open. */}
                        <Link
                          to={`/clients/${client.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold whitespace-nowrap text-ink transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                        >
                          Open
                        </Link>
                        {how?.mayRestore && (
                          <Button
                            size="sm"
                            onClick={() => setRestoring({ id: client.id, name: client.fullName })}
                          >
                            Restore
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
          noun={["archived client", "archived clients"]}
        />
      )}

      <Restore restoring={restoring} onClose={() => setRestoring(null)} />
    </div>
  );
}

/** Putting a client back, which puts them back for the whole firm at once. */
function Restore({
  restoring,
  onClose,
}: {
  restoring: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const restore = useRestoreClient<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries();
        onClose();
      },
    },
  });

  return (
    <Dialog
      open={restoring !== null}
      title={restoring ? `Put ${restoring.name} back?` : ""}
      description="They return to every list and every queue exactly as they were, for everybody who could see them before."
      onClose={() => {
        restore.reset();
        onClose();
      }}
    >
      <div className="space-y-3">
        {restore.error && <Alert tone="danger">{restore.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={restore.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={restore.isPending || !restoring}
            onClick={() => restoring && restore.mutate({ customerId: restoring.id })}
          >
            {restore.isPending ? "Putting them back…" : "Restore the client"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
