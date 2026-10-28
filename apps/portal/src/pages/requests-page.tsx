import { ApiError } from "@atomprive/api-client";
import { useRequests, type FamilyRequest } from "@atomprive/api-client/portal";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { Face } from "./invitation-card";

/**
 * Families this client has been asked to join.
 *
 * <p>For somebody the firm already banks with. They have an account, so there is nothing to set up — only
 * something to agree to, and the agreeing is theirs rather than the firm's.
 *
 * <p>A list of doors, and no buttons on it. Accept and Decline used to sit on each card here, which meant
 * a client could join a family from a row that did not have room to say which family, when they were asked
 * or why. Each row now opens the request, and the answering happens where the reading does.
 */
export function RequestsPage() {
  const waiting = useRequests<FamilyRequest[], ApiError>();

  if (waiting.isPending) {
    return <p className="text-sm text-slate-500">Reading your requests…</p>;
  }
  if (waiting.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {waiting.error.message}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Families who have asked you to join them.</p>
      </header>

      {waiting.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
          Nothing is waiting on you.
        </p>
      ) : (
        <ul className="space-y-3">
          {waiting.data.map((one) => (
            <li key={one.id}>
              <Link
                to={`/requests/${one.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 hover:border-blue-300 hover:bg-blue-50/40"
              >
                <Face name={one.clientName} photo={one.clientPhoto} small />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">
                    {one.clientName}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    Asks you to join {one.familyName ?? "their family group"} as their{" "}
                    {one.relationship.toLowerCase()}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{when(one.invitedAt)}</span>
                <span aria-hidden="true" className="shrink-0 text-slate-300">
                  &rsaquo;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
