/*
 * The closing pages of the two Self-Certification papers (Version Oct 2025), word for word: how to complete the form
 * and what its terms mean. The download prints them after the self-certification itself, as the papers do (25 Nov 2026).
 */

/** A table of the instructions: a part of the form, the colour the paper gives it, and a line for each of its boxes. */
export type GuideTable = {
  part: string;
  title: string;
  tone: "navy" | "teal" | "indigo" | "brown";
  rows: { label: string; text: string[] }[];
};

/** One page of instructions, under its title. */
export type GuidePage = { title: string; tables: GuideTable[] };

/**
 * A line of a definition as the paper sets it: a paragraph, a sub-heading, or a list item with its marker, one or two
 * steps in, its first words in bold where the paper has them so.
 */
export type GlossLine = {
  text: string;
  lead?: string;
  marker?: string;
  depth?: 1 | 2 | 3;
  heading?: boolean;
  italic?: boolean;
};

/** A term and its definition, line by line. */
export type GlossTerm = { term: string; lines: GlossLine[] };

export const DEFINITIONS_INTRODUCTION = "The following is a non-exhaustive list of terms provided to assist you with the completion of this Form. "
  + "Please contact your tax, legal and/or other professional advisor if you have any questions.";

const taxResidence = (who: string) => [
  `Please complete the table indicating (i) where the ${who} is resident for tax purposes and (ii) the ${who}’s Taxpayer Identification Number `
    + `for each country/jurisdiction indicated. Please list all countries/jurisdictions in which the ${who} is resident for tax purposes.`,
  "Each country/jurisdiction has its own rules for defining tax residence. It is possible for a person to be considered tax resident in more "
    + "than one country/jurisdiction. For more information on tax residence, please consult your tax advisor, or refer to the information "
    + "provided by the OECD at this link.",
];

const capacity = (form: string, who: string, extra = " or officer") => [
  `An authorised representative${extra} must state the capacity in which he/she is signing on behalf of the ${who}. If this ${form} is `
    + `completed by an agent acting under a duly authorised power of attorney, the ${form} must be accompanied by the power of attorney in proper `
    + `form, specifically authorising the agent to represent the ${who} in making, executing and presenting the ${form}.`,
];

/** Self-Certification Form – Individual, page 5. */
export const INDIVIDUAL_CERT_GUIDE: GuidePage[] = [
  {
    title: "Instructions on how to complete the Self-Certification Form",
    tables: [
      {
        part: "Part 1",
        title: "Identification of Individual Account Holder",
        tone: "navy",
        rows: [
          { label: "A) Name of the Individual Account Holder", text: ["Enter the name of the Individual listed or identified as the holder of the Account"] },
          { label: "B) Date of Birth", text: ["Enter the Account Holder’s date of birth, using the following format DD-MMM-YYYY"] },
          { label: "C) Place of Birth", text: ["Enter the Account Holder’s place of birth"] },
          { label: "D) Current Residence Address", text: ["Enter the Account Holder’s current residence address"] },
          { label: "E) Mailing Address", text: ["Enter the Account Holder’s mailing address only if it is different from the Current Residence Address"] },
        ],
      },
      { part: "Part 2", title: "Tax Residence Information", tone: "teal", rows: [{ label: "Tax Residence Information", text: taxResidence("Account Holder") }] },
      {
        part: "Part 3",
        title: "Declaration and Signature",
        tone: "indigo",
        rows: [
          {
            label: "Declaration and Signature",
            text: ["The Form must be signed and dated by the Account Holder. If this Form is completed by an Individual authorised to sign for the "
              + "Account Holder, please indicate the capacity in which the individual is signing the Form."],
          },
          { label: "Capacity", text: capacity("Form", "Account Holder") },
        ],
      },
    ],
  },
];

const ENTITY = "Company/Legal Entity/Corporate Structure";

