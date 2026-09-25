import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The Customer Identification Form, which a joint account's pack holds one of per holder. It is a long run of
 * questions with the answers the paper prints beside them, so the questions are written here as data and the
 * screen sets them all out the same way — the words are the form's own, the layout is the only thing added.
 */

/** One of the boxes a question prints, with the gloss the paper puts beside it where it prints one. */
export interface Choice {
  value: string;
  text: string;
  /** What the paper prints in the column beside the box, as the risk appetite's descriptions. */
  note?: string;
}

/** A line the form asks for something on. */
export type Question =
  | {
      id: string;
      label: string;
      kind: "text" | "long" | "date" | "country";
      optional?: boolean;
      /** What the paper prints under the line, as the two country lines it heads "Only if different". */
      note?: string;
    }
  | {
      id: string;
      label: string;
      kind: "one" | "many";
      options: Choice[];
      /** The line the paper ends the boxes with, for something it did not print a box for. */
      other?: { id: string; label: string };
    };

/** The note the paper prints under the two country lines of the personal details. */
export const ONLY_IF_DIFFERENT = "Only if different from above";

const YES_NO: Choice[] = [
  { value: "NO", text: "No" },
  { value: "YES", text: "Yes" },
];

/** "Your personal details", and the question the form prints under it about sensitive industries. */
export const personalQuestions: Question[] = [
  { id: "personal.fullName", label: "Full name (as on passport)", kind: "text" },
  { id: "personal.previousNames", label: "Previous name(s)", kind: "text", optional: true },
  { id: "personal.otherNames", label: "Other name(s) (including any alias)", kind: "text", optional: true },
  {
    id: "personal.gender",
    label: "Gender",
    kind: "one",
    options: [
      { value: "MALE", text: "Male" },
      { value: "FEMALE", text: "Female" },
    ],
  },
  { id: "personal.dateOfBirth", label: "Date of Birth (DD/MM/YYYY)", kind: "date" },
  { id: "personal.placeOfBirth", label: "Place of Birth", kind: "text" },
  { id: "personal.placeOfBirthCountry", label: "Country:", kind: "country" },
  {
    id: "personal.maritalStatus",
    label: "Marital status",
    kind: "one",
    options: [
      { value: "SINGLE", text: "Single" },
      { value: "MARRIED", text: "Married" },
      { value: "DIVORCED", text: "Divorced" },
      { value: "WIDOWED", text: "Widow(er)" },
    ],
  },
  { id: "personal.spouseName", label: "Spouse name", kind: "text", optional: true },
  { id: "personal.nationality", label: "Nationality", kind: "country" },
  { id: "personal.citizenship", label: "Country of Citizenship/Residency", kind: "country" },
  { id: "personal.legalDomicile", label: "Country of legal domicile", kind: "country", optional: true, note: ONLY_IF_DIFFERENT },
  { id: "personal.fiscalResidence", label: "Country of fiscal residence", kind: "country", optional: true, note: ONLY_IF_DIFFERENT },
];

export const permanentAddress: Question[] = [
  { id: "permanent.building", label: "Building name", kind: "text" },
  { id: "permanent.street", label: "Street", kind: "text" },
  { id: "permanent.number", label: "No:", kind: "text", optional: true },
  { id: "permanent.place", label: "Place", kind: "text" },
  { id: "permanent.country", label: "Country:", kind: "country" },
];

export const mailingAddress: Question[] = [
  { id: "mailing.building", label: "Building name", kind: "text", optional: true },
  { id: "mailing.poBox", label: "PO Box:", kind: "text", optional: true },
  { id: "mailing.street", label: "Street", kind: "text", optional: true },
  { id: "mailing.number", label: "No:", kind: "text", optional: true },
  { id: "mailing.place", label: "Place", kind: "text", optional: true },
  { id: "mailing.country", label: "Country:", kind: "country", optional: true },
];

export const contactDetails: Question[] = [
  { id: "contact.telephone", label: "Telephone", kind: "text" },
  { id: "contact.fax", label: "Fax", kind: "text", optional: true },
  { id: "contact.email", label: "Email", kind: "text" },
];

export const professionalDetails: Question[] = [
  {
    id: "professional.status",
    label: "Status",
    kind: "one",
    options: [
      { value: "EMPLOYED", text: "Employed" },
      { value: "SELF_EMPLOYED", text: "Self Employed" },
      { value: "RETIRED", text: "Retired" },
      { value: "NOT_EMPLOYED", text: "Not Employed" },
    ],
  },
  { id: "professional.jobTitle", label: "Job title / Function", kind: "text" },
  { id: "professional.sector", label: "Sector / Industry", kind: "text" },
  { id: "professional.employer", label: "Name of employer", kind: "text" },
  { id: "professional.countryOfBusiness", label: "Country of business", kind: "country" },
];

