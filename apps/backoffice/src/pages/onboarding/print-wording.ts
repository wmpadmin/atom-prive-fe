/**
 * The paragraphs of the firm's Client Details & Risk Profiling Questionnaire that are read and signed rather than
 * answered (24 Nov 2026), word for word as printed. The printed copy puts each where the paper has it: the data
 * protection statement and declaration after every client's details, the risk declarations after every questionnaire.
 */

export const DOCUMENT_TITLE = "Client Details & Risk Profiling Questionnaire";

export const CLIENT_DETAILS_NOTE = "Note: The form needs to be completed by each individual client separately.";

export const PEP_NOTE = "A Politically Exposed Person is a person with prominent public function e.g. head of state or of government, "
  + "senior politician, senior government, judicial or military official, ambassador, senior executive of a state-owned "
  + "entity or an important or senior political party official.";

export const DATA_PROTECTION_STATEMENT =
  "In order to provide you with products and services we need to collect, use, share and store personal and financial information about you. "
  + "This includes the information requested on this form and information obtained from third parties. The information requested may be used to "
  + "assist us in providing the service you are applying for, to advise you of other products and services, to confirm, update and enhance "
  + "records and to establish your identity. The data that we collect may be shared / transferred to / or stored / or processed at our offices "
  + "in other countries outside UAE, to those who provide products or services (such as financial institutions and fiduciary service "
  + "providers), regulatory authorities, governmental or quasi-governmental organisations.";

export const CLIENT_DECLARATION = [
  "I confirm that all the assets / funds to be invested upon advice / arrangements by you have been lawfully acquired and are not derived "
    + "from, either directly or indirectly, or otherwise connected with any criminal or unlawful activity. I declare to act on my own behalf.",
  "I declare that the above-mentioned information is true and correct to the best of my knowledge and it has been made in good faith. I accept "
    + "that you will rely on such information to fulfil all regulatory requirements and agree to indemnify the Investment Advisor in case of any "
    + "liability arising from this reliance or misrepresentation on my part in the information provided.",
  "I confirm that I have net assets in excess of $1 million, and have sufficient experience and understanding of relevant financial markets, "
    + "products and transactions and the associated risks. Therefore, I accept my classification as a Professional Client.",
];

export const RISK_INTRODUCTION = [
  "In providing the Advisory Services under this Agreement, pursuant to Rule 3.4 of the COB and in order to ensure we act in your best "
    + "interests, we have to gather information from you about your knowledge and experience of the investment field which applies to the "
    + "specific type of service we are providing to you. We also have to gather information about your financial situation, your investment "
    + "needs and objectives and your attitude to risk and willingness to bear losses. This is so that we can assess the suitability of our "
    + "advice or recommendation for you. In particular, we need this information so we can understand your financial objectives and risk "
    + "appetite and have good reason to believe that such a recommendation is suitable for you. For the purposes of the assessment described "
    + "above, we will rely on the information given when assessing the suitability and appropriate levels of explanation to be given to you.",
  "We may ask you to complete, update and/or reconfirm this Questionnaire periodically as part of our ongoing suitability assessment process. "
    + "However, should there be any material change to your financial situation/ objectives, please notify us immediately so as to allow us to "
    + "accurately reassess your risk profile and suitability.",
  "We will consider the suitability of investments for you when giving advice or making a recommendation, however, all decisions whether to "
    + "invest in, hold or dispose of any asset or investment or incur any liabilities are solely your decisions. You can choose to invest "
    + "against our advice and you have the right to decline to follow our advice. Therefore, even after we recommend any product/ transaction, "
    + "you should consider if you are comfortable with the features and risks of that investment product/ transaction before making any "
    + "decision to invest.",
];

/** VI. The client's declaration; the second paragraph has the line the assigned profile is written on. */
export const RISK_DECLARATION = {
  confirm: "I/We, hereby confirm, that the information furnished in the above questionnaire is materially correct and is a true reflection of my risk attitude.",
  assignedBefore: "I/We agree with the Risk Profile/ Suitability Assessment assigned as",
  assignedAfter: "and understand that this profile will be considered in determining the suitability of any advice or recommendation and I/We "
    + "acknowledge that I do understand the Risks associated with the assigned profile.",
  rest: [
    "I/We understand and acknowledge that the recommendations provided by the Investment Advisor are of an advisory nature and I/we shall "
      + "exercise due judgement when making any decisions and/or entering into any transactions based on these recommendations.",
    "I/We also agree to notify the Investment Advisor of any material change in the legal entity that I represent or in my/our situation, "
      + "circumstances and/or investment profile.",
    "I/We acknowledge and understand that any statements of financial goal or objectives provided by me/us does not make or imply any "
      + "undertaking, agreement or guarantee by you as to the attainment or the feasibility of attainment of such goals or objectives.",
  ],
};