/** Self-Certification Form – Company / Legal Entity / Corporate Structure, pages 10 and 11. */
export const ENTITY_CERT_GUIDE: GuidePage[] = [
  {
    title: "Instructions on how to complete the Self-Certification Form",
    tables: [
      {
        part: "Part 1",
        title: "Identification of Entity Account Holder",
        tone: "navy",
        rows: [
          { label: `A) Name of the ${ENTITY}`, text: [`Enter the name of the ${ENTITY} identified as the holder of the Account`] },
          { label: "B) Date of Incorporation", text: [`Enter the ${ENTITY}’s date of incorporation, using the following format DD-MMM-YYYY`] },
          { label: "C) Place of Incorporation", text: [`Enter the ${ENTITY}’s place of incorporation`] },
          { label: "D) Registered Address", text: [`Enter the ${ENTITY}’s registered address`] },
          { label: "E) Mailing Address", text: [`Enter the ${ENTITY}’s mailing address only if it is different from the Registered Address`] },
          { label: "F) Place of Operations", text: [`Enter the country/jurisdiction where the ${ENTITY} has operations in`] },
          { label: "G) Company Registration Number", text: [`Enter the ${ENTITY}’s unique entity number`] },
        ],
      },
      { part: "Part 2", title: "Tax Residence Information", tone: "teal", rows: [{ label: "Tax Residence Information", text: taxResidence("Account Holder") }] },
      {
        part: "Part 3",
        title: "Entity Classification",
        tone: "indigo",
        rows: [
          {
            label: "CRS Classification",
            text: [`Please tick only the classification for which the ${ENTITY} qualifies. Please refer to the Definitions section for more details.`],
          },
          {
            label: "Controlling Person(s)",
            text: ["Please complete this section where the Account Holder has declared its classification to be a Passive Non-Financial Entity, or "
              + "an Investment Entity located in a Non-Participating Jurisdiction and managed by another Financial Institution. Please also complete "
              + "the Annex – Controlling Person(s) for each Controlling Person."],
          },
        ],
      },
      {
        part: "Part 4",
        title: "Declaration and Signature",
        tone: "brown",
        rows: [
          {
            label: "Declaration and Signature",
            text: ["The Form must be signed and dated by an authorised representative of the Account Holder. If this Form is completed and signed by "
              + "an Individual who is not a Director or Authorised Signatory authorised to sign for the Account Holder, please indicate the capacity "
              + "in which the individual is signing the Form."],
          },
          { label: "Capacity", text: capacity("Form", "Account Holder") },
        ],
      },
    ],
  },
  {
    title: "Instructions on how to complete the Annex",
    tables: [
      {
        part: "Part 1",
        title: "Identification of Controlling Person",
        tone: "navy",
        rows: [
          {
            label: "A) Name of the Individual who is the Controlling Person",
            text: ["Enter the name of the person listed or identified as the Controlling Person of the Account Holder"],
          },
          { label: "B) Date of Birth", text: ["Enter the Controlling Person’s date of birth in the following format DD-MMM-YYYY"] },
          { label: "C) Place of Birth", text: ["Enter the Controlling Person’s place of birth"] },
          { label: "D) Current Residence Address", text: ["Enter the Controlling Person’s current residence address"] },
          { label: "E) Mailing Address", text: ["Enter the Controlling Person’s mailing address only if it is different from the Current Residence Address"] },
        ],
      },
      { part: "Part 2", title: "Tax Residence Information", tone: "teal", rows: [{ label: "Tax Residence Information", text: taxResidence("Controlling Person") }] },
      {
        part: "Part 3",
        title: "Type of Controlling Person",
        tone: "indigo",
        rows: [{ label: "Type of Controlling Person", text: ["Please provide the Controlling Person’s status by ticking the appropriate box."] }],
      },
      {
        part: "Part 4",
        title: "Declaration and Signature",
        tone: "brown",
        rows: [
          {
            label: "Declaration and Signature",
            text: ["The Annex must be signed and dated by the Controlling Person of the Account Holder. If this Annex is completed and signed by an "
              + "Individual who is authorised to sign for the Controlling Person, please indicate the capacity in which the individual is signing the "
              + "Annex for the Controlling Person."],
          },
          { label: "Capacity", text: capacity("Annex", "Controlling Person", "") },
        ],
      },
    ],
  },
];