export const PEP_QUESTION =
  "Are you /is a member of your family / a close associate of Politically Exposed Person?";

export const PEP_DEFINITION =
  "A Politically exposed person means a natural person (and includes, where relevant, a family member or close associate) who is or has been entrusted with a prominent public function, whether in the State or elsewhere, including but not limited to, a head of state or of government, senior politician, senior government, judicial or military official, ambassador, senior person in an International Organization, senior executive of a state owned corporation, or an important political party official, or a member of senior management or an individual who has been entrusted with similar functions such as a director or a deputy director. This definition does not include middle ranking or more junior individuals in the above categories. UAE PEPs will include all ministers, all Federal National Council members, all judges and all Government officials with the rank of undersecretary or above.";

export const SENSITIVE_QUESTION =
  "Are you associated to sensitive industries, either by way of employment or business:";

export const SENSITIVE_DEFINITION =
  "(Such as arms/ammunition manufacture or intermediation, cash intensive businesses (such as casinos, betting or gaming establishments), high value/precious goods (jewels, gem and precious metals dealers, art and antique dealers and auction houses), manufacture or intermediation of tobacco or any unregulated non-profit organization / charity foundation)";

export const pepQuestion = { id: "personal.pep", label: PEP_QUESTION, kind: "one", options: YES_NO } as const;

export const sensitiveQuestion = {
  id: "personal.sensitive",
  label: SENSITIVE_QUESTION,
  kind: "one",
  options: YES_NO,
} as const;

/** The line the sensitive industries question rules under itself, which only a Yes asks for. */
export const sensitiveDetails = {
  id: "personal.sensitiveDetails",
  label: "Details:",
  kind: "long",
  optional: true,
} as const;

export const pepAndSensitive: Question[] = [pepQuestion, sensitiveQuestion, sensitiveDetails];

/** "About your business intentions with us". */
export const intentionsQuestions: Question[] = [
  {
    id: "intentions.howLearned",
    label: "How did you learn about us and our services?",
    kind: "one",
    options: [
      { value: "EMPLOYEE", text: "By one of your employees" },
      { value: "OWN_INITIATIVE", text: "On my own initiative (marketing, website…)" },
      { value: "CUSTOMER_REFERRAL", text: "Referral by one of your other customers" },
      { value: "INTRODUCER", text: "Referral by one of your business introducers/intermediaries" },
    ],
    other: { id: "intentions.introducerName", label: "Name:" },
  },
  {
    id: "intentions.services",
    label: "What are the services or products you are interested in?",
    kind: "many",
    options: [
      { value: "ADVISING", text: "Advising on Financial Products" },
      { value: "CUSTODY", text: "Arranging Custody" },
      { value: "DEALS", text: "Arranging Deals in Investment" },
      { value: "CREDIT", text: "Advising on or Arranging credit facilities" },
      { value: "ORDERS", text: "Receipt and transmission of orders in financial products" },
    ],
    other: { id: "intentions.servicesOther", label: "Other:" },
  },
  { id: "intentions.amountUsd", label: "Which amount of assets do you want to be serviced by us? (USD)", kind: "text" },
  { id: "intentions.amountShare", label: "% of total net wealth", kind: "text" },
  {
    id: "intentions.turnover",
    label: "What is the expected annual in/out flow turnover of assets",
    kind: "one",
    options: [
      { value: "UNDER_500K", text: "Less than 500,000 USD" },
      { value: "500K_1M", text: "500,000 to 1,000,000 USD" },
      { value: "OVER_1M", text: "More than 1,000,000 USD" },
    ],
  },
];

/** The heading the form prints over the last three questions of that table. */
export const PRIVATE_BANKING_ONLY = "Only for Private Banking Advisory Division Customers";

export const privateBankingQuestions: Question[] = [
  {
    id: "intentions.motive",
    label: "What will be your investment motive?",
    kind: "one",
    options: [
      { value: "CREATION", text: "Wealth creation and/or Distribution" },
      { value: "PRESERVATION", text: "Wealth Preservation and/or Distribution" },
    ],
  },
  {
    id: "intentions.prospect",
    label: "What will be your investment prospect?",
    kind: "one",
    options: [
      { value: "SHORT", text: "Short Term (within 1 year)" },
      { value: "MEDIUM", text: "Medium Term (1-5 years)" },
      { value: "LONG", text: "Long Term (more than 5 years)" },
    ],
  },
  {
    id: "intentions.riskAppetite",
    label: "What is your Risk Appetite?",
    kind: "one",
    options: [
      {
        value: "HIGH",
        text: "High",
        note: "Customer is prepared for higher fluctuations on value of capital invested, in order to achieve high returns",
      },
      {
        value: "MEDIUM",
        text: "Medium",
        note: "Customer is prepared for fair amount of fluctuations on value of capital invested, in order to achieve above average returns",
      },
      {
        value: "LOW",
        text: "Low",
        note: "Customer accepts minimal fluctuations on value of capital invested and requires stable returns",
      },
    ],
  },
];

