import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";

/**
 * The DFSA client classification form: which kind of Professional Client the client is.
 *
 * Every line here is the form's own line, word for word. On paper the three routes to a Professional Client are
 * three tables of criteria with a narrow "Tick approp box" column down the side, and five footnotes at the
 * bottom of the page that the criteria refer to by superscript. Here each route is its own set of boxes with
 * its criteria set out under the box they belong to, and the footnotes sit under the route that uses them.
 */

export type AccountType = "INDIVIDUAL" | "JOINT" | "CORPORATE" | "PIC" | "TRUST";

/** One box to tick, with the criteria the form sets out under it. */
export interface ClassificationOption {
  value: string;
  /** The letter or number the form prints in the margin beside it. */
  mark: string;
  text: string;
  /** The rest of the criteria, line by line as the form sets them out. */
  criteria?: string[];
  /** Its criteria say the firm has been provided with sufficient proof, so the proof belongs with it. */
  needsProof?: boolean;
}

export const accountTypes: { value: AccountType; label: string }[] = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "JOINT", label: "Joint" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "PIC", label: "PIC" },
  { value: "TRUST", label: "Trust" },
];

const EXPERIENCE =
  "has sufficient financial experience and understanding of relevant financial markets, products or transactions and any associated risks";

/** 1. Assessed Professional Client. The form says to choose the description that fits. */
export const assessedOptions: ClassificationOption[] = [
  {
    value: "A",
    mark: "A",
    needsProof: true,
    text: "An Individual:",
    criteria: [
      "Who has at least USD 1 Mio in net assets, and provided {{firmName}} with sufficient proof thereof:",
      "AND",
      "Either\nIs or has been in the previous two (2) years on employee in a relevant professional position of {{firmName}} or of another Authorised Firm or Regulated Financial Institution;",
      `Or\n${EXPERIENCE}`,
    ],
  },
  {
    value: "B",
    mark: "B",
    needsProof: true,
    text: "An Undertaking",
    criteria: [
      "An Undertaking, trust or foundation, which is set up solely for the purpose of facilitating the management of an investment portfolio of an individual that:",
      "has at least USD 1,000,000 in net assets¹, and provided {{firmName}} with sufficient proof thereof;",
      "AND",
      `${EXPERIENCE}.`,
    ],
  },
  {
    value: "C1",
    mark: "C1",
    needsProof: true,
    text: "An Undertaking² that :",
    criteria: [
      "-has own funds or called up capital of at least USD 1,000,000 and has provided {{firmName}} with sufficient proof thereof;\nAND",
      `- ${EXPERIENCE}.`,
    ],
  },
  {
    value: "C2",
    mark: "C2",
    needsProof: true,
    text: "An Undertaking who has a controller³, a Holding Company, a Subsidiary or a Joint venture partner that:",
    criteria: [
      "Either:\n1. has own funds⁴ or called up capital⁵ of at least USD 1,000,000 and has provided {{firmName}} with sufficient proof thereof;",
      "OR",
      "2. has at least USD 1,000,000 in net assets, and has provided {{firmName}} with sufficient proof thereof.",
      "AND",
      `${EXPERIENCE}.`,
    ],
  },
  {
    value: "C3",
    mark: "C3",
    text: "An Undertaking who has a controller, or Holding Company, a Subsidiary or Joint venture partner who is a Deemed Professional Client, (as listed below)",
  },
];

/** The five footnotes the form prints under the assessed criteria. */
export const assessedFootnotes: { mark: string; text: string; clauses?: string[] }[] = [
  {
    mark: "¹",
    text: "Assets which exclude the value of the primary residence of the person and may include any assets held directly or indirectly by that person.",
  },
  {
    mark: "²",
    text: "Body corporate or body unincorporated, including a legal person, company, partnership, unincorporated association government or state.",
  },
  {
    mark: "³",
    text: "A ‘controller’ is an individual who:",
    clauses: [
      "a) Owns a majority of shares of the undertaking",
      "b) Is able to appoint or remove a majority of the board members of the undertaking",
      "c) Controls a majority of the voting rights of the undertaking (or that of a holding company of the undertaking)",
    ],
  },
  { mark: "⁴", text: "‘Own funds’ means cash and investments." },
  {
    mark: "⁵",
    text: "‘Called up capital’ means all the amounts paid-up on allotted shares, less any amounts owing on allotted shares.",
  },
];

