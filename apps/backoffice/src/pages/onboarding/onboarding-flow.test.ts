import { describe, expect, it } from "vitest";
import { emptyHolder, HOLDER_STEPS, newApplication, oneQuestionnaireEach, reviewApplication, tidy, type FormApplication } from "./application";
import { buildFlow, openingStep, shownHolders, type FlowStep } from "./onboarding-flow";
import { emptyRiskProfile, RISK_STEPS } from "./risk-profiling";

const REVIEW = { id: "review", group: "Finish", label: "Review & submit", complete: false, fields: [] };
// Each holder's self-certification after the questionnaires (25 Nov 2026).
const certSteps = (index: number) => [`holdercert-${index}-identification`, `holdercert-${index}-tax`];

/** Asha from Prospective Clients, with Vikram brought as a joint holder there unless left out. */
function fromProspect(withVikram = true): FormApplication {
  const application = newApplication();
  application.relationshipManagerId = "rm";
  application.holders = [{ ...emptyHolder(), fullName: "Asha Verma" }, ...(withVikram ? [{ ...emptyHolder(), fullName: "Vikram Verma" }] : [])];
  return application;
}

const flowOf = (application: FormApplication, added: number[] = []) =>
  buildFlow(application, reviewApplication(application, undefined).steps, { askClientType: false, added: new Set(added), finish: [REVIEW] });
const ids = (flow: FlowStep[]) => flow.map((step) => step.id);
const clientSteps = (index: number) => HOLDER_STEPS.map(([part]) => `holder-${index}-${part}`);
const riskSteps = (index: number) => RISK_STEPS.map(([part]) => `risk-${index}-${part}`);

describe("the onboarding pop-up's order (24 Nov 2026, the approved mockup)", () => {
  it("asks Client 1's ten sections, then whether there is another account holder, before anyone else", () => {
    const flow = flowOf(fromProspect());
    expect(ids(flow)).toEqual([...clientSteps(0), "more-0", ...riskSteps(0), ...certSteps(0), "signing", "review"]);
    expect(flow.find((step) => step.id === "more-0")).toMatchObject({ question: "more", group: "Client 1", label: "Asha Verma's details are in" });
  });

  it("opens Client 2 once added, and asks again after them; then each one's own risk questionnaire (25 Nov 2026)", () => {
    const flow = flowOf(oneQuestionnaireEach(fromProspect()), [1]);
    expect(ids(flow)).toEqual([...clientSteps(0), "more-0", ...clientSteps(1), "more-1", ...riskSteps(0), ...riskSteps(1), ...certSteps(0), ...certSteps(1), "signing", "review"]);
  });

  it("asks a skipped holder's risk questionnaire too, but not their details or self-certification", () => {
    const application = oneQuestionnaireEach(fromProspect());
    application.holders[1]!.details.skipped = true;
    expect(shownHolders(application, new Set())).toEqual([0]);
    expect(ids(flowOf(application))).toEqual([...clientSteps(0), "more-0", ...riskSteps(0), ...riskSteps(1), ...certSteps(0), "signing", "review"]);
  });

  it("keeps one questionnaire for each holder, named for them, and sends them so", () => {
    const application = fromProspect();
    application.holders.push({ ...emptyHolder(), fullName: "Kiran Verma" });
    const aligned = oneQuestionnaireEach(application);
    expect(aligned.riskProfiles.map((profile) => profile.filledInFor)).toEqual(["Asha Verma", "Vikram Verma", "Kiran Verma"]);
    expect(tidy(aligned).riskProfiles?.map((profile) => profile.filledInFor)).toEqual(["Asha Verma", "Vikram Verma", "Kiran Verma"]);
    // Nothing changes when they already match.
    expect(oneQuestionnaireEach(aligned)).toBe(aligned);
  });

  it("has no signing authority for one holder, and keeps a joint holder with details in without asking", () => {
    expect(ids(flowOf(fromProspect(false)))).not.toContain("signing");
    const application = fromProspect();
    application.holders[1]!.details.gender = "MALE";
    expect(shownHolders(application, new Set())).toEqual([0, 1]);
  });

  it("opens a draft at the question still to be answered when the clients are done and the questionnaire isn't started", () => {
    const application = fromProspect(false);
    const flow = flowOf(application).map((step) => (step.id.startsWith("holder-") ? { ...step, complete: true } : step));
    expect(openingStep(application, flow)).toBe("more-0");
    application.riskProfiles = [{ ...emptyRiskProfile(), filledInFor: "Asha Verma", education: "SECONDARY" }];
    expect(openingStep(application, flow)).toBe("risk-0-knowledge");
  });

  it("opens on the first screen of the client still to finish, even when their name came in already (25 Nov 2026)", () => {
    const application = fromProspect();
    const flow = flowOf(application, [1]).map((step) => (
      step.id.startsWith("holder-0-") || step.id === "holder-1-name" ? { ...step, complete: true } : step));
    expect(openingStep(application, flow)).toBe("holder-1-name");
  });
});
