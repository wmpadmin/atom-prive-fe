import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * Appendix 4B, the entity customer due diligence form, part by part as the paper divides it.
 *
 * Every line here is the form's own line, word for word. The form is three sections with different people
 * behind them — the relationship manager fills in 1 and 2, the MLRO fills in 3 — so that is how it is set out,
 * and where a line asks for a document to be attached, the document is attached to that line.
 */

export type Classified = "ASSESSED" | "DEEMED" | "MARKET_COUNTERPARTY" | "SERVICE_BASED";

export type Rating = "LOW" | "MEDIUM" | "HIGH";

export type ScreeningResult = "NO_MATCH" | "PEP" | "OTHER";

export type ScreenedAs = "CUSTOMER" | "DIRECTOR" | "OWNER";

export type CddLevel = "LOW_SIMPLIFIED" | "LOW_STANDARD" | "MEDIUM_STANDARD" | "HIGH_ENHANCED";

/** The line of the form that asks for the signed Sheet 1 of the AML Risk Rating Matrix. */
export const RISK_MATRIX_SHEET = "risk.amlRiskRatingMatrix";

/** Where a row's attached copy is kept, so it stays against the line that asked for it. */
export function evidenceField(index: number) {
  return `classification.evidence[${index}].document`;
}

/** The four boxes the form prints under "Client classification:", as it prints them. */
export const classifiedLabels: Record<Classified, string> = {
  ASSESSED:
    "Client meets the Assessed Professional Client criteria as per the completed Client Classification Form;",
  DEEMED:
    "‘Deemed’ Professional Client – meets the requirement under ‘Deemed’ Professional Client pursuant to COB 2.3.4(1), and the client does not wish to be treated as Market Counterparty.",
  MARKET_COUNTERPARTY:
    "Market Counterparty (a potential client meeting the definition of a ‘deemed’ Professional Client pursuant to COB 2.3.4 or is an ‘assessed’ Professional Client pursuant to COB 2.3.8(2)(b) which is wholly owned by a Holding Company that is a ‘deemed’ Professional Client pursuant to COB 2.3.4(1)(g) or (h) or a ‘deemed’ Market Counterparty pursuant to COB 2.3.9(1A) and who has been given a prior written notification of the classification as a Market Counterparty and that potential client has not requested to be classified otherwise within the period specified in the notice).",
  SERVICE_BASED:
    "‘Service-Based’ Professional Client - the Financial Service provided to the client pursuant to COB 2.3.6(1) or 2.3.6A is “Advising on Financial Products” or “Arranging Deals in Investments”, or “Arranging Credit and Advising on Credit” and the service is provided for the purposes of ‘corporate structuring and financing’.",
};

/** The second box the form prints under the assessed criteria, joined to it by its own "and". */
export const EVIDENCE_ON_FILE =
  "Appropriate and sufficient evidence of net assets is on file (i.e. recent bank statements, statements evidencing previous/current investments).";

export const ratingLabels: Record<Rating, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** The form prints the result as "Result: (No match / PEP / Other)". */
export const screeningResultLabels: Record<ScreeningResult, string> = {
  NO_MATCH: "No match",
  PEP: "PEP",
  OTHER: "Other",
};

/** The three lists the screening table is divided into, headed as the form heads them. */
export const screenedAsLabels: Record<ScreenedAs, string> = {
  CUSTOMER: "Customer Screening – Name as per Passport",
  DIRECTOR: "List of Directors – Name as per Passport",
  OWNER: "List of Shareholders/ Ultimate Beneficial Owners",
};

/** The levels of due diligence the form offers, in the words the paper uses. */
export const cddLevelLabels: Record<CddLevel, string> = {
  LOW_SIMPLIFIED: "Low MLRR – simplified due diligence required",
  LOW_STANDARD: "Low MLRR – standard due diligence required",
  MEDIUM_STANDARD: "Medium MLRR – standard due diligence required",
  HIGH_ENHANCED: "High MLRR – enhanced due diligence required",
};

/** The rows of the PEP risk assessment, as the form lists them. */
/**
 * The line the form prints at its head. Unlike the rest of the pack this one leaves the firm's name as a rule
 * to be written on rather than printing it, so that is what it is here: a blank on the line.
 */
export const NAME_OF_THE_FIRM =
  "NAME OF THE FIRM: ________________________________ (hereinafter referred to as \u201CFirm\u201D)";