const said = (text: string): GlossLine => ({ text });
const item = (marker: string, text: string, lead?: string, depth: 1 | 2 | 3 = 1): GlossLine => ({ marker, text, lead, depth });

const ACCOUNT_HOLDER = (institution: string) => "The Account Holder means the person listed or identified as the holder of a Financial Account. A person, "
  + `other than a ${institution}, holding a Financial Account for the benefit or account of another person as an agent, a custodian, a nominee, a `
  + "signatory, an investment advisor, an intermediary, or as a legal guardian, is not treated as the Account Holder. In these circumstances, that "
  + "other person is the Account Holder. With respect to a jointly-held account, each joint account holder is treated as an Account Holder.";

const NON_PARTICIPATING: GlossTerm = {
  term: "Non-Participating Jurisdiction",
  lines: [said("A non-participating jurisdiction means a jurisdiction that is not a Participating Jurisdiction.")],
};
const PARTICIPATING: GlossTerm = {
  term: "Participating Jurisdiction",
  lines: [said("A Participating Jurisdiction means a jurisdiction with which an agreement is in place pursuant to which it will provide the "
    + "information specified in Section I of the CRS, and which is identified in a published list.")],
};
const REPORTABLE_JURISDICTION: GlossTerm = {
  term: "Reportable Jurisdiction",
  lines: [said("A Reportable Jurisdiction is a Participating Jurisdiction with which an obligation to provide financial account information is in "
    + "place, and which is identified in a published list.")],
};
const REPORTABLE_JURISDICTION_PERSON: GlossTerm = {
  term: "Reportable Jurisdiction Person",
  lines: [said("An Individual or Entity that is resident in a Reportable Jurisdiction under the tax laws of such jurisdiction, or an estate of a "
    + "decedent who was a resident of a Reportable Jurisdiction.")],
};
const reportablePerson = (marker: string): GlossTerm => ({
  term: "Reportable Person",
  lines: [
    said("A Reportable Jurisdiction Person other than"),
    item(marker, "a corporation the stock of which is regularly traded on one or more Established Securities Markets;"),
    item(marker, "any corporation that is a Related Entity of a corporation described above;"),
    item(marker, "a Governmental Entity;"),
    item(marker, "an International Organisation;"),
    item(marker, "a Central Bank; or"),
    item(marker, "an FI (except for an Investment Entity located in a Non-Participating Jurisdiction and managed by another FI)."),
  ],
});
const TIN: GlossTerm = {
  term: "Taxpayer Identification Number (TIN)",
  lines: [said("Taxpayer Identification Number or a functional equivalent in the absence of a TIN. A TIN is a unique combination of letters or "
    + "numbers assigned by a jurisdiction to an Individual or an Entity and used to identify the Individual or Entity for the purposes of "
    + "administering the tax laws of such jurisdiction. Further details of acceptable TINs can be found at this link. Some jurisdictions do not "
    + "issue a TIN. However, these jurisdictions often utilise some other high integrity number with an equivalent level of identification (a "
    + "‘functional equivalent’). Examples of that type of number include, for entities, a business/company registration code/number, and for "
    + "individuals, a social security/insurance number, citizen/personal identification/ service code/number, and resident registration number.")],
};