/** "About your wealth and origin of funds". */
export const wealthQuestions: Question[] = [
  {
    id: "wealth.netWealth",
    label: "What is your estimated global net wealth?",
    kind: "one",
    options: [
      { value: "UNDER_500K", text: "Less than 500,000 USD" },
      { value: "500K_1M", text: "500,000 to 1,000,000 USD" },
      { value: "1M_5M", text: "1,000,000 to 5,000,000 USD" },
      { value: "5M_10M", text: "5,000,000 to 10,000,000 USD" },
      { value: "OVER_10M", text: "More than 10,000,000 USD" },
    ],
    other: { id: "wealth.netWealthOther", label: "Other (please specify):" },
  },
  {
    id: "wealth.builtUp",
    label: "How have you built up your global net wealth?",
    kind: "many",
    options: [
      { value: "BUSINESS", text: "Professional/business activities" },
      { value: "INHERITANCE", text: "Inheritance / Gifts" },
      { value: "PENSION", text: "Pension or Stock option pay out" },
      { value: "REAL_ESTATE", text: "Real estate transactions" },
      { value: "INVESTMENTS", text: "Managing personal investments" },
      { value: "SALE_OF_BUSINESS", text: "Sale of own business" },
    ],
    other: { id: "wealth.builtUpOther", label: "Other (please specify):" },
  },
  { id: "wealth.countries", label: "In which countries do you have or build up your wealth", kind: "text" },
  {
    id: "wealth.income",
    label: "What is your annual regular net income?",
    kind: "one",
    options: [
      { value: "UNDER_100K", text: "Up to 100,000 USD" },
      { value: "100K_250K", text: "100,000 to 250,000 USD" },
      { value: "250K_500K", text: "250,000 to 500,000 USD" },
      { value: "500K_1M", text: "500,000 to 1,000,000 USD" },
      { value: "OVER_1M", text: "More than 1,000,000 USD" },
    ],
  },
  {
    id: "wealth.incomeFrom",
    label: "How do you make your regular net income?",
    kind: "many",
    options: [
      { value: "SALARY", text: "Salary or pension" },
      { value: "INVESTMENTS", text: "income from investments" },
      { value: "BUSINESS", text: "Business income" },
      { value: "RENTAL", text: "rental income" },
    ],
    other: { id: "wealth.incomeFromOther", label: "Other:" },
  },
  { id: "wealth.incomeCountries", label: "In which countries do you make your regular net income?", kind: "text" },
  {
    id: "wealth.sourceOfFunds",
    label:
      "Provide Source of funds explanation? (sufficient details from a plausible, traceable and reputable source of how payments were made, from where and by whom)",
    kind: "long",
  },
  {
    id: "wealth.sourceOfWealth",
    label: "Provide Source of Wealth explanation? (sufficient details on how funds were acquired)",
    kind: "long",
  },
];

/** The assets and liabilities table, each line asking for an amount and a description. */
export const assetLines = [
  { id: "cash", label: "Cash and Equivalents (Deposits)" },
  { id: "securities", label: "Securities (Stock, Bonds& Other)" },
  { id: "lifeInsurance", label: "Life Insurance(Value)" },
  { id: "realEstate", label: "Real estate (Excluding Primary residence)" },
  { id: "totalAssets", label: "Total Assets" },
];

export const liabilityLines = [
  { id: "loan1", label: "Loan 1" },
  { id: "loan2", label: "Loan 2" },
  { id: "totalLiabilities", label: "Total Liabilities" },
];

export const NET_ASSETS = "Net Assets";

