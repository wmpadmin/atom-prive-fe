import {
  CONTROLLER_STEPS,
  ENTITY_STEPS,
  HOLDER_CERT_STEPS,
  HOLDER_STEPS,
  holderGroup,
  namedControllers,
  ownerGroup,
  SELF_CERT_STEPS,
  type FormApplication,
  type FormHolder,
  type ReviewStep,
} from "./application";
import { ENTITY_RISK_STEPS, RISK_STEPS } from "./risk-profiling";

/**
 * The order the onboarding pop-up asks things in (24 Nov 2026, the user's approved mockup):
 *
 * Client 1's ten sections, then "Is there another account holder?" — Add opens Client 2's ten, and the question
 * comes again after them; Skip goes to the risk questionnaire. Nobody after Client 1 is asked about until the
 * relationship manager adds them. Then a risk questionnaire for each account holder the relationship manager wants:
 * with one holder it is theirs without asking, with more it first asks whose, and after each one it offers another
 * for a holder still without one. Then a joint account's signing authority, and Review.
 *
 * A flow step is either one of the review's steps or a question that only moves the form on, which is always
 * complete.
 */
export interface FlowStep extends ReviewStep {
  /** "more": another account holder? "moreOwners": another beneficial owner? */
  question?: "more" | "moreOwners";
  /** For a question: the holder or questionnaire it follows. */
  after?: number;
}

/** How many people may hold one account, which is what the firm's own application has room for. */
export const MOST_HOLDERS = 4;

const present = (value: string | null | undefined) => Boolean(value && value.trim());

/**
 * Whether anything of a joint holder's Client Details was entered, beyond what Prospective Clients brings with them
 * (their name, email, telephone and relationship): a holder like that is in the form even before they are added again.
 */
export function holderStarted(holder: FormHolder): boolean {
  const { details } = holder;
  const profile = details.profile;
  const anyOf = (values: unknown[]) => values.some((value) => (Array.isArray(value) ? value.length > 0 : typeof value === "string" ? present(value) : value !== null && value !== undefined));
  return anyOf([
    holder.dateOfBirth, holder.countryOfBirth, holder.nationality, holder.residentialAddress.line1, holder.residentialAddress.postalCode,
    holder.employer.position, holder.employer.companyName,
    details.gender, details.placeOfBirth, details.maritalStatus, details.citizenship, details.otherNationalities, details.employmentStatus, details.sector,
    profile.pep, profile.services, profile.turnover, profile.netWealth, profile.wealthSources, profile.income, profile.incomeSources,
    profile.knowledge, profile.activeFor, profile.managedBy, profile.products, profile.decisions,
  ]);
}

/**
 * The account holders the form asks about, by index: Client 1 always, and after them anyone the relationship manager
 * added (this time, or with details already entered). A holder skipped there stays on the account by name only.
 */
export function shownHolders(application: FormApplication, added: ReadonlySet<number>): number[] {
  return application.holders.flatMap((holder, index) =>
    index === 0 || (!holder.details.skipped && (added.has(index) || holderStarted(holder))) ? [index] : []);
}

/**
 * An entity's beneficial owners the form asks about (25 Nov 2026), by index: the first always, and after them anyone
 * the relationship manager added (this time, or with details already entered). Owners Prospective Clients named wait
 * until they are added.
 */
export function shownOwners(application: FormApplication, added: ReadonlySet<number>): number[] {
  return application.beneficialOwners.flatMap((owner, index) => (index === 0 || added.has(index) || holderStarted(owner) ? [index] : []));
}

/**
 * The account holders whose risk questionnaires the form asks (25 Nov 2026, one each): those being filled in and those
 * whose details were skipped, but not one Prospective Clients named who is still waiting to be added or left out.
 */
export function onTheAccount(application: FormApplication, shown: number[]): number[] {
  return application.holders.flatMap((holder, index) => (shown.includes(index) || (index > 0 && holder.details.skipped) ? [index] : []));
}