/** Self-Certification Form – Individual, page 6. */
export const INDIVIDUAL_CERT_DEFINITIONS: GlossTerm[] = [
  { term: "Account Holder", lines: [said(ACCOUNT_HOLDER("Financial Institution (FI)"))] },
  {
    term: "Financial Account",
    lines: [said("A Financial Account is an account maintained by an FI and includes: Depository Accounts; Custodial Accounts; Equity and debt "
      + "interest in certain Investment Entities; Cash Value Insurance Contracts; and Annuity Contracts.")],
  },
  NON_PARTICIPATING,
  PARTICIPATING,
  {
    term: "Reportable Account",
    lines: [said("A Reportable Account is a Financial Account that, pursuant to due diligence procedures consistent with CRS, has been identified "
      + "as an account that is held by one or more persons that are Reportable Persons with respect to another Jurisdiction, or by a Passive "
      + "Non-Financial Entity with one or more Controlling Persons that are Reportable Persons with respect to another Jurisdiction.")],
  },
  REPORTABLE_JURISDICTION,
  REPORTABLE_JURISDICTION_PERSON,
  reportablePerson("•"),
  TIN,
];

/** Self-Certification Form – Company / Legal Entity / Corporate Structure, pages 12 to 14. */
export const ENTITY_CERT_DEFINITIONS: GlossTerm[] = [
  { term: "Account Holder", lines: [said(ACCOUNT_HOLDER("Financial Institution"))] },
  {
    term: "Active Non-Financial Entity (NFE)",
    lines: [
      said("An Active NFE means any NFE that meets any of the following criteria:"),
      item("a.", "Less than 50% of the NFE’s gross income for the preceding calendar year or other appropriate reporting period is passive "
        + "income and less than 50% of the assets held by the NFE during the preceding calendar year or other appropriate reporting period are "
        + "assets that produce or are held for the production of passive income;", "Active Business:"),
      item("b.", "The stock of the NFE is regularly traded on an established securities market or the NFE is a Related Entity of an Entity, the "
        + "stock of which is regularly traded on an established securities market;", "Corporation that is publicly traded or a related entity of a publicly traded corporation:"),
      item("c.", "The NFE is a Governmental Entity, an International Organisation, a Central Bank, or an Entity wholly owned by one or more of "
        + "the foregoing;", "Governmental Entity/International Organisation/Central Bank:"),
      item("d.", "Substantially all of the activities of the NFE consist of holding (in whole or in part) the outstanding stock of, or providing "
        + "financing and services to, one or more subsidiaries that engage in trades or businesses other than the business of a Financial "
        + "Institution, except that an Entity does not qualify for this status if the Entity functions (or holds itself out) as an investment "
        + "fund, such as a private equity fund, venture capital fund, leveraged buyout fund, or any investment vehicle whose purpose is to "
        + "acquire or fund companies and then hold interests in those companies as capital assets for investment purposes;", "Holding company that is a member of a non-financial group:"),
      item("e.", "The NFE is not yet operating a business and has no prior operating history, but is investing capital into assets with the "
        + "intent to operate a business other than that of a Financial Institution, provided that the NFE does not qualify for this exception "
        + "after the date that is 24 months after the date of the initial organisation of the NFE;", "Start-up company:"),
      item("f.", "The NFE was not a Financial Institution in the past five years, and is in the process of liquidating its assets or is "
        + "reorganising with the intent to continue or recommence operations in a business other than that of a Financial Institution;", "Liquidating company:"),
      item("g.", "The NFE primarily engages in financing and hedging transactions with, or for, Related Entities that are not Financial "
        + "Institutions, and does not provide financing or hedging services to any Entity that is not a Related Entity, provided that the group "
        + "of any such Related Entities is primarily engaged in a business other than that of a Financial Institution; or", "Treasury centre that is a member of a non-financial group:"),
      item("h.", "The NFE meets all of the following requirements:", "Charity or non-profit organisation:"),
      item("i.", "it is established and operated in its jurisdiction of residence exclusively for religious, charitable, scientific, artistic, "
        + "cultural, athletic, or educational purposes; or it is established and operated in its jurisdiction of residence and it is a "
        + "professional organisation, business league, chamber of commerce, labour organisation, agricultural or horticultural organisation, "
        + "civic league or an organisation operated exclusively for the promotion of social welfare;", undefined, 2),
      item("ii.", "it is exempt from income tax in its jurisdiction of residence;", undefined, 2),
      item("iii.", "it has no shareholders or members who have a proprietary or beneficial interest in its income or assets;", undefined, 2),
      item("iv.", "the applicable laws of the NFE’s jurisdiction of residence or the NFE’s formation documents do not permit any income or assets "
        + "of the NFE to be distributed to, or applied for the benefit of, a private person or non- charitable Entity other than pursuant to the "
        + "conduct of the NFE’s charitable activities, or as payment of reasonable compensation for services rendered, or as payment "
        + "representing the fair market value of property which the NFE has purchased; and", undefined, 2),
      item("v.", "the applicable laws of the NFE’s jurisdiction of residence or the NFE’s formation documents require that, upon the NFE’s "
        + "liquidation or dissolution, all of its assets be distributed to a Governmental Entity or other non-profit organisation, or escheat to "
        + "the government of the NFE’s jurisdiction of residence or any political subdivision thereof.", undefined, 2),
    ],
  },
  {
    term: "Controlling Person",
    lines: [
      said("A Controlling Person means the ultimate natural persons who exercise direct or indirect control over an entity. In the case of a "
        + "trust, such term means the settlor(s), the trustees(s), the protector(s) (if any), the beneficiary(ies) or class(es) of "
        + "beneficiaries, and any other natural person(s) exercising ultimate effective control over the trust, and in the case of a legal "
        + "arrangement other than a trust, such term means persons in equivalent or similar positions. The term 'Controlling Person' shall be "
        + "interpreted in a manner consistent with the Recommendations of the Financial Action Task Force (“FATF”), detailed as follows:"),
      { text: "For legal persons", heading: true },
      item("•", "For an Entity that is a legal person, the term “Controlling Persons” means the natural person(s) who ultimately has a controlling "
        + "ownership interest in the Entity. A “controlling ownership interest” depends on the ownership structure of the legal person. This may "
        + "be identified based on a threshold e.g., any person(s) owning more than a certain percentage of the legal person, such as 25%."),
      item("•", "Where no natural person(s) exercises control through ownership interests, the Controlling Person(s) of the Entity will be the "
        + "natural person(s) who exercises control of the Entity through other means."),
      item("•", "Where no natural person(s) is identified as exercising control of the Entity, the Controlling Person(s) of the Entity will be the "
        + "natural person(s) who holds the position of senior managing official."),
      { text: "For trusts", heading: true },
      said("“Controlling Persons” means the settlor(s), the trustee(s), the protector(s) (if any), the beneficiary(ies) or class(es) of "
        + "beneficiaries, and any other natural person(s) exercising ultimate effective control over the trust (including though a chain of "
        + "control/ownership)."),
      { text: "Other types of legal arrangements (no-trust)", heading: true },
      said("“Controlling Persons” means persons in equivalent or similar positions."),
    ],
  },
  {
    term: "Established securities market",
    lines: [said("An established securities market generally means an exchange that is officially recognised and supervised by a governmental "
      + "authority in which the market is located, and that has an annual value of shares traded on the exchange (or a predecessor exchange) "
      + "exceeding US$1,000,000,000 during each of the three calendar years immediately preceding the calendar year in which the determination "
      + "as to whether the exchange is an established securities market is being made.")],
  },
  {
    term: "Financial Institution (FI)",
    lines: [
      said("An FI means a Custodial Institution, a Depository Institution, an Investment Entity, or a Specified Insurance Company."),
      item("a.", "means any entity that holds, as a substantial portion of its business, financial assets for the account of others. An entity "
        + "holds financial assets for the account of others as a substantial portion of its business if the entity’s gross income attributable "
        + "to the holding of financial assets and related financial services equals or exceeds 20 percent of the Entity’s gross income during "
        + "the shorter of: (i) the three-year period that ends on 31 December (or the final day of a non-calendar year accounting period) prior "
        + "to the year in which the determination is being made; or (ii) the period during which the entity has been in existence;", "Custodial Institution"),
      item("b.", "means any entity that accepts deposits in the ordinary course of a banking or similar business;", "Depository Institution"),
      item("c.", "means:", "Investment Entity"),
      item("◦", "An entity that primarily conducts as a business one or more of the following activities or operations for or on behalf of a "
        + "customer:", undefined, 2),
      item("–", "trading in money market instruments (cheques, bills, certificates of deposit, derivatives, etc.); foreign exchange; exchange, "
        + "interest rate and index instruments; transferable securities; or commodity futures trading;", undefined, 3),
      item("–", "individual and collective portfolio management; or", undefined, 3),
      item("–", "otherwise investing, administering, or managing Financial Assets or money on behalf of other persons;", undefined, 3),
      {
        text: "An entity is treated as primarily conducting as a business one or more of the activities described above if the entity’s gross "
          + "income from conducting the relevant activities is at least 50% of the entity’s gross income during the shorter of: (i) the "
          + "three-year period ending on 31 December of the year preceding the year in which the determination of status of the entity is made; "
          + "or (ii) the period during which the entity has been in existence.",
        marker: "",
        depth: 2,
      },
      { text: "or", marker: "", depth: 2, italic: true },
      item("◦", "An entity, the gross income of which is primarily attributable to investing, reinvesting, or trading in Financial Assets, if the "
        + "entity is managed by another entity that is a Depository Institution, a Custodial Institution, a Specified Insurance Company, or an "
        + "Investment Entity described above. An entity’s gross income is primarily attributable to investing, reinvesting, or trading in "
        + "Financial Assets if the entity’s gross income from conducting the relevant activities is at least 50% of the entity’s gross income "
        + "during the shorter of: (i) the three-year period ending on 31 December of the year preceding the year in which the determination of "
        + "status of the entity is made; or (ii) the period during which the entity has been in existence.", undefined, 2),
      item("d.", "means any entity that is an insurance company (or the holding company of an insurance company) that issues, or is obligated to "
        + "make payments with respect to, a Cash Value Insurance Contract or an Annuity Contract.", "Specified Insurance Company"),
    ],
  },
  {
    term: "Financial Account",
    lines: [said("A Financial Account is an account maintained by a Financial Institution and includes: Depository Accounts; Custodial Accounts; "
      + "Equity and debt interest in certain Investment Entities; Cash Value Insurance Contracts; and Annuity Contracts.")],
  },
  NON_PARTICIPATING,
  PARTICIPATING,
  {
    term: "Passive Non-Financial Entity (NFE)",
    lines: [said("A Passive NFE means any NFE that is not an Active NFE, or an Investment Entity located in a Non-Participating Jurisdiction and "
      + "managed by another Financial Institution.")],
  },
  {
    term: "Related Entity",
    lines: [said("An Entity is a Related Entity of another entity if – (i) one entity controls the other entity; or (ii) the two entities are "
      + "controlled by the same person. For this purpose, control includes direct or indirect ownership of more than 50% of the vote and value "
      + "in an Entity.")],
  },
  {
    term: "Reportable Account",
    lines: [said("A Reportable Account is a Financial Account that, pursuant to due diligence procedures consistent with CRS, has been identified "
      + "as an account that is held by one or more persons that are Reportable Persons with respect to another Jurisdiction, or by a Passive NFE "
      + "with one or more Controlling Persons that are Reportable Persons with respect to another Jurisdiction.")],
  },
  REPORTABLE_JURISDICTION,
  REPORTABLE_JURISDICTION_PERSON,
  reportablePerson("–"),
  TIN,
];
