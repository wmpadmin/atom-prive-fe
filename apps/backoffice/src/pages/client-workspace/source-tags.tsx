import { cn } from "@atomprive/ui";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Where each card's figures come from, shown on the client whose figures come only from his bank's files (asked for
 * on 12 Nov 2026, local only). Taken from "Where each number comes from - Portfolio screens.docx": the bank's file,
 * Bloomberg (confirmed for company figures, still to confirm elsewhere), what the firm enters on the platform, or
 * "Source pending" where the client has not yet said.
 */
type Kind = "file" | "bloomberg" | "pending";
type Source = [text: string, kind: Kind];

const FILE: Source = ["EFG bank file", "file"];
const WORKED: Source = FILE;
const MODEL: Source = ["Model portfolio + EFG bank file", "file"];
const ENTERED: Source = ["Entered by staff", "file"];
const FUNDS: Source = ["Fund statements", "file"];
const BLOOMBERG: Source = ["Bloomberg", "bloomberg"];
const WITH_BLOOMBERG: Source = ["EFG bank file + Bloomberg", "bloomberg"];
const TO_CONFIRM: Source = ["Bloomberg (to confirm)", "bloomberg"];
const WITH_TO_CONFIRM: Source = ["EFG bank file + Bloomberg (to confirm)", "bloomberg"];
const PENDING: Source = ["Source pending", "pending"];

