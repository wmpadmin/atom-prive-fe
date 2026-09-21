import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The FATCA and CRS self-certification for an entity, Parts A to E.
 *
 * Every line here is the form's own line, word for word — it is a bank document and its wording is not ours to
 * reword. What changes is how the lines are put on screen: the form prints four walls of tick boxes and leaves
 * the reader to match a starred status to a footnote at the bottom of the page, so here the entity is asked what
 * kind of entity it is first and only that heading's boxes follow, the footnote is shown beside the box that
 * stars it, and the part for controlling persons opens itself when a box says to complete it.
 *
 * A run of underscores in a line is a blank the form rules to be written in: the line is shown as it is printed,
 * with a box to type in where the rule runs.
 */

export type FatcaRegistration = "REGISTERED" | "INTENDS";

export type NoTinReason = "NOT_ISSUED" | "NOT_REQUIRED" | "OTHER";

export type ControlOf = "LEGAL_PERSON" | "TRUST" | "OTHER_ARRANGEMENT";

/** One box the form prints, with the line beside it exactly as it reads. */
export interface StatusOption {
  value: string;
  /** The line as the form prints it. A run of underscores is a blank to write in. */
  text: string;
  /** The form's own footnote for the status it stars, shown beside the box rather than at the foot of the page. */
  footnote?: string;
  /** Ticking it is what the line itself says takes you to Part D. */
  controllingPersons?: boolean;
}

/** One of the headings the form groups its boxes under, and the boxes under it. */
export interface StatusGroup {
  value: string;
  heading: string;
  options: StatusOption[];
}

/** The footnotes the form prints under 2.1, each beside the status that stars it. */
const OWN_GIIN = "*Please provide the entity’s GIIN obtained for FATCA Purposes:";

const TRUST_GIIN = "If the entity is a Trustee-documented trust, please provide the GIIN of the trust company";

const SPONSORED_GIIN = "If the entity is a Sponsored investment entity, please provide the sponsored entity’s GIIN";

const SPONSORING_GIIN =
  "If the entity is a Sponsored, closely held investment vehicle or a Sponsored direct reporting NFFE, please provide the sponsoring GIIN of the sponsoring entity.";

/**
 * The two footnotes as the form prints them at the foot of 2.1: the starred one, against the box it rules for
 * the GIIN, and the double-starred one, which is three lines under the one mark.
 */
export const giinFootnotes = { starred: OWN_GIIN, doubleStarred: [`**${TRUST_GIIN}`, SPONSORED_GIIN, SPONSORING_GIIN] };

