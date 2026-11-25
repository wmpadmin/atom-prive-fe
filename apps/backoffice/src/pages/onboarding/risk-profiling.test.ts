import { describe, expect, it } from "vitest";
import { emptyHolder, newApplication, reviewApplication, stepOfField, tidy, toForm, type FormApplication } from "./application";
import { emptyRiskProfile, RISK_STEPS, riskScores, type FormRiskProfile } from "./risk-profiling";

/** Every letter the same, except where a question has no such answer. */
function answering(letter: string, overrides: Record<string, string> = {}): Record<string, string> {
  const answers: Record<string, string> = {};
  for (let question = 1; question <= 11; question++) answers[`q${question}`] = question === 3 && letter === "d" ? "e" : letter;
  return { ...answers, ...overrides };
}

const knowledgeOfAll = Object.fromEntries(
  ["moneyMarket", "fixedIncome", "equities", "mutualFunds", "hedgeFunds", "privateEquity", "structuredMinimum", "structuredParticipation",
    "forwards", "foreignCurrencies", "commodities", "realEstate", "emergingMarkets"].map((key) => [key, "KNOWLEDGE" as const]),
);

function answered(filledInFor: string, patch: Partial<FormRiskProfile> = {}): FormRiskProfile {
  return { ...emptyRiskProfile(), filledInFor, education: "DIPLOMA_OR_HIGHER", knowledge: knowledgeOfAll, answers: answering("c", { q11: "b" }), agrees: true, ...patch };
}

function individual(): FormApplication {
  const application = newApplication();
  application.holders = [{ ...emptyHolder(), fullName: "Asha Verma" }];
  return application;
}

const riskSteps = (application: FormApplication) => reviewApplication(application, undefined).steps.filter((step) => step.id.startsWith("risk-"));

