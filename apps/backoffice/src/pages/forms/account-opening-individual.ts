import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import { emptySigner, type FormAddress, type FormReview, type Signer } from "./account-opening-entity";

/**
 * The individual account opening application form, block by block as the paper asks for it. It rules two
 * account holders, an address to write to, and the declarations they sign; everything printed here is the
 * form's own wording.
 */

export type HolderTitle = "MR" | "MRS" | "HRH" | "SIR" | "HE" | "OTHER";

/** The titles the form prints in the brackets beside the name, in its own order and its own case. */
export const holderTitles: { value: HolderTitle; text: string }[] = [
  { value: "MR", text: "Mr" },
  { value: "MRS", text: "Mrs" },
  { value: "HRH", text: "HRH" },
  { value: "SIR", text: "Sir" },
  { value: "HE", text: "HE" },
  { value: "OTHER", text: "Other" },
];

export type Occupation = "SALARIED" | "BUSINESS_OWNER" | "HOUSEWIFE" | "RETIRED" | "STUDENT" | "OTHER";

/** What the form offers against Occupation Details, in the order it prints them. */
export const occupations: { value: Occupation; text: string }[] = [
  { value: "SALARIED", text: "Salaried" },
  { value: "BUSINESS_OWNER", text: "Business Owner" },
  { value: "HOUSEWIFE", text: "Housewife" },
  { value: "RETIRED", text: "Retired" },
  { value: "STUDENT", text: "Student" },
  { value: "OTHER", text: "Other (please specify): ______" },
];

/** The headings the form puts over each block of a holder's details, in its own words. */
export const holderBlocks = {
  personal: "Personal Details",
  salaried: "If Salaried",
  businessOwner: "If Business Owner",
  contact: "Contact Details",
  address: "Residential address (Physical address, not just PO Box)",
};

/** What the form prints under each of those headings. */
export const holderNotes = {
  name: "Name in full as in NRIC/ Passport (Mr, Mrs, HRH, Sir, HE, Other):",
  contact:
    "Please state phone number the firm may use to contact you as: Country code – Area code – Home/ Mobile/ Office/ Fax*",
  address: "Residential address is the place where you are currently residing",
  documents: "Please provide copies of the mandatory documents listed below:",
};

/** The copies the form asks for against each holder, in its own words. */
export const MANDATORY_DOCUMENTS = ["ID/Passport", "Residential Address Proof"];