/** Part B, 2.1 FATCA Status, under the four headings the form prints. */
export const fatcaGroups: StatusGroup[] = [
  {
    value: "FI",
    heading: "Financial Institution",
    options: [
      {
        value: "NON_PARTICIPATING_FFI",
        text: "Non- Participating FFI (including an FFI related to a Reporting IGA FFI other than a deemed-complaint FFI, participating FFI, or exempt beneficial owner).",
      },
      { value: "REPORTING_MODEL_1_FFI", text: "Reporting Model 1 FFI*", footnote: OWN_GIIN },
      { value: "REPORTING_MODEL_2_FFI", text: "Reporting Model 2 FFI*", footnote: OWN_GIIN },
      { value: "REGISTERED_DEEMED_COMPLIANT_FFI", text: "Registered deemed-complaint FFI*", footnote: OWN_GIIN },
      { value: "TRUSTEE_DOCUMENTED_TRUST", text: "Trustee-documented trust**", footnote: TRUST_GIIN },
      { value: "SPONSORED_INVESTMENT_ENTITY", text: "Sponsored investment entity**", footnote: SPONSORED_GIIN },
      { value: "NON_REPORTING_IGA_FFI", text: "Non-reporting IGA FFI (other than Trustee-documented trust)" },
    ],
  },
  {
    value: "CERTIFIED",
    heading: "Certified deemed-complaint FFI {please specify the category by checking one box only}",
    options: [
      { value: "NON_REGISTERED_LOCAL_BANK", text: "Non-registered Local Bank" },
      { value: "LOW_VALUE_ACCOUNTS_FFI", text: "FFI with only low-value accounts" },
      { value: "SPONSORED_CLOSELY_HELD_VEHICLE", text: "Sponsored, closely held investment vehicle**", footnote: SPONSORING_GIIN },
      { value: "LIMITED_LIFE_DEBT_INVESTMENT_ENTITY", text: "Limited life debt investment entity" },
      { value: "INVESTMENT_ADVISORS_AND_MANAGERS", text: "Investment advisors and investment managers" },
      { value: "TERRITORY_FINANCIAL_INSTITUTION", text: "Territory financial institution" },
      { value: "OWNER_DOCUMENTED_FFI", text: "Owner-documented FFI" },
      { value: "LIMITED_BRANCH", text: "Limited Branch" },
    ],
  },
  {
    value: "EXEMPT",
    heading: "Exempt Beneficial Owner",
    options: [{ value: "EXEMPT_BENEFICIAL_OWNER", text: "Exempt Beneficial Owner" }],
  },
  {
    value: "NFE",
    heading: "Non-Financial Entity",
    options: [
      { value: "ACTIVE_NFFE", text: "Active NFFE" },
      { value: "PASSIVE_NFFE", text: "Passive NFFE (please complete PART D for Controlling Person)", controllingPersons: true },
      { value: "NON_FINANCIAL_GROUP_ENTITY", text: "Non-financial group entity" },
      { value: "EXCEPTED_START_UP", text: "Excepted non-financial start-up company" },
      { value: "EXCEPTED_IN_LIQUIDATION", text: "Excepted non-financial entity in liquidation or bankruptcy" },
      {
        value: "SECTION_501C",
        text: "Section 501(c) organisation (you exempted status has been confirmed by IRS or with a legal opinion to support the exemption)",
      },
      { value: "NON_PROFIT", text: "Non-profit organisation" },
      { value: "PUBLICLY_TRADED_NFFE", text: "Publicly traded NFFE or NFFE affiliate of a publicly traded corporation" },
      { value: "EXCEPTED_TERRITORY_NFFE", text: "Excepted territory NFFE" },
      { value: "DIRECT_REPORTING_NFFE", text: "Direct reporting NFFE*", footnote: OWN_GIIN },
      { value: "SPONSORED_DIRECT_REPORTING_NFFE", text: "Sponsored direct reporting NFFE**", footnote: SPONSORING_GIIN },
    ],
  },
];

/** Part C, the CRS classification, under the four headings the form prints. */
export const crsGroups: StatusGroup[] = [
  {
    value: "FI",
    heading: "Financial Institution",
    options: [
      {
        value: "CUSTODIAL_DEPOSITORY_INSURANCE",
        text: "Custodial Institution, Depository Institution or Specified Insurance Company (including a Non-reporting Financial Institution)",
      },
      {
        value: "NPJ_INVESTMENT_ENTITY",
        text: "Investment Entity located in a Non-Participating Jurisdiction and managed by another Financial Institution (please complete PART D for Controlling Person)",
        controllingPersons: true,
      },
      { value: "OTHER_INVESTMENT_ENTITY", text: "Other Investment Entity than the above." },
    ],
  },
  {
    value: "NON_REPORTING",
    heading: "Non-Reporting Financial Institution",
    options: [
      { value: "GOVERNMENT_ENTITY", text: "Government entity, international organisation, or central bank" },
      { value: "BROAD_PARTICIPATION_RETIREMENT_FUND", text: "Broad Participation Retirement Fund" },
      { value: "NARROW_PARTICIPATION_RETIREMENT_FUND", text: "Narrow Participation Retirement Fund" },
      { value: "PENSION_FUND", text: "Pension Fund of a Government entity, international organisation, or central bank" },
      { value: "EXEMPT_COLLECTIVE_INVESTMENT_VEHICLE", text: "Exempt Collective Investment Vehicle" },
      { value: "TRUSTEE_REPORTING_TRUST", text: "Trust whose trustee reports all required information with respect to all CRS Reportable Accounts" },
      { value: "QUALIFIED_CREDIT_CARD_ISSUER", text: "Qualified Credit Card Issuer" },
      {
        value: "OTHER_LOW_RISK",
        text: "Other entity defined under the domestic law as low risk of being used to evade tax. {Specify the type provided in the domestic law:________________________________}",
      },
    ],
  },
  {
    value: "ACTIVE",
    heading: "Active NFE",
    options: [
      { value: "REGULARLY_TRADED", text: "NFE the stock of which is regularly traded on__________________________________" },
      {
        value: "RELATED_TO_TRADED",
        text: "Related entity of___________________, the stock of which is regularly traded, which is an established securities market.",
      },
      {
        value: "GOVERNMENTAL_NFE",
        text: "NFE is a governmental entity, an international organization, a central bank, or an entity wholly owned by one or more of foregoing entities.",
      },
      { value: "OTHER_ACTIVE_NFE", text: "Active NFE other than the above {Please Specify:_______________________________}" },
    ],
  },
  {
    value: "PASSIVE",
    heading: "Passive NFE",
    options: [
      {
        value: "NPJ_MANAGED_INVESTMENT_ENTITY",
        // The paper prints no instruction against this box; it says to complete PART D against the next one.
        text: "Investment entity that is managed by another Financial Institution and located in a non-participating jurisdiction",
      },
      {
        value: "NOT_ACTIVE_NFE",
        text: "NFE that is not an active NFE {If you ticked this option, please complete the PART D for Controlling Person below}",
        controllingPersons: true,
      },
    ],
  },
];

