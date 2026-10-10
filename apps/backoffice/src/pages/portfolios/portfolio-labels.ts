/** How far a portfolio has wandered from its model, as the API names it. */
export type DriftStanding = "WITHIN_BAND" | "WATCH" | "AT_EDGE" | "BREACHED";



export const standingLabels: Record<DriftStanding, string> = {
  WITHIN_BAND: "Within band",
  WATCH: "Watch",
  AT_EDGE: "At edge",
  BREACHED: "Breached",
};

export const standingTones: Record<DriftStanding, "success" | "neutral" | "warning" | "danger"> = {
  WITHIN_BAND: "success",
  WATCH: "neutral",
  AT_EDGE: "warning",
  BREACHED: "danger",
};

/**
 * The ink a drift figure is written in. It follows the standing beside it rather than the sign of the
 * number: a client's drift adds up how far every class has wandered either way, so it is never negative,
 * and colouring it by sign painted the worst breach on the page a healthy green.
 */
export const driftTones: Record<DriftStanding, string> = {
  WITHIN_BAND: "text-emerald-700",
  WATCH: "text-ink",
  AT_EDGE: "text-amber-700",
  BREACHED: "text-red-600",
};

/** Drift as the screens write it: "+6.4pp", "−6.0pp", and a true zero as "0.0pp". */
export function driftLabel(drift: number) {
  const rounded = drift.toFixed(1);
  if (Number(rounded) > 0) return `+${rounded}pp`;
  if (Number(rounded) < 0) return `−${rounded.replace("-", "")}pp`;
  return "0.0pp";
}

/** What a portfolio is worth, short enough for a column: "USD 42.6M". */
export function underManagementLabel(amount: number, currency: string) {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  return `${currency} ${amount.toFixed(0)}`;
}

/** Where a model has got to, as the list says it. */
export type ModelStatus = "DRAFT" | "LIVE" | "RETIRED";

export const modelStatusLabels: Record<ModelStatus, string> = {
  DRAFT: "Draft",
  LIVE: "Live",
  RETIRED: "Retired",
};

export const modelStatusTones: Record<ModelStatus, "success" | "neutral" | "warning"> = {
  DRAFT: "warning",
  LIVE: "success",
  RETIRED: "neutral",
};

/** Average drift, which has no side to it: "2.6pp". */
export function averageDriftLabel(drift: number) {
  return `${drift.toFixed(1)}pp`;
}