/*
 * The firm's Client Details & Risk Profiling Questionnaire – Entity (25 Nov 2026), word for word as printed: the
 * company's declaration after Schedule 2(A), each beneficial owner's after Schedule 2(B), and the questionnaire's.
 */
export const ENTITY_DOCUMENT_TITLE = "Client Details & Risk Profiling Questionnaire – Entity";

export const OWNER_DETAILS_NOTE = "Note: The form needs to be completed for each beneficial owner separately.";

export const ENTITY_DECLARATION = [
  "We confirm that all the assets / funds to be invested upon advice / arrangements by you have been lawfully acquired and are not derived "
    + "from, either directly or indirectly, or otherwise connected with any criminal or unlawful activity.",
  "We declare that the above-mentioned information is true and correct to the best of our knowledge and it has been made in good faith. We "
    + "accept that you will rely on this information to fulfil all of its regulatory requirements.",
  "We confirm that in the event the company is an Operating company, it has net assets exceeding $1 million (or its equivalent in foreign "
    + "currency) in the company's most recent balance sheet. Therefore, we accept classification as Professional Client.",
];

export const OWNER_DECLARATION = [
  "I confirm that all the assets / funds to be invested upon advice / arrangements by you have been lawfully acquired and are not derived "
    + "from, either directly or indirectly, or otherwise connected with any criminal or unlawful activity. I declare to act on my own behalf.",
  "I declare that the above mentioned information is true and correct to the best of my knowledge and it has been made in good faith. I "
    + "accept that you will rely on such information to fulfil all regulatory requirements.",
  "I confirm that I have net assets in excess of $1 million, and have sufficient experience and understanding of relevant financial "
    + "markets, products and transactions and the associated risks. Therefore I accept my classification as a Professional Client.",
];

/** v. of the entity's questionnaire: the second paragraph has the line the assigned profile is written on. */
export const ENTITY_RISK_DECLARATION = {
  confirm: "I/We, hereby confirm, that the information furnished in the above questionnaire is materially correct and is a true reflection of "
    + "the risk attitude of the legal entity that I/we represent.",
  assignedBefore: "I/We agree with the Risk Profile assigned as",
  assignedAfter: "and understand that this profile will be considered in determining the suitability of any advice or recommendation and I/we "
    + "acknowledge that I/we do understand the Risks associated with the assigned profile.",
  rest: [
    "I/We also agree to notify the Investment Advisor of any material change in the legal entity that I/we represent or in its situation, "
      + "circumstances and/or investment profile.",
    "I/We acknowledge and understand that any statements of financial goal or objectives provided by me/us does not make or imply any "
      + "undertaking, agreement or guarantee by you as to the attainment or the feasibility of attainment of such goals or objectives.",
  ],
};

/*
 * The CRS / FATCA Self-Certification Forms (v. Oct 2025, 25 Nov 2026), word for word as printed: the opening page, and
 * each form's declaration and signature.
 */
/** The forms' own names, as their banners print them. */
export const SELF_CERT_TITLE = {
  individual: "Self-Certification Form – Individual",
  entity: "Self-Certification Form – Company / Legal Entity / Corporate Structure",
};

export const SELF_CERT_INTRODUCTION = [
  "Under the direction of the Organisation of Economic Cooperation and Development (OECD), many participating jurisdictions have committed to, "
    + "and are establishing, a global standard for the Automatic Exchange of Financial Account Information based on the Common Reporting Standard "
    + "(CRS) to obtain and exchange financial account information of overseas taxpayers on an annual basis. The Investment Advisor is committed to "
    + "complying with its obligations under CRS and other tax compliance regimes, including the United States (US) Foreign Account Tax Compliance "
    + "Act (FATCA) provisions. Like the industry at large, the Investment Advisor may be required to collect certain tax-related information and/or "
    + "documents from clients. In certain circumstances, the Investment Advisor will be required to report and share such information and/or "
    + "documents with the appropriate tax authorities in compliance with CRS, FATCA and any applicable intergovernmental agreements (IGAs) entered "
    + "into between jurisdictions. These explanatory notes are not a substitute for understanding the requirements of the CRS and FATCA regulations.",
  "Further details on the CRS may be found within the OECD CRS for Automatic Exchange of Information (AEOI), the associated Commentary to the CRS "
    + "and domestic guidance. Further details on FATCA may be found on the US Internal Revenue Service (IRS) website.",
];

/** Set apart in the paper's yellow box. */
export const SELF_CERT_NOTE = "Please note that this document does not constitute tax or legal advice. The Investment Advisor does not and cannot "
  + "provide tax or legal advice. If you have any questions about this Form or FATCA/CRS, please contact your tax, legal and/or other professional advisor.";

