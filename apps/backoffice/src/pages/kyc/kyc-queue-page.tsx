import { ApiError } from "@atomprive/api-client";
import { useListOnboardingCases, type CasePage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar } from "@atomprive/ui";
import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { formatRelative } from "../../lib/labels";

/**
 * The clients waiting on a KYC decision. Operations hand a client over once their details are in; Compliance
 * read what was submitted and sign it off, or send it back. The papers themselves are reviewed one by one on
 * KYC document review.
 */
export function KycReviewQueuePage() {
  const cases = useListOnboardingCases<CasePage, ApiError>(
    { signOff: "AWAITING", size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">KYC review</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The clients whose forms Operations have sent for review. Open one to read each form, approve it or
          send it back, and sign the client's KYC off.
        </p>
      </header>

      {cases.isError && <Alert tone="danger">{cases.error.message}</Alert>}

      <ClientsAwaitingReview cases={cases} />
    </div>
  );
}

/**
 * The clients Operations have handed over for KYC. This is the queue proper: Operations finish a client's
 * forms, submit them for KYC, and the client lands here for Compliance to review and sign off.
 */
function ClientsAwaitingReview({ cases }: { cases: UseQueryResult<CasePage, ApiError> }) {
  const navigate = useNavigate();
  // Handed over is not the same as sent for review: a client appears here only once Operations have
  // finished a form and sent it, which is what puts something in front of Compliance to read.
  const rows = (cases.data?.items ?? []).filter((row) => row.formsForReview > 0);
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-5 pt-5">
        <h2 className="text-base font-bold">Clients awaiting KYC review</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Here once Operations have sent a form for review. Open one to read it, decide on each form, and sign
          the client's KYC off.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Client</th>
              <th scope="col" className="px-4 py-3">Forms</th>
              <th scope="col" className="px-4 py-3">Relationship manager</th>
              <th scope="col" className="px-4 py-3">Waiting since</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Review</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cases.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
              </tr>
            )}
            {cases.data && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  No client is waiting for KYC review. They arrive as Operations finish a form and send it
                  for review.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => void navigate(`/kyc/cases/${row.id}`)}
                className="cursor-pointer hover:bg-slate-50/60"
              >
                <td className="py-3 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.clientName} />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">{row.clientName}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {row.clientType === "ENTITY" ? "Entity" : `${row.accountHolders} account holder${row.accountHolders === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                  {row.formsForReview} {row.formsForReview === 1 ? "form" : "forms"}
                </td>
                <td className="px-4 py-3 text-ink-soft">{row.relationshipManager?.fullName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.updatedAt)}</td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                    Review
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