export const pepRows = [
  { id: "transparency", label: "Transparency" },
  { id: "jurisdictionRisk", label: "Jurisdiction risk" },
  { id: "natureOfThePep", label: "Nature of the PEP" },
  { id: "adverseNews", label: "Adverse news" },
  { id: "politicalInfluence", label: "Political influence" },
  { id: "sowCommercialInterest", label: "SOW/Commercial interest" },
  { id: "overall", label: "Overall PEP risk rating" },
] as const;

/** The rows of the net worth calculation, under the two headings the form groups them by. */
export const netWorthRows = [
  { id: "cashDeposits", group: "Financial Assets", label: "Cash / Deposits (please give break up of all the Firms)" },
  { id: "securities", group: "Financial Assets", label: "Securities (please give break up of all the Firms)" },
  { id: "realEstate", group: "Non-Financial Assets", label: "Real Estate" },
  { id: "businessOwned", group: "Non-Financial Assets", label: "Business Owned Value" },
  { id: "otherInvestments", group: "Non-Financial Assets", label: "Other investments (including insurance)" },
  { id: "liabilities", group: "Less", label: "Liabilities" },
] as const;

/** What the form asks the source of wealth write-up to cover. */
export const sowGuidance = `Guidance for filling the SOW/SOF/SOI Section:
1. Educational background and family details
2. Career snapshot including early employment details including average annual salary
3. How does the firm know the client and for how long?
4. For PEPs – please provide the details of the income specifically earned from the political exposures.
5. For Salaried / employed clients:
a. Past / present employment details
b. Roles and responsibilities handled by the client
c. Approximate Annual income (break up of salary, bonus, rental income, investment income etc.).
d. Last drawn salary at previous employment
e. Expenses
6. For Self-employed clients:
a. Past history of client before setting up the business
b. Information about the seed capital / source of funds to start the business
c. Details of the various companies that the client is associated with
d. % of business ownership
e. Annual income from the business
f. Details of the business valuation.
g. Information on sale of business if any.
h. Expenses
i. Any link with sanctioned countries (buyers / suppliers)
7. % business from high risk business.
8. Is there any inherited wealth?
9. Corroborative evidence as required by DFSA / AML manual requirements.
10. For joint accounts – provide similar information for the joint holder
11. Net worth break up to be provided including the cash, securities, investments, real estate in the below annexure.`;

/** One document held as evidence that the client is an assessed Professional Client. */
export interface Evidence {
  document: string;
  netAssetAmount: string;
  knowledgeAndExperience: boolean;
}

/** One name put through screening, and what came back. */
export interface Screened {
  screenedAs: ScreenedAs;
  name: string;
  screenedOn: string;
  result: ScreeningResult | null;
  remarks: string;
}

/** One line of Employment Details (salaried individuals). */
export interface Employment {
  companyName: string;
  industry: string;
  periodOfEmployment: string;
  averageAnnualSalary: string;
  totalSalaryEarned: string;
  otherIncomeEarned: string;
  countryOfEmployment: string;
}

/** One line of Entity Details (self-employed individuals). */
export interface OwnedEntity {
  companyName: string;
  industry: string;
  periodOfOwnership: string;
  annualRevenues: string;
  annualProfits: string;
  otherIncomeEarned: string;
  ownershipPercent: string;
  country: string;
  natureOfBusiness: string;
}

/** One line of the net worth calculation: what it is, and what it comes to. */
export interface NetWorthLine {
  details: string;
  usd: string;
}

/** One row of the PEP risk assessment. */
export interface PepLine {
  details: string;
  rating: Rating | null;
}

export interface DueDiligenceEntity {
  business: {
    legalName: string;
    tradingName: string;
    principalPlaceOfBusiness: string;
    registeredOffice: string;
    fiscalResidence: string;
    telephone: string;
    contactPerson: string;
    website: string;
    incorporatedOn: string;
    incorporatedIn: string;
    legalStructure: string;
    registrationNumber: string;
    businessActivities: string;
    countriesOfBusiness: string[];
    initialInvestment: string;
    expectedValuePerYear: string;
    howIntroduced: string;
    regulatorName: string;
    exchangeName: string;
    otherListedEntities: string;
    externalAuditor: string;
    purposeOfRelationship: string;
    relationshipManager: string;
    /** What is written on the rule the form leaves for the firm's own name. */
    firmName: string;
  };
  classification: {
    classified: Classified | null;
    /** The second box under the assessed criteria, which the form joins to it with "and". */
    evidenceOnFile: boolean;
    evidence: Evidence[];
    total: string;
  };
  suitability: {
    riskProfileCompleted: boolean | null;
    clientRiskProfile: string;
    comments: string;
  };
  screening: Screened[];
  wealth: {
    employment: Employment[];
    entities: OwnedEntity[];
    personalDetails: string;
    netWorth: Record<string, NetWorthLine>;
    totalNetWorth: string;
  };
  risk: {
    overallMlrr: string;
    politicallyExposed: boolean | null;
    pep: Record<string, PepLine>;
    relationshipManagerName: string;
    dateAndPlace: string;
    signature: string;
  };
  review: {
    amendedOverallRiskAssessment: string;
    overallMlrr: string;
    comments: string;
    nextReviewOn: string;
    level: CddLevel | null;
    otherMatters: string;
    mlro: string;
    mlroDate: string;
    mlroSignature: string;
    seo: string;
    seoDate: string;
    seoSignature: string;
  };
}

