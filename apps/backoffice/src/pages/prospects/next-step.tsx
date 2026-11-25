import { ApiError } from "@atomprive/api-client";
import {
  getGetProspectQueryKey,
  markProspectMet,
  planProspectMeeting,
  useGetOnboardingCase,
  useGetProspectReviewHistory,
  type CallNoteRequestMode,
  type ReviewEvent,
  type CaseDetail,
  type ProspectDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, DateTimeInput, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ClipboardList, FileText, Pencil, ShieldCheck, type LucideIcon } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { toFormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";
import { MODES } from "./call-notes";
import { ONBOARDING_STAGE_LABELS, type OnboardingStage } from "./prospect-labels";
import { REJECTION_REASONS } from "./compliance-review";

/**
 * What to do next with a prospect (23 Nov 2026), and how far they have come: added, met, documents and Compliance, the
 * agreement, then a client. Documents can be uploaded from the start, during or after any meeting, on the Documents tab.
 */
export function NextStep({ detail, onDocuments, onFollowUp, onComplete }: {
  detail: ProspectDetail;
  onDocuments: () => void;
  onFollowUp: () => void;
  onComplete: () => void;
}) {
  const row = detail.prospect;
  const [planning, setPlanning] = useState(false);
  const [meeting, setMeeting] = useState(false);
  // Its documents are being collected (23 Nov 2026): still a prospect, on its way through the stages to being a client.
  if (row.onboardingStage && detail.onboardingCaseId) {
    return <OnboardingStages stage={row.onboardingStage} prospectId={row.id} onDocuments={onDocuments} />;
  }
  const converted = row.status === "CONVERTED";
  const met = row.meetingStage === "MET" || converted;
  const open = !["DRAFT", "CONVERTED", "LOST"].includes(row.status);
  // The way to being a client (23 Nov 2026): documents, Compliance, the agreement; then a client, on its own.
  const steps = [
    { label: "Added", done: row.status !== "DRAFT" },
    { label: "Meet", done: met },
    { label: "Documents and Compliance", done: converted },
    { label: "Agreement signed", done: converted },
    { label: "Client", done: converted },
  ];
  const current = steps.findIndex((one) => !one.done);
  const when = row.plannedMeetingAt ? formatDateTime(row.plannedMeetingAt) : null;
  const how = row.plannedMeetingMode ? MODES[row.plannedMeetingMode as CallNoteRequestMode] : null;

  return (
    <section aria-labelledby="next-step" className="overflow-hidden rounded-2xl border border-line bg-white">
      <Stepper steps={steps.map((one) => one.label)} current={current === -1 ? steps.length : current} />

      {row.status === "DRAFT" && (
        <Body title="Complete their details" lead="A draft: add an email or phone to start.">
          {detail.mayChange && <Button onClick={onComplete}>Complete details</Button>}
        </Body>
      )}

      {row.status === "LOST" && <Body title="Marked as lost" lead="Reopen them to carry on." />}

      {converted && detail.onboardingCaseId && <Onboarding caseId={detail.onboardingCaseId} />}

      {open && row.meetingStage === "PLANNED" && (
        <Body icon={CalendarDays} title={when ? `Meeting on ${when}` : "Meeting to be arranged"}
          lead={[how, row.plannedMeetingPlace].filter(Boolean).join(" · ") || "Say when and where once it is set."}>
          {detail.mayChange && (
            <>
              <Button onClick={() => setMeeting(true)}><Pencil aria-hidden="true" className="size-4" />View / Write Call Note</Button>
              <Button variant="secondary" onClick={() => setPlanning(true)}><CalendarDays aria-hidden="true" className="size-4" />{when ? "Reschedule" : "Set the meeting"}</Button>
            </>
          )}
        </Body>
      )}

      {open && row.meetingStage !== "PLANNED" && (
        <Body title={row.meetingStage === "MET" ? "Collect their documents" : "Meet them, and collect their documents"}
          icon={row.meetingStage === "MET" ? FileText : CalendarDays}
          lead={row.meetingStage === "MET" ? "Upload them on the Documents tab and send them to Compliance."
            : "Documents can be uploaded at any time, before or after the meeting."}
          detail={<ul className="mt-2 space-y-1 text-sm">
            <Check2 ok={Boolean(row.email || row.phone)}>Name and a way to reach them</Check2>
            {row.meetingStage === "MET" && <Check2 ok>Met{row.metOn ? ` on ${formatDate(row.metOn)}` : ""} — the meeting is on Call notes</Check2>}
          </ul>}>
          {detail.mayConvert && <Button onClick={onDocuments}>Upload documents</Button>}
          {detail.mayChange && row.meetingStage !== "MET" && (
            <>
              <Button variant="secondary" onClick={() => setPlanning(true)}>Plan a meeting</Button>
              <Button variant="secondary" onClick={() => setMeeting(true)}>We met</Button>
            </>
          )}
          {detail.mayChange && <Button variant="ghost" onClick={onFollowUp}>Not yet — log a follow-up</Button>}
        </Body>
      )}

      {planning && <PlanDialog detail={detail} onClose={() => setPlanning(false)} />}
      {meeting && <MetDialog detail={detail} onClose={() => setMeeting(false)} />}
    </section>
  );
}

/**
 * Only the steps along the top (23 Nov 2026): how far a prospect has come, without the next-step card below it,
 * which was taken off the prospect page.
 */
export function ProspectPipeline({ detail }: { detail: ProspectDetail }) {
  const row = detail.prospect;
  if (row.onboardingStage && detail.onboardingCaseId) {
    const stage = row.onboardingStage;
    const current = stage === "ONBOARDED" ? STAGES.length : STAGES.findIndex((one) => one.at.includes(stage));
    return (
      <section className="overflow-hidden rounded-2xl border border-line">
        <Stepper steps={STAGES.map((one) => one.label)} current={current} failed={stage === "REJECTED"} />
      </section>
    );
  }
  const converted = row.status === "CONVERTED";
  const steps = [
    { label: "Added", done: row.status !== "DRAFT" },
    { label: "Meet", done: row.meetingStage === "MET" || converted },
    { label: "Documents and Compliance", done: converted },
    { label: "Agreement signed", done: converted },
    { label: "Client", done: converted },
  ];
  const current = steps.findIndex((one) => !one.done);
  return (
    <section className="overflow-hidden rounded-2xl border border-line">
      <Stepper steps={steps.map((one) => one.label)} current={current === -1 ? steps.length : current} />
    </section>
  );
}

/** The words above a step's title: "Next step", or the stage it is at once documents are being collected. */
const Eyebrow = createContext("Next step");

function Body({ title, lead, icon: Icon = ClipboardList, detail, children }: {
  title: string;
  lead?: string;
  icon?: LucideIcon;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const eyebrow = useContext(Eyebrow);
  return (
    <div className="flex flex-wrap items-center gap-5 px-6 py-5">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-600">
        <Icon className="size-8" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p id="next-step" className="text-sm font-semibold text-primary-700">{eyebrow}</p>
        <p className="text-xl font-bold text-ink">{title}</p>
        {lead && <p className="mt-0.5 text-sm text-ink-muted">{lead}</p>}
        {detail}
      </div>
      {children && <div className="flex w-full flex-col gap-2 sm:w-60 [&>*]:w-full [&>*]:justify-center">{children}</div>}
    </div>
  );
}

/** How far a prospect has come, as numbered steps joined by a line: done ones ticked, the current one in blue. */
function Stepper({ steps, current, failed = false }: { steps: string[]; current: number; failed?: boolean }) {
  return (
    <ol aria-label="How far they have come" className="flex items-center gap-3 overflow-x-auto border-b border-line bg-slate-50 px-6 py-4 last:border-b-0">
      {steps.map((label, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={label} aria-current={here ? "step" : undefined} className={cn("flex items-center gap-3", i < steps.length - 1 && "flex-1")}>
            <span className="flex shrink-0 items-center gap-2">
              <span className={cn("inline-flex size-8 items-center justify-center rounded-full text-sm font-bold",
                done ? "bg-emerald-500 text-white" : here ? (failed ? "bg-red-600 text-white" : "bg-primary-600 text-white") : "bg-slate-300 text-white")}>
                {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-sm whitespace-nowrap", here ? "font-bold text-ink" : done ? "font-semibold text-ink" : "font-semibold text-ink-muted")}>{label}</span>
            </span>
            {i < steps.length - 1 && <span aria-hidden="true" className={cn("h-0.5 min-w-6 flex-1 rounded-full", done ? "bg-primary-600" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Check2({ ok, optional = false, children }: { ok: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2", !ok && (optional ? "text-amber-700" : "text-red-700"))}>
      <span aria-hidden="true">{ok ? "✓" : "○"}</span>
      {children}
    </li>
  );
}

/** A converted prospect's next form: the onboarding, and how far it has got. */
function Onboarding({ caseId }: { caseId: string }) {
  const onboarding = useGetOnboardingCase<CaseDetail, ApiError>(caseId);
  const summary = onboarding.data?.summary;
  return (
    <Body title={summary ? (summary.submitted ? `Onboarding submitted · ${summary.currentStage}`
      : `Next form: Onboarding — step ${Math.min(summary.completedSteps + 1, summary.totalSteps)} of ${summary.totalSteps}, ${summary.currentStage}`)
      : "Next form: Onboarding"}>
      <Link to={`/onboarding/${caseId}`}
        className="inline-flex h-10 items-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-on-accent hover:bg-primary-700">
        {summary?.submitted ? "Open the onboarding" : "Continue the onboarding form"}
      </Link>
    </Body>
  );
}

/** The way to being a client (23 Nov 2026), and where a prospect whose documents have started has got to. */
const STAGES: { label: string; at: OnboardingStage[] }[] = [
  { label: "Met", at: [] },
  { label: "Documents", at: ["FILLING_FORMS", "DOCUMENTS_PENDING", "INCOME_CHECK", "MORE_DOCUMENTS"] },
  { label: "Compliance", at: ["WITH_COMPLIANCE", "COMPLIANCE_REVIEW", "REJECTED"] },
  { label: "Agreement signed", at: ["AGREEMENT_PENDING"] },
  { label: "Client", at: [] },
];

function OnboardingStages({ stage, prospectId, onDocuments }: { stage: OnboardingStage; prospectId: string; onDocuments: () => void }) {
  const current = stage === "ONBOARDED" ? STAGES.length : STAGES.findIndex((one) => one.at.includes(stage));
  const open = <Button onClick={onDocuments}>Open the Documents tab</Button>;
  return (
    <section aria-labelledby="next-step" className="overflow-hidden rounded-2xl border border-line bg-white">
      <Stepper steps={STAGES.map((one) => one.label)} current={current} failed={stage === "REJECTED"} />
      <Eyebrow.Provider value={`Next step · ${ONBOARDING_STAGE_LABELS[stage]}`}>
      {(stage === "FILLING_FORMS" || stage === "DOCUMENTS_PENDING" || stage === "INCOME_CHECK") && (
        <Body icon={FileText} title="Upload documents and send them to Compliance"
          lead="Each holder's passport, proof of address and income documents, and the wealth table. Send them whenever they are ready.">
          {open}
        </Body>
      )}
      {stage === "MORE_DOCUMENTS" && <Rejected prospectId={prospectId} final={false} />}
      {stage === "REJECTED" && <Rejected prospectId={prospectId} final />}
      {(stage === "WITH_COMPLIANCE" || stage === "COMPLIANCE_REVIEW") && (
        <Body icon={ShieldCheck} title="With Compliance"
          lead="Compliance approve or reject each document on the Documents tab. More can be uploaded and sent meanwhile.">
          {open}
        </Body>
      )}
      {stage === "AGREEMENT_PENDING" && (
        <Body icon={ShieldCheck} title="Approved by Compliance"
          lead="Next: the agreement, signed by the client on the portal and then by the Admin on the Agreement tab." />
      )}
      {stage === "ONBOARDED" && <Body title="A client" lead="They are a client now, under All clients." />}
      </Eyebrow.Provider>
    </section>
  );
}

/** Sent back by Compliance: why, and what to do. Read from the history, whose last rejection it is. */
function Rejected({ prospectId, final }: { prospectId: string; final: boolean }) {
  const history = useGetProspectReviewHistory<ReviewEvent[], ApiError>(prospectId);
  const last = [...(history.data ?? [])].reverse().find((one) => one.kind === "REJECTED" || one.kind === "MORE_DOCUMENTS");
  return (
    <Body title={final ? "Rejected by Compliance" : "Additional documents required — put it right and send again"}
      lead={final ? "It stays a prospect. Admin or Compliance can reopen it if it is to be looked at again."
        : "Upload what Compliance asked for on the Documents tab, then send it to Compliance again."}
      detail={last && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="font-semibold">{last.reason ? REJECTION_REASONS[last.reason] : "Rejected"}</span>
          {last.note ? ` — ${last.note}` : ""}
          <span className="block text-xs text-red-700/80">{last.by} · {formatDateTime(last.at)}</span>
        </p>
      )} />
  );
}

function PlanDialog({ detail, onClose }: { detail: ProspectDetail; onClose: () => void }) {
  const row = detail.prospect;
  const queryClient = useQueryClient();
  const [at, setAt] = useState(row.plannedMeetingAt ? localDateTime(row.plannedMeetingAt) : "");
  const [mode, setMode] = useState<CallNoteRequestMode>((row.plannedMeetingMode as CallNoteRequestMode) ?? "IN_PERSON");
  const [place, setPlace] = useState(row.plannedMeetingPlace ?? "");
  const [problem, setProblem] = useState<string>();
  async function save() {
    setProblem(undefined);
    try {
      const next = await planProspectMeeting(row.id, { at: at ? new Date(at).toISOString() : null, mode, place: place.trim() || null });
      queryClient.setQueryData(getGetProspectQueryKey(row.id), next);
      onClose();
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? "That couldn't be saved.");
    }
  }
  return (
    <Dialog open onClose={onClose} title={row.plannedMeetingAt ? "Reschedule the meeting" : "Plan a meeting"} description={row.fullName}>
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <Field id="plan-at" label="When"><DateTimeInput id="plan-at" value={at} onChange={setAt} /></Field>
        <Field id="plan-mode" label="How">
          <SelectInput id="plan-mode" value={mode} onChange={(event) => setMode(event.target.value as CallNoteRequestMode)}>
            {Object.entries(MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </SelectInput>
        </Field>
        <Field id="plan-place" label="Where"><TextInput id="plan-place" value={place} maxLength={300} onChange={(event) => setPlace(event.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </Dialog>
  );
}

function MetDialog({ detail, onClose }: { detail: ProspectDetail; onClose: () => void }) {
  const row = detail.prospect;
  const queryClient = useQueryClient();
  const [on, setOn] = useState(row.plannedMeetingAt ? localDateTime(row.plannedMeetingAt).slice(0, 10) : new Date().toLocaleDateString("en-CA"));
  const [mode, setMode] = useState<CallNoteRequestMode>((row.plannedMeetingMode as CallNoteRequestMode) ?? "IN_PERSON");
  const [place, setPlace] = useState(row.plannedMeetingPlace ?? "");
  const [attendees, setAttendees] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  async function save() {
    setErrors({});
    setProblem(undefined);
    if (!discussion.trim()) {
      setErrors({ discussion: "Say what was discussed." });
      return;
    }
    try {
      const next = await markProspectMet(row.id, { happenedOn: on, mode, place: place.trim() || null, attendees: attendees.trim() || null, discussion });
      queryClient.setQueryData(getGetProspectQueryKey(row.id), next);
      void queryClient.invalidateQueries();
      onClose();
    } catch (caught) {
      const read = toFormErrors(caught);
      setErrors(read.fields);
      setProblem(read.form);
    }
  }
  return (
    <Dialog open onClose={onClose} title="We met — write the call note" description={`${row.fullName} · saved as a call note and sent to Operations to vet`}>
      <div className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="met-on" label="Date" required error={errors.happenedOn}><TextInput id="met-on" type="date" value={on} onChange={(event) => setOn(event.target.value)} /></Field>
          <Field id="met-mode" label="How" required>
            <SelectInput id="met-mode" value={mode} onChange={(event) => setMode(event.target.value as CallNoteRequestMode)}>
              {Object.entries(MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field id="met-place" label="Where"><TextInput id="met-place" value={place} maxLength={300} onChange={(event) => setPlace(event.target.value)} /></Field>
          <Field id="met-attendees" label="Who else was there"><TextInput id="met-attendees" value={attendees} maxLength={1000} onChange={(event) => setAttendees(event.target.value)} /></Field>
        </div>
        <Field id="met-discussion" label="What was discussed" required error={errors.discussion}>
          <TextArea id="met-discussion" rows={4} value={discussion} maxLength={8000} onChange={(event) => setDiscussion(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()}>Save the call note</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** An instant as yyyy-mm-ddThh:mm in the reader's own clock, as the date and time field wants it. */
function localDateTime(iso: string) {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
