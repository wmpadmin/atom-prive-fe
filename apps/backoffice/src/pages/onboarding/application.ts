import type {
  AccountHolder,
  Address,
  Business,
  Employer,
  EntityDetails,
  OnboardingApplication,
  SigningAuthority,
  StaffMember,
} from "@atomprive/api-client/backoffice";
import { countries } from "../../lib/countries";
import { mobileNumberMessage } from "../../lib/mobile-numbers";
import { emptyRiskProfile, reviewEntityRisk, reviewRiskProfiles, riskProfileOf, riskStepOfField, tidyRiskProfile, type FormRiskProfile } from "./risk-profiling";

// The onboarding rules. The API checks the same ones with the same messages (OnboardingReview.java), so change
// both together.

export type ClientType = NonNullable<OnboardingApplication["clientType"]>;
export type Occupation = NonNullable<AccountHolder["occupation"]>;
export type Relationship = NonNullable<AccountHolder["relationshipToPrimary"]>;
export type OrganisationType = NonNullable<EntityDetails["organisationType"]>;
export type SigningMode = NonNullable<SigningAuthority["mode"]>;

/** Who may sign for a joint account (23 Nov 2026), worded for the person entering it. */
export const signingModeLabels: Record<SigningMode, string> = {
  ANY_ONE: "Any one of us, acting alone",
  ALL_JOINTLY: "All of us, jointly",
  ANY_OF_NAMED: "Some of the holders",
  OTHER: "Other",
};

const NUMBER_WORDS = ["one", "two", "three", "four"];

function listed(names: string[]) {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A holder's name as far as it has been entered. */
export function holderName(holder: AccountHolder, index: number) {
  return holder.fullName?.trim() || [holder.forenames, holder.surname].filter(Boolean).join(" ").trim() || holderGroup(index);
}

/**
 * The signing authority in one line, as the account opening form's signing mandate will say it — the server writes
 * the same words into that form (Prefill.namedSignatories), so the two read alike.
 */
export function signingAuthorityText(application: Pick<FormApplication, "holders" | "signingAuthority">): string | null {
  const authority = application.signingAuthority;
  if (!authority?.mode) return null;
  if (authority.mode === "ANY_ONE") return "Any one of us, acting alone";
  if (authority.mode === "ALL_JOINTLY") return "All of us, jointly";
  if (authority.mode === "OTHER") return authority.other?.trim() ? `Other: ${authority.other.trim()}` : "Other";
  const names = application.holders.flatMap((holder, index) => (holder.signatory ? [holderName(holder, index)] : []));
  if (names.length === 0) return "Some of the holders (none ticked yet)";
  if (names.length === 1) return `Only ${names[0]}`;
  const howMany = authority.howMany ?? 1;
  if (howMany >= names.length) return `${listed(names)} jointly`;
  return `Any ${NUMBER_WORDS[howMany - 1] ?? howMany} of ${listed(names)}`;
}

/** Whether this holder may sign, where the account says so; null for a sole account or a choice not yet made. */
export function signsFor(application: Pick<FormApplication, "holders" | "signingAuthority">, holder: AccountHolder): boolean | null {
  const mode = application.signingAuthority?.mode;
  if (application.holders.length < 2 || !mode) return null;
  if (mode === "ANY_ONE" || mode === "ALL_JOINTLY") return true;
  return holder.signatory ?? (mode === "OTHER" ? null : false);
}

export const MAX_HOLDERS = 4;

export const occupationLabels: Record<Occupation, string> = {
  SALARIED: "Salaried",
  BUSINESS_OWNER: "Business owner",
  HOMEMAKER: "Homemaker",
  RETIRED: "Retired",
  STUDENT: "Student",
  OTHER: "Other",
};

/**
 * The firm keeps its own relationship types now, so there is no list of them here. A screen that offers them
 * asks for them with useRelationshipTypes, and one that reads a stored code resolves it the same way.
 */

export const organisationTypeLabels: Record<OrganisationType, string> = {
  PIC: "Private investment company (PIC)",
  TRUST_OR_FOUNDATION: "Trust or foundation",
  TRADING_COMPANY: "Trading company",
  OTHER: "Other",
};

export type Gender = "MALE" | "FEMALE";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type EmploymentStatus = "EMPLOYED" | "SELF_EMPLOYED" | "RETIRED" | "NOT_EMPLOYED";

export const genderLabels: Record<Gender, string> = { MALE: "Male", FEMALE: "Female" };

export const maritalStatusLabels: Record<MaritalStatus, string> = {
  SINGLE: "Single",
  MARRIED: "Married",
  DIVORCED: "Divorced",
  WIDOWED: "Widow(er)",
};

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  EMPLOYED: "Employed",
  SELF_EMPLOYED: "Self Employed",
  RETIRED: "Retired",
  NOT_EMPLOYED: "Not Employed",
};

/** The titles the self-certification is filled in with. */
export const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Dr"];

/** The seven emirates, for an address in the UAE: the paper asks for one "if applicable". */
export const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

/** How many nationalities and countries of citizenship the Client Details form has lines for. */
export const MAX_NATIONALITIES = 4;
export const MAX_CITIZENSHIP = 4;

/*
 * Schedule 2's second page (24 Nov 2026), each answer in the paper's own words and order. The keys are the API's.
 */
export const serviceLabels = {
  INVESTMENT_ADVICE: "Investment Advice",
  DISCRETIONARY_PORTFOLIO_MANAGEMENT: "Discretionary Portfolio Management",
  NON_DISCRETIONARY_PORTFOLIO_MANAGEMENT: "Non-discretionary Portfolio Management",
  REAL_ESTATE_INVESTMENTS: "Real Estate Investments",
  PRIVATE_EQUITY_INVESTMENTS: "Private Equity Investments",
  FAMILY_OFFICE_SERVICES: "Family Office Services",
} as const;
export const turnoverLabels = {
  LESS_THAN_500K: "Less than USD500,000",
  FROM_500K_TO_1M: "USD500,000 to USD1,000,000",
  MORE_THAN_1M: "More than USD1,000,000",
} as const;
export const netWealthLabels = {
  LESS_THAN_500K: "Less than USD500,000",
  FROM_500K_TO_5M: "USD500,000 to USD5,000,000",
  FROM_5M_TO_10M: "USD5,000,000 to USD10,000,000",
  FROM_10M_TO_25M: "USD10,000,000 to USD25,000,000",
  MORE_THAN_25M: "More than USD25,000,000",
} as const;
export const wealthSourceLabels = {
  PROFESSIONAL_OR_BUSINESS_ACTIVITIES: "Professional/business activities",
  INHERITANCE_OR_GIFTS: "Inheritance / Gifts",
  PENSION_OR_STOCK_OPTION_PAY_OUT: "Pension or Stock option pay out",
  REAL_ESTATE_TRANSACTIONS: "Real estate transactions",
  MANAGING_PERSONAL_INVESTMENTS: "Managing personal investments",
  SALE_OF_OWN_BUSINESS: "Sale of own business",
} as const;
export const incomeLabels = {
  UP_TO_100K: "Up to USD100,000",
  FROM_100K_TO_250K: "USD100,000 to USD250,000",
  FROM_250K_TO_500K: "USD250,000 to USD500,000",
  FROM_500K_TO_1M: "USD500,000 to USD1,000,000",
  MORE_THAN_1M: "More than USD1,000,000",
} as const;
export const incomeSourceLabels = {
  SALARY_OR_PENSION: "Salary or Pension",
  INCOME_FROM_INVESTMENTS: "Income from investments",
  BUSINESS_INCOME: "Business Income",
  RENTAL_INCOME: "Rental Income",
} as const;
export const knowledgeLabels = { POOR: "Poor", MODERATE: "Moderate", GOOD: "Good", EXCELLENT: "Excellent" } as const;
export const activeForLabels = {
  LESS_THAN_1_YEAR: "Less than 1 year",
  FROM_1_TO_2_YEARS: "1 to 2 years",
  FROM_3_TO_5_YEARS: "3 to 5 years",
  MORE_THAN_5_YEARS: "more than 5 years",
} as const;
export const managedByLabels = {
  BY_MYSELF: "by myself",
  WITH_ADVICE_OF_A_FINANCIAL_ADVISOR: "with advice of a financial advisor",
  NON_DISCRETIONARY_MANAGEMENT: "non-discretionary management",
  DISCRETIONARY_MANAGEMENT: "discretionary management",
} as const;
export const productLabels = {
  SHARES: "shares (equity)",
  BONDS: "bonds (debentures)",
  COLLECTIVE_INVESTMENT_FUNDS: "collective investment funds",
  REAL_ESTATE: "real estate",
  STRUCTURED_PRODUCTS: "structured products",
  DERIVATIVES: "derivatives (options, futures)",
  INSURANCE_INVESTMENTS: "insurance investments",
  COMMODITIES: "commodities",
  CURRENCIES: "currencies",
  HEDGE_FUNDS: "hedge funds",
  PRIVATE_EQUITY: "private equity",
  INSURANCE_PRODUCTS: "insurance products",
} as const;
export const decisionLabels = { SELDOM: "seldom", MONTHLY: "monthly", WEEKLY: "weekly", DAILY: "daily" } as const;

export type Service = keyof typeof serviceLabels;
export type Turnover = keyof typeof turnoverLabels;
export type NetWealth = keyof typeof netWealthLabels;
export type WealthSource = keyof typeof wealthSourceLabels;
export type Income = keyof typeof incomeLabels;
export type IncomeSource = keyof typeof incomeSourceLabels;
export type Knowledge = keyof typeof knowledgeLabels;
export type ActiveFor = keyof typeof activeForLabels;
export type ManagedBy = keyof typeof managedByLabels;
export type Product = keyof typeof productLabels;
export type Decision = keyof typeof decisionLabels;

/** How many countries the paper has lines for where wealth was built up and income is earned. */
export const MAX_WEALTH_COUNTRIES = 4;

