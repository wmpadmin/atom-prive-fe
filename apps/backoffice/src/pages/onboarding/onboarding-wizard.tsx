import { ApiError } from "@atomprive/api-client";
import {
  useSaveOnboardingDraft,
  useStartOnboardingCase,
  useSubmitOnboardingCase,
  type CaseDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn } from "@atomprive/ui";
import { ArrowLeft, ArrowRight, Check, Download, FileText, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";
import { toFormErrors } from "../../lib/api-errors";
import { ConfirmDialog } from "../config/confirm-dialog";
import {
  emptyHolder,
  MOST_OWNERS,
  oneQuestionnaireEach,
  reviewApplication,
  stepOfField,
  tidy,
  type FormApplication,
  type FormEntity,
  type FormHolder,
  type ReviewStep,
} from "./application";
import { annexSteps, companySteps, selfCertSteps } from "./entity-steps";
import { holderCertSteps } from "./self-certification-steps";
import { OnboardingPdf } from "./onboarding-print";
import { DOCUMENT_TITLE, ENTITY_DOCUMENT_TITLE } from "./print-wording";
import { buildFlow, MOST_HOLDERS, openingStep, shownHolders, shownOwners, type FlowStep } from "./onboarding-flow";
import { ApplicationSummary } from "./application-summary";
import { categoryBeingEntered, categoryLabels } from "./case-category";
import {
  AddressStep,
  BirthStep,
  BusinessStep,
  ClientTypeStep,
  ContactStep,
  ExperienceStep,
  NameStep,
  NationalityStep,
  PepStep,
  SigningAuthorityStep,
  WealthStep,
  WorkStep,
} from "./onboarding-steps";
import {
  RiskAbilityStep,
  RiskDeclarationStep,
  RiskExclusionsStep,
  RiskKnowledgeStep,
  RiskLeverageStep,
  RiskResultStep,
  RiskToleranceStep,
} from "./risk-profile-steps";
import { ENTITY_RISK_GROUP, type FormRiskProfile } from "./risk-profiling";

const REVIEW: ReviewStep = { id: "review", group: "Finish", label: "Review & submit", complete: false, fields: [] };

/**
 * The design's labels (24 Nov 2026): sentence case and dark, where the rest of the back office has small grey
 * capitals. Only inside this form, so the shared field does not change anywhere else.
 */
const SENTENCE_LABELS =
  "[&_label]:text-sm [&_label]:font-semibold [&_label]:tracking-normal [&_label]:normal-case [&_label]:text-ink "
  + "[&_legend]:text-sm [&_legend]:font-semibold [&_legend]:tracking-normal [&_legend]:normal-case [&_legend]:text-ink";

/** A holder's step components, by the last part of the step's id. */
const holderSteps = {
  name: NameStep,
  birth: BirthStep,
  nationality: NationalityStep,
  address: AddressStep,
  contact: ContactStep,
  work: WorkStep,
  pep: PepStep,
  business: BusinessStep,
  wealth: WealthStep,
  experience: ExperienceStep,
} as const;

/** A risk profile's step components, by the last part of the step's id (24 Nov 2026). */
const riskSteps = {
  knowledge: RiskKnowledgeStep,
  ability: RiskAbilityStep,
  tolerance: RiskToleranceStep,
  result: RiskResultStep,
  leverage: RiskLeverageStep,
} as const;

interface OnboardingWizardProps {
  /** Null until the first save creates the case. */
  caseId: string | null;
  initial: FormApplication;
  managers: StaffMember[] | undefined;
  /** The case list to go back to, with the search and page it was left on. */
  listHref: string;
  /** Called after each save; submitted is true once the details were submitted. */
  onSaved: (detail: CaseDetail, submitted: boolean) => void;
}

/**
 * The onboarding details as a pop-up over All clients (24 Nov 2026, from the user's design): Schedule 2 a section at a
 * time, Next to the next one, Back to the one before, with the client's steps along the top.
 */
export function OnboardingWizard({ caseId, initial, managers, listHref, onSaved }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const body = useRef<HTMLDivElement>(null);
  const [application, setApplication] = useState(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  // A client from Prospective Clients comes with their type and relationship manager, so the form starts at Client 1.
  const [askClientType] = useState(() => !caseId || !reviewApplication(initial, undefined).steps.find((step) => step.id === "client")?.complete);
  // The joint holders the relationship manager added this time, with "+ Add another account holder".
  const [added, setAdded] = useState<ReadonlySet<number>>(() => new Set());
  // An entity's people are asked on its own form now (25 Nov 2026); its Stakeholders stay on the prospect.
  const finish = [REVIEW];
  // A draft opens where it was left: the first step that still needs details, or the question still to be answered.
  const [currentId, setCurrentId] = useState(() =>
    caseId ? openingStep(initial, buildFlow(initial, reviewApplication(initial, undefined).steps, { askClientType: !caseId, added: new Set(), finish })) : "client",
  );
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  // The step whose Continue (or Submit) was pressed with required details still missing: it lists them until they're in.
  const [tried, setTried] = useState<string | null>(null);

  const review = useMemo(() => reviewApplication(application, managers), [application, managers]);
  // The beneficial owners the relationship manager added this time, with "+ Add another beneficial owner" (25 Nov 2026).
  const [addedOwners, setAddedOwners] = useState<ReadonlySet<number>>(() => new Set());
  const entity = application.clientType === "ENTITY";
  const steps: FlowStep[] = buildFlow(application, review.steps, { askClientType, added, addedOwners, finish });
  const inFlow = new Set(steps.map((step) => step.id));
  const index = Math.max(0, steps.findIndex((step) => step.id === currentId));
  const current: FlowStep = steps[index] ?? REVIEW;
  // The account holders being filled in, and an entity's beneficial owners.
  const shown = shownHolders(application, added);
  const owners = shownOwners(application, addedOwners);
  const everyStepComplete = review.steps.every((step) => step.complete);
  // Entity, Individual or Joint, which is what decides the pack of forms they will be asked for.
  const category = categoryBeingEntered(application);

  const dirty = JSON.stringify(application) !== savedJson;
  // Read when someone navigates away, which can happen before a save has re-rendered the page.
  const unsaved = useRef(dirty);
  useEffect(() => {
    unsaved.current = dirty;
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => unsaved.current && currentLocation.pathname !== nextLocation.pathname);
  // Leaving the form — Cancel, the back link, another menu screen — keeps what was typed: it is saved as a draft
  // first, so a client half-entered when somebody walks in is still on All clients under Saved drafts (22 Nov 2026).
  // Only when the save is refused does the person choose between staying and leaving without it.
  const [leaveFailed, setLeaveFailed] = useState<string>();
  const savingOnLeave = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked" || savingOnLeave.current || leaveFailed) return;
    savingOnLeave.current = true;
    persist()
      // Not onSaved: for a new case that moves to the case's own address, and the person is on their way elsewhere.
      .then(() => blocker.proceed())
      .catch((caught: unknown) => {
        const errors = toFormErrors(caught);
        setLeaveFailed(errors.form ?? Object.values(errors.fields)[0] ?? "The draft couldn't be saved.");
      })
      .finally(() => {
        savingOnLeave.current = false;
      });
    // persist reads the form as it stands when the leaving starts, which is the form to keep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function goTo(id: string) {
    setFormError(undefined);
    setJustSaved(false);
    setTried(null);
    setCurrentId(id);
    body.current?.scrollTo({ top: 0 });
  }

  /**
   * Continue is always there to press. With a required detail missing it stays on the step, marks every missing field
   * and lists them at the top; with everything in, it moves on.
   */
  const nextId = () => steps[index + 1]?.id ?? REVIEW.id;
  const previousId = () => steps[index - 1]?.id ?? steps[0]?.id ?? "client";

  function proceed() {
    if (current.complete) {
      goTo(nextId());
      return;
    }
    setTouched((seen) => new Set([...seen, ...current.fields]));
    setTried(current.id);
    body.current?.scrollTo({ top: 0, behavior: "smooth" });
    // The first field still missing takes the focus, once its error is drawn.
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus({ preventScroll: true }));
  }

  function trySubmit() {
    if (everyStepComplete) {
      void submitDetails();
      return;
    }
    setTried(REVIEW.id);
    body.current?.scrollTo({ top: 0, behavior: "smooth" });
  }
  const missingHere = tried === current.id ? current.fields.map((key) => review.problems[key]).filter(Boolean) : [];
  const unfinished = tried === REVIEW.id && current.id === REVIEW.id ? review.steps.filter((step) => !step.complete) : [];
  const firstToFinish = () => steps.find((step) => !step.complete && !step.question)?.id ?? REVIEW.id;

  const start = useStartOnboardingCase<ApiError>();
  const save = useSaveOnboardingDraft<ApiError>();
  const submit = useSubmitOnboardingCase<ApiError>();
  const busy = start.isPending || save.isPending || submit.isPending;

  const field = (id: string) => ({
    error: touched.has(id) ? (review.problems[id] ?? serverErrors[id]) : undefined,
    onBlur: () => setTouched((seen) => (seen.has(id) ? seen : new Set(seen).add(id))),
  });

  // Every change keeps one risk questionnaire for each account holder, named for them (25 Nov 2026).
  function change(update: (current: FormApplication) => FormApplication) {
    setServerErrors({});
    setApplication((current) => oneQuestionnaireEach(update(current)));
  }
  const changeHolder = (at: number, patch: Partial<FormHolder>) =>
    change((current) => ({ ...current, holders: current.holders.map((holder, i) => (i === at ? { ...holder, ...patch } : holder)) }));
  const changeEntity = (patch: Partial<FormEntity>) => change((current) => ({ ...current, entity: { ...current.entity, ...patch } }));
  const changeOwner = (at: number, patch: Partial<FormHolder>) =>
    change((current) => ({ ...current, beneficialOwners: current.beneficialOwners.map((owner, i) => (i === at ? { ...owner, ...patch } : owner)) }));
  const changeRiskProfile = (at: number, patch: Partial<FormRiskProfile>) =>
    change((current) => ({ ...current, riskProfiles: current.riskProfiles.map((profile, i) => (i === at ? { ...profile, ...patch } : profile)) }));

  /**
   * "Is there another account holder?" (24 Nov 2026). Add opens the next one: a joint holder Prospective Clients
   * brought, waiting to be asked about, or a new one.
   */
  function addHolder() {
    const waiting = application.holders.findIndex((_, i) => i > 0 && !shown.includes(i));
    if (waiting > 0) {
      const holder = application.holders[waiting]!;
      changeHolder(waiting, { details: { ...holder.details, skipped: false } });
      setAdded((seen) => new Set(seen).add(waiting));
      goTo(`holder-${waiting}-name`);
      return;
    }
    if (application.holders.length >= MOST_HOLDERS) return;
    const next = application.holders.length;
    change((current) => ({ ...current, holders: [...current.holders, emptyHolder()] }));
    setAdded((seen) => new Set(seen).add(next));
    goTo(`holder-${next}-name`);
  }

  /**
   * Skip goes to the risk questionnaires, Client 1's first. Anyone Prospective Clients brought who wasn't added stays
   * on the account by name only, as a skipped holder, with a questionnaire of their own (25 Nov 2026).
   */
  function skipToRisk() {
    const leaving = application.holders.flatMap((_, i) => (i > 0 && !shown.includes(i) ? [i] : []));
    change((current) => ({
      ...current,
      holders: current.holders.map((holder, i) => (leaving.includes(i) ? { ...holder, details: { ...holder.details, skipped: true } } : holder)),
    }));
    goTo("risk-0-knowledge");
  }

  /**
   * "Is there another beneficial owner?" (25 Nov 2026). Add opens the next one: an owner Prospective Clients named,
   * waiting to be asked about, or a new one, up to the questionnaire's three.
   */
  function addOwner() {
    const waiting = application.beneficialOwners.findIndex((_, i) => i > 0 && !owners.includes(i));
    if (waiting > 0) {
      setAddedOwners((seen) => new Set(seen).add(waiting));
      goTo(`owner-${waiting}-name`);
      return;
    }
    if (application.beneficialOwners.length >= MOST_OWNERS) return;
    const next = application.beneficialOwners.length;
    change((current) => ({ ...current, beneficialOwners: [...current.beneficialOwners, emptyHolder()] }));
    setAddedOwners((seen) => new Set(seen).add(next));
    goTo(`owner-${next}-name`);
  }

  /** Skip goes to the entity's questionnaire; owners Prospective Clients named who weren't added are left off the form. */
  function skipToEntityRisk() {
    const keep = new Set(owners);
    change((current) => ({ ...current, beneficialOwners: current.beneficialOwners.filter((_, i) => keep.has(i)) }));
    goTo("risk-0-knowledge");
  }

  function showServerErrors(caught: unknown, fallback: string) {
    const errors = toFormErrors(caught);
    setServerErrors(errors.fields);
    setTouched((seen) => new Set([...seen, ...Object.keys(errors.fields)]));
    setFormError(errors.form ?? fallback);
    // Opens the step with the first problem the server found, such as an email another customer already has.
    const first = Object.keys(errors.fields)[0];
    if (first) setCurrentId(inFlow.has(stepOfField(first, entity)) ? stepOfField(first, entity) : firstToFinish());
    body.current?.scrollTo({ top: 0 });
  }

  async function persist() {
    const snapshot = JSON.stringify(application);
    const detail = caseId ? await save.mutateAsync({ id: caseId, data: application }) : await start.mutateAsync({ data: application });
    setSavedJson(snapshot);
    unsaved.current = false;
    return detail;
  }

  async function saveDraft() {
    setFormError(undefined);
    try {
      const detail = await persist();
      setJustSaved(true);
      onSaved(detail, false);
    } catch (caught) {
      showServerErrors(caught, "Couldn't save the draft. Try again.");
    }
  }

  async function submitDetails() {
    setFormError(undefined);
    let draft: CaseDetail | undefined;
    try {
      draft = caseId ? undefined : await persist();
      const id = caseId ?? draft?.summary.id;
      if (!id) return;
      const submitted = await submit.mutateAsync({ id, data: tidy(application) });
      unsaved.current = false;
      setSavedJson(JSON.stringify(application));
      onSaved(submitted, true);
    } catch (caught) {
      if (draft) onSaved(draft, false);
      showServerErrors(caught, "Some details need attention before you can submit.");
    }
  }

  function renderStep() {
    if (current.id === "client") {
      return <ClientTypeStep application={application} managers={managers} onChange={(patch) => change((app) => ({ ...app, ...patch }))} field={field} />;
    }
    if (current.id === "review") {
      return <ApplicationSummary application={application} managers={managers} onEdit={goTo} />;
    }
    // An entity's form (25 Nov 2026): Schedule 2(A), then the self-certification and its Annexes.
    const company = /^entity-(\w+)$/.exec(current.id)?.[1];
    if (company) {
      const CompanyStep = companySteps[company as keyof typeof companySteps];
      return CompanyStep ? <CompanyStep entity={application.entity} onChange={changeEntity} field={field} /> : null;
    }
    const certifying = /^sc-(\w+)$/.exec(current.id)?.[1];
    if (certifying) {
      const CertStep = selfCertSteps[certifying as keyof typeof selfCertSteps];
      return CertStep ? <CertStep entity={application.entity} onChange={changeEntity} field={field} owners={owners.map((i) => application.beneficialOwners[i]!)} /> : null;
    }
    const holderCert = /^holdercert-(\d+)-(\w+)$/.exec(current.id);
    if (holderCert) {
      const at = Number(holderCert[1]);
      const holder = application.holders[at];
      const CertStep = holderCertSteps[holderCert[2] as keyof typeof holderCertSteps];
      return holder && CertStep ? <CertStep index={at} holder={holder} onChange={(patch: Partial<FormHolder>) => changeHolder(at, patch)} field={field} /> : null;
    }
    const annex = /^cp-(\d+)-(\w+)$/.exec(current.id);
    if (annex) {
      const AnnexStep = annexSteps[annex[2] as keyof typeof annexSteps];
      return AnnexStep ? <AnnexStep entity={application.entity} onChange={changeEntity} field={field} place={Number(annex[1])} /> : null;
    }
    if (current.id === "signing") {
      return (
        <SigningAuthorityStep
          application={application}
          onChange={(patch) => change((app) => ({ ...app, signingAuthority: { ...app.signingAuthority, ...patch } }))}
          onHolder={changeHolder}
          field={field}
        />
      );
    }
    const risk = /^risk-(\d+)-(\w+)$/.exec(current.id);
    if (risk) {
      const at = Number(risk[1]);
      const profile = application.riskProfiles[at];
      if (!profile) return null;
      const onRiskChange = (patch: Partial<FormRiskProfile>) => changeRiskProfile(at, patch);
      // The entity's own questionnaire (25 Nov 2026): Part A for each owner, its third question, and page 14.
      if (entity) {
        const props = { index: at, profile, onChange: onRiskChange, field };
        const names = owners.map((i, place) => application.beneficialOwners[i]?.fullName?.trim() || `Beneficial owner ${place + 1}`);
        switch (risk[2]) {
          case "knowledge": return <RiskKnowledgeStep {...props} owners={names} />;
          case "ability": return <RiskAbilityStep {...props} entity />;
          case "tolerance": return <RiskToleranceStep {...props} />;
          case "profile": return <RiskResultStep {...props} withDeclaration={false} />;
          case "exclusions": return <RiskExclusionsStep {...props} />;
          case "declaration": return <RiskDeclarationStep {...props} />;
          case "leverage": return <RiskLeverageStep {...props} entity />;
          default: return null;
        }
      }
      const RiskStep = riskSteps[risk[2] as keyof typeof riskSteps];
      return RiskStep ? <RiskStep index={at} profile={profile} onChange={onRiskChange} field={field} /> : null;
    }
    const [, kind, personIndex, part] = /^(holder|owner)-(\d+)-(\w+)$/.exec(current.id) ?? [];
    const at = Number(personIndex);
    const Step = holderSteps[part as keyof typeof holderSteps];
    if (!Step) return null;
    if (kind === "owner") {
      const owner = application.beneficialOwners[at];
      return owner ? <Step index={at} list="beneficialOwners" holder={owner} onChange={(patch: Partial<FormHolder>) => changeOwner(at, patch)} field={field} /> : null;
    }
    const holder = application.holders[at];
    if (!holder) return null;
    return <Step index={at} holder={holder} onChange={(patch: Partial<FormHolder>) => changeHolder(at, patch)} field={field} />;
  }

  // A risk questionnaire's steps carry whose it is beside the title.
  const riskText = /^risk-(\d+)-/.exec(current.id)?.[1];
  const filledInFor = riskText === undefined ? null
    : entity ? application.entity.legalName?.trim() || "the entity"
      : application.riskProfiles[Number(riskText)]?.filledInFor?.trim() || null;

  // The form is filled in order: a step opens once every step before it is complete. "Review & submit" is never
  // complete, so once the real steps are done everything can be reached.
  const firstUnfinished = steps.findIndex((step) => !step.complete);
  const openUpTo = firstUnfinished === -1 ? steps.length - 1 : firstUnfinished;
  // The bar along the top is the steps of this part of the form: this client's ten, a questionnaire's five or six,
  // or the one step of the rest. A question between parts has none.
  const ofGroup = steps.map((step, position) => ({ step, position })).filter(({ step }) => step.group === current.group && !step.question);
  const inGroup = ofGroup.findIndex(({ step }) => step.id === current.id) + 1;
  const names = application.clientType === "ENTITY"
    ? application.entity.legalName?.trim() || "New entity"
    : shown.map((at) => application.holders[at]?.fullName?.trim()).filter(Boolean).join(" & ") || "New client";
  // What has been gone through, a chip for each part before this one: Client 1 · Asha Verma ✓ → …
  const trail: { group: string; label: string; complete: boolean }[] = [];
  for (const step of steps.slice(0, index)) {
    if (step.group === current.group) continue;
    const last = trail.at(-1);
    if (last?.group === step.group) {
      last.complete &&= step.complete;
      continue;
    }
    const client = /^Client (\d+)/.exec(step.group)?.[1];
    const owner = /^Beneficial owner (\d+)/.exec(step.group)?.[1];
    const controller = /^cp-(\d+)-/.exec(step.id)?.[1];
    const certifyingHolder = /^holdercert-(\d+)-/.exec(step.id)?.[1];
    const questionnaire = /^Risk questionnaire (\d+)/.exec(step.group)?.[1];
    const label = client ? `${step.group} · ${application.holders[Number(client) - 1]?.fullName?.trim() ?? ""}`
      : owner ? `${step.group} · ${application.beneficialOwners[Number(owner) - 1]?.fullName?.trim() ?? ""}`
        : certifyingHolder ? `Self-certification · ${application.holders[Number(certifyingHolder)]?.fullName?.trim() ?? ""}`
        : controller ? `Controlling person · ${application.entity.selfCertification.controllingPersons[Number(controller)]?.fullName?.trim() ?? ""}`
          : questionnaire ? `Risk questionnaire · ${application.riskProfiles[Number(questionnaire) - 1]?.filledInFor?.trim() || questionnaire}`
            : step.group === ENTITY_RISK_GROUP ? `Risk questionnaire · ${application.entity.legalName?.trim() || "Entity"}`
              : step.group.startsWith("Company") ? `Company · ${application.entity.legalName?.trim() || ""}`
                : step.group.startsWith("Self-certification") ? "Self-certification"
                  : step.label;
    trail.push({ group: step.group, label, complete: step.complete });
  }

  // "Download document" (24 Nov 2026): the form as the firm's paper has it, saved as a PDF named after the client.
  const [downloading, setDownloading] = useState(false);
  function downloaded(failed: boolean) {
    setDownloading(false);
    if (failed) setFormError("Couldn't make the PDF. Try again.");
  }

  // The page behind stays where it is while the pop-up is open, and Escape closes it as the cross does.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      // Escape on a question asked over the pop-up, such as removing a risk profile, closes only that question.
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) navigate(listHref);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate, listHref]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-3 sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="flex max-h-full w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl">
        <header className="px-5 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 id="onboarding-title" className="text-2xl font-bold">Onboarding details</h1>
                {category && <Badge tone="info">{categoryLabels[category]}</Badge>}
              </div>
              <p className="mt-1 truncate text-sm text-ink-muted">
                {names} · {entity ? "the Client Details & Risk Profiling Questionnaire – Entity, one section at a time" : "the Client Details form, one section at a time"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p role="status" className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
                {dirty ? (
                  <><span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />Unsaved changes</>
                ) : caseId ? (
                  <><span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />All changes saved</>
                ) : null}
              </p>
              <button type="button" onClick={() => navigate(listHref)} aria-label="Close" className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {trail.length > 0 && (
            <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Done so far">
              {trail.map((part) => (
                <li key={part.group} className="flex items-center gap-1.5">
                  <span className={cn("rounded-full border px-2.5 py-1", part.complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-ink-muted")}>
                    {part.label}{part.complete && " ✓"}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">→</span>
                </li>
              ))}
              <li><span className="rounded-full bg-primary-600 px-2.5 py-1 font-semibold text-on-accent">{current.group}</span></li>
            </ol>
          )}
          {!current.question && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <ol className="flex flex-wrap gap-1.5" aria-label={`${current.group}: steps`}>
              {ofGroup.map(({ step, position }) => {
                const here = step.id === current.id;
                const locked = position > openUpTo && !here;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => goTo(step.id)}
                      title={`${step.label}${step.skipped ? " (skipped)" : step.complete ? " (complete)" : locked ? " (finish the steps before it first)" : ""}`}
                      aria-current={here ? "step" : undefined}
                      className={cn(
                        "block h-1.5 w-9 rounded-full transition-colors disabled:cursor-not-allowed",
                        here ? "bg-primary-600" : step.skipped ? "bg-slate-300" : step.complete ? "bg-emerald-500" : "bg-slate-200",
                      )}
                    >
                      <span className="sr-only">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
              Step {inGroup} of {ofGroup.length}
            </p>
          </div>
          )}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-primary-600 uppercase">{current.group}</p>
              <h2 id="step-title" className="mt-1 text-xl font-bold">{current.label}</h2>
            </div>
            {filledInFor && !current.question && (
              <p className="max-w-full truncate rounded-full border border-line bg-slate-50 px-3 py-1 text-xs text-ink-soft">
                Filled in for <span className="font-semibold text-ink">{filledInFor}</span>
                {entity && " · the entity"}
              </p>
            )}
          </div>
        </header>

        {/* Labels as the design has them, in sentence case, on every step of this form and nowhere else. */}
        <div ref={body} key={current.id} className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pt-4 pb-1 sm:px-8", SENTENCE_LABELS)}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          {missingHere.length > 0 && (
            <Alert tone="danger">
              <p className="font-semibold">Fill in {missingHere.length === 1 ? "this required detail" : `these ${missingHere.length} required details`} to continue:</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {missingHere.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </Alert>
          )}
          {unfinished.length > 0 && (
            <Alert tone="danger">
              <p className="font-semibold">Some steps still need details before this can be submitted:</p>
              <ul className="mt-1.5 space-y-0.5">
                {unfinished.map((step) => (
                  <li key={step.id}>
                    {inFlow.has(step.id) ? (
                      <button type="button" onClick={() => goTo(step.id)} className="font-semibold underline underline-offset-2">
                        {step.group} · {step.label}
                      </button>
                    ) : <span className="font-semibold">{step.group} · {step.label}</span>}
                    {" "}— {step.fields.length} missing
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {current.question === "more" ? (
            <FlowQuestion
              question="Is there another account holder?"
              hint={current.after === 0 ? "Add one for a joint account, or skip to the risk questionnaire." : "Add one more, or go on to the risk questionnaire."}
              yes={{
                label: "+ Add another account holder",
                hint: application.holders.length < MOST_HOLDERS || shown.length < application.holders.length
                  ? `Opens Client ${shown.length + 1}'s details.` : `An account can have up to ${MOST_HOLDERS} holders.`,
                onClick: addHolder,
                disabled: application.holders.length >= MOST_HOLDERS && shown.length >= application.holders.length,
              }}
              no={{ label: "Skip → risk questionnaire", hint: current.after === 0 ? "No other account holders." : "No more account holders.", onClick: skipToRisk }}
            />
          ) : current.question === "moreOwners" ? (
            <FlowQuestion
              question="Is there another beneficial owner?"
              hint="Add one, or go on to the entity's risk questionnaire."
              yes={{
                label: "+ Add another beneficial owner",
                hint: owners.length >= MOST_OWNERS ? `The questionnaire has room for ${MOST_OWNERS} beneficial owners (I, II and III).`
                  : application.beneficialOwners.length > owners.length
                    ? `Opens ${application.beneficialOwners.find((_, i) => i > 0 && !owners.includes(i))?.fullName?.trim() || "the next one"}'s details, named in Prospective Clients.`
                    : `Opens Beneficial owner ${owners.length + 1}'s details.`,
                onClick: addOwner,
                disabled: owners.length >= MOST_OWNERS,
              }}
              no={{ label: "Skip → risk questionnaire", hint: current.after === 0 ? "No other beneficial owners." : "No more beneficial owners.", onClick: skipToEntityRisk }}
            />
          ) : current.id === "review" ? renderStep() : <div className="rounded-2xl border border-line px-5 py-5 sm:px-6">{renderStep()}</div>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-5 sm:px-8 sm:pb-6">
          <Button variant="secondary" className="rounded-full" onClick={() => goTo(previousId())} disabled={index === 0 || busy}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              {justSaved && !dirty && (
                <>
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                  Draft saved
                </>
              )}
            </span>
            {current.id === "review" && (
              <Button variant="secondary" className="rounded-full" onClick={() => { setFormError(undefined); setDownloading(true); }} disabled={downloading}>
                <Download aria-hidden="true" />
                {downloading ? "Preparing PDF…" : "Download document"}
              </Button>
            )}
            <Button variant="secondary" className="rounded-full" onClick={() => void saveDraft()} disabled={busy}>
              <FileText aria-hidden="true" />
              {start.isPending || save.isPending ? "Saving…" : "Save draft"}
            </Button>
            {current.question ? null : current.id === "review" ? (
              <Button className="rounded-full" onClick={trySubmit} disabled={busy}>
                {submit.isPending ? "Submitting…" : "Submit"}
              </Button>
            ) : (
              <Button className="rounded-full" onClick={proceed}>
                Next
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </footer>
      </section>

      {downloading && <OnboardingPdf application={application} fileName={`${entity ? ENTITY_DOCUMENT_TITLE : DOCUMENT_TITLE} - ${names}.pdf`} onDone={downloaded} />}

      <ConfirmDialog
        open={blocker.state === "blocked" && leaveFailed !== undefined}
        title="The draft couldn't be saved"
        description={`${leaveFailed ?? ""} Stay to put it right, or leave without saving the changes since the last save.`}
        confirmLabel="Leave without saving"
        tone="danger"
        onConfirm={() => {
          setLeaveFailed(undefined);
          blocker.proceed?.();
        }}
        onClose={() => {
          setLeaveFailed(undefined);
          blocker.reset?.();
        }}
      />
    </div>
  );
}

interface FlowChoice {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}

/** A question between parts of the form (24 Nov 2026): two answers, the first one to go on adding. */
function FlowQuestion({ question, hint, yes, no }: { question: string; hint: string; yes: FlowChoice; no: FlowChoice }) {
  const choice = (one: FlowChoice, primary: boolean) => (
    <button type="button" onClick={one.onClick} disabled={one.disabled}
      className={cn("rounded-2xl border p-5 text-left transition-colors hover:border-primary-600 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50",
        primary ? "border-primary-600/40 bg-primary-50" : "border-line bg-white")}>
      <span className="block text-base font-bold text-ink">{one.label}</span>
      <span className="mt-1.5 block text-sm text-ink-muted">{one.hint}</span>
    </button>
  );
  return (
    <div className="pb-2">
      <div className="py-4 text-center">
        <p className="text-xl font-bold text-ink">{question}</p>
        <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      </div>
      <div className="mx-auto mt-2 grid max-w-3xl gap-4 sm:grid-cols-2">
        {choice(yes, true)}
        {choice(no, false)}
      </div>
    </div>
  );
}
