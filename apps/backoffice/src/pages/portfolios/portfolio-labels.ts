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

/**
 * The five profiles the Investment Risk Profile questionnaire derives, least to most that a client can be
 * asked to bear — the order the questionnaire itself prints them in. A model says which it is written for,
 * and a client is matched to it by the one their questionnaire came out as, so both sides read from here.
 */
export const RISK_PROFILES = [
  { value: "CONSERVATIVE", label: "Conservative" },
  { value: "MODERATE", label: "Moderate" },
  { value: "BALANCE", label: "Balance" },
  { value: "GROWTH", label: "Growth" },
  { value: "AGGRESSIVE", label: "Aggressive" },
] as const;

/** What a model's risk profile is called on screen; a model nobody has set one on says so. */
export function riskProfileLabel(profile: string | null | undefined) {
  return RISK_PROFILES.find((one) => one.value === profile)?.label ?? "Not set";
}

/**
 * Where a class's own card sits on the page, so the table that measures a class can send somebody to what
 * it is made of. Shared with the table's side of the journey rather than spelled out twice.
 */
export function anchorFor(assetClass: string) {
  return `holdings-${assetClass}`;
}

/**
 * The worst standing among the groups inside a class, and how many are at it.
 *
 * <p>A class can sit well inside its own band while the money in it is in the wrong places, because being
 * over in one group and under in another cancels out. Said only on the groups themselves, that reads as a
 * class with nothing wrong until somebody opens it — and nobody opens a class with nothing wrong.
 *
 * <p>Nothing where every group is where it should be, or where the model says nothing about them.
 */
export function worstInside(
  groups: { standing: DriftStanding | null | undefined }[],
): { standing: DriftStanding; count: number } | null {
  const order: DriftStanding[] = ["WITHIN_BAND", "WATCH", "AT_EDGE", "BREACHED"];
  let worst: DriftStanding | null = null;
  for (const group of groups) {
    const its = group.standing;
    if (!its || its === "WITHIN_BAND") continue;
    if (worst === null || order.indexOf(its) > order.indexOf(worst)) worst = its;
  }
  if (worst === null) return null;
  return { standing: worst, count: groups.filter((one) => one.standing === worst).length };
}

/** "1 group breached", "2 groups at edge" — what a class is carrying, in the fewest words that say it. */
export function insideLabel(worst: { standing: DriftStanding; count: number }) {
  const said: Record<DriftStanding, string> = {
    WITHIN_BAND: "within band",
    WATCH: "to watch",
    AT_EDGE: "at edge",
    BREACHED: "breached",
  };
  return `${worst.count} ${worst.count === 1 ? "group" : "groups"} ${said[worst.standing]}`;
}