/*
 * Schedule 2(A), the firm's Client Details form for an entity (25 Nov 2026), each answer in the paper's own words and
 * order. The keys are the API's.
 */
export const legalFormLabels = { CORPORATE_PRIVATE: "Corporate-Private", CORPORATE_LISTED: "Corporate-Listed", TRUST: "Trust" } as const;
export const activityLabels = {
  COMMERCIAL: "Commercial activities",
  INVESTMENT: "Investment activities",
  PERSONAL_INVESTMENT_VEHICLE: "Personal investment vehicle",
  HOLDING: "Holding activities",
} as const;
export const companyWealthSourceLabels = {
  BUSINESS_INCOME: "Business Income",
  INCOME_FROM_INVESTMENTS: "Income from Investments",
  SHAREHOLDERS_EQUITY: "Shareholder's Equity",
  PRIVATE_PLACEMENT: "Private Placement",
  SALE_OF_INVESTMENTS: "Sale of Investments",
} as const;
export const capitalSourceLabels = {
  PROFESSIONAL_INCOME: "Professional Income",
  SALE_OF_INVESTMENTS: "Sale of Investments",
  REAL_ESTATE_TRANSACTIONS: "Real estate transactions",
  GIFT_OR_INHERITANCE: "Gift /Inheritance",
  INCOME_FROM_INVESTMENTS: "Income from Investments",
} as const;
export const companyActiveForLabels = {
  LESS_THAN_1_YEAR: "Less than 1 year",
  FROM_1_TO_2_YEARS: "1 to 2 years",
  FROM_3_TO_5_YEARS: "3 to 5 years",
  MORE_THAN_5_YEARS: "more than 5 years",
} as const;
export const companyManagedByLabels = {
  BY_MYSELF: "By self",
  WITH_ADVICE_OF_A_FINANCIAL_ADVISOR: "With advice of a financial advisor",
  NON_DISCRETIONARY_MANAGEMENT: "Non-discretionary management",
  DISCRETIONARY_MANAGEMENT: "Discretionary management",
} as const;
export const companyProductLabels = {
  SHARES: "Shares (equity)",
  BONDS: "Bonds (debentures)",
  COLLECTIVE_INVESTMENT_FUNDS: "Collective investment funds",
  SUKUK: "Sukuk",
  STRUCTURED_PRODUCTS: "Structured products",
  DERIVATIVES: "Derivatives (options, futures)",
  INSURANCE_INVESTMENTS: "Insurance investments",
  COMMODITIES: "Commodities",
  CURRENCIES: "Currencies",
  HEDGE_FUNDS: "Hedge funds",
  PRIVATE_EQUITY: "Private equity",
  INSURANCE_PRODUCTS: "Insurance products",
} as const;
export type LegalForm = keyof typeof legalFormLabels;
export type Activity = keyof typeof activityLabels;
export type CompanyWealthSource = keyof typeof companyWealthSourceLabels;
export type CapitalSource = keyof typeof capitalSourceLabels;
export type CompanyProduct = keyof typeof companyProductLabels;

/** The paper's numbered lines: directors and partners, shareholders, and the persons who will interact with us. */
export const DIRECTOR_LINES = 8;
export const SHAREHOLDER_LINES = 6;
export const SIGNATORY_LINES = 8;
/** "Other countries of operations / business": four lines on the paper. */
export const MAX_OPERATION_COUNTRIES = 4;
/** The questionnaire's Part A has room for Beneficial Owner I, II and III. */
export const MOST_OWNERS = 3;

/** A director, partner or authorised signatory: a name and a position. */
export interface NamedLine {
  name: string | null;
  position: string | null;
}

/** A shareholder, its share, and the individual(s) controlling it, one name a line. */
export interface ShareholderLine {
  name: string | null;
  sharePercent: number | null;
  controllers: string | null;
}

/** Schedule 2(A) beyond the entity's own lines (25 Nov 2026), as the API's CompanyDetails holds it. */
export interface FormCompany {
  form: LegalForm | null;
  tradingNames: string | null;
  placeOfIncorporation: string | null;
  registeredEmirate: string | null;
  tradingAddress: Address;
  tradingEmirate: string | null;
  mailingAddress: Address;
  mailingEmirate: string | null;
  contactName: string | null;
  phone: string | null;
  secondPhone: string | null;
  fax: string | null;
  secondFax: string | null;
  email: string | null;
  secondEmail: string | null;
  website: string | null;
  activities: Activity[];
  activitiesDetail: string | null;
  partOfGroup: boolean | null;
  groupName: string | null;
  groupCountry: string | null;
  externalAuditor: string | null;
  pep: boolean | null;
  pepPerson: PepLine;
  /** Always the paper's eight lines, written on or not. */
  directors: NamedLine[];
  listed: boolean | null;
  exchange: string | null;
  ticker: string | null;
  /** Always the paper's six lines. */
  shareholders: ShareholderLine[];
  /** Always the paper's eight lines. */
  signatories: NamedLine[];
  services: Service[];
  servicesOther: string | null;
  turnover: Turnover | null;
  netWealth: NetWealth | null;
  netWealthOther: string | null;
  wealthSources: CompanyWealthSource[];
  wealthSourcesOther: string | null;
  personalInvestmentVehicle: boolean | null;
  capitalSources: CapitalSource[];
  capitalSourcesOther: string | null;
  activeFor: ActiveFor | null;
  activeForOther: string | null;
  managedBy: ManagedBy | null;
  managedByOther: string | null;
  products: CompanyProduct[];
  productsOther: string | null;
}

const lines = <T>(count: number, empty: () => T, given: unknown): T[] => {
  const saved = Array.isArray(given) ? (given as Partial<T>[]) : [];
  return Array.from({ length: Math.max(count, saved.length) }, (_, at) => ({ ...empty(), ...Object.fromEntries(Object.entries(saved[at] ?? {}).filter(([, value]) => value !== undefined)) }) as T);
};
const emptyNamed = (): NamedLine => ({ name: null, position: null });
const emptyShareholder = (): ShareholderLine => ({ name: null, sharePercent: null, controllers: null });

export function emptyCompany(): FormCompany {
  return {
    form: null, tradingNames: null, placeOfIncorporation: null, registeredEmirate: null,
    tradingAddress: emptyAddress(), tradingEmirate: null, mailingAddress: emptyAddress(), mailingEmirate: null,
    contactName: null, phone: null, secondPhone: null, fax: null, secondFax: null, email: null, secondEmail: null, website: null,
    activities: [], activitiesDetail: null, partOfGroup: null, groupName: null, groupCountry: null,
    externalAuditor: null, pep: null, pepPerson: { name: null, function: null },
    directors: lines(DIRECTOR_LINES, emptyNamed, []), listed: null, exchange: null, ticker: null,
    shareholders: lines(SHAREHOLDER_LINES, emptyShareholder, []), signatories: lines(SIGNATORY_LINES, emptyNamed, []),
    services: [], servicesOther: null, turnover: null, netWealth: null, netWealthOther: null, wealthSources: [], wealthSourcesOther: null,
    personalInvestmentVehicle: null, capitalSources: [], capitalSourcesOther: null,
    activeFor: null, activeForOther: null, managedBy: null, managedByOther: null, products: [], productsOther: null,
  };
}

/** A saved company read loosely: an entity saved before 25 Nov 2026 has none, and lists may come back null. */
function companyOf(saved: unknown): FormCompany {
  const empty = emptyCompany();
  const answered = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof FormCompany, unknown>>;
  const present = Object.fromEntries(Object.entries(answered).filter(([, value]) => value !== null && value !== undefined));
  return {
    ...empty,
    ...present,
    tradingAddress: { ...emptyAddress(), ...(answered.tradingAddress as Partial<Address> | null) },
    mailingAddress: { ...emptyAddress(), ...(answered.mailingAddress as Partial<Address> | null) },
    pepPerson: { name: null, function: null, ...(answered.pepPerson as Partial<PepLine> | null) },
    directors: lines(DIRECTOR_LINES, emptyNamed, answered.directors),
    shareholders: lines(SHAREHOLDER_LINES, emptyShareholder, answered.shareholders),
    signatories: lines(SIGNATORY_LINES, emptyNamed, answered.signatories),
  } as FormCompany;
}

/** What's sent of the company: no answers a No has closed, no blank lines, and an emirate only for the UAE. */
function tidyCompany(company: FormCompany, registered: Address): FormCompany {
  const inTheUae = (address: Address) => address.country === "AE";
  const trading = companyAddressGiven(company.tradingAddress);
  const mailing = companyAddressGiven(company.mailingAddress);
  const written = (value: string | null) => Boolean(value?.trim());
  return {
    ...company,
    registeredEmirate: inTheUae(registered) ? company.registeredEmirate : null,
    tradingAddress: trading ? company.tradingAddress : (null as unknown as Address),
    tradingEmirate: trading && inTheUae(company.tradingAddress) ? company.tradingEmirate : null,
    mailingAddress: mailing ? company.mailingAddress : (null as unknown as Address),
    mailingEmirate: mailing && inTheUae(company.mailingAddress) ? company.mailingEmirate : null,
    groupName: company.partOfGroup ? company.groupName : null,
    groupCountry: company.partOfGroup ? company.groupCountry : null,
    pepPerson: company.pep ? company.pepPerson : (null as unknown as PepLine),
    exchange: company.listed ? company.exchange : null,
    ticker: company.listed ? company.ticker : null,
    capitalSources: company.personalInvestmentVehicle ? company.capitalSources : [],
    capitalSourcesOther: company.personalInvestmentVehicle ? company.capitalSourcesOther : null,
    directors: company.directors.filter((one) => written(one.name) || written(one.position)),
    shareholders: company.shareholders.filter((one) => written(one.name) || one.sharePercent !== null || written(one.controllers)),
    signatories: company.signatories.filter((one) => written(one.name) || written(one.position)),
  };
}

/*
 * The CRS / FATCA Self-Certification Form for an entity (v. Oct 2025), after the entity's questionnaire (25 Nov 2026),
 * in the paper's words. The keys are the API's.
 */
