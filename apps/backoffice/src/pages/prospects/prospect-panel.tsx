import { ApiError } from "@atomprive/api-client";
import {
  getGetClientManagementOverviewQueryKey,
  getGetProspectQueryKey,
  getListProspectsQueryKey,
  useConvertProspect,
  useEmailProspect,
  useGetProspect,
  useLogProspectFollowUp,
  useMarkProspectLost,
  useReopenProspect,
  type FollowUpRequestMethod,
  type FollowUpRequestStatus,
  type LostRequestReason,
  type ProspectDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, describedBy, Field, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Mail, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { PanelEdge } from "../../components/panel-edge";
import { LayoutStack, useViewLayout, type LayoutMeta } from "../layout/custom-view";
import { formatDate, formatDateTime } from "../../lib/labels";
import {
  PROSPECT_PANEL_DEFAULT,
  PROSPECT_PANEL_NARROWEST,
  PROSPECT_PANEL_WIDEST,
  usePreferences,
} from "../../lib/preferences";
import {
  LOST_REASONS,
  METHOD_LABELS,
  OPEN_STATUSES,
  STATUS_LABELS,
  STATUS_PILLS,
  statusLabel,
} from "./prospect-labels";

type Section = "details" | "email" | "follow-ups";

/** The panel's sections, moved or hidden by each reader for every prospect they open. */
const SECTIONS: Record<Section, LayoutMeta> = {
  details: { title: "Details", area: "side" },
  email: { title: "Send follow-up email", area: "side" },
  "follow-ups": { title: "Follow-ups", area: "side" },
};

const DEFAULT_SECTIONS = Object.keys(SECTIONS) as Section[];

const today = () => new Date().toLocaleDateString("en-CA");

/** Bounds for dates that may be any day, past or future: when a follow-up happened is not limited. */
const LONG_AGO = new Date(2000, 0, 1);
const FAR_AHEAD = new Date(2100, 0, 1);

/**
 * A prospect opened, in a panel over the list rather than on a page of its own: the list is where the work is
 * done, and a reader moving from one prospect to the next keeps their place in it.
 */
export function ProspectPanel({ id, onClose, onEdit }: {
  id: string;
  onClose: () => void;
  onEdit: (detail: ProspectDetail) => void;
}) {
  const prospect = useGetProspect(id);
  const [logging, setLogging] = useState(false);
  const [losing, setLosing] = useState(false);
  const [converting, setConverting] = useState(false);
  const { preferences, change } = usePreferences();
  const view = useViewLayout("prospect-panel", SECTIONS, DEFAULT_SECTIONS);
  // Live while a drag is in flight; what is on file otherwise, as with the assistant's panel.
  const [dragged, setDragged] = useState<number | null>(null);
  const width = dragged ?? preferences.prospectPanelWidth;
  const held = useCallback(
    (to: number) => Math.min(Math.max(Math.round(to), PROSPECT_PANEL_NARROWEST), PROSPECT_PANEL_WIDEST),
    [],
  );
  const onDrag = useCallback((to: number) => setDragged(held(to)), [held]);
  const onSettled = useCallback(
    (to: number) => {
      change("prospectPanelWidth", held(to));
      setDragged(null);
    },
    [change, held],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !losing && !converting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, losing, converting]);

  const detail = prospect.data;
  const row = detail?.prospect;
  const open = row ? OPEN_STATUSES.includes(row.status) : false;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-900/20" onClick={onClose} aria-hidden="true" />
      <aside
        aria-label={row ? row.fullName : "Prospective client"}
        style={{ width }}
        className="fixed top-0 right-0 bottom-0 z-40 flex max-w-full flex-col border-l border-line bg-white shadow-2xl"
      >
        <PanelEdge
          label="How wide the prospect's panel is"
          width={width}
          narrowest={PROSPECT_PANEL_NARROWEST}
          widest={PROSPECT_PANEL_WIDEST}
          opensAt={PROSPECT_PANEL_DEFAULT}
          onDrag={onDrag}
          onSettled={onSettled}
        />
        {!detail || !row ? (
          <div className="p-6 text-sm text-ink-muted">{prospect.isError ? "This prospect couldn't be opened." : "Opening…"}</div>
        ) : (
          <>
            <header className="space-y-4 border-b border-line px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
                    {row.fullName}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_PILLS[row.status])}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </h2>
                </div>
                {!view.editing && (
                  <button type="button" onClick={view.begin} title="Move or hide this panel's sections"
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-ink">
                    <LayoutGrid className="size-5" aria-hidden="true" />
                    <span className="sr-only">Customize the panel</span>
                  </button>
                )}
                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-ink">
                  <X className="size-5" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.mayConvert && open && (
                  <Button size="sm" onClick={() => setConverting(true)}>Convert to Client</Button>
                )}
                {detail.mayChange && open && (
                  <Button size="sm" variant="secondary" onClick={() => setLogging((was) => !was)}>Log follow-up</Button>
                )}
                {detail.mayChange && open && (
                  <Button size="sm" variant="secondary" onClick={() => onEdit(detail)}>Edit</Button>
                )}
                {detail.mayChange && open && (
                  <Button size="sm" variant="secondary" onClick={() => setLosing(true)}>Mark as Lost</Button>
                )}
                {detail.mayChange && row.status === "LOST" && <Reopen id={row.id} />}
                {row.status === "CONVERTED" && detail.onboardingCaseId && (
                  <Link
                    to={`/onboarding/${detail.onboardingCaseId}`}
                    className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-semibold text-on-accent hover:bg-primary-700"
                  >
                    Open their onboarding
                  </Link>
                )}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {logging && <LogFollowUp detail={detail} onDone={() => setLogging(false)} />}

              <LayoutStack view={view} screen="Prospect panel" render={{
                details: (
                  <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                    <Fact label="Reference">{row.reference}</Fact>
                    <Fact label="Assigned to">{row.assignedTo?.fullName ?? <Muted>Nobody yet</Muted>}</Fact>
                    <Fact label="Email">{row.email ?? <Muted>None given</Muted>}</Fact>
                    <Fact label="Phone">{row.phone ?? <Muted>None given</Muted>}</Fact>
                    <Fact label="Next follow up">
                      {row.nextFollowUp ? (
                        <span className={cn(row.overdue && "font-semibold text-red-700")}>
                          {formatDate(row.nextFollowUp)}{row.overdue && " · overdue"}
                        </span>
                      ) : <Muted>Not set</Muted>}
                    </Fact>
                    {detail.lostReason && <Fact label="Lost because">{LOST_REASONS[detail.lostReason]}</Fact>}
                    <Fact label="Notes">{detail.notes ? <span className="whitespace-pre-wrap">{detail.notes}</span> : <Muted>None</Muted>}</Fact>
                  </dl>
                ),
                email: detail.mayChange && open ? <EmailBox detail={detail} /> : (
                  <p className="text-xs text-ink-muted">Follow-up emails can be sent while the prospect is open.</p>
                ),
                "follow-ups": (
                  <section>
                    <h3 className="mb-3 text-2xs font-bold tracking-wider text-ink-muted uppercase">Follow-ups</h3>
                    <ol className="space-y-4 border-l-2 border-line pl-5">
                      {detail.followUps.map((one) => (
                        <li key={one.id} className="relative text-sm">
                          <span className="absolute top-1 -left-[1.6rem] size-2.5 rounded-full border-2 border-primary-600 bg-white" aria-hidden="true" />
                          <p className="text-xs text-ink-muted">
                            {formatDate(one.happenedOn)} · {METHOD_LABELS[one.method]} · {one.writtenBy}
                          </p>
                          <p className="font-semibold">
                            {one.emailSubject ? `Email: ${one.emailSubject}` : `Status: ${statusLabel(one.statusAfter)}`}
                          </p>
                          {one.notes && <p className="mt-0.5 whitespace-pre-wrap text-ink-soft">{one.notes}</p>}
                          {one.nextFollowUp && <p className="mt-0.5 text-xs text-ink-muted">Next follow up {formatDate(one.nextFollowUp)}</p>}
                        </li>
                      ))}
                      <li className="relative text-sm">
                        <span className="absolute top-1 -left-[1.6rem] size-2.5 rounded-full border-2 border-slate-300 bg-white" aria-hidden="true" />
                        <p className="text-xs text-ink-muted">{formatDateTime(detail.createdAt)} · {detail.createdBy}</p>
                        <p className="font-semibold">Added as a prospective client</p>
                      </li>
                    </ol>
                  </section>
                ),
              }} />
            </div>
          </>
        )}
      </aside>
      {detail && <LostDialog open={losing} detail={detail} onClose={() => setLosing(false)} />}
      {detail && <ConvertDialog open={converting} detail={detail} onClose={() => setConverting(false)} />}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

