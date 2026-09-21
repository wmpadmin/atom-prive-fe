import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The confirmation the two holders of a joint account sign: the primary confirms that they operate the account
 * and are a Professional Client, and the secondary confirms that they are a family member who refers to the
 * primary for the decisions. It belongs to the Joint pack alone — no other pack's folder holds it.
 */

/** Part A, as the form numbers and words it. The first line rules a blank for the name that signs it. */
export const primaryConfirmations = [
  "I, [ ] confirm that I am the Primary Joint Account Holder as the account is mainly operated by me and the Secondary Joint Account Holder refers to me for investment and other decisions to do with the account.",
  "I confirm that I am a Professional Client as defined in the DFSA Conduct of Business Rules.",
  "I acknowledge and accept that, as Professional Client, I do not benefit from the protections which are offered to Retail Clients.",
  "I am aware that may elect to be classified as a Retail Client, but I affirm that I would like to be a Professional Client.",
];

/** Part B. Its second line asks which family relationship applies, so that one is asked separately below. */
export const secondaryConfirmations = [
  "I, [ ] confirm that the account is mainly operated by the Primary Joint Account Holder named above.",
  "I am family member of the Primary Joint Account Holder, in particular:",
  "The account(s) which have been or will be established is to be used for the purposes of managing investments for the Primary Account Holder and I;",
  "I refer to the Primary Joint Account Holder who makes or will make investment decisions for the Account;",
  "I, have read and fully understood the Client agreement, client classification document and terms and conditions under which ABCD Limited are willing to provide their services, and I agree to abide by the same; and",
  "I have not elected to be treated as a Retail Client.",
];

/** The relationship the secondary holder stands in, lettered a to c as the form letters them. */
export type FamilyTie = "SPOUSE" | "CLOSE_RELATIVE" | "SPOUSE_OF_RELATIVE";

export const familyTies: { value: FamilyTie; letter: string; text: string }[] = [
  { value: "SPOUSE", letter: "a", text: "A spouse;" },
  {
    value: "CLOSE_RELATIVE",
    letter: "b",
    text: "A child, step-child, parent, step-parent, brother, sister, step-brother, step-sister; or",
  },
  {
    value: "SPOUSE_OF_RELATIVE",
    letter: "c",
    text: "A souse of a child, step-child, parent, step-parent, brother, sister, step-brother, step-sister",
  },
];

export const PART_A = "Confirmation from Primary Joint Account Holder:";

export const PART_B = "Confirmation from Secondary Joint Account Holder:";

export const BY_SIGNING = "By signing below:";

/** One of the two blocks the form rules at its foot. */
export interface Signature {
  name: string;
  signature: string;
  signedOn: string;
}

export interface ProfessionalClientConfirmation {
  holders: {
    primaryName: string;
    secondaryName: string;
    address: string;
  };
  primary: {
    /** The name written on the rule in the first line of Part A. */
    confirmedBy: string;
    agreed: boolean;
  };
  secondary: {
    confirmedBy: string;
    familyTie: FamilyTie | null;
    agreed: boolean;
  };
  signatures: {
    primary: Signature;
    secondary: Signature;
  };
}

function emptySignature(): Signature {
  return { name: "", signature: "", signedOn: "" };
}

export function emptyProfessionalClientConfirmation(): ProfessionalClientConfirmation {
  return {
    holders: { primaryName: "", secondaryName: "", address: "" },
    primary: { confirmedBy: "", agreed: false },
    secondary: { confirmedBy: "", familyTie: null, agreed: false },
    signatures: { primary: emptySignature(), secondary: emptySignature() },
  };
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toProfessionalClientConfirmation(
  saved: FormDetailAnswers | undefined,
): ProfessionalClientConfirmation {
  const empty = emptyProfessionalClientConfirmation();
  if (!saved) return empty;
  const held = saved as Partial<ProfessionalClientConfirmation>;
  return {
    holders: { ...empty.holders, ...held.holders },
    primary: { ...empty.primary, ...held.primary },
    secondary: { ...empty.secondary, ...held.secondary },
    signatures: {
      primary: { ...empty.signatures.primary, ...held.signatures?.primary },
      secondary: { ...empty.signatures.secondary, ...held.signatures?.secondary },
    },
  };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewProfessionalClientConfirmation(value: ProfessionalClientConfirmation): FormReview {
  const problems: Record<string, string> = {};
  const { holders, primary, secondary, signatures } = value;

  if (!holders.primaryName.trim()) problems["holders.primaryName"] = REQUIRED;
  if (!holders.secondaryName.trim()) problems["holders.secondaryName"] = REQUIRED;
  if (!holders.address.trim()) problems["holders.address"] = REQUIRED;

  if (!primary.confirmedBy.trim()) problems["primary.confirmedBy"] = REQUIRED;
  if (!primary.agreed) problems["primary.agreed"] = "This has to be confirmed.";

  if (!secondary.confirmedBy.trim()) problems["secondary.confirmedBy"] = REQUIRED;
  if (!secondary.familyTie) problems["secondary.familyTie"] = "Choose one.";
  if (!secondary.agreed) problems["secondary.agreed"] = "This has to be confirmed.";

  for (const [who, block] of [
    ["primary", signatures.primary],
    ["secondary", signatures.secondary],
  ] as const) {
    if (!block.name.trim()) problems[`signatures.${who}.name`] = REQUIRED;
    if (!block.signature.trim()) problems[`signatures.${who}.signature`] = REQUIRED;
    if (!block.signedOn.trim()) problems[`signatures.${who}.signedOn`] = "Choose a date.";
  }

  return {
    problems,
    steps: [
      { id: "holders", group: "THE ACCOUNT", label: "The joint account holders", complete: none(problems, "holders.") },
      { id: "primary", group: "A", label: "Confirmation from Primary Joint Account Holder", complete: none(problems, "primary.") },
      { id: "secondary", group: "B", label: "Confirmation from Secondary Joint Account Holder", complete: none(problems, "secondary.") },
      { id: "signatures", group: "SIGNATURES", label: "Signatures", complete: none(problems, "signatures.") },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfProfessionalClientConfirmationField(field: string): string {
  if (field.startsWith("signatures")) return "signatures";
  if (field.startsWith("secondary")) return "secondary";
  if (field.startsWith("primary")) return "primary";
  return "holders";
}

/** What the form itself says at the head of each part, shown before that part is filled in. */
export const professionalClientConfirmationGuidance: Record<string, string> = {
  A: BY_SIGNING,
  B: BY_SIGNING,
};

/** The line under each part's heading, in the form's own words where it prints one. */
export const professionalClientConfirmationDescriptions: Record<string, string> = {
  holders: "Professional Client Confirmation from Joint Account Holder",
  primary: PART_A,
  secondary: PART_B,
  signatures: "The two blocks the form rules at its foot, one for each account holder.",
};
