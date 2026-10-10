import { ApiError } from "@atomprive/api-client";
import {
  useGetAmlMatrix,
  useListAmlRatedClients,
  type RatedClientsPage,
  type Sheet,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { hasAnyAuthority, READS_AML_MATRIX } from "../../lib/permissions";
import { bandTone } from "./aml-labels";
import { SheetNotReady } from "./sheet-not-ready";

/**
 * Where every client sits on the firm's money-laundering risk matrix.
 *
 * <p>The figure that matters most on a screen about risk is how many have never been scored at all, so it is
 * the one read first: a client nobody has rated is not a low-risk client, they are an unknown one.
 */
export function AmlRiskPage() {
  const navigate = useNavigate();
  const user = useStaffUser();
  const mayReadSheet = hasAnyAuthority(user, ...READS_AML_MATRIX);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Read here as well as on the client, so that a screen full of "Never rated" says why before anybody
  // opens one and finds a dead end.
  const sheet = useGetAmlMatrix<Sheet, ApiError>();

  const clients = useListAmlRatedClients<RatedClientsPage, ApiError>(
    { query: query.trim() || undefined, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  if (clients.isError) {
    return <Alert tone="danger">{clients.error.message}</Alert>;
  }
  const rows = clients.data?.items ?? [];
  const counts = clients.data?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ListPageHeader
          title="AML risk"
          lead="Where each client sits on the firm's money-laundering risk matrix, and when they are due to be looked at again."
        />
        {mayReadSheet && (
          <Link to="/aml-risk/matrix">
            <Button variant="secondary">
              <SlidersHorizontal aria-hidden="true" />
              The firm's matrix
            </Button>
          </Link>
        )}
      </div>

      {sheet.data && !sheet.data.complete && (
        <SheetNotReady faults={sheet.data.faults} mayRead={mayReadSheet} />
      )}

      {counts && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* First, and in red when there are any: nobody scored is not the same as scored low. */}
          <Fact label="Never rated" tone={counts.neverRated > 0 ? "danger" : undefined}>
            {counts.neverRated}
          </Fact>
          <Fact label="Due to be rated again" tone={counts.overdue > 0 ? "warning" : undefined}>
            {counts.overdue}
          </Fact>
          <Fact label="Clients">{counts.all}</Fact>
          <div className="rounded-xl border border-line bg-white px-4 py-3">
            <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">By band</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {Object.keys(counts.byBand).length === 0 ? (
                <span className="text-sm text-ink-muted">Nothing rated yet</span>
              ) : (
                Object.entries(counts.byBand).map(([band, howMany]) => (
                  <Badge key={band} tone="neutral">
                    {band} {howMany}
                  </Badge>
                ))
              )}
            </dd>
          </div>
        </dl>
      )}

      <div className="max-w-sm">
        <TextInput
          id="aml-search"
          aria-label="Search clients"
          value={query}
          placeholder="Search by name, email or code"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3 text-right">Score</th>
                <th scope="col" className="px-4 py-3">Band</th>
                <th scope="col" className="px-4 py-3">Due diligence</th>
                <th scope="col" className="px-4 py-3">Rated</th>
                <th scope="col" className="py-3 pr-5 pl-4">Due again</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!clients.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading the clients…</td>
                </tr>
              )}
              {clients.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {query.trim() ? "Nobody matches that." : "No clients yet."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.customerId}
                  onClick={() => void navigate(`/aml-risk/clients/${row.customerId}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.clientName} />
                      <div>
                        <Link
                          to={`/aml-risk/clients/${row.customerId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block font-medium hover:text-primary-600"
                        >
                          {row.clientName}
                        </Link>
                        <span className="block font-mono text-xs text-ink-muted">{row.clientCode}</span>
                      </div>
                    </div>
                  </td>
                  {row.standing ? (
                    <>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.standing.score}</td>
                      <td className="px-4 py-3">
                        <Badge tone={bandTone(row.standing.bandFrom)}>{row.standing.bandName}</Badge>
                        {/* Said on the row, because a band reached this way was not reached by the sum. */}
                        {row.standing.forcedBy && (
                          <span className="mt-1 block text-xs text-ink-muted">{row.standing.forcedBy}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {row.standing.dueDiligenceTitle}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {formatDate(row.standing.ratedAt)}
                        <span className="block text-xs text-ink-muted">{row.standing.ratedByName}</span>
                      </td>
                      <td
                        className={cn(
                          "py-3 pr-5 pl-4 whitespace-nowrap",
                          row.standing.overdue ? "font-semibold text-amber-700" : "text-ink-soft",
                        )}
                      >
                        {formatDate(row.standing.nextReviewOn)}
                        {row.standing.overdue && <span className="block text-xs">Waiting</span>}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-danger-700">
                        <ShieldAlert className="size-4" aria-hidden="true" />
                        Never rated
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(clients.data?.totalItems ?? 0) > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={clients.data?.totalItems ?? 0}
              onPageChange={setPage}
              pageSizes={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["client", "clients"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "danger" ? "text-danger-700" : tone === "warning" ? "text-amber-700" : "text-ink",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