export type NoTinReason = "A" | "B" | "C";
export const noTinReasonLabels: Record<NoTinReason, string> = { A: "A", B: "B", C: "C" };
export const noTinReasonText: Record<NoTinReason, string> = {
  A: "Reason A – The Country/Jurisdiction where the {who} is resident does not issue TINs to its residents.",
  B: "Reason B – The Country/Jurisdiction where the {who} is resident issues TINs, but the {who} is unable or not required to obtain a TIN (please explain below why the {who} is unable or not required to obtain a TIN).",
  C: "Reason C – Other reason(s) (please explain below).",
};
export const classificationLabels = {
  INVESTMENT_ENTITY_NON_PARTICIPATING: "Investment Entity located in a Non-Participating Jurisdiction and managed by another Financial Institution",
  OTHER_FINANCIAL_INSTITUTION: "Other Financial Institution – Depository Institution, Custodial Institution, Investment Entity or Specified Insurance Company",
  ACTIVE_NFE_LISTED: "Active NFE – A corporation that is publicly traded or a Related Entity of a publicly traded corporation",
  ACTIVE_NFE_GOVERNMENT: "Active NFE – A Governmental Entity, an International Organisation, a Central Bank or an entity wholly-owned by one or more of the foregoing",
  ACTIVE_NFE_OTHER: "Active NFE – Other than those stated above, for example, an active business, a holding company that is a member of a non-financial group, etc.",
  PASSIVE_NFE: "Passive NFE – An NFE that is not an Active NFE",
} as const;
export type Classification = keyof typeof classificationLabels;
export const listedAsLabels = {
  TRADED: "The Account Holder is a corporation, the shares of which are regularly traded on an established securities market",
  RELATED_ENTITY: "The Account Holder is a Related Entity of a corporation, the shares of which are regularly traded on an established securities market",
} as const;
export type ListedAs = keyof typeof listedAsLabels;
export const controllerTypeGroups = [
  { group: "Controlling Person of a Legal Person", types: { OWNERSHIP: "Control by ownership (e.g. shareholder)", OTHER_MEANS: "Control by other means", SENIOR_MANAGING_OFFICIAL: "Senior managing official" } },
  { group: "Controlling Person of a Trust", types: { SETTLOR: "Settlor", TRUSTEE: "Trustee", PROTECTOR: "Protector", BENEFICIARY: "Beneficiary", TRUST_OTHER: "Other (please specify)" } },
  { group: "Controlling Person of a Legal Arrangement (Non-Trust)", types: { SETTLOR_EQUIVALENT: "Settlor-equivalent", TRUSTEE_EQUIVALENT: "Trustee-equivalent", PROTECTOR_EQUIVALENT: "Protector-equivalent", BENEFICIARY_EQUIVALENT: "Beneficiary-equivalent", OTHER_EQUIVALENT: "Other-equivalent (please specify)" } },
] as const;
export type ControllerType = "OWNERSHIP" | "OTHER_MEANS" | "SENIOR_MANAGING_OFFICIAL" | "SETTLOR" | "TRUSTEE" | "PROTECTOR" | "BENEFICIARY" | "TRUST_OTHER"
  | "SETTLOR_EQUIVALENT" | "TRUSTEE_EQUIVALENT" | "PROTECTOR_EQUIVALENT" | "BENEFICIARY_EQUIVALENT" | "OTHER_EQUIVALENT";
/** Three lines on the paper for tax residences; four for the names of controlling persons. */
export const TAX_LINES = 3;
export const CONTROLLING_LINES = 4;

export interface TaxLine {
  country: string | null;
  tin: string | null;
  reason: NoTinReason | null;
}

/** A controlling person: Part 3's name line, and the Annex. */
export interface FormControllingPerson {
  fullName: string | null;
  title: string | null;
  surname: string | null;
  firstName: string | null;
  middleNames: string | null;
  dateOfBirth: string | null;
  townOfBirth: string | null;
  countryOfBirth: string | null;
  residenceAddress: Address;
  mailingAddress: Address;
  /** Always the paper's three lines. */
  taxResidences: TaxLine[];
  noTinExplanation: string | null;
  type: ControllerType | null;
  typeOther: string | null;
}

export interface FormSelfCertification {
  placeOfOperations: string | null;
  /** Always the paper's three lines. */
  taxResidences: TaxLine[];
  noTinExplanation: string | null;
  classification: Classification | null;
  listedAs: ListedAs | null;
  relatedEntity: string | null;
  securitiesMarket: string | null;
  activeCategory: string | null;
  /** Always the paper's four lines. */
  controllingPersons: FormControllingPerson[];
}

const emptyTaxLine = (): TaxLine => ({ country: null, tin: null, reason: null });
export function emptyControllingPerson(): FormControllingPerson {
  return {
    fullName: null, title: null, surname: null, firstName: null, middleNames: null, dateOfBirth: null, townOfBirth: null, countryOfBirth: null,
    residenceAddress: emptyAddress(), mailingAddress: emptyAddress(), taxResidences: lines(TAX_LINES, emptyTaxLine, []), noTinExplanation: null,
    type: null, typeOther: null,
  };
}
export function emptySelfCertification(): FormSelfCertification {
  return {
    placeOfOperations: null, taxResidences: lines(TAX_LINES, emptyTaxLine, []), noTinExplanation: null, classification: null, listedAs: null,
    relatedEntity: null, securitiesMarket: null, activeCategory: null, controllingPersons: lines(CONTROLLING_LINES, emptyControllingPerson, []),
  };
}

/** A saved self-certification read loosely: an entity saved before 25 Nov 2026 has none. */
function selfCertificationOf(saved: unknown): FormSelfCertification {
  const empty = emptySelfCertification();
  const answered = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof FormSelfCertification, unknown>>;
  const present = Object.fromEntries(Object.entries(answered).filter(([, value]) => value !== null && value !== undefined));
  const people = Array.isArray(answered.controllingPersons) ? (answered.controllingPersons as Partial<Record<keyof FormControllingPerson, unknown>>[]) : [];
  return {
    ...empty,
    ...present,
    taxResidences: lines(TAX_LINES, emptyTaxLine, answered.taxResidences),
    controllingPersons: Array.from({ length: Math.max(CONTROLLING_LINES, people.length) }, (_, at) => {
      const one = people[at] ?? {};
      const kept = Object.fromEntries(Object.entries(one).filter(([, value]) => value !== null && value !== undefined));
      return {
        ...emptyControllingPerson(),
        ...kept,
        residenceAddress: { ...emptyAddress(), ...(one.residenceAddress as Partial<Address> | null) },
        mailingAddress: { ...emptyAddress(), ...(one.mailingAddress as Partial<Address> | null) },
        taxResidences: lines(TAX_LINES, emptyTaxLine, one.taxResidences),
      } as FormControllingPerson;
    }),
  } as FormSelfCertification;
}

/** Whether the classification asks for controlling persons: "Complete the Controlling Person(s) section below if this box is ticked". */
export function asksControllingPersons(form: FormSelfCertification) {
  return form.classification === "PASSIVE_NFE" || form.classification === "INVESTMENT_ENTITY_NON_PARTICIPATING";
}

/** The controlling persons named in Part 3, by their place on the form. */
export function namedControllers(form: FormSelfCertification): number[] {
  if (!asksControllingPersons(form)) return [];
  return form.controllingPersons.flatMap((one, at) => (one.fullName?.trim() ? [at] : []));
}

/** A tax table as sent: no blank lines, and no reason where a TIN is given. */
function tidyTaxLines(rows: TaxLine[]): TaxLine[] {
  return rows.filter((row) => row.country || row.tin?.trim() || row.reason).map((row) => ({ ...row, reason: row.tin?.trim() ? null : row.reason }));
}

/** Why there is no TIN, kept only where Reason B or C asks for it. */
function explainedTaxLines(rows: TaxLine[], text: string | null) {
  return rows.some((row) => !row.tin?.trim() && (row.reason === "B" || row.reason === "C")) ? text : null;
}

/** What's sent of the self-certification: no lines left blank, and only what the classification asks. */
function tidySelfCertification(form: FormSelfCertification): FormSelfCertification {
  const taxLines = tidyTaxLines;
  const explained = explainedTaxLines;
  const listed = form.classification === "ACTIVE_NFE_LISTED";
  return {
    ...form,
    taxResidences: taxLines(form.taxResidences),
    noTinExplanation: explained(form.taxResidences, form.noTinExplanation),
    listedAs: listed ? form.listedAs : null,
    relatedEntity: listed && form.listedAs === "RELATED_ENTITY" ? form.relatedEntity : null,
    securitiesMarket: listed ? form.securitiesMarket : null,
    activeCategory: form.classification === "ACTIVE_NFE_OTHER" ? form.activeCategory : null,
    controllingPersons: asksControllingPersons(form)
      ? form.controllingPersons.filter((one) => one.fullName?.trim()).map((one) => ({
          ...one,
          mailingAddress: addressGiven(one.mailingAddress) || one.mailingAddress.city?.trim() ? one.mailingAddress : (null as unknown as Address),
          taxResidences: taxLines(one.taxResidences),
          noTinExplanation: explained(one.taxResidences, one.noTinExplanation),
          typeOther: one.type === "TRUST_OTHER" || one.type === "OTHER_EQUIVALENT" ? one.typeOther : null,
        }))
      : [],
  };
}

/** Whether anything of a company's trading or mailing address was given, as each is only "if different". */
export function companyAddressGiven(address: Address | null | undefined) {
  return addressGiven(address) || Boolean(address?.line2?.trim());
}

/** Somebody a politically exposed holder names; the form always holds the paper's two lines. */
export interface PepLine {
  name: string | null;
  function: string | null;
}