/** "Your experience and understanding of financial markets and instruments". */
export const experienceQuestions: Question[] = [
  {
    id: "experience.knowledge",
    label: "How is your knowledge and understanding of financial markets and products?",
    kind: "one",
    options: [
      { value: "POOR", text: "Poor" },
      { value: "MODERATE", text: "Moderate" },
      { value: "GOOD", text: "Good" },
      { value: "EXCELLENT", text: "Excellent" },
    ],
    other: { id: "experience.knowledgeOther", label: "Other(please specify):" },
  },
  {
    id: "experience.active",
    label: "For how long have you been active on the financial markets / investing in financial products?",
    kind: "one",
    options: [
      { value: "UNDER_1", text: "Less than 1 year" },
      { value: "1_2", text: "1 to 2 years" },
      { value: "3_5", text: "3 to 5 years" },
      { value: "OVER_5", text: "more than 5 years" },
    ],
    other: { id: "experience.activeOther", label: "Other(please specify):" },
  },
  {
    id: "experience.managed",
    label: "How have your assets been managed before?",
    kind: "one",
    options: [
      { value: "MYSELF", text: "by myself" },
      { value: "ADVISER", text: "with advice of a financial advisor" },
      { value: "NON_DISCRETIONARY", text: "non-discretionary management" },
      { value: "DISCRETIONARY", text: "discretionary management" },
    ],
    other: { id: "experience.managedOther", label: "Other(please specify):" },
  },
  {
    id: "experience.products",
    label: "In which financial products have you already invested on a regular basis?",
    kind: "many",
    options: [
      { value: "SHARES", text: "shares (equity)" },
      { value: "BONDS", text: "bonds (debentures)" },
      { value: "FUNDS", text: "collective investment funds" },
      { value: "SUKUK", text: "sukuk" },
      { value: "STRUCTURED", text: "structured products" },
      { value: "DERIVATIVES", text: "derivatives (options, futures)" },
      { value: "INSURANCE", text: "insurance investments" },
      { value: "COMMODITIES", text: "commodities" },
      { value: "CURRENCIES", text: "currencies" },
      { value: "HEDGE_FUNDS", text: "hedge funds" },
      { value: "PRIVATE_EQUITY", text: "private equity" },
    ],
    other: { id: "experience.productsOther", label: "Other(please specify):" },
  },
  {
    id: "experience.howOften",
    label: "How often do you take investments decisions (buy/sell)?",
    kind: "one",
    options: [
      { value: "SELDOM", text: "seldom" },
      { value: "MONTHLY", text: "monthly" },
      { value: "WEEKLY", text: "weekly" },
      { value: "DAILY", text: "daily" },
    ],
    other: { id: "experience.howOftenOther", label: "Other(please specify):" },
  },
  {
    id: "experience.moreInformation",
    label:
      "About which financial services and/or financial products would you like to receive more information?",
    kind: "long",
    optional: true,
  },
];

/** The Declaration, in the form's own words. */
export const declarationWording = [
  "I confirm that all the assets / funds to be invested upon advice / arrangements by you have been lawfully acquired and are not derived from, either directly or indirectly, or otherwise connected with any criminal or unlawful activity. I we declare to act on my own behalf.",
  "I declare that the above mentioned information is true and correct to the best of our knowledge and it has been made in good faith. I accept that you will rely on this information to fulfill all its regulatory requirements.",
  "I confirm that I have net assets of more than 1,000,000 USD and sufficient experience and understanding of relevant financial markets, products or transactions and any associated risks. Therefore, I accept my classification as Professional Client as defined in Appendix A below. I further confirm that I do not opt for a Retail Client classification.",
];

export const DATA_PROTECTION_HEADING = "Data protection statement";

export const DATA_PROTECTION =
  "In order to provide you with products and services we need to collect, use, share and store personal and financial information about you. This includes the information requested on this form and information obtained from third parties. The information requested may be used to assist us in providing the service you are applying for, to advise you of other products and services, to confirm, update and enhance records and to establish your identity. The data that we collect may be shared / transferred to / or stored / or processed at, our offices in other countries outside the UAE.";

export const ON_BEHALF_OF_FIRM = "On behalf of {{firmName}}:";

/** "1) Checklist of required identification documents:", one line per document the form asks for. */
export const CHECKLIST_HEADING = "Checklist of required identification documents:";

export const checklistDocuments = [
  { id: "advisoryAgreement", number: "1", label: "Signed copy of {{firmName}} Investment Advisory Agreement" },
  { id: "passport", number: "2", label: "Certified copy current signed Passport, National Identity Card" },
  {
    id: "proofOfAddress",
    number: "3",
    label:
      "Certified copy of proof of address (Utility Bill, Bank Statement, Tenancy Contract or Mortgage Statement)",
  },
  {
    id: "professionalActivity",
    number: "4",
    label: "Copy of proof of professional activity (commercial license, salary slip, VAT registration number, …)",
  },
  {
    id: "sourceOfWealth",
    number: "5",
    label:
      "Copy of source of wealth / income: Professional income (salary slip, financial accounts, etc.); Real estate (independent valuation, purchase/sale agreement, etc…); Sales own business (purchase/sale agreement); Inheritance / gift (will, declaration to tax authority, correspondence, trust deed, …); Share Certificates; Bank or Brokerage account statements; Probate documents; Publicly available register of ownership; News items from a reputable source and other similar evidence",
  },
];

/** Where a checklist document is attached. Each holder provides their own, so it is asked of each of them. */
export function documentField(where: string, id: string) {
  return `${where}.documents.${id}`;
}

export const CHECKLIST_NOTE =
  "Note: In compliance with the applicable regulations including but not limited to the Anti Money Laundering regulations, {{firmShortName}} may request additional documentation and/or proof regarding any statements made in this Customer Identification Form and/or any supporting documents";

