import { ApiError } from "@atomprive/api-client";
import { useMyProposals, type ClientProposalRow } from "@atomprive/api-client/portal";
import { Inbox } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { day, whole } from "./figures";

/**
 * Proposals: the changes the firm suggests to the client's portfolio, for them to approve or reject (S91). Newest
 * first, with a dot on the ones they have not opened and the day each must be answered by.
 */

const TABS = [
  { id: "all", label: "All", status: null },
  { id: "waiting", label: "Waiting for you", status: "PENDING" },
  { id: "approved", label: "Approved", status: "APPROVED" },
  { id: "rejected", label: "Rejected", status: "REJECTED" },
  { id: "expired", label: "Expired", status: "EXPIRED" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProposalsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.find((one) => one.id === params.get("tab"))?.id ?? "all";
  const proposals = useMyProposals<ClientProposalRow[], ApiError>();
  const all = proposals.data ?? [];
  const wanted = TABS.find((one) => one.id === tab)?.status ?? null;
  const shown = wanted === null ? all : all.filter((one) => one.status === wanted);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Proposals</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Changes your relationship manager suggests to your portfolio. Nothing moves until you approve.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div role="tablist" aria-label="Proposals" className="flex gap-2 overflow-x-auto border-b border-line p-3">
          {TABS.map((one) => (
            <button
              key={one.id}
              type="button"
              role="tab"
              aria-selected={tab === one.id}
              onClick={() => setParams({ tab: one.id }, { replace: true })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                tab === one.id ? "border-brand-900 bg-brand-900 text-on-fill" : "border-line text-ink-soft hover:bg-sidebar"
              }`}
            >
              {one.label}{" "}
              <span className="font-bold opacity-75">
                {one.status === null ? all.length : all.filter((row) => row.status === one.status).length}
              </span>
            </button>
          ))}
        </div>

        {proposals.isError ? (
          <p className="py-10 text-center text-sm text-access-none-ink">Your proposals could not be loaded. Refresh the page to try again.</p>
        ) : !proposals.data ? (
          <div className="m-5 h-40 animate-pulse rounded-xl bg-sidebar" />
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox aria-hidden="true" className="size-8 text-ink-muted" />
            <p className="text-sm text-ink-muted">{all.length === 0 ? "No proposals have been sent to you yet." : "Nothing here."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th className="w-[40%] px-4 py-2.5">Proposal</th>
                  <th className="px-4 py-2.5">From</th>
                  <th className="px-4 py-2.5">Received</th>
                  <th className="px-4 py-2.5">Answer by</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className="relative px-4 py-3">
                      {!row.opened && row.status === "PENDING" && (
                        <span aria-label="Not opened yet" className="absolute top-1/2 left-1.5 size-2 -translate-y-1/2 rounded-full bg-primary-600" />
                      )}
                      <Link to={`/new/proposals/${row.id}`} className="font-bold text-ink hover:underline">
                        {row.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-ink-muted tabular-nums">
                        {row.reference} · {row.moves} {row.moves === 1 ? "move" : "moves"}
                        {row.currency ? ` · ${whole(row.total, row.currency)}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.writtenBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">{day(row.sentAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">{row.status === "PENDING" ? day(row.answerBy) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill row={row} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/new/proposals/${row.id}`}
                        className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold ${
                          row.status === "PENDING"
                            ? "bg-primary-600 text-on-accent shadow-xs hover:bg-primary-700"
                            : "border border-line bg-white text-ink shadow-xs hover:bg-slate-50"
                        }`}
                      >
                        {row.status === "PENDING" ? "Review" : "Open"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function shortDay(at: string | null | undefined) {
  return at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}

/** Where a proposal has got to, in a word and a colour, with the day it ended where it has. */
export function StatusPill({ row }: { row: ClientProposalRow }) {
  const [label, tone] =
    row.status === "PENDING"
      ? ["Waiting for you", "bg-access-view-soft text-access-view-ink"]
      : row.status === "APPROVED"
        ? [`Approved ${shortDay(row.decidedAt)}`, "bg-access-full-soft text-access-full-ink"]
        : row.status === "REJECTED"
          ? [`Rejected ${shortDay(row.decidedAt)}`, "bg-access-none-soft text-access-none-ink"]
          : [`Expired ${shortDay(row.decidedAt)}`, "bg-canvas text-ink-muted"];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${tone}`}>{label}</span>;
}