/** Schedule 2's second page for one holder (24 Nov 2026), as the API's HolderProfile holds it. */
export interface FormProfile {
  pep: boolean | null;
  pepPeople: PepLine[];
  services: Service[];
  servicesOther: string | null;
  turnover: Turnover | null;
  netWealth: NetWealth | null;
  netWealthOther: string | null;
  wealthSources: WealthSource[];
  wealthSourcesOther: string | null;
  wealthCountries: string[];
  income: Income | null;
  incomeSources: IncomeSource[];
  incomeSourcesOther: string | null;
  incomeCountries: string[];
  knowledge: Knowledge | null;
  knowledgeOther: string | null;
  activeFor: ActiveFor | null;
  activeForOther: string | null;
  managedBy: ManagedBy | null;
  managedByOther: string | null;
  products: Product[];
  productsOther: string | null;
  decisions: Decision | null;
  decisionsOther: string | null;
}

export function emptyProfile(): FormProfile {
  return {
    pep: null,
    pepPeople: [{ name: null, function: null }, { name: null, function: null }],
    services: [],
    servicesOther: null,
    turnover: null,
    netWealth: null,
    netWealthOther: null,
    wealthSources: [],
    wealthSourcesOther: null,
    wealthCountries: [],
    income: null,
    incomeSources: [],
    incomeSourcesOther: null,
    incomeCountries: [],
    knowledge: null,
    knowledgeOther: null,
    activeFor: null,
    activeForOther: null,
    managedBy: null,
    managedByOther: null,
    products: [],
    productsOther: null,
    decisions: null,
    decisionsOther: null,
  };
}

/** A saved profile read loosely: before 24 Nov 2026 there was none, and lists may come back null. */
function profileOf(saved: Partial<Record<keyof FormProfile, unknown>> | null | undefined): FormProfile {
  const empty = emptyProfile();
  const answered = (saved ?? {}) as Partial<FormProfile>;
  const people = (answered.pepPeople ?? []).map((one) => ({ name: one?.name ?? null, function: one?.function ?? null }));
  return {
    ...empty,
    ...Object.fromEntries(Object.entries(answered).filter(([, value]) => value !== null && value !== undefined)),
    pepPeople: [people[0] ?? empty.pepPeople[0]!, people[1] ?? empty.pepPeople[1]!],
  } as FormProfile;
}

/**
 * What the firm's Client Details form (Schedule 2) and the Oct 2025 self-certification ask of a person beyond the
 * holder's own fields (24 Nov 2026), as the API's HolderDetails holds it. The first or given name is the holder's
 * forenames, the job title is the employer's position, and the first nationality is the holder's nationality.
 */
export interface HolderDetails {
  title: string | null;
  middleNames: string | null;
  previousNames: string | null;
  otherNames: string | null;
  gender: Gender | null;
  placeOfBirth: string | null;
  maritalStatus: MaritalStatus | null;
  spouseName: string | null;
  otherNationalities: string[];
  citizenship: string[];
  legalDomicile: string | null;
  fiscalResidence: string | null;
  emirate: string | null;
  mailingEmirate: string | null;
  secondPhone: string | null;
  fax: string | null;
  secondFax: string | null;
  secondEmail: string | null;
  employmentStatus: EmploymentStatus | null;
  sector: string | null;
  /** A joint holder whose Client Details the RM chose not to take (24 Nov 2026): not needed to submit. */
  skipped: boolean;
  /** Schedule 2's second page (24 Nov 2026). */
  profile: FormProfile;
  /** The CRS / FATCA self-certification's Part 2 (25 Nov 2026): always the paper's three lines. */
  taxResidences: TaxLine[];
  noTinExplanation: string | null;
}

export function emptyDetails(): HolderDetails {
  return {
    title: null,
    middleNames: null,
    previousNames: null,
    otherNames: null,
    gender: null,
    placeOfBirth: null,
    maritalStatus: null,
    spouseName: null,
    otherNationalities: [],
    citizenship: [],
    legalDomicile: null,
    fiscalResidence: null,
    emirate: null,
    mailingEmirate: null,
    secondPhone: null,
    fax: null,
    secondFax: null,
    secondEmail: null,
    employmentStatus: null,
    sector: null,
    skipped: false,
    profile: emptyProfile(),
    taxResidences: Array.from({ length: TAX_LINES }, () => ({ country: null, tin: null, reason: null })),
    noTinExplanation: null,
  };
}

/** Whether a holder's professional status asks for their job, employer and country of business. */
export function works(details: HolderDetails) {
  return details.employmentStatus === "EMPLOYED" || details.employmentStatus === "SELF_EMPLOYED";
}

/** A holder with every section present, so the form never has to check for missing parts. */
export interface FormHolder extends AccountHolder {
  employer: Employer;
  business: Business & { countriesOfBusiness: string[] };
  residentialAddress: Address;
  mailingAddress: Address;
  details: HolderDetails;
}

export interface FormEntity extends Omit<EntityDetails, "company" | "selfCertification"> {
  countriesOfBusiness: string[];
  registeredAddress: Address;
  /** Schedule 2(A) beyond the lines above (25 Nov 2026). */
  company: FormCompany;
  /** The CRS / FATCA self-certification beyond the lines above (25 Nov 2026). */
  selfCertification: FormSelfCertification;
}

export interface FormApplication extends Omit<OnboardingApplication, "entity" | "beneficialOwners"> {
  holders: FormHolder[];
  entity: FormEntity;
  /** An entity's beneficial owners, Schedule 2(B) each (25 Nov 2026); always at least one to fill in. */
  beneficialOwners: FormHolder[];
  signingAuthority: SigningAuthority;
  /** Schedule 6, as many times as the account needs it (24 Nov 2026); there is always at least one to fill in. */
  riskProfiles: FormRiskProfile[];
}

export function emptySigningAuthority(): SigningAuthority {
  return { mode: null, howMany: null, other: null };
}

export function emptyAddress(): Address {
  return { line1: null, line2: null, city: null, state: null, postalCode: null, country: null };
}

export function emptyHolder(): FormHolder {
  return {
    fullName: null,
    forenames: null,
    surname: null,
    relationshipToPrimary: null,
    dateOfBirth: null,
    idNumber: null,
    idExpiry: null,
    nationality: null,
    countryOfBirth: null,
    otherNationality: null,
    otherNationalityCountry: null,
    occupation: null,
    occupationOther: null,
    employer: { companyName: null, country: null, position: null },
    business: { companyName: null, country: null, entityType: null, natureOfBusiness: null, countriesOfBusiness: [] },
    phone: null,
    email: null,
    residentialAddress: emptyAddress(),
    mailingSameAsResidential: true,
    mailingAddress: emptyAddress(),
    secondaryMailingAddress: null,
    photo: null,
    signatory: null,
    details: emptyDetails(),
  };
}

function emptyEntity(): FormEntity {
  return {
    legalName: null,
    legalForm: null,
    taxResidency: null,
    giin: null,
    countryOfIncorporation: null,
    dateOfIncorporation: null,
    registrationNumber: null,
    natureOfBusiness: null,
    regulated: null,
    regulatorName: null,
    countriesOfBusiness: [],
    organisationType: null,
    organisationTypeOther: null,
    registeredAddress: emptyAddress(),
    company: emptyCompany(),
    selfCertification: emptySelfCertification(),
  };
}

export function newApplication(): FormApplication {
  return {
    clientType: "INDIVIDUAL",
    relationshipManagerId: null,
    holders: [emptyHolder()],
    entity: emptyEntity(),
    signingAuthority: emptySigningAuthority(),
    riskProfiles: [emptyRiskProfile()],
    beneficialOwners: [emptyHolder()],
  };
}

/** A saved application in the shape the form edits. */
export function toForm(saved: OnboardingApplication): FormApplication {
  const asForm = (holder: AccountHolder): FormHolder => {
    const empty = emptyHolder();
    // Read loosely: an application saved before 24 Nov 2026 has no details at all.
    const answered = (holder as { details?: Partial<HolderDetails> | null }).details ?? {};
    return {
      ...empty,
      ...holder,
      employer: { ...empty.employer, ...holder.employer },
      business: { ...empty.business, ...holder.business, countriesOfBusiness: holder.business?.countriesOfBusiness ?? [] },
      residentialAddress: { ...emptyAddress(), ...holder.residentialAddress },
      mailingAddress: { ...emptyAddress(), ...holder.mailingAddress },
      details: {
        ...emptyDetails(),
        ...answered,
        otherNationalities: answered.otherNationalities ?? [],
        citizenship: answered.citizenship ?? [],
        skipped: answered.skipped === true,
        profile: profileOf((answered as { profile?: Partial<Record<keyof FormProfile, unknown>> | null }).profile),
        taxResidences: lines(TAX_LINES, emptyTaxLine, answered.taxResidences),
      },
    };
  };
  const holders = (saved.holders ?? []).map(asForm);
  const owners = (saved.beneficialOwners ?? []).map(asForm);
  const entity = emptyEntity();
  const form: FormApplication = {
    clientType: saved.clientType ?? "INDIVIDUAL",
    relationshipManagerId: saved.relationshipManagerId,
    holders: holders.length > 0 ? holders : [emptyHolder()],
    entity: {
      ...entity,
      ...saved.entity,
      countriesOfBusiness: saved.entity?.countriesOfBusiness ?? [],
      registeredAddress: { ...emptyAddress(), ...saved.entity?.registeredAddress },
      company: companyOf(saved.entity?.company),
      selfCertification: selfCertificationOf(saved.entity?.selfCertification),
    },
    signingAuthority: { ...emptySigningAuthority(), ...saved.signingAuthority },
    riskProfiles: riskProfilesOf((saved as { riskProfiles?: unknown }).riskProfiles),
    beneficialOwners: owners.length > 0 ? owners : [emptyHolder()],
  };
  return form.clientType === "ENTITY" ? form : oneQuestionnaireEach({ ...form, riskProfiles: byHolder(form.holders, form.riskProfiles) });
}

