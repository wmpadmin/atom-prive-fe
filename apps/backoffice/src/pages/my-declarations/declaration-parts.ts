/**
 * Each declaration in the parts it divides itself into, so it is read a part at a time the way the client's
 * forms are filled in a section at a time. Nothing is reworded or reordered: a part is named in the
 * document's own words, and the cut is made where the document starts a new section of its own.
 */

export interface DeclarationPart {
  id: string;
  /** The mark the paper puts against the part, where it marks one at all. */
  mark: string;
  /** What the document calls the part, in its own words. */
  label: string;
  /** Which of the document's blocks the part holds, by their place in it. */
  blocks: number[];
}

/** The step every declaration ends on: reading it through, agreeing to it and signing it. */
export const SIGN_STEP = "sign";

const through = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, at) => from + at);

export const declarationParts: Record<string, DeclarationPart[]> = {
  CONFLICT_OF_INTEREST: [
    { id: "about", mark: "—", label: "Conflict of Interest Declaration and Management Form", blocks: [0, 1, 2] },
    { id: "a", mark: "A", label: "Section A. Identification of a conflict of interest risk", blocks: [3] },
    { id: "b", mark: "B", label: "Section B. Conflict of interest management plan", blocks: [4] },
    { id: "c", mark: "C", label: "Section C. Declarations", blocks: [5] },
  ],
  AML_PROCEDURES_CERTIFICATION: [
    { id: "certification", mark: "—", label: "AML Procedures Certification", blocks: through(0, 12) },
  ],
  COMPLIANCE_MANUAL_CERTIFICATION: [
    {
      id: "certification",
      mark: "—",
      label: "Compliance Manual Certification (Annual / new Joinee)",
      blocks: through(0, 10),
    },
  ],
  AUTHORISED_INDIVIDUALS: [
    { id: "undertaking", mark: "—", label: "Authorised Individuals Declaration", blocks: through(0, 5) },
  ],
  DATA_CONSENT: [
    {
      id: "consent",
      mark: "—",
      label: "Employee’s Consent for Data Collection, Processing, Storage, Disclosure and Erasure",
      blocks: through(0, 5),
    },
  ],
  DFSA_CONDUCT_PRINCIPLES: [
    { id: "principles", mark: "—", label: "DFSA Conduct Principles for Individuals", blocks: through(0, 6) },
  ],
  FIT_AND_PROPER: [
    { id: "about", mark: "—", label: "Fit and Proper Declaration", blocks: [0, 1, 2] },
    { id: "questions", mark: "—", label: "Have you ever:", blocks: [3] },
    { id: "declaration", mark: "—", label: "Declaration by the Firm’s Employee:", blocks: [4, 5] },
  ],
  OUTSIDE_INTERESTS: [
    { id: "about", mark: "—", label: "Declaration and Management of Outside Interests Form", blocks: [0, 1, 2] },
    { id: "a", mark: "A", label: "Section A. Outside Business interests", blocks: [3, 4, 5, 6] },
    { id: "b", mark: "B", label: "Section B. Manager’s assessment and management plan", blocks: [8] },
    { id: "c", mark: "C", label: "Section C. Employee Declarations", blocks: [9] },
    { id: "d", mark: "D", label: "Section D. Manager Declaration", blocks: [10] },
  ],
  PERSONAL_ACCOUNT_DEALING: [
    { id: "declaration", mark: "—", label: "Personal Account Dealing Declaration", blocks: [0, 1, 3] },
  ],
};

/** Sections B and D of the outside interests form are the manager's, and C is signed after they have. */
export const notYoursToFillIn: Record<string, string[]> = {
  OUTSIDE_INTERESTS: ["b", "c", "d"],
};
