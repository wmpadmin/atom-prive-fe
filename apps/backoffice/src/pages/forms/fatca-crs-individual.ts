import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The self-certification an individual account holder signs. It shares a name with the entity form and almost
 * nothing else: four Parts about a person rather than five about a company, and the CRS and FATCA answers are
 * a table of jurisdictions and one of two statements rather than a classification picked from a list.
 */

/** What the form calls itself, in the shaded box it opens with. */
export const FORM_TITLE = "FATCA Self Certification Form";

/** The line the same box prints under that title, which says who this form is not for. */
export const NOT_FOR_ENTITIES =
  "If you are not an individual or sole proprietorship, then you should not use this form and instead use the self- certification form for entities.";

/** Everything the form says about itself before PART 1, under the two questions it asks and answers. */
export const preamble: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "Why am I completing this form?",
    paragraphs: [
      "We are required by the OECD Common Reporting Standard (\"CRS\") regulations to collect and report certain information about an Account Holder's tax residence. Each jurisdiction has its own rules for defining tax residence.",
      "For the purposes of the U.S. Foreign Account Tax Compliance Act (\"FATCA\"), we are required to determine whether our Account Holders are U.S. Persons.",
      "For more information on tax residence, please consult your tax advisor. Our staff are unable to assist in the completion of this form. Please refer to the definitions in Appendix A.",
      "If the Account Holder's tax residence is located outside the country where the financial account is held, we may be legally obliged to pass on the information in this form and other financial information with respect to your financial accounts to the national tax authorities or regulators or the Internal Revenue Service (\"IRS\") and they may further exchange this information with competent authorities and/or regulators of other jurisdiction(s) or jurisdictions pursuant to intergovernmental agreements to exchange financial account information.",
    ],
  },
  {
    heading: "Does this form expire?",
    paragraphs: [
      "This form will remain valid unless there is a change in circumstances relating to the Account Holder's tax status or other mandatory fields included on this form. You must notify us of a change in circumstances, within a maximum period of 30 days from the date of such change, that makes the information in this self-certification incorrect or incomplete and provide an updated self-certification form.",
      "We may request that you submit additional documentation that supports the OECD CRS and U.S. FATCA declarations made in this self-certification form.",
    ],
  },
];

/** The instruction the form ends its preamble on, set in bold italics. */
export const COMPLETE_ALL_PARTS =
  "We therefore request you to complete all Parts of this self-certification form, as they are all mandatory and sign this form below in PART 4.";

/** The four titles the form prints across the head of PART 1. */
export type HolderTitle = "MR" | "MRS" | "MS" | "MISS";

export const holderTitles: { value: HolderTitle; text: string }[] = [
  { value: "MR", text: "Mr." },
  { value: "MRS", text: "Mrs." },
  { value: "MS", text: "Ms." },
  { value: "MISS", text: "Miss" },
];

/** The reason a row of Table A gives for there being no TIN, entered as the letter the form prints. */
export type NoTinReason = "A" | "B" | "C";

/**
 * The three reasons the form sets out under Table A, each one as the paper words it. They are a legend for the
 * table's last column: the column asks for the letter, so the letter is what is chosen.
 */
export const noTinReasons: { value: NoTinReason; text: string }[] = [
  {
    value: "A",
    text: "Reason A - The country where the Account Holder is liable to pay tax does not issue TINs to its residents.",
  },
  {
    value: "B",
    text: "Reason B - The Account Holder is otherwise unable to obtain a TIN or equivalent number (Please explain why you are unable to obtain a TIN in the below table if you have selected this reason).",
  },
  {
    value: "C",
    text: "Reason C - No TIN is required. (Note. Only select this reason if the domestic law of the relevant jurisdiction does not require the collection of the TIN issued by such jurisdiction).",
  },
];

export const TABLE_A_HEADINGS = {
  country: "Country/Jurisdiction of tax residence (no abbreviations)",
  tin: "TIN (Taxpayer Identification Number e.g. Social Security Number)",
  reason: "If no TIN is available, please enter Reason A, B or C",
};

export const REASON_B_EXPLANATION =
  "Please explain in the following boxes why the Account Holder is unable to obtain a TIN if you selected Reason B above.";

export const ONLY_TAX_RESIDENT =
  "I declare I am ONLY a Tax Resident in the jurisdiction(s) listed above in Table A, even if {{firmName}} has collected and holds addresses in other jurisdictions that are not listed above:";

