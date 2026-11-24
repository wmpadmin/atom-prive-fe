import type {
  AccountHolder,
  Address,
  Business,
  Employer,
  EntityDetails,
  OnboardingApplication,
  SigningAuthority,
  StaffMember,
} from "@atomprive/api-client/backoffice";
import { countries } from "../../lib/countries";
import { mobileNumberMessage } from "../../lib/mobile-numbers";

// The onboarding rules. The API checks the same ones with the same messages (OnboardingReview.java), so change
// both together.

export type ClientType = NonNullable<OnboardingApplication["clientType"]>;
export type Occupation = NonNullable<AccountHolder["occupation"]>;
export type Relationship = NonNullable<AccountHolder["relationshipToPrimary"]>;
export type OrganisationType = NonNullable<EntityDetails["organisationType"]>;
export type SigningMode = NonNullable<SigningAuthority["mode"]>;

/** Who may sign for a joint account (23 Nov 2026), worded for the person entering it. */
export const signingModeLabels: Record<SigningMode, string> = {
  ANY_ONE: "Any one of us, acting alone",
  ALL_JOINTLY: "All of us, jointly",
  ANY_OF_NAMED: "Some of the holders",
  OTHER: "Other",
};

const NUMBER_WORDS = ["one", "two", "three", "four"];

