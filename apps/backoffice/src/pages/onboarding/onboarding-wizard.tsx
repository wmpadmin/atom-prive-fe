import { ApiError } from "@atomprive/api-client";
import {
  useSaveOnboardingDraft,
  useStartOnboardingCase,
  useSubmitOnboardingCase,
  type CaseDetail,
  type StaffMember,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn } from "@atomprive/ui";
import { Check, ChevronLeft, ChevronRight, Lock, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router";
import { toFormErrors } from "../../lib/api-errors";
import { ConfirmDialog } from "../config/confirm-dialog";
import {
  emptyHolder,
  holderGroup,
  MAX_HOLDERS,
  reviewApplication,
  stepOfField,
  tidy,
  type FormApplication,
  type FormEntity,
  type FormHolder,
  type ReviewStep,
} from "./application";
import { ApplicationSummary } from "./application-summary";
import { categoryBeingEntered, categoryLabels } from "./case-category";
import {
  BusinessRegulationStep,
  ClientTypeStep,
  ContactStep,
  EntityDetailsStep,
  OccupationStep,
  PersonalDetailsStep,
  RegisteredAddressStep,
} from "./onboarding-steps";

const REVIEW: ReviewStep = { id: "review", group: "Finish", label: "Review & submit", complete: false };

const descriptions: Record<string, string> = {
  client: "Is the client a person or an organisation, and which advisor will look after them?",
  personal: "Who the account holder is, and the document that proves it.",
  occupation: "What they do, and who they work for.",
  contact: "How to reach them, and where they live.",
  "entity-details": "As shown on the certificate of incorporation.",
  "entity-business": "Who regulates the entity, where it does business and what kind of organisation it is.",
  "entity-address": "Where the entity is registered.",
  review: "Check every section. Once submitted, the details can't be changed.",
};

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

/** The onboarding form, one step at a time, with a step list that shows what's complete. */
export function OnboardingWizard({ caseId, initial, managers, listHref, onSaved }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [application, setApplication] = useState(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  // A draft opens where it was left: the first step that still needs details.
  const [currentId, setCurrentId] = useState(() =>
    caseId ? (reviewApplication(initial, undefined).steps.find((step) => !step.complete)?.id ?? REVIEW.id) : "client",
  );
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [removingHolder, setRemovingHolder] = useState<number | null>(null);

  const review = useMemo(() => reviewApplication(application, managers), [application, managers]);
  const steps = [...review.steps, REVIEW];
  const index = Math.max(0, steps.findIndex((step) => step.id === currentId));
  const current = steps[index] ?? REVIEW;
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
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function goTo(id: string) {
    setFormError(undefined);
    setJustSaved(false);
    setCurrentId(id);
    window.scrollTo({ top: 0 });
  }

  const start = useStartOnboardingCase<ApiError>();
  const save = useSaveOnboardingDraft<ApiError>();
  const submit = useSubmitOnboardingCase<ApiError>();
  const busy = start.isPending || save.isPending || submit.isPending;

  const field = (id: string) => ({
    error: touched.has(id) ? (review.problems[id] ?? serverErrors[id]) : undefined,
    onBlur: () => setTouched((seen) => (seen.has(id) ? seen : new Set(seen).add(id))),
  });

  function change(update: (current: FormApplication) => FormApplication) {
    setServerErrors({});
    setApplication(update);
  }
  const changeHolder = (at: number, patch: Partial<FormHolder>) =>
    change((current) => ({ ...current, holders: current.holders.map((holder, i) => (i === at ? { ...holder, ...patch } : holder)) }));
  const changeEntity = (patch: Partial<FormEntity>) => change((current) => ({ ...current, entity: { ...current.entity, ...patch } }));

  function showServerErrors(caught: unknown, fallback: string) {
    const errors = toFormErrors(caught);
    setServerErrors(errors.fields);
    setTouched((seen) => new Set([...seen, ...Object.keys(errors.fields)]));
    setFormError(errors.form ?? fallback);
    // Opens the step with the first problem the server found, such as an email another customer already has.
    const first = Object.keys(errors.fields)[0];
    if (first) setCurrentId(stepOfField(first));
    window.scrollTo({ top: 0 });
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
      window.scrollTo({ top: 0 });
    } catch (caught) {
      if (draft) onSaved(draft, false);
      showServerErrors(caught, "Some details need attention before you can submit.");
    }
  }

  function addHolder() {
    const added = application.holders.length;
    change((current) => ({ ...current, holders: [...current.holders, emptyHolder()] }));
    goTo(`holder-${added}-personal`);
  }

  function removeHolder(at: number) {
    change((current) => ({ ...current, holders: current.holders.filter((_, i) => i !== at) }));
    goTo(`holder-${at - 1}-contact`);
    setRemovingHolder(null);
  }

  function renderStep() {
    if (current.id === "client") {
      return <ClientTypeStep application={application} managers={managers} onChange={(patch) => change((app) => ({ ...app, ...patch }))} field={field} />;
    }
    if (current.id === "review") {
      return <ApplicationSummary application={application} managers={managers} onEdit={goTo} />;
    }
    if (current.id === "entity-details") return <EntityDetailsStep entity={application.entity} onChange={changeEntity} field={field} />;
    if (current.id === "entity-business") return <BusinessRegulationStep entity={application.entity} onChange={changeEntity} field={field} />;
    if (current.id === "entity-address") return <RegisteredAddressStep entity={application.entity} onChange={changeEntity} field={field} />;
    const [, holderIndex, part] = /^holder-(\d+)-(\w+)$/.exec(current.id) ?? [];
    const at = Number(holderIndex);
    const holder = application.holders[at];
    if (!holder) return null;
    const props = { index: at, holder, onChange: (patch: Partial<FormHolder>) => changeHolder(at, patch), field };
    if (part === "personal") return <PersonalDetailsStep {...props} />;
    if (part === "occupation") return <OccupationStep {...props} />;
    return <ContactStep {...props} />;
  }

  const kind = /^holder-\d+-(\w+)$/.exec(current.id)?.[1] ?? current.id;
  const canAddHolder = application.clientType !== "ENTITY" && application.holders.length < MAX_HOLDERS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={listHref} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Client onboarding
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[1.625rem] font-bold">Onboard a new client</h1>
            {category && <Badge tone="info">{categoryLabels[category]}</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-muted">Enter the details as verified from the client's NRIC, passport or company documents. Fields marked * are required.</p>
          {category && (
            <p className="mt-1 text-xs text-ink-muted">
              {category === "JOINT"
                ? "A second account holder makes this a joint account, so their forms come from the Joint pack."
                : `Their forms will come from the ${categoryLabels[category]} pack.`}
            </p>
          )}
        </div>
        <p className="text-xs text-ink-muted">{dirty ? "Unsaved changes" : caseId ? "All changes saved" : ""}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <Stepper
          steps={steps}
          currentId={current.id}
          onSelect={goTo}
          canAddHolder={canAddHolder}
          onAddHolder={addHolder}
          onRemoveHolder={setRemovingHolder}
        />

        <section aria-labelledby="step-title" className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-6 py-5">
            <p className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">
              Step {index + 1} of {steps.length} · {current.group}
            </p>
            <h2 id="step-title" className="mt-1 text-2xl leading-tight font-bold">
              {current.label}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">{descriptions[kind]}</p>
          </div>

          <div key={current.id} className="space-y-6 px-6 py-6">
            {formError && <Alert tone="danger">{formError}</Alert>}
            {renderStep()}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate(listHref)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => void saveDraft()} disabled={busy}>
                {start.isPending || save.isPending ? "Saving…" : "Save draft"}
              </Button>
              <span role="status" className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                {justSaved && !dirty && (
                  <>
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    Draft saved
                  </>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => goTo(steps[index - 1]?.id ?? "client")} disabled={index === 0 || busy}>
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
              {current.id === "review" ? (
                <Button onClick={() => void submitDetails()} disabled={!everyStepComplete || busy}>
                  {submit.isPending ? "Submitting…" : "Submit"}
                </Button>
              ) : (
                <Button onClick={() => goTo(steps[index + 1]?.id ?? REVIEW.id)} disabled={!current.complete}>
                  Continue
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description="The changes since you last saved will be lost. Save a draft first to keep them."
        confirmLabel="Leave"
        tone="danger"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      />
      <ConfirmDialog
        open={removingHolder !== null}
        title={`Remove ${removingHolder === null ? "account holder" : holderGroup(removingHolder).toLowerCase()}?`}
        description="Everything entered for them is removed from this application."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => removingHolder !== null && removeHolder(removingHolder)}
        onClose={() => setRemovingHolder(null)}
      />
    </div>
  );
}

interface StepperProps {
  steps: ReviewStep[];
  currentId: string;
  onSelect: (id: string) => void;
  canAddHolder: boolean;
  onAddHolder: () => void;
  onRemoveHolder: (index: number) => void;
}

function Stepper({ steps, currentId, onSelect, canAddHolder, onAddHolder, onRemoveHolder }: StepperProps) {
  // The form is filled in order: a step only opens once every step before it is complete. "Review & submit" is
  // never complete, so once the real steps are done it is the last one open and everything can be reached.
  const firstUnfinished = steps.findIndex((step) => !step.complete);
  const openUpTo = firstUnfinished === -1 ? steps.length - 1 : firstUnfinished;
  // A new account holder's steps go on the end, so there is nothing unfinished left to jump over.
  const canAddHolderNow = canAddHolder && openUpTo === steps.length - 1;
  const groups: { name: string; holder: number | null; steps: (ReviewStep & { number: number })[] }[] = [];
  steps.forEach((step, position) => {
    const last = groups.at(-1);
    if (last?.name === step.group) {
      last.steps.push({ ...step, number: position + 1 });
    } else {
      const holder = /^holder-(\d+)-/.exec(step.id)?.[1];
      groups.push({ name: step.group, holder: holder === undefined ? null : Number(holder), steps: [{ ...step, number: position + 1 }] });
    }
  });

  return (
    <nav aria-label="Onboarding steps" className="space-y-4 rounded-2xl border border-line bg-white p-3 lg:sticky lg:top-6">
      {groups.map((group) => (
        <div key={group.name}>
          <div className="flex min-h-6 items-center justify-between gap-2 px-3 pb-1">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{group.name}</p>
            {group.holder !== null && group.holder > 0 && (
              <button
                type="button"
                onClick={() => onRemoveHolder(group.holder ?? 0)}
                aria-label={`Remove ${group.name.toLowerCase()}`}
                className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
          <ol className="space-y-0.5">
            {group.steps.map((step) => {
              const current = step.id === currentId;
              // The step being shown always stays reachable, even if a change has just left an earlier one unfinished.
              const locked = step.number - 1 > openUpTo && !current;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    disabled={locked}
                    title={locked ? "Finish the steps before this one first." : undefined}
                    onClick={() => onSelect(step.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                      current ? "bg-primary-50 font-semibold text-primary-700" : "text-ink-soft",
                      locked ? "cursor-not-allowed text-ink-muted opacity-55" : !current && "hover:bg-slate-50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-2xs font-bold",
                        step.complete ? "bg-emerald-500 text-white" : current ? "bg-primary-600 text-white" : "bg-slate-100 text-ink-muted",
                      )}
                    >
                      {step.complete ? <Check className="size-3.5" strokeWidth={3} /> : step.number}
                    </span>
                    <span className="min-w-0 flex-1">{step.label}</span>
                    {locked && <Lock aria-hidden="true" className="size-3.5 shrink-0" />}
                    <span className="sr-only">
                      {step.complete ? "(complete)" : locked ? "(locked until the steps before it are done)" : "(to do)"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {canAddHolder && group.holder !== null && !steps.some((step) => step.id === `holder-${group.holder! + 1}-personal`) && (
            <button
              type="button"
              onClick={onAddHolder}
              disabled={!canAddHolderNow}
              title={canAddHolderNow ? undefined : "Finish this account holder's details first."}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-semibold transition-colors",
                canAddHolderNow
                  ? "text-primary-600 hover:border-primary-600 hover:bg-primary-50"
                  : "cursor-not-allowed text-ink-muted opacity-55",
              )}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              Add account holder
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
