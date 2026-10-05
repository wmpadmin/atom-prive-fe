import { ApiError } from "@atomprive/api-client";
import {
  useCreateProposal,
  useGetProposal,
  listProposals,
  useListCurrencies,
  useListCustomers,
  useListMyClients,
  useRecordClientDecision,
  useResendProposal,
  useSignOffProposal,
  useSubmitProposal,
  useUpdateProposal,
  type Currency,
  type CustomerPage,
  type ProposalDetail,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, describedBy, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { asFigure } from "../../lib/figures";
import { csvOf, download, EXPORT_LIMIT } from "./proposal-export";
import { SentProposalsHeader } from "./sent-proposals-header";
import { ProposalLineEditor } from "./proposal-line-editor";
import { EMPTY_LINE, linesFrom, type TypedLine } from "./proposal-line-values";
import { ProposalAttachment } from "./proposal-attachment";
import { ProposalLines } from "./proposal-lines";
import { ProposalTrail } from "./proposal-trail";
import { clientFileHref, hasAnyAuthority, hasAuthority, WRITES_PROPOSALS } from "../../lib/permissions";
import { formatDate, formatDateTime, formatRelative } from "../../lib/labels";
import { expiryLabel, formatValue, proposalStatusLabels, proposalStatusTones, sentLabel } from "./proposal-labels";

/** One of the four facts above a proposal: what it was advised against, and the dates it turns on. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/** A saved proposal's lines, as the form holds them for editing. */
function typedFrom(lines: ProposalDetail["lines"]): TypedLine[] {
  return lines.map((line) => ({
    asset: line.asset,
    action: line.action,
    amount: line.amount === null || line.amount === undefined ? "" : String(line.amount),
    weightFrom: String(line.weightFrom),
    weightTo: String(line.weightTo),
  }));
}

/**
 * Writing a proposal, and reading one back (#86, #87, #88, #93). A draft can be edited and sent; once it has gone it
 * is read-only, and an expired one is copied as a fresh draft.
 */
export function ProposalPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const writing = proposalId === undefined;
  const form = useRef<HTMLFormElement>(null);
  // Where this proposal was opened from. It is read from three screens and is the same screen from all of
  // them: a manager who came from their sign-off queue, and an advisor who came from the client's own file,
  // were both being sent on to Sent proposals, which is neither the list they were working nor one they had
  // been on. The client's file needs no id in the address — the proposal names its own client.
  const cameFrom = useSearchParams()[0].get("from");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: on a form this long the first bad field is a screen above Send.
  useShowFirstError(errors, form);
  const [notice, setNotice] = useState<string>();
  // Where what just happened is said, so a send can take the reader to it.
  const moments = useRef<HTMLDivElement>(null);
  /** Which answer is being written down: a manager sending it back, or the client's own. */
  const [answering, setAnswering] = useState<"send-back" | "client" | null>(null);
  const [comment, setComment] = useState("");
  const [clientSaid, setClientSaid] = useState(true);
  // Typed rather than native: a number box takes "e" as scientific notation and then reports itself empty,
  // so a figure somebody fumbled would be dropped on the way out instead of questioned.
  // Null until somebody types: the box then shows what is on the proposal, and what was typed from then on.
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [typedObjective, setTypedObjective] = useState<string | null>(null);
  const [typedLines, setTypedLines] = useState<TypedLine[] | null>(null);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  /** Searching from here is searching the list, so it goes back to the list carrying what was typed. */
  function searchTheList(value: string) {
    setSearch(value);
    void navigate(`/proposals?q=${encodeURIComponent(value)}`, { replace: true });
  }

  /** The same export the list offers, because the button means the same thing wherever it is pressed. */
  async function exportEverything() {
    setExporting(true);
    try {
      const all = await listProposals({ page: 0, size: EXPORT_LIMIT });
      download(csvOf(all.items), `proposals-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  }
  const user = useStaffUser();
  const signsOff = hasAnyAuthority(user, "APPROVE_PROPOSALS:CHANGE", "APPROVE_PROPOSALS:OWN_CLIENTS");
  const writes = hasAnyAuthority(user, ...WRITES_PROPOSALS);

  const detail = useGetProposal<ProposalDetail, ApiError>(proposalId ?? "", { query: { enabled: !writing } });
  const currencies = useListCurrencies<Currency[], ApiError>();
  // Whose clients may be written for: an advisor's own assigned list, or the whole book for whoever holds
  // proposals at full. Offering an advisor every client would be offering them ones the API then refuses;
  // offering a portfolio manager only their own would be an empty list, because they are assigned none.
  const forEveryClient = hasAuthority(user, "SEND_PROPOSALS:CHANGE");
  const mine = useListMyClients<CustomerPage, ApiError>({ size: 100 }, { query: { enabled: !forEveryClient } });
  const everyone = useListCustomers<CustomerPage, ApiError>({ size: 100 }, { query: { enabled: forEveryClient } });
  const clients = forEveryClient ? everyone : mine;
  const noClients = clients.isSuccess && (clients.data?.items.length ?? 0) === 0;

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useCreateProposal<ApiError>({
    mutation: { onSuccess: (saved) => navigate(`/proposals/${saved.summary.id}`, { replace: true }), onError },
  });
  const update = useUpdateProposal<ApiError>({
    mutation: { onSuccess: () => moved("Saved."), onError },
  });
  const submit = useSubmitProposal<ApiError>({
    mutation: {
      onSuccess: (saved) =>
        moved(
          saved.summary.status === "PENDING_MANAGER_REVIEW"
            ? "Sent to your manager for sign-off."
            : "Sent to the client.",
        ),
      onError,
    },
  });
  const resend = useResendProposal<ApiError>({
    mutation: { onSuccess: (copy) => navigate(`/proposals/${copy.summary.id}`), onError },
  });
  /**
   * Says what happened, and reads the proposal back. Both halves matter: a proposal that has been sent is a
   * different document — read rather than written, with a new line on its trail — and a screen still showing
   * the draft form says nothing happened at all.
   */
  function moved(said: string) {
    setNotice(said);
    void detail.refetch();
    // Said at the top, pressed at the bottom. On a proposal this long the notice is off-screen from where
    // the button was, which is why a send that worked looked like a button that did nothing.
    moments.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function answered(said: string) {
    setAnswering(null);
    setComment("");
    moved(said);
  }
  const signOff = useSignOffProposal<ApiError>({
    mutation: {
      onSuccess: (saved) =>
        answered(
          saved.summary.status === "RETURNED"
            ? "Sent back to the advisor."
            : "Signed off, and sent to the client.",
        ),
      onError,
    },
  });
  const clientAnswer = useRecordClientDecision<ApiError>({
    mutation: { onSuccess: () => answered("The client's answer is on the record."), onError },
  });

  if (!writing && !detail.data) {
    return detail.isError ? (
      <Alert tone="danger">{detail.error.status === 404 ? "This proposal doesn't exist." : detail.error.message}</Alert>
    ) : (
      <p className="text-sm text-ink-muted">Loading the proposal…</p>
    );
  }

  const proposal = detail.data;
  // A proposal opened for editing arrives after the first render, so the boxes read from it until typed in.
  const amount = typedAmount ?? (proposal?.summary.valueAmount == null ? "" : String(proposal.summary.valueAmount));
  const currency = chosenCurrency ?? proposal?.summary.valueCurrency ?? "USD";
  const objective = typedObjective ?? proposal?.objective ?? "";
  const lines = typedLines ?? (proposal && proposal.lines.length > 0 ? typedFrom(proposal.lines) : [{ ...EMPTY_LINE }]);
  const status = (proposal?.summary.status ?? "DRAFT") as ProposalRowStatus;
  // A draft is only editable by whoever wrote it. Whoever oversees the firm's advice reads every proposal,
  // and the API answers their save with "doesn't exist" — so the form is not offered to them in the first
  // place rather than inviting an edit that cannot land.
  // Never sent, or sent and handed back to be put right: both are the author's to write. The same two states
  // the API calls editable, so a screen that offers Save never meets a refusal from the other side.
  const editable =
    writing || ((status === "DRAFT" || status === "RETURNED") && proposal?.summary.advisorId === user.id);
  const busy = create.isPending || update.isPending || submit.isPending;
  const deciding = signOff.isPending || clientAnswer.isPending;
  // A sign-off is what sends it to the client, and it is somebody else's to give: the advisor who wrote it
  // does not see the buttons, because the API would refuse them anyway.
  const toSignOff = !writing && status === "PENDING_MANAGER_REVIEW" && signsOff && proposal!.summary.advisorId !== user.id;
  const withTheClient = !writing && status === "PENDING_REVIEW";

  /** What is on the screen, as the API takes it. */
  function typedInto(form: HTMLFormElement) {
    const said = new FormData(form);
    const figure = amount.trim();
    return {
      customerId: String(said.get("customerId")),
      title: String(said.get("title")),
      summary: String(said.get("summary")).trim() || null,
      body: String(said.get("body")),
      valueAmount: figure ? Number(figure) : null,
      valueCurrency: currency.trim() || null,
      affectedAccounts: String(said.get("affectedAccounts")).trim() || null,
      objective: objective.trim() || null,
      lines: linesFrom(lines),
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = typedInto(event.currentTarget);
    setErrors(noErrors);
    setNotice(undefined);
    if (writing) create.mutate({ data });
    else update.mutate({ id: proposalId!, data });
  }

  /**
   * Sends what is on the screen, which means writing it down first.
   *
   * <p>Send used to submit whatever was last saved. Anything typed and not saved was quietly dropped, and the
   * proposal went to the manager — or to the client — saying something its author had already changed. A
   * button beside Save that sends a different document than the one being read is worse than one that fails.
   */
  async function saveAndSend() {
    const onScreen = form.current;
    if (!onScreen) return;
    setErrors(noErrors);
    setNotice(undefined);
    try {
      await update.mutateAsync({ id: proposalId!, data: typedInto(onScreen) });
      await submit.mutateAsync({ id: proposalId! });
    }
    catch {
      // Both report through onError, which has already put the refusal on the screen.
    }
  }

  const back =
    cameFrom === "review"
      ? { to: "/manager-review", label: "Back to what is waiting on you" }
      : cameFrom === "client" && proposal
        ? {
            to: clientFileHref(user, proposal.summary.customerId),
            label: `Back to ${proposal.summary.customerName}`,
          }
        : { to: "/proposals", label: "Back to sent proposals" };

  return (
    <div className="space-y-6">
      {/* The screen is the list; a proposal is read within it, so the way back is never off the page. */}
      {!writing && (
        <SentProposalsHeader
          writes={writes}
          search={search}
          onSearch={searchTheList}
          onExport={() => void exportEverything()}
          exporting={exporting}
          canExport
          extra={
            status === "EXPIRED" ? (
              <Button
                variant="secondary"
                disabled={resend.isPending}
                onClick={() => resend.mutate({ id: proposalId! })}
              >
                {resend.isPending ? "Copying…" : "Resend as new proposal"}
              </Button>
            ) : null
          }
        />
      )}

      <Link to={back.to} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        {back.label}
      </Link>

      {/* Who it is for, where it stands, and what it was advised against: read together, so grouped together. */}
      <header className="space-y-4 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {!writing && <Avatar name={proposal!.summary.customerName} />}
            <div className="min-w-0">
              <h1 className="text-[1.625rem] leading-tight font-bold">
                {writing ? "New proposal" : proposal!.summary.title}
              </h1>
              {!writing && (
                <p className="mt-0.5 text-sm text-ink-muted">
                  {proposal!.summary.summary && `${proposal!.summary.summary} · `}
                  {proposal!.summary.customerName} · {proposal!.summary.customerCode} ·{" "}
                  {proposal!.summary.reference}
                </p>
              )}
            </div>
          </div>
          {!writing && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <Badge tone={proposalStatusTones[status]}>{proposalStatusLabels[status]}</Badge>
                <p className="mt-1 text-xs text-ink-muted">
                  {formatRelative(proposal!.summary.sentAt ?? proposal!.summary.createdAt)}
                </p>
              </div>
            </div>
          )}
        </div>

      <div ref={moments}>{notice && <Alert tone="success">{notice}</Alert>}</div>
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {/* While it is back with its author. The comment stays on the record after they send it again, so
          reading it off the comment alone said "your manager sent this back" about one that had since gone. */}
      {status === "RETURNED" && proposal?.summary.managerComment && (
        <Alert tone="warning">
          <span className="font-semibold">Your manager sent this back:</span> {proposal.summary.managerComment}
        </Alert>
      )}

      {status === "EXPIRED" && (
        <Alert tone="danger">
          This proposal ran out before the client answered, so it can't be approved. Send it again as a new one.
        </Alert>
      )}

      {proposal?.clientComment && (
        <Alert tone={status === "APPROVED" ? "success" : "danger"}>
          <span className="font-semibold">The client {status === "APPROVED" ? "approved" : "rejected"} this:</span>{" "}
          {proposal.clientComment}
        </Alert>
      )}

      {/* What the advice was given against, and the dates it turns on — the four facts read before the detail. */}
      {!writing && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Portfolio value">
            {proposal!.portfolioValue === null
              ? "Not recorded"
              : formatValue(proposal!.portfolioValue, proposal!.portfolioCurrency)}
          </Fact>
          <Fact label="Sent">
            {sentLabel(status, proposal!.summary.sentAt, proposal!.summary.submittedAt)}
          </Fact>
          <Fact label="Expires">
            {expiryLabel(proposal!.summary.expiresAt, status, proposal!.summary.decidedAt)}
          </Fact>
          <Fact label="Objective">{proposal!.objective ?? "Not set"}</Fact>
        </dl>
      )}
      </header>

      <form ref={form} onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-line bg-white p-6">
        {editable ? (
          <>
        <Field id="customerId" label="Client" error={errors.fields.customerId}>
          <SelectInput
            {...describedBy("customerId", errors.fields.customerId)}
            name="customerId"
            defaultValue={proposal?.summary.customerId ?? ""}
            disabled={!editable || noClients}
            required
          >
            <option value="" disabled>
              {noClients ? "No clients are assigned to you" : "Choose a client"}
            </option>
            {(clients.data?.items ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName} · {client.code}
              </option>
            ))}
          </SelectInput>
          {/* An empty list is not a fault to report, but it is a dead end, so it says what it is. */}
          {noClients && (
            <p className="mt-1.5 text-xs text-ink-muted">
              A proposal is written for a client assigned to you, and you have none. Ask an Admin to assign
              one, then this list will fill.
            </p>
          )}
        </Field>

        <Field id="title" label="Title" error={errors.fields.title}>
          <TextInput
            {...describedBy("title", errors.fields.title)}
            name="title"
            defaultValue={proposal?.summary.title ?? ""}
            placeholder="Rebalance — equities"
            disabled={!editable}
            required
          />
        </Field>

        <Field id="summary" label="One-line summary" error={errors.fields.summary} hint="Shown under the title in the list.">
          <TextInput
            {...describedBy("summary", errors.fields.summary)}
            name="summary"
            defaultValue={proposal?.summary.summary ?? ""}
            placeholder="Reduce single-name concentration"
            disabled={!editable}
          />
        </Field>

        <Field
          id="objective"
          label="Objective"
          error={errors.fields.objective}
          hint="What this is for, in a line. Shown to the client above the detail."
        >
          <TextInput
            {...describedBy("objective", errors.fields.objective)}
            name="objective"
            value={objective}
            placeholder="Reduce concentration risk in listed equities"
            disabled={!editable}
            onChange={(event) => setTypedObjective(event.target.value)}
          />
        </Field>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            What you're proposing
          </legend>
          <p className="mt-1 text-xs text-ink-muted">
            Holding by holding, so the client can see what moves and where it leaves them. A part-written line
            is left out. Advisory only — nothing here is executed.
          </p>
          <div className="mt-2">
            {editable ? (
              <ProposalLineEditor lines={lines} disabled={busy} onChange={setTypedLines} />
            ) : (
              <ProposalLines lines={proposal?.lines ?? []} currency={proposal?.summary.valueCurrency ?? null} />
            )}
          </div>
          {errors.fields.lines && <p className="mt-1.5 text-xs text-red-600">{errors.fields.lines}</p>}
        </fieldset>

        <Field id="body" label="Rationale shown to the client" error={errors.fields.body}>
          <textarea
            {...describedBy("body", errors.fields.body)}
            name="body"
            defaultValue={proposal?.body ?? ""}
            rows={10}
            disabled={!editable}
            required
            className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm leading-6 text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none disabled:text-ink-soft aria-invalid:border-red-500"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field id="valueAmount" label="Value" error={errors.fields.valueAmount} hint="What the change is worth, if it has a figure.">
            <TextInput
              {...describedBy("valueAmount", errors.fields.valueAmount)}
              name="valueAmount"
              inputMode="decimal"
              value={amount}
              disabled={!editable}
              onChange={(event) => setTypedAmount(asFigure(event.target.value, amount))}
            />
          </Field>
          <Field id="valueCurrency" label="Currency" error={errors.fields.valueCurrency}>
            <SelectInput
              {...describedBy("valueCurrency", errors.fields.valueCurrency)}
              name="valueCurrency"
              value={currency}
              disabled={!editable}
              onChange={(event) => setChosenCurrency(event.target.value)}
            >
              {/* Whatever the proposal was saved in stays offered, even if the firm has since dropped it. */}
              {!(currencies.data ?? []).some((one) => one.code === currency) && (
                <option value={currency}>{currency}</option>
              )}
              {(currencies.data ?? []).map((one) => (
                <option key={one.code} value={one.code}>
                  {one.code} — {one.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field
          id="affectedAccounts"
          label="Accounts this touches"
          error={errors.fields.affectedAccounts}
          hint="One per line. A proper checklist arrives with the bank accounts."
        >
          <textarea
            {...describedBy("affectedAccounts", errors.fields.affectedAccounts)}
            name="affectedAccounts"
            defaultValue={proposal?.affectedAccounts ?? ""}
            rows={3}
            disabled={!editable}
            placeholder={"Custody ••4410\nManaged ••2290"}
            className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none disabled:text-ink-soft"
          />
        </Field>

        <ProposalAttachment
          proposalId={proposalId ?? null}
          attachment={proposal?.attachment ?? null}
          editable={editable}
          onChanged={() => void detail.refetch()}
        />

          </>
        ) : (
          <>
        {/* Sent, it is a record of advice given rather than something to fill in, so it reads as one. */}
        <section>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What was proposed</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Line-by-line changes shown to the client. Advisory only — no execution.
          </p>
          <div className="mt-3">
            <ProposalLines lines={proposal!.lines} currency={proposal!.summary.valueCurrency} />
          </div>
        </section>

        <section>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Rationale shown to the client
          </h2>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink">{proposal!.body}</p>
        </section>

        {proposal!.affectedAccounts && (
          <section>
            <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Accounts this touches
            </h2>
            <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink">{proposal!.affectedAccounts}</p>
          </section>
        )}

        {/* A manager signing one off reads all of it, so what came with it is here too, not only on the draft. */}
        <ProposalAttachment
          proposalId={proposalId ?? null}
          attachment={proposal!.attachment}
          editable={false}
          onChanged={() => void detail.refetch()}
        />

          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">
            {writing
              ? "Saved as a draft first. Nothing reaches the client until you send it."
              : proposal!.summary.sentAt
                ? `Sent ${formatDate(proposal!.summary.sentAt)} · ${expiryLabel(proposal!.summary.expiresAt, status, proposal!.summary.decidedAt)}`
                : status === "RETURNED"
                  ? "Sent back by the manager. Put it right and send it again."
                  : `Draft, last saved ${formatDateTime(proposal!.summary.createdAt)}`}
          </p>
          <div className="flex flex-wrap gap-3">
            {toSignOff && (
              <>
                <Button variant="secondary" disabled={deciding} onClick={() => setAnswering("send-back")}>
                  Send back
                </Button>
                <Button
                  disabled={deciding}
                  onClick={() => signOff.mutate({ id: proposalId!, data: { approved: true, comment: null } })}
                >
                  {signOff.isPending ? "Signing off…" : "Sign off and send"}
                </Button>
              </>
            )}
            {withTheClient && (
              <Button variant="secondary" disabled={deciding} onClick={() => setAnswering("client")}>
                Record the client's answer
              </Button>
            )}
            {editable && (
              <Button type="submit" variant="secondary" disabled={busy}>
                {busy ? "Saving…" : writing ? "Save draft" : "Save"}
              </Button>
            )}
            {!writing && editable && (
              <Button disabled={busy} onClick={() => void saveAndSend()}>
                {submit.isPending ? "Sending…" : "Send"}
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* A proposal that has been sent is a record of advice given, so what happened to it is shown with it. */}
      {!writing && (
        <section aria-labelledby="trail-title" className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-6 py-5">
            <h2 id="trail-title" className="text-sm font-semibold">
              Audit trail
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Immutable record. A sent proposal is never altered — a change is issued as a new one.
            </p>
          </div>
          <ProposalTrail trail={proposal?.trail ?? []} />
        </section>
      )}

      <Dialog open={answering === "send-back"} title="Send this proposal back?" onClose={() => setAnswering(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            It becomes a draft again and the advisor sees what you write here. Nothing reaches the client.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field id="send-back-comment" label="What needs putting right?" required error={errors.fields.comment}>
            <TextArea
              {...describedBy("send-back-comment", errors.fields.comment)}
              id="send-back-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAnswering(null)}>
              Cancel
            </Button>
            <Button
              disabled={deciding}
              onClick={() => signOff.mutate({ id: proposalId!, data: { approved: false, comment } })}
            >
              {signOff.isPending ? "Sending back…" : "Send back"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={answering === "client"} title="What did the client say?" onClose={() => setAnswering(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Write down the answer they gave you. It is the firm's record of their decision, so it is written once.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <fieldset>
            <legend className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Their answer</legend>
            <div className="mt-1.5 flex gap-4">
              {[
                { said: true, text: "They approved it" },
                { said: false, text: "They turned it down" },
              ].map((one) => (
                <label key={one.text} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="client-said"
                    checked={clientSaid === one.said}
                    onChange={() => setClientSaid(one.said)}
                  />
                  {one.text}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="client-comment" label="Anything they said about it" error={errors.fields.comment}>
            <TextArea
              {...describedBy("client-comment", errors.fields.comment)}
              id="client-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAnswering(null)}>
              Cancel
            </Button>
            <Button
              disabled={deciding}
              onClick={() =>
                clientAnswer.mutate({ id: proposalId!, data: { approved: clientSaid, comment: comment || null } })
              }
            >
              {clientAnswer.isPending ? "Recording…" : "Record it"}
            </Button>
          </div>
        </div>
      </Dialog>

      {!writing && proposal!.summary.valueAmount !== null && (
        <p className="text-xs text-ink-muted">
          Value {formatValue(proposal!.summary.valueAmount, proposal!.summary.valueCurrency)} · advisory only, the
          platform never places a trade.
        </p>
      )}
    </div>
  );
}
