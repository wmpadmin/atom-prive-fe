/**
 * The asset classes a model is spread across, in the order the firm's papers list them. They are the keys of
 * the target and holding maps, which the API describes as plain strings, so they are named once here.
 */
export type AssetClass = "EQUITIES" | "FIXED_INCOME" | "ALTERNATIVES" | "CASH";

export const ASSET_CLASSES: AssetClass[] = ["EQUITIES", "FIXED_INCOME", "ALTERNATIVES", "CASH"];

/** How far a portfolio has wandered from its model, as the API names it. */
export type DriftStanding = "WITHIN_BAND" | "WATCH" | "AT_EDGE" | "BREACHED";

export const assetClassLabels: Record<AssetClass, string> = {
  EQUITIES: "Equities",
  FIXED_INCOME: "Fixed income",
  ALTERNATIVES: "Alternatives",
  CASH: "Cash",
};

/** What a crowded column calls it: "Eq 49% · FI 36% · Alt 7%". */
export const assetClassShort: Record<AssetClass, string> = {
  EQUITIES: "Eq",
  FIXED_INCOME: "FI",
  ALTERNATIVES: "Alt",
  CASH: "Cash",
};

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

/** The colour each asset class is drawn in, so one bar reads the same on every screen. */
export const assetClassBars: Record<AssetClass, string> = {
  EQUITIES: "bg-primary-600",
  FIXED_INCOME: "bg-sky-400",
  ALTERNATIVES: "bg-violet-500",
  CASH: "bg-slate-300",
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
