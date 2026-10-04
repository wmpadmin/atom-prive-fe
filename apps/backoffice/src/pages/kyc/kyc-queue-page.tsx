import { ApiError } from "@atomprive/api-client";
import { useListOnboardingCases, type CasePage } from "@atomprive/api-client/backoffice";
import { Alert, Avatar } from "@atomprive/ui";
import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

/**
 * The clients waiting on a KYC sign-off. Operations hand a client over once their details are in; Compliance
 * read what was submitted and sign it off, or send it back. The papers themselves are reviewed one by one on
 * KYC document review, and a form is read rather than decided on: a filled-in form goes to the client's
 * advisor to be signed, not here.
 */
export function KycReviewQueuePage() {
  // Operations follow the same queue to see where a client has got to; signing it off is Compliance's.
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");
  // The cases Operations have handed over. That handover is the whole queue: nothing else puts a client in
  // front of Compliance.
  const cases = useListOnboardingCases<CasePage, ApiError>(
    { signOff: "AWAITING", size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">KYC sign-off</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {decides
            ? "The clients Operations have handed over. Open one to read the case and its forms, then sign the client's KYC off or send it back."
            : "The clients handed over for KYC sign-off, and what Compliance have made of them. Open one to see where it has got to; the sign-off is Compliance's."}
        </p>
      </header>

      {cases.isError && <Alert tone="danger">{cases.error.message}</Alert>}

      <ClientsAwaitingReview cases={cases} decides={decides} />
    </div>
  );
}

/**
 * The clients Operations have handed over for KYC. This is the queue proper: Operations finish a client's
 * details, submit the case for sign-off, and the client lands here for Compliance to read and sign off.
 */
function ClientsAwaitingReview({
  cases,
  decides,
}: {
  cases: UseQueryResult<CasePage, ApiError>;
  decides: boolean;
}) {
  const navigate = useNavigate();
  const rows = cases.data?.items ?? [];
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="px-5 pt-5">
        <h2 className="text-base font-bold">Clients awaiting KYC sign-off</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {decides
            ? "Here once Operations have handed the case over. Open one to read it, then sign the client's KYC off."
            : "Here once Operations have handed the case over. Open one to see where it has got to."}
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Client</th>
              <th scope="col" className="px-4 py-3">Relationship manager</th>
              <th scope="col" className="px-4 py-3">Waiting since</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cases.isPending && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
              </tr>
            )}
            {cases.data && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-muted">
                  No client is waiting for KYC sign-off. They arrive as Operations finish a client's details
                  and hand the case over.
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
                <td className="px-4 py-3 text-ink-soft">{row.relationshipManager?.fullName ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.updatedAt)}</td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                    {decides ? "Sign off" : "Open"}
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
