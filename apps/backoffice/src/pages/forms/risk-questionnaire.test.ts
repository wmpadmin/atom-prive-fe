import { describe, expect, it } from "vitest";
import {
  BANDS,
  abilityBand,
  abilityQuestions,
  emptyQuestionnaire,
  noRiskierThan,
  profileFrom,
  scored,
  settled,
  toleranceBand,
  toleranceQuestions,
  type Band,
  type RiskQuestionnaire,
} from "@atomprive/forms/risk-questionnaire";

/** Every question answered with the option at `pick` of its list (0 for the first, -1 for the last). */
function answeredAt(pick: number): RiskQuestionnaire {
  const answers: Record<string, string> = {};
  for (const question of [...abilityQuestions, ...toleranceQuestions]) {
    answers[question.id] = question.options.at(pick)!.value;
  }
  return { ...emptyQuestionnaire(), answers };
}

describe("the firm's risk questionnaire", () => {
  it("scores 10 to 50 for Risk Ability and 5 to 25 for Risk Tolerance, as the bands assume", () => {
    expect(scored(answeredAt(0))).toMatchObject({ ability: 10, tolerance: 5, profile: "CONSERVATIVE" });
    expect(scored(answeredAt(-1))).toMatchObject({ ability: 50, tolerance: 25, profile: "AGGRESSIVE" });
  });

  it("puts every band edge where the form prints it", () => {
    expect([10, 14, 15, 24, 25, 34, 35, 44, 45, 50].map(abilityBand)).toEqual(
      ["LOW", "LOW", "MODERATE", "MODERATE", "MEDIUM", "MEDIUM", "ENHANCED", "ENHANCED", "HIGH", "HIGH"],
    );
    expect([5, 7, 8, 12, 13, 17, 18, 22, 23, 25].map(toleranceBand)).toEqual(
      ["LOW", "LOW", "MODERATE", "MODERATE", "MEDIUM", "MEDIUM", "ENHANCED", "ENHANCED", "HIGH", "HIGH"],
    );
  });

  it("reads the matrix cell by cell as page 3 prints it", () => {
    // Rows are Risk Tolerance, Low to High; columns are Risk Ability, Low to High.
    const printed = [
      "C C C C C",
      "C B B B B",
      "C B B B B",
      "C B B A A",
      "C B B A A",
    ].map((row) => row.split(" "));
    const letter = { CONSERVATIVE: "C", BALANCED: "B", AGGRESSIVE: "A" } as const;
    BANDS.forEach((tolerance: Band, row) => {
      BANDS.forEach((ability: Band, column) => {
        expect(letter[profileFrom(ability, tolerance)]).toBe(printed[row]![column]);
      });
    });
  });

  it("gives no profile until every scored question is answered", () => {
    const value = answeredAt(2);
    delete value.answers["q11"];
    expect(scored(value).profile).toBeNull();
  });

  it("lets a client prefer only a more conservative profile, never a riskier one", () => {
    expect(noRiskierThan("BALANCED")).toEqual(["CONSERVATIVE", "BALANCED"]);
    const worked = answeredAt(2);
    expect(scored(worked).profile).toBe("BALANCED");
    expect(settled({ ...worked, agrees: false, preferredProfile: "AGGRESSIVE" }).chosenProfile).toBeNull();
    expect(settled({ ...worked, agrees: false, preferredProfile: "CONSERVATIVE" }).chosenProfile).toBe("CONSERVATIVE");
  });

  it("saves the profile that counts: the one worked out where the client agrees", () => {
    const value = settled({ ...answeredAt(2), agrees: true, preferredProfile: "CONSERVATIVE" });
    expect(value).toMatchObject({ chosenProfile: "BALANCED", preferredProfile: null, version: 2 });
  });
});
