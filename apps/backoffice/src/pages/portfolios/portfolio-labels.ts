/** Whether a portfolio is inside the range its model allows, or outside it, as the API names it. */
export type DriftStanding = "WITHIN_BAND" | "BREACHED";



export const standingLabels: Record<DriftStanding, string> = {
  WITHIN_BAND: "Within band",
  BREACHED: "Deviation",
};

export const standingTones: Record<DriftStanding, "success" | "danger"> = {
  WITHIN_BAND: "success",
  BREACHED: "danger",
};

/**
 * The ink a drift figure is written in. It follows the standing beside it rather than the sign of the
 * number: a client's drift adds up how far every class has wandered either way, so it is never negative,
 * and colouring it by sign painted the worst deviation on the page a healthy green.
 */
export const driftTones: Record<DriftStanding, string> = {
  WITHIN_BAND: "text-emerald-700",
  BREACHED: "text-red-600",
};

/**
 * Drift as the screens write it: "+6.4%", "−6.0%", and a true zero as "0.0%".
 *
 * <p>Percentage POINTS, written with a per-cent sign because that is how the firm reads them: a class
 * asked for twenty and sitting at twenty-six is six away, not thirty per cent more. The sign carries
 * which side of the target it has gone.
 */
export function driftLabel(drift: number) {
  const rounded = drift.toFixed(1);
  if (Number(rounded) > 0) return `+${rounded}%`;
  if (Number(rounded) < 0) return `−${rounded.replace("-", "")}%`;
  return "0.0%";
}

/**
 * What a portfolio is worth, in full: "USD 41,790".
 *
 * <p>For the places with room for it — the head of a client's own screen, where this is the figure
 * somebody came to read. A column takes the short form below instead.
 */
export function worthLabel(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

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

/** Average drift, which has no side to it: "2.6%". */
export function averageDriftLabel(drift: number) {
  return `${drift.toFixed(1)}%`;
}

/**
 * The three profiles the firm's Risk Profile questionnaire gives, least to most that a client can be asked to
 * bear — the order the questionnaire itself prints them in. A model says which it is written for, and a client is
 * matched to it by the one their questionnaire came out as, so both sides read from here.
 */
export const RISK_PROFILES = [
  { value: "CONSERVATIVE", label: "Conservative" },
  { value: "BALANCED", label: "Balanced" },
  { value: "AGGRESSIVE", label: "Aggressive" },
] as const;

/** The words of the platform's earlier five-profile questionnaire, for a client or model still carrying one. */
const EARLIER: Record<string, string> = { MODERATE: "Moderate", BALANCE: "Balance", GROWTH: "Growth" };

/** Whether a profile is one of the earlier questionnaire's, which no model can match. */
export function isEarlierProfile(profile: string | null | undefined) {
  return Boolean(profile && EARLIER[profile]);
}

/** What a risk profile is called on screen; one from the earlier questionnaire says so; a missing one says so. */
export function riskProfileLabel(profile: string | null | undefined) {
  if (profile && EARLIER[profile]) return `${EARLIER[profile]} (earlier questionnaire)`;
  return RISK_PROFILES.find((one) => one.value === profile)?.label ?? "Not set";
}

/** A model's profile in the list: its own, or what it was before the three came in while the PM has still to choose. */
export function modelRiskLabel(profile: string | null | undefined, was: string | null | undefined) {
  if (!profile && was && EARLIER[was]) return `Was ${EARLIER[was]} · choose a profile`;
  return riskProfileLabel(profile);
}

/**
 * Where a class's own card sits on the page, so the table that measures a class can send somebody to what
 * it is made of. Shared with the table's side of the journey rather than spelled out twice.
 */
export function anchorFor(assetClass: string) {
  return `holdings-${assetClass}`;
}
