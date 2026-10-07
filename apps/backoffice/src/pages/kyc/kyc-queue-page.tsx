import { ApiError } from "@atomprive/api-client";
import {
  useListClientsForReview,
  type ReviewQueue,
  type ReviewRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, SelectInput, TextInput } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { clientTypeLabels } from "../clients/client-labels";
import { countryName } from "../../lib/countries";
import { standingLabels, standings, standingTones } from "./kyc-labels-review";

/**
 * The queue Compliance work through: the clients whose KYC is pending.
 *
 * <p>Pending means somebody has sent something in and the firm has not decided yet, which is what there is to
 * work through. A client who has sent nothing is not here — there is nothing to decide on — and nor is one
 * already settled.
 *
 * <p>The papers themselves are decided on one by one on KYC document review; a form is read rather than decided
 * on here, since a filled-in form goes to the client's advisor to be signed.
 */
export function KycReviewQueuePage() {
  // Operations follow the same queue to see where a client has got to; the decision is Compliance's.
  const decides = hasAuthority(useStaffUser(), "APPROVE_ONBOARDING:CHANGE");
  const [typed, setTyped] = useState("");
  const [standing, setStanding] = useState("");
  const query = useDebouncedValue(typed, 250);
  const queue = useListClientsForReview<ReviewQueue, ApiError>(
    { query: query || undefined, standing: (standing || undefined) as never, size: 50 },
    { query: { placeholderData: keepPreviousData } },
  );
  const rows = queue.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">KYC review queue</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {decides
            ? "The clients whose KYC is pending. Open one to read what they sent, then approve it or reject it with a reason."
            : "The clients whose KYC is pending. Open one to see where it has got to; the decision is Compliance's."}
        </p>
      </header>

      {queue.isError && <Alert tone="danger">{queue.error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Pending review"
          count={queue.data?.pendingReview}
          hint={queue.data ? `${queue.data.readyForDecision} ready for the decision` : ""}
        />
        <Tile label="Expiring" count={queue.data?.expiring} hint="A paper lapses within 30 days" />
        <Tile label="Rejected" count={queue.data?.rejected} hint="Refused, with a reason on file" />
        <Tile label="Re-upload" count={queue.data?.reUpload} hint="Waiting on the client" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <TextInput
            id="kyc-search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Search clients"
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
        <SelectInput
          id="kyc-standing"
          value={standing}
          onChange={(event) => setStanding(event.target.value)}
          aria-label="Filter by where the review has got to"
          className="w-56"
        >
          <option value="">Every client</option>
          {standings.map((one) => (
            <option key={one} value={one}>
              {standingLabels[one]}
            </option>
          ))}
        </SelectInput>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <div className="px-5 pt-5">
          <h2 className="text-base font-bold">Clients in review</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {queue.data
              ? `${queue.data.totalItems} client${queue.data.totalItems === 1 ? "" : "s"} pending. A client is ready to decide on once every paper on their checklist is in and approved.`
              : "A client is ready to decide on once every paper on their checklist is in and approved."}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Client</th>
                <th scope="col" className="px-4 py-3">Waiting on Compliance</th>
                <th scope="col" className="px-4 py-3">Still needed</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="py-3 pr-5 pl-4">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {queue.isPending && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">Loading the queue…</td>
                </tr>
              )}
              {queue.data && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-muted">
                    {query || standing
                      ? "No client matches that."
                      : "No client's KYC is pending. They arrive here once something has been sent in for the firm to decide on."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <Row key={row.customerId} row={row} decides={decides} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** One count the queue is read by: what it is, how many, and what that means. */
function Tile({ label, count, hint }: { label: string; count?: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-ink">{count ?? "—"}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

function Row({ row, decides }: { row: ReviewRow; decides: boolean }) {
  const navigate = useNavigate();
  return (
    <tr
      // The client's file is opened from both KYC screens, so it carries which one it came from: the menu
      // highlights that one, and Back returns to it.
      onClick={() => void navigate(`/kyc/${row.customerId}?from=queue`)}
      className="cursor-pointer hover:bg-slate-50/60"
    >
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-3">
          <Avatar name={row.clientName} />
          <div className="min-w-0">
            <span className="block truncate font-semibold">{row.clientName}</span>
            <span className="block truncate text-xs text-ink-muted">
              {clientTypeLabels[row.clientType]}
              {row.countryCode && ` · ${countryName(row.countryCode)}`}
            </span>
          </div>
        </div>
      </td>
      {/* Two different questions, and a row that answered only one of them read as though a client who had
          sent something had sent nothing. What is here to be looked at, and what is still to come. */}
      <td className="px-4 py-3">
        {row.waitingOn.length > 0 ? (
          <ul className="space-y-0.5">
            {row.waitingOn.map((paper) => (
              <li key={paper} className="font-semibold whitespace-nowrap text-ink-soft">{paper}</li>
            ))}
          </ul>
        ) : (
          <span className="text-ink-muted">Nothing to look at</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.stillNeeded ? (
          <span className="text-ink-soft">{row.stillNeeded}</span>
        ) : (
          <span className="text-ink-muted">Nothing — every paper is in</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tone={standingTones[row.standing]}>{standingLabels[row.standing]}</Badge>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(row.updatedAt)}</td>
      <td className="py-3 pr-5 pl-4 text-right">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
          {decides && row.standing === "READY" ? "Decide" : "Open"}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </span>
      </td>
    </tr>
  );
}