/** By screen, then by the start of a card's title or a tile's label; the longest match wins. */
const SOURCES: Record<string, Record<string, Source>> = {
  overview: {
    "Net Worth Evaluation": ["EFG bank file + entered by staff", "file"],
    "Asset Allocation": WORKED,
    "Target vs Actual Allocation": MODEL,
    Performance: WITH_TO_CONFIRM,
    "Liquidity Profile": PENDING,
    "Top 10 Positions": WORKED,
    "Projected Cash Flows": PENDING,
    "Holding Entities": PENDING,
    "Beneficial Look-through": PENDING,
    "Alerts & Notes": ENTERED,
    MTD: WORKED,
    "YTD (TWR)": WORKED,
    "Liquid ≤ 30 days": PENDING,
    "Unfunded commitments": PENDING,
    "Income · next 12M": WITH_TO_CONFIRM,
    "Relationship lead": ENTERED,
    Mandate: ENTERED,
    Benchmark: ENTERED,
    "Base currency": ENTERED,
    "Client since": ENTERED,
    "Last review": PENDING,
    "Next review": PENDING,
    "Risk profile": ENTERED,
  },
  structure: {
    "Ownership Structure": PENDING,
    "Entity Register": PENDING,
    "Beneficial Interest Matrix": PENDING,
    "Asset Mix by Entity": PENDING,
    "Governance Calendar": PENDING,
    "Legal entities": PENDING,
    Jurisdictions: PENDING,
    Beneficiaries: PENDING,
    "Trustees & directors": PENDING,
    "KYC / CRS refresh due": ENTERED,
  },
  ips: {
    "Investment policy statement": PENDING,
    "Compliance Scorecard": PENDING,
    "Risk & Liquidity Budget": PENDING,
    "Strategic Asset Allocation": MODEL,
    "Sub-class Deviations": MODEL,
    "Deviation from Target": MODEL,
    "Objective Tracking": PENDING,
    "Constraint Checks": PENDING,
    "Deviation & Exception Log": PENDING,
  },
  holdings: {
    "Market value": FILE,
    "Cost basis": FILE,
    "Unrealised P&L": WORKED,
    "Realised P&L": FILE,
    "Income · YTD": FILE,
    Reconciliation: FILE,
    "By Custodian": WORKED,
    "By Currency": WORKED,
    "Unrealised P&L by Asset Class": WORKED,
    "Tax Lots": FILE,
    "Recent Transactions": FILE,
  },
  performance: {
    "Return · YTD": WORKED,
    "Money-weighted": WORKED,
    "Annualised · ITD": WORKED,
    "Since inception · ITD": WORKED,
    "Sharpe ratio": FILE,
    "Information ratio": WITH_TO_CONFIRM,
    "Max drawdown": WORKED,
    "Up / down capture": WITH_TO_CONFIRM,
    "Value added": WITH_TO_CONFIRM,
    Benchmark: TO_CONFIRM,
    "Growth of $100": WITH_TO_CONFIRM,
    "Excess Return Bridge": PENDING,
    "Returns by Asset Class": WORKED,
    "Brinson-Fachler Attribution": PENDING,
    "Calendar-year Returns": WORKED,
    "Rolling 12-month Return": WORKED,
    "Monthly Returns": WORKED,
    "Risk-adjusted Statistics": WITH_TO_CONFIRM,
    "Fee Impact": PENDING,
  },
  risk: {
    "VaR · 95%": PENDING,
    "Expected shortfall": PENDING,
    "Volatility · ex-ante": PENDING,
    "Beta to mandate benchmark": WITH_TO_CONFIRM,
    "Worst stress": PENDING,
    "Diversification ratio": PENDING,
    "Risk Contribution vs Capital": PENDING,
    "Factor Exposures": PENDING,
    "Correlation Matrix": PENDING,
    "Sector Look-through": WITH_TO_CONFIRM,
    "Stress Tests & Scenarios": PENDING,
    "Geographic Look-through": WITH_TO_CONFIRM,
    "Currency Exposure": FILE,
    "Issuer Look-through": WITH_TO_CONFIRM,
    "VaR History": PENDING,
    "Liquidity Ladder": PENDING,
  },
  equity: {
    "P/E": BLOOMBERG,
    "Price / Book": BLOOMBERG,
    "Return on equity": BLOOMBERG,
    "Dividend yield": BLOOMBERG,
    "EPS growth": BLOOMBERG,
    "Net debt / EBITDA": BLOOMBERG,
    "Beta (vs ACWI)": BLOOMBERG,
    "Wtd. avg. market cap": BLOOMBERG,
    "Active share": WITH_BLOOMBERG,
    "Tracking error": WITH_BLOOMBERG,
    "Holdings · coverage": WITH_BLOOMBERG,
    "Equity Segments": MODEL,
    "Sector Allocation vs Benchmark": WITH_BLOOMBERG,
    "Region & Style": WITH_BLOOMBERG,
    "Equity Holdings · Fundamentals": WITH_BLOOMBERG,
    "Valuation vs Quality": BLOOMBERG,
    "Contribution to Return": WORKED,
    "Market-cap Distribution": WITH_BLOOMBERG,
    Concentration: WORKED,
    "Top 10 weight": WORKED,
    "Effective # names": WORKED,
    Largest: WORKED,
    HHI: WORKED,
    "Valuation History": BLOOMBERG,
  },
  "fixed-income": {
    "Yield to maturity": TO_CONFIRM,
    "Yield to worst": TO_CONFIRM,
    "Modified duration": TO_CONFIRM,
    "Effective duration": TO_CONFIRM,
    Convexity: TO_CONFIRM,
    "Weighted avg. coupon (WAC)": TO_CONFIRM,
    "Average rating": TO_CONFIRM,
    "OAS · credit spread": TO_CONFIRM,
    DV01: TO_CONFIRM,
    "Spread duration": TO_CONFIRM,
    "Weighted avg. maturity": TO_CONFIRM,
    "Income · next 12M": WITH_TO_CONFIRM,
    "Fixed Income Segments": MODEL,
    "Maturity Ladder": WITH_TO_CONFIRM,
    "Credit Quality": WITH_TO_CONFIRM,
    "Holdings on the Curve": WITH_TO_CONFIRM,
    "Sector Mix": WITH_TO_CONFIRM,
    "Bond & Fund Holdings": WITH_TO_CONFIRM,
    "Key Rate Durations": WITH_TO_CONFIRM,
    "Rate & Spread Scenarios": WITH_TO_CONFIRM,
    "Issuer Concentration": WITH_TO_CONFIRM,
    "Coupon & Redemption Calendar": WITH_TO_CONFIRM,
    "Maturing ≤ 2Y": WITH_TO_CONFIRM,
    "Reinvestment risk": WITH_TO_CONFIRM,
    "Largest year": WITH_TO_CONFIRM,
  },
  "private-markets": {
    Commitments: PENDING,
    "Paid-in capital": FILE,
    Distributions: FILE,
    "Net asset value": FUNDS,
    Unfunded: PENDING,
    "Net IRR": ["EFG bank file + fund statements", "file"],
    "Alternative Segments": MODEL,
    "J-Curve & Cash-flow History": ["EFG bank file + fund statements", "file"],
    Diversification: FUNDS,
    "Fund Commitments": PENDING,
    "Manager Scorecard": FUNDS,
    "Pacing Forecast": PENDING,
    "Notices & Cash Events": ["EFG bank file + fund statements", "file"],
    "Hedge Funds": FILE,
    TVPI: ["EFG bank file + fund statements", "file"],
    DPI: ["EFG bank file + fund statements", "file"],
    RVPI: ["EFG bank file + fund statements", "file"],
    MOIC: ["EFG bank file + fund statements", "file"],
    "Fee drag": PENDING,
  },
  collectibles: {
    "Register value": ENTERED,
    Items: ENTERED,
    "Insured value": PENDING,
    "Appraisals due": ENTERED,
    "Carrying cost": PENDING,
    Documentation: ENTERED,
    "Asset Register": ENTERED,
    "Item record": ENTERED,
    "Register Value Over Time": ENTERED,
    "Insurance Coverage": PENDING,
    "Locations & Custody": PENDING,
    "Upcoming Obligations": PENDING,
    Yacht: ENTERED,
    "Fine art": ENTERED,
    "Classic cars": ENTERED,
    Watches: ENTERED,
    Wine: ENTERED,
    Jewellery: ENTERED,
  },
};

// One colour for every label (12 Nov 2026): the words say where a figure comes from, the colour does not.
const TONE: Record<Kind, string> = {
  file: "bg-canvas text-ink-soft ring-line",
  bloomberg: "bg-canvas text-ink-soft ring-line",
  pending: "bg-canvas text-ink-soft ring-line",
};

const ScreenSources = createContext<string | null>(null);

/** Turns the labels on for one screen; nothing is shown outside it, or for a client whose figures are not the bank's. */
export function SourceTags({ screen, children }: { screen: string | null; children: ReactNode }) {
  return <ScreenSources.Provider value={screen}>{children}</ScreenSources.Provider>;
}

/** The source of the card or tile named `label`, under its name; nothing where the labels are off or none is listed. */
export function SourceTag({ label }: { label: string }) {
  const screen = useContext(ScreenSources);
  const listed = screen ? SOURCES[screen] : undefined;
  if (!listed) return null;
  const key = Object.keys(listed)
    .filter((one) => label.toLowerCase().startsWith(one.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const [text, kind] = listed[key];
  return (
    <span className={cn("mt-1.5 block w-fit max-w-full rounded-full px-2 py-0.5 text-2xs leading-snug font-semibold break-words ring-1", TONE[kind])}>
      {text}
    </span>
  );
}