interface FlowOptions {
  /** False when the client's type and relationship manager came with them from Prospective Clients. */
  askClientType: boolean;
  added: ReadonlySet<number>;
  /** An entity's beneficial owners added this time (25 Nov 2026). */
  addedOwners?: ReadonlySet<number>;
  /** Steps added after the review's own, such as Review & submit. */
  finish: ReviewStep[];
}

/** Every step of the pop-up, in the order it asks them. */
export function buildFlow(application: FormApplication, steps: ReviewStep[], { askClientType, added, addedOwners = new Set(), finish }: FlowOptions): FlowStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const flow: FlowStep[] = [];
  const put = (id: string) => {
    const step = byId.get(id);
    if (step) flow.push(step);
  };
  if (askClientType || !byId.get("client")?.complete) put("client");
  // An entity (25 Nov 2026, the user's approved mockup): the company's eleven sections, then Beneficial owner 1's ten
  // and "Is there another beneficial owner?" after each, then its questionnaire, then the self-certification and an
  // Annex for each controlling person it names.
  if (application.clientType === "ENTITY") {
    ENTITY_STEPS.forEach(([part]) => put(`entity-${part}`));
    for (const index of shownOwners(application, addedOwners)) {
      HOLDER_STEPS.forEach(([part]) => put(`owner-${index}-${part}`));
      flow.push({ id: `more-owner-${index}`, group: ownerGroup(index), label: `${application.beneficialOwners[index]?.fullName?.trim() || ownerGroup(index)}'s details are in`,
        complete: true, fields: [], question: "moreOwners", after: index });
    }
    ENTITY_RISK_STEPS.forEach(([part]) => put(`risk-0-${part}`));
    SELF_CERT_STEPS.forEach(([part]) => put(`sc-${part}`));
    for (const place of namedControllers(application.entity.selfCertification)) CONTROLLER_STEPS.forEach(([part]) => put(`cp-${place}-${part}`));
    return [...flow, ...finish];
  }

  const shown = shownHolders(application, added);
  for (const index of shown) {
    HOLDER_STEPS.forEach(([part]) => put(`holder-${index}-${part}`));
    flow.push({ id: `more-${index}`, group: holderGroup(index), label: `${application.holders[index]?.fullName?.trim() || holderGroup(index)}'s details are in`,
      complete: true, fields: [], question: "more", after: index });
  }
  // A holder skipped earlier still needs their name to stay on the account: if it's missing, that one line is asked.
  application.holders.forEach((holder, index) => {
    if (index > 0 && holder.details.skipped && !present(holder.fullName)) put(`holder-${index}-name`);
  });

  // Then a risk questionnaire for each of them, in the account's order (25 Nov 2026), each holder's at their own place.
  for (const index of onTheAccount(application, shown)) RISK_STEPS.forEach(([part]) => put(`risk-${index}-${part}`));
  // Each holder's self-certification after the questionnaires (25 Nov 2026), for those whose details are taken.
  for (const index of shown) HOLDER_CERT_STEPS.forEach(([part]) => put(`holdercert-${index}-${part}`));
  put("signing");
  return [...flow, ...finish];
}

/**
 * Where a saved draft opens: the first screen of the part still missing something, except that a draft whose clients
 * are done and whose risk questionnaire isn't started opens on the question after the last client, still to be answered.
 */
export function openingStep(application: FormApplication, flow: FlowStep[]): string {
  const first = flow.find((step) => !step.complete && !step.question);
  if (!first) return flow.at(-1)?.id ?? "review";
  if (first.id.startsWith("risk-0-")) {
    const profile = application.riskProfiles[0];
    const untouched = profile && Object.keys(profile.answers).length === 0 && Object.keys(profile.knowledge).length === 0 && !profile.education
      && !profile.owners.some((one) => one.education);
    const question = [...flow].reverse().find((step) => step.question === "more" || step.question === "moreOwners");
    if (untouched && question) return question.id;
  }
  // The first screen of that part, even one filled in already (25 Nov 2026, the user's choice): what came over from
  // Prospective Clients, a name say, is looked at before going on.
  return flow.find((step) => step.group === first.group && !step.question)?.id ?? first.id;
}