/** The saved risk profiles, or one to fill in where there are none yet, as on an application from before 24 Nov 2026. */
function riskProfilesOf(saved: unknown): FormRiskProfile[] {
  const profiles = Array.isArray(saved) ? saved.map((one) => riskProfileOf(one as Parameters<typeof riskProfileOf>[0])) : [];
  return profiles.length > 0 ? profiles : [emptyRiskProfile()];
}

/**
 * A draft saved before 25 Nov 2026, when the questionnaires were for whoever the relationship manager chose: each one
 * filled in for a holder by name goes beside them, and the rest fill the places left, in order.
 */
function byHolder(holders: FormHolder[], profiles: FormRiskProfile[]): FormRiskProfile[] {
  const left = [...profiles];
  const own = holders.map((holder) => {
    const name = holder.fullName?.trim().toLowerCase();
    const at = name ? left.findIndex((profile) => profile.filledInFor?.trim().toLowerCase() === name) : -1;
    return at >= 0 ? left.splice(at, 1)[0]! : null;
  });
  return own.map((profile) => profile ?? left.shift() ?? emptyRiskProfile());
}

/**
 * One risk questionnaire for every account holder, in the account's order (25 Nov 2026, the user's rule: a main holder
 * and two joint holders fill in three), a holder whose details were skipped included, each named for its holder. An
 * entity keeps its own one.
 */
export function oneQuestionnaireEach(application: FormApplication): FormApplication {
  if (application.clientType === "ENTITY") return application;
  const { holders, riskProfiles } = application;
  const aligned = holders.map((holder, at) => {
    const profile = riskProfiles[at] ?? emptyRiskProfile();
    const name = holder.fullName?.trim() || null;
    return profile.filledInFor === name ? profile : { ...profile, filledInFor: name };
  });
  const same = aligned.length === riskProfiles.length && aligned.every((profile, at) => profile === riskProfiles[at]);
  return same ? application : { ...application, riskProfiles: aligned };
}

/** What's submitted: only the client type in use, without answers to questions that no longer apply. */
export function tidy(application: FormApplication): OnboardingApplication {
  if (application.clientType === "ENTITY") {
    const { entity } = application;
    const owners = application.beneficialOwners.slice(0, MOST_OWNERS);
    return {
      ...application,
      holders: [],
      signingAuthority: null,
      // The entity's own questionnaire, once (25 Nov 2026): for the entity by name, with Part A for each owner.
      riskProfiles: application.riskProfiles.slice(0, 1).map((profile) => tidyRiskProfile({
        ...profile,
        filledInFor: entity.legalName,
        owners: owners.map((owner, at) => ({
          owner: owner.fullName,
          education: profile.owners[at]?.education ?? null,
          qualification: profile.owners[at]?.qualification ?? null,
        })),
      })),
      // A beneficial owner is asked what an individual client is, and is never an account holder (25 Nov 2026).
      beneficialOwners: owners.map((holder) => ({
        ...holder,
        signatory: null,
        relationshipToPrimary: null,
        otherNationalityCountry: null,
        occupationOther: null,
        employer: works(holder.details) ? holder.employer : null,
        business: null,
        mailingSameAsResidential: !addressGiven(holder.mailingAddress),
        mailingAddress: addressGiven(holder.mailingAddress) ? holder.mailingAddress : null,
        ...tidyDetails(holder),
      })),
      entity: {
        ...entity,
        regulatorName: entity.regulated ? entity.regulatorName : null,
        organisationTypeOther: entity.organisationType === "OTHER" ? entity.organisationTypeOther : null,
        company: tidyCompany(entity.company, entity.registeredAddress),
        selfCertification: tidySelfCertification(entity.selfCertification),
      },
    } as OnboardingApplication;
  }
  const joint = application.holders.length > 1;
  const mode = joint ? application.signingAuthority.mode : null;
  return {
    ...application,
    entity: null,
    beneficialOwners: null,
    riskProfiles: application.riskProfiles.map(tidyRiskProfile),
    // Only a joint account says who signs for it, and only what its choice needs (23 Nov 2026).
    signingAuthority: mode
      ? {
          mode,
          howMany: mode === "ANY_OF_NAMED" ? application.signingAuthority.howMany : null,
          other: mode === "OTHER" ? application.signingAuthority.other : null,
        }
      : null,
    holders: application.holders.map((holder, index) => ({
      ...holder,
      signatory: !mode ? null : mode === "ANY_ONE" || mode === "ALL_JOINTLY" ? true
        : mode === "ANY_OF_NAMED" ? Boolean(holder.signatory) : holder.signatory,
      relationshipToPrimary: index > 0 ? holder.relationshipToPrimary : null,
      otherNationalityCountry: holder.otherNationality ? holder.otherNationalityCountry : null,
      occupationOther: holder.occupation === "OTHER" ? holder.occupationOther : null,
      // The employer is asked of someone employed or self employed since 24 Nov 2026; an application from before
      // keeps a salaried holder's.
      employer: works(holder.details) || holder.occupation === "SALARIED" ? holder.employer : null,
      business: holder.occupation === "BUSINESS_OWNER" ? holder.business : null,
      // No tick box since 24 Nov 2026, as the paper has none: a mailing address given is one that differs.
      mailingSameAsResidential: !addressGiven(holder.mailingAddress),
      mailingAddress: addressGiven(holder.mailingAddress) ? holder.mailingAddress : null,
      ...tidyDetails(holder),
    })),
  };
}

/** A holder's details without answers their other answers no longer call for. */
function tidyDetails(holder: FormHolder): { details: HolderDetails } {
  const { details } = holder;
  const inTheUae = (address: Address | null) => address?.country === "AE";
  return {
    details: {
      ...details,
      spouseName: details.maritalStatus === "MARRIED" ? details.spouseName : null,
      // The paper's PEP lines only for a Yes, and only those written on (24 Nov 2026).
      profile: {
        ...details.profile,
        pepPeople: details.profile.pep ? details.profile.pepPeople.filter((one) => one.name?.trim() || one.function?.trim()) : [],
      },
      sector: works(details) ? details.sector : null,
      // The self-certification's tax lines written on, and why there is no TIN only for Reason B or C (25 Nov 2026).
      taxResidences: tidyTaxLines(details.taxResidences),
      noTinExplanation: explainedTaxLines(details.taxResidences, details.noTinExplanation),
      emirate: inTheUae(holder.residentialAddress) ? details.emirate : null,
      mailingEmirate: addressGiven(holder.mailingAddress) && inTheUae(holder.mailingAddress) ? details.mailingEmirate : null,
    },
  };
}

/** Whether anything of an address was given, as Schedule 2's mailing address is only when it differs (24 Nov 2026). */
export function addressGiven(address: Address | null | undefined) {
  const filled = (value: string | null | undefined) => Boolean(value && value.trim());
  return Boolean(address && (filled(address.line1) || filled(address.postalCode) || filled(address.country)));
}

export interface ReviewStep {
  id: string;
  /** The heading the step sits under in the step list, such as "Primary account holder". */
  group: string;
  label: string;
  complete: boolean;
  /** The fields this step still needs, as keys of {@link Review.problems}, in form order. */
  fields: string[];
  /** One of a joint holder's steps whose details were skipped (24 Nov 2026). */
  skipped?: boolean;
}

export interface Review {
  /** Each field, such as "holders[0].surname", with what's wrong with it, in form order. */
  problems: Record<string, string>;
  steps: ReviewStep[];
}

/** Named as the firm's Client Details form names them: Client 1, Client 2 and on (24 Nov 2026). */
export function holderGroup(index: number) {
  return `Client ${index + 1}`;
}

/** An entity's form (25 Nov 2026, the user's approved mockup): its eleven sections of Schedule 2(A), in the paper's order. */
export const ENTITY_STEPS: [string, string][] = [
  ["identification", "Identification details"],
  ["addresses", "Addresses"],
  ["contact", "Contact details"],
  ["activity", "Business activities and group"],
  ["regulation", "Regulation, auditor and PEP"],
  ["directors", "Directors / Partners"],
  ["shareholders", "Shareholders"],
  ["signatories", "Persons who will interact with us"],
  ["intentions", "Business intentions with us"],
  ["wealth", "About the Company's wealth"],
  ["experience", "The Company's experience and understanding of financial markets"],
];
export const COMPANY_GROUP = "Company · Schedule 2(A)";
export const ownerGroup = (index: number) => `Beneficial owner ${index + 1}`;

/** The self-certification's three parts to fill in, then an Annex of three for each controlling person (25 Nov 2026). */
export const SELF_CERT_STEPS: [string, string][] = [
  ["identification", "Part 1 · Identification of Account Holder"],
  ["tax", "Part 2 · Tax residence information"],
  ["classification", "Part 3 · Entity classification"],
];
export const CONTROLLER_STEPS: [string, string][] = [
  ["identification", "Part 1 · Identification of Controlling Person"],
  ["tax", "Part 2 · Tax residence information"],
  ["type", "Part 3 · Type of Controlling Person"],
];
export const SELF_CERT_GROUP = "Self-certification · Entity (CRS / FATCA)";

/** An individual's or joint holder's self-certification (25 Nov 2026): its own paper's Part 1 and Part 2. */
export const HOLDER_CERT_STEPS: [string, string][] = [
  ["identification", "Part 1 · Identification of Account Holder"],
  ["tax", "Part 2 · Tax residence information"],
];
export const holderCertGroup = (index: number) => `Self-certification · Client ${index + 1}`;
export const controllerGroup = (index: number) => `Controlling person ${index + 1}`;

const countryCodes = new Set(countries.map((country) => country.code));
const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Dates as yyyy-mm-dd, which compare correctly as text. */
export function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Checks the application step by step. Every field is required, and some only when an answer calls for them.
 *
 * @param managers the relationship managers that can be chosen; while they're loading, any choice is accepted
 */
/** A holder's ten steps in the pop-up, in Schedule 2's order (24 Nov 2026): the id's last part and the title. */
export const HOLDER_STEPS: [string, string][] = [
  ["name", "Name"],
  ["birth", "Birth and family"],
  ["nationality", "Nationality and residence"],
  ["address", "Address"],
  ["contact", "Contact details"],
  ["work", "Professional details"],
  ["pep", "Politically exposed person"],
  ["business", "Business intentions with us"],
  ["wealth", "Wealth and income"],
  ["experience", "Experience and understanding of financial markets"],
];