export function emptyEvidence(): Evidence {
  return { document: "", netAssetAmount: "", knowledgeAndExperience: false };
}

export function emptyScreened(screenedAs: ScreenedAs = "CUSTOMER"): Screened {
  return { screenedAs, name: "", screenedOn: "", result: null, remarks: "" };
}

export function emptyEmployment(): Employment {
  return {
    companyName: "", industry: "", periodOfEmployment: "", averageAnnualSalary: "", totalSalaryEarned: "",
    otherIncomeEarned: "", countryOfEmployment: "",
  };
}

export function emptyOwnedEntity(): OwnedEntity {
  return {
    companyName: "", industry: "", periodOfOwnership: "", annualRevenues: "", annualProfits: "",
    otherIncomeEarned: "", ownershipPercent: "", country: "", natureOfBusiness: "",
  };
}

function emptyLines<T>(ids: readonly { id: string }[], make: () => T): Record<string, T> {
  return Object.fromEntries(ids.map((row) => [row.id, make()]));
}

export function emptyDueDiligence(): DueDiligenceEntity {
  return {
    business: {
      legalName: "", tradingName: "", principalPlaceOfBusiness: "", registeredOffice: "", fiscalResidence: "",
      telephone: "", contactPerson: "", website: "", incorporatedOn: "", incorporatedIn: "", legalStructure: "",
      registrationNumber: "", businessActivities: "", countriesOfBusiness: [], initialInvestment: "",
      expectedValuePerYear: "", howIntroduced: "", regulatorName: "", exchangeName: "", otherListedEntities: "",
      externalAuditor: "", purposeOfRelationship: "", relationshipManager: "", firmName: "",
    },
    classification: { classified: null, evidenceOnFile: false, evidence: [emptyEvidence()], total: "" },
    suitability: { riskProfileCompleted: null, clientRiskProfile: "", comments: "" },
    screening: [emptyScreened()],
    wealth: {
      employment: [],
      entities: [],
      personalDetails: "",
      netWorth: emptyLines(netWorthRows, () => ({ details: "", usd: "" })),
      totalNetWorth: "",
    },
    risk: {
      overallMlrr: "",
      politicallyExposed: null,
      pep: emptyLines(pepRows, () => ({ details: "", rating: null })),
      relationshipManagerName: "",
      dateAndPlace: "",
      signature: "",
    },
    review: {
      amendedOverallRiskAssessment: "", overallMlrr: "", comments: "", nextReviewOn: "", level: null,
      otherMatters: "", mlro: "", mlroDate: "", mlroSignature: "", seo: "", seoDate: "", seoSignature: "",
    },
  };
}

