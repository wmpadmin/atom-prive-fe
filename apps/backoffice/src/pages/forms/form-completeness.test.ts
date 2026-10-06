import { describe, expect, it } from "vitest";
import spec from "./form-completeness.json";
import {
  accountOpeningIndividualKit,
  accountOpeningKit,
  clientClassificationKit,
  customerIdentificationKit,
  dfsaChecklistIndividualKit,
  dfsaChecklistKit,
  dueDiligenceIndividualKit,
  dueDiligenceKit,
  fatcaCrsIndividualKit,
  fatcaCrsKit,
  professionalClientConfirmationKit,
  riskProfileKit,
} from "./form-kits";

/**
 * What counts as a finished part of a form, checked against the one place it is written down.
 *
 * <p>These rules exist twice: here, where they tick the rail as somebody types, and on the server, where they
 * decide whether a form is finished and goes to the advisor to be signed. Neither can be deleted — one is
 * live and the other is authoritative — so form-completeness.json is the specification both follow, and each
 * side has a test holding it to it. A rule changed on one side and not the other used to be found by
 * somebody filling a form in and watching it refuse to go green.
 *
 * <p>The same cases run against the Java rules in FormCompletenessSpecTests. When a rule changes, change the
 * specification first, then make both sides agree with it.
 */

// The kind the API names, against the kit that fills that form in.
const kits: Record<string, { toValue: (answers: never) => never; review: (value: never, provided: ReadonlySet<string>) => { steps: { id: string; complete: boolean }[] } }> = {
  ACCOUNT_OPENING_ENTITY: accountOpeningKit,
  ACCOUNT_OPENING_INDIVIDUAL: accountOpeningIndividualKit,
  CUSTOMER_DUE_DILIGENCE_ENTITY: dueDiligenceKit,
  CUSTOMER_DUE_DILIGENCE_INDIVIDUAL: dueDiligenceIndividualKit,
  CUSTOMER_IDENTIFICATION_INDIVIDUAL: customerIdentificationKit,
  FATCA_CRS_ENTITY: fatcaCrsKit,
  FATCA_CRS_INDIVIDUAL: fatcaCrsIndividualKit,
  PROFESSIONAL_CLIENT_CONFIRMATION_JOINT: professionalClientConfirmationKit,
  DFSA_ONBOARDING_CHECKLIST_ENTITY: dfsaChecklistKit,
  DFSA_ONBOARDING_CHECKLIST_INDIVIDUAL: dfsaChecklistIndividualKit,
  CLIENT_CLASSIFICATION: clientClassificationKit,
  INVESTMENT_RISK_PROFILE: riskProfileKit,
} as never;

describe("the completeness specification", () => {
  it("has cases to check", () => {
    expect(spec.cases.length).toBeGreaterThan(0);
  });

  for (const one of spec.cases) {
    it(one.name, () => {
      const kit = kits[one.kind];
      expect(kit, `no kit fills in ${one.kind}`).toBeDefined();

      const review = kit.review(kit.toValue(one.answers as never), new Set(one.provided));
      const verdict = Object.fromEntries(review.steps.map((step) => [step.id, step.complete]));

      expect(verdict).toEqual(one.sections);
    });
  }
});