export function reviewApplication(application: FormApplication, managers: StaffMember[] | undefined, today = new Date()): Review {
  const problems: Record<string, string> = {};
  const steps: ReviewStep[] = [];
  const todayIso = isoDate(today);

  const problem = (field: string, message: string) => {
    problems[field] ??= message;
  };
  const blank = (value: string | null | undefined) => !value || value.trim() === "";
  const required = (value: string | null | undefined, field: string, message: string) => {
    if (blank(value)) problem(field, message);
  };
  const country = (value: string | null | undefined, field: string, message: string) => {
    if (!value || !countryCodes.has(value)) problem(field, message);
  };
  const pastDate = (value: string | null | undefined, field: string, missing: string, notPast: string) => {
    if (!value) problem(field, missing);
    else if (value >= todayIso || value < "1900-01-01") problem(field, notPast);
  };
  // A person's address as Schedule 2 asks it (24 Nov 2026): one line, the postal code or P.O. box and the country.
  const paperAddress = (value: Address | null, at: string) => {
    required(value?.line1, `${at}line1`, "Enter the address.");
    required(value?.postalCode, `${at}postalCode`, "Enter the postal code or P.O. box.");
    country(value?.country, `${at}country`, "Choose the country.");
  };
  const phoneNumber = (value: string | null | undefined, field: string) => {
    const message = mobileNumberMessage(value ?? "");
    if (message) problem(field, message.replace("mobile number", "telephone number"));
  };
  const step = (id: string, group: string, label: string, checks: () => void) => {
    const before = Object.keys(problems).length;
    checks();
    const fields = Object.keys(problems).slice(before);
    steps.push({ id, group, label, complete: fields.length === 0, fields });
  };

  step("client", "Client", "Client type", () => {
    if (!application.clientType) problem("clientType", "Choose whether the client is an individual or an entity.");
    const manager = application.relationshipManagerId;
    if (!manager) problem("relationshipManagerId", "Choose a relationship manager.");
    else if (managers && !managers.some((person) => person.id === manager)) {
      problem("relationshipManagerId", "Choose a relationship manager from the list.");
    }
  });

  // Schedule 2 for one person, a section at a time (24 Nov 2026): an account holder, or an entity's beneficial owner
  // (25 Nov 2026), whose sections are the same. Every line except those the paper leaves optional.
  const person = (holder: FormHolder, at: string, id: string, group: string, ownEmail: (required: boolean) => void) => {
    const { details } = holder;
    const profile = details.profile;
    const asked = `${at}details.profile.`;
    step(`${id}-name`, group, "Name", () => {
      required(holder.fullName, `${at}fullName`, "Enter their full name as it appears on the passport.");
    });
    step(`${id}-birth`, group, "Birth and family", () => {
      if (!details.gender) problem(`${at}details.gender`, "Choose their gender.");
      pastDate(holder.dateOfBirth, `${at}dateOfBirth`, "Choose their date of birth.", "Date of birth must be in the past.");
      required(details.placeOfBirth, `${at}details.placeOfBirth`, "Enter the town or city they were born in.");
      country(holder.countryOfBirth, `${at}countryOfBirth`, "Choose their country of birth.");
      if (!details.maritalStatus) problem(`${at}details.maritalStatus`, "Choose their marital status.");
      else if (details.maritalStatus === "MARRIED") required(details.spouseName, `${at}details.spouseName`, "Enter their spouse's name.");
    });
    step(`${id}-nationality`, group, "Nationality and residence", () => {
      // "Nationality (Nationalities)" is one line of up to four on the paper, so both are told on the one field.
      country(holder.nationality, `${at}nationality`, "Choose their nationality.");
      if (details.otherNationalities.length > MAX_NATIONALITIES - 1) {
        problem(`${at}nationality`, `The form has room for ${MAX_NATIONALITIES} nationalities in all.`);
      }
      if (details.citizenship.length === 0) {
        problem(`${at}details.citizenship`, "Choose at least one country of citizenship or residency.");
      } else if (details.citizenship.length > MAX_CITIZENSHIP) {
        problem(`${at}details.citizenship`, `The form has room for ${MAX_CITIZENSHIP} countries.`);
      }
    });
    step(`${id}-address`, group, "Address", () => {
      paperAddress(holder.residentialAddress, `${at}residentialAddress.`);
      // "Mailing address (if different to the address stated above)": checked once any of it is given.
      if (addressGiven(holder.mailingAddress)) paperAddress(holder.mailingAddress, `${at}mailingAddress.`);
    });
    // The telephone and the email are required; the second ones and the faxes are optional, as the paper leaves them.
    step(`${id}-contact`, group, "Contact details", () => {
      if (blank(holder.phone)) problem(`${at}phone`, "Enter their telephone number.");
      else phoneNumber(holder.phone, `${at}phone`);
      if (!blank(details.secondPhone)) phoneNumber(details.secondPhone, `${at}details.secondPhone`);
      ownEmail(true);
      if (!blank(details.secondEmail) && !email.test((details.secondEmail ?? "").trim())) {
        problem(`${at}details.secondEmail`, "Enter a valid email address, such as name@example.com.");
      }
    });
    // The status always; the job, the sector, the employer and the country of business of someone who works.
    step(`${id}-work`, group, "Professional details", () => {
      if (!details.employmentStatus) problem(`${at}details.employmentStatus`, "Choose their professional status.");
      else if (works(details)) {
        required(holder.employer.position, `${at}employer.position`, "Enter their job title or function.");
        required(details.sector, `${at}details.sector`, "Enter the sector or industry.");
        required(holder.employer.companyName, `${at}employer.companyName`, "Enter the name of their employer.");
        country(holder.employer.country, `${at}employer.country`, "Choose the country of business.");
      }
    });
    // Schedule 2's second page (24 Nov 2026), as the server reads it: a box, or "Other" written in, for each.
    const chosen = (value: unknown, other: string | null, key: string, message: string) => {
      if (!value && blank(other)) problem(`${asked}${key}`, message);
    };
    const ticked = (values: unknown[], other: string | null, key: string, message: string) => {
      if (values.length === 0 && blank(other)) problem(`${asked}${key}`, message);
    };
    step(`${id}-pep`, group, "Politically exposed person", () => {
      if (profile.pep === null) {
        problem(`${asked}pep`, "Say whether they are, or are close to, a politically exposed person.");
        return;
      }
      if (!profile.pep) return;
      profile.pepPeople.forEach((one, place) => {
        if (place === 0 || !blank(one.name) || !blank(one.function)) {
          required(one.name, `${asked}pepPeople[${place}].name`, "Enter the name.");
          required(one.function, `${asked}pepPeople[${place}].function`, "Enter their function.");
        }
      });
    });
    step(`${id}-business`, group, "Business intentions with us", () => {
      ticked(profile.services, profile.servicesOther, "services", "Tick the services or products they are interested in.");
      if (!profile.turnover) problem(`${asked}turnover`, "Choose the expected annual in/out flow turnover of assets.");
    });
    step(`${id}-wealth`, group, "Wealth and income", () => {
      chosen(profile.netWealth, profile.netWealthOther, "netWealth", "Choose their estimated global net wealth.");
      ticked(profile.wealthSources, profile.wealthSourcesOther, "wealthSources", "Tick how they built up their global net wealth.");
      if (profile.wealthCountries.length === 0) problem(`${asked}wealthCountries`, "Choose where they have or built up their wealth.");
      if (!profile.income) problem(`${asked}income`, "Choose their annual regular income.");
      ticked(profile.incomeSources, profile.incomeSourcesOther, "incomeSources", "Tick how they earn their regular income.");
      if (profile.incomeCountries.length === 0) problem(`${asked}incomeCountries`, "Choose where they earn their regular income.");
    });
    step(`${id}-experience`, group, "Experience and understanding of financial markets", () => {
      chosen(profile.knowledge, profile.knowledgeOther, "knowledge", "Choose their knowledge and understanding of financial markets.");
      chosen(profile.activeFor, profile.activeForOther, "activeFor", "Choose how long they have been active on the financial markets.");
      chosen(profile.managedBy, profile.managedByOther, "managedBy", "Choose how their assets have been managed before.");
      ticked(profile.products, profile.productsOther, "products", "Tick the products they have invested in on a regular basis.");
      chosen(profile.decisions, profile.decisionsOther, "decisions", "Choose how often they take investment decisions.");
    });
  };

  // Part 2 of a self-certification (25 Nov 2026): at least one country, each with its TIN or the reason there is none,
  // and an explanation once Reason B or C is chosen.
  const taxLines = (rows: TaxLine[], explanation: string | null, at: string) => {
    let any = false;
    let explain = false;
    rows.forEach((row, place) => {
      if (!row.country && blank(row.tin) && !row.reason) return;
      any = true;
      country(row.country, `${at}taxResidences[${place}].country`, "Choose the country or jurisdiction of tax residence.");
      if (blank(row.tin)) {
        if (!row.reason) problem(`${at}taxResidences[${place}].tin`, "Enter the TIN, or choose why there is none.");
        else if (row.reason !== "A") explain = true;
      }
    });
    if (!any) problem(`${at}taxResidences`, "Enter at least one country of tax residence.");
    if (explain) required(explanation, `${at}noTinExplanation`, "Explain why a TIN is not available.");
  };

  if (application.clientType === "ENTITY") {
    const { entity } = application;
    const company = entity.company;
    const asked = "entity.company.";
    const label = (part: string) => ENTITY_STEPS.find(([id]) => id === part)![1];
    const companyStep = (part: string, checks: () => void) => step(`entity-${part}`, COMPANY_GROUP, label(part), checks);
    const companyAddress = (value: Address, at: string) => {
      required(value.line1, `${at}line1`, "Enter the building name.");
      required(value.line2, `${at}line2`, "Enter the address.");
      required(value.postalCode, `${at}postalCode`, "Enter the postal code.");
      country(value.country, `${at}country`, "Choose the country.");
    };
    const validEmail = (value: string | null, field: string, needed: boolean) => {
      if (blank(value)) {
        if (needed) problem(field, "Enter the email address.");
      } else if (!email.test((value ?? "").trim())) problem(field, "Enter a valid email address, such as name@example.com.");
    };
    // A list the paper numbers lines for: at least one name, and a name wherever something else was written.
    const named = <T extends { name: string | null }>(rows: T[], at: string, none: string, other: (row: T) => boolean) => {
      if (!rows.some((row) => !blank(row.name))) {
        problem(at, none);
        return;
      }
      rows.forEach((row, place) => {
        if (blank(row.name) && other(row)) problem(`${at}[${place}].name`, "Enter the name.");
      });
    };
    const chosen = (value: unknown, other: string | null, key: string, message: string) => {
      if (!value && blank(other)) problem(`${asked}${key}`, message);
    };
    const ticked = (values: unknown[], other: string | null, key: string, message: string) => {
      if (values.length === 0 && blank(other)) problem(`${asked}${key}`, message);
    };
    // Schedule 2(A) (25 Nov 2026), as the server reads it: every line except those the paper leaves optional.
    companyStep("identification", () => {
      required(entity.legalName, "entity.legalName", "Enter the company's registered name.");
      if (!company.form) problem(`${asked}form`, "Choose the legal form.");
      pastDate(entity.dateOfIncorporation, "entity.dateOfIncorporation", "Choose the date of incorporation.", "Date of incorporation must be in the past.");
      required(company.placeOfIncorporation, `${asked}placeOfIncorporation`, "Enter the place or emirate of incorporation.");
      required(entity.registrationNumber, "entity.registrationNumber", "Enter the company's license number.");
    });
    companyStep("addresses", () => {
      companyAddress(entity.registeredAddress, "entity.registeredAddress.");
      if (companyAddressGiven(company.tradingAddress)) companyAddress(company.tradingAddress, `${asked}tradingAddress.`);
      if (entity.countriesOfBusiness.length > MAX_OPERATION_COUNTRIES) problem("entity.countriesOfBusiness", `The form has room for ${MAX_OPERATION_COUNTRIES} countries.`);
      if (companyAddressGiven(company.mailingAddress)) companyAddress(company.mailingAddress, `${asked}mailingAddress.`);
    });
    companyStep("contact", () => {
      required(company.contactName, `${asked}contactName`, "Enter the contact name.");
      if (blank(company.phone)) problem(`${asked}phone`, "Enter the telephone number.");
      validEmail(company.email, `${asked}email`, true);
      validEmail(company.secondEmail, `${asked}secondEmail`, false);
      country(entity.taxResidency, "entity.taxResidency", "Choose the country of fiscal residence.");
    });
    companyStep("activity", () => {
      if (company.activities.length === 0) problem(`${asked}activities`, "Tick the company's business activities.");
      if (company.partOfGroup === null) problem(`${asked}partOfGroup`, "Say whether the company is part of a group.");
      else if (company.partOfGroup) {
        required(company.groupName, `${asked}groupName`, "Enter the group's name.");
        country(company.groupCountry, `${asked}groupCountry`, "Choose the group's country.");
      }
    });
    companyStep("regulation", () => {
      if (entity.regulated === null) problem("entity.regulated", "Say whether the company is supervised by a financial services regulator.");
      else if (entity.regulated) required(entity.regulatorName, "entity.regulatorName", "Enter the name of the regulator.");
      required(company.externalAuditor, `${asked}externalAuditor`, "Enter the name of the external auditor.");
      if (company.pep === null) problem(`${asked}pep`, "Say whether any director, signatory or shareholder is, or is close to, a politically exposed person.");
      else if (company.pep) {
        required(company.pepPerson.name, `${asked}pepPerson.name`, "Enter the name.");
        required(company.pepPerson.function, `${asked}pepPerson.function`, "Enter their function.");
      }
    });
    companyStep("directors", () => named(company.directors, `${asked}directors`, "Enter at least one director or partner.", (row) => !blank(row.position)));
    companyStep("shareholders", () => {
      if (company.listed === null) problem(`${asked}listed`, "Say whether the company is publicly listed.");
      else if (company.listed) {
        required(company.exchange, `${asked}exchange`, "Enter the exchange and its country.");
        required(company.ticker, `${asked}ticker`, "Enter the ticker or code.");
      }
      company.shareholders.forEach((row, place) => {
        if (row.sharePercent !== null && (row.sharePercent < 0 || row.sharePercent > 100)) problem(`${asked}shareholders[${place}].sharePercent`, "Enter a percentage from 0 to 100.");
      });
      named(company.shareholders, `${asked}shareholders`, "Enter at least one shareholder.", (row) => row.sharePercent !== null || !blank(row.controllers));
    });
    companyStep("signatories", () => named(company.signatories, `${asked}signatories`, "Enter at least one person who will interact with us.", (row) => !blank(row.position)));
    companyStep("intentions", () => {
      ticked(company.services, company.servicesOther, "services", "Tick the services or products the company is interested in.");
      if (!company.turnover) problem(`${asked}turnover`, "Choose the expected annual in/out flow turnover of assets.");
    });
    companyStep("wealth", () => {
      chosen(company.netWealth, company.netWealthOther, "netWealth", "Choose the company's estimated global net wealth.");
      ticked(company.wealthSources, company.wealthSourcesOther, "wealthSources", "Tick how the company's wealth has been built up.");
      if (company.personalInvestmentVehicle === null) problem(`${asked}personalInvestmentVehicle`, "Say whether the company is a personal investment vehicle.");
      else if (company.personalInvestmentVehicle) {
        ticked(company.capitalSources, company.capitalSourcesOther, "capitalSources", "Tick the source of the vehicle's capital.");
      }
    });
    companyStep("experience", () => {
      chosen(company.activeFor, company.activeForOther, "activeFor", "Choose how long the company has been active on the financial markets.");
      chosen(company.managedBy, company.managedByOther, "managedBy", "Choose how the company's assets have been managed before.");
      ticked(company.products, company.productsOther, "products", "Tick the products the company has invested in on a regular basis.");
    });
    // Schedule 2(B) for each beneficial owner (25 Nov 2026). They never sign in, so their emails may be the same.
    const owners = application.beneficialOwners.length > 0 ? application.beneficialOwners : [emptyHolder()];
    owners.forEach((holder, index) => {
      const at = `beneficialOwners[${index}].`;
      person(holder, at, `owner-${index}`, ownerGroup(index), (needed) => {
        const given = (holder.email ?? "").trim();
        if (!given) {
          if (needed) problem(`${at}email`, "Enter their email address.");
        } else if (!email.test(given)) problem(`${at}email`, "Enter a valid email address, such as name@example.com.");
      });
    });
    reviewEntityRisk(application.riskProfiles[0] ?? emptyRiskProfile(), owners.length, step, problem);

    // The CRS / FATCA self-certification (25 Nov 2026), as the server reads it.
    const form = entity.selfCertification;
    const certified = "entity.selfCertification.";
    const certLabel = (part: string) => SELF_CERT_STEPS.find(([id]) => id === part)![1];
    step("sc-identification", SELF_CERT_GROUP, certLabel("identification"), () => {
      country(entity.countryOfIncorporation, "entity.countryOfIncorporation", "Choose the country or jurisdiction of incorporation.");
      required(entity.registeredAddress.city, "entity.registeredAddress.city", "Enter the city or town.");
      if (companyAddressGiven(company.mailingAddress)) required(company.mailingAddress.city, "entity.company.mailingAddress.city", "Enter the city or town.");
      country(form.placeOfOperations, `${certified}placeOfOperations`, "Choose the country or jurisdiction of operations.");
    });
    step("sc-tax", SELF_CERT_GROUP, certLabel("tax"), () => taxLines(form.taxResidences, form.noTinExplanation, certified));
    step("sc-classification", SELF_CERT_GROUP, certLabel("classification"), () => {
      if (!form.classification) {
        problem(`${certified}classification`, "Choose the entity's CRS classification.");
        return;
      }
      if (form.classification === "ACTIVE_NFE_LISTED") {
        if (!form.listedAs) problem(`${certified}listedAs`, "Say which of the two applies.");
        else if (form.listedAs === "RELATED_ENTITY") required(form.relatedEntity, `${certified}relatedEntity`, "Enter the corporation it is a Related Entity of.");
        required(form.securitiesMarket, `${certified}securitiesMarket`, "Enter the established securities market.");
      }
      if (form.classification === "ACTIVE_NFE_OTHER") required(form.activeCategory, `${certified}activeCategory`, "Say which category the Account Holder falls under.");
      if (asksControllingPersons(form) && namedControllers(form).length === 0) problem(`${certified}controllingPersons`, "Enter at least one controlling person.");
    });
    // The Annex for each controlling person Part 3 names.
    for (const place of namedControllers(form)) {
      const person = form.controllingPersons[place]!;
      const at = `${certified}controllingPersons[${place}].`;
      const group = controllerGroup(place);
      const annex = (part: string) => CONTROLLER_STEPS.find(([id]) => id === part)![1];
      const annexAddress = (value: Address, prefix: string) => {
        required(value.line1, `${prefix}line1`, "Enter the first line of the address.");
        required(value.city, `${prefix}city`, "Enter the city or town.");
        required(value.postalCode, `${prefix}postalCode`, "Enter the postal code or ZIP code.");
        country(value.country, `${prefix}country`, "Choose the country or jurisdiction.");
      };
      step(`cp-${place}-identification`, group, annex("identification"), () => {
        required(person.title, `${at}title`, "Choose their title.");
        required(person.surname, `${at}surname`, "Enter their surname.");
        required(person.firstName, `${at}firstName`, "Enter their first or given name.");
        pastDate(person.dateOfBirth, `${at}dateOfBirth`, "Choose their date of birth.", "Date of birth must be in the past.");
        required(person.townOfBirth, `${at}townOfBirth`, "Enter the town or city of birth.");
        country(person.countryOfBirth, `${at}countryOfBirth`, "Choose the country or jurisdiction of birth.");
        annexAddress(person.residenceAddress, `${at}residenceAddress.`);
        if (addressGiven(person.mailingAddress) || !blank(person.mailingAddress.city)) annexAddress(person.mailingAddress, `${at}mailingAddress.`);
      });
      step(`cp-${place}-tax`, group, annex("tax"), () => taxLines(person.taxResidences, person.noTinExplanation, at));
      step(`cp-${place}-type`, group, annex("type"), () => {
        if (!person.type) problem(`${at}type`, "Choose the type of controlling person.");
        else if (person.type === "TRUST_OTHER" || person.type === "OTHER_EQUIVALENT") required(person.typeOther, `${at}typeOther`, "Say what kind of controlling person they are.");
      });
    }
    return { problems, steps };
  }

  // Each holder becomes a customer who signs in with their email, so no two can share one.
  const emails = new Set<string>();
  application.holders.forEach((holder, index) => {
    const at = `holders[${index}].`;
    const group = holderGroup(index);
    const { details } = holder;
    // The email, as the server reads it: each holder signs in with their own.
    const ownEmail = (required: boolean) => {
      const given = (holder.email ?? "").trim().toLowerCase();
      if (!given) {
        if (required) problem(`${at}email`, "Enter their email address.");
        return;
      }
      if (!email.test(given)) problem(`${at}email`, "Enter a valid email address, such as name@example.com.");
      else if (emails.has(given)) problem(`${at}email`, "Each account holder needs their own email address.");
      else emails.add(given);
    };
    // A joint holder whose details the RM skipped (24 Nov 2026), as the server reads it: only a name to register
    // them by, and an email given is still checked.
    if (index > 0 && details.skipped) {
      HOLDER_STEPS.forEach(([part, label]) => step(`holder-${index}-${part}`, group, label, () => {
        if (part === "name") required(holder.fullName, `${at}fullName`, "Enter their full name as it appears on the passport.");
        if (part === "contact") ownEmail(false);
      }));
      for (const one of steps.slice(-HOLDER_STEPS.length)) one.skipped = true;
      return;
    }
    person(holder, at, `holder-${index}`, group, ownEmail);
  });
  if (application.holders.length > 1) {
    step("signing", "Joint account", "Signing authority", () => {
      const { mode, howMany, other } = application.signingAuthority;
      if (!mode) problem("signingAuthority.mode", "Choose who can sign for this joint account.");
      else if (mode === "ANY_OF_NAMED") {
        const ticked = application.holders.filter((holder) => holder.signatory).length;
        if (ticked === 0) problem("signingAuthority.signatories", "Tick at least one holder who can sign.");
        else if (!howMany || howMany < 1 || howMany > ticked) {
          problem("signingAuthority.howMany", `Choose how many of the ticked holders must sign, from 1 to ${ticked}.`);
        }
      } else if (mode === "OTHER") required(other, "signingAuthority.other", "Say who can sign for this joint account.");
    });
  }
  // Schedule 6 (24 Nov 2026), five steps for each time it is filled in.
  reviewRiskProfiles(application.riskProfiles, step, problem);
  // The CRS / FATCA self-certification of each holder whose details are taken (25 Nov 2026), as the server reads it:
  // what Part 1 adds to the Client Details form, then Part 2.
  application.holders.forEach((holder, index) => {
    if (index > 0 && holder.details.skipped) return;
    const at = `holders[${index}].`;
    const group = holderCertGroup(index);
    step(`holdercert-${index}-identification`, group, HOLDER_CERT_STEPS[0]![1], () => {
      required(holder.details.title, `${at}details.title`, "Choose their title.");
      required(holder.surname, `${at}surname`, "Enter their surname.");
      required(holder.forenames, `${at}forenames`, "Enter their first or given name.");
      required(holder.residentialAddress.city, `${at}residentialAddress.city`, "Enter the city or town.");
      if (addressGiven(holder.mailingAddress)) required(holder.mailingAddress.city, `${at}mailingAddress.city`, "Enter the city or town.");
    });
    step(`holdercert-${index}-tax`, group, HOLDER_CERT_STEPS[1]![1], () => taxLines(holder.details.taxResidences, holder.details.noTinExplanation, `${at}details.`));
  });
  return { problems, steps };
}

