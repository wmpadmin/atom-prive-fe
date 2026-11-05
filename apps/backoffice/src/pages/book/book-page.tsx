import { ApiError } from "@atomprive/api-client";
import {
  getListBookQueryKey,
  useListBook,
  useStarClient,
  useUnstarClient,
  type BookPage,
  type BookRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Pagination, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { money } from "./book-figures";

/**
 * A portfolio manager's clients, starred first.
 *
 * <p>Net worth is everything the client owns, managed or not, less everything they owe — the figure the
 * client's own overview opens with, so the list and the page it leads to cannot disagree about a client.
 */
export function ClientListPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const asked = useDeferredValue(query.trim());
  const book = useListBook<BookPage, ApiError>(
    { query: asked || undefined, page, size },
    { query: { placeholderData: keepPreviousData } },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Client list</h1>
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Search clients</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <TextInput
            id="book-search"
            type="search"
            className="pl-9"
            placeholder="Search by name or code"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>

      {book.isError && <Alert tone="danger">{book.error.message}</Alert>}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Your clients, starred first.</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="w-10 py-3 pl-4"><span className="sr-only">Starred</span></th>
                <th scope="col" className="py-3 pr-4 pl-2">Display name</th>
                <th scope="col" className="px-4 py-3">Net worth</th>
                <th scope="col" className="px-4 py-3">Base ccy</th>
                <th scope="col" className="px-4 py-3">Last transaction</th>
                <th scope="col" className="px-4 py-3">Last doc upload</th>
                <th scope="col" className="py-3 pr-6 pl-4">Last login</th>
              </tr>
            </thead>
            <tbody>
              {!book.data ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-ink-muted">Reading your clients…</td>
                </tr>
              ) : book.data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-ink-muted">
                    {asked ? `No client matches “${asked}”.` : "No clients have been put in your care yet."}
                  </td>
                </tr>
              ) : (
                book.data.items.map((row) => <Row key={row.customerId} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      {book.data && book.data.totalItems > 0 && (
        <Pagination
          page={page}
          pageSize={size}
          totalItems={book.data.totalItems}
          onPageChange={setPage}
          pageSizes={[20, 50, 100]}
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

function Row({ row }: { row: BookRow }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListBookQueryKey() });
  const star = useStarClient<ApiError>({ mutation: { onSuccess: refresh } });
  const unstar = useUnstarClient<ApiError>({ mutation: { onSuccess: refresh } });
  const busy = star.isPending || unstar.isPending;

  return (
    // The whole row opens the client, as the name does; the name stays a link so a keyboard and a
    // middle click reach it too. The star is the one thing on the row that does something else.
    <tr
      className="cursor-pointer border-b border-line last:border-b-0 hover:bg-canvas/60"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        void navigate(`/book/${row.customerId}`);
      }}
    >
      <td className="py-3 pl-4">
        <button
          type="button"
          aria-pressed={row.starred}
          aria-label={row.starred ? `Unstar ${row.name}` : `Star ${row.name}`}
          disabled={busy}
          onClick={() =>
            row.starred ? unstar.mutate({ customerId: row.customerId }) : star.mutate({ customerId: row.customerId })
          }
          className="grid size-7 place-items-center rounded-md text-ink-muted hover:text-amber-500 focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          <Star aria-hidden="true" className={cn("size-4", row.starred && "fill-amber-400 text-amber-500")} />
        </button>
      </td>
      <th scope="row" className="py-3 pr-4 pl-2 text-left font-medium">
        <Link to={`/book/${row.customerId}`} className="text-ink hover:text-primary-700 hover:underline">
          {row.name}
        </Link>
      </th>
      <td className="px-4 py-3 font-medium tabular-nums">{row.netWorth === null ? "—" : money(row.netWorth)}</td>
      <td className="px-4 py-3 text-ink-soft">{row.currency ?? "—"}</td>
      <td className="px-4 py-3 text-ink-soft tabular-nums">{row.lastTransactionOn ? formatDate(row.lastTransactionOn) : "—"}</td>
      <td className="px-4 py-3 text-ink-soft tabular-nums">{formatDateTime(row.lastDocumentAt, "—")}</td>
      <td className="py-3 pr-6 pl-4 text-ink-soft tabular-nums">{formatDateTime(row.lastLoginAt, "Never")}</td>
    </tr>
  );
}