describe("Schedule 6, the risk profiles (24 Nov 2026)", () => {
  it("starts with the holder's own: the paper's five steps, after the clients' details (25 Nov 2026: whose is never asked)", () => {
    const application = individual();
    const steps = riskSteps(application);
    expect(steps.map((step) => step.id)).toEqual(RISK_STEPS.map(([part]) => `risk-0-${part}`));
    expect(steps.every((step) => step.group === "Risk questionnaire 1")).toBe(true);
    // Then each holder's self-certification (25 Nov 2026).
    expect(reviewApplication(application, undefined).steps.slice(-3).map((step) => step.id)).toEqual(["risk-0-leverage", "holdercert-0-identification", "holdercert-0-tax"]);
  });

  it("asks every answer the paper does, but not the qualification or leverage", () => {
    const steps = riskSteps(individual());
    const fields = (part: string) => steps.find((step) => step.id === `risk-0-${part}`)?.fields ?? [];
    expect(fields("knowledge")).toHaveLength(1 + 13);
    expect(fields("knowledge").slice(0, 2)).toEqual(["riskProfiles[0].education", "riskProfiles[0].knowledge.moneyMarket"]);
    expect(fields("ability")).toEqual(["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => `riskProfiles[0].answers.${id}`));
    expect(fields("tolerance")).toEqual(["q7", "q8", "q9", "q10", "q11"].map((id) => `riskProfiles[0].answers.${id}`));
    expect(fields("result")).toEqual(["riskProfiles[0].agrees"]);
    expect(fields("leverage")).toEqual([]);
  });

  it("takes one for each account holder, each checked on its own", () => {
    const application = individual();
    application.holders.push({ ...emptyHolder(), fullName: "Vikram Verma" }, { ...emptyHolder(), fullName: "Kiran Verma" });
    application.riskProfiles = [answered("Asha Verma"), answered("Vikram Verma"), answered("Kiran Verma", { agrees: false })];
    const { problems, steps } = reviewApplication(application, undefined);
    expect(steps.filter((step) => step.id.startsWith("risk-")).map((step) => step.group)).toEqual(
      ["Risk questionnaire 1", "Risk questionnaire 2", "Risk questionnaire 3"].flatMap((group) => Array<string>(5).fill(group)),
    );
    expect(Object.keys(problems).filter((field) => field.startsWith("riskProfiles"))).toEqual(["riskProfiles[2].preferredProfile"]);
    expect(problems["riskProfiles[2].preferredProfile"]).toBe("Choose the risk profile the client prefers.");
  });

  it("has no fourth answer to Retirement Coverage", () => {
    const application = individual();
    application.riskProfiles = [answered("Asha Verma", { answers: answering("c", { q3: "d" }) })];
    expect(reviewApplication(application, undefined).problems).toMatchObject({ "riskProfiles[0].answers.q3": "Choose an answer to Retirement Coverage." });
  });

  it("adds up both parts and reads the firm's matrix", () => {
    expect(riskScores(answered("A"))).toMatchObject({ ability: 30, tolerance: 14, abilityBand: "MEDIUM", toleranceBand: "MEDIUM", profile: "BALANCED" });
    expect(riskScores(answered("A", { answers: answering("a") }))).toMatchObject({ ability: 10, tolerance: 5, profile: "CONSERVATIVE" });
    expect(riskScores(answered("A", { answers: answering("e") }))).toMatchObject({ ability: 50, tolerance: 25, profile: "AGGRESSIVE" });
    // High ability with only Medium tolerance is Balanced, not Aggressive.
    expect(riskScores(answered("A", { answers: answering("e", { q7: "c", q8: "c", q9: "c", q10: "c", q11: "c" }) }))).toMatchObject({
      toleranceBand: "MEDIUM",
      profile: "BALANCED",
    });
    // Nothing is banded until every question of the part is answered.
    expect(riskScores(answered("A", { answers: { q1: "e" } }))).toMatchObject({ ability: 5, abilityBand: null, profile: null });
  });

  it("opens the step a server problem belongs to", () => {
    expect(stepOfField("riskProfiles")).toBe("risk-0-knowledge");
    expect(stepOfField("riskProfiles[1].filledInFor")).toBe("risk-1-knowledge");
    expect(stepOfField("riskProfiles[1].knowledge.forwards")).toBe("risk-1-knowledge");
    expect(stepOfField("riskProfiles[1].answers.q2")).toBe("risk-1-ability");
    expect(stepOfField("riskProfiles[1].answers.q9")).toBe("risk-1-tolerance");
    expect(stepOfField("riskProfiles[2].preferredProfile")).toBe("risk-2-result");
    expect(stepOfField("riskProfiles[2].leverageOther")).toBe("risk-2-leverage");
  });

  it("sends a preferred profile only after a No, and an entity's one questionnaire for it by name", () => {
    const application = individual();
    application.riskProfiles = [answered("Asha Verma", { preferredProfile: "CONSERVATIVE", answers: { ...answering("c"), q12: "a" } })];
    const sent = tidy(application).riskProfiles?.[0];
    expect(sent?.preferredProfile).toBeNull();
    expect(Object.keys(sent?.answers ?? {})).not.toContain("q12");
    // An entity keeps its own questionnaire, once, filled in for the entity (25 Nov 2026).
    const entity = tidy({ ...application, clientType: "ENTITY", entity: { ...application.entity, legalName: "Al Noor Holdings Ltd" } }).riskProfiles;
    expect(entity?.map((one) => one.filledInFor)).toEqual(["Al Noor Holdings Ltd"]);
  });

  it("is read back from a saved application, one for each holder, each set beside the holder it was filled in for", () => {
    expect(toForm({ clientType: "INDIVIDUAL", holders: [{ fullName: "Asha Verma" }] } as never).riskProfiles).toEqual([{ ...emptyRiskProfile(), filledInFor: "Asha Verma" }]);
    // A draft from before 25 Nov 2026: Vikram's filled in first, and Kiran's under the name as first spelt.
    const saved = {
      clientType: "INDIVIDUAL",
      holders: [{ fullName: "Asha Verma" }, { fullName: "Vikram Verma" }, { fullName: "Kiran Verma" }],
      riskProfiles: [answered("Vikram Verma", { agrees: false, preferredProfile: "CONSERVATIVE" }), answered("Asha Verma"), answered("Kiran Varma")],
    };
    const form = toForm(saved as never);
    expect(form.riskProfiles.map((one) => one.filledInFor)).toEqual(["Asha Verma", "Vikram Verma", "Kiran Verma"]);
    expect(form.riskProfiles[1]?.preferredProfile).toBe("CONSERVATIVE");
    // Kiran's answers stay hers, under her name as it is now.
    expect(form.riskProfiles[2]?.education).toBe("DIPLOMA_OR_HIGHER");
  });
});