export const WHY_NOT_ONLY_RESIDENT = "If you have ticked no, please provide a reason for this in the following box:";

/** The two statements PART 3 prints, one of which the account holder ticks. */
export const usPersonStatements = [
  {
    value: true,
    text: "I am a U.S. Person for tax purposes and my U.S. Taxpayer Identification Number (e.g. TIN, social security number) is:",
  },
  { value: false, text: "I am not a U.S. Person for tax purposes." },
];

/** PART 4, in the form's own words. */
export const declarationWording = [
  "I hereby certify that the information I have provided in this form is true, correct and complete in all respects. I confirm that I have provided the information in this document willingly without advice or help from {{firmName}}.",
  "I understand that providing false information, withholding relevant information or responding in a misleading way, may result in rejection of my application or other appropriate action taken against me. I further certify that, if any information provided on this form changes, I will inform you within 30 days of such a change.",
  "I hereby consent to {{firmName}} using, processing, reporting and transferring information about me, my relationship with {{firmName}} (including information about my accounts and other products related to the accounts) and my financial affairs to any governmental authority (e.g. tax authorities, ministries, central banks, regulators) or third party as may be required by, or in connection with, any law, regulation or agreement with any governmental authority in the country where {{firmName}} maintains my accounts (which may then pass that information to the tax authorities in another country) or in other countries (such as the United States) as may be required by the foregoing.",
];

/** The two notes the form prints under its declaration. */
export const JOINT_HOLDERS_NOTE =
  "Note: In the case of joint account holders, each Account Holder must complete a separate form.";

export const CAPACITY_NOTE =
  "Note: If you are not the Account Holder, please indicate the capacity in which you are signing the form. If signing under a power of attorney, please also attach a copy of the power of attorney.";

/** An address as this form rules it: one line for the street, then town, country and postal code. */
export interface HolderAddress {
  street: string;
  town: string;
  country: string;
  postalCode: string;
}

/** One row of Table A. */
export interface Jurisdiction {
  country: string;
  tin: string;
  noTinReason: NoTinReason | null;
  explanation: string;
}

export interface FatcaCrsIndividual {
  holder: {
    title: HolderTitle | null;
    surname: string;
    firstName: string;
    middleName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    residential: HolderAddress;
    mailing: HolderAddress;
  };
  residence: {
    jurisdictions: Jurisdiction[];
    onlyTaxResidentListed: boolean | null;
    otherResidenceReason: string;
  };
  fatca: {
    usPerson: boolean | null;
    usTin: string;
  };
  declaration: {
    confirmed: boolean;
    printName: string;
    signature: string;
    signedOn: string;
    capacity: string;
  };
}

function emptyAddress(): HolderAddress {
  return { street: "", town: "", country: "", postalCode: "" };
}

export function emptyJurisdiction(): Jurisdiction {
  return { country: "", tin: "", noTinReason: null, explanation: "" };
}

