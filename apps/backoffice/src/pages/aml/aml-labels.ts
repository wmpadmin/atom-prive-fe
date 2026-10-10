import type { BandRowDueDiligence } from "@atomprive/api-client/backoffice";

/** What a band obliges, in the words the form uses. */
export const dueDiligenceLabels: Record<BandRowDueDiligence, string> = {
  SIMPLIFIED: "Simplified",
  STANDARD: "Standard",
  ENHANCED: "Enhanced",
};

/**
 * How a band is drawn: from where the band starts on the scale, never from the score.
 *
 * <p>Not from the name, because the names are the firm's and it may well not call them Low, Medium and High.
 * And not from the score, because the two part company exactly where it matters: an answer that settles it
 * on its own puts a client in the worst band on a score of twelve, and reading the score would draw them in
 * the colour used for the safest.
 */
export function bandTone(from: number): "success" | "warning" | "danger" {
  if (from >= 61) return "danger";
  if (from >= 31) return "warning";
  return "success";
}
