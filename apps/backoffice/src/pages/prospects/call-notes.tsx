import { ApiError } from "@atomprive/api-client";
import {
  addClientCallNote,
  addProspectCallNote,
  changeCallNote,
  getListClientCallNotesQueryKey,
  getListProspectCallNotesQueryKey,
  signCallNote,
  submitCallNote,
  useListClientCallNotes,
  useListProspectCallNotes,
  vetCallNote,
  type CallNoteRow,
  type CallNoteRequest,
  type CallNoteRequestMode,
} from "@atomprive/api-client/backoffice";
import { SignaturePad } from "@atomprive/forms/signature-pad";
import { Alert, Button, Dialog, Field, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { toFormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";
import { Signature, SigningAs } from "../../components/signature";

/**
 * Call notes (22 Nov 2026): every time the relationship manager reaches a prospect or a client, in any way, a note of
 * it. Since 23 Nov 2026 the RM signs it first, then Operations review it or send it back to change and sign again.
 * Sign-off is per note, and a reviewed note is final. Kept on a prospect's page and on a client's file; a prospect's
 * notes are read on the client they became as well.
 */

export const MODES: Record<CallNoteRequestMode, string> = {
  IN_PERSON: "In person",
  VIDEO: "Video call",
  PHONE: "Phone call",
  MESSAGE: "WhatsApp / message",
  EMAIL: "Email",
  OTHER: "Other",
};

export const NOTE_STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "border border-dashed border-line text-ink-muted" },
  AWAITING_RM_SIGNATURE: { label: "Waiting for the RM's signature", tone: "bg-violet-50 text-violet-700" },
  AWAITING_REVIEW: { label: "Signed · with Operations to review", tone: "bg-amber-50 text-amber-800" },
  RETURNED: { label: "Sent back", tone: "bg-red-50 text-red-700" },
  REVIEWED: { label: "Reviewed", tone: "bg-emerald-50 text-emerald-700" },
  // Signed by whoever wrote it, and final (23 Nov 2026).
  SIGNED: { label: "Signed", tone: "bg-emerald-50 text-emerald-700" },
};

type Subject = { prospectId: string; customerId?: undefined } | { customerId: string; prospectId?: undefined };

const today = () => new Date().toLocaleDateString("en-CA");

