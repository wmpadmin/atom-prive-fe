import { describe, expect, it } from "vitest";
import { emptyDetails, emptyHolder, emptyProfile, HOLDER_STEPS, newApplication, reviewApplication, stepOfField, toForm, type FormApplication } from "./application";

/** A joint account of two, named and otherwise blank. */
function joint(): FormApplication {
  const application = newApplication();
  application.holders = ["Asha Verma", "Vikram Verma"].map((fullName) => ({ ...emptyHolder(), fullName }));
  return application;
}

const stepsOf = (application: FormApplication, holder: number) =>
  reviewApplication(application, undefined).steps.filter((step) => step.id.startsWith(`holder-${holder}-`));

describe("skipping a joint holder's details (24 Nov 2026)", () => {
  it("leaves the joint holder's ten steps complete and marked skipped", () => {
    const application = joint();
    expect(stepsOf(application, 1).every((step) => step.complete)).toBe(false);
    application.holders[1]!.details = { ...emptyDetails(), skipped: true };
    const steps = stepsOf(application, 1);
    expect(steps.map((step) => step.id)).toEqual(HOLDER_STEPS.map(([part]) => `holder-1-${part}`));
    expect(steps.every((step) => step.complete && step.skipped)).toBe(true);
  });

  it("still needs their name, and checks an email that is given", () => {
    const application = joint();
    application.holders[1] = { ...application.holders[1]!, fullName: " ", email: "not an email", details: { ...emptyDetails(), skipped: true } };
    const problems = Object.keys(reviewApplication(application, undefined).problems).filter((field) => field.startsWith("holders[1]."));
    expect(problems).toEqual(["holders[1].fullName", "holders[1].email"]);
  });

  it("never skips the primary holder", () => {
    const application = joint();
    application.holders[0]!.details = { ...emptyDetails(), skipped: true };
    expect(stepsOf(application, 0).some((step) => step.skipped)).toBe(false);
    expect(stepsOf(application, 0).some((step) => !step.complete)).toBe(true);
  });

  it("is read back from a saved application", () => {
    const saved = { clientType: "INDIVIDUAL", holders: [{ fullName: "Asha Verma" }, { fullName: "Vikram Verma", details: { skipped: true } }] };
    const form = toForm(saved as never);
    expect(form.holders[1]!.details.skipped).toBe(true);
    expect(form.holders[0]!.details.skipped).toBe(false);
  });
});

describe("Schedule 2's second page (24 Nov 2026)", () => {
  const problemsOf = (application: FormApplication, step: string) =>
    reviewApplication(application, undefined).steps.find((one) => one.id === step)?.fields ?? [];

  it("asks every question, and takes Other written in for a box", () => {
    const application = joint();
    const at = "holders[0].details.profile.";
    expect(problemsOf(application, "holder-0-experience")).toEqual([`${at}knowledge`, `${at}activeFor`, `${at}managedBy`, `${at}products`, `${at}decisions`]);
    application.holders[0]!.details.profile = { ...emptyProfile(), knowledgeOther: "Studied finance", activeFor: "FROM_3_TO_5_YEARS",
      managedBy: "BY_MYSELF", products: ["SHARES"], decisions: "MONTHLY" };
    expect(problemsOf(application, "holder-0-experience")).toEqual([]);
  });

  it("names somebody and their function only for a Yes", () => {
    const application = joint();
    const at = "holders[0].details.profile.";
    application.holders[0]!.details.profile = { ...emptyProfile(), pep: false };
    expect(problemsOf(application, "holder-0-pep")).toEqual([]);
    application.holders[0]!.details.profile = { ...emptyProfile(), pep: true };
    expect(problemsOf(application, "holder-0-pep")).toEqual([`${at}pepPeople[0].name`, `${at}pepPeople[0].function`]);
  });

  it("opens the step a server problem belongs to", () => {
    expect(stepOfField("holders[1].details.profile.netWealth")).toBe("holder-1-wealth");
    expect(stepOfField("holders[0].details.profile.pepPeople[0].name")).toBe("holder-0-pep");
    expect(stepOfField("holders[0].residentialAddress.line1")).toBe("holder-0-address");
    expect(stepOfField("holders[0].email")).toBe("holder-0-contact");
    expect(stepOfField("holders[0].details.citizenship")).toBe("holder-0-nationality");
  });
});