/** Part B, 1. US Person. */
export const usPersonOptions = [
  {
    value: "yes",
    text: "The entity is a US Person pursuant to the FATCA regulation\n{Please proceed directly to PART C}",
  },
  {
    value: "no",
    text: "The entity is NOT a US Person pursuant to the FATCA Regulation\n{If you tick this option, proceed to 2. Below}",
  },
];

/** Part B, 2. Classification. The form prints two boxes and neither is ticked by an entity that is neither. */
export const registrationOptions: { value: FatcaRegistration; text: string }[] = [
  {
    value: "REGISTERED",
    text: "The entity is a registered Financial Institution\nThe entity’s Global Intermediary Identification Number (GIIN) obtained for US FATCA purpose is:________",
  },
  { value: "INTENDS", text: "The entity is a Financial Institution and has not yet obtained a GIIN but intends to do so" },
];

/** The three boxes the form prints under the tax residence table, as they read. */
export const residenceDeclarations = [
  {
    value: "certifiedCopyProvided",
    text: "If your tax residence is not where you are incorporated/registered, please provide a certified true copy of a government issued document of at least on the country(ies) which you are a tax resident of.",
  },
  {
    value: "notTaxResidentAnywhere",
    text: "If you are not a tax resident in any jurisdiction, please indicate the place of effective management : __________",
  },
  {
    value: "branchOfHeadOffice",
    text: "The entity is a branch and its head office is a tax resident in the declared country of tax residence.",
  },
] as const;

/**
 * The heading over the reasons, which the form prints in two wordings: this one over PART A's own tax residence,
 * and a shorter one over the Controlling Persons' in PART D. Each is used where the form prints it.
 */
export const NO_TIN_HEADING = "If no TIN or functional equivalent is available, tick below for the reason of choosing \u201Cno TIN\u201D";

export const NO_TIN_HEADING_CONTROLLING_PERSON = "If no TIN or is available, tick below for the reason of choosing \u201Cno TIN\u201D";

/** The line the form prints under its title, saying when this is the form to complete. */
export const TITLE_QUALIFIER =
  "(if the Controlling Person is also the authorised person to complete this form for the Entity)";

/** The reasons the form prints for choosing "no TIN". */
export const noTinReasons: { value: NoTinReason; text: string }[] = [
  { value: "NOT_ISSUED", text: "Tax residence jurisdiction does not issue TINs to its residents" },
  { value: "NOT_REQUIRED", text: "Tax residence jurisdiction does not require the collection of TIN" },
  { value: "OTHER", text: "Other (please specify) _______________________________" },
];

