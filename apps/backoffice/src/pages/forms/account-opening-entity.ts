import type { Address, FormDetailAnswers } from "@atomprive/api-client/backoffice";

/**
 * The entity account opening application form, section by section as the paper document asks for it. The API
 * keeps the answers as JSON and checks the same sections again on submit; this is the copy the wizard types into.
 */

/** The same address shape the onboarding form uses, so the address fields are shared between them. */
export type FormAddress = Address;

/** Sections B, C and D all ask for the same details about a person, so they share this shape. */
export interface FormPerson {
  /** One of the five the form prints beside the name: Mr Mrs Ms Mdm others. */
  title: PersonTitle | null;
  fullName: string;
  passportNumber: string;
  nationality: string | null;
  dateOfBirth: string;
  countryOfBirth: string | null;
  occupation: string;
  /** The form rules two of these, one under the other. */
  phone: string;
  secondPhone: string;
  email: string;
  address: FormAddress;
}

export type PersonTitle = "MR" | "MRS" | "MS" | "MDM" | "OTHERS";

/** The titles the form prints beside the name, in its own order and its own case. */
export const personTitles: { value: PersonTitle; text: string }[] = [
  { value: "MR", text: "Mr" },
  { value: "MRS", text: "Mrs" },
  { value: "MS", text: "Ms" },
  { value: "MDM", text: "Mdm" },
  { value: "OTHERS", text: "others" },
];

/** What the form prints under the name line. */
export const UNDERLINE_SURNAME = "(Please underline surname)";

/** The headings the form puts against each block of a person's details, in its own words. */
export const personBlocks = {
  personal: "Personal details",
  contact: "Contact details (Phone numbers and Email address which the Firm may use to contact you)",
  address: "Address (Residential address is place where you are currently residing)",
};

/**
 * The two phone lines the form rules. It prints the first differently for an authorised signatory than for a
 * beneficial owner or a director, and the second the same — lower case, with its own typo — for all three.
 */
export const phoneLabels: Record<string, [string, string]> = {
  signatories: ["Country Code-Area Code-Home/mobile/office/fax*", "Country code-are code-home/mobile/office/fax*"],
  beneficialOwners: ["Country code-Area code-Home/mobile/office/fax*", "Country code-are code-home/mobile/office/fax*"],
  directors: ["Country code-Area code-Home/mobile/office/fax*", "Country code-are code-home/mobile/office/fax*"],
};

export type OrganisationType = "PIC" | "TRUST_OR_FOUNDATION" | "TRADING_COMPANY" | "OTHER";

export type SigningMandate = "ANY_ONE" | "ANY_TWO" | "ANY_THREE" | "OTHER";

export interface AccountOpeningEntity {
  entity: {
    legalName: string;
    countryOfIncorporation: string | null;
    dateOfIncorporation: string;
    registrationNumber: string;
    natureOfBusiness: string;
    regulated: boolean | null;
    regulatorName: string;
    businessLinkCountries: string[];
    organisationType: OrganisationType | null;
    organisationTypeOther: string;
  };
  registeredAddress: FormAddress;
  signatories: FormPerson[];
  beneficialOwners: FormPerson[];
  directors: FormPerson[];
  declarations: {
    clientAgreementReceived: boolean;
    professionalAdvisers: boolean;
    informationCorrect: boolean;
    documentsUndertaking: boolean;
    specimenSignatures: boolean;
    taxDeclaration: boolean;
    signingMandate: SigningMandate | null;
    signingMandateOther: string;
    signers: Signer[];
  };
}

/** One of the Authorised Signatory blocks the form rules at the foot of Section E. */
export interface Signer {
  fullName: string;
  signature: string;
  signedOn: string;
}

export function emptySigner(): Signer {
  return { fullName: "", signature: "", signedOn: "" };
}

export const organisationTypeLabels: Record<OrganisationType, string> = {
  PIC: "PIC",
  TRUST_OR_FOUNDATION: "Trust /Foundation",
  TRADING_COMPANY: "Trading Company",
  OTHER: "Others___________",
};