export function emptyFatcaCrsIndividual(): FatcaCrsIndividual {
  return {
    holder: {
      title: null,
      surname: "",
      firstName: "",
      middleName: "",
      dateOfBirth: "",
      placeOfBirth: "",
      residential: emptyAddress(),
      mailing: emptyAddress(),
    },
    residence: { jurisdictions: [emptyJurisdiction()], onlyTaxResidentListed: null, otherResidenceReason: "" },
    fatca: { usPerson: null, usTin: "" },
    declaration: { confirmed: false, printName: "", signature: "", signedOn: "", capacity: "" },
  };
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toFatcaCrsIndividual(saved: FormDetailAnswers | undefined): FatcaCrsIndividual {
  const empty = emptyFatcaCrsIndividual();
  if (!saved) return empty;
  const held = saved as Partial<FatcaCrsIndividual>;
  const rows = held.residence?.jurisdictions;
  return {
    holder: {
      ...empty.holder,
      ...held.holder,
      residential: { ...empty.holder.residential, ...held.holder?.residential },
      mailing: { ...empty.holder.mailing, ...held.holder?.mailing },
    },
    residence: {
      ...empty.residence,
      ...held.residence,
      jurisdictions:
        rows && rows.length > 0 ? rows.map((row) => ({ ...emptyJurisdiction(), ...row })) : empty.residence.jurisdictions,
    },
    fatca: { ...empty.fatca, ...held.fatca },
    declaration: { ...empty.declaration, ...held.declaration },
  };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewFatcaCrsIndividual(value: FatcaCrsIndividual): FormReview {
  const problems: Record<string, string> = {};
  const { holder, residence, fatca, declaration } = value;

  if (!holder.title) problems["holder.title"] = "Choose one.";
  if (!holder.surname.trim()) problems["holder.surname"] = REQUIRED;
  if (!holder.firstName.trim()) problems["holder.firstName"] = REQUIRED;
  if (!holder.dateOfBirth.trim()) problems["holder.dateOfBirth"] = "Choose a date.";
  if (!holder.placeOfBirth.trim()) problems["holder.placeOfBirth"] = REQUIRED;
  if (!holder.residential.street.trim()) problems["holder.residential.street"] = REQUIRED;
  if (!holder.residential.town.trim()) problems["holder.residential.town"] = REQUIRED;
  if (!holder.residential.country) problems["holder.residential.country"] = "Choose a country.";
  // A middle name is only asked for by those who have one, and the Mailing Address block is headed "Please
  // complete only if different from Residential Address", so nothing in it is asked for either.

  residence.jurisdictions.forEach((row, at) => {
    const where = `residence.jurisdictions[${at}]`;
    if (!row.country) problems[`${where}.country`] = "Choose a country.";
    if (!row.tin.trim() && !row.noTinReason) {
      problems[`${where}.noTinReason`] = "Give the TIN, or the reason there is none.";
    }
    if (row.noTinReason === "B" && !row.explanation.trim()) problems[`${where}.explanation`] = REQUIRED;
  });
  if (residence.onlyTaxResidentListed === null) problems["residence.onlyTaxResidentListed"] = "Say yes or no.";
  if (residence.onlyTaxResidentListed === false && !residence.otherResidenceReason.trim()) {
    problems["residence.otherResidenceReason"] = REQUIRED;
  }

  if (fatca.usPerson === null) problems["fatca.usPerson"] = "Choose one.";
  if (fatca.usPerson === true && !fatca.usTin.trim()) problems["fatca.usTin"] = REQUIRED;

  if (!declaration.confirmed) problems["declaration.confirmed"] = "This has to be agreed to.";
  if (!declaration.printName.trim()) problems["declaration.printName"] = REQUIRED;
  // The client signs after the form reaches them; their name and the date are what is needed here.
  if (!declaration.signedOn.trim()) problems["declaration.signedOn"] = "Choose a date.";
  // The capacity line is for someone signing who is not the Account Holder, so it is not asked for.

  return {
    problems,
    steps: [
      { id: "holder", group: "PART 1", label: "Identification of Account Holder", complete: none(problems, "holder.") },
      {
        id: "residence",
        group: "PART 2",
        label: "Jurisdiction of Residency for Tax Purposes",
        complete: none(problems, "residence."),
      },
      { id: "fatca", group: "PART 3", label: "Jurisdiction of Citizenship", complete: none(problems, "fatca.") },
      {
        id: "declaration",
        group: "PART 4",
        label: "Declaration and Signature",
        complete: none(problems, "declaration."),
      },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfFatcaCrsIndividualField(field: string): string {
  if (field.startsWith("residence")) return "residence";
  if (field.startsWith("fatca")) return "fatca";
  if (field.startsWith("declaration")) return "declaration";
  return "holder";
}

/** What the form itself says at the head of each part, shown before that part is filled in. */
export const fatcaCrsIndividualGuidance: Record<string, string> = {
  // PART 1 has no entry: everything the form says before PART 1 is printed on the part itself.
  "PART 2":
    "Please complete the following table indicating (i) where the Account Holder is tax resident and (ii) the Account Holder’s TIN for each country/Reportable Jurisdiction indicated.",
  "PART 4": JOINT_HOLDERS_NOTE,
};

/** The line under each part's heading, in the form's own words where it prints one. */
export const fatcaCrsIndividualDescriptions: Record<string, string> = {
  holder: "PART 1: Identification of Account Holder (in BLOCK CAPITALS)",
  residence: "PART 2: Jurisdiction of Residency for Tax Purposes (CRS) (in BLOCK CAPITALS)",
  fatca: "PART 3: Jurisdiction of Citizenship (U.S.FATCA) ( in Block Capitals)",
  declaration: "PART 4: Declaration and Signature (in BLOCK CAPITALS)",
};