/** Types of Controlling Person, in the form's own three rows. */
export const controlRoles: Record<ControlOf, { heading: string; roles: { value: string; text: string }[] }> = {
  LEGAL_PERSON: {
    heading: "Legal Person:",
    roles: [
      { value: "OWNERSHIP", text: "Control by Ownership" },
      { value: "OTHER_MEANS", text: "Control by other means" },
      { value: "SENIOR_MANAGING_OFFICIAL", text: "Senior Managing Official" },
    ],
  },
  TRUST: {
    heading: "Legal Arrangement - Trust:",
    roles: [
      { value: "SETTLOR", text: "Settlor" },
      { value: "TRUSTEE", text: "Trustee" },
      { value: "PROTECTOR", text: "Protector" },
      { value: "BENEFICIARY", text: "Beneficiary" },
      { value: "OTHER", text: "Other" },
    ],
  },
  OTHER_ARRANGEMENT: {
    heading: "Legal Arrangement - Other:",
    roles: [
      { value: "SETTLOR_EQUIVALENT", text: "Settlor Equivalent" },
      { value: "TRUSTEE_EQUIVALENT", text: "Trustee Equivalent" },
      { value: "PROTECTOR_EQUIVALENT", text: "Protector Equivalent" },
      { value: "BENEFICIARY_EQUIVALENT", text: "Beneficiary Equivalent" },
      { value: "OTHER_EQUIVALENT", text: "Other Equivalent" },
    ],
  },
};

/** The two things the form says are important, before any of it is filled in. */
export const importantNotes = [
  "Tax legislation including US Foreign Account Tax Compliance Act (FATCA), OECD Common Reporting Standard (CRS) and the local laws and regulations require {{firmName}} to share, transmit and report the information in this Form and the relevant documents and information to the local tax authority of the client, the tax authority of the place of incorporation of the relevant/ related entity(ies) and/or to third party (for example the bank) who has similar reporting obligations under the relevant tax legislations.",
  "{{firmName}} does not give legal and tax advice. Any queries regarding this form, the terms, about CRS and/or FATCA, please contact you tax or legal and/or other professional advisor.",
];

/** Part E, the declaration, as the form prints it. */
export const declarationWording = [
  "I/We certify that as the account holder (or am authorised to sign for the account holder) of all the account(s) to which this form relates.",
  "I/We understand that the information I have provided is covered by the Privacy Notice and the terms and conditions governing the account holder‘s relationship with {{firmName}}, in particular how {{firmName}} may use and share it.",
  "I/We acknowledge that {{firmName}} may share this information with the tax authorities of the country(ies)/jurisdiction(s) where the account(s) are held, and that those tax authorities may exchange this information between themselves as part of the intergovernmental agreements to exchange Financial Account information. If I have completed this form on behalf of the Controlling Person, I certify that I have their authority and that all relevant individuals have been made aware of the Privacy Notice, and the individual rights and information it sets out. I will notify them within 30 days of signing this form that I have provided this information to {{firmName}} and that it may be passed to the tax authorities of all countries/jurisdictions where the account holder maintains accounts.",
  "I declare that all statements made in this declaration are, to the best of my knowledge and belief, correct and complete.",
];

/** One jurisdiction on the tax residence table. */
export interface TaxResidence {
  country: string;
  tin: string;
  noTinReason: NoTinReason | null;
  otherReason: string;
}

/** One controlling person, with the tax residence the form asks every one of them for. */
export interface ControllingPerson {
  name: string;
  registeredAddress: string;
  mailingAddress: string;
  dateOfBirth: string;
  placeOfBirth: string;
  /** The form rules three rows here and says to list every country of tax residency. */
  taxResidences: TaxResidence[];
  controlOf: ControlOf | null;
  controlRole: string;
}

/** One line of the form's signature block: the four things it rules for each person who signs. */
export interface Signer {
  name: string;
  capacity: string;
  signature: string;
  signedOn: string;
}

