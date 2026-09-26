import { ApiError } from "@atomprive/api-client";
import {
  getListCaseFormsQueryKey,
  getListClientChecklistQueryKey,
  useChangeCaseForm,
  useGetCustomer,
  useGetDocumentText,
  useSaveFormDraft,
  useStartForm,
  useGetOnboardingCase,
  useListCaseForms,
  useListClientChecklist,
  type CaseDetail,
  type CaseFormRow,
  type ClientChecklist,
  type CustomerDetail,
  type DocumentGap,
  type DocumentText,
  type DocumentTextKind,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { SignHereDialog } from "../../components/sign-here-dialog";
import { StepRail, type RailStep } from "../../components/step-rail";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { hasAnyAuthority } from "../../lib/permissions";
import { categoryOf } from "../onboarding/case-category";
import { partsOf } from "./document-parts";
import { DocumentWording } from "./document-wording";
import { madeSignature } from "./made-signature";

import { formStatus } from "./form-labels";

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

const SEND: RailStep = { id: "send", group: "—", label: "Send for KYC", complete: false };

const READ_IT_OVER = "Check the details it needs, then send it for KYC review.";

/**
 * What a part of the document is called, with the gaps its name leaves filled in as the wording itself fills
 * them: the firm names itself at the head of some of its forms, and the name is what the part is called.
 */
function named(label: string, details: Record<string, string>, printed: Record<string, string>) {
  return label.replace(/\{\{(\w+)(\^?)}}/g, (_whole, key: string, shouted: string) => {
    // The same fallback the wording itself uses: what the paper printed, or that it is still to fill in.
    const said = details[key]?.trim() || printed[key] || "to fill in";
    return shouted ? said.toUpperCase() : said;
  });
}

/**
 * A document the client signs as it stands, read a part at a time the way the forms are filled in a section at
 * a time. Its wording is the firm's own; what is done here is to fill the gaps it leaves for the client's
 * details — from their record wherever we already know them — and then send it.
 */
export function DocumentPage() {
  const { caseId = "", kind = "", clientId = "" } = useParams();
  // Reached from the client list rather than from a case: the wording still reads, but sending it
  // out belongs to the case, so there is nothing to send from here.
  const fromClient = Boolean(clientId);
  const user = useStaffUser();
  // Operations fill these in and sign them; whoever onboards the client may too.
  const canChange = hasAnyAuthority(user, "FILL_CLIENT_FORMS:CHANGE", "ONBOARD_CLIENTS:CHANGE");
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  // How many rows each of the document's lists is showing. The paper rules a fixed few; here they are added.
  const [listRows, setListRows] = useState<Record<string, number>>({});
  const [at, setAt] = useState<string>();
  // Which parts have been read through. A document is signed as it stands, so most of its parts ask for
  // nothing; ticking them before anybody has opened them reads as work already done.
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  // The place on the paper being signed, and whose signature it asks for.
  const [signing, setSigning] = useState<{ spot: string; who: string } | null>(null);

  const onboarding = useGetOnboardingCase<CaseDetail, ApiError>(caseId, { query: { enabled: !fromClient } });
  const category = onboarding.data ? categoryOf(onboarding.data.summary) : undefined;
  const rows = useListCaseForms<CaseFormRow[], ApiError>(
    caseId,
    { category: category ?? "ENTITY" },
    { query: { enabled: !fromClient && Boolean(category) } },
  );
  const customer = useGetCustomer<CustomerDetail, ApiError>(clientId, { query: { enabled: fromClient } });
  const checklist = useListClientChecklist<ClientChecklist, ApiError>(clientId, { query: { enabled: fromClient } });
  const row = (fromClient ? checklist.data?.forms : rows.data)?.find((held) => held.kind === kind);
  const client = fromClient ? customer.data?.client : onboarding.data?.clients[0];
  // Sending is recorded against the application; from a client's own file that is the one they came in on.
  const sendAgainst = fromClient ? (customer.data?.onboarding?.caseId ?? "") : caseId;
  const wording = useGetDocumentText<DocumentText, ApiError>(
    kind as DocumentTextKind,
    { customerId: client?.id },
    { query: { enabled: Boolean(client) } },
  );
  const change = useChangeCaseForm<ApiError>();
  // A client's own copy has no case behind it, so what is written on it is kept against the form itself.
  const open = useStartForm<ApiError>();
  const keep = useSaveFormDraft<ApiError>();

  // What the record already knows, with anything typed here on top.
  const details = useMemo(() => {
    const held: Record<string, string> = {};
    for (const [key, value] of Object.entries(wording.data?.details ?? {})) {
      if (typeof value === "string") held[key] = value;
    }
    return { ...held, ...edits };
  }, [wording.data, edits]);

  // What the paper itself prints in each gap, which is what a gap nobody has filled in still reads as.
  const printedDetails = useMemo(() => {
    const held: Record<string, string> = {};
    for (const gap of wording.data?.gaps ?? []) {
      if (gap.printed) held[gap.key] = gap.printed;
    }
    return held;
  }, [wording.data]);

  // The boxes the document draws, as they were left last time, with anything ticked here on top.
  const ticked = useMemo(() => {
    const held: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(wording.data?.details ?? {})) {
      if (typeof value === "boolean") held[key] = value;
    }
    return { ...held, ...ticks };
  }, [wording.data, ticks]);

  const parts = useMemo(
    () => (wording.data ? partsOf(wording.data.blocks, wording.data.gaps, wording.data.title) : []),
    [wording.data],
  );

  const backTo = fromClient ? `/clients/${clientId}` : `/onboarding/${caseId}`;
  if (!wording.data) {
    return (
      <div className="space-y-4">
        <BackLink to={backTo} />
        {wording.isError ? (
          <Alert tone="danger">{wording.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">Loading the document…</p>
        )}
      </div>
    );
  }

  const sent = row?.status === "WAITING_ON_CLIENT" || row?.status === "AWAITING_COMPLIANCE"
    || row?.status === "SUBMITTED";
  // Finished, or with Compliance: either way nothing more is typed on it here.
  const signed = row?.status === "SUBMITTED" || row?.status === "AWAITING_COMPLIANCE";
  const missing = wording.data.gaps.filter((gap) => !details[gap.key]?.trim());
  const writable = canChange && !signed;
  // A client onboarded before there were cases has no application to record a send against.
  const sendable = writable && Boolean(sendAgainst);

  // A part is ticked once it has been read through and the details it leaves a gap for are all in. Most parts
  // leave no gap at all, so reading them is the whole of it; a tick before that says work nobody has done.
  const filledIn = (part: (typeof parts)[number]) => part.gaps.every((gap) => Boolean(details[gap.key]?.trim()));
  const steps: RailStep[] = [
    ...parts.map((part) => ({
      id: part.id,
      // The document's own number, where it has one. The opening part has none, so it is marked with none.
      group: part.number?.replace(/[.)]\s*$/, "") ?? (part.number === undefined ? "—" : ""),
      label: named(part.label, details, printedDetails),
      complete: read.has(part.id) && filledIn(part),
    })),
    // Ticked once it has actually gone; that every detail is in is said in words below, not with a tick.
    { ...SEND, complete: sent },
  ];
  const current = steps.find((step) => step.id === at) ?? steps[0]!;
  const index = steps.findIndex((step) => step.id === current.id);
  const part = parts.find((one) => one.id === current.id);
  const asked = parts.filter((one) => one.gaps.length > 0).length;
  // What the count under the document is about is the details, not how much of it has been read.
  const answered = parts.filter((one) => one.gaps.length > 0 && filledIn(one)).length;

  const busy = change.isPending || open.isPending || keep.isPending;

  function kept() {
    setEdits({});
    setTicks({});
    void queryClient.invalidateQueries({ queryKey: getListCaseFormsQueryKey(caseId) });
    if (clientId) void queryClient.invalidateQueries({ queryKey: getListClientChecklistQueryKey(clientId) });
    void wording.refetch();
  }

  function save(alsoSend: boolean) {
    if (!client) return;
    const answers = { ...details, ...ticked };
    // The document belongs to the application whichever way it was opened, so what is written on it and its
    // going for review are recorded there.
    if (sendAgainst) {
      change.mutate(
        {
          caseId: sendAgainst,
          kind: kind as CaseFormRow["kind"],
          data: {
            customerId: client.id,
            dueOn: null,
            waitingOnClient: null,
            signedCopyOnFile: null,
            sendForKyc: alsoSend ? true : null,
            answers,
          },
        },
        { onSuccess: kept },
      );
      return;
    }
    // A client with no application of their own keeps their copy on their own file.
    if (row?.formId) {
      keep.mutate({ id: row.formId, data: { answers, dueOn: null } }, { onSuccess: kept });
      return;
    }
    open.mutate(
      { data: { kind: kind as CaseFormRow["kind"], customerId: client.id, onboardingCaseId: null, dueOn: null } },
      { onSuccess: (started) => keep.mutate({ id: started.summary.id, data: { answers, dueOn: null } }, { onSuccess: kept }) },
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to={backTo} />

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-base font-bold">{wording.data.title}</h1>
          <span className="text-line">|</span>
          <p className="text-sm text-ink-muted">{client?.fullName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {row && <Badge tone={formStatus(row.status, row.dueOn).tone}>{formStatus(row.status, row.dueOn).label}</Badge>}
          {writable && client && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => save(false)}>
              <Check aria-hidden="true" />
              {busy ? "Saving…" : "Save the details"}
            </Button>
          )}
        </div>
      </header>

      {signed && (
        <Alert tone="success">
          {onboarding.data?.summary.clientName} has signed this
          {row?.submittedAt ? ` — their signed copy came in on ${formatDate(row.submittedAt)}` : ""}.
        </Alert>
      )}
      {sent && !signed && (
        <Alert tone="info">
          This has gone to {onboarding.data?.summary.clientName} to sign
          {row?.dueOn ? `, and is expected back by ${formatDate(row.dueOn)}` : ""}.
        </Alert>
      )}
      {change.isError && <Alert tone="danger">{change.error.message}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <StepRail
          steps={steps}
          currentId={current.id}
          onSelect={setAt}
          intro="The client signs this as it stands. Go to any part — nothing is locked."
          note={{
            title: "Nothing goes out by itself",
            body: "Read it through and fill in what it asks for. It reaches the client only once Compliance have passed it.",
          }}
          footer={
            <Link to={backTo} state={{ tab: "documents" }} className="text-xs font-medium text-primary-700 hover:underline">
              Back to the client's documents
            </Link>
          }
        />

        <section aria-labelledby="part-title" className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-6 py-6 sm:px-8">
            <p className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">
              {current.id === SEND.id ? "Finish" : wording.data.title}
            </p>
            <h2 id="part-title" className="mt-1.5 text-2xl leading-tight font-bold">
              {part?.number ? `${part.number} ` : ""}
              {current.label}
            </h2>
            {current.id === SEND.id && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{READ_IT_OVER}</p>}
          </div>

          <div key={current.id} className="space-y-6 px-6 py-6 sm:px-8">
            {current.id === SEND.id ? (
              <SendPart
                canSend={Boolean(sendable && client)}
                missing={missing}
                busy={change.isPending}
                sent={sent}
                onSend={() => save(true)}
                onGoTo={setAt}
                partOf={(gap) => parts.find((one) => one.gaps.some((held) => held.key === gap.key))?.id}
              />
            ) : (
              <>
                {part && part.gaps.length > 0 && writable && (
                  <Details
                    gaps={part.gaps}
                    details={details}
                    onChange={(key, value) => setEdits((held) => ({ ...held, [key]: value }))}
                  />
                )}
                <article className="text-ink">
                  <DocumentWording
                    blocks={part?.blocks ?? []}
                    gaps={wording.data.gaps}
                    details={details}
                    ticked={ticked}
                    onTick={
                      writable
                        ? (key, on, insteadOf) => {
                            setTicks((held) => {
                              // Picking one of a set of alternatives puts the others back.
                              const now = { ...held, [key]: on };
                              if (on) for (const other of insteadOf ?? []) now[other] = false;
                              return now;
                            });
                            // A box that goes back takes what was written on its own rule with it.
                            const gone = on ? (insteadOf ?? []) : [key];
                            setEdits((held) => {
                              const now = { ...held };
                              for (const box of gone) {
                                for (const name of Object.keys(now)) {
                                  if (name.startsWith(`${box}.`)) delete now[name];
                                }
                              }
                              return now;
                            });
                          }
                        : undefined
                    }
                    // The lines the paper rules — "Other: ____", a name, a date — are written on before it goes out.
                    onFill={writable ? (key, value) => setEdits((held) => ({ ...held, [key]: value })) : undefined}
                    // Every place the paper asks to be signed can be signed here, and none of them has to be.
                    onSign={writable ? (spot, who) => setSigning({ spot, who }) : undefined}
                    listRows={listRows}
                    onListRows={
                      writable
                        ? (table, count) => {
                            setListRows((held) => ({ ...held, [table]: count }));
                            // A row taken off the end takes what was written in it with it.
                            setEdits((held) => {
                              const now = { ...held };
                              for (const name of Object.keys(now)) {
                                if (name.startsWith(`${table}.`) && Number(name.split(".")[1]) > count) delete now[name];
                              }
                              return now;
                            });
                          }
                        : undefined
                    }
                  />
                </article>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
            <p className="text-xs text-ink-muted">
              {missing.length === 0
                ? "Every detail it asks for is in. It is ready to go to the client."
                : `${missing.length} detail${missing.length === 1 ? "" : "s"} still to fill in, over ${asked} part${asked === 1 ? "" : "s"}${answered > 0 ? ` (${answered} done)` : ""}.`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setAt(steps[index - 1]?.id ?? steps[0]!.id)}
                disabled={index === 0 || change.isPending}
              >
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
              {current.id !== SEND.id && (
                <Button
                  onClick={() => {
                    // Continuing is what says this part has been read; the tick follows from that.
                    setRead((already) => new Set(already).add(current.id));
                    setAt(steps[index + 1]?.id ?? SEND.id);
                  }}
                  disabled={change.isPending}
                >
                  Continue
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
      <SignHereDialog
        spot={signing?.spot ?? null}
        who={signing?.who ?? "the client"}
        forName={client?.fullName}
        made={signing ? madeSignature(details[signing.spot]) : null}
        onClose={() => setSigning(null)}
        onSigned={(signature) => {
          // A signature is kept with the rest of the answers: taking one off leaves the place empty again.
          if (signing) {
            const spot = signing.spot;
            setEdits((held) => ({ ...held, [spot]: signature ? JSON.stringify(signature) : "" }));
          }
          setSigning(null);
        }}
      />
    </div>
  );
}

/** The last part: what is still blank, and the send itself. */
function SendPart({
  canSend,
  missing,
  busy,
  sent,
  onSend,
  onGoTo,
  partOf,
}: {
  canSend: boolean;
  missing: DocumentGap[];
  busy: boolean;
  sent: boolean;
  onSend: () => void;
  onGoTo: (id: string) => void;
  partOf: (gap: DocumentGap) => string | undefined;
}) {
  return (
    <div className="space-y-6">
      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
          <p className="text-sm font-semibold text-ink">Still to fill in</p>
          <ul className="mt-2 space-y-1">
            {missing.map((gap) => {
              const where = partOf(gap);
              return (
                <li key={gap.key} className="text-sm text-ink">
                  {where ? (
                    <button type="button" onClick={() => onGoTo(where)} className="text-primary-700 hover:underline">
                      {gap.label}
                    </button>
                  ) : (
                    gap.label
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Alert tone="success">Every detail this document asks for is in.</Alert>
      )}

      {canSend && (
        <div className="flex flex-wrap items-end gap-3">
          {/* A document goes for review as it stands, so it goes complete: what is still blank would be
              blank on the copy the client eventually signs. */}
          <Button disabled={busy || missing.length > 0} onClick={onSend}>
            <Send aria-hidden="true" />
            {sent ? "Send for KYC again" : "Send for KYC"}
          </Button>
          {missing.length > 0 && (
            <p className="text-sm text-ink-muted">
              Fill in what is still missing above before this goes out.
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-ink-muted">No email goes out yet, so send it however you normally would.</p>
    </div>
  );
}

/** The details this part of the document leaves a gap for, asked for where the part is read. */
function Details({
  gaps,
  details,
  onChange,
}: {
  gaps: DocumentGap[];
  details: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section aria-labelledby="details-title" className="rounded-xl border border-line bg-slate-50/70 px-5 py-5">
      <h3 id="details-title" className="text-sm font-bold text-ink">
        What this part asks for
      </h3>
      <p className="mt-1 text-xs text-ink-muted">
        These drop into the wording below. Whatever the client's record already knows is in for you; a gap nobody
        fills goes out as the blank the paper leaves.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {gaps.map((gap) => (
          <Field key={gap.key} id={`gap-${gap.key}`} label={gap.label}>
            {gap.key === "effectiveDate" ? (
              <DateInput
                id={`gap-${gap.key}`}
                name={gap.key}
                value={details[gap.key] ?? ""}
                min={yearsFromToday(-2)}
                max={yearsFromToday(2)}
                onChange={(value) => onChange(gap.key, value)}
              />
            ) : (
              <TextInput
                id={`gap-${gap.key}`}
                value={details[gap.key] ?? ""}
                autoComplete="off"
                onChange={(event) => onChange(gap.key, event.target.value)}
              />
            )}
          </Field>
        ))}
      </div>
    </section>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} state={{ tab: "documents" }} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
      <ChevronLeft aria-hidden="true" className="size-4" />
      Client documents
    </Link>
  );
}
