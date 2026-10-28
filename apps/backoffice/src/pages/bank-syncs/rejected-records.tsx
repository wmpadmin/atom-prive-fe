import { ApiError } from "@atomprive/api-client";
import { useRejectedRecords, type RejectedRecordRow } from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { useState } from "react";
import { formatDateTime } from "../../lib/labels";

/**
 * The lines the pipeline refused, and why (#49).
 *
 * <p>Separate from the failures above, because they are a different kind of problem and need a different
 * person. A failed run is a feed that would not answer — a connection, a credential, a bank having a bad
 * night. These are runs that worked perfectly and brought back something the platform would not put in
 * front of a client: a date in the future, a currency that does not exist, a quantity that is negative.
 * The first is chased with the bank; the second is almost always a mapping to correct.
 *
 * <p>Kept rather than logged, which is the whole point. A line thrown away in the night is the one
 * somebody asks about three weeks later, and "it was in the logs" is not an answer a regulated firm can
 * give.
 */
export function RejectedRecords() {
  const refused = useRejectedRecords<RejectedRecordRow[], ApiError>(
    { limit: 100 },
    { query: { refetchOnWindowFocus: false } },
  );
  const [open, setOpen] = useState<string | null>(null);

  if (refused.isError) {
    return <Alert tone="danger">{refused.error.message}</Alert>;
  }
  const rows = refused.data ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold">Records that were refused</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Lines a bank sent that the platform would not store. The run itself worked — these are about what
          came back, and are usually a mapping to correct rather than a bank to chase.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem]">
          <thead>
            <tr className="border-b border-line bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="px-5 py-2.5 text-left">Refused</th>
              <th className="px-4 py-2.5 text-left">Account</th>
              <th className="px-4 py-2.5 text-left">Why</th>
              <th className="px-4 py-2.5 text-left">What was wrong</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {/* The headings stay when there is nothing under them: an empty table reads as empty, where a
                missing one reads as a screen that failed to draw. */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                  {refused.isPending ? "Reading…" : "Nothing has been refused. Every line a bank sent was stored."}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <RefusedRow
                key={row.id}
                row={row}
                open={open === row.id}
                onOpen={() => setOpen(open === row.id ? null : row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RefusedRow({ row, open, onOpen }: { row: RejectedRecordRow; open: boolean; onOpen: () => void }) {
  return (
    <>
      <tr
        onClick={onOpen}
        className={cn("cursor-pointer border-b border-line hover:bg-slate-50/60", open && "bg-primary-50/40")}
      >
        <td className="px-5 py-3 text-sm whitespace-nowrap text-ink-soft tabular-nums">
          {formatDateTime(row.rejectedAt)}
        </td>
        {/* As the bank wrote it. A record can be refused precisely because this matched nothing, and then
            the bank's own spelling of it is the only thing there is to go on. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-muted">
          {row.accountNumber ?? <span className="text-slate-400">None given</span>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <Badge tone={toneFor(row.reason)}>{row.reasonSaid}</Badge>
        </td>
        <td className="px-4 py-3 text-sm text-ink">{row.detail}</td>
        <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap text-primary-700">
          {open ? "Hide" : "The line itself"}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-canvas/60">
          <td colSpan={5} className="px-5 py-4">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">As the bank sent it</p>
            {/* Kept whole so a corrected mapping can be replayed against it rather than guessed at. */}
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-line bg-white p-3 text-xs text-ink">
              {row.raw}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Severity by what it means, not by how it reads.
 *
 * <p>A wrong ISIN or an unrecognised account is money about to be filed against the wrong thing, and is
 * the worst of these. A missing field is a mapping that has not been finished. Everything else is a bank
 * sending something odd.
 */
function toneFor(reason: string) {
  if (reason === "MALFORMED_INSTRUMENT" || reason === "UNKNOWN_ACCOUNT") {
    return "danger" as const;
  }
  if (reason.startsWith("MISSING_")) {
    return "warning" as const;
  }
  return "neutral" as const;
}
