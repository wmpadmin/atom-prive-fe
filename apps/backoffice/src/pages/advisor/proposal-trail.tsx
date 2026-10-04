import type { TrailEntry } from "@atomprive/api-client/backoffice";
import { formatDateTime } from "../../lib/labels";

/**
 * Everything that has happened to a proposal, newest first. It is the audit trail's own record, which nothing
 * rewrites — so what a client was sent, and when, can be shown rather than asserted.
 */
export function ProposalTrail({ trail }: { trail: TrailEntry[] }) {
  if (trail.length === 0) {
    return <p className="px-6 py-6 text-sm text-ink-muted">Nothing has happened to this proposal yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Every event on this proposal, newest first.</caption>
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-3 pr-4 pl-6">
              Timestamp
            </th>
            <th scope="col" className="px-4 py-3">
              Actor
            </th>
            <th scope="col" className="px-4 py-3">
              Event
            </th>
            <th scope="col" className="py-3 pr-6 pl-4">
              Ref
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {trail.map((entry, at) => (
            <tr key={`${entry.at}-${at}`}>
              <td className="py-3 pr-4 pl-6 whitespace-nowrap text-ink-soft tabular-nums">
                {formatDateTime(entry.at)}
              </td>
              <td className="px-4 py-3">{entry.actor}</td>
              <td className="px-4 py-3">{entry.event}</td>
              <td className="py-3 pr-6 pl-4 font-mono text-xs text-ink-muted">{entry.reference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