export function CallNotes(props: Subject & { mayWrite: boolean }) {
  const user = useStaffUser();
  const { prospectId, customerId, mayWrite } = props;
  const onProspect = useListProspectCallNotes<CallNoteRow[], ApiError>(prospectId ?? "", { query: { enabled: Boolean(prospectId) } });
  const onClient = useListClientCallNotes<CallNoteRow[], ApiError>(customerId ?? "", { query: { enabled: Boolean(customerId) } });
  const notes = prospectId ? onProspect : onClient;
  const key = prospectId ? getListProspectCallNotesQueryKey(prospectId) : getListClientCallNotesQueryKey(customerId ?? "");
  const queryClient = useQueryClient();
  const [writing, setWriting] = useState<CallNoteRow | "new" | null>(null);
  const [vetting, setVetting] = useState<CallNoteRow | null>(null);
  const [signing, setSigning] = useState<CallNoteRow | null>(null);
  const [problem, setProblem] = useState<string>();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const act = async (work: () => Promise<unknown>) => {
    setProblem(undefined);
    try {
      await work();
      refresh();
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "That didn't go through. Try again.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-muted">
          A note each time someone from the firm reaches them, signed by whoever writes it.
        </p>
        {mayWrite && writing !== "new" && (
          <Button onClick={() => setWriting("new")}>
            <Plus aria-hidden="true" />
            New call note
          </Button>
        )}
      </div>
      {problem && <Alert tone="danger">{problem}</Alert>}
      {writing === "new" && (
        <NoteForm subject={props} onDone={() => { setWriting(null); refresh(); }} onCancel={() => setWriting(null)} />
      )}

      {notes.isError && <p className="text-sm text-red-700">The call notes couldn't be loaded.</p>}
      {notes.data && notes.data.length === 0 && writing !== "new" && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No call notes yet.</p>
      )}
      <ul className="space-y-3">
        {(notes.data ?? []).map((one) => (
          <li key={one.id} className="rounded-xl border border-line p-4 text-sm">
            {writing !== "new" && writing?.id === one.id ? (
              <NoteForm subject={props} editing={one} onDone={() => { setWriting(null); refresh(); }} onCancel={() => setWriting(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {formatDate(one.happenedOn)} · {MODES[one.mode as CallNoteRequestMode] ?? one.mode}{one.place ? ` · ${one.place}` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">
                      By {one.writtenBy}{one.attendees ? ` · with ${one.attendees}` : ""}
                      {one.subjectKind === "PROSPECT" && customerId ? " · from when they were a prospect" : ""}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", NOTE_STATUS[one.status]?.tone)}>
                    {NOTE_STATUS[one.status]?.label ?? one.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink-soft">{one.discussion}</p>
                {one.status === "SIGNED" ? (
                  <div className="mt-3"><Signature name={one.signature ?? one.writtenBy} at={one.signedAt} /></div>
                ) : <SignOffTrail one={one} />}
                {(one.mayEdit || one.mayVet || one.maySign) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {one.mayEdit && <Button size="sm" variant="secondary" onClick={() => setWriting(one)}>Edit</Button>}
                    {one.mayEdit && (one.status === "DRAFT" || one.status === "RETURNED") && one.writtenById === user.id && (
                      // Signed by whoever wrote it, their name as their signature (23 Nov 2026).
                      <Button size="sm" onClick={() => void act(() => submitCallNote(one.id))}>Sign and save</Button>
                    )}
                    {one.mayVet && <Button size="sm" onClick={() => setVetting(one)}>Review or send back</Button>}
                    {one.maySign && <Button size="sm" onClick={() => setSigning(one)}>Sign and send to Operations</Button>}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {vetting && <VetDialog one={vetting} onClose={() => setVetting(null)} onDone={() => { setVetting(null); refresh(); }} />}
      {signing && <SignDialog one={signing} onClose={() => setSigning(null)} onDone={() => { setSigning(null); refresh(); }} />}
    </section>
  );
}

/** Who vetted it and when, what they said, and who signed it. */
export function SignOffTrail({ one }: { one: CallNoteRow }) {
  if (!one.vettedBy && !one.signedBy && !one.vettingComment) return null;
  return (
    <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
      {one.vettedBy && (
        <>
          <dt className="text-ink-muted">{one.status === "RETURNED" ? "Sent back by" : "Reviewed by"}</dt>
          <dd>{one.vettedBy}{one.vettedAt ? `, ${formatDateTime(one.vettedAt)}` : ""}</dd>
        </>
      )}
      {one.vettingComment && (
        <>
          <dt className="text-ink-muted">Operations said</dt>
          <dd className="whitespace-pre-wrap">{one.vettingComment}</dd>
        </>
      )}
      {one.rm && (one.status === "DRAFT" || one.status === "AWAITING_RM_SIGNATURE" || one.status === "RETURNED") && (
        <>
          <dt className="text-ink-muted">To be signed by</dt>
          <dd>{one.rm}</dd>
        </>
      )}
      {one.signedBy && (
        <>
          <dt className="text-ink-muted">Signed by the RM</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {one.signedBy}{one.signedAt ? `, ${formatDateTime(one.signedAt)}` : ""}
            {one.signatureKind === "DRAWN" && one.signature ? (
              <img src={one.signature} alt={`${one.signedBy}'s signature`} className="h-8 rounded border border-line bg-white" />
            ) : one.signature ? (
              <span className="font-serif text-base italic">{one.signature}</span>
            ) : null}
          </dd>
        </>
      )}
    </dl>
  );
}

function NoteForm({ subject, editing, onDone, onCancel }: {
  subject: Subject;
  editing?: CallNoteRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [on, setOn] = useState(editing?.happenedOn ?? today());
  const [mode, setMode] = useState<CallNoteRequestMode>((editing?.mode as CallNoteRequestMode) ?? "IN_PERSON");
  const [place, setPlace] = useState(editing?.place ?? "");
  const [attendees, setAttendees] = useState(editing?.attendees ?? "");
  const [discussion, setDiscussion] = useState(editing?.discussion ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  const me = useStaffUser();
  async function save(submit: boolean) {
    setErrors({});
    setProblem(undefined);
    const body: CallNoteRequest = { happenedOn: on, mode, place: place.trim() || null, attendees: attendees.trim() || null, discussion, submit };
    setSaving(true);
    try {
      if (editing) await changeCallNote(editing.id, body);
      else if (subject.prospectId) await addProspectCallNote(subject.prospectId, body);
      else await addClientCallNote(subject.customerId ?? "", body);
      onDone();
    } catch (caught) {
      const read = toFormErrors(caught);
      setErrors(read.fields);
      setProblem(read.form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary-200 bg-primary-50/30 p-4">
      <p className="text-sm font-semibold">{editing ? "Change the call note" : "New call note"}</p>
      {editing?.status === "RETURNED" && editing.vettingComment && (
        <Alert tone="warning">Operations sent it back: {editing.vettingComment}</Alert>
      )}
      {problem && <Alert tone="danger">{problem}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="note-date" label="Date" required error={errors.happenedOn}>
          <TextInput id="note-date" type="date" value={on} max={today()} onChange={(event) => setOn(event.target.value)} />
        </Field>
        <Field id="note-mode" label="How" required error={errors.mode}>
          <SelectInput id="note-mode" value={mode} onChange={(event) => setMode(event.target.value as CallNoteRequestMode)}>
            {Object.entries(MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </SelectInput>
        </Field>
        <Field id="note-place" label="Where (place)" hint="The office, the client's home, a café — or the call" error={errors.place}>
          <TextInput id="note-place" value={place} maxLength={300} onChange={(event) => setPlace(event.target.value)} />
        </Field>
        <Field id="note-attendees" label="Who else was there" hint="Anybody besides the RM, from the firm or theirs" error={errors.attendees}>
          <TextInput id="note-attendees" value={attendees} maxLength={1000} onChange={(event) => setAttendees(event.target.value)} />
        </Field>
      </div>
      <Field id="note-discussion" label="What was discussed" required error={errors.discussion}>
        <TextArea id="note-discussion" rows={4} value={discussion} maxLength={8000} onChange={(event) => setDiscussion(event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto"><SigningAs name={me.fullName} /></span>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="secondary" onClick={() => void save(false)} disabled={saving}>Save as draft</Button>
        <Button onClick={() => void save(true)} disabled={saving}>{saving ? "Signing…" : "Sign and save"}</Button>
      </div>
    </div>
  );
}

function VetDialog({ one, onClose, onDone }: { one: CallNoteRow; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function decide(approved: boolean) {
    setError(undefined);
    if (!approved && !comment.trim()) {
      setError("Say what has to be put right.");
      return;
    }
    setSaving(true);
    try {
      await vetCallNote(one.id, { approved, comment: comment.trim() || null });
      onDone();
    } catch (caught) {
      const read = toFormErrors(caught);
      setError(read.fields.comment ?? read.form ?? "That didn't go through.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title="Review the call note" description={`${one.subjectName} · ${formatDate(one.happenedOn)} · by ${one.writtenBy}`}>
      <div className="space-y-4">
        <p className="max-h-48 overflow-y-auto rounded-lg bg-canvas p-3 text-sm whitespace-pre-wrap">{one.discussion}</p>
        <Field id="vet-comment" label="Comment" hint="Needed when sending it back" error={error}>
          <TextArea id="vet-comment" rows={3} value={comment} onChange={(event) => { setComment(event.target.value); setError(undefined); }} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="secondary" onClick={() => void decide(false)} disabled={saving}>Send back to the RM</Button>
          <Button onClick={() => void decide(true)} disabled={saving}>Mark as reviewed</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function SignDialog({ one, onClose, onDone }: { one: CallNoteRow; onClose: () => void; onDone: () => void }) {
  const [how, setHow] = useState<"TYPED" | "DRAWN">("TYPED");
  const [typed, setTyped] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const signature = how === "TYPED" ? typed.trim() : drawn;
  async function sign() {
    setError(undefined);
    if (!signature) {
      setError(how === "TYPED" ? "Type your full name to sign." : "Draw your signature.");
      return;
    }
    if (!agreed) {
      setError("Confirm the note is a true record before signing.");
      return;
    }
    setSaving(true);
    try {
      await signCallNote(one.id, { signatureKind: how, signature, agreed });
      onDone();
    } catch (caught) {
      const read = toFormErrors(caught);
      setError(read.form ?? Object.values(read.fields)[0] ?? "That didn't go through.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title="Sign the call note" description={`${one.subjectName} · ${formatDate(one.happenedOn)} · then it goes to Operations to review`}>
      <div className="space-y-4">
        <p className="max-h-40 overflow-y-auto rounded-lg bg-canvas p-3 text-sm whitespace-pre-wrap">{one.discussion}</p>
        <div role="tablist" aria-label="How to sign" className="flex rounded-lg border border-line p-0.5 text-sm font-semibold">
          {([["TYPED", "Type my name"], ["DRAWN", "Draw my signature"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={how === id} onClick={() => setHow(id)}
              className={cn("flex-1 rounded-md px-3 py-1.5", how === id ? "bg-primary-50 text-primary-700" : "text-ink-muted")}>{label}</button>
          ))}
        </div>
        {how === "TYPED" ? (
          <Field id="sign-name" label="Your full name" required>
            <TextInput id="sign-name" value={typed} onChange={(event) => setTyped(event.target.value)} />
          </Field>
        ) : (
          <SignaturePad onChange={setDrawn} />
        )}
        <label className="flex items-start gap-2 text-sm">
          <input id="sign-agreed" type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5" />
          <span>I confirm this call note is a true record of my contact with {one.subjectName}.<span aria-hidden="true" className="ml-0.5 text-red-600">*</span></span>
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void sign()} disabled={saving}>{saving ? "Signing…" : "Sign and send to Operations"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