export const signingMandateLabels: Record<SigningMandate, string> = {
  ANY_ONE: "Any one",
  ANY_TWO: "Any two",
  ANY_THREE: "Any three",
  OTHER: "Others (please specify)_____",
};

/** A line the form rules a blank in is a line something has to be written on. */
export const BLANK = /_{3,}/;

/**
 * The copies the form asks for against each person. It asks for them in its own words — "Please provide
 * copies of the mandatory documents below" — so each line is a document to attach, not a box to tick.
 */
export const MANDATORY_DOCUMENTS = ["ID/Passport", "Residential address proof"];

/** The further copies the form asks for where an authorised signatory is itself a company. */
export const CORPORATE_SIGNATORY_DOCUMENTS = [
  "Certificate of incorporation",
  "Certificate of incumbency",
  "List of authorised signatories",
  "Board resolution approving list of auth signatories",
  "ID / Passport for all authorised signatories",
  "Residential address proof for all authorised signatories.",
];

/** Where a person's attached copy is kept, so it stays against the line that asked for it. */
export function documentField(at: string, index: number, document: string) {
  return `${at}[${index}].${document.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
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
    text: "The information given in this account opening application form is correct, complete and up-to date. I/WE authorize {{firmName}} to verify or confirm any information given in this account opening application form from any source as {{firmName}} considers appropriate. I/WE undertake to notify the information given by me/us in this account opening application form, and agree that {{firmName}} has sole discretion to take any action as it considers appropriate in light of any change is such information.",
  },
  {
    id: "documentsUndertaking",
    text: "I/WE undertake to provide such identification documents, supporting and further information, and sign such further forms or documents, as {{firmName}} may reasonably require for the purpose of this account opening application form or in connection with the services contemplated provide any documents or information which {{firmName}} may require time to time reasonably require.",
  },
  {
    id: "specimenSignatures",
    text: "The signature(s) of the authorised signatories in this account opening form (or any supplement(s) thereto) shall serve as specimen signature(s) which shall be used in all dealings with the Firm.",
  },
  {
    id: "taxDeclaration",
    heading: "Tax declaration",
    text: "We declare that our source of funds and / or the source of funds from any beneficial owner, settlor, or asset contributor is legitimate. We acknowledge that we and all source of funds providers are responsible for our own tax affairs and we hereby declare that we and all Source of Funds providers have duly compiled and undertake to continue to comply with the tax laws and / or tax reporting obligations of the countries where we are residents and / or of which are subject to, in respect of any funds and assets. We confirm that to the best of our knowledge we and all source of funds providers have not committed or been convicted of any serious tax crimes.",
  },
] as const satisfies readonly {
  id: keyof AccountOpeningEntity["declarations"];
  heading?: string;
  text: string;
}[];

export function emptyAddress(): FormAddress {
  return { line1: "", line2: "", city: "", state: "", postalCode: "", country: null };
}

export function emptyPerson(): FormPerson {
  return {
    title: null,
    fullName: "",
    passportNumber: "",
    nationality: null,
    dateOfBirth: "",
    countryOfBirth: null,
    occupation: "",
    phone: "",
    secondPhone: "",
    email: "",
    address: emptyAddress(),
  };
}

export function emptyAccountOpening(): AccountOpeningEntity {
  return {
    entity: {
      legalName: "",
      countryOfIncorporation: null,
      dateOfIncorporation: "",
      registrationNumber: "",
      natureOfBusiness: "",
      regulated: null,
      regulatorName: "",
      businessLinkCountries: [],
      organisationType: null,
      organisationTypeOther: "",
    },
    registeredAddress: emptyAddress(),
    signatories: [emptyPerson()],
    beneficialOwners: [emptyPerson()],
    directors: [emptyPerson()],
    declarations: {
      clientAgreementReceived: false,
      professionalAdvisers: false,
      specimenSignatures: false,
      informationCorrect: false,
      documentsUndertaking: false,
      taxDeclaration: false,
      signingMandate: null,
      signingMandateOther: "",
      signers: [emptySigner()],
    },
  };
}

/** Saved answers on top of an empty form, so a form saved before a field existed still opens. */
export function toAccountOpening(saved: FormDetailAnswers | undefined): AccountOpeningEntity {
  const empty = emptyAccountOpening();
  if (!saved) return empty;
  const held = saved as Partial<AccountOpeningEntity>;
  const people = (list: FormPerson[] | undefined, fallback: FormPerson[]) =>
    list && list.length > 0 ? list.map((person) => ({ ...emptyPerson(), ...person, address: { ...emptyAddress(), ...person.address } })) : fallback;
  return {
    entity: { ...empty.entity, ...held.entity },
    registeredAddress: { ...empty.registeredAddress, ...held.registeredAddress },
    signatories: people(held.signatories, empty.signatories),
    beneficialOwners: people(held.beneficialOwners, empty.beneficialOwners),
    directors: people(held.directors, empty.directors),
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

/** A step of the wizard: one section of the paper form. */
export interface FormStep {
  id: string;
  group: string;
  label: string;
  complete: boolean;
}

export interface FormReview {
  steps: FormStep[];
  /** Field id to message, for the messages shown under the inputs. */
  problems: Record<string, string>;
}

const REQUIRED = "This is needed.";

function checkAddress(at: string, address: FormAddress, problems: Record<string, string>) {
  if (!address.line1?.trim()) problems[`${at}line1`] = REQUIRED;
  if (!address.city?.trim()) problems[`${at}city`] = REQUIRED;
  if (!address.postalCode?.trim()) problems[`${at}postalCode`] = REQUIRED;
  if (!address.country) problems[`${at}country`] = "Choose a country.";
}

function checkPerson(at: string, person: FormPerson, problems: Record<string, string>) {
  if (!person.title) problems[`${at}title`] = "Choose one.";
  if (!person.fullName.trim()) problems[`${at}fullName`] = REQUIRED;
  if (!person.passportNumber.trim()) problems[`${at}passportNumber`] = REQUIRED;
  if (!person.nationality) problems[`${at}nationality`] = "Choose a country.";
  if (!person.dateOfBirth) problems[`${at}dateOfBirth`] = "Choose a date.";
  if (!person.countryOfBirth) problems[`${at}countryOfBirth`] = "Choose a country.";
  if (!person.occupation.trim()) problems[`${at}occupation`] = REQUIRED;
  if (!person.phone.trim()) problems[`${at}phone`] = REQUIRED;
  // The form rules a second line for another number, and does not insist that both are given.
  if (!person.email.trim()) problems[`${at}email`] = REQUIRED;
  checkAddress(`${at}address.`, person.address, problems);
}

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, and which sections that leaves incomplete. Section 3 of the API checks the same things. */
export function reviewAccountOpening(value: AccountOpeningEntity, provided: ReadonlySet<string>): FormReview {
  const problems: Record<string, string> = {};
  const { entity, declarations } = value;

  if (!entity.legalName.trim()) problems["entity.legalName"] = REQUIRED;
  if (!entity.countryOfIncorporation) problems["entity.countryOfIncorporation"] = "Choose a country.";
  if (!entity.dateOfIncorporation) problems["entity.dateOfIncorporation"] = "Choose a date.";
  if (!entity.registrationNumber.trim()) problems["entity.registrationNumber"] = REQUIRED;
  if (!entity.natureOfBusiness.trim()) problems["entity.natureOfBusiness"] = REQUIRED;
  if (entity.businessLinkCountries.length === 0) problems["entity.businessLinkCountries"] = "Choose at least one country.";
  if (!entity.organisationType) problems["entity.organisationType"] = "Choose the type of organisation.";
  if (entity.organisationType === "OTHER" && !entity.organisationTypeOther.trim()) {
    problems["entity.organisationTypeOther"] = "Say what kind of organisation it is.";
  }
  if (entity.regulated === null) problems["entity.regulated"] = "Say whether the entity is regulated.";
  if (entity.regulated === true && !entity.regulatorName.trim()) problems["entity.regulatorName"] = "Name the regulator.";

  checkAddress("registeredAddress.", value.registeredAddress, problems);
  // The form calls these copies mandatory, so a person is not on the form until they are here.
  const checkCopies = (at: string, index: number) => {
    for (const document of MANDATORY_DOCUMENTS) {
      const held = documentField(at, index, document);
      if (!provided.has(held)) problems[held] = `Attach the ${document}.`;
    }
  };
  value.signatories.forEach((person, at) => {
    checkPerson(`signatories[${at}].`, person, problems);
    checkCopies("signatories", at);
  });
  value.beneficialOwners.forEach((person, at) => {
    checkPerson(`beneficialOwners[${at}].`, person, problems);
    checkCopies("beneficialOwners", at);
  });
  value.directors.forEach((person, at) => {
    checkPerson(`directors[${at}].`, person, problems);
    checkCopies("directors", at);
  });

  for (const declaration of declarationWording) {
    if (declarations[declaration.id] !== true) problems[`declarations.${declaration.id}`] = "This has to be agreed to.";
  }
  if (!declarations.signingMandate) problems["declarations.signingMandate"] = "Choose who has to sign.";
  if (declarations.signingMandate === "OTHER" && !declarations.signingMandateOther.trim()) {
    problems["declarations.signingMandateOther"] = "Say what the signing mandate is.";
  }
  if (declarations.signers.length === 0) problems["declarations.signers"] = "Add whoever signs.";
  declarations.signers.forEach((signer, at) => {
    if (!signer.fullName.trim()) problems[`declarations.signers[${at}].fullName`] = REQUIRED;
    if (!signer.signature.trim()) problems[`declarations.signers[${at}].signature`] = REQUIRED;
    if (!signer.signedOn) problems[`declarations.signers[${at}].signedOn`] = "Choose a date.";
  });
  return {
    problems,
    // Grouped by the sections the paper form is divided into, so what is on screen matches what is signed.
    steps: [
      { id: "entity", group: "Section A", label: "Details of the account holder", complete: none(problems, "entity.") },
      { id: "address", group: "Section A", label: "Address", complete: none(problems, "registeredAddress.") },
      { id: "signatories", group: "Section B", label: "Authorised Signatory", complete: none(problems, "signatories[") },
      { id: "owners", group: "Section C", label: "Beneficial Owner", complete: none(problems, "beneficialOwners[") },
      { id: "directors", group: "Section D", label: "Director", complete: none(problems, "directors[") },
      { id: "declarations", group: "Section E", label: "Declarations and Signatures", complete: none(problems, "declarations.") },
    ],
  };
}

/** The step a field belongs to, so a message from the API opens the section that holds it. */
export function stepOfField(field: string): string {
  if (field.startsWith("registeredAddress")) return "address";
  if (field.startsWith("signatories")) return "signatories";
  if (field.startsWith("beneficialOwners")) return "owners";
  if (field.startsWith("directors")) return "directors";
  if (field.startsWith("declarations")) return "declarations";
  return "entity";
}

/**
 * What the paper form says at the top of each section, shown before that section is filled in. The wording is the
 * document's own, so nobody is agreeing to something worded differently here.
 */
export const sectionGuidance: Record<string, string> = {
  "Section A":
    "In this section, please provide details of the entity. All Account Holders' details fields are mandatory, unless otherwise stated. Terms which are defined in this form shall have the same meaning and construction as the terms defined in the Services Agreement.",
  "Section B": "Please provide copies of the mandatory documents below.",
  "Section C": "Please provide copies of the mandatory documents below.",
  "Section D": "(In case of multiple Directors, please use the same form for each Director)",
  "Section E":
    "The signature(s) of the authorised signatories in this account opening form (or any supplement(s) thereto) shall serve as specimen signature(s) which shall be used in all dealings with the Firm.",
};