export const SELF_CERT_WHO = {
  individual: "Please complete this Form if you are an Individual (including a sole proprietor) Account Holder. For joint or multiple Account "
    + "Holders, please use a separate Form for each Individual Account Holder. If you are an Entity Account Holder or a Controlling Person of an "
    + "Entity Account Holder, do not use this Form. Instead, complete the Self-Certification Form (Company/Legal Entity/Corporate Structure). If you "
    + "are a US Person under US regulations, you also will need to fill in and provide an IRS Form W9, in addition to this Form.",
  entity: "Please complete this Form if you are an Entity Account Holder. If you are an Individual (including a sole proprietor) Account Holder, "
    + "do not use this Form. Instead, complete the Self-Certification Form (Individual). If you are a US Person under US regulations, you also will "
    + "need to fill in and provide an IRS Form W9, in addition to this Form.",
};

const sharing = (whose: string, holder: string) => [
  `I understand that this Self-Certification and the information supplied in it is subject to the terms and conditions governing ${whose} relationship with the Investment Advisor.`,
  `I acknowledge that the information contained in this Form and information regarding ${holder} and any Reportable Account(s) may be provided, `
    + "directly or indirectly, to any relevant tax authority, including the tax authorities of the country/jurisdiction in which this account(s) "
    + "is/are maintained and exchanged with tax authorities of another country/jurisdiction or countries/jurisdictions in which the "
    + `${whose === "the Account Holder's" || whose === "the Company/Legal Entity/Corporate Structure's" ? "Account Holder" : "Controlling Person"} may be resident for tax purposes, `
    + "pursuant to bilateral or multilateral agreements between governments to exchange financial account information.",
];

export const SELF_CERT_DECLARATION = {
  individual: {
    statement: sharing("the Account Holder's", "the Account Holder"),
    certification: [
      "I certify that I am the Account Holder / I am authorised to complete and sign this Self-Certification for the Account Holder of all of the account(s) to which this Self-Certification relates.",
      "I declare that all statements made in this declaration are, to the best of my knowledge and belief, correct and complete.",
      "I undertake to notify the recipient of this Self-Certification within 30 days of any change in circumstances which affects the tax residency "
        + "status of the Account Holder or which causes the information contained herein to become incorrect, to submit a suitably updated Form within "
        + "30 days of such change, and to provide any additional information as may be required by the Investment Advisor and/or applicable law.",
    ],
    signature: "Signature of Account Holder (or individual authorised to sign for the Account Holder)",
    printName: "Full name of Account Holder (or individual authorised to sign for the Account Holder)",
    capacity: "Capacity of the individual authorised to sign for the Account Holder (where applicable)",
  },
  entity: {
    statement: sharing("the Company/Legal Entity/Corporate Structure's", "the Company/Legal Entity/Corporate Structure"),
    certification: [
      "I certify that I am authorised to complete and sign this Self-Certification for the Account Holder of all of the account(s) to which this Self-Certification relates.",
      "I declare that all statements made in this declaration are, to the best of my knowledge and belief, correct and complete.",
      "I undertake to notify the recipient of this Self-Certification within 30 days of any change in circumstances which affects the tax residency "
        + "status of the Account Holder or which causes the information contained herein to become incorrect (including any changes to the "
        + "information on Controlling Persons identified in Part 3, if applicable), to submit a suitably updated Form within 30 days of such change, "
        + "and to provide any additional information as may be required by the Investment Advisor and/or applicable law.",
    ],
    signature: "Signature of Account Holder (or individual authorised to sign for the Account Holder)",
    printName: "Full name of individual authorised to sign for the Account Holder",
    capacity: "Capacity of the individual authorised to sign for the Account Holder",
  },
  controller: {
    statement: sharing("the Account Holder's", "the Account Holder, Controlling Person").map((one) => one.replace("Account Holder may be resident", "Controlling Person may be resident")),
    certification: [
      "I certify that I am the Controlling Person, Account Holder, or am authorised to complete and sign this Self-Certification for the Controlling "
        + "Person, of all of the account(s) to which this Self-Certification relates.",
      "I declare that all statements made in this declaration are, to the best of my knowledge and belief, correct and complete.",
      "I undertake to notify the recipient of this Self-Certification within 30 days of any change in circumstances which affects the tax residency "
        + "status of the Controlling Person or which causes the information contained herein to become incorrect, to submit a suitably updated Form "
        + "within 30 days of such change, and to provide any additional information as may be required by the Investment Advisor and/or applicable law.",
    ],
    signature: "Signature of Controlling Person, Account Holder, or individual authorised to sign for the Controlling Person",
    printName: "Full name of individual",
    capacity: "Capacity of the individual authorised to sign for the Controlling Person",
  },
};

export const SELF_CERT_WARNING = "Please note that in providing this Self-Certification, a statement that is false, misleading or incorrect may be "
  + "regarded as an offence and therefore may be subject to penalties under relevant law or regulation.";
