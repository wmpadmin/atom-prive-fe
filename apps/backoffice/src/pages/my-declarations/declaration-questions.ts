/**
 * Where the live parts of each declaration sit inside the document. Every word the employee reads is the
 * firm's own, printed from the document itself; what is set out here is only which answer each box the
 * paper prints stands for, and which blank takes what — so nothing is ever asked twice or reworded.
 */

/** What one of the boxes the paper prints stands for. */
export type Box =
  /** One of a run of boxes offering a choice. */
  | { id: string; value: string; then?: Blank }
  /** One half of a YES / NO pair. */
  | { id: string; yes: boolean }
  /** Printed by the paper, but not the employee's to tick — a manager's or Compliance's box. */
  | null;

/** A blank the paper leaves for something to be written in. */
export interface Blank {
  id: string;
  kind: "text" | "long";
}

/**
 * Every box each document prints, in the order it prints them: down the page, row by row, cell by cell.
 * The count has to match the document exactly, which {@link declarationBoxes} is checked against.
 */
export const declarationBoxes: Record<string, Box[]> = {
  CONFLICT_OF_INTEREST: [
    { id: "assessment", value: "NO_RISK" },
    { id: "assessment", value: "RISK_IDENTIFIED" },
    { id: "reviewWithin", value: "ONE_MONTH" },
    { id: "reviewWithin", value: "THREE_MONTHS" },
    { id: "reviewWithin", value: "SIX_MONTHS" },
    { id: "reviewWithin", value: "TWELVE_MONTHS" },
    { id: "reviewWithin", value: "ONE_OFF" },
    { id: "reviewWithin", value: "OTHER", then: { id: "reviewOther", kind: "text" } },
  ],
  AML_PROCEDURES_CERTIFICATION: [
    { id: "acknowledgement", value: "NEW_JOINER" },
    { id: "acknowledgement", value: "ANNUAL" },
  ],
  COMPLIANCE_MANUAL_CERTIFICATION: [
    { id: "acknowledgement", value: "NEW_JOINER" },
    { id: "acknowledgement", value: "ANNUAL" },
  ],
  OUTSIDE_INTERESTS: [
    { id: "questions.A1.held", yes: true }, { id: "questions.A1.held", yes: false },
    { id: "questions.A2.held", yes: true }, { id: "questions.A2.held", yes: false },
    { id: "questions.A3.held", yes: true }, { id: "questions.A3.held", yes: false },
    { id: "questions.A4.held", yes: true }, { id: "questions.A4.held", yes: false },
    { id: "questions.A5.held", yes: true }, { id: "questions.A5.held", yes: false },
    { id: "questions.A6.held", yes: true }, { id: "questions.A6.held", yes: false },
    { id: "questions.A7.held", yes: true }, { id: "questions.A7.held", yes: false },
    // Sections B and D are the manager's to complete, so their boxes are printed but not offered.
    null, null, null, null, null, null, null, null, null, null,
  ],
  FIT_AND_PROPER: Array.from({ length: 13 }, (_, at) => [
    { id: `questions.${at + 1}`, yes: true },
    { id: `questions.${at + 1}`, yes: false },
  ]).flat(),
  PERSONAL_ACCOUNT_DEALING: [
    { id: "declaration", value: "NEW_JOINER" },
    { id: "declaration", value: "ANNUAL" },
    { id: "transactionsUndertaken", yes: true },
    { id: "transactionsUndertaken", yes: false },
  ],
  // The three ticks on the DFSA conduct principles are the paper's own: the undertaking is the whole form.
  DFSA_CONDUCT_PRINCIPLES: [null, null, null],
  AUTHORISED_INDIVIDUALS: [],
  DATA_CONSENT: [],
};

/**
 * What the employee writes into the blanks the paper leaves, keyed by the printed row it follows —
 * "block.row", counting from the top of the document.
 */
export const declarationBlanks: Record<string, Record<string, Blank>> = {
  CONFLICT_OF_INTEREST: {
    "4.3": { id: "conflictType", kind: "long" },
    "4.6": { id: "managementPlan", kind: "long" },
  },
  OUTSIDE_INTERESTS: {
    "4.3": { id: "questions.A1.details", kind: "long" },
    "4.7": { id: "questions.A2.details", kind: "long" },
    "5.3": { id: "questions.A3.details", kind: "long" },
    "5.7": { id: "questions.A4.details", kind: "long" },
    "5.10": { id: "questions.A5.details", kind: "long" },
    "5.14": { id: "questions.A6.details", kind: "long" },
    "5.18": { id: "questions.A7.details", kind: "long" },
  },
  PERSONAL_ACCOUNT_DEALING: {
    "3.1": { id: "transactions", kind: "long" },
  },
};

/** What each document calls its own signing lines. */
export interface SigningLines {
  name: string;
  signature: string;
  date: string;
  /** Some of them ask for the signer's position too, under their own name for it. */
  position?: string;
}

export const signingLines: Record<string, SigningLines> = {
  CONFLICT_OF_INTEREST: {
    name: "Employee name:",
    position: "Position Title:",
    signature: "Signature of Employee:",
    date: "Date:",
  },
  AML_PROCEDURES_CERTIFICATION: { name: "Name:", signature: "Signature:", date: "Date:" },
  AUTHORISED_INDIVIDUALS: { name: "Name:", signature: "Signature:", date: "Date:" },
  COMPLIANCE_MANUAL_CERTIFICATION: { name: "Name:", signature: "Signature:", date: "Date:" },
  OUTSIDE_INTERESTS: {
    name: "Employee name:",
    signature: "Signature of Declarant:",
    date: "Date:",
  },
  DFSA_CONDUCT_PRINCIPLES: { name: "Name:", position: "Position:", signature: "Signature:", date: "Date:" },
  DATA_CONSENT: { name: "Name:", position: "Position:", signature: "Signature:", date: "Date:" },
  FIT_AND_PROPER: { name: "Individual’s Name", signature: "Individual’s Signature", date: "Date" },
  PERSONAL_ACCOUNT_DEALING: {
    name: "Name of Staff",
    position: "Title",
    signature: "Individual’s signature:",
    date: "Date:",
  },
};

/**
 * The printed rows the signing block stands in for, keyed "block" or "block.row". The block is set out
 * where the document signs — the last of them — and the earlier ones are the same lines named again.
 */
export const signingRows: Record<string, string[]> = {
  CONFLICT_OF_INTEREST: ["2.0", "2.1", "5.3"],
  AML_PROCEDURES_CERTIFICATION: ["13", "14", "15"],
  AUTHORISED_INDIVIDUALS: ["6", "7", "8"],
  COMPLIANCE_MANUAL_CERTIFICATION: ["11", "12", "13"],
  OUTSIDE_INTERESTS: ["2.0", "7.0", "7.1", "7.2"],
  DFSA_CONDUCT_PRINCIPLES: ["7.0", "7.1", "7.2", "7.3"],
  DATA_CONSENT: ["6.0", "6.1", "6.2", "6.3"],
  FIT_AND_PROPER: ["6.0", "6.1", "6.2"],
  PERSONAL_ACCOUNT_DEALING: ["2.0", "2.1", "4.0", "4.1"],
};

/** The line the portal adds, so that signing says what it means. */
export const AGREED = "I have read the declaration above and make it.";