/** 2. A Deemed Professional Client: an undertaking that satisfies any of the following conditions. */
export const deemedOptions: ClassificationOption[] = [
  {
    value: "1",
    mark: "1",
    text: "A properly constituted government, government agency, central bank or other national monetary authority of any country or jurisdiction.",
  },
  { value: "2", mark: "2", text: "Public authority or state investment authority." },
  {
    value: "3",
    mark: "3",
    text: "Authorized Firm, a regulated financial institution or the management company of a regulated pension fund.",
  },
  {
    value: "4",
    mark: "4",
    text: "Collective Investment Fund / regulated pension fund i.e. an arrangement which amounts to a fund under rule 11 of the DIFC Collective Investment Law 2010 and which is not excluded under the rules made under 12 the Law or a regulated pension fund.",
  },
  {
    value: "5",
    mark: "5",
    text: "Supranational organization whose members are countries, central banks or national monetary authorities.",
  },
  {
    value: "6",
    mark: "6",
    text: "Body corporate whose shares are listed or admitted to trading on any regulated exchange of an IOSCO country.",
  },
  { value: "7", mark: "7", text: "Authorized Market Institution, regulated exchange or regulated clearing house." },
  {
    value: "8",
    mark: "8",
    text: "An Institutional investor whose main activity is to invest in financial instruments, including an entity dedicated to the securitization of assets or other financial transactions.",
  },
  {
    value: "9",
    mark: "9",
    text: "A Large Undertaking.",
    criteria: [
      "A person is a ‘Large Undertaking’ if it met, as at the date of its most recent financial statements, at least two of the following requirements:",
      "(a) it has a balance sheet total of at least $20 million;",
      "(b) it has net annual turnover of at least $40 million; or",
      "it has own funds4 or called up capital of at least $2 million.",
    ],
  },
  {
    value: "10",
    mark: "10",
    text: "A trustee of a trust which has, of had during the previous 12 months, assets of at least USD 10 million;",
  },
  {
    value: "11",
    mark: "11",
    text: "The holder of a licence under the DIFC single Family Office Regulations with respect to its activities carried on exclusively for the purposes of, and only in so far it is, carrying out its duties as a Single-Family Office.",
  },
];

/** 3. Service-based Professional Client. */
export const serviceBasedOptions: ClassificationOption[] = [
  {
    value: "1",
    mark: "1",
    text: "Client is a Corporate which is being provided advice relating to an acquisition, disposal, structuring restructuring, financing or refinancing of a corporation or other legal entity.",
    // The form prints its own OR under this description, joining it to the one below.
    criteria: ["OR"],
  },
  {
    value: "2",
    mark: "2",
    text: "Client is a Corporate which is being provided the arrangement of credit relating to an acquisition, disposal, structuring restructuring, financing or refinancing of a corporation or other legal entity",
  },
];

/** What the form says before any of it is filled in. */
export const classificationNotes = [
  "{{firmName}} provides Financial Services to Professional Clients only (which includes ‘assessed’, ‘service-based’ and ‘deemed’ Professional Clients, as set out in the Dubai Financial Services Authority (“DFSA”) Rulebook).",
  "You have the right to be classified as a Retail Client, which entails a higher level of protection under the DFSA Rules. However, if you are classified as a Retail Client, {{firmName}} will not be able to offer you Financial Services.",
  "Please fill in the Client Classification Form (“Form”) by answering the following questions, and return the duly executed Form to your Relationship Manager.",
];

