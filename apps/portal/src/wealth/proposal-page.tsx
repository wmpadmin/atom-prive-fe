import { ApiError, httpFile } from "@atomprive/api-client";
import {
  getMyProposalQueryKey,
  getMyProposalsQueryKey,
  useAnswerMyProposal,
  useMyProposal,
  type ClientProposalDetail,
} from "@atomprive/api-client/portal";
import { ProposalLegs, ProposalMoves } from "@atomprive/support/proposal-legs";
import { Alert, Button, Dialog, Field, RequiredMark, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { compact, day, whole } from "./figures";
import { StatusPill } from "./proposals-page";

/**
 * One proposal, as the client answers it (S90).
 *
 * <p>Laid out as the relationship manager's own page is, figure for figure: before the client portal the
 * relationship manager answered on the client's behalf, and now the client answers it themselves — so they
 * are shown what the manager was shown. The moves weighed against the portfolio as it stands, the rationale,
 * what has moved under it since, and the whole audit trail. Approving moves the money; rejecting changes
 * nothing and needs a reason.
 */
export function ProposalPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const detail = useMyProposal<ClientProposalDetail, ApiError>(id);
  const [asking, setAsking] = useState<"approve" | "reject" | null>(null);

  return (
    <div className="space-y-5">
      <Link to="/new/proposals" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
        <ChevronLeft aria-hidden="true" className="size-4" />
        All proposals
      </Link>
      {detail.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This proposal can't be found.</p>
      ) : !detail.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          <Proposal detail={detail.data} onAnswer={setAsking} />
          {asking && (
            <AnswerDialog
              detail={detail.data}
              approving={asking === "approve"}
              onClose={() => setAsking(null)}
              onAnswered={(fresh) => {
                queryClient.setQueryData(getMyProposalQueryKey(id), fresh);
                void queryClient.invalidateQueries({ queryKey: getMyProposalsQueryKey() });
                setAsking(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas px-3.5 py-3">
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

const HOW = { CALL: "by phone", EMAIL: "by email", MEETING: "in a meeting" } as const;

function Proposal({ detail, onAnswer }: { detail: ClientProposalDetail; onAnswer: (how: "approve" | "reject") => void }) {
  const row = detail.summary;
  const currency = row.currency ?? null;
  const [shown, setShown] = useState<"request" | "history">("request");
  const [problem, setProblem] = useState<string | null>(null);
  const waiting = row.status === "PENDING";
  // Who recorded the answer: the client in the portal, or their manager writing down what they were told.
  const answeredBy = row.clientInstruction
    ? `${row.answeredByName} on your instruction, ${HOW[row.clientInstruction]}`
    : "you";

  const download = async () => {
    setProblem(null);
    try {
      const blob = await httpFile(`/api/portal/proposals/${row.id}/pdf`);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${row.reference}.pdf`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "The proposal could not be downloaded.");
    }
  };

  const standing = waiting
    ? `Waiting for your answer, until ${day(row.answerBy)}`
    : row.status === "APPROVED"
      ? `Approved ${day(row.decidedAt)}`
      : row.status === "REJECTED"
        ? `Rejected ${day(row.decidedAt)}`
        : `Expired ${day(row.decidedAt)}`;

  return (
    <>
      <div className="-mt-11 flex justify-end">
        <Button variant="secondary" onClick={() => void download()}>
          <Download aria-hidden="true" />
          Download PDF
        </Button>
      </div>
      {problem && <Alert tone="danger">{problem}</Alert>}

      <header className="space-y-4 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.625rem] leading-tight font-bold text-balance">{row.title}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {row.summary && `${row.summary} · `}from {row.writtenBy} · {row.reference}
            </p>
          </div>
          <div className="text-right">
            <StatusPill row={row} />
            <p className="mt-1 text-xs text-ink-muted">{ago(row.decidedAt ?? row.sentAt)}</p>
          </div>
        </div>

        {row.answerNote && (
          <Alert tone={row.status === "APPROVED" ? "success" : "danger"}>
            <span className="font-semibold">
              {row.clientInstruction ? `${row.answeredByName} recorded your answer` : "You said"}:
            </span>{" "}
            {row.answerNote}
          </Alert>
        )}

        {row.status === "APPROVED" && (
          <Alert tone="success">
            <p className="font-semibold">This moved the money.</p>
            <p className="mt-1 text-sm">
              {currency ? whole(row.total, currency) : row.total} — Approved by {answeredBy}
            </p>
          </Alert>
        )}

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Portfolio value">
            {detail.portfolioValue == null ? "Not recorded" : compact(detail.portfolioValue, detail.portfolioCurrency ?? undefined)}
          </Fact>
          <Fact label="Sent">{day(row.sentAt)}</Fact>
          <Fact label="Standing">{standing}</Fact>
          <Fact label="Objective">{detail.objective ?? "Not set"}</Fact>
        </dl>
      </header>

      <section className="space-y-5 rounded-2xl border border-line bg-white p-6">
        <div role="tablist" aria-label="This proposal" className="flex gap-1 border-b border-line">
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
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                shown === option.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {shown === "history" ? (
          <History detail={detail} answeredBy={answeredBy} />
        ) : (
          <>
            <section>
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {row.status === "APPROVED" ? "What moved" : "What would move"}
              </h2>
              <div className="mt-3">
                {detail.weighed.length > 0 ? (
                  <ProposalMoves legs={detail.weighed} currency={currency} />
                ) : (
                  <ProposalLegs
                    legs={detail.legs.map((leg) => ({
                      fromAssetClass: leg.fromClass,
                      fromSubClass: leg.from,
                      toAssetClass: leg.toClass,
                      fromSubSubClass: null,
                      toSubClass: leg.to,
                      toSubSubClass: null,
                      amount: leg.amount,
                      heldWhenRaised: null,
                    }))}
                    currency={currency}
                  />
                )}
              </div>
            </section>

            <section>
              <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Rationale</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink">{detail.body}</p>
            </section>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">
            Sent {day(row.sentAt)} ·{" "}
            {waiting
              ? `Answer by ${day(row.answerBy)}, or it expires`
              : row.status === "EXPIRED"
                ? `Not answered by ${day(row.answerBy)}, so it expired`
                : `${row.status === "APPROVED" ? "Approved" : "Rejected"} by ${answeredBy} on ${day(row.decidedAt)}`}
          </p>
          {waiting && (
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => onAnswer("reject")}>
                Reject
              </Button>
              <Button onClick={() => onAnswer("approve")}>Approve</Button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="trail-title" className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-6 py-5">
          <h2 id="trail-title" className="text-sm font-semibold">
            Audit trail
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Immutable record. A sent proposal is never altered — a change is issued as a new one.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-6 py-3">Timestamp</th>
                <th scope="col" className="px-6 py-3">Actor</th>
                <th scope="col" className="px-6 py-3">Event</th>
                <th scope="col" className="px-6 py-3">Ref</th>
              </tr>
            </thead>
            <tbody>
              {detail.trail.map((entry, index) => (
                <tr key={index} className="border-b border-line last:border-b-0">
                  <td className="px-6 py-3 whitespace-nowrap tabular-nums">{when(entry.at)}</td>
                  <td className="px-6 py-3">{entry.actor}</td>
                  <td className="px-6 py-3">{entry.event}</td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-muted">{entry.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        {currency ? `Value ${whole(row.total, currency)} · ` : ""}approving this moves the money in your portfolio as the firm records
        it. No order is placed with a broker.
      </p>
    </>
  );
}

/** What has moved under this proposal: its moves, once approved, with when and on whose answer. */
function History({ detail, answeredBy }: { detail: ClientProposalDetail; answeredBy: string }) {
  const row = detail.summary;
  if (row.status !== "APPROVED") {
    return <p className="py-8 text-sm text-ink-muted">Nothing has moved under this proposal{row.status === "PENDING" ? " yet" : ""}.</p>;
  }
  return (
    <section>
      <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">What has moved under this proposal</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4">Out of</th>
              <th scope="col" className="px-4 py-3">Into</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">Moved</th>
              <th scope="col" className="py-3 pl-4 whitespace-nowrap">By</th>
            </tr>
          </thead>
          <tbody>
            {detail.legs.map((leg, index) => (
              <tr key={index} className="border-b border-line last:border-b-0">
                <td className="py-3 pr-4">{leg.from}</td>
                <td className="px-4 py-3">{leg.to}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {row.currency ? whole(leg.amount, row.currency) : leg.amount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">{day(row.decidedAt)}</td>
                <td className="py-3 pl-4">{answeredBy === "you" ? "Your approval" : answeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** How long ago, as the staff page says it: Just now, 46 min ago, 3 hr ago, Yesterday. */
function ago(at: string | null | undefined) {
  if (!at) return "";
  const minutes = Math.floor((Date.now() - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : day(at);
}

/** Approve asks once more; Reject needs a reason. */
function AnswerDialog({
  detail,
  approving,
  onClose,
  onAnswered,
}: {
  detail: ClientProposalDetail;
  approving: boolean;
  onClose: () => void;
  onAnswered: (fresh: ClientProposalDetail) => void;
}) {
  const row = detail.summary;
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const answer = useAnswerMyProposal<ApiError>({ mutation: { onSuccess: onAnswered } });
  const managers = detail.relationshipManagers.join(" and ") || "Your relationship manager";

  const send = () => {
    if (!approving && note.trim() === "") {
      setMissing(true);
      return;
    }
    answer.mutate({ id: row.id, data: { approved: approving, note: note.trim() === "" ? null : note.trim() } });
  };

  return (
    <Dialog
      open
      title={approving ? "Approve this proposal?" : "Reject this proposal?"}
      description={
        approving
          ? `${row.currency ? whole(row.total, row.currency) : "The amounts shown"} will move across ${row.moves} ${row.moves === 1 ? "holding" : "holdings"}, as shown. ${managers} will be told straight away.`
          : `Nothing in your portfolio will change. ${managers} will see your reason.`
      }
      onClose={onClose}
    >
      <div className="space-y-4 p-6">
        {answer.error && <Alert tone="danger">{answer.error.message}</Alert>}
        <Field
          id="proposal-answer-note"
          label={approving ? "Comment (optional)" : "Reason"}
          required={!approving}
          error={missing ? "Say why you are rejecting it." : undefined}
        >
          <TextArea
            id="proposal-answer-note"
            rows={4}
            maxLength={2000}
            value={note}
            placeholder={approving ? "Anything you'd like your relationship manager to know" : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setMissing(false);
            }}
          />
        </Field>
        {!approving && (
          <p className="-mt-2 text-xs text-ink-muted">
            <RequiredMark /> Required to reject.
          </p>
        )}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={approving ? "primary" : "danger"} disabled={answer.isPending} onClick={send}>
            {approving ? "Approve and move" : "Reject proposal"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
