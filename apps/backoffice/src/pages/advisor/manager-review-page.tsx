import { ApiError } from "@atomprive/api-client";
import { useListProposals, type ProposalPage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { formatValue } from "./proposal-labels";

/**
 * What is waiting on a sign-off, for whoever gives it (#88).
 *
 * <p>A sign-off is what sends a proposal to the client, and it is somebody else's to give: whoever wrote it
 * cannot pass their own. Their proposals are still listed, because a queue that quietly left some out would
 * have a manager hunting for one that never arrived — they are marked as theirs instead.
 */
export function ManagerReviewPage() {
  const navigate = useNavigate();
  const user = useStaffUser();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const waiting = useListProposals<ProposalPage, ApiError>(
    { status: "PENDING_MANAGER_REVIEW", page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  if (waiting.isError) {
    return <Alert tone="danger">{waiting.error.message}</Alert>;
  }
  const rows = waiting.data?.items ?? [];
  const total = waiting.data?.totalItems ?? 0;
  const mine = rows.filter((row) => row.advisorId === user.id).length;
  // Counted over this page rather than the whole queue: the API gives no firm-wide figure, and claiming one
  // from a single page would understate it on every page but the last.
  const overdue = rows.filter((row) => row.signOffOverdue).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Waiting on your sign-off</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Proposals an advisor has sent for approval. Open one to read it in full, then pass it to the client or
          send it back with what has to be put right. Nothing reaches a client until it is passed.
        </p>
      </header>

      {overdue > 0 && (
        <Alert tone="warning">
          {overdue === 1 ? "One proposal on this page has" : `${overdue} proposals on this page have`} been waiting
          more than two days. Whoever can pass {overdue === 1 ? "it" : "them"} has been told once.
        </Alert>
      )}

      {mine > 0 && (
        <Alert tone="info">
          {mine === 1 ? "One of these is yours" : `${mine} of these are yours`}, so somebody else signs{" "}
          {mine === 1 ? "it" : "them"} off. You can read {mine === 1 ? "it" : "them"}, but not pass your own work.
        </Alert>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">
                  Proposal
                </th>
                <th scope="col" className="px-4 py-3">
                  Client
                </th>
                <th scope="col" className="px-4 py-3">
                  Written by
                </th>
                <th scope="col" className="px-4 py-3">
                  Waiting since
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Value
                </th>
                <th scope="col" className="py-3 pr-5 pl-4 text-right">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!waiting.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {waiting.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    Nothing is waiting on you.
                  </td>
                </tr>
              )}
              {rows.map((proposal) => {
                const yours = proposal.advisorId === user.id;
                return (
                  <tr
                    key={proposal.id}
                    onClick={() => void navigate(`/proposals/${proposal.id}`)}
                    className="cursor-pointer hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-4 pl-5">
                      <Link
                        to={`/proposals/${proposal.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-semibold hover:text-primary-600"
                      >
                        {proposal.title}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {proposal.reference}
                        {proposal.summary && ` · ${proposal.summary}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={proposal.customerName} />
                        <div>
                          <span className="block">{proposal.customerName}</span>
                          <span className="block font-mono text-xs text-ink-muted">{proposal.customerCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {proposal.advisorName}
                      {yours && <Badge tone="neutral">Yours</Badge>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {/* When it was sent for a sign-off. The draft may have been started long before. */}
                      {proposal.submittedAt ? formatDate(proposal.submittedAt) : "—"}
                      {proposal.signOffOverdue && (
                        <Badge tone="warning">Waiting too long</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatValue(proposal.valueAmount, proposal.valueCurrency)}
                    </td>
                    <td className="py-3 pr-5 pl-4 text-right">
                      <Button variant="secondary" size="sm">
                        {yours ? "Read" : "Review"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              noun={["proposal", "proposals"]}
            />
          </div>
        )}
      </section>
    </div>
  );
}
