import type { LineRequest, LineRequestAction } from "@atomprive/api-client/backoffice";
import { Badge } from "@atomprive/ui";

const actionLabels: Record<LineRequestAction, string> = {
  REDUCE: "Reduce",
  INCREASE: "Increase",
  HOLD: "Hold",
};

/** Selling reads one way and buying the other; a hold is neither, so it stays quiet. */
const actionTones: Record<LineRequestAction, "danger" | "success" | "neutral"> = {
  REDUCE: "danger",
  INCREASE: "success",
  HOLD: "neutral",
};

function money(amount: number | null, currency: string | null) {
  if (amount === null) return null;
  const millions = amount / 1_000_000;
  const shown = millions >= 1 ? `${Number(millions.toFixed(millions >= 10 ? 0 : 1))}M` : amount.toLocaleString("en-GB");
  return `${currency ?? ""} ${shown}`.trim();
}

function weight(share: number) {
  return `${Number(share.toFixed(2))}%`;
}

/**
 * What a proposal asks be done, holding by holding. Written out rather than described, so a client can see at
 * a glance what moves and where it leaves them — and so the advice can be set against the model later.
 */
export function ProposalLines({ lines, currency }: { lines: LineRequest[]; currency: string | null }) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nothing is set out line by line on this proposal — the changes are described above.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Each holding, what is proposed for it, and where that leaves it.</caption>
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            <th scope="col" className="py-3 pr-4">
              Asset
            </th>
            <th scope="col" className="px-4 py-3">
              Action
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Amount
            </th>
            <th scope="col" className="py-3 pl-4 text-right">
              Weight shift
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((line, at) => (
            <tr key={`${line.asset}-${at}`}>
              <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                {line.asset}
              </th>
              <td className="px-4 py-3">
                <Badge tone={actionTones[line.action]}>{actionLabels[line.action]}</Badge>
              </td>
              {/* A hold moves nothing, so it has no amount to show. */}
              <td className="px-4 py-3 text-right tabular-nums">
                {money(line.amount ?? null, currency) ?? <span className="text-ink-muted">—</span>}
              </td>
              <td className="py-3 pl-4 text-right tabular-nums whitespace-nowrap">
                {weight(line.weightFrom)} <span className="text-ink-muted">→</span> {weight(line.weightTo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
