/**
 * The sub-assets the firm names under each asset class.
 *
 * <p>Kept here for now, in the shape the API will hand it over in, so the screens that read it do not change
 * when it moves. The firm's asset classes went the same way: compiled in, then read from the API once there
 * was a table and a screen to keep them on.
 *
 * <p>This list is what a client's allocation is written down against. It is not a closed list: a portfolio
 * holds what it holds, and a client's money can sit in something the firm has never written down. Anything
 * somebody adds for one client is theirs — named, changed and taken off on that client's own screen —
 * whereas these are the firm's, and are not a client's to reword.
 */
export type SubAssetClass = {
  /** The asset class it belongs under, as the firm's own list codes it. */
  assetClass: string;
  /** What it is called. This is also what a holding stores, so renaming one here renames nothing already written. */
  name: string;
};

const FIRMS_OWN: SubAssetClass[] = [
  { assetClass: "EQUITIES", name: "Global Equities – MSCI ACWI" },
  { assetClass: "EQUITIES", name: "US Equities – S&P 500" },
  { assetClass: "EQUITIES", name: "US Equities – Nasdaq" },
  { assetClass: "EQUITIES", name: "US Equities – Semiconductor" },
  { assetClass: "EQUITIES", name: "European Equities" },
  { assetClass: "EQUITIES", name: "Asian Equities" },
  { assetClass: "EQUITIES", name: "Japanese Equities" },
  { assetClass: "EQUITIES", name: "Chinese Equities" },
  { assetClass: "EQUITIES", name: "Indian Equities" },
  { assetClass: "EQUITIES", name: "Equity ETF" },

  { assetClass: "FIXED_INCOME", name: "Investment Grade" },
  { assetClass: "FIXED_INCOME", name: "High Yield" },
  { assetClass: "FIXED_INCOME", name: "Subordinated / Perpetual" },
  { assetClass: "FIXED_INCOME", name: "Fixed Income Structured Product" },
  { assetClass: "FIXED_INCOME", name: "Fixed Income Mutual Fund" },

  { assetClass: "FOREX", name: "Forex" },
  { assetClass: "FOREX", name: "FX Derivatives" },

  { assetClass: "ALTERNATIVES", name: "Precious Metals / Commodities" },
  { assetClass: "ALTERNATIVES", name: "Yield Enhancement Strategies" },
  { assetClass: "ALTERNATIVES", name: "Private Market Investments" },
  { assetClass: "ALTERNATIVES", name: "Mixed-Asset Investments" },

  { assetClass: "CASH", name: "Current Account / Deposit" },

  { assetClass: "TACTICAL", name: "Tactical Equity" },
  { assetClass: "TACTICAL", name: "Tactical Forex" },
  { assetClass: "TACTICAL", name: "Other Equities" },
];

/**
 * The sub-assets the firm names, by the class they sit under, in the order the firm sets them out.
 *
 * <p>A class the firm names none under is absent rather than empty, which is the same answer read either
 * way: there is nothing here but what somebody writes down for this client.
 */
export function useSubAssetClasses() {
  const byClass: Record<string, string[]> = {};
  for (const one of FIRMS_OWN) {
    (byClass[one.assetClass] ??= []).push(one.name);
  }
  return {
    all: FIRMS_OWN,
    byClass,
    /** Whether this name is the firm's, and so not one client's to reword or take off. */
    isTheFirms: (assetClass: string, name: string) =>
      (byClass[assetClass] ?? []).includes(name.trim()),
  };
}
