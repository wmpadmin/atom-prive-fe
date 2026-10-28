import type { ApiError } from "@atomprive/api-client";
import { ArchivedMark, archivedRow } from "../../components/archived-client";
import { useListPacksToSign, type SignaturePackPage } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Pagination, cn } from "@atomprive/ui";
import { ChevronRight, FileSignature } from "lucide-react";
import { useState } from "react";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../lib/page-sizes";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { packTones, whatIsLeft } from "./to-sign-labels";

/**
 * The relationship manager's clients, and the forms of theirs waiting on a signature. A client is the row because
 * that is how a relationship manager holds them in mind; what is underneath is the forms, each signed or sent back on
 * its own.
 */
export function ToSignPage() {
  const [waiting, setWaiting] = useState(true);
  const [page, setPage] = useState(0);
  // Offered rather than fixed, so this footer reads like every other one in the portal.
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const packs = useListPacksToSign<SignaturePackPage, ApiError>(
    { waiting, page, size },
    { query: { placeholderData: (kept) => kept } },
  );
  const rows = packs.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">To sign</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your clients' forms, once whoever wrote them up has finished. Open a client to read each form and
          either sign it on their behalf or send it back to be put right. Your signature is what completes
          the form. Each is signed on its own, because each of them is its own document.
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
                  ? "border-primary-600 bg-primary-600 text-on-accent"
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
        {rows.map((pack) => {
          // A pack whose client has been deactivated stays on the queue and stops opening. There is nothing
          // left to sign for somebody the firm no longer acts for, and the row says so rather than
          // disappearing — a queue that empties itself when a client goes is a queue nobody can trust.
          const inside = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-muted">
                <FileSignature aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{pack.clientName}</span>
                <span className="block text-xs text-ink-muted">
                  {/* Nobody sends these any more — finishing a form is what sends it — so the line says when
                      the first of them arrived rather than who sent them. */}
                  {pack.formCount === 1 ? "1 form" : `${pack.formCount} forms`} · ready to sign since{" "}
                  {formatDate(pack.sentAt)}
                  {pack.dueOn ? ` · due ${formatDate(pack.dueOn)}` : ""}
                </span>
                {pack.clientArchived && <ArchivedMark />}
              </span>
              {pack.overdue && !pack.clientArchived && <Badge tone="danger">Overdue</Badge>}
              <Badge tone={packTones[pack.status]}>{pack.statusLabel}</Badge>
              <span className="text-xs font-semibold whitespace-nowrap text-ink-soft">
                {whatIsLeft(pack.formsToSign, pack.formCount)}
              </span>
              {!pack.clientArchived && (
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              )}
            </>
          );
          const shell = "flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4";
          return (
            <li key={pack.id}>
              {pack.clientArchived ? (
                <div className={cn(shell, archivedRow)}>{inside}</div>
              ) : (
                <Link to={`/to-sign/${pack.id}`} className={cn(shell, "transition-colors hover:border-primary-600")}>
                  {inside}
                </Link>
              )}
            </li>
          );
        })}
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
          pageSizes={PAGE_SIZES}
          onPageSizeChange={(next) => {
            setSize(next);
            setPage(0);
          }}
          noun={["pack", "packs"]}
        />
      )}
    </div>
  );
}
