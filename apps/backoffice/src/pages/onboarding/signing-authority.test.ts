import { describe, expect, it } from "vitest";
import { emptyHolder, newApplication, reviewApplication, signingAuthorityText, stepOfField, tidy, type FormApplication } from "./application";

/** A joint account of three, named and otherwise blank: only the signing step is looked at here. */
function joint(): FormApplication {
  const application = newApplication();
  application.holders = ["Ravi Menon", "Meena Menon", "Arun Menon"].map((fullName) => ({ ...emptyHolder(), fullName }));
  return application;
}

const signingProblems = (application: FormApplication) =>
  Object.keys(reviewApplication(application, undefined).problems).filter((field) => field.startsWith("signingAuthority."));

describe("a joint account's signing authority (23 Nov 2026)", () => {
  it("is asked only when more than one person holds the account", () => {
    const sole = newApplication();
    expect(reviewApplication(sole, undefined).steps.some((step) => step.id === "signing")).toBe(false);
    expect(reviewApplication(joint(), undefined).steps.some((step) => step.id === "signing")).toBe(true);
    expect(tidy(sole).signingAuthority).toBeNull();
  });

  it("needs a choice, ticked holders for some of them, and words for other", () => {
    const application = joint();
    expect(signingProblems(application)).toEqual(["signingAuthority.mode"]);
    application.signingAuthority = { mode: "ANY_OF_NAMED", howMany: 2, other: null };
    expect(signingProblems(application)).toEqual(["signingAuthority.signatories"]);
    application.holders[0]!.signatory = true;
    expect(signingProblems(application)).toEqual(["signingAuthority.howMany"]);
    application.holders[1]!.signatory = true;
    expect(signingProblems(application)).toEqual([]);
    application.signingAuthority = { mode: "OTHER", howMany: null, other: " " };
    expect(signingProblems(application)).toEqual(["signingAuthority.other"]);
    expect(stepOfField("signingAuthority.other")).toBe("signing");
  });

  it("reads as the form's signing mandate will, and every holder signs where any or all do", () => {
    const application = joint();
    application.holders[0]!.signatory = true;
    application.holders[1]!.signatory = true;
    application.signingAuthority = { mode: "ANY_OF_NAMED", howMany: 1, other: null };
    expect(signingAuthorityText(application)).toBe("Any one of Ravi Menon and Meena Menon");
    application.signingAuthority.howMany = 2;
    expect(signingAuthorityText(application)).toBe("Ravi Menon and Meena Menon jointly");
    expect(tidy(application).holders?.map((holder) => holder.signatory)).toEqual([true, true, false]);
    application.signingAuthority = { mode: "ALL_JOINTLY", howMany: 2, other: null };
    expect(signingAuthorityText(application)).toBe("All of us, jointly");
    expect(tidy(application).holders?.map((holder) => holder.signatory)).toEqual([true, true, true]);
    expect(tidy(application).signingAuthority).toEqual({ mode: "ALL_JOINTLY", howMany: null, other: null });
  });
});
