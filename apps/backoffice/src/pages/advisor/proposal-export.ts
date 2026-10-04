import type { ProposalPage, ProposalRowStatus } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";
import { proposalStatusLabels } from "./proposal-labels";

/** As many as one export carries; the list itself is never asked for more than this at a time. */
export const EXPORT_LIMIT = 100;

/** A field as a CSV writes it: quoted, with any quote of its own doubled. */
export function quoted(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function csvOf(rows: ProposalPage["items"]) {
  const head = ["Reference", "Proposal", "Summary", "Client", "Client code", "Sent", "Value", "Currency", "Expires", "Status"];
  const lines = rows.map((row) =>
    [
      row.reference,
      row.title,
      row.summary ?? "",
      row.customerName,
      row.customerCode,
      row.sentAt ? formatDate(row.sentAt) : "",
      row.valueAmount ?? "",
      row.valueCurrency ?? "",
      row.expiresAt ? formatDate(row.expiresAt) : "",
      proposalStatusLabels[row.status as ProposalRowStatus],
    ]
      .map(quoted)
      .join(","),
  );
  return [head.map(quoted).join(","), ...lines].join("\r\n");
}

/** Hands the file to the browser, which is as far as a back-office export needs to go. */
export function download(csv: string, name: string) {
  // A byte-order mark, or a spreadsheet opens a name with an accent in it as mojibake.
  const file = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