export interface FatcaCrsEntity {
  entity: {
    name: string;
    placeOfIncorporation: string;
    registrationNumber: string;
    street: string;
    town: string;
    country: string;
    postalCode: string;
    mailingStreet: string;
    mailingTown: string;
    mailingCountry: string;
    mailingPostalCode: string;
  };
  residence: {
    jurisdictions: TaxResidence[];
    certifiedCopyProvided: boolean;
    notTaxResidentAnywhere: boolean;
    placeOfEffectiveManagement: string;
    branchOfHeadOffice: boolean;
  };
  fatca: {
    usPerson: boolean | null;
    registration: FatcaRegistration | null;
    registeredGiin: string;
    group: string | null;
    status: string | null;
    statusGiin: string;
  };
  crs: {
    group: string | null;
    status: string | null;
    specify: string;
  };
  controllingPersons: ControllingPerson[];
  declaration: {
    confirmed: boolean;
    signers: Signer[];
  };
}

export function emptyTaxResidence(): TaxResidence {
  return { country: "", tin: "", noTinReason: null, otherReason: "" };
}

export function emptyControllingPerson(): ControllingPerson {
  return {
    name: "", registeredAddress: "", mailingAddress: "", dateOfBirth: "", placeOfBirth: "",
    taxResidences: [emptyTaxResidence()], controlOf: null, controlRole: "",
  };
}

export function emptySigner(): Signer {
  return { name: "", capacity: "", signature: "", signedOn: "" };
}