/** Puts a prospect's new state everywhere it is shown: the panel, the list and the overview. */
function useSettled() {
  const queryClient = useQueryClient();
  return (detail: ProspectDetail) => {
    queryClient.setQueryData(getGetProspectQueryKey(detail.prospect.id), detail);
    void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
    void queryClient.invalidateQueries({ queryKey: getGetClientManagementOverviewQueryKey() });
  };
}

function LogFollowUp({ detail, onDone }: { detail: ProspectDetail; onDone: () => void }) {
  const settled = useSettled();
  const [happenedOn, setHappenedOn] = useState(today());
  const [method, setMethod] = useState<FollowUpRequestMethod>("CALL");
  const [status, setStatus] = useState<FollowUpRequestStatus>(detail.prospect.status as FollowUpRequestStatus);
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const log = useLogProspectFollowUp<ApiError>({
    mutation: {
      onSuccess: (saved) => {
        settled(saved);
        onDone();
      },
    },
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    log.mutate({
      id: detail.prospect.id,
      data: { happenedOn, method, status, notes: notes.trim() || null, nextFollowUp: next || null },
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
      <h3 className="text-sm font-bold">Log a follow-up</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="follow-up-on" label="When">
          <DateInput id="follow-up-on" name="happenedOn" value={happenedOn} min={LONG_AGO} max={new Date()} onChange={setHappenedOn} />
        </Field>
        <Field id="follow-up-how" label="How">
          <SelectInput id="follow-up-how" value={method} onChange={(event) => setMethod(event.target.value as FollowUpRequestMethod)}>
            {(["CALL", "MEETING", "MESSAGE", "EMAIL", "NOTE"] as const).map((one) => (
              <option key={one} value={one}>{METHOD_LABELS[one]}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="follow-up-status" label="Status now">
          <SelectInput id="follow-up-status" value={status} onChange={(event) => setStatus(event.target.value as FollowUpRequestStatus)}>
            {OPEN_STATUSES.map((one) => (
              <option key={one} value={one}>{STATUS_LABELS[one]}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="follow-up-next" label="Next follow up">
          <DateInput id="follow-up-next" name="nextFollowUp" value={next} min={new Date()} max={FAR_AHEAD} clearable onChange={setNext} />
        </Field>
      </div>
      <Field id="follow-up-notes" label="What happened">
        <TextArea id="follow-up-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {log.error && <Alert tone="danger">{log.error.message}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={log.isPending}>Save follow-up</Button>
      </div>
    </form>
  );
}

/**
 * A follow-up email, sent from the portal's own address; the prospect's reply goes to whoever wrote it. Off
 * when they have no email address or asked not to be emailed.
 */
function EmailBox({ detail }: { detail: ProspectDetail }) {
  const settled = useSettled();
  const row = detail.prospect;
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [next, setNext] = useState("");
  const [sent, setSent] = useState(false);
  // Set when Send is pressed with the subject or message empty; each stays red until it is written.
  const [tried, setTried] = useState(false);
  const email = useEmailProspect<ApiError>({
    mutation: {
      onSuccess: (saved) => {
        settled(saved);
        setSubject("");
        setMessage("");
        setNext("");
        setTried(false);
        setSent(true);
      },
    },
  });

  if (!row.email || row.doNotEmail) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">
        <Mail className="size-4" aria-hidden="true" />
        {row.doNotEmail ? "They asked not to be emailed." : "No email address."}
      </p>
    );
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSent(false);
    if (!subject.trim() || !message.trim()) {
      setTried(true);
      document.getElementById(!subject.trim() ? "email-subject" : "email-message")?.focus();
      return;
    }
    email.mutate({ id: row.id, data: { subject, message, nextFollowUp: next || null } });
  };
  const subjectError = tried && !subject.trim() ? "Enter a subject." : undefined;
  const messageError = tried && !message.trim() ? "Write the message." : undefined;
  return (
    <form id="prospect-email" onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-2xs font-bold tracking-wider text-ink-muted uppercase">Send follow-up email</h3>
      <div className="space-y-3 rounded-xl border border-primary-100 bg-white p-4">
        <p className="text-sm text-ink-muted">To <span className="font-semibold text-ink">{row.email}</span></p>
        <Field id="email-subject" label="Subject" required error={subjectError}>
          <TextInput {...describedBy("email-subject", subjectError)} id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Field>
        <Field id="email-message" label="Message" required error={messageError}>
          <TextArea {...describedBy("email-message", messageError)} id="email-message" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        <Field id="email-next" label="Next follow up">
          <DateInput id="email-next" name="nextFollowUp" value={next} min={new Date()} max={FAR_AHEAD} clearable onChange={setNext} />
        </Field>
        {email.error && <Alert tone="danger">{email.error.problem?.errors ? "Give the email a subject and a message." : email.error.message}</Alert>}
        {sent && <Alert tone="success">Sent.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" disabled={email.isPending}>
            {email.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Reopen({ id }: { id: string }) {
  const settled = useSettled();
  const reopen = useReopenProspect<ApiError>({ mutation: { onSuccess: settled } });
  return (
    <Button size="sm" variant="secondary" disabled={reopen.isPending} onClick={() => reopen.mutate({ id })}>
      Reopen
    </Button>
  );
}

function LostDialog({ open, detail, onClose }: { open: boolean; detail: ProspectDetail; onClose: () => void }) {
  const settled = useSettled();
  const [reason, setReason] = useState<LostRequestReason>("NOT_INTERESTED");
  const [note, setNote] = useState("");
  const lost = useMarkProspectLost<ApiError>({
    mutation: {
      onSuccess: (saved) => {
        settled(saved);
        onClose();
      },
    },
  });
  return (
    <Dialog open={open} title={`Mark ${detail.prospect.fullName} as lost`} onClose={onClose}>
      <div className="space-y-4">
        <Field id="lost-reason" label="Why">
          <SelectInput id="lost-reason" value={reason} onChange={(event) => setReason(event.target.value as LostRequestReason)}>
            {Object.entries(LOST_REASONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id="lost-note" label="Note">
          <TextArea id="lost-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {lost.error && <Alert tone="danger">{lost.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={lost.isPending}
            onClick={() => lost.mutate({ id: detail.prospect.id, data: { reason, note: note.trim() || null } })}
          >
            Mark as lost
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Converting starts their onboarding with what is known about them; the onboarding form opens to carry on. */
function ConvertDialog({ open, detail, onClose }: { open: boolean; detail: ProspectDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const convert = useConvertProspect<ApiError>({
    mutation: {
      onSuccess: (converted) => {
        void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
        void queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(detail.prospect.id) });
        void queryClient.invalidateQueries({ queryKey: getGetClientManagementOverviewQueryKey() });
        void navigate(`/onboarding/${converted.onboardingCaseId}`);
      },
    },
  });
  return (
    <Dialog
      open={open}
      title={`Convert ${detail.prospect.fullName} to a client`}
      description="Their onboarding form opens with their details filled in."
      onClose={onClose}
    >
      <div className="space-y-4">
        {convert.error && <Alert tone="danger">{convert.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={convert.isPending} onClick={() => convert.mutate({ id: detail.prospect.id })}>
            Convert
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
