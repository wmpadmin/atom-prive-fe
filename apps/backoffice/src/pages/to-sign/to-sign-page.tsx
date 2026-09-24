import type { ApiError } from "@atomprive/api-client";
import { useListPacksToSign, type SignaturePackPage } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, cn } from "@atomprive/ui";
import { ChevronRight, FileSignature } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { packTones, whatIsLeft } from "./to-sign-labels";

/**
 * What has been sent to the signed-in advisor to sign (#39). Operations write a client's forms up and send
 * them out a pack at a time; this is where the advisor's half of the signing is done.
 */
export function ToSignPage() {
  const [waiting, setWaiting] = useState(true);
  const [page, setPage] = useState(0);
  const packs = useListPacksToSign<SignaturePackPage, ApiError>(
    { waiting, page, size: 10 },
    { query: { placeholderData: (kept) => kept } },
  );
  const rows = packs.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">To sign</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Forms your clients' paperwork needs your signature on. Each form is signed on its own, because each of
          them is its own document.
        </p>
      </header>

      {packs.isError && <Alert tone="danger">{packs.error.message}</Alert>}

      <div className="flex items-center justify-between gap-4">
        <div role="group" aria-label="Which packs to show" className="flex gap-2">
          {[
            { value: true, label: "Waiting on me" },
            { value: false, label: "Everything sent to me" },
          ].map((choice) => (
            <button
              key={String(choice.value)}
              type="button"
              onClick={() => {
                setWaiting(choice.value);
                setPage(0);
              }}
              className={cn(
                "h-9 rounded-lg border px-4 text-sm font-semibold transition-colors",
                waiting === choice.value
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-line bg-white text-ink hover:border-primary-600",
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
        {packs.data && (
          <p className="text-sm text-ink-muted">
            {packs.data.waitingOnMe === 0 ? (
              <span className="font-semibold text-emerald-700">Nothing waiting on you.</span>
            ) : (
              <>
                <span className="font-semibold text-ink">{packs.data.waitingOnMe}</span> waiting on you
              </>
            )}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((pack) => (
          <li key={pack.id}>
            <Link
              to={`/to-sign/${pack.id}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 transition-colors hover:border-primary-600"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-muted">
                <FileSignature aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{pack.clientName}</span>
                <span className="block text-xs text-ink-muted">
                  {pack.reference} · {pack.formCount === 1 ? "1 form" : `${pack.formCount} forms`} · sent by{" "}
                  {pack.sentByName} on {formatDate(pack.sentAt)}
                  {pack.dueOn ? ` · due ${formatDate(pack.dueOn)}` : ""}
                </span>
              </span>
              {pack.overdue && <Badge tone="danger">Overdue</Badge>}
              <Badge tone={packTones[pack.status]}>{pack.statusLabel}</Badge>
              <span className="text-xs font-semibold whitespace-nowrap text-ink-soft">
                {whatIsLeft(pack.formsToSign, pack.formCount)}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
        {packs.isPending && <li className="text-sm text-ink-muted">Loading…</li>}
        {packs.data && rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
            {waiting ? "Nothing is waiting on your signature." : "Nothing has been sent to you to sign yet."}
          </li>
        )}
      </ul>

      {packs.data && packs.data.totalItems > packs.data.size && (
        <Pagination
          page={packs.data.page}
          pageSize={packs.data.size}
          totalItems={packs.data.totalItems}
          onPageChange={setPage}
          noun={["pack", "packs"]}
        />
      )}
    </div>
  );
}