export const CERTIFIED_COPY_HEADING = "Certified copy";

export const certifiedCopyRules = [
  "Document must be notarized or certified to be true copy of the original by a registered lawyer, a registered notary, a chartered accountant, a government ministry, post office, a police officer or an embassy or consulate. The certified documents must be marked as (a) original seen (b) dated (c) signed by the individual who conducted the certification and full name of the person must be added to ensure the certifier can be fully identified.; or",
  "Document is a copy, and the original form has been seen by us: the copy should be stamped as true copy of original and the original has been duly sighted",
  "Document is a copy but the existence or the content has been verified by the use of public reliable information",
];

/** "2) Internal sign-off by the relationship manager". */
export const SIGNOFF_HEADING = "Internal sign-off by the relationship manager";

export const CONTACT_LINE =
  "I confirm that I had a face to face / telephone / email / letter (delete as appropriate) contact with this Customer on";

/** The four ways the line above offers; the paper says to delete the ones that do not apply. */
export const contactWays: Choice[] = [
  { value: "FACE_TO_FACE", text: "face to face" },
  { value: "TELEPHONE", text: "telephone" },
  { value: "EMAIL", text: "email" },
  { value: "LETTER", text: "letter" },
];

export const signoffConfirmations = [
  "I confirm, based on my knowledge of the customer, that all the assets / funds of the customer that are to be invested upon advice / arrangements by us have been lawfully acquired and are not derived from, either directly or indirectly, or otherwise connected with any criminal or unlawful activity.",
  "I declare that the above mentioned customer information is true and correct to the best of my knowledge and understanding.",
  "I confirm that the Customer has net assets of more than 1,000,000 USD and sufficient experience and understanding of relevant financial markets, products or transactions and any associated risks. Therefore, we can classify the Customer as a Professional Client.",
  "I confirm that this Customer is eligible for on-boarding.",
];

export const COMPLIANCE_HEADING = "Sign off by the Compliance Officer and MLRO";

export const SCREENING_HEADING = "Screening Results:";

export const ONGOING_SCREENING = "Included on Ongoing Screening?";

/** One row of the screening table. */
export interface ScreeningRow {
  screenedOn: string;
  names: string;
  result: string;
}

/** One of the two people the PEP question rules a Name and a Function for. */
export interface PepPerson {
  name: string;
  role: string;
}

/** The lines of the form that are filled in by typing, ticking or choosing, whoever they are asked of. */
export interface Lines {
  /** Every line that asks for one thing: text, a date, a country, or the one box that was ticked. */
  said: Record<string, string>;
  /** Every line that prints boxes to tick as many of as apply. */
  chose: Record<string, string[]>;
  /** Every box that is ticked on its own, such as a declaration being made. */
  confirmed: Record<string, boolean>;
}

/** One account holder's own pages: everything the paper asks the customer about themselves. */
export interface HolderAnswers extends Lines {
  /** The Name and Function the PEP question rules, twice over. */
  pep: PepPerson[];
}

/** The firm's own page: the relationship manager's sign-off, Compliance and MLRO, and the screening. */
export interface FirmAnswers extends Lines {
  screening: ScreeningRow[];
}

/**
 * The paper says to use a separate form for each joint holder. The account gets one instead, with a set of
 * pages for each person holding it and the firm's own page once at the end.
 */
export interface CustomerIdentification {
  holders: HolderAnswers[];
  firm: FirmAnswers;
}

export function emptyPepPerson(): PepPerson {
  return { name: "", role: "" };
}

export function emptyScreeningRow(): ScreeningRow {
  return { screenedOn: "", names: "", result: "" };
}

export function emptyHolderAnswers(): HolderAnswers {
  return { said: {}, chose: {}, confirmed: {}, pep: [emptyPepPerson(), emptyPepPerson()] };
}

export function emptyCustomerIdentification(): CustomerIdentification {
  return {
    holders: [emptyHolderAnswers()],
    firm: { said: {}, chose: {}, confirmed: {}, screening: [emptyScreeningRow()] },
  };
}

/** Which of the form's lines belong to the firm rather than to the person it is about. */
const FIRM_LINES = ["signoff.", "compliance.", "screening."];

function firmLine(key: string) {
  return FIRM_LINES.some((prefix) => key.startsWith(prefix));
}