/** The acknowledgements the client makes by signing, a) to l) as the form lettters them. */
export const classificationDeclaration: { mark: string; text: string; bullets?: string[] }[] = [
  {
    mark: "a)",
    text: "You acknowledge that {{firmName}} is relying on your responses and confirmations set out in this Form, in relation to ascertaining whether you fall within the classification of a Professional Client;",
  },
  {
    mark: "b)",
    text: "On the basis that you fulfil the requirements of a Professional Client based on your responses set out above, {{firmName}} shall treat you as a Professional Client.",
  },
  {
    mark: "c)",
    text: "However, in the event that you fall under any one of the following client types, now or subsequently, {{firmName}} has discretion to classify you as a “Market Counterparty” and to this extent, you agree to be treated as a Market Counterparty:",
    bullets: [
      "Collective Investment Fund, regulated pension fund;",
      "Authorized Firm, Regulated Financial Institution;",
      "Government, government agency, central the Firm;",
      "Supra-national organization;",
      "Authorized market institution, regulated exchange or clearing house;",
      "Body Corporate (shares listed or admitted to trading on any regulated exchange of an IOSCO member country);",
      "A Large Undertaking (as defined above);",
      "A trustee of a trust (which has assets of at least USD 10 million);",
      "A holder of a DIFC Single Family Office license;",
      "Another institutional investor; or",
      "An ‘assessed’ Professional Client who is wholly owned by a Holding Company that is a Larger Undertaking or a body corporate whose shares are listed or admitted to trading on any regulated exchange of an IOSCO member country;",
    ],
  },
  {
    mark: "d)",
    text: "You understand and accept that as a Professional Client, you will not be able to benefit from the protections compensation rights which are given to retail clients. If you are classified as a professional client but subsequently would like to be classified as a retail client, you must inform {{firmName}} by providing a written request to the same effect within 14 days of the receipt of the notification letter in this regard.",
  },
  {
    mark: "e)",
    text: "You have provided the responses and confirmations set out in this form on your own accord without any influence from {{firmName}} or its representatives;",
  },
  {
    mark: "f)",
    text: "Your responses and confirmations provided in this form are accurate, correct, true and complete as at the date hereto. If there is any change in any of your responses, you must inform {{firmName}} accordingly, by written notice. You shall promptly provide {{firmName}} with any information or documents which may be requested of you from time to time;",
  },
  {
    mark: "g)",
    text: "You agree that {{firmName}} may be not be able to continue to provided financial services to you if any response or confirmation provided by you to {{firmName}}, as set out this form, is inaccurate, untrue and/or incomplete;",
  },
  {
    mark: "h)",
    text: "You authorize {{firmName}} to contact any source of information, or any person or entity in order to verify the accuracy and correctness of the responses and confirmations that you have provided in this form;",
  },
  {
    mark: "i)",
    text: "You are acting as principal (for yourself, or as an authorized person for and on behalf of another person or an entity) and not as an agent of any person or entity, at any time when you liaise with {{firmName}} in connection with the account identified in this form;",
  },
  { mark: "j)", text: "You consent to being treated as a professional client under the laws and regulations of the DIFC, as relevant." },
  {
    mark: "k)",
    text: "You acknowledge and accept that this declaration is binding on you in every respect, or as a duly authorized representative of the account holder, you have informed the account holder and ensured that the account holder is fully aware of and agree to the nature content of this declaration being made on its behalf.",
  },
  {
    mark: "l)",
    text: "You are aware that this form and the attached DIFC client Agreement are documents which are binding on you (and the account holder where you are an authorized representative of the account holder), and therefore where you have any doubt, you have already either independently sought legal, tax or other advice OR decided that you do not require such advice, in any case such decision has been made by you without any influence from {{firmName}} or its representatives.",
  },
];

export const clientAgreementNote =
  "{{firmName}}’s client agreement (attached as schedule a to this form) will govern the relationship between us and will take effect from the date you sign this form. By signing this form, you acknowledge that you have read and fully understood the client agreement and the conditions under which {{firmName}} will be carrying out its services with you. By continuing to do business with {{firmName}} you are deemed to have agreed to the terms set out in the client agreement.";

/** The line of the form that asks for the proof its criteria say has been provided. */
export const PROOF_PROVIDED = "assessed.proof";

/** The client agreement the form says is attached to it as schedule a. */
export const CLIENT_AGREEMENT = "declaration.clientAgreement";

/** One column of the form's signature block: By, (Name), (Title), (Date). */
export interface ClassificationSigner {
  signature: string;
  name: string;
  title: string;
  signedOn: string;
}

export interface ClientClassificationEntity {
  client: {
    primaryName: string;
    jointName: string;
    accountType: AccountType | null;
  };
  /** 1. Assessed Professional Client: the one description that fits. */
  assessed: string | null;
  /** 2. A Deemed Professional Client: every condition the undertaking satisfies. */
  deemed: string[];
  /** 3. Service-based Professional Client. */
  serviceBased: string | null;
  declaration: {
    confirmed: boolean;
    signers: ClassificationSigner[];
  };
}

