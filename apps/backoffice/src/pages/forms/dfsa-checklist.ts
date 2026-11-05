import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The DFSA client onboarding checklist: what has to be on file before an account is opened.
 *
 * Every line here is the checklist's own line, word for word. On paper it is a column of boxes to tick and
 * nowhere to put what you ticked them for, so here each line is ticked and the document itself is attached to
 * it — the checklist and the file it asks for in the same place. The headings the paper marks "(if applicable)"
 * are asked for only where they apply, so a client with no company is not held up by a trade licence.
 */

export interface ChecklistItem {
  /** Where the answer lives, and the line an attached document is kept against. */
  id: string;
  text: string;
  /** What the paper lists underneath the line, as the things it must cover. */
  covers?: string[];
}

export interface ChecklistGroup {
  id: string;
  heading: string;
  /** What the paper says under the heading, before its boxes. */
  note?: string;
  /** The paper marks it "(if applicable)", so nothing under it is insisted on. */
  whereItApplies?: boolean;
  items: ChecklistItem[];
}

export const entityChecklistGroups: ChecklistGroup[] = [
  {
    id: "identification",
    heading: "\u{1F510} Basic Identification Documents",
    items: [
      { id: "identification.passport", text: "Valid Passport" },
      { id: "identification.visa", text: "Valid UAE Visa" },
      { id: "identification.emiratesId", text: "Emirates ID" },
      {
        id: "identification.address",
        text: "Proof of Address (Utility Bill/Bank Statement; if joint holders, both required OR RM visitation letter for one)",
      },
    ],
  },
  {
    id: "financial",
    heading: "\u{1F4B0} Financial Information",
    items: [
      { id: "financial.bankStatement", text: "Recent Bank Statement (to reflect available cash)" },
      { id: "financial.otherInvestments", text: "Proof of Other Investments for K&E (FD, SIP, MF, Stocks, etc.)" },
    ],
  },
  {
    id: "business",
    heading: "\u{1F3E2} Business Ownership (if applicable)",
    whereItApplies: true,
    items: [
      { id: "business.auditedReport", text: "Audited Report / Balance Sheet of the business for last 3 yrs" },
      { id: "business.tradeLicences", text: "Trade License(s) of all owned companies" },
      { id: "business.incumbency", text: "Certificate of Incumbency" },
      {
        id: "business.shareholders",
        text: "Shareholder Identification – if full names not on trade license, provide supporting documents",
      },
      {
        id: "business.writeUp",
        text: "Business Write-up:",
        covers: [
          "Establishment story: how, when, and capital source",
          "Current operations and business model",
          "Details if sister company if any",
        ],
      },
    ],
  },
  {
    id: "property",
    heading: "\u{1F3E0} Property Ownership (if applicable)",
    whereItApplies: true,
    items: [{ id: "property.titleDeed", text: "Title Deed for owned property" }],
  },
  {
    id: "wealth",
    heading: "\u{1F4DC} Source of Wealth (SOW) & Source of Funds (SOF)",
    items: [
      { id: "wealth.evidence", text: "Clear documentation/evidence of SOW and SOF" },
      { id: "wealth.statementOfIncome", text: "SOI (Statement of Income) for previous roles, to strengthen the case" },
    ],
  },
  {
    id: "profiling",
    heading: "\u{1F4D6} Client Profiling (for each holder, including joint)",
    note: "Use bold section headers when documenting the profile.",
    items: [
      { id: "profiling.birth", text: "Birth Details", covers: ["Date of Birth", "City and Country"] },
      {
        id: "profiling.education",
        text: "Education History",
        covers: [
          "School Name, Place, Period",
          "College Name, Place, Period",
          "Higher Education (if any), Place, Period",
        ],
      },
      {
        id: "profiling.family",
        text: "Family Background",
        covers: [
          "Spouse (Name, DOB and Summary)",
          "Children (Names, DOB and Summary)",
          "If joint holder, provide full profiling for them as well",
        ],
      },
      {
        id: "profiling.work",
        text: "Work Experience (Chronologically)",
        covers: [
          "No year gaps – explain any breaks",
          "For each role:",
          "Company Name",
          "Job Title",
          "Job Description",
          "Duration",
          "Salary (in USD)",
        ],
      },
      {
        id: "profiling.netWorth",
        text: "Net Worth Statement",
        covers: ["With supporting evidence (assets, investments, etc.)"],
      },
      {
        id: "profiling.liabilities",
        text: "Loans & Liabilities",
        covers: ["Type (Mortgage, Personal Loan, Leverage, etc.)", "Amount and Tenure"],
      },
      { id: "profiling.goals", text: "Client’s Achievements & Life Goals" },
      {
        id: "profiling.noObjection",
        text: "No Objection letter from the Board/Shareholders for this investment, account opening with {{firmShortName}} and related trades placed in future, also appointment of signing authority to be mentioned.",
      },
    ],
  },
];