/**
 * Which of a holder's ten steps a field is on (24 Nov 2026): the pop-up asks Schedule 2 a section at a time, so a
 * problem the server finds opens the section it belongs to.
 */
const holderSections: Record<string, string> = {
  fullName: "name", forenames: "name", surname: "name", previousNames: "name", otherNames: "name", title: "name", middleNames: "name",
  relationshipToPrimary: "name",
  gender: "birth", dateOfBirth: "birth", placeOfBirth: "birth", countryOfBirth: "birth", maritalStatus: "birth", spouseName: "birth",
  nationality: "nationality", otherNationalities: "nationality", citizenship: "nationality", legalDomicile: "nationality",
  fiscalResidence: "nationality",
  residentialAddress: "address", mailingAddress: "address", emirate: "address", mailingEmirate: "address",
  phone: "contact", email: "contact", secondPhone: "contact", fax: "contact", secondFax: "contact", secondEmail: "contact",
  employer: "work", employmentStatus: "work", sector: "work",
  pep: "pep", pepPeople: "pep",
  services: "business", servicesOther: "business", turnover: "business",
  netWealth: "wealth", netWealthOther: "wealth", wealthSources: "wealth", wealthSourcesOther: "wealth", wealthCountries: "wealth",
  income: "wealth", incomeSources: "wealth", incomeSourcesOther: "wealth", incomeCountries: "wealth",
  knowledge: "experience", knowledgeOther: "experience", activeFor: "experience", activeForOther: "experience",
  managedBy: "experience", managedByOther: "experience", products: "experience", productsOther: "experience",
  decisions: "experience", decisionsOther: "experience",
};