/** Where a holder's attached copy is kept, so it stays against the line that asked for it. */
export function documentField(at: string, document: string) {
  return `${at}.${document.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export type SigningMandate = "ANY_ONE" | "JOINTLY" | "OTHER";

/** The signing mandate the form offers, worded as it words it. */
export const signingMandateLabels: Record<SigningMandate, string> = {
  ANY_ONE: "Any one of us",
  JOINTLY: "Jointly",
  OTHER: "Others (please specify) _________",
};

/** One of the two account holders the form rules. */
export interface AccountHolder {
  title: HolderTitle | null;
  fullName: string;
  forenames: string;
  surname: string;
  /** The form asks this of the second holder only. */
  relationshipToFirst: string;
  passportNumber: string;
  nationality: string | null;
  countryOfBirth: string | null;
  otherNationalityHeld: boolean | null;
  otherNationalityCountry: string | null;
  otherPassportNumber: string;
  otherPassportExpiry: string;
  occupation: Occupation | null;
  occupationOther: string;
  /** What the form asks where the holder is salaried. */
  employerName: string;
  employerCountry: string | null;
  positionHeld: string;
  /** What it asks instead where they own the business. */
  companyName: string;
  companyCountry: string | null;
  entityType: string;
  natureOfBusiness: string;
  businessLinkCountries: string[];
  phone: string;
  email: string;
  address: FormAddress;
}

export interface AccountOpeningIndividual {
  holders: AccountHolder[];
  mailing: {
    address: FormAddress;
    /** The form marks the second one Optional. */
    secondary: FormAddress;
  };
  declarations: {
    clientAgreementReceived: boolean;
    professionalAdvisers: boolean;
    informationCorrect: boolean;
    documentsUndertaking: boolean;
    specimenSignatures: boolean;
    jointAccountOrders: boolean;
    beneficialOwner: boolean;
    taxAffairs: boolean;
    confirmed: boolean;
    signingMandate: SigningMandate | null;
    signingMandateOther: string;
    appliedOn: string;
    signers: Signer[];
  };
}

function emptyAddress(): FormAddress {
  return { line1: "", line2: "", city: "", state: "", postalCode: "", country: null };
}

export function emptyHolder(): AccountHolder {
  return {
    title: null,
    fullName: "",
    forenames: "",
    surname: "",
    relationshipToFirst: "",
    passportNumber: "",
    nationality: null,
    countryOfBirth: null,
    otherNationalityHeld: null,
    otherNationalityCountry: null,
    otherPassportNumber: "",
    otherPassportExpiry: "",
    occupation: null,
    occupationOther: "",
    employerName: "",
    employerCountry: null,
    positionHeld: "",
    companyName: "",
    companyCountry: null,
    entityType: "",
    natureOfBusiness: "",
    businessLinkCountries: [],
    phone: "",
    email: "",
    address: emptyAddress(),
  };
}

export function emptyAccountOpeningIndividual(): AccountOpeningIndividual {
  return {
    holders: [emptyHolder()],
    mailing: { address: emptyAddress(), secondary: emptyAddress() },
    declarations: {
      clientAgreementReceived: false,
      professionalAdvisers: false,
      informationCorrect: false,
      documentsUndertaking: false,
      specimenSignatures: false,
      jointAccountOrders: false,
      beneficialOwner: false,
      taxAffairs: false,
      confirmed: false,
      signingMandate: null,
      signingMandateOther: "",
      appliedOn: "",
      signers: [emptySigner()],
    },
  };
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toAccountOpeningIndividual(saved: FormDetailAnswers | undefined): AccountOpeningIndividual {
  const empty = emptyAccountOpeningIndividual();
  if (!saved) return empty;
  const held = saved as Partial<AccountOpeningIndividual>;
  const holders =
    held.holders && held.holders.length > 0
      ? held.holders.map((holder) => ({ ...emptyHolder(), ...holder, address: { ...emptyAddress(), ...holder.address } }))
      : empty.holders;
  return {
    holders,
    mailing: {
      address: { ...emptyAddress(), ...held.mailing?.address },
      secondary: { ...emptyAddress(), ...held.mailing?.secondary },
    },
    declarations: {
      ...empty.declarations,
      ...held.declarations,
      signers:
        held.declarations?.signers && held.declarations.signers.length > 0
          ? held.declarations.signers.map((signer) => ({ ...emptySigner(), ...signer }))
          : empty.declarations.signers,
    },
  };
}

/** Request to open account: each line as the form words it, so what is agreed to is what the document says. */
export const declarationWording = [
  {
    id: "clientAgreementReceived",
    heading: "Request to open account",
    text: "I/WE have received a copy of the client agreement and fully understand and agree to the contents of the client agreement.",
  },
  {
    id: "professionalAdvisers",
    text: "{{firmName}} has reminded me/us to consult my/our own professional advisers on my/our rights and obligations in connection with the agreement, and the effect and implications of and the risks associated with the transactions or dealings contemplated by the client agreement.",
  },
  {
    id: "informationCorrect",
    text: "The information given in this account opening application form is correct, complete and up-to date. I/WE authorize {{firmName}} to verify or confirm any information given in this account opening application form from any source as {{firmName}} considers appropriate. I/WE undertake to notify the information given by me/us in this account opening application form, and agree that {{firmName}} has sole discretion to take any action as it considers appropriate in light of any change in such information.",
  },
  {
    id: "documentsUndertaking",
    text: "I/WE undertake to provide such identification documents, supporting and further information, and sign such further forms or documents, as {{firmName}} may reasonably require for the purpose of this account opening application form or in connection with the services contemplated provide any documents or information which {{firmName}} may require time to time reasonably require.",
  },
  {
    id: "specimenSignatures",
    text: "My/Our signature (s) in this account opening form (or any supplement(s) thereto) shall serve as specimen signature (s) which shall be used in all dealings with the Firm.",
  },
  {
    id: "jointAccountOrders",
    text: "In the case of a joint account, notwithstanding any signing instructions given by us to {{firmName}}, we agree that any account holder acting singly is authorized to give orders or instructions to the telephone or otherwise operate the account by telephone.",
  },
  {
    id: "beneficialOwner",
    heading: "Tax declaration",
    text: "I/WE declare that I am/we are the ultimate beneficial owners(s) for the relationship that I/we will open with {{firmName}}; I/we further declare that the source of my/our funds is legitimate.",
  },
  {
    id: "taxAffairs",
    text: "I/WE acknowledge that I /we am/are responsible for my/our own tax affairs and hereby declare that I/we have duly complied, and undertake to continue to comply, with the tax laws and/or tax reporting obligations of the country(s) of which I /we am/are resident(s)or citizen(s) and/or which I /we am/are there from. I /we confirm to the best of my/our knowledge, I /we have not or been convicted of any serious tax crimes.",
  },
  {
    id: "confirmed",
    text: "I/WE confirm and acknowledge the statements set out this section of this account opening application form.",
  },
] as const;

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** Whether anything has been written on an address yet. An optional address is only checked once it has been started. */
export function addressStarted(address: FormAddress) {
  const said = (value: string | null | undefined) => (value ?? "").trim();
  return [address.line1, address.city, address.state, address.postalCode].some((one) => said(one)) || Boolean(address.country);
}

function addressProblems(problems: Record<string, string>, at: string, address: FormAddress, optional = false) {
  const said = (value: string | null | undefined) => (value ?? "").trim();
  if (optional && !addressStarted(address)) return;
  if (!said(address.line1)) problems[`${at}.line1`] = REQUIRED;
  if (!said(address.city)) problems[`${at}.city`] = REQUIRED;
  if (!said(address.state)) problems[`${at}.state`] = REQUIRED;
  if (!said(address.postalCode)) problems[`${at}.postalCode`] = REQUIRED;
  if (!address.country) problems[`${at}.country`] = "Choose a country.";
}

/** What is still to be answered, and which part of the form each part of it belongs to. */
export function reviewAccountOpeningIndividual(value: AccountOpeningIndividual): FormReview {
  const problems: Record<string, string> = {};

  value.holders.forEach((holder, at) => {
    const first = at === 0;
    const where = `holders[${at}]`;
    // The second holder is only asked for where there is one: nothing is insisted on until something is typed.
    const started =
      first ||
      [holder.fullName, holder.forenames, holder.surname, holder.passportNumber, holder.email].some((one) =>
        one.trim(),
      ) ||
      Boolean(holder.title || holder.nationality || holder.occupation);
    if (!started) return;
    if (!holder.title) problems[`${where}.title`] = "Choose one.";
    if (!holder.fullName.trim()) problems[`${where}.fullName`] = REQUIRED;
    if (!holder.forenames.trim()) problems[`${where}.forenames`] = REQUIRED;
    if (!holder.surname.trim()) problems[`${where}.surname`] = REQUIRED;
    if (!first && !holder.relationshipToFirst.trim()) problems[`${where}.relationshipToFirst`] = REQUIRED;
    if (!holder.passportNumber.trim()) problems[`${where}.passportNumber`] = REQUIRED;
    if (!holder.nationality) problems[`${where}.nationality`] = "Choose a country.";
    if (!holder.countryOfBirth) problems[`${where}.countryOfBirth`] = "Choose a country.";
    if (holder.otherNationalityHeld === null) problems[`${where}.otherNationalityHeld`] = "Say yes or no.";
    if (holder.otherNationalityHeld) {
      if (!holder.otherNationalityCountry) problems[`${where}.otherNationalityCountry`] = "Choose a country.";
      if (!holder.otherPassportNumber.trim()) problems[`${where}.otherPassportNumber`] = REQUIRED;
      if (!holder.otherPassportExpiry.trim()) problems[`${where}.otherPassportExpiry`] = "Choose a date.";
    }
    if (!holder.occupation) problems[`${where}.occupation`] = "Choose one.";
    if (holder.occupation === "OTHER" && !holder.occupationOther.trim()) {
      problems[`${where}.occupationOther`] = REQUIRED;
    }
    if (holder.occupation === "SALARIED") {
      if (!holder.employerName.trim()) problems[`${where}.employerName`] = REQUIRED;
      if (!holder.employerCountry) problems[`${where}.employerCountry`] = "Choose a country.";
      if (!holder.positionHeld.trim()) problems[`${where}.positionHeld`] = REQUIRED;
    }
    if (holder.occupation === "BUSINESS_OWNER") {
      if (!holder.companyName.trim()) problems[`${where}.companyName`] = REQUIRED;
      if (!holder.companyCountry) problems[`${where}.companyCountry`] = "Choose a country.";
      if (!holder.entityType.trim()) problems[`${where}.entityType`] = REQUIRED;
      if (!holder.natureOfBusiness.trim()) problems[`${where}.natureOfBusiness`] = REQUIRED;
      if (holder.businessLinkCountries.length === 0) problems[`${where}.businessLinkCountries`] = "Choose at least one.";
    }
    if (!holder.phone.trim()) problems[`${where}.phone`] = REQUIRED;
    if (!holder.email.trim()) problems[`${where}.email`] = REQUIRED;
    addressProblems(problems, `${where}.address`, holder.address);
  });

  addressProblems(problems, "mailing.address", value.mailing.address);
  // The form marks the second mailing address Optional, so it is only checked once something is written on it.
  addressProblems(problems, "mailing.secondary", value.mailing.secondary, true);

  const declarations = value.declarations;
  for (const line of declarationWording) {
    if (!declarations[line.id]) problems[`declarations.${line.id}`] = "This has to be agreed to.";
  }
  if (!declarations.signingMandate) problems["declarations.signingMandate"] = "Choose one.";
  if (declarations.signingMandate === "OTHER" && !declarations.signingMandateOther.trim()) {
    problems["declarations.signingMandateOther"] = REQUIRED;
  }
  if (!declarations.appliedOn.trim()) problems["declarations.appliedOn"] = "Choose a date.";
  if (declarations.signers.length === 0) problems["declarations.signers"] = "Add whoever signs.";
  declarations.signers.forEach((signer, at) => {
    if (!signer.fullName.trim()) problems[`declarations.signers[${at}].fullName`] = REQUIRED;
    // The client signs after the form reaches them, so their signature is not what makes the form ready
    // to send. Their name and the date still are.
  });

  return {
    problems,
    steps: [
      {
        id: "holder1",
        group: "ACCOUNT HOLDER 1",
        label: "Account holder 1",
        complete: none(problems, "holders[0]"),
      },
      {
        id: "holder2",
        group: "ACCOUNT HOLDER 2",
        label: "Account holder 2",
        complete: none(problems, "holders[1]"),
      },
      {
        id: "mailing",
        group: "MAILING INSTRUCTIONS",
        label: "Mailing instructions",
        complete: none(problems, "mailing."),
      },
      {
        id: "declarations",
        group: "REQUEST TO OPEN ACCOUNT",
        label: "Request to open account",
        complete: none(problems, "declarations."),
      },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfAccountOpeningIndividualField(field: string): string {
  if (field.startsWith("holders[1]")) return "holder2";
  if (field.startsWith("holders")) return "holder1";
  if (field.startsWith("mailing")) return "mailing";
  return "declarations";
}

/** What the form says at the top of each block, shown before that block is filled in. */
export const accountOpeningIndividualGuidance: Record<string, string> = {
  "ACCOUNT HOLDER 1": "Application Form – Individual Client - ACCOUNT HOLDER 1",
  "MAILING INSTRUCTIONS":
    "Please provide an address which the firm may use to send your statements and other correspondence relating to your account.",
};

export const accountOpeningIndividualDescriptions: Record<string, string> = {
  holder1: "Application Form – Individual Client - ACCOUNT HOLDER 1",
  holder2: "The second holder, where the account has one.",
  mailing:
    "Please provide an address which the firm may use to send your statements and other correspondence relating to your account.",
  declarations: "Request to open account, the tax declaration, the signing mandate and the signatures.",
};