/**
 * The same checklist as the firm writes it for an individual client. It asks for a few things the entity copy
 * does not — salary proof, insurance, portfolio statements, a breakdown of what the client spends in a year —
 * and does not ask a person for a board's no-objection letter or a certificate of incumbency.
 */
export const individualChecklistGroups: ChecklistGroup[] = [
  {
    id: "identification",
    heading: "\u{1F510} Basic Identification Documents",
    items: [
      { id: "identification.passport", text: "Valid Passport" },
      { id: "identification.visa", text: "Valid UAE Visa" },
      { id: "identification.emiratesId", text: "Emirates ID" },
      {
        id: "identification.address",
        text: "Proof of Address (Utility Bill/Bank Statement; if joint holders, both required OR RM visitation letter for one)",
      },
    ],
  },
  {
    id: "financial",
    heading: "\u{1F4B0} Financial Information",
    items: [
      { id: "financial.bankStatement", text: "Recent Bank Statement (to reflect available cash)" },
      { id: "financial.salaryProof", text: "Salary Proof (last 3 months \u2013 Bank Statement and/or Salary Slips)" },
      { id: "financial.otherInvestments", text: "Proof of Other Investments (FD, SIP, MF, Stocks, etc.)" },
      { id: "financial.insurance", text: "Policy Documents of Insurance (Life, Term, Jumbo, etc.)" },
      {
        id: "financial.portfolioStatements",
        text: "Portfolio Statements (LLB, UBS, BOS, LO, LGT, SC, JSS, JB, etc.)",
      },
    ],
  },
  {
    id: "business",
    heading: "\u{1F3E2} Business Ownership (if applicable)",
    whereItApplies: true,
    items: [
      { id: "business.auditedReport", text: "Audited Report / Balance Sheet of the business" },
      { id: "business.tradeLicences", text: "Trade License(s) of all owned companies" },
      {
        id: "business.shareholders",
        text: "Shareholder Identification \u2013 if full names not on trade license, provide supporting documents",
      },
      {
        id: "business.writeUp",
        text: "Business Write-up:",
        covers: ["Establishment story: how, when, and capital source", "Current operations and business model"],
      },
    ],
  },
  {
    id: "property",
    heading: "\u{1F3E0} Property Ownership (if applicable)",
    whereItApplies: true,
    items: [{ id: "property.titleDeed", text: "Title Deed for owned property" }],
  },
  {
    id: "wealth",
    heading: "\u{1F4DC} Source of Wealth (SOW) & Source of Funds (SOF)",
    items: [
      { id: "wealth.evidence", text: "Clear documentation/evidence of SOW and SOF" },
      { id: "wealth.statementOfIncome", text: "SOI (Statement of Income) for previous roles, to strengthen the case" },
    ],
  },
  {
    id: "profiling",
    heading: "\u{1F4D6} Client Profiling (for each holder, including joint)",
    note: "Use bold section headers when documenting the profile.",
    items: [
      { id: "profiling.birth", text: "Birth Details", covers: ["Date of Birth", "City and Country"] },
      {
        id: "profiling.education",
        text: "Education History",
        covers: [
          "School Name, Place, Period",
          "College Name, Place, Period",
          "Higher Education (if any), Place, Period",
        ],
      },
      {
        id: "profiling.family",
        text: "Family Background",
        covers: [
          "Spouse (Name, DOB and Summary)",
          "Children (Names, DOB and Summary)",
          "If joint holder, provide full profiling for them as well",
        ],
      },
      {
        id: "profiling.work",
        text: "Work Experience (Chronologically)",
        covers: [
          "No year gaps \u2013 explain any breaks",
          "For each role:",
          "Company Name",
          "Job Title",
          "Job Description",
          "Duration",
          "Salary (in USD)",
        ],
      },
      {
        id: "profiling.expenses",
        text: "Lifestyle & Annual Expenses (Detailed breakdown):",
        covers: ["Grocery", "Utilities", "School Fees", "Holidays/Travel", "Rent/Housing", "Domestic Help", "Others"],
      },
      {
        id: "profiling.netWorth",
        text: "Net Worth Statement",
        covers: ["With supporting evidence (assets, investments, etc.)"],
      },
      {
        id: "profiling.liabilities",
        text: "Loans & Liabilities",
        covers: ["Type (Mortgage, Personal Loan, Leverage, etc.)", "Amount and Tenure"],
      },
      { id: "profiling.netWorthLessLiabilities", text: "Calculate Net worth minus Liabilities" },
      { id: "profiling.goals", text: "Client\u2019s Achievements & Life Goals" },
    ],
  },
];