/** Which of the entity's sections a field is on (25 Nov 2026), by its name on the entity or its company details. */
const companySections: Record<string, string> = {
  legalName: "identification", form: "identification", tradingNames: "identification", dateOfIncorporation: "identification",
  placeOfIncorporation: "identification", registrationNumber: "identification",
  registeredAddress: "addresses", registeredEmirate: "addresses", tradingAddress: "addresses", tradingEmirate: "addresses",
  countriesOfBusiness: "addresses", mailingAddress: "addresses", mailingEmirate: "addresses",
  contactName: "contact", phone: "contact", secondPhone: "contact", fax: "contact", secondFax: "contact", email: "contact",
  secondEmail: "contact", website: "contact", taxResidency: "contact",
  activities: "activity", activitiesDetail: "activity", partOfGroup: "activity", groupName: "activity", groupCountry: "activity",
  regulated: "regulation", regulatorName: "regulation", externalAuditor: "regulation", pep: "regulation", pepPerson: "regulation",
  directors: "directors", listed: "shareholders", exchange: "shareholders", ticker: "shareholders", shareholders: "shareholders",
  signatories: "signatories", services: "intentions", servicesOther: "intentions", turnover: "intentions",
  netWealth: "wealth", netWealthOther: "wealth", wealthSources: "wealth", wealthSourcesOther: "wealth",
  personalInvestmentVehicle: "wealth", capitalSources: "wealth", capitalSourcesOther: "wealth",
  activeFor: "experience", activeForOther: "experience", managedBy: "experience", managedByOther: "experience",
  products: "experience", productsOther: "experience",
};

/** The step a field is on, such as "holder-1-address" for "holders[1].email", to show where a problem is. */
export function stepOfField(field: string, entity = false) {
  if (field.startsWith("signingAuthority.")) return "signing";
  const risk = riskStepOfField(field, entity);
  if (risk) return risk;
  // A holder's self-certification lines (25 Nov 2026): its name lines, the addresses' city, province and second line, and Part 2.
  const certifying = /^holders\[(\d+)\]\.(?:(title|surname|forenames)$|details\.(title|middleNames|taxResidences|noTinExplanation)|(?:residentialAddress|mailingAddress)\.(city|state|line2))/.exec(field);
  if (certifying) return `holdercert-${certifying[1]}-${field.includes("taxResidences") || field.includes("noTinExplanation") ? "tax" : "identification"}`;
  const person = /^(holders|beneficialOwners)\[(\d+)\]\.(\w+)(?:\.(\w+))?(?:\.(\w+))?/.exec(field);
  if (person) {
    const [, list, index, name = "", inner = "", deeper = ""] = person;
    const key = name !== "details" ? name : inner === "profile" ? deeper : inner;
    return `${list === "holders" ? "holder" : "owner"}-${index}-${holderSections[key] ?? "name"}`;
  }
  // The self-certification's lines, and those of the Client Details form's it adds to (25 Nov 2026).
  const annex = /^entity\.selfCertification\.controllingPersons\[(\d+)\]\.(\w+)/.exec(field);
  if (annex) return `cp-${annex[1]}-${annex[2] === "taxResidences" || annex[2] === "noTinExplanation" ? "tax" : annex[2] === "type" || annex[2] === "typeOther" ? "type" : "identification"}`;
  const certified = /^entity\.selfCertification\.(\w+)/.exec(field)?.[1];
  if (certified) return certified === "placeOfOperations" ? "sc-identification" : certified === "taxResidences" || certified === "noTinExplanation" ? "sc-tax" : "sc-classification";
  if (field === "entity.countryOfIncorporation" || field === "entity.registeredAddress.city" || field === "entity.company.mailingAddress.city") return "sc-identification";
  const named = /^entity\.(?:company\.)?(\w+)/.exec(field)?.[1];
  if (named) return `entity-${companySections[named] ?? "identification"}`;
  return "client";
}
