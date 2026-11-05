import type { FormDetailAnswers } from "@atomprive/api-client/backoffice";
import type { FormReview } from "./account-opening-entity";
import {
  emptyDueDiligence,
  sharedDueDiligenceProblems,
  sharedDueDiligenceSteps,
  toDueDiligence,
  type DueDiligenceShared,
} from "./customer-due-diligence";

/**
 * The individual's copy of the due diligence form. It is the entity's form with one table changed: the same 44
 * blocks in the same order, and SECTION 1 opens by asking about a person rather than a company. Everything
 * below that table is the same form, so it is the same code.
 */

/** SECTION 1's details table, line by line as the form rules it. */
export const customerLines = [
  { id: "fullName", label: "Full name or names:" },
  { id: "permanentAddress", label: "Permanent address:", multiline: true },
  { id: "residentialAddress", label: "Current residential address:", multiline: true },
  { id: "telephone", label: "Telephone:" },
  { id: "email", label: "Email:" },
  { id: "dateAndPlaceOfBirth", label: "Date and place of birth:" },
  { id: "nationality", label: "Nationality:" },
  { id: "dualCitizenship", label: "In case of dual citizenship, nationality:", optional: true },
  { id: "fiscalResidence", label: "Fiscal residence:" },
  { id: "occupation", label: "Occupation or profession:" },
  { id: "initialInvestment", label: "Estimated amount of initial investment (specify currency):" },
  { id: "expectedValuePerYear", label: "Expected investment value to be transacted each year" },
  { id: "originOfFunds", label: "Country and bank of origin of funds:" },
  {
    id: "purposeOfRelationship",
    label:
      "Information regarding the purpose, intended nature and level of services and transactions to be conducted with the Firm",
    multiline: true,
  },
  { id: "howIntroduced", label: "How was the individual introduced to the Firm" },
  { id: "relationshipManager", label: "Name of relationship manager:" },
] as const satisfies readonly { id: string; label: string; multiline?: boolean; optional?: boolean }[];

export type CustomerLine = (typeof customerLines)[number]["id"];

export type CustomerDetails = Record<CustomerLine, string> & {
  /** What is written on the rule the form leaves for the firm's own name. */
  firmName: string;
};

export type DueDiligenceIndividual = DueDiligenceShared & { customer: CustomerDetails };

export function emptyCustomerDetails(): CustomerDetails {
  const blank = Object.fromEntries(customerLines.map((line) => [line.id, ""])) as Record<CustomerLine, string>;
  return { ...blank, firmName: "" };
}

export function emptyDueDiligenceIndividual(): DueDiligenceIndividual {
  const { business: _business, ...shared } = emptyDueDiligence();
  return { ...shared, customer: emptyCustomerDetails() };
}

/** What the API holds, filled out to the whole form so every field has something to type into. */
export function toDueDiligenceIndividual(saved: FormDetailAnswers | undefined): DueDiligenceIndividual {
  const { business: _business, ...shared } = toDueDiligence(saved);
  const held = (saved ?? {}) as { customer?: Partial<CustomerDetails> };
  return { ...shared, customer: { ...emptyCustomerDetails(), ...held.customer } };
}

const REQUIRED = "This is needed.";

function none(problems: Record<string, string>, prefix: string) {
  return !Object.keys(problems).some((key) => key.startsWith(prefix));
}

/** What is still missing, and which parts that leaves incomplete. The API checks the same things on submit. */
export function reviewDueDiligenceIndividual(
  value: DueDiligenceIndividual,
  provided: ReadonlySet<string>,
): FormReview {
  const problems: Record<string, string> = {};
  for (const line of customerLines) {
    const optional = "optional" in line && line.optional;
    if (!optional && !value.customer[line.id].trim()) problems[`customer.${line.id}`] = REQUIRED;
  }
  if (!value.customer.firmName.trim()) problems["customer.firmName"] = REQUIRED;

  sharedDueDiligenceProblems(value, provided, problems);
  return {
    problems,
    steps: [
      { id: "customer", group: "SECTION 1", label: "The customer", complete: none(problems, "customer.") },
      ...sharedDueDiligenceSteps(problems),
    ],
  };
}

/** The part a field belongs to, so a message from the API opens the part that holds it. */
export function stepOfDueDiligenceIndividualField(field: string): string {
  if (field.startsWith("classification")) return "classification";
  if (field.startsWith("suitability") || field.startsWith("screening")) return "suitability";
  if (field.startsWith("wealth")) return "wealth";
  if (field.startsWith("risk")) return "risk";
  if (field.startsWith("review")) return "compliance";
  return "customer";
}

export const dueDiligenceIndividualDescriptions: Record<string, string> = {
  customer:
    "In order to satisfy the Firm’s requirements for onboarding an Individual Customer, please complete the below:",
  classification: "Client classification, and the evidence of documents obtained for Assessment as Professional Client.",
  suitability: "SUITABILITY ASSESSMENT, and SCREENING.",
  wealth: "",
  risk: "(To be completed by the RM from the AML Risk Rating Matrix sheet)",
  compliance: "(TO BE COMPLETED BY THE MLRO)",
};