export interface DfsaChecklistEntity {
  /** Which lines have been ticked off, by the line's own id. */
  obtained: Record<string, boolean>;
  /** The headings the paper marks "(if applicable)", and whether they apply to this client. */
  applies: Record<string, boolean>;
}

export function emptyDfsaChecklist(): DfsaChecklistEntity {
  return { obtained: {}, applies: {} };
}

/** What the API holds, filled out to the whole form so every box has something to tick. */
export function toDfsaChecklist(saved: FormDetailAnswers | undefined): DfsaChecklistEntity {
  const empty = emptyDfsaChecklist();
  if (!saved) return empty;
  const held = saved as Partial<DfsaChecklistEntity>;
  return { obtained: { ...empty.obtained, ...held.obtained }, applies: { ...empty.applies, ...held.applies } };
}

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/**
 * What is still missing. A heading marked "(if applicable)" is answered by saying whether it applies; once it
 * does, everything under it is expected like everything else.
 */
export function reviewDfsaChecklist(groups: ChecklistGroup[], value: DfsaChecklistEntity): FormReview {
  const problems: Record<string, string> = {};
  for (const group of groups) {
    if (group.whereItApplies && value.applies[group.id] !== true) {
      // Nothing under it is asked for until someone says it applies.
      if (value.applies[group.id] === undefined) {
        problems[`applies.${group.id}`] = "Say whether this applies to the client.";
      }
      continue;
    }
    for (const item of group.items) {
      if (!value.obtained[item.id]) problems[`obtained.${item.id}`] = "This is still to be obtained.";
    }
  }
  return {
    problems,
    steps: groups.map((group) => ({
      id: group.id,
      group: "Checklist",
      label: group.heading,
      complete: none(problems, `obtained.${group.id}.`) && none(problems, `applies.${group.id}`),
    })),
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfDfsaChecklistField(groups: ChecklistGroup[], field: string): string {
  const at = field.indexOf(".");
  const rest = at < 0 ? field : field.slice(at + 1);
  const group = groups.find((one) => rest === one.id || rest.startsWith(`${one.id}.`));
  return group?.id ?? groups[0]!.id;
}

/** The checklist prints no instructions of its own beyond its headings, so none are put in its mouth. */
export const dfsaChecklistGuidance: Record<string, string> = {};

export function dfsaChecklistDescriptions(groups: ChecklistGroup[]): Record<string, string> {
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      group.note ??
        (group.whereItApplies
          ? "Only where it applies to this client."
          : "Tick each one off, and attach what was obtained."),
    ]),
  );
}