function onlyWhere<T>(held: Record<string, T> | undefined, wanted: (key: string) => boolean): Record<string, T> {
  return Object.fromEntries(Object.entries(held ?? {}).filter(([key]) => wanted(key)));
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toCustomerIdentification(saved: FormDetailAnswers | undefined): CustomerIdentification {
  const empty = emptyCustomerIdentification();
  if (!saved) return empty;
  const held = saved as Partial<CustomerIdentification> & Partial<HolderAnswers> & Partial<FirmAnswers>;
  const rows = <T,>(list: T[] | undefined, fallback: T[], fill: () => T) =>
    list && list.length > 0 ? list.map((row) => ({ ...fill(), ...row })) : fallback;
  // A form saved before the holders were kept apart has everyone's lines and the firm's in the one set of
  // maps. Which page a line is on is in its own name, so the two are told apart by that.
  const holders = held.holders?.length
    ? held.holders.map((one) => ({
        said: { ...one.said },
        chose: { ...one.chose },
        confirmed: { ...one.confirmed },
        pep: rows(one.pep, emptyHolderAnswers().pep, emptyPepPerson),
      }))
    : [
        {
          said: onlyWhere(held.said, (key) => !firmLine(key)),
          chose: onlyWhere(held.chose, (key) => !firmLine(key)),
          confirmed: onlyWhere(held.confirmed, (key) => !firmLine(key)),
          pep: rows(held.pep, emptyHolderAnswers().pep, emptyPepPerson),
        },
      ];
  const firm = held.firm ?? {
    said: onlyWhere(held.said, firmLine),
    chose: onlyWhere(held.chose, firmLine),
    confirmed: onlyWhere(held.confirmed, firmLine),
    screening: held.screening,
  };
  return {
    holders,
    firm: {
      said: { ...firm.said },
      chose: { ...firm.chose },
      confirmed: { ...firm.confirmed },
      screening: rows(firm.screening, empty.firm.screening, emptyScreeningRow),
    },
  };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** Every question of a part, so the checks and the screen read from one list. */
export const personalPart = [
  ...personalQuestions,
  ...permanentAddress,
  ...mailingAddress,
  ...contactDetails,
  ...professionalDetails,
  ...pepAndSensitive,
];

export const intentionsPart = [...intentionsQuestions, ...privateBankingQuestions];

function check(questions: Question[], where: string, value: Lines, problems: Record<string, string>) {
  for (const question of questions) {
    const at = `${where}.${question.id}`;
    if (question.kind === "many") {
      if ((value.chose[question.id] ?? []).length === 0 && !value.said[question.other?.id ?? ""]?.trim()) {
        problems[at] = "Tick what applies.";
      }
      continue;
    }
    if ("optional" in question && question.optional) continue;
    const said = value.said[question.id]?.trim();
    if (said) continue;
    if (question.kind === "one") problems[at] = "Tick the box that applies.";
    else if (question.kind === "date") problems[at] = "Choose a date.";
    else if (question.kind === "country") problems[at] = "Choose a country.";
    else problems[at] = REQUIRED;
  }
}

/** How a holder is named on their own pages before their name is written on them: by their place. */
export function namedHolder(holder: HolderAnswers, at: number): string {
  return holder.said["personal.fullName"]?.trim() || `holder ${at + 1}`;
}

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewCustomerIdentification(
  value: CustomerIdentification,
  provided: ReadonlySet<string>,
): FormReview {
  const problems: Record<string, string> = {};
  const steps: FormReview["steps"] = [];

  value.holders.forEach((holder, at) => {
    const where = `holders[${at}]`;
    const whose = value.holders.length === 1 ? "" : ` — ${namedHolder(holder, at)}`;
    const said = (id: string) => holder.said[id]?.trim();

    check(personalPart, where, holder, problems);
    // The two lines the PEP question rules are only asked for once the answer to it is Yes.
    if (said("personal.pep") === "YES" && !holder.pep.some((one) => one.name.trim())) {
      problems[`${where}.pep`] = "Name the Politically Exposed Person.";
    }
    if (said("personal.sensitive") === "YES" && !said("personal.sensitiveDetails")) {
      problems[`${where}.personal.sensitiveDetails`] = REQUIRED;
    }
    // The introducer's name is only asked for by the box that ends in it.
    if (said("intentions.howLearned") === "INTRODUCER" && !said("intentions.introducerName")) {
      problems[`${where}.intentions.introducerName`] = REQUIRED;
    }

    check(intentionsPart, where, holder, problems);
    check(wealthQuestions, where, holder, problems);
    check(experienceQuestions, where, holder, problems);

    for (const line of [...assetLines, ...liabilityLines]) {
      if (!said(`assets.${line.id}.usd`)) problems[`${where}.assets.${line.id}.usd`] = REQUIRED;
    }
    if (!said("assets.netAssets.usd")) problems[`${where}.assets.netAssets.usd`] = REQUIRED;

    if (!holder.confirmed["declaration.agreed"]) {
      problems[`${where}.declaration.agreed`] = "This has to be agreed to.";
    }
    for (const [field, says] of [
      ["declaration.name", REQUIRED],
      ["declaration.date", "Choose a date."],
    ] as const) {
      if (!said(field)) problems[`${where}.${field}`] = says;
    }

    // The checklist asks for the documents themselves, so ticking a line is not answering it.
    for (const document of checklistDocuments) {
      if (!provided.has(documentField(where, document.id))) {
        problems[`${where}.documents.${document.id}`] = "Attach the document.";
      }
    }

    steps.push(
      { id: `${where}.personal`, group: "—", label: `Personal details${whose}`,
        complete: none(problems, `${where}.personal.`) && none(problems, `${where}.permanent.`)
          && none(problems, `${where}.mailing.`) && none(problems, `${where}.contact.`)
          && none(problems, `${where}.professional.`) && none(problems, `${where}.pep`) },
      { id: `${where}.intentions`, group: "—", label: `Business intentions with us${whose}`,
        complete: none(problems, `${where}.intentions.`) },
      { id: `${where}.wealth`, group: "—", label: `Wealth and origin of funds${whose}`,
        complete: none(problems, `${where}.wealth.`) },
      { id: `${where}.assets`, group: "—", label: `Assets and liabilities${whose}`,
        complete: none(problems, `${where}.assets.`) },
      { id: `${where}.experience`, group: "—",
        label: `Experience and understanding of financial markets and instruments${whose}`,
        complete: none(problems, `${where}.experience.`) },
      { id: `${where}.declaration`, group: "—", label: `Declaration${whose}`,
        complete: none(problems, `${where}.declaration.`) },
      { id: `${where}.documents`, group: "1", label: `Checklist of required identification documents${whose}`,
        complete: none(problems, `${where}.documents.`) },
    );
  });

  // The firm's own page is signed once for the account, however many people hold it.
  const firm = value.firm;
  const firmSaid = (id: string) => firm.said[id]?.trim();
  if (!firmSaid("signoff.contactWay")) problems["firm.signoff.contactWay"] = "Tick the box that applies.";
  if (!firmSaid("signoff.contactOn")) problems["firm.signoff.contactOn"] = "Choose a date.";
  if (!firmSaid("signoff.contactPlace")) problems["firm.signoff.contactPlace"] = REQUIRED;
  if (!firm.confirmed["signoff.agreed"]) problems["firm.signoff.agreed"] = "This has to be confirmed.";
  for (const who of ["signoff", "compliance"] as const) {
    if (!firmSaid(`${who}.name`)) problems[`firm.${who}.name`] = REQUIRED;
    if (!firmSaid(`${who}.date`)) problems[`firm.${who}.date`] = "Choose a date.";
    if (!firmSaid(`${who}.signature`)) problems[`firm.${who}.signature`] = REQUIRED;
  }

  if (!firmSaid("screening.included")) problems["firm.screening.included"] = "Tick the box that applies.";
  if (firmSaid("screening.included") === "YES" && !firmSaid("screening.since")) {
    problems["firm.screening.since"] = "Choose a date.";
  }
  firm.screening.forEach((row, at) => {
    const started = row.screenedOn.trim() || row.names.trim() || row.result.trim();
    if (!started) return;
    if (!row.screenedOn.trim()) problems[`firm.screening.rows[${at}].screenedOn`] = "Choose a date.";
    if (!row.names.trim()) problems[`firm.screening.rows[${at}].names`] = REQUIRED;
    if (!row.result.trim()) problems[`firm.screening.rows[${at}].result`] = REQUIRED;
  });

  steps.push(
    { id: "firm.signoff", group: "2", label: "Internal sign-off by the relationship manager",
      complete: none(problems, "firm.signoff.") && none(problems, "firm.compliance.") },
    { id: "firm.screening", group: "—", label: "Screening Results",
      complete: none(problems, "firm.screening.") },
  );

  return { problems, steps };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfCustomerIdentificationField(field: string): string {
  const holder = /^holders\[\d+]/.exec(field)?.[0];
  if (!holder) {
    return field.startsWith("firm.screening") ? "firm.screening" : "firm.signoff";
  }
  const line = field.slice(holder.length + 1);
  for (const part of ["intentions", "wealth", "assets", "experience", "declaration", "documents"]) {
    if (line.startsWith(part)) return `${holder}.${part}`;
  }
  return `${holder}.personal`;
}

export const customerIdentificationGuidance: Record<string, string> = {
  "1": CHECKLIST_NOTE,
};

export const customerIdentificationDescriptions: Record<string, string> = {
  personal: "CUSTOMER IDENTIFICATION FORM INDIVIDUAL CUSTOMER / BENEFICIAL OWNER (use separate form for each joint holder)",
  intentions: "About your business intentions with us",
  wealth: "About your wealth and origin of funds",
  assets: "Assets, liabilities and net assets.",
  experience: "Your experience and understanding of financial markets and instruments",
  declaration: "The declaration, and the data protection statement.",
  documents: CHECKLIST_HEADING,
  signoff: "Internal sign-off by the relationship manager, and sign off by the Compliance Officer and MLRO.",
  screening: SCREENING_HEADING,
};

/**
 * APPENDIX A, which the declaration sends the reader to ("as defined in Appendix A below"). It is read,
 * not answered, so it is carried over as the paper sets it out and shown under the declaration.
 */
export const appendixA: { kind: string; number: string | null; strong: boolean; text: string }[] = [
  { kind: "PARAGRAPH", number: null, strong: true, text: "APPENDIX A" },
  { kind: "PARAGRAPH", number: null, strong: true, text: "Definition of Client Classification" },
  { kind: "PARAGRAPH", number: null, strong: true, text: "Market Counterparty" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "As Per DFSA COB Rule 2.3.9, you may be treated as a Market Counterparty provided that:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "You are classified as a deemed professional client as per section 1 below;" },
  { kind: "CLAUSE", number: "b.", strong: false, text: "You have been given a prior written notification of the classification" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "as a Market Counterparty; and" },
  { kind: "CLAUSE", number: "c.", strong: false, text: "You have not requested to be classified otherwise within the period" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "specified in the notice." },
  { kind: "PARAGRAPH", number: null, strong: true, text: "Professional Client" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "There are three classifications of professional clients as detailed below" },
  { kind: "CLAUSE", number: "1.", strong: false, text: "As per DFSA COB Rule 2.3.4, you may be treated as a Deemed Professional Client provided that:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "a supranational organization whose members are either countries, central banks or national monetary authorities." },
  { kind: "CLAUSE", number: "b.", strong: false, text: "a properly constituted government, government agency, central bank or other national monetary authority of any country or jurisdiction." },
  { kind: "CLAUSE", number: "c.", strong: false, text: "a public authority or state investment body." },
  { kind: "CLAUSE", number: "d.", strong: false, text: "an Authorized Market Institution, Regulated Exchange or regulated clearing house;" },
  { kind: "CLAUSE", number: "e.", strong: false, text: "an Authorized Firm, a Regulated Financial Institution or the management company of a regulated pension fund." },
  { kind: "CLAUSE", number: "f.", strong: false, text: "a Collective Investment Fund or a regulated pension fund." },
  { kind: "CLAUSE", number: "g.", strong: false, text: "a Large Undertaking¹;" },
  { kind: "CLAUSE", number: "h.", strong: false, text: "a Body Corporate whose shares are listed or admitted to trading on any exchange of an IOSCO member country." },
  { kind: "CLAUSE", number: "i.", strong: false, text: "any other institutional investor whose main activity is to invest in financial instruments, including an entity dedicated to the securitization of assets or other financial transactions." },
  { kind: "CLAUSE", number: "j.", strong: false, text: "a trustee of a trust which has, or had during the previous 12 months, assets of at least $10 million; or" },
  { kind: "CLAUSE", number: "k.", strong: false, text: "a holder of a license under the Single-Family Office Regulations with respect to its activities carried out exclusively for the purposes of, and only in so far as it is, carrying out its duties as a Single-Family Office." },
  { kind: "CLAUSE", number: "2.", strong: false, text: "As per DFSA COB Rule 2.3.6, you may be treated as a Service based Professional Client provided that:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "the Financial Service provided to you is “Advising on financial" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "products or credit” or “Arranging credit or deals in Investments”; and" },
  { kind: "CLAUSE", number: "b.", strong: false, text: "the service in (a) is provided for the purposes of ‘corporate structuring" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "and financing’." },
  { kind: "PARAGRAPH", number: null, strong: false, text: "In (b), ‘corporate structuring and financing’:" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "Includes:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "providing advice relating to acquisition, disposal, structuring, restructuring, financing or refinancing of a corporation or other legal" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "entity; or" },
  { kind: "CLAUSE", number: "b.", strong: false, text: "arranging credit for a purpose referred to in (a); and" },
  { kind: "PARAGRAPH", number: null, strong: false, text: "Excludes:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "any advice on financial products or arranging credit or deals in Investments given to an individual for the purposes of, or in connection with, the management of that individual’s investments." },
  { kind: "CLAUSE", number: "3.", strong: false, text: "As Per DFSA COB Rule 2.3.7, You may be treated as Assessed Professional Client provide that you have:" },
  { kind: "CLAUSE", number: "a.", strong: false, text: "net assets of at least USD 1 million (excluding primary residence); and" },
  { kind: "CLAUSE", number: "b.", strong: false, text: "Either:" },
  { kind: "BULLET", number: null, strong: false, text: "Appears on reasonable grounds to have sufficient experience and understanding of the relevant financial markets, products or transactions and any associated risks, OR" },
  { kind: "BULLET", number: null, strong: false, text: "has two years employee in a relevant professional position of an Authorized Firm/regulated Financial Institution," },
];