export function emptyFatcaCrs(): FatcaCrsEntity {
  return {
    entity: {
      name: "", placeOfIncorporation: "", registrationNumber: "", street: "", town: "", country: "",
      postalCode: "", mailingStreet: "", mailingTown: "", mailingCountry: "", mailingPostalCode: "",
    },
    residence: {
      jurisdictions: [emptyTaxResidence()],
      certifiedCopyProvided: false,
      notTaxResidentAnywhere: false,
      placeOfEffectiveManagement: "",
      branchOfHeadOffice: false,
    },
    fatca: { usPerson: null, registration: null, registeredGiin: "", group: null, status: null, statusGiin: "" },
    crs: { group: null, status: null, specify: "" },
    controllingPersons: [emptyControllingPerson()],
    declaration: { confirmed: false, signers: [emptySigner()] },
  };
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toFatcaCrs(saved: FormDetailAnswers | undefined): FatcaCrsEntity {
  const empty = emptyFatcaCrs();
  if (!saved) return empty;
  const held = saved as Partial<FatcaCrsEntity>;
  const rows = <T,>(list: T[] | undefined, fallback: T[], fill: () => T) =>
    list && list.length > 0 ? list.map((row) => ({ ...fill(), ...row })) : fallback;
  return {
    entity: { ...empty.entity, ...held.entity },
    residence: {
      ...empty.residence,
      ...held.residence,
      jurisdictions: rows(held.residence?.jurisdictions, empty.residence.jurisdictions, emptyTaxResidence),
    },
    fatca: { ...empty.fatca, ...held.fatca },
    crs: { ...empty.crs, ...held.crs },
    controllingPersons: rows(held.controllingPersons, empty.controllingPersons, emptyControllingPerson).map(
      (person) => ({
        ...person,
        taxResidences: rows(person.taxResidences, [emptyTaxResidence()], emptyTaxResidence),
      }),
    ),
    declaration: {
      ...empty.declaration,
      ...held.declaration,
      signers: rows(held.declaration?.signers, empty.declaration.signers, emptySigner),
    },
  };
}

/** A line the form rules a blank in is a line something has to be written on. */
export const BLANK = /_{3,}/;

/** The line of the self-certification that asks the client to provide a certified true copy. */
export const CERTIFIED_COPY = "residence.certifiedCopy";

function optionIn(groups: StatusGroup[], status: string | null | undefined): StatusOption | undefined {
  if (!status) return undefined;
  for (const group of groups) {
    const found = group.options.find((option) => option.value === status);
    if (found) return found;
  }
  return undefined;
}

/** The FATCA box that is ticked, with the footnote that stars it. */
export function fatcaStatusOf(value: FatcaCrsEntity): StatusOption | undefined {
  // A US Person is sent straight to Part C, so nothing under 2.1 applies to them.
  return value.fatca.usPerson === false ? optionIn(fatcaGroups, value.fatca.status) : undefined;
}

/** The CRS box that is ticked. */
export function crsStatusOf(value: FatcaCrsEntity): StatusOption | undefined {
  return optionIn(crsGroups, value.crs.status);
}

/** Which part said to complete Part D — none of them, one, or both. */
export function controllingPersonsBecause(value: FatcaCrsEntity): string | null {
  const fromFatca = fatcaStatusOf(value)?.controllingPersons === true;
  const fromCrs = crsStatusOf(value)?.controllingPersons === true;
  if (fromFatca && fromCrs) return "PART B and PART C";
  if (fromFatca) return "PART B";
  if (fromCrs) return "PART C";
  return null;
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewFatcaCrs(value: FatcaCrsEntity, provided: ReadonlySet<string>): FormReview {
  const problems: Record<string, string> = {};
  const { entity, residence, fatca, crs, declaration } = value;

  const needed: [keyof FatcaCrsEntity["entity"], string][] = [
    ["name", REQUIRED],
    ["placeOfIncorporation", REQUIRED],
    ["registrationNumber", REQUIRED],
    ["street", REQUIRED],
    ["town", REQUIRED],
    ["country", "Choose a country."],
  ];
  for (const [field, says] of needed) {
    if (!entity[field].trim()) problems[`entity.${field}`] = says;
  }
  // The mailing address is only asked for if it differs from the registered address, so nothing there is needed.

  // The line asks for a certified true copy, so ticking it is not answering it: the copy has to be here.
  if (residence.certifiedCopyProvided && !provided.has(CERTIFIED_COPY)) {
    problems[CERTIFIED_COPY] = "Attach the certified true copy.";
  }
  if (residence.notTaxResidentAnywhere) {
    if (!residence.placeOfEffectiveManagement.trim()) {
      problems["residence.placeOfEffectiveManagement"] = "Indicate the place of effective management.";
    }
  } else {
    if (residence.jurisdictions.length === 0) problems["residence.jurisdictions"] = "Add a country of tax residence.";
    residence.jurisdictions.forEach((held, at) => {
      if (!held.country.trim()) problems[`residence.jurisdictions[${at}].country`] = "Choose a country.";
      // A TIN, or the reason for choosing "no TIN".
      if (!held.tin.trim() && !held.noTinReason) {
        problems[`residence.jurisdictions[${at}].tin`] = "Give the TIN, or tick the reason for choosing “no TIN”.";
      }
      if (!held.tin.trim() && held.noTinReason === "OTHER" && !held.otherReason.trim()) {
        problems[`residence.jurisdictions[${at}].otherReason`] = "Please specify.";
      }
    });
  }

  if (fatca.usPerson === null) problems["fatca.usPerson"] = "Tick one of these.";
  // A US Person proceeds directly to Part C; 2. and 2.1. are for entities that are not.
  if (fatca.usPerson === false) {
    // 2. Classification is ticked only where it applies: an entity that is no Financial Institution ticks neither.
    if (fatca.registration === "REGISTERED" && !fatca.registeredGiin.trim()) {
      problems["fatca.registeredGiin"] = REQUIRED;
    }
    if (!fatca.status) problems["fatca.status"] = "Tick the status that applies.";
    const chosen = optionIn(fatcaGroups, fatca.status);
    if (chosen?.footnote && !fatca.statusGiin.trim()) problems["fatca.statusGiin"] = REQUIRED;
  }

  if (!crs.status) problems["crs.status"] = "Tick the entity type that applies.";
  const crsChosen = optionIn(crsGroups, crs.status);
  if (crsChosen && BLANK.test(crsChosen.text) && !crs.specify.trim()) problems["crs.specify"] = REQUIRED;

  // Part D is completed only where Part B or Part C says to complete it.
  if (controllingPersonsBecause(value) !== null) {
    if (value.controllingPersons.length === 0) problems["controllingPersons"] = "Add the controlling persons.";
    value.controllingPersons.forEach((person, at) => {
      const put = (field: string, says: string) => (problems[`controllingPersons[${at}].${field}`] = says);
      if (!person.name.trim()) put("name", REQUIRED);
      if (!person.registeredAddress.trim()) put("registeredAddress", REQUIRED);
      if (!person.dateOfBirth) put("dateOfBirth", "Choose a date.");
      if (!person.placeOfBirth.trim()) put("placeOfBirth", REQUIRED);
      if (person.taxResidences.length === 0) put("taxResidences", "Add a country of tax residence.");
      person.taxResidences.forEach((held, row) => {
        if (!held.country.trim()) put(`taxResidences[${row}].country`, "Choose a country.");
        if (!held.tin.trim() && !held.noTinReason) {
          put(`taxResidences[${row}].tin`, "Give the TIN, or tick the reason for choosing “no TIN”.");
        }
        if (!held.tin.trim() && held.noTinReason === "OTHER" && !held.otherReason.trim()) {
          put(`taxResidences[${row}].otherReason`, "Please specify.");
        }
      });
      if (!person.controlRole) put("controlRole", "Tick the type of controlling person.");
    });
  }

  if (!declaration.confirmed) problems["declaration.confirmed"] = "The declaration has to be made.";
  if (declaration.signers.length === 0) problems["declaration.signers"] = "Add whoever signs.";
  declaration.signers.forEach((signer, at) => {
    if (!signer.name.trim()) problems[`declaration.signers[${at}].name`] = REQUIRED;
    if (!signer.capacity.trim()) problems[`declaration.signers[${at}].capacity`] = REQUIRED;
    if (!signer.signature.trim()) problems[`declaration.signers[${at}].signature`] = REQUIRED;
    if (!signer.signedOn) problems[`declaration.signers[${at}].signedOn`] = "Choose a date.";
  });

  return {
    problems,
    steps: [
      { id: "entity", group: "PART A", label: "General Information", complete: none(problems, "entity.") },
      { id: "residence", group: "PART A", label: "Tax Residence", complete: none(problems, "residence") },
      { id: "fatca", group: "PART B", label: "Declaration of US FATCA", complete: none(problems, "fatca.") },
      { id: "crs", group: "PART C", label: "Declaration of CRS Classification", complete: none(problems, "crs.") },
      {
        id: "controlling",
        group: "PART D",
        label: "Controlling Person",
        // A part the form says not to complete is a part that is done.
        complete: none(problems, "controllingPersons"),
      },
      { id: "declaration", group: "PART E", label: "Declaration & Signature", complete: none(problems, "declaration.") },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfFatcaCrsField(field: string): string {
  if (field.startsWith("residence")) return "residence";
  if (field.startsWith("fatca")) return "fatca";
  if (field.startsWith("crs")) return "crs";
  if (field.startsWith("controllingPersons")) return "controlling";
  if (field.startsWith("declaration")) return "declaration";
  return "entity";
}

/** What the form itself says at the head of each part, shown before that part is filled in. */
export const fatcaCrsGuidance: Record<string, string> = {
  "PART A":
    "For joint or multiple account holders, complete a separate form for each entity account holder. If the entity has multiple countries of tax residency, please list out all the relevant information below.",
  "PART C":
    "Please complete this part by ticking the following box in order to provide your CRS entity type that does not necessarily coincide with your entity type under Part 2: US FATCA Classification.",
  "PART D": "Only complete this part if you are required under PART C.",
  "PART E": "To be given signed by the Entity Account Holder and ALL Controlling Person(s).",
};

/** The line under each part's heading, in the form's own words where it prints one. */
export const fatcaCrsDescriptions: Record<string, string> = {
  entity: "For joint or multiple account holders, complete a separate form for each entity account holder.",
  residence: "If the entity has multiple countries of tax residency, please list out all the relevant information below.",
  fatca: "1. US Person, 2. Classification and 2.1. FATCA Status.",
  crs: "Please complete this part by ticking the following box in order to provide your CRS entity type that does not necessarily coincide with your entity type under Part 2: US FATCA Classification.",
  controlling: "Only complete this part if you are required under PART C.",
  declaration: "To be given signed by the Entity Account Holder and ALL Controlling Person(s).",
};