export function emptyClassificationSigner(): ClassificationSigner {
  return { signature: "", name: "", title: "", signedOn: "" };
}

export function emptyClientClassification(): ClientClassificationEntity {
  return {
    client: { primaryName: "", jointName: "", accountType: null },
    assessed: null,
    deemed: [],
    serviceBased: null,
    declaration: { confirmed: false, signers: [emptyClassificationSigner()] },
  };
}

/** What the API holds, filled out to the whole form so every box has something to tick. */
export function toClientClassification(saved: FormDetailAnswers | undefined): ClientClassificationEntity {
  const empty = emptyClientClassification();
  if (!saved) return empty;
  const held = saved as Partial<ClientClassificationEntity>;
  const signers = held.declaration?.signers;
  return {
    client: { ...empty.client, ...held.client },
    assessed: held.assessed ?? null,
    deemed: held.deemed ?? [],
    serviceBased: held.serviceBased ?? null,
    declaration: {
      ...empty.declaration,
      ...held.declaration,
      signers:
        signers && signers.length > 0
          ? signers.map((row) => ({ ...emptyClassificationSigner(), ...row }))
          : empty.declaration.signers,
    },
  };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing. The API checks the same things on submit. */
export function reviewClientClassification(
  value: ClientClassificationEntity,
  provided: ReadonlySet<string>,
): FormReview {
  const problems: Record<string, string> = {};
  const { client, declaration } = value;

  if (!client.primaryName.trim()) problems["client.primaryName"] = REQUIRED;
  if (!client.accountType) problems["client.accountType"] = "Choose the account type.";

  // The form is answered by ticking whichever of its three routes apply; one of them has to.
  if (!value.assessed && value.deemed.length === 0 && !value.serviceBased) {
    problems["classification"] = "Tick the box or boxes that apply, under 1, 2 or 3.";
  }
  // The assessed criteria say the firm has been provided with sufficient proof, so it has to be here.
  const route = assessedOptions.find((one) => one.value === value.assessed);
  if (route?.needsProof && !provided.has(PROOF_PROVIDED)) {
    problems[PROOF_PROVIDED] = "Attach the proof the criteria say has been provided.";
  }

  if (!declaration.confirmed) problems["declaration.confirmed"] = "The declaration has to be made.";
  // The form says its client agreement is attached to it as schedule a.
  if (!provided.has(CLIENT_AGREEMENT)) {
    problems[CLIENT_AGREEMENT] = "Attach the client agreement, which is schedule a to this form.";
  }
  if (declaration.signers.length === 0) problems["declaration.signers"] = "Add whoever signs.";
  declaration.signers.forEach((signer, at) => {
    // The client signs after the form reaches them, so their signature is not what makes the form ready
    // to send. Their name and the date still are.
    if (!signer.name.trim()) problems[`declaration.signers[${at}].name`] = REQUIRED;
    if (!signer.title.trim()) problems[`declaration.signers[${at}].title`] = REQUIRED;
    if (!signer.signedOn) problems[`declaration.signers[${at}].signedOn`] = "Choose a date.";
  });

  return {
    problems,
    steps: [
      { id: "client", group: "Client Classification Form", label: "The client", complete: none(problems, "client.") },
      {
        id: "classification",
        group: "Client Classification Form",
        label: "Professional Client",
        // The proof the assessed criteria ask for belongs to this part too.
        complete: none(problems, "classification") && none(problems, PROOF_PROVIDED),
      },
      {
        id: "declaration",
        group: "Client Classification Form",
        label: "Signatures",
        complete: none(problems, "declaration."),
      },
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfClassificationField(field: string): string {
  if (field.startsWith("declaration")) return "declaration";
  if (field.startsWith("client")) return "client";
  return "classification";
}

export const classificationGuidance: Record<string, string> = {
  "Client Classification Form":
    "In order to ascertain whether you are a “Professional Client”, please tick all box(es) below, as applicable to you :",
};

export const classificationDescriptions: Record<string, string> = {
  client: "Who the form is for, and the type of account.",
  classification:
    "In order to ascertain whether you are a “Professional Client”, please tick all box(es) below, as applicable to you :",
  declaration: "What is being declared, and who signs it.",
};
