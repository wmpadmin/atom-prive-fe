import { ApiError } from "@atomprive/api-client";
import {
  getGetFormQueryKey,
  getListFormsQueryKey,
  useGetDocumentText,
  useGetForm,
  useAttachToForm,
  useChangeCaseForm,
  useRemoveFormAttachment,
  useSaveFormDraft,
  type DocumentText,
  type DocumentGap,
  type DocumentTextKind,
  type FormDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, PencilLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { FILLS_CLIENT_FORMS, ONBOARDS_CLIENTS_CHANGE, clientFileHref, hasAnyAuthority } from "../../lib/permissions";
import { StepRail } from "../../components/step-rail";
import { FormComments } from "../../components/form-comments";
import type { FormDocuments } from "../../components/form-documents";
import type { FieldFor } from "../../components/form-fields";
import { FirmContext } from "./firm-name";
import { toFormErrors } from "../../lib/api-errors";
import { formatDate } from "../../lib/labels";
import type { FormStep } from "./account-opening-entity";
import { ConfirmDialog } from "../config/confirm-dialog";
import { formStatus } from "./form-labels";
import {
  accountOpeningKit,
  clientClassificationKit,
  accountOpeningIndividualKit,
  dfsaChecklistIndividualKit,
  dfsaChecklistKit,
  dueDiligenceKit,
  customerIdentificationKit,
  dueDiligenceIndividualKit,
  fatcaCrsIndividualKit,
  professionalClientConfirmationKit,
  fatcaCrsKit,
  riskProfileKit,
  type FormKit,
} from "./form-kits";

const REVIEW: FormStep = { id: "review", group: "Finish", label: "Review & submit", complete: false };

const CHECK_IT_OVER = "Check every section. Once it is submitted, the form can't be changed.";

/** One form from the client pack, filled in a section at a time. */
export function FormPage() {
  // Opened from a case's checklist, the form sits under that case: Back goes to the checklist, and the menu
  // still says Client onboarding.
  const { formId = "", caseId: cameFromCase, clientId: cameFromClient } = useParams();
  // Compliance reach a form from a client's file to read it, never to fill it in.
  const fromKyc = useLocation().pathname.startsWith("/kyc/");
  // Opened from a pack in To sign, which is where Back goes while a form is being read to be signed.
  const fromPack = useSearchParams()[0].get("pack") ?? undefined;
  const detail = useGetForm<FormDetail, ApiError>(formId);

  if (!detail.data) {
    return (
      <div className="space-y-4">
        <BackLink caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} fromPack={fromPack} />
        {detail.isError ? (
          <Alert tone="danger">{detail.error.status === 404 ? "This form doesn't exist." : detail.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the form…</p>
        )}
      </div>
    );
  }
  // An agreement, a mandate or the disclosure is signed as it stands, so there is no wizard for it and no
  // answers to read back: it is read as its own wording. Falling through to the switch below put it in the
  // account-opening form, which showed its sections with every line dashed because nothing had ever been
  // answered into them.
  if (!detail.data.summary.readyToFill) {
    const client = cameFromClient ?? detail.data.summary.customerId;
    // The pack goes with it, so Back there still returns to the forms waiting on a signature.
    const where = `/clients/${client}/documents/${detail.data.summary.kind}`;
    return <Navigate replace to={fromPack ? `${where}?pack=${fromPack}` : where} />;
  }
  // Keyed by the form and where it has got to: opening another form, or taking this one back to be filled in
  // again, starts from the answers the API holds rather than the ones on screen.
  const key = `${formId}:${detail.data.summary.status}`;
  switch (detail.data.summary.kind) {
    case "CUSTOMER_DUE_DILIGENCE_ENTITY":
      return <FilledForm key={key} kit={dueDiligenceKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "FATCA_CRS_ENTITY":
      return <FilledForm key={key} kit={fatcaCrsKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    // One self-certification for the account, whoever holds it: the form names each holder in turn.
    case "FATCA_CRS_INDIVIDUAL":
      return <FilledForm key={key} kit={fatcaCrsIndividualKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "CUSTOMER_DUE_DILIGENCE_INDIVIDUAL":
      return <FilledForm key={key} kit={dueDiligenceIndividualKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    // One identification form for the account, whoever holds it: it is filled in for each of them in turn.
    case "CUSTOMER_IDENTIFICATION_INDIVIDUAL":
      return <FilledForm key={key} kit={customerIdentificationKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "PROFESSIONAL_CLIENT_CONFIRMATION_JOINT":
      return <FilledForm key={key} kit={professionalClientConfirmationKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "INVESTMENT_RISK_PROFILE":
      return <FilledForm key={key} kit={riskProfileKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "CLIENT_CLASSIFICATION":
      return <FilledForm key={key} kit={clientClassificationKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "DFSA_ONBOARDING_CHECKLIST_ENTITY":
      return <FilledForm key={key} kit={dfsaChecklistKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "ACCOUNT_OPENING_INDIVIDUAL":
      return <FilledForm key={key} kit={accountOpeningIndividualKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    case "DFSA_ONBOARDING_CHECKLIST_INDIVIDUAL":
      return <FilledForm key={key} kit={dfsaChecklistIndividualKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
    default:
      return <FilledForm key={key} kit={accountOpeningKit} detail={detail.data} caseId={cameFromCase} clientId={cameFromClient} fromKyc={fromKyc} />;
  }
}

/** The wizard itself: the same rail, saving and sending whichever form of the pack is being filled in. */
function FilledForm<T>({
  kit,
  detail,
  caseId,
  clientId,
  fromKyc,
}: {
  kit: FormKit<T>;
  detail: FormDetail;
  caseId?: string;
  clientId?: string;
  /** Opened by Compliance from their queue: the form is read to be decided on, not to be worked on. */
  fromKyc?: boolean;
}) {
  const queryClient = useQueryClient();
  const user = useStaffUser();
  const signed = detail.summary.status === "SUBMITTED";
  const withTheAdvisor = detail.summary.status === "AWAITING_SIGNATURE";
  // Once it has left whoever was writing it up — gone to the advisor to sign, out with the client, or signed
  // — it is a record of what was sent, and reads as one until it is filled in again.
  const locked = signed || withTheAdvisor || detail.summary.status === "WAITING_ON_CLIENT";
  const [value, setValue] = useState<T>(() => kit.toValue(detail.answers));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(kit.toValue(detail.answers)));
  // The firm's own name, which the lines of a form that print it are filled out with.
  const wording = useGetDocumentText<DocumentText, ApiError>(detail.summary.kind as DocumentTextKind, {
    customerId: detail.summary.customerId,
  });
  // The firm names itself all through its own paperwork. None of that is taken out: it is asked for here, so
  // it reads as the firm wrote it and can still be changed, and what is typed goes with the form.
  const [firmEdits, setFirmEdits] = useState<Record<string, string>>({});
  const [savedFirmJson, setSavedFirmJson] = useState("{}");
  const firmGaps = useMemo(
    () => (wording.data?.gaps ?? []).filter((gap) => gap.about === "FIRM"),
    [wording.data],
  );
  const firmDetails = useMemo(() => {
    const held: Record<string, string> = {};
    for (const [key, value] of Object.entries(wording.data?.details ?? {})) {
      if (typeof value === "string") held[key] = value;
    }
    return { ...held, ...firmEdits };
  }, [wording.data, firmEdits]);
  const firmName = firmDetails["firmName"]?.trim() ? firmDetails["firmName"]! : null;

  // Some lines of a form ask the client to provide a document, and are answered by the document itself.
  const provided = useMemo(() => new Set(detail.attachments.map((file) => file.field)), [detail.attachments]);
  const review = useMemo(() => kit.review(value, provided), [kit, value, provided]);
  const steps = [...review.steps, REVIEW];
  const [currentId, setCurrentId] = useState(() => review.steps.find((step) => !step.complete)?.id ?? REVIEW.id);
  // The paper form opens each section with its own instructions, so they are shown before the section is filled in.
  const [guidanceFor, setGuidanceFor] = useState<string | null>(() => {
    const opensAt = review.steps.find((step) => !step.complete)?.group ?? REVIEW.group;
    return kit.guidance[opensAt] ? opensAt : null;
  });
  const [guidanceSeen, setGuidanceSeen] = useState<ReadonlySet<string>>(
    () => new Set([review.steps.find((step) => !step.complete)?.group ?? REVIEW.group]),
  );
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  // Which parts have actually been opened and moved on from. A part that asks nothing, or that the client's own
  // record already answers, is complete before anybody has looked at it; ticking it then says work has been done
  // that nobody has done. The tick waits until the part has been through.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const index = Math.max(0, steps.findIndex((step) => step.id === currentId));
  const current = steps[index] ?? REVIEW;
  const everythingDone = review.steps.every((step) => step.complete);
  // The rail shows a tick only where the part is both answered and has been read through; everything else —
  // which part opens first, what is left to answer, and whether it can be submitted — goes on the answers alone.
  const shownSteps = steps.map((step) => ({ ...step, complete: step.complete && seen.has(step.id) }));
  // What was typed about the firm is part of what is saved, so changing it counts as a change to the form.
  const dirty = JSON.stringify(value) !== savedJson || JSON.stringify(firmEdits) !== savedFirmJson;

  // Opened from To sign, which is what a comment left here is recorded against: the pack is where the form
  // was being read when somebody asked for the change.
  const readFromPack = useSearchParams()[0].get("pack") ?? undefined;
  // Whoever may fill a client's forms in may also ask for a change to one. An advisor holds that over their
  // own clients rather than at change, so asking only for change left them reading with nothing to say.
  // Compliance read every form and hold neither, so they read the comments without adding to them.
  const canChange = !fromKyc && hasAnyAuthority(user, ...FILLS_CLIENT_FORMS, ...ONBOARDS_CLIENTS_CHANGE);

  const reopen = useChangeCaseForm<ApiError>();
  const onCase = detail.summary.onboardingCaseId;
  // A form with the advisor is nobody's to edit — not the advisor reading it in To sign, and not whoever
  // wrote it up. They sign it or send it back saying what is wrong, and sending it back is what opens it
  // again. An Edit here would let either side change a form out from under the other one's signature.
  const canWorkOnIt = Boolean(onCase) && !withTheAdvisor;

  /** Puts the form back to being filled in, so it can be corrected and sent out afresh. */
  function fillItInAgain() {
    if (!onCase) return;
    reopen.mutate(
      {
        caseId: onCase,
        kind: detail.summary.kind,
        // A finished form is unpicked by taking its signed copy off; one still out is simply taken back.
        data: signed
          ? { customerId: detail.summary.customerId, dueOn: null, waitingOnClient: null, signedCopyOnFile: false, answers: null }
          : { customerId: detail.summary.customerId, dueOn: null, waitingOnClient: false, signedCopyOnFile: null, answers: null },
      },
      {
        onSuccess: () => {
          setEditing(false);
          void queryClient.invalidateQueries({ queryKey: getGetFormQueryKey(detail.summary.id) });
          void queryClient.invalidateQueries({ queryKey: getListFormsQueryKey() });
        },
      },
    );
  }

  const save = useSaveFormDraft<ApiError>();
  // A finished form goes to the client's advisor to be signed; nothing holds it up on the way.
  const busy = save.isPending;

  // An attached document is kept straight away: it is the client's paper, not a draft answer.
  const keptNow = (saved: FormDetail) => queryClient.setQueryData(getGetFormQueryKey(saved.summary.id), saved);
  const attach = useAttachToForm<ApiError>({ mutation: { onSuccess: keptNow } });
  const takeOff = useRemoveFormAttachment<ApiError>({ mutation: { onSuccess: keptNow } });
  const documents: FormDocuments = {
    files: detail.attachments,
    busy: attach.isPending || takeOff.isPending,
    error: attach.error?.message ?? takeOff.error?.message,
    attach: (field, file) =>
      attach.mutate({ id: detail.summary.id, params: { field }, data: { file } }),
    remove: (attachmentId) => takeOff.mutate({ id: detail.summary.id, attachmentId }),
  };

  const unsaved = useRef(dirty);
  useEffect(() => {
    unsaved.current = dirty;
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const field: FieldFor = (id) => ({
    error: touched.has(id) ? (review.problems[id] ?? serverErrors[id]) : undefined,
    onBlur: () => setTouched((seen) => (seen.has(id) ? seen : new Set(seen).add(id))),
  });

  /**
   * The line under a part's heading. A form that asks the same part of every account holder names its steps
   * for the holder they belong to, so the part's own name is what is left after the holder.
   */
  function describes(id: string) {
    return kit.descriptions[id] ?? kit.descriptions[id.slice(id.lastIndexOf(".") + 1)];
  }

  function goTo(id: string) {
    setFormError(undefined);
    setJustSaved(false);
    // Leaving a part is what counts as having read it, whether by Continue, Back, or the rail.
    setSeen((already) => new Set(already).add(currentId));
    setCurrentId(id);
    const group = steps.find((step) => step.id === id)?.group;
    if (group && kit.guidance[group] && !guidanceSeen.has(group)) {
      setGuidanceSeen((seen) => new Set(seen).add(group));
      setGuidanceFor(group);
    }
    window.scrollTo({ top: 0 });
  }

  function change(patch: Partial<T>) {
    setServerErrors({});
    setValue((current) => ({ ...current, ...patch }));
  }

  function afterWrite(saved: FormDetail) {
    setSavedJson(JSON.stringify(value));
    unsaved.current = false;
    queryClient.setQueryData(getGetFormQueryKey(saved.summary.id), saved);
    void queryClient.invalidateQueries({ queryKey: getListFormsQueryKey() });
  }

  function failed(caught: unknown, fallback: string) {
    const errors = toFormErrors(caught);
    setServerErrors(errors.fields);
    setTouched((seen) => new Set([...seen, ...Object.keys(errors.fields)]));
    setFormError(errors.form ?? fallback);
    const first = Object.keys(errors.fields)[0];
    if (first) setCurrentId(kit.stepOfField(first));
    window.scrollTo({ top: 0 });
  }

  /** The form's own answers, with whatever was typed about the firm alongside them. */
  function answersToSave(): Record<string, unknown> {
    return { ...(value as unknown as Record<string, unknown>), ...firmEdits };
  }

  function saveDraft() {
    setFormError(undefined);
    save.mutate(
      { id: detail.summary.id, data: { answers: answersToSave(), dueOn: null } },
      {
        onSuccess: (saved) => {
          afterWrite(saved);
          setSavedFirmJson(JSON.stringify(firmEdits));
          setJustSaved(true);
        },
        onError: (caught) => failed(caught, "Couldn't save the draft. Try again."),
      },
    );
  }

  /** Written up and sent to the client's advisor to be signed. */

  const header = (
    <header className="space-y-3">
      <BackLink caseId={caseId} clientId={clientId} fromKyc={fromKyc} fromPack={readFromPack} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-white px-5 py-3.5">
        <h1 className="text-base font-bold">{detail.summary.formTitle}</h1>
        <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
        <p className="text-sm text-ink-muted">
          {detail.summary.clientName} · <span className="font-mono text-xs">{detail.summary.clientCode}</span>
        </p>
        <span className="flex-grow" />
        <span className="font-mono text-xs tracking-wide text-ink-muted">{detail.summary.reference}</span>
        <Badge tone={formStatus(detail.summary.status, detail.summary.dueOn).tone}>
          {formStatus(detail.summary.status, detail.summary.dueOn).label}
        </Badge>
        {!locked && (
          <>
            <span role="status" className="text-xs text-ink-muted">
              {justSaved && !dirty ? "Draft saved" : dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <Button variant="secondary" size="sm" onClick={saveDraft} disabled={busy}>
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
          </>
        )}
        {locked && canWorkOnIt && !fromKyc && (
          <Button variant="secondary" size="sm" disabled={reopen.isPending} onClick={() => setEditing(true)}>
            <PencilLine aria-hidden="true" />
            {reopen.isPending ? "Opening…" : "Edit"}
          </Button>
        )}
      </div>
    </header>
  );

  if (locked) {
    return (
      <div className="space-y-6">
        {header}
        {signed ? (
          <Alert tone="success">
            {detail.summary.clientName}'s signed copy is on file
            {detail.summary.submittedAt ? `, from ${formatDate(detail.summary.submittedAt)}` : ""}. This is the record of
            what they signed.
          </Alert>
        ) : withTheAdvisor ? (
          <Alert tone="info">
            Every part is answered, so this has gone to {detail.summary.clientName}'s advisor to sign. Nobody
            sent it: finishing it is what sends it. Nobody changes it while it is with them either — the
            advisor signs it, sends it back saying what is wrong, or leaves a comment below asking for a
            change.
          </Alert>
        ) : (
          <Alert tone="info">
            This form has gone to {detail.summary.clientName} to sign
            {detail.summary.dueOn ? `, and is expected back by ${formatDate(detail.summary.dueOn)}` : ""}. It can't be
            changed while they have it. To change something, fill it in again and send it out afresh.
          </Alert>
        )}
        {reopen.isError && <Alert tone="danger">{reopen.error.message}</Alert>}
        {kit.summary(value, detail.attachments, detail.summary.id)}
        {/* The parts come from the API's own sections rather than the rail, which a read form has none of:
            the two are the same list, and a comment has to name a part the other side will recognise. */}
        <FormComments
          formId={detail.summary.id}
          parts={detail.sections.map((section) => ({ id: section.id, label: section.label }))}
          packId={readFromPack}
          canWrite={canChange}
        />
        <ConfirmDialog
          open={editing}
          title="Edit this form?"
          // Whoever else is holding it has to be named: taking a form back from Compliance or from the
          // client is not the same small thing as opening a draft again, and it clears what was filled in.
          description={
            signed
              ? "The client's signed copy is on file. Editing it takes the form back and clears what was filled in — it starts again from the beginning. Do you want to continue?"
              : `This is with ${detail.summary.clientName} to sign. Editing it takes the form back and clears what was filled in — it starts again from the beginning. Do you want to continue?`
          }
          confirmLabel="Yes, start it again"
          busy={reopen.isPending}
          onConfirm={() => fillItInAgain()}
          onClose={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <StepRail
          steps={shownSteps}
          currentId={current.id}
          onSelect={goTo}
          hints={{ ...Object.fromEntries(steps.map((step) => [step.id, describes(step.id)])), [REVIEW.id]: CHECK_IT_OVER }}
          note={{
            title: "Nothing goes out by itself",
            body: "Fill this in over as many sittings as it takes. It only reaches the client when you send it.",
          }}
          footer={
            <Link
              to={caseId ? `/onboarding/${caseId}` : clientId ? clientFileHref(user, clientId) : "/forms"}
              state={caseId || clientId ? { tab: "documents" } : undefined}
              className="text-xs font-medium text-primary-700 hover:underline"
            >
              {caseId || clientId ? "Back to the client's documents" : "Back to all forms"}
            </Link>
          }
        />

        <section aria-labelledby="section-title" className="rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-6 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">{current.group}</p>
              <h2 id="section-title" className="mt-1.5 text-2xl leading-tight font-bold">
                {current.label}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {current.id === REVIEW.id ? CHECK_IT_OVER : describes(current.id)}
              </p>
            </div>
            {kit.guidance[current.group] && (
              <Button variant="ghost" size="sm" onClick={() => setGuidanceFor(current.group)}>
                <Info aria-hidden="true" />
                What this section asks for
              </Button>
            )}
          </div>

          <div key={current.id} className="space-y-6 px-6 py-6 sm:px-8">
            {formError && <Alert tone="danger">{formError}</Alert>}
            {current.id !== "review" && (
              <p className="text-xs text-ink-muted">
                Anything already on the client's record has been filled in. Check it and change whatever is out of date.
              </p>
            )}
            {current.id !== REVIEW.id && firmGaps.length > 0 && (
              <FirmDetails
                gaps={firmGaps}
                details={firmDetails}
                onChange={(key, said) => setFirmEdits((typed) => ({ ...typed, [key]: said }))}
              />
            )}
            {/* Every line of the form that names the firm reads it from here, so a change shows at once. */}
            <FirmContext.Provider value={firmDetails}>
              {kit.step({
                id: current.id,
                value,
                change,
                field,
                goTo,
                customerId: detail.summary.customerId,
                formId: detail.summary.id,
                documents,
                firmName,
              })}
            </FirmContext.Provider>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
            <p className="text-xs text-ink-muted">
              {everythingDone
                ? dirty
                  // Saving the last answer is what sends it, so that is what the words say to do.
                  ? "Every part is answered. Save it and it goes to the advisor to sign."
                  // Saved, answered, and still here: the only thing that stops it going is having nobody to
                  // sign it.
                  : "Every part is answered, but this hasn't gone to be signed. The client needs a relationship advisor before anybody can sign it."
                : `${review.steps.filter((step) => !step.complete).length} of ${review.steps.length} parts still to answer.`}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => goTo(steps[index - 1]?.id ?? steps[0]!.id)} disabled={index === 0 || busy}>
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
              {current.id === "review" ? (
                <Button onClick={saveDraft} disabled={busy || !dirty}>
                  {save.isPending ? "Saving…" : "Save draft"}
                </Button>
              ) : (
                // Nothing is locked: a form is filled in whatever order the client's papers arrive in.
                <Button onClick={() => goTo(steps[index + 1]?.id ?? REVIEW.id)} disabled={busy}>
                  Continue
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Whatever the advisor asked for, while it is being put right. A form sent back carries its comments
          over, so the change is read where it is made rather than in a message somewhere else. */}
      <FormComments
        formId={detail.summary.id}
        parts={detail.sections.map((section) => ({ id: section.id, label: section.label }))}
        packId={readFromPack}
        canWrite={canChange}
      />

      <Dialog
        open={guidanceFor !== null}
        title={guidanceFor ?? ""}
        onClose={() => setGuidanceFor(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">{guidanceFor ? kit.guidance[guidanceFor] : ""}</p>
          <div className="flex justify-end">
            <Button onClick={() => setGuidanceFor(null)}>Start this section</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * The firm's own details, which its paperwork prints throughout. They drop into the wording of the form below,
 * and whatever is typed here is kept with the form and offered again on the next one.
 */
function FirmDetails({
  gaps,
  details,
  onChange,
}: {
  gaps: DocumentGap[];
  details: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section aria-labelledby="firm-title" className="rounded-xl border border-line bg-slate-50/70 px-5 py-5">
      <h3 id="firm-title" className="text-sm font-bold text-ink">
        The firm, as this form names it
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        These drop into the wording below, wherever the form names the firm.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {gaps.map((gap) => (
          <Field key={gap.key} id={`firm-${gap.key}`} label={gap.label}>
            <TextInput
              id={`firm-${gap.key}`}
              value={details[gap.key] ?? ""}
              autoComplete="off"
              onChange={(event) => onChange(gap.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function BackLink({
  caseId,
  clientId,
  fromKyc,
  fromPack,
}: {
  caseId?: string;
  clientId?: string;
  fromKyc?: boolean;
  /** Opened from To sign, to be signed: the pack is where Back belongs. */
  fromPack?: string;
}) {
  const user = useStaffUser();
  // Back goes where the form was opened from: the pack it is being signed in, the case, the client's file,
  // the KYC queue, or the forms list. The pack comes first — an advisor reading a form to sign it was never
  // on the client's file, and sending them there leaves the form they were about to sign behind.
  // The client's file by the route this person may open — an advisor's clients are under My clients.
  const to = fromPack
    ? `/to-sign/${fromPack}`
    : caseId
      ? `/onboarding/${caseId}`
      : clientId
        ? clientFileHref(user, clientId)
        : fromKyc
          ? "/kyc"
          : "/forms";
  const onAClient = !fromPack && Boolean(caseId || clientId);
  return (
    <Link
      to={to}
      state={onAClient ? { tab: "documents" } : undefined}
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {/*
        Named for where it lands, and the same words the buttons at the foot of this page use. It said
        "Client documents", which is the name of a different screen in the sidebar; this one opens the
        Documents tab of the client's own file.
      */}
      {fromPack
        ? "Back to the forms to sign"
        : onAClient
          ? "Back to the client's documents"
          : fromKyc
            ? "KYC sign-off"
            : "Forms"}
    </Link>
  );
}

/** Asks when the client's signed copy is expected back, which is the point the form goes out. */
/** Tomorrow, which is the earliest a date still to come can be. */
/** Handing the finished form to Compliance, with the day it is wanted back by. */
