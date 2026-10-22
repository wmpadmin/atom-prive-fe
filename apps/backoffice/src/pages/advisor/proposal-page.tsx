import { ApiError } from "@atomprive/api-client";
import {
  getPrintProposalUrl,
  useCreateProposal,
  useGetProposal,
  useListClientHoldings,
  useListMovesCarryingOut,
  useListCurrencies,
  useListCustomers,
  useAnswerProposal,
  useSubmitProposal,
  useUpdateProposal,
  type ClientHoldings,
  type Currency,
  type CustomerPage,
  type MovePlanRow,
  type ProposalDetail,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, describedBy, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { saveApiFile } from "../../lib/download";
import { asFigure } from "../../lib/figures";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { ProposalsHeader } from "./proposals-header";
import { ProposalLegEditor } from "./proposal-leg-editor";
import { destinations, EMPTY_LEG, legsFrom, sources, typedFrom, type TypedLeg } from "./proposal-leg-values";
import { ProposalLegs, ProposalMoves } from "./proposal-legs";
import { ProposalTrail } from "./proposal-trail";
import { somethingElseLandsHere, wouldBreakAband } from "../portfolios/what-it-would-leave";
import { APPROVES_PROPOSALS, clientFileHref, hasAnyAuthority, WRITES_PROPOSALS } from "../../lib/permissions";
import { formatDate, formatDateTime, formatRelative } from "../../lib/labels";
import { figure, named } from "../portfolios/money-words";
import { answeredLabel, formatValue, proposalStatusLabels, proposalStatusTones, sentLabel, standingLabel } from "./proposal-labels";

/** One of the four facts above a proposal: what it was advised against, and the dates it turns on. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}


/**
 * Writing a proposal, and reading one back (#86, #87, #88, #93). A draft can be edited and sent; once it has gone it
 * is read-only, and an expired one is copied as a fresh draft.
 */
export function ProposalPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  // Whether this screen was reached from inside the app, which decides whether there is a back to go to.
  const location = useLocation();
  const writing = proposalId === undefined;
  const form = useRef<HTMLFormElement>(null);
  // Where this proposal was opened from. It is read from three screens and is the same screen from all of
  // them: a manager who came from their sign-off queue, and an advisor who came from the client's own file,
  // were both being sent on to the proposals list, which is neither the list they were working nor one they had
  // been on. The client's file needs no id in the address — the proposal names its own client.
  const cameFrom = useSearchParams()[0].get("from");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: on a form this long the first bad field is a screen above Send.
  useShowFirstError(errors, form);
  const [notice, setNotice] = useState<string>();
  // Where what just happened is said, so a send can take the reader to it.
  const moments = useRef<HTMLDivElement>(null);
  /** Whether the answer dialog is open, and which way it is being answered. */
  const [answering, setAnswering] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  // Typed rather than native: a number box takes "e" as scientific notation and then reports itself empty,
  // so a figure somebody fumbled would be dropped on the way out instead of questioned.
  // Null until somebody types: the box then shows what is on the proposal, and what was typed from then on.
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [typedObjective, setTypedObjective] = useState<string | null>(null);
  const [typedLegs, setTypedLegs] = useState<TypedLeg[] | null>(null);
  // Which client the legs are picked from, held rather than read off the form at save time: the pickers
  // list that client's own allocation, so they have to change the moment the choice does.
  const [chosenClient, setChosenClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  /** Searching from here is searching the list, so it goes back to the list carrying what was typed. */
  function searchTheList(value: string) {
    setSearch(value);
    void navigate(`/proposals?q=${encodeURIComponent(value)}`, { replace: true });
  }

  /**
   * What Export means above an open proposal: that proposal, on paper.
   *
   * <p>It used to mean the list's export — every proposal the firm holds, as a spreadsheet — which is a
   * strange thing to be handed by a button sitting over one open document. Somebody reading PR-2026-0003
   * and pressing Export wants PR-2026-0003.
   */
  async function printThisOne() {
    if (proposalId === undefined || !detail.data) return;
    setExporting(true);
    try {
      await saveApiFile(getPrintProposalUrl(proposalId), `${detail.data.summary.reference}.pdf`);
    } finally {
      setExporting(false);
    }
  }
  const user = useStaffUser();
  const answersProposals = hasAnyAuthority(user, ...APPROVES_PROPOSALS);
  const writes = hasAnyAuthority(user, ...WRITES_PROPOSALS);

  const detail = useGetProposal<ProposalDetail, ApiError>(proposalId ?? "", { query: { enabled: !writing } });
  // Whether anything has been raised to actually do what the client agreed to. The paper and the act
  // never knew about each other: a proposal sat Approved for ever, looking finished, while the
  // portfolio had not moved and no screen anywhere said so.
  const carryingOut = useListMovesCarryingOut<MovePlanRow[], ApiError>(proposalId ?? "", {
    query: { enabled: !writing && proposalId !== undefined, refetchOnWindowFocus: true },
  });
  /** Which half of a sent request is being read: what was asked, or what has happened since. */
  const [shown, setShown] = useState<"request" | "history">("request");
  const currencies = useListCurrencies<Currency[], ApiError>();
  // The whole book, because whoever writes a proposal reads the whole book. It used to depend on whether
  // the writer was held to a set of clients; nobody who is still writes one.
  const clients = useListCustomers<CustomerPage, ApiError>({ size: 100 }, { query: { enabled: writes } });
  const noClients = clients.isSuccess && (clients.data?.items?.length ?? 0) === 0;

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
        moved(`Sent to ${saved.summary.customerName}'s relationship manager.`),
      onError,
    },
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
    setNote("");
    moved(said);
  }
  const answer = useAnswerProposal<ApiError>({
    mutation: {
      onSuccess: (saved) =>
        answered(
          saved.summary.status !== "APPROVED"
            ? "Turned down. Nothing has changed for the client."
            : saved.summary.fromRebalance
              // A rebalance says only what to sell. Where it lands is the portfolio desk's judgement, so
              // agreeing moves nothing and telling the manager it had would be telling them wrong.
              ? "Agreed. Nothing has moved yet — the portfolio desk will put this client back."
              : "Approved on the client's behalf, and the money has moved.",
        ),
      onError,
    },
  });
  // A proposal stays with the client it was written for, so a saved one's pickers read from that client
  // whatever the box says; a new one reads from whoever has just been chosen. Asked for up here with the
  // other hooks, because the screen returns early while the proposal itself is still being read.
  const forClient = detail.data?.summary.customerId ?? chosenClient;
  const held = useListClientHoldings<ClientHoldings, ApiError>(forClient ?? "", undefined,
    { query: { enabled: forClient !== null } });

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
  const legs = typedLegs ?? (proposal && proposal.lines.length > 0 ? typedFrom(proposal.lines) : [{ ...EMPTY_LEG }]);
  const outOf = sources(held.data);
  const into = destinations(held.data);
  const status = (proposal?.summary.status ?? "DRAFT") as ProposalRowStatus;
  // A draft is only editable by whoever wrote it. Whoever oversees the firm's advice reads every proposal,
  // and the API answers their save with "doesn't exist" — so the form is not offered to them in the first
  // place rather than inviting an edit that cannot land.
  // Never sent, and the author's own. The same state the API calls editable, so a screen that offers Save
  // never meets a refusal from the other side. There is no second editable state any more: a proposal
  // used to come back from a manager to be put right, and nothing comes back now.
  const editable = writing || (status === "DRAFT" && proposal?.summary.advisorId === user.id);
  const busy = create.isPending || update.isPending || submit.isPending;
  const deciding = answer.isPending;
  // Asked of the server rather than worked out here. This screen can see a permission; it cannot see who
  // looks after the client, which is what the rule turns on — so it drew buttons for whoever wrote the
  // proposal, the one person who may never answer it, and would have drawn them for a manager the API
  // then refused. Being able to press a button that cannot work is worse than not having one.
  const toAnswer = !writing && (proposal?.summary.mayAnswer ?? false);
  // What the legs would do to the lines they name, worked out by the server against the figures as they
  // stand now — not here, where it would be a second reading of a band the platform already states.
  const weighed = proposal?.weighed ?? [];
  const pastAband = wouldBreakAband(weighed);
  // Why there is none, where there is none. A waiting proposal with an empty space where the buttons go
  // reads as a screen that has not finished loading, or one that is broken.
  const mine = !writing && proposal?.summary.advisorId === user.id;
  const whyNotMine = (writing || status !== "PENDING" || toAnswer || !answersProposals) ? null
    : mine
      ? "You wrote this one, so it isn't yours to answer. It is waiting on the relationship manager who "
        + "looks after this client."
      : "This client's own relationship manager answers it. It comes to you only where they cannot.";

  /** Opens the answer dialog on an empty box, so neither way of answering inherits the other's note. */
  function asking(which: "approve" | "reject" | null) {
    setNote("");
    setErrors(noErrors);
    setAnswering(which);
  }

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
      objective: objective.trim() || null,
      lines: legsFrom(legs, outOf),
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
      ? { to: "/approvals?queue=proposals&tab=waitingOnMe", label: "Back to what is waiting on you" }
      : cameFrom === "trade-logs"
      ? { to: "/trade-logs", label: "Back to trade logs" }
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
        <ProposalsHeader
            search={search}
          onSearch={searchTheList}
          onExport={() => void printThisOne()}
          exporting={exporting}
          canExport
          cappedAt={null}
          reading
        />
      )}

      {/* Back a screen, not back to a place. Somebody who opened this from Trade logs, or from a search,
          or from the client's own file, means "undo that press" — and a link that always landed on the
          client's portfolio took them somewhere they had not been. The address is kept as the href so a
          deep link, where there is nothing to go back to, still lands somewhere sensible. */}
      <Link
        to={back.to}
        onClick={(event) => {
          if (location.key !== "default") {
            event.preventDefault();
            navigate(-1);
          }
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
      >
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {pastAband && <Badge tone="warning">Past a band</Badge>}
                  {somethingElseLandsHere(weighed) && <Badge tone="warning">Another ask lands here</Badge>}
                  <Badge tone={proposalStatusTones[status]}>{proposalStatusLabels[status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {formatRelative(proposal!.summary.sentAt ?? proposal!.summary.createdAt)}
                </p>
              </div>
            </div>
          )}
        </div>

      <div ref={moments}>{notice && <Alert tone="success">{notice}</Alert>}</div>
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {/* What whoever answered said, and who they were. A refusal owes a reason; an agreement may carry
          one, and either way it is said here rather than left in a column somebody has to go looking for. */}
      {proposal?.summary.answerNote && (
        <Alert tone={status === "APPROVED" ? "success" : "danger"}>
          <span className="font-semibold">
            {proposal.summary.answeredByName ?? "The relationship manager"}{" "}
            {status === "APPROVED" ? "approved this" : "turned this down"}:
          </span>{" "}
          {proposal.summary.answerNote}
        </Alert>
      )}

      {/* What became of it. A proposal records advice; only a money move changes a portfolio, and until
          now nothing joined the two — so agreed-to advice nobody acted on was indistinguishable from
          advice that had been carried out. */}
      {status === "APPROVED" && proposal && (
        <CarriedOutBy moves={carryingOut.data ?? []} pending={carryingOut.isPending}
          fromRebalance={proposal?.summary.fromRebalance ?? false} />
      )}

      {/* What the advice was given against, and the dates it turns on — the four facts read before the detail. */}
      {!writing && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Portfolio value">
            {proposal!.portfolioValue === null
              ? "Not recorded"
              : formatValue(proposal!.portfolioValue, proposal!.portfolioCurrency)}
          </Fact>
          <Fact label="Sent">{sentLabel(proposal!.summary.sentAt)}</Fact>
          <Fact label="Standing">
            {standingLabel(status, proposal!.summary.sentAt, proposal!.summary.decidedAt,
              proposal!.summary.fromRebalance, proposal!.summary.openForPlacing)}
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
            value={forClient ?? ""}
            disabled={!editable || noClients}
            required
            onChange={(event) => {
              setChosenClient(event.target.value);
              // The legs named another client's lines, so they are not this client's to keep.
              setTypedLegs(null);
            }}
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
            What would move
          </legend>
          <p className="mt-1 text-xs text-ink-muted">
            Out of one line of the portfolio and into another, picked from this client's own allocation. A
            part-written leg is left out.
          </p>
          <div className="mt-2">
            {editable ? (
              <ProposalLegEditor
                legs={legs}
                from={outOf}
                into={into}
                disabled={busy}
                waiting={forClient === null
                  ? "Choose a client first — the legs are picked from their own allocation."
                  : held.isPending
                    ? "Reading this client's allocation…"
                    : outOf.length === 0
                      ? "This client holds nothing yet, so there is nothing to move."
                      : null}
                onChange={setTypedLegs}
              />
            ) : (
              <ProposalLegs legs={proposal?.lines ?? []} currency={proposal?.summary.valueCurrency ?? null} />
            )}
          </div>
          {(errors.fields.lines ?? errors.fields.amount) && (
            <p className="mt-1.5 text-xs text-red-600">{errors.fields.lines ?? errors.fields.amount}</p>
          )}
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

        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
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

          </>
        ) : (
          <>
        {/* Sent, it is a record of what was asked for rather than something to fill in, so it reads as one.
            Two halves, because they answer different questions: what was asked, and what has been done
            about it since. Read on one page the second was a footnote under the first — and on a rebalance,
            where the doing is the whole of what happens after the asking, that is the half somebody comes
            back for. */}
        <div role="tablist" aria-label="This request" className="flex gap-1 border-b border-line">
          {([
            { id: "request", label: "The request" },
            { id: "history", label: "History" },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={shown === option.id}
              onClick={() => setShown(option.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                shown === option.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {shown === "history" ? (
          <MoneyMovementHistory
            moves={carryingOut.data ?? []}
            pending={carryingOut.isPending}
            client={proposal!.summary.customerName}
          />
        ) : (
          <>
        <section>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What would move</h2>
          {/* What moves and what it leaves, in one table. Saying yes here moves the money, and the person
              saying it was once shown the legs and nothing else: not what each line is left holding, not
              the most the line being filled may hold, and not that something else was waiting to fill the
              same line. Read as two tables it was the reader joining them up; read as one it is the
              question they are actually answering. */}
          <div className="mt-3">
            {weighed.length > 0 ? (
              <ProposalMoves legs={weighed} currency={proposal!.summary.valueCurrency} />
            ) : (
              // Written before a proposal carried the figures its lines were weighed against. The legs
              // are all there is for one of those, so the legs are what it shows.
              <ProposalLegs legs={proposal!.lines} currency={proposal!.summary.valueCurrency} />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Rationale shown to the client
          </h2>
          <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink">{proposal!.body}</p>
        </section>
          </>
        )}

          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {/* Where it has got to, and — where there is nothing to press — why there is nothing to press. */}
          <div className="max-w-2xl space-y-1">
          <p className="text-xs text-ink-muted">
            {writing
              ? "Saved as a draft first. It reaches nobody until you send it."
              : proposal!.summary.sentAt
                ? `Sent ${formatDate(proposal!.summary.sentAt)} · ${
                  status === "APPROVED" || status === "REJECTED"
                    ? answeredLabel(status, proposal!.summary.answeredByName, proposal!.summary.decidedAt,
                        proposal!.summary.fromRebalance)
                    : standingLabel(status, proposal!.summary.sentAt, proposal!.summary.decidedAt,
                        proposal!.summary.fromRebalance, proposal!.summary.openForPlacing)}`
                : `Draft, last saved ${formatDateTime(proposal!.summary.createdAt)}`}
          </p>
          {whyNotMine && <p className="text-xs text-ink-muted">{whyNotMine}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {toAnswer && (
              <>
                <Button variant="secondary" disabled={deciding} onClick={() => asking("reject")}>
                  Reject
                </Button>
                <Button disabled={deciding} onClick={() => asking("approve")}>
                  Approve
                </Button>
              </>
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

      <Dialog
        open={answering !== null}
        title={answering === "approve" ? "Approve on the client's behalf?" : "Turn this down?"}
        onClose={() => asking(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {answering !== "approve"
              ? "Nothing changes for the client. Whoever wrote it sees what you write here."
              : proposal?.summary.fromRebalance
                ? "You are answering for this client, and saying yes moves nothing by itself. It lets the "
                  + "portfolio desk put this client back — they choose where each piece goes, and you are "
                  + "not asked again. Nobody else is asked, and the answer is written once."
                : "You are answering for this client, and saying yes moves the money. Nobody else is asked, and the answer is written once."}
          </p>
          {/* The one thing that cannot be said after the press. Going past a band is a decision the firm
              makes rather than a mistake it blocks — so it is put in front of whoever is making it, in
              the window where they make it. */}
          {answering === "approve" && pastAband && (
            <Alert tone="warning">
              Saying yes leaves a line past the most it may hold. The table behind this window says which,
              and by how much.
            </Alert>
          )}
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <Field
            id="answer-note"
            label={answering === "approve" ? "Anything to say about it" : "Why?"}
            required={answering === "reject"}
            error={errors.fields.note}
          >
            <TextArea
              {...describedBy("answer-note", errors.fields.note)}
              id="answer-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => asking(null)}>
              Cancel
            </Button>
            <Button
              // A refusal owes a reason, so the button waits for one. An agreement does not.
              disabled={deciding || (answering === "reject" && note.trim() === "")}
              onClick={() =>
                answer.mutate({
                  id: proposalId!,
                  data: { approved: answering === "approve", note: note.trim() || null },
                })
              }
            >
              {answer.isPending
                ? answering === "approve" ? "Approving…" : "Rejecting…"
                : answering === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>

      {!writing && proposal!.summary.valueAmount !== null && (
        <p className="text-xs text-ink-muted">
          Value {formatValue(proposal!.summary.valueAmount, proposal!.summary.valueCurrency)} ·{" "}
          {proposal!.summary.fromRebalance
            ? "agreeing to this moves nothing; the portfolio desk places it afterwards."
            : "approving this moves the money in the firm's record."}{" "}
          No order is placed with a broker.
        </p>
      )}
    </div>
  );
}

/**
 * What the agreement moved.
 *
 * <p>A proposal was the paper and a move was the act, and nothing joined them: somebody could agree to
 * advice and nobody carry it out, with the proposal reading Approved for ever and the portfolio never
 * moving. There was a warning here saying exactly that, and a link offering to go and raise the move by
 * hand.
 *
 * <p>Agreeing is what moves it now, so neither can be true any more. What is left is the thing itself:
 * which move carried this out, for how much, and the way through to it.
 */
function CarriedOutBy({ moves, pending, fromRebalance }: {
  moves: MovePlanRow[];
  pending: boolean;
  /** Whether agreeing to this moved the money, or only let the desk start placing it. */
  fromRebalance: boolean;
}) {
  if (pending || moves.length === 0) {
    // Nothing rather than a warning. A proposal agreed to before agreeing moved the money can read
    // Approved with no move behind it, and that is history — not something anybody can act on here.
    return null;
  }
  if (fromRebalance) {
    // Nothing here for a rebalance. Agreeing to one moves no money, so there is no figure to put in a
    // banner — and what the desk has done since is the History tab below, move by move, with everything
    // else that touched the portfolio beside it. Said in both places it was the same list twice.
    return null;
  }
  return (
    <Alert tone="success">
      <p className="font-semibold">
        {moves.length === 1 ? "This moved the money." : `${moves.length} moves carry this out.`}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {moves.map((move) => (
          <li key={move.id}>
            <Link
              to={`/moves-to-approve/${move.customerId}`}
              className="font-medium underline underline-offset-2"
            >
              {move.currency} {move.amount.toLocaleString("en-US", { minimumFractionDigits: 2,
                maximumFractionDigits: 2 })}
            </Link>
            {" — "}{move.statusSaid}
            {move.decidedByName && ` by ${move.decidedByName}`}
          </li>
        ))}
      </ul>
    </Alert>
  );
}


/**
 * What has moved under one request, a row per movement.
 *
 * <p>This request's and no others. It showed the client's whole history for a while, on the reasoning
 * that what else touched the portfolio while this was being placed is worth knowing — but a reader
 * opening the history of one request is asking what happened to THAT request, and answering with every
 * move the client has ever made buries the one or two that are the answer.
 *
 * <p>A row per LEG rather than per move, because a leg is the movement: out of here, into there, this
 * much. A move of five legs written as one row says a figure and hides the five places it came from, and
 * those five places are the whole of what somebody reads this to find out.
 */
function MoneyMovementHistory({ moves, pending, client }: {
  moves: MovePlanRow[];
  pending: boolean;
  client: string;
}) {
  // Flattened to a row per leg up here, above the two cases that return below, because which page a reader
  // is on is held in a hook and a hook reached on one render and skipped on the next loses its own state.
  // Each leg keeps the place it holds among its own move's legs, which is what says the reason once.
  // Paged by move rather than by leg. A move is one act — its legs and the reason written against it are
  // read together — and paging the legs split a move across two pages, leaving the second page's legs
  // under no reason at all.
  const paged = usePagedRows(moves);
  if (pending) {
    return <p className="py-8 text-sm text-ink-muted">Reading what has moved…</p>;
  }
  if (moves.length === 0) {
    return (
      <p className="py-8 text-sm text-ink-muted">
        Nothing has moved under this request yet. {client}'s portfolio is the desk's to balance until they
        record it as put back.
      </p>
    );
  }
  return (
    <section>
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
        What has moved under this request
      </h2>
      <p className="mt-1 text-xs text-ink-muted">Newest first.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Each movement: where it came out of, where it went, and how much.</caption>
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4">Out of</th>
              <th scope="col" className="px-4 py-3">Into</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">Moved</th>
              <th scope="col" className="py-3 pl-4 whitespace-nowrap">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paged.shown.flatMap((move) => move.legs.map((leg, at) => (
              <tr key={`${move.id}-${at}`} className="align-top">
                <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                  {named(leg.fromSubClass, leg.fromAssetClass, leg.fromSubSubClass)}
                  {/* Said once, on the first leg: it is the reason for the move, not for each of its
                      parts, and repeated down five rows it reads as five reasons. */}
                  {at === 0 && move.why && (
                    <span className="mt-0.5 block text-xs font-normal text-ink-muted">{move.why}</span>
                  )}
                </th>
                <td className="px-4 py-3 text-ink">
                  {named(leg.toSubClass, leg.toAssetClass, leg.toSubSubClass)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {move.currency} {figure(leg.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {formatDateTime(move.raisedAt)}
                </td>
                <td className="py-3 pl-4 whitespace-nowrap text-ink-muted">{move.raisedByName}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {/* Outside the box the table scrolls in, so the pager stays where it is put while the columns slide.
          Counted in moves, which is what a page holds: a move with three legs draws three rows, and
          counting those rows would promise ten moves a page and show three. */}
      <PagedFooter paged={paged} noun={["move", "moves"]} />
    </section>
  );
}
