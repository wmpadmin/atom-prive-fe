import { ApiError } from "@atomprive/api-client";
import { Signature, SigningAs } from "../../components/signature";
import { useStaffUser } from "../../auth/session";
import {
  cancelProspectMeeting,
  changeProspectMeeting,
  completeProspectMeeting,
  getListProspectMeetingsQueryKey,
  scheduleProspectMeeting,
  useListProspectMeetings,
  type Meeting,
  type MeetingScheduleRequestMode,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, DateTimeInput, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";

const MODES: Record<string, string> = {
  IN_PERSON: "In person",
  VIDEO: "Video call",
  PHONE: "Phone",
  MESSAGE: "Message",
  EMAIL: "Email",
  OTHER: "Other",
};

type Opened = { kind: "schedule"; meeting: Meeting | null } | { kind: "complete"; meeting: Meeting } | { kind: "cancel"; meeting: Meeting };

/**
 * A prospect's meetings (scope §7): scheduled, completed or cancelled. Completing one writes its call note, which goes
 * for the RM's signature and then to Operations as every call note does, and sets the next follow up.
 */
export function ProspectMeetings({ prospectId, mayChange }: { prospectId: string; mayChange: boolean }) {
  const meetings = useListProspectMeetings<Meeting[], ApiError>(prospectId);
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState<Opened | null>(null);
  const rows = meetings.data ?? [];
  const saved = (next: Meeting[]) => {
    queryClient.setQueryData(getListProspectMeetingsQueryKey(prospectId), next);
    void queryClient.invalidateQueries({ queryKey: [`/api/backoffice/prospects/${prospectId}`] });
    setOpened(null);
  };
  const groups: { title: string; status: Meeting["status"] }[] = [
    { title: "Upcoming", status: "SCHEDULED" },
    { title: "Completed", status: "COMPLETED" },
    { title: "Cancelled", status: "CANCELLED" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">Every meeting with this prospect. Completing one writes its call note.</p>
        {mayChange && <Button size="sm" onClick={() => setOpened({ kind: "schedule", meeting: null })}>Schedule meeting</Button>}
      </div>
      {meetings.isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {groups.map((group) => {
        const inIt = rows.filter((one) => one.status === group.status);
        return (
          <section key={group.status} aria-label={group.title}>
            <h3 className="text-sm font-bold">{group.title} <span className="font-normal text-ink-muted">({inIt.length})</span></h3>
            {inIt.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">None.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {inIt.map((one) => (
                  <li key={one.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{one.title}</span>
                      <span className="text-xs text-ink-muted">
                        {one.startsAt ? formatDateTime(one.startsAt) : "No time set"}
                        {one.mode ? ` · ${MODES[one.mode]}` : ""}
                        {one.location ? ` · ${one.location}` : ""}
                      </span>
                      {mayChange && one.status === "SCHEDULED" && (
                        <span className="ml-auto flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setOpened({ kind: "schedule", meeting: one })}>Change</Button>
                          <Button size="sm" variant="ghost" onClick={() => setOpened({ kind: "cancel", meeting: one })}>Cancel</Button>
                          <Button size="sm" variant="secondary" onClick={() => setOpened({ kind: "complete", meeting: one })}>Complete</Button>
                        </span>
                      )}
                    </div>
                    {one.link && <p className="text-xs"><a href={one.link} target="_blank" rel="noreferrer" className="text-primary-700 underline">{one.link}</a></p>}
                    {one.participants && <p className="text-xs text-ink-muted">With {one.participants}</p>}
                    {one.agenda && <p className="whitespace-pre-wrap text-ink-soft">{one.agenda}</p>}
                    {one.status === "COMPLETED" && (
                      <dl className="mt-1 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-xs">
                        {one.summary && <Line label="Summary">{one.summary}</Line>}
                        {one.keyPoints && <Line label="Key points">{one.keyPoints}</Line>}
                        {one.clientRequirements && <Line label="Requirements">{one.clientRequirements}</Line>}
                        {one.clientQuestions && <Line label="Questions">{one.clientQuestions}</Line>}
                        {one.actionItems && <Line label="Action items">{one.actionItems}</Line>}
                        {one.documentsRequested && <Line label="Documents asked">{one.documentsRequested}</Line>}
                        {one.outcome && <Line label="Outcome">{one.outcome}</Line>}
                        {one.nextFollowUp && <Line label="Next follow up">{formatDate(one.nextFollowUp)}</Line>}
                      </dl>
                    )}
                    {one.status === "COMPLETED" && <Signature name={one.signedBy} at={one.signedAt} className="mt-2" />}
                    {one.status === "CANCELLED" && one.cancelReason && <p className="text-xs text-ink-muted">Cancelled: {one.cancelReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {opened?.kind === "schedule" && <ScheduleDialog prospectId={prospectId} meeting={opened.meeting} onClose={() => setOpened(null)} onSaved={saved} />}
      {opened?.kind === "complete" && <CompleteDialog prospectId={prospectId} meeting={opened.meeting} onClose={() => setOpened(null)} onSaved={saved} />}
      {opened?.kind === "cancel" && <CancelDialog prospectId={prospectId} meeting={opened.meeting} onClose={() => setOpened(null)} onSaved={saved} />}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{children}</dd>
    </>
  );
}

/** An ISO instant as the value a datetime-local input wants, in the reader's own clock. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function useErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const caught = (error: unknown) => {
    const said = toFormErrors(error);
    setErrors({ ...said.fields, ...(said.form ? { form: said.form } : {}) });
  };
  return { errors, setErrors, caught };
}

function ScheduleDialog({ prospectId, meeting, onClose, onSaved }: {
  prospectId: string;
  meeting: Meeting | null;
  onClose: () => void;
  onSaved: (next: Meeting[]) => void;
}) {
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(meeting?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(meeting?.endsAt));
  const [mode, setMode] = useState<string>(meeting?.mode ?? "IN_PERSON");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [link, setLink] = useState(meeting?.link ?? "");
  const [participants, setParticipants] = useState(meeting?.participants ?? "");
  const [agenda, setAgenda] = useState(meeting?.agenda ?? "");
  const [notes, setNotes] = useState(meeting?.notes ?? "");
  const { errors, setErrors, caught } = useErrors();
  async function save() {
    setErrors({});
    const body = {
      title: title || null, startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt), mode: (mode || null) as MeetingScheduleRequestMode,
      location: location || null, link: link || null, participants: participants || null, agenda: agenda || null, notes: notes || null,
    };
    try {
      onSaved(meeting ? await changeProspectMeeting(prospectId, meeting.id, body) : await scheduleProspectMeeting(prospectId, body));
    } catch (error) {
      caught(error);
    }
  }
  return (
    <Dialog open size="xl" onClose={onClose} title={meeting ? "Change the meeting" : "Schedule a meeting"} description="The RM is reminded the day before.">
      <div className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="meeting-title" label="Title" error={errors.title}>
          <TextInput id="meeting-title" value={title} maxLength={200} placeholder="Introductory meeting" onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="meeting-starts" label="Starts" required error={errors.startsAt}>
            <DateTimeInput id="meeting-starts" value={startsAt} onChange={setStartsAt} />
          </Field>
          <Field id="meeting-ends" label="Ends" error={errors.endsAt}>
            <DateTimeInput id="meeting-ends" value={endsAt} onChange={setEndsAt} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="meeting-mode" label="How" error={errors.mode}>
            <SelectInput id="meeting-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              {Object.entries(MODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </SelectInput>
          </Field>
          <Field id="meeting-location" label="Location" error={errors.location}>
            <TextInput id="meeting-location" value={location} maxLength={300} onChange={(event) => setLocation(event.target.value)} />
          </Field>
        </div>
        <Field id="meeting-link" label="Meeting link" error={errors.link}>
          <TextInput id="meeting-link" value={link} maxLength={500} placeholder="https://" onChange={(event) => setLink(event.target.value)} />
        </Field>
        <Field id="meeting-participants" label="Participants" error={errors.participants}>
          <TextInput id="meeting-participants" value={participants} maxLength={500} onChange={(event) => setParticipants(event.target.value)} />
        </Field>
        <Field id="meeting-agenda" label="Agenda" error={errors.agenda}>
          <TextArea id="meeting-agenda" rows={3} value={agenda} onChange={(event) => setAgenda(event.target.value)} />
        </Field>
        <Field id="meeting-notes" label="Notes" error={errors.notes}>
          <TextArea id="meeting-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => void save()}>{meeting ? "Save" : "Schedule"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CompleteDialog({ prospectId, meeting, onClose, onSaved }: {
  prospectId: string;
  meeting: Meeting;
  onClose: () => void;
  onSaved: (next: Meeting[]) => void;
}) {
  const me = useStaffUser();
  const today = new Date().toISOString().slice(0, 10);
  const [fields, setFields] = useState<Record<string, string>>({ happenedOn: meeting.startsAt?.slice(0, 10) ?? today });
  const set = (key: string) => (event: { target: { value: string } }) => setFields((was) => ({ ...was, [key]: event.target.value }));
  const { errors, setErrors, caught } = useErrors();
  const value = (key: string) => fields[key] ?? "";
  async function save() {
    setErrors({});
    const or = (key: string) => (fields[key] ? fields[key] : null);
    try {
      onSaved(await completeProspectMeeting(prospectId, meeting.id, {
        happenedOn: or("happenedOn"), summary: or("summary"), keyPoints: or("keyPoints"), clientRequirements: or("clientRequirements"),
        clientQuestions: or("clientQuestions"), actionItems: or("actionItems"), documentsRequested: or("documentsRequested"),
        nextFollowUp: or("nextFollowUp"), outcome: or("outcome"), attendees: or("attendees"),
      }));
    } catch (error) {
      caught(error);
    }
  }
  const area = (key: string, label: string, required = false) => (
    <Field id={`complete-${key}`} label={label} required={required} error={errors[key]}>
      <TextArea id={`complete-${key}`} rows={2} value={value(key)} onChange={set(key)} />
    </Field>
  );
  return (
    <Dialog open size="xl" onClose={onClose} title="Complete the meeting" description="This writes the call note. It goes to the RM to sign, then to Operations for review.">
      <div className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        {/* Laid out in columns so the dialog is not taller than the screen (24 Nov 2026). */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="complete-happenedOn" label="Held on" required error={errors.happenedOn}>
            <TextInput id="complete-happenedOn" type="date" max={today} value={value("happenedOn")} onChange={set("happenedOn")} />
          </Field>
          <Field id="complete-nextFollowUp" label="Next follow up" error={errors.nextFollowUp}>
            <TextInput id="complete-nextFollowUp" type="date" min={today} value={value("nextFollowUp")} onChange={set("nextFollowUp")} />
          </Field>
          <Field id="complete-attendees" label="Attendees" error={errors.attendees}>
            <TextInput id="complete-attendees" value={value("attendees")} onChange={set("attendees")} />
          </Field>
        </div>
        {area("summary", "Meeting summary", true)}
        <div className="grid gap-4 sm:grid-cols-2">
          {area("keyPoints", "Key discussion points")}
          {area("clientRequirements", "Client requirements")}
          {area("clientQuestions", "Client questions")}
          {area("actionItems", "Action items")}
          {area("documentsRequested", "Documents requested")}
          {area("outcome", "Outcome")}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto"><SigningAs name={me.fullName} /></span>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => void save()}>Sign and complete</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CancelDialog({ prospectId, meeting, onClose, onSaved }: {
  prospectId: string;
  meeting: Meeting;
  onClose: () => void;
  onSaved: (next: Meeting[]) => void;
}) {
  const [reason, setReason] = useState("");
  const { errors, setErrors, caught } = useErrors();
  async function save() {
    setErrors({});
    try {
      onSaved(await cancelProspectMeeting(prospectId, meeting.id, { reason: reason || null }));
    } catch (error) {
      caught(error);
    }
  }
  return (
    <Dialog open onClose={onClose} title="Cancel the meeting" description={meeting.title}>
      <div className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="cancel-reason" label="Why" error={errors.reason}>
          <TextArea id="cancel-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <div className={cn("flex justify-end gap-2")}>
          <Button variant="ghost" onClick={onClose}>Keep it</Button>
          <Button variant="danger" onClick={() => void save()}>Cancel meeting</Button>
        </div>
      </div>
    </Dialog>
  );
}
