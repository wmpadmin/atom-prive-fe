import type { ProposalPage, ProposalRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";
import { proposalStatusLabels } from "./proposal-labels";

/** As many as the list is asked for at a time; a whole-list export reads it a page of this size at a time. */
export const EXPORT_LIMIT = 100;

/** A field as a CSV writes it: quoted, with any quote of its own doubled. */
export function quoted(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

/**
 * @param everyAdvisors whether this export covers more than one person's writing, in which case it has
 * to say whose each row is — a firm-wide file with no author column cannot be read back
 */
export function csvOf(rows: ProposalPage["items"], everyAdvisors: boolean) {
  const head = ["Reference", "Proposal", "Summary", "Client", "Client code",
    ...(everyAdvisors ? ["Written by"] : []),
    "Sent", "Value", "Currency", "Answered", "Answered by", "Status"];
  const lines = rows.map((row) =>
    [
      row.reference,
      row.title,
      row.summary ?? "",
      row.customerName,
      row.customerCode,
      ...(everyAdvisors ? [row.advisorName] : []),
      row.sentAt ? formatDate(row.sentAt) : "",
      row.valueAmount ?? "",
      row.valueCurrency ?? "",
      row.decidedAt ? formatDate(row.decidedAt) : "",
      row.answeredByName ?? "",
      proposalStatusLabels[row.status as ProposalRowStatus],
    ]
      .map(quoted)
      .join(","),
  );
  return [head.map(quoted).join(","), ...lines].join("\r\n");
}
