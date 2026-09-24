import type { KycDocumentRowReviewState } from "@atomprive/api-client/backoffice";

export const reviewStateLabels: Record<KycDocumentRowReviewState, string> = {
  AWAITING_REVIEW: "Awaiting review",
  RE_UPLOAD_REQUESTED: "Re-upload asked for",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const reviewStateTones: Record<KycDocumentRowReviewState, "info" | "warning" | "success" | "danger"> = {
  AWAITING_REVIEW: "info",
  RE_UPLOAD_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/** How the client is described beside their name: what they are, and the code the firm quotes them by. */
export function clientLine(clientType: "INDIVIDUAL" | "ENTITY", clientCode: string) {
  return `${clientType === "ENTITY" ? "Entity" : "Individual"} · ${clientCode}`;
}

export function pageCount(pages: number | null) {
  if (pages === null) return "—";
  return pages === 1 ? "1 page" : `${pages} pages`;
}

/** What the file is, from its type, for the little mark beside the document's name. */
export function fileMark(contentType: string) {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "image/png") return "PNG";
  return "JPG";
}

export function fileSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