/** Countries as the form now asks for them, from either a list or the one line of text a draft may hold. */
function asCountries(held: unknown): string[] | undefined {
  if (Array.isArray(held)) return held.filter((one): one is string => typeof one === "string");
  if (typeof held !== "string") return undefined;
  return held
    .split(/[,;]/)
    .map((one) => one.trim())
    .filter(Boolean);
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toDueDiligence(saved: FormDetailAnswers | undefined): DueDiligenceEntity {
  const empty = emptyDueDiligence();
  if (!saved) return empty;
  const held = saved as Partial<DueDiligenceEntity>;
  const rows = <T,>(list: T[] | undefined, fallback: T[], fill: () => T) =>
    list && list.length > 0 ? list.map((row) => ({ ...fill(), ...row })) : fallback;
  const lines = <T,>(kept: Record<string, T> | undefined, fallback: Record<string, T>) => ({
    ...fallback,
    ...kept,
  });
  return {
    business: {
      ...empty.business,
      ...held.business,
      // The form asks which countries, one by one; a draft saved before it did kept them as one line of text.
      countriesOfBusiness: asCountries(held.business?.countriesOfBusiness) ?? empty.business.countriesOfBusiness,
    },
    classification: {
      ...empty.classification,
      ...held.classification,
      evidence: rows(held.classification?.evidence, empty.classification.evidence, emptyEvidence),
    },
    suitability: { ...empty.suitability, ...held.suitability },
    screening: rows(held.screening, empty.screening, () => emptyScreened()),
    wealth: {
      ...empty.wealth,
      ...held.wealth,
      employment: held.wealth?.employment ?? [],
      entities: held.wealth?.entities ?? [],
      netWorth: lines(held.wealth?.netWorth, empty.wealth.netWorth),
    },
    risk: { ...empty.risk, ...held.risk, pep: lines(held.risk?.pep, empty.risk.pep) },
    review: { ...empty.review, ...held.review },
  };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/**
 * Everything of the form that is not the details table it opens with. The entity's copy of this form and the
 * individual's are the same 44 blocks in the same order; only that first table differs, so only that first
 * table is written twice.
 */
export type DueDiligenceShared = Omit<DueDiligenceEntity, "business">;

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewDueDiligence(value: DueDiligenceEntity, provided: ReadonlySet<string>): FormReview {
  const problems: Record<string, string> = {};
  const { business } = value;

  const needed: [keyof DueDiligenceEntity["business"], string][] = [
    ["legalName", REQUIRED],
    ["principalPlaceOfBusiness", REQUIRED],
    ["fiscalResidence", REQUIRED],
    ["telephone", REQUIRED],
    ["contactPerson", REQUIRED],
    ["incorporatedOn", "Choose a date."],
    ["incorporatedIn", REQUIRED],
    ["legalStructure", REQUIRED],
    ["registrationNumber", REQUIRED],
    ["businessActivities", REQUIRED],
    ["initialInvestment", REQUIRED],
    ["expectedValuePerYear", REQUIRED],
    ["howIntroduced", REQUIRED],
    ["purposeOfRelationship", REQUIRED],
    ["relationshipManager", REQUIRED],
    ["firmName", REQUIRED],
  ];
  for (const [field, says] of needed) {
    const said = business[field];
    if (typeof said === "string" && !said.trim()) problems[`business.${field}`] = says;
  }
  if (business.countriesOfBusiness.length === 0) problems["business.countriesOfBusiness"] = "Choose at least one.";

  sharedDueDiligenceProblems(value, provided, problems);
  return {
    problems,
    steps: [
      { id: "business", group: "SECTION 1", label: "The entity", complete: none(problems, "business.") },
      ...sharedDueDiligenceSteps(problems),
    ],
  };
}

/** The checks every copy of the form makes, whoever the details table above them is about. */
export function sharedDueDiligenceProblems(
  value: DueDiligenceShared,
  provided: ReadonlySet<string>,
  problems: Record<string, string>,
) {
  const { classification, suitability, wealth, risk, review } = value;

  if (!classification.classified) problems["classification.classified"] = "Tick the box that applies.";
  // The form joins the assessed criteria to the evidence box with its own "and", so both are ticked together.
  if (classification.classified === "ASSESSED") {
    if (!classification.evidenceOnFile) problems["classification.evidenceOnFile"] = "This is ticked with it.";
    if (classification.evidence.length === 0) problems["classification.evidence"] = "Add the evidence obtained.";
    if (!classification.total.trim()) problems["classification.total"] = REQUIRED;
  }
  // The table is printed whether or not the assessed box is ticked, so whatever is written in it is asked for.
  classification.evidence.forEach((held, at) => {
    const started = held.document.trim() || held.netAssetAmount.trim();
    const wanted = classification.classified === "ASSESSED" || started;
    if (!wanted) return;
    if (!held.document.trim()) problems[`classification.evidence[${at}].document`] = REQUIRED;
    if (!held.netAssetAmount.trim()) problems[`classification.evidence[${at}].netAssetAmount`] = REQUIRED;
    if (held.document.trim() && !provided.has(evidenceField(at))) {
      problems[evidenceField(at)] = "Attach the document obtained.";
    }
  });

  if (suitability.riskProfileCompleted === null) {
    problems["suitability.riskProfileCompleted"] = "Tick Yes or No.";
  }
  if (!suitability.clientRiskProfile.trim()) problems["suitability.clientRiskProfile"] = REQUIRED;
  if (value.screening.length === 0) problems["screening"] = "Add whoever has been screened.";
  value.screening.forEach((checked, at) => {
    if (!checked.name.trim()) problems[`screening[${at}].name`] = REQUIRED;
    if (!checked.screenedOn) problems[`screening[${at}].screenedOn`] = "Choose a date.";
    if (!checked.result) problems[`screening[${at}].result`] = "Say what came back.";
    // The form gives hits a column of their own, so a hit is explained there.
    if (checked.result && checked.result !== "NO_MATCH" && !checked.remarks.trim()) {
      problems[`screening[${at}].remarks`] = "Say what the hit was.";
    }
  });

  if (!wealth.personalDetails.trim()) problems["wealth.personalDetails"] = REQUIRED;
  if (!wealth.totalNetWorth.trim()) problems["wealth.totalNetWorth"] = REQUIRED;

  if (!risk.overallMlrr.trim()) problems["risk.overallMlrr"] = "Carry the rating over from the risk matrix.";
  // The form says Sheet 1 must be signed by the RM and attached at the end of this form.
  if (!provided.has(RISK_MATRIX_SHEET)) {
    problems[RISK_MATRIX_SHEET] = "Attach the signed Sheet 1 of the AML Risk Rating Matrix.";
  }
  if (risk.politicallyExposed === null) problems["risk.politicallyExposed"] = "Say whether a PEP is involved.";
  // The PEP assessment is only asked for where the risk identified above is medium or high.
  if (risk.politicallyExposed === true) {
    for (const row of pepRows) {
      if (!risk.pep[row.id]?.rating) problems[`risk.pep.${row.id}`] = "Tick one.";
    }
  }
  if (!risk.relationshipManagerName.trim()) problems["risk.relationshipManagerName"] = REQUIRED;
  if (!risk.dateAndPlace.trim()) problems["risk.dateAndPlace"] = REQUIRED;
  if (!risk.signature.trim()) problems["risk.signature"] = REQUIRED;

  if (!review.overallMlrr.trim()) problems["review.overallMlrr"] = REQUIRED;
  if (!review.comments.trim()) problems["review.comments"] = REQUIRED;
  if (!review.nextReviewOn) problems["review.nextReviewOn"] = "Choose a date.";
  if (!review.level) problems["review.level"] = "Select one.";
  for (const who of ["mlro", "seo"] as const) {
    if (!review[who].trim()) problems[`review.${who}`] = REQUIRED;
    if (!review[`${who}Date`]) problems[`review.${who}Date`] = "Choose a date.";
    if (!review[`${who}Signature`].trim()) problems[`review.${who}Signature`] = REQUIRED;
  }

}

/** The parts every copy of the form has below its details table. */
export function sharedDueDiligenceSteps(problems: Record<string, string>): FormReview["steps"] {
  return [
      {
        id: "classification",
        group: "SECTION 1",
        label: "Client classification",
        complete: none(problems, "classification"),
      },
      {
        id: "suitability",
        group: "SECTION 1",
        label: "Suitability assessment and screening",
        complete: none(problems, "suitability.") && none(problems, "screening"),
      },
      {
        id: "wealth",
        group: "SECTION 1",
        label: "Source of Wealth (SOW) / Source of Funds (SOF) Information",
        complete: none(problems, "wealth."),
      },
      {
        id: "risk",
        group: "SECTION 2",
        label: "Money laundering risk rating (MLRR)",
        complete: none(problems, "risk."),
      },
      { id: "compliance", group: "SECTION 3", label: "To be completed by the MLRO", complete: none(problems, "review.") },
  ];
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfDueDiligenceField(field: string): string {
  if (field.startsWith("classification")) return "classification";
  if (field.startsWith("suitability") || field.startsWith("screening")) return "suitability";
  if (field.startsWith("wealth")) return "wealth";
  if (field.startsWith("risk")) return "risk";
  if (field.startsWith("review")) return "compliance";
  return "business";
}

/** What each section of the paper form says at the top of it, shown before that section is filled in. */
export const dueDiligenceGuidance: Record<string, string> = {
  "SECTION 1":
    "(Details in Sections 1 & 2 to be filled by RM) In order to satisfy the Firm’s requirements for onboarding an Individual Customer, please complete the below:",
  "SECTION 2":
    "MONEY LAUNDERING RISK RATING (MLRR): (To be completed by the RM from the AML Risk Rating Matrix sheet)",
  "SECTION 3": "(TO BE COMPLETED BY THE MLRO)",
};

export const dueDiligenceDescriptions: Record<string, string> = {
  business:
    "In order to satisfy the Firm’s requirements for onboarding an Individual Customer, please complete the below:",
  classification: "Client classification, and the evidence of documents obtained for Assessment as Professional Client.",
  suitability: "SUITABILITY ASSESSMENT, and SCREENING.",
  wealth: "",
  risk: "(To be completed by the RM from the AML Risk Rating Matrix sheet)",
  compliance: "(TO BE COMPLETED BY THE MLRO)",
};
