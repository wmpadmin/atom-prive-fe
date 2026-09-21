import type { ApiError } from "@atomprive/api-client";
import { useListMine, type MyDeclarationRow } from "@atomprive/api-client/backoffice";
import { Alert, Badge, cn } from "@atomprive/ui";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";

/**
 * My own declarations. Everyone at the firm signs the same nine, whatever else they do here; this is where
 * they read each one and sign it.
 */
export function MyDeclarationsPage() {
  const mine = useListMine<MyDeclarationRow[], ApiError>();
  const rows = mine.data ?? [];
  const signed = rows.filter((one) => one.signed).length;
  const outstanding = rows.length - signed;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">My declarations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The nine declarations everyone at the firm signs. Each is kept for the regulator and asked for again on
          its own cycle.
        </p>
      </header>

      {mine.isError && <Alert tone="danger">{mine.error.message}</Alert>}

      {mine.data && (
        <p className="text-sm text-ink">
          {outstanding === 0 ? (
            <span className="font-semibold text-emerald-700">All nine signed. Nothing outstanding.</span>
          ) : (
            <>
              <span className="font-semibold">{signed} of {rows.length} signed</span>
              <span className="text-ink-muted"> · {outstanding} still to sign</span>
            </>
          )}
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((row, at) => (
          <li key={row.kind}>
            <Link
              to={`/my-declarations/${row.kind}`}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-white px-5 py-4 transition-colors",
                row.signed ? "border-line hover:border-primary-100" : "border-line hover:border-primary-600",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-2xs font-semibold text-ink-muted">
                {at + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{row.title}</span>
                <span className={cn("block text-xs", row.overdue && !row.signed ? "text-red-600" : "text-ink-muted")}>
                  {row.schedule}
                  {row.signed && row.signedOn
                    ? ` · signed ${formatDate(row.signedOn)}`
                    : row.overdue && row.dueOn
                      ? ` · overdue since ${formatDate(row.dueOn)}`
                      : row.dueOn
                        ? ` · due ${formatDate(row.dueOn)}`
                        : ""}
                </span>
              </span>
              <Badge tone={row.signed ? "success" : "danger"}>{row.signed ? "Signed" : "Unsigned"}</Badge>
              <span
                className={cn(
                  "inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap",
                  row.signed ? "bg-slate-100 text-ink-soft" : "border border-line bg-white text-ink shadow-xs",
                )}
              >
                {row.signed ? "View" : "Read and sign"}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
        {mine.isPending && <li className="text-sm text-ink-muted">Loading your declarations…</li>}
      </ul>
    </div>
  );
}
