import { describe, expect, it } from "vitest";
import {
  CONTROLLER_STEPS,
  emptyHolder,
  ENTITY_STEPS,
  HOLDER_STEPS,
  newApplication,
  reviewApplication,
  SELF_CERT_STEPS,
  stepOfField,
  tidy,
  type FormApplication,
} from "./application";
import { buildFlow, shownOwners } from "./onboarding-flow";
import { ENTITY_RISK_STEPS } from "./risk-profiling";

const REVIEW = { id: "review", group: "Finish", label: "Review & submit", complete: false, fields: [] };

function entity(): FormApplication {
  const application = newApplication();
  application.clientType = "ENTITY";
  application.entity.legalName = "Al Noor Holdings Ltd";
  application.relationshipManagerId = "01a0aad1-7c46-7f99-bf1f-f2fd2afd46c0";
  return application;
}

const flowOf = (application: FormApplication, addedOwners: number[] = []) =>
  buildFlow(application, reviewApplication(application, undefined).steps, { askClientType: false, added: new Set(), addedOwners: new Set(addedOwners), finish: [REVIEW] })
    .map((step) => step.id);

const company = ENTITY_STEPS.map(([part]) => `entity-${part}`);
const owner = (index: number) => HOLDER_STEPS.map(([part]) => `owner-${index}-${part}`);
const risk = ENTITY_RISK_STEPS.map(([part]) => `risk-0-${part}`);
const certification = SELF_CERT_STEPS.map(([part]) => `sc-${part}`);
const annex = (place: number) => CONTROLLER_STEPS.map(([part]) => `cp-${place}-${part}`);

describe("an entity's onboarding pop-up (25 Nov 2026, the approved mockup)", () => {
  it("asks the company's eleven sections, Beneficial owner 1's ten and whether there is another, then the questionnaire and the self-certification", () => {
    expect(flowOf(entity())).toEqual([...company, ...owner(0), "more-owner-0", ...risk, ...certification, "review"]);
  });

  it("waits to ask an owner Prospective Clients named until they are added, and asks again after them", () => {
    const application = entity();
    application.beneficialOwners = [{ ...emptyHolder(), fullName: "Omar Al Noor" }, { ...emptyHolder(), fullName: "Layla Al Noor" }];
    expect(shownOwners(application, new Set())).toEqual([0]);
    expect(flowOf(application, [1])).toEqual([...company, ...owner(0), "more-owner-0", ...owner(1), "more-owner-1", ...risk, ...certification, "review"]);
  });

  it("adds an Annex for each controlling person a Passive NFE names, and none for an Active NFE", () => {
    const application = entity();
    const people = application.entity.selfCertification.controllingPersons;
    people[0] = { ...people[0]!, fullName: "Omar Al Noor" };
    people[2] = { ...people[2]!, fullName: "Layla Al Noor" };
    application.entity.selfCertification.classification = "PASSIVE_NFE";
    expect(flowOf(application).slice(-7)).toEqual([...annex(0), ...annex(2), "review"]);
    application.entity.selfCertification.classification = "ACTIVE_NFE_OTHER";
    expect(flowOf(application).at(-2)).toBe("sc-classification");
    expect(tidy(application).entity?.selfCertification?.controllingPersons).toEqual([]);
  });

  it("asks a TIN or why there is none, and explains Reason B or C", () => {
    const application = entity();
    const form = application.entity.selfCertification;
    form.taxResidences[0] = { country: "AE", tin: null, reason: null };
    form.taxResidences[1] = { country: "SG", tin: null, reason: "B" };
    const { problems } = reviewApplication(application, undefined);
    expect(problems["entity.selfCertification.taxResidences[0].tin"]).toBe("Enter the TIN, or choose why there is none.");
    expect(problems["entity.selfCertification.noTinExplanation"]).toBe("Explain why a TIN is not available.");
    expect(problems["entity.selfCertification.taxResidences[1].tin"]).toBeUndefined();
  });

  it("needs at least one named director, and a name on any line with something else on it", () => {
    const application = entity();
    application.entity.company.directors[1] = { name: null, position: "Director" };
    expect(reviewApplication(application, undefined).problems["entity.company.directors"]).toBe("Enter at least one director or partner.");
    application.entity.company.directors[0] = { name: "Omar Al Noor", position: "Chairman" };
    expect(reviewApplication(application, undefined).problems["entity.company.directors[1].name"]).toBe("Enter the name.");
  });

  it("sends only the lines written on, the questionnaire for the entity with Part A by owner, and its owners as nobody's account holders", () => {
    const application = entity();
    application.beneficialOwners = [{ ...emptyHolder(), fullName: "Omar Al Noor" }];
    application.riskProfiles[0]!.owners = [{ owner: null, education: "SECONDARY", qualification: null }];
    application.entity.company.directors[0] = { name: "Omar Al Noor", position: "Chairman" };
    const sent = tidy(application);
    expect(sent.holders).toEqual([]);
    expect(sent.entity?.company?.directors).toEqual([{ name: "Omar Al Noor", position: "Chairman" }]);
    expect(sent.riskProfiles?.[0]?.filledInFor).toBe("Al Noor Holdings Ltd");
    expect(sent.riskProfiles?.[0]?.owners).toEqual([{ owner: "Omar Al Noor", education: "SECONDARY", qualification: null }]);
    expect(sent.beneficialOwners?.[0]?.signatory).toBeNull();
  });

  it("opens the section a server problem belongs to", () => {
    expect(stepOfField("entity.company.shareholders[2].name", true)).toBe("entity-shareholders");
    expect(stepOfField("entity.taxResidency", true)).toBe("entity-contact");
    expect(stepOfField("beneficialOwners[1].details.profile.netWealth", true)).toBe("owner-1-wealth");
    expect(stepOfField("riskProfiles[0].owners[1].education", true)).toBe("risk-0-knowledge");
    expect(stepOfField("riskProfiles[0].excludedSectors", true)).toBe("risk-0-exclusions");
    expect(stepOfField("riskProfiles[0].agrees", true)).toBe("risk-0-declaration");
    expect(stepOfField("entity.countryOfIncorporation", true)).toBe("sc-identification");
    expect(stepOfField("entity.selfCertification.noTinExplanation", true)).toBe("sc-tax");
    expect(stepOfField("entity.selfCertification.controllingPersons[1].type", true)).toBe("cp-1-type");
    expect(stepOfField("holders[0].surname")).toBe("holdercert-0-identification");
    expect(stepOfField("holders[1].details.taxResidences[0].tin")).toBe("holdercert-1-tax");
  });
});