function listed(names: string[]) {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A holder's name as far as it has been entered. */
export function holderName(holder: AccountHolder, index: number) {
  return holder.fullName?.trim() || [holder.forenames, holder.surname].filter(Boolean).join(" ").trim() || holderGroup(index);
}

/**
 * The signing authority in one line, as the account opening form's signing mandate will say it — the server writes
 * the same words into that form (Prefill.namedSignatories), so the two read alike.
 */
export function signingAuthorityText(application: Pick<FormApplication, "holders" | "signingAuthority">): string | null {
  const authority = application.signingAuthority;
  if (!authority?.mode) return null;
  if (authority.mode === "ANY_ONE") return "Any one of us, acting alone";
  if (authority.mode === "ALL_JOINTLY") return "All of us, jointly";
  if (authority.mode === "OTHER") return authority.other?.trim() ? `Other: ${authority.other.trim()}` : "Other";
  const names = application.holders.flatMap((holder, index) => (holder.signatory ? [holderName(holder, index)] : []));
  if (names.length === 0) return "Some of the holders (none ticked yet)";
  if (names.length === 1) return `Only ${names[0]}`;
  const howMany = authority.howMany ?? 1;
  if (howMany >= names.length) return `${listed(names)} jointly`;
  return `Any ${NUMBER_WORDS[howMany - 1] ?? howMany} of ${listed(names)}`;
}

/** Whether this holder may sign, where the account says so; null for a sole account or a choice not yet made. */
export function signsFor(application: Pick<FormApplication, "holders" | "signingAuthority">, holder: AccountHolder): boolean | null {
  const mode = application.signingAuthority?.mode;
  if (application.holders.length < 2 || !mode) return null;
  if (mode === "ANY_ONE" || mode === "ALL_JOINTLY") return true;
  return holder.signatory ?? (mode === "OTHER" ? null : false);
}

export const MAX_HOLDERS = 4;

export const occupationLabels: Record<Occupation, string> = {
  SALARIED: "Salaried",
  BUSINESS_OWNER: "Business owner",
  HOMEMAKER: "Homemaker",
  RETIRED: "Retired",
  STUDENT: "Student",
  OTHER: "Other",
};

/**
 * The firm keeps its own relationship types now, so there is no list of them here. A screen that offers them
 * asks for them with useRelationshipTypes, and one that reads a stored code resolves it the same way.
 */

export const organisationTypeLabels: Record<OrganisationType, string> = {
  PIC: "Private investment company (PIC)",
  TRUST_OR_FOUNDATION: "Trust or foundation",
  TRADING_COMPANY: "Trading company",
  OTHER: "Other",
};

/** A holder with every section present, so the form never has to check for missing parts. */
export interface FormHolder extends AccountHolder {
  employer: Employer;
  business: Business & { countriesOfBusiness: string[] };
  residentialAddress: Address;
  mailingAddress: Address;
}

export interface FormEntity extends EntityDetails {
  countriesOfBusiness: string[];
  registeredAddress: Address;
}

export interface FormApplication extends OnboardingApplication {
  holders: FormHolder[];
  entity: FormEntity;
  signingAuthority: SigningAuthority;
}

export function emptySigningAuthority(): SigningAuthority {
  return { mode: null, howMany: null, other: null };
}

export function emptyAddress(): Address {
  return { line1: null, line2: null, city: null, state: null, postalCode: null, country: null };
}

export function emptyHolder(): FormHolder {
  return {
    fullName: null,
    forenames: null,
    surname: null,
    relationshipToPrimary: null,
    dateOfBirth: null,
    idNumber: null,
    idExpiry: null,
    nationality: null,
    countryOfBirth: null,
    otherNationality: null,
    otherNationalityCountry: null,
    occupation: null,
    occupationOther: null,
    employer: { companyName: null, country: null, position: null },
    business: { companyName: null, country: null, entityType: null, natureOfBusiness: null, countriesOfBusiness: [] },
    phone: null,
    email: null,
    residentialAddress: emptyAddress(),
    mailingSameAsResidential: true,
    mailingAddress: emptyAddress(),
    secondaryMailingAddress: null,
    photo: null,
    signatory: null,
  };
}

function emptyEntity(): FormEntity {
  return {
    legalName: null,
    legalForm: null,
    taxResidency: null,
    giin: null,
    countryOfIncorporation: null,
    dateOfIncorporation: null,
    registrationNumber: null,
    natureOfBusiness: null,
    regulated: null,
    regulatorName: null,
    countriesOfBusiness: [],
    organisationType: null,
    organisationTypeOther: null,
    registeredAddress: emptyAddress(),
  };
}

export function newApplication(): FormApplication {
  return {
    clientType: "INDIVIDUAL",
    relationshipManagerId: null,
    holders: [emptyHolder()],
    entity: emptyEntity(),
    signingAuthority: emptySigningAuthority(),
  };
}

/** A saved application in the shape the form edits. */
export function toForm(saved: OnboardingApplication): FormApplication {
  const holders = (saved.holders ?? []).map((holder): FormHolder => {
    const empty = emptyHolder();
    return {
      ...empty,
      ...holder,
      employer: { ...empty.employer, ...holder.employer },
      business: { ...empty.business, ...holder.business, countriesOfBusiness: holder.business?.countriesOfBusiness ?? [] },
      residentialAddress: { ...emptyAddress(), ...holder.residentialAddress },
      mailingAddress: { ...emptyAddress(), ...holder.mailingAddress },
    };
  });
  const entity = emptyEntity();
  return {
    clientType: saved.clientType ?? "INDIVIDUAL",
    relationshipManagerId: saved.relationshipManagerId,
    holders: holders.length > 0 ? holders : [emptyHolder()],
    entity: {
      ...entity,
      ...saved.entity,
      countriesOfBusiness: saved.entity?.countriesOfBusiness ?? [],
      registeredAddress: { ...emptyAddress(), ...saved.entity?.registeredAddress },
    },
    signingAuthority: { ...emptySigningAuthority(), ...saved.signingAuthority },
  };
}

/** What's submitted: only the client type in use, without answers to questions that no longer apply. */
export function tidy(application: FormApplication): OnboardingApplication {
  if (application.clientType === "ENTITY") {
    const { entity } = application;
    return {
      ...application,
      holders: [],
      signingAuthority: null,
      entity: {
        ...entity,
        regulatorName: entity.regulated ? entity.regulatorName : null,
        organisationTypeOther: entity.organisationType === "OTHER" ? entity.organisationTypeOther : null,
      },
    };
  }
  const joint = application.holders.length > 1;
  const mode = joint ? application.signingAuthority.mode : null;
  return {
    ...application,
    entity: null,
    // Only a joint account says who signs for it, and only what its choice needs (23 Nov 2026).
    signingAuthority: mode
      ? {
          mode,
          howMany: mode === "ANY_OF_NAMED" ? application.signingAuthority.howMany : null,
          other: mode === "OTHER" ? application.signingAuthority.other : null,
        }
      : null,
    holders: application.holders.map((holder, index) => ({
      ...holder,
      signatory: !mode ? null : mode === "ANY_ONE" || mode === "ALL_JOINTLY" ? true
        : mode === "ANY_OF_NAMED" ? Boolean(holder.signatory) : holder.signatory,
      relationshipToPrimary: index > 0 ? holder.relationshipToPrimary : null,
      otherNationalityCountry: holder.otherNationality ? holder.otherNationalityCountry : null,
      occupationOther: holder.occupation === "OTHER" ? holder.occupationOther : null,
      employer: holder.occupation === "SALARIED" ? holder.employer : null,
      business: holder.occupation === "BUSINESS_OWNER" ? holder.business : null,
      mailingAddress: holder.mailingSameAsResidential ? null : holder.mailingAddress,
    })),
  };
}

export interface ReviewStep {
  id: string;
  /** The heading the step sits under in the step list, such as "Primary account holder". */
  group: string;
  label: string;
  complete: boolean;
  /** The fields this step still needs, as keys of {@link Review.problems}, in form order. */
  fields: string[];
}

export interface Review {
  /** Each field, such as "holders[0].surname", with what's wrong with it, in form order. */
  problems: Record<string, string>;
  steps: ReviewStep[];
}

export function holderGroup(index: number) {
  return index === 0 ? "Primary account holder" : `Account holder ${index + 1}`;
}

const countryCodes = new Set(countries.map((country) => country.code));
const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Dates as yyyy-mm-dd, which compare correctly as text. */
export function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Checks the application step by step. Every field is required, and some only when an answer calls for them.
 *
 * @param managers the relationship managers that can be chosen; while they're loading, any choice is accepted
 */
export function reviewApplication(application: FormApplication, managers: StaffMember[] | undefined, today = new Date()): Review {
  const problems: Record<string, string> = {};
  const steps: ReviewStep[] = [];
  const todayIso = isoDate(today);
  const expiryLimit = isoDate(new Date(today.getFullYear() + 30, today.getMonth(), today.getDate()));

  const problem = (field: string, message: string) => {
    problems[field] ??= message;
  };
  const blank = (value: string | null | undefined) => !value || value.trim() === "";
  const required = (value: string | null | undefined, field: string, message: string) => {
    if (blank(value)) problem(field, message);
  };
  const country = (value: string | null | undefined, field: string, message: string) => {
    if (!value || !countryCodes.has(value)) problem(field, message);
  };
  const pastDate = (value: string | null | undefined, field: string, missing: string, notPast: string) => {
    if (!value) problem(field, missing);
    else if (value >= todayIso || value < "1900-01-01") problem(field, notPast);
  };
  // An entity's registered address may have no second line and no state, as Singapore's do not (22 Nov 2026).
  const address = (value: Address | null, at: string, registered = false) => {
    required(value?.line1, `${at}line1`, "Enter the first line of the address.");
    if (!registered) required(value?.line2, `${at}line2`, "Enter the second line of the address.");
    required(value?.city, `${at}city`, "Enter the city.");
    if (!registered) required(value?.state, `${at}state`, "Enter the state.");
    required(value?.postalCode, `${at}postalCode`, "Enter the postal code.");
    country(value?.country, `${at}country`, "Choose the country.");
  };
  const step = (id: string, group: string, label: string, checks: () => void) => {
    const before = Object.keys(problems).length;
    checks();
    const fields = Object.keys(problems).slice(before);
    steps.push({ id, group, label, complete: fields.length === 0, fields });
  };

  step("client", "Client", "Client type", () => {
    if (!application.clientType) problem("clientType", "Choose whether the client is an individual or an entity.");
    const manager = application.relationshipManagerId;
    if (!manager) problem("relationshipManagerId", "Choose a relationship manager.");
    else if (managers && !managers.some((person) => person.id === manager)) {
      problem("relationshipManagerId", "Choose a relationship manager from the list.");
    }
  });

  if (application.clientType === "ENTITY") {
    const { entity } = application;
    step("entity-details", "Entity", "Entity details", () => {
      required(entity.legalName, "entity.legalName", "Enter the entity's full legal name.");
      country(entity.countryOfIncorporation, "entity.countryOfIncorporation", "Choose the country of incorporation.");
      pastDate(entity.dateOfIncorporation, "entity.dateOfIncorporation", "Choose the date of incorporation.", "Date of incorporation must be in the past.");
      required(entity.registrationNumber, "entity.registrationNumber", "Enter the business registration number.");
      required(entity.natureOfBusiness, "entity.natureOfBusiness", "Enter the nature of the business.");
    });
    step("entity-business", "Entity", "Business & regulation", () => {
      if (entity.regulated === null) problem("entity.regulated", "Say whether the entity is regulated.");
      else if (entity.regulated) required(entity.regulatorName, "entity.regulatorName", "Enter the name of the regulator.");
      if (entity.countriesOfBusiness.length === 0) problem("entity.countriesOfBusiness", "Choose at least one country the entity works with.");
      if (!entity.organisationType) problem("entity.organisationType", "Choose the type of organisation.");
      else if (entity.organisationType === "OTHER") {
        required(entity.organisationTypeOther, "entity.organisationTypeOther", "Say what type of organisation it is.");
      }
    });
    step("entity-address", "Entity", "Registered address", () => address(entity.registeredAddress, "entity.registeredAddress.", true));
    return { problems, steps };
  }

  // Each holder becomes a customer who signs in with their email, so no two can share one.
  const emails = new Set<string>();
  application.holders.forEach((holder, index) => {
    const at = `holders[${index}].`;
    const group = holderGroup(index);
    step(`holder-${index}-personal`, group, "Personal details", () => {
      required(holder.fullName, `${at}fullName`, "Enter their full name as it appears on the NRIC or passport.");
      required(holder.forenames, `${at}forenames`, "Enter their forenames.");
      required(holder.surname, `${at}surname`, "Enter their surname.");
      if (index > 0 && !holder.relationshipToPrimary) {
        problem(`${at}relationshipToPrimary`, "Choose how they're related to the primary account holder.");
      }
      pastDate(holder.dateOfBirth, `${at}dateOfBirth`, "Choose their date of birth.", "Date of birth must be in the past.");
      required(holder.idNumber, `${at}idNumber`, "Enter their NRIC or passport number.");
      if (!holder.idExpiry) problem(`${at}idExpiry`, "Choose the date the NRIC or passport expires.");
      else if (holder.idExpiry <= todayIso) problem(`${at}idExpiry`, "This NRIC or passport has expired. Ask the client for a valid one.");
      else if (holder.idExpiry > expiryLimit) problem(`${at}idExpiry`, "Check the expiry date; it's more than 30 years away.");
      country(holder.nationality, `${at}nationality`, "Choose their nationality.");
      country(holder.countryOfBirth, `${at}countryOfBirth`, "Choose their country of birth.");
      if (holder.otherNationality === null) problem(`${at}otherNationality`, "Say whether they hold another nationality.");
      else if (holder.otherNationality) {
        country(holder.otherNationalityCountry, `${at}otherNationalityCountry`, "Choose their other nationality.");
      }
    });
    step(`holder-${index}-occupation`, group, "Occupation", () => {
      switch (holder.occupation) {
        case null:
          problem(`${at}occupation`, "Choose their occupation.");
          break;
        case "OTHER":
          required(holder.occupationOther, `${at}occupationOther`, "Say what their occupation is.");
          break;
        case "SALARIED":
          required(holder.employer.companyName, `${at}employer.companyName`, "Enter the name of the company they work for.");
          country(holder.employer.country, `${at}employer.country`, "Choose the country the company is in.");
          required(holder.employer.position, `${at}employer.position`, "Enter the position they hold.");
          break;
        case "BUSINESS_OWNER":
          required(holder.business.companyName, `${at}business.companyName`, "Enter the name of their company.");
          country(holder.business.country, `${at}business.country`, "Choose the country the company is in.");
          required(holder.business.entityType, `${at}business.entityType`, "Enter the type of entity, such as a private limited company.");
          required(holder.business.natureOfBusiness, `${at}business.natureOfBusiness`, "Enter the nature of the business.");
          if (holder.business.countriesOfBusiness.length === 0) {
            problem(`${at}business.countriesOfBusiness`, "Choose at least one country the business works with.");
          }
          break;
        default:
          break;
      }
    });
    step(`holder-${index}-contact`, group, "Contact & address", () => {
      if (blank(holder.phone)) problem(`${at}phone`, "Enter their mobile number.");
      else {
        const message = mobileNumberMessage(holder.phone ?? "");
        if (message) problem(`${at}phone`, message);
      }
      if (blank(holder.email)) problem(`${at}email`, "Enter their email address.");
      else if (!email.test((holder.email ?? "").trim())) problem(`${at}email`, "Enter a valid email address, such as name@example.com.");
      else if (emails.has((holder.email ?? "").trim().toLowerCase())) problem(`${at}email`, "Each account holder needs their own email address.");
      else emails.add((holder.email ?? "").trim().toLowerCase());
      address(holder.residentialAddress, `${at}residentialAddress.`);
      if (!holder.mailingSameAsResidential) address(holder.mailingAddress, `${at}mailingAddress.`);
      if (holder.secondaryMailingAddress) address(holder.secondaryMailingAddress, `${at}secondaryMailingAddress.`);
    });
  });
  if (application.holders.length > 1) {
    step("signing", "Joint account", "Signing authority", () => {
      const { mode, howMany, other } = application.signingAuthority;
      if (!mode) problem("signingAuthority.mode", "Choose who can sign for this joint account.");
      else if (mode === "ANY_OF_NAMED") {
        const ticked = application.holders.filter((holder) => holder.signatory).length;
        if (ticked === 0) problem("signingAuthority.signatories", "Tick at least one holder who can sign.");
        else if (!howMany || howMany < 1 || howMany > ticked) {
          problem("signingAuthority.howMany", `Choose how many of the ticked holders must sign, from 1 to ${ticked}.`);
        }
      } else if (mode === "OTHER") required(other, "signingAuthority.other", "Say who can sign for this joint account.");
    });
  }
  return { problems, steps };
}

const personalFields = new Set(["fullName", "forenames", "surname", "relationshipToPrimary", "dateOfBirth", "idNumber", "idExpiry", "nationality", "countryOfBirth", "otherNationality", "otherNationalityCountry"]);
const occupationFields = new Set(["occupation", "occupationOther", "employer", "business"]);
const businessFields = new Set(["regulated", "regulatorName", "countriesOfBusiness", "organisationType", "organisationTypeOther"]);

/** The step a field is on, such as "holder-1-contact" for "holders[1].email", to show where a problem is. */
export function stepOfField(field: string) {
  if (field.startsWith("signingAuthority.")) return "signing";
  const holder = /^holders\[(\d+)\]\.(\w+)/.exec(field);
  if (holder) {
    const [, index, name = ""] = holder;
    return `holder-${index}-${personalFields.has(name) ? "personal" : occupationFields.has(name) ? "occupation" : "contact"}`;
  }
  const entity = /^entity\.(\w+)/.exec(field)?.[1];
  if (entity === "registeredAddress") return "entity-address";
  if (entity) return businessFields.has(entity) ? "entity-business" : "entity-details";
  return "client";
}
