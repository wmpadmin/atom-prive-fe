import { ApiError } from "@atomprive/api-client";
import {
  useListProposals,
  type ListProposalsStatus,
  type ProposalPage,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Pagination } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { formatDate } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { expiryLabel, formatValue, proposalStatusLabels, proposalStatusTones } from "./proposal-labels";

/** The tabs across the top; "Expiring soon" is a view of those with the client, not a status of its own. */
type Tab = "all" | "draft" | "manager" | "client" | "expiringSoon" | "approved" | "rejected" | "expired";

const TABS: { id: Tab; label: string; status?: ListProposalsStatus; expiringSoon?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts", status: "DRAFT" },
  { id: "manager", label: "With the manager", status: "PENDING_MANAGER_REVIEW" },
  { id: "client", label: "With the client", status: "PENDING_REVIEW" },
  { id: "expiringSoon", label: "Expiring soon", expiringSoon: true },
  { id: "approved", label: "Approved", status: "APPROVED" },
  { id: "rejected", label: "Rejected", status: "REJECTED" },
  { id: "expired", label: "Expired", status: "EXPIRED" },
];

/** Every proposal this advisor has written (#87). */
export function ProposalsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const chosen = TABS.find((one) => one.id === tab) ?? TABS[0]!;

  function changeTab(next: Tab) {
    setTab(next);
    setPage(0);
  }

  const proposals = useListProposals<ProposalPage, ApiError>(
    { status: chosen.status, expiringSoon: chosen.expiringSoon, page, size: pageSize },
    { query: { placeholderData: keepPreviousData } },
  );

  if (proposals.isError) {
    return <Alert tone="danger">{proposals.error.message}</Alert>;
  }
  const counts = proposals.data?.counts;
  const countFor: Record<Tab, number | undefined> = {
    all: counts?.all,
    draft: counts?.draft,
    manager: counts?.awaitingManager,
    client: counts?.awaitingClient,
    expiringSoon: counts?.expiringSoon,
    approved: counts?.approved,
    rejected: counts?.rejected,
    expired: counts?.expired,
  };
  const total = proposals.data?.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">Proposals</h1>
          <p className="mt-1 text-sm text-ink-muted">
            What you've put to your clients. Advisory only — the platform never places a trade.
          </p>
        </div>
        <Link to="/proposals/new">
          <Button>
            <Plus aria-hidden="true" />
            New proposal
          </Button>
        </Link>
      </header>

      <div role="tablist" aria-label="Proposals" className="flex flex-wrap gap-2">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => changeTab(one.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
              tab === one.id ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-soft hover:text-ink"
            }`}
          >
            {one.label}
            {countFor[one.id] !== undefined && <span className="ml-2 tabular-nums opacity-80">{countFor[one.id]}</span>}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Proposal</th>
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Sent</th>
                <th scope="col" className="px-4 py-3">Value</th>
                <th scope="col" className="px-4 py-3">Expiry</th>
                <th scope="col" className="py-3 pr-5 pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!proposals.data && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading proposals…</td>
                </tr>
              )}
              {proposals.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {tab === "all" ? "You haven't written a proposal yet." : "Nothing in this tab."}
                  </td>
                </tr>
              )}
              {(proposals.data?.items ?? []).map((proposal) => (
                // The row opens the proposal, the same as its name does.
                <tr
                  key={proposal.id}
                  onClick={() => void navigate(`/proposals/${proposal.id}`)}
                  className="cursor-pointer hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 pl-5">
                    <Link to={`/proposals/${proposal.id}`} onClick={(event) => event.stopPropagation()} className="font-semibold hover:text-primary-600">
                      {proposal.title}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {proposal.reference}
                      {proposal.summary && ` · ${proposal.summary}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{proposal.customerName}</span>
                    <span className="block font-mono text-xs text-ink-muted">{proposal.customerCode}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                    {proposal.sentAt ? formatDate(proposal.sentAt) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatValue(proposal.valueAmount, proposal.valueCurrency)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${proposal.expiringSoon ? "font-semibold text-amber-700" : "text-ink-soft"}`}>
                    {expiryLabel(proposal.expiresAt, proposal.status as ProposalRowStatus)}
                  </td>
                  <td className="py-3 pr-5 pl-4">
                    <Badge tone={proposalStatusTones[proposal.status as ProposalRowStatus]}>
                      {proposalStatusLabels[proposal.status as ProposalRowStatus]}
                    </Badge>
                  </td>
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
