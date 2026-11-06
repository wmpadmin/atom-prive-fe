import { ApiError, httpFile } from "@atomprive/api-client";
import {
  getMyProposalQueryKey,
  getMyProposalsQueryKey,
  useAnswerMyProposal,
  useMyProposal,
  type ClientProposalDetail,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog, Field, RequiredMark, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, Clock, Download } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { day, whole } from "./figures";
import { StatusPill } from "./proposals-page";

/**
 * One proposal, as the client reviews it (S90): why it is proposed, what would move leg by leg, how their
 * portfolio would look afterwards, and their answer. Approving moves the money; rejecting changes nothing and
 * needs a reason, which their relationship manager reads.
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

function Proposal({ detail, onAnswer }: { detail: ClientProposalDetail; onAnswer: (how: "approve" | "reject") => void }) {
  const row = detail.summary;
  const currency = row.currency ?? "";
  const managers = detail.relationshipManagers.join(" or ");
  const [problem, setProblem] = useState<string | null>(null);

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

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-balance text-ink">{row.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {row.reference} · from {row.writtenBy} · {day(row.sentAt)}
            </p>
          </div>
          <StatusPill row={row} />
        </div>

        <div className="border-b border-line p-5">
          <h2 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Why</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{detail.body}</p>
          {detail.objective && (
            <p className="mt-3 text-sm text-ink-soft">
              <span className="font-semibold text-ink">Objective: </span>
              {detail.objective}
            </p>
          )}
        </div>

        <div className="px-5 pt-5">
          <h2 className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            {row.status === "APPROVED" ? "What moved" : "What would move"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="px-5 py-2.5">Out of</th>
                <th className="w-8" />
                <th className="px-5 py-2.5">Into</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.legs.map((leg, index) => (
                <tr key={index} className="border-b border-line">
                  <td className="px-5 py-3">
                    <span className="font-semibold text-access-none-ink">Sell </span>
                    {leg.from}
                    <div className="text-xs text-ink-muted">{leg.fromClass}</div>
                  </td>
                  <td className="text-ink-muted">
                    <ArrowRight aria-label="into" className="size-4" />
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-access-full-ink">Buy </span>
                    {leg.to}
                    <div className="text-xs text-ink-muted">{leg.toClass}</div>
                  </td>
                  <td className="px-5 py-3 text-right font-bold whitespace-nowrap tabular-nums">{whole(leg.amount, currency)}</td>
                </tr>
              ))}
              {detail.legs.length > 1 && (
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-right text-ink-muted">
                    In all
                  </td>
                  <td className="px-5 py-3 text-right font-bold whitespace-nowrap tabular-nums">{whole(row.total, currency)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5">
          <h2 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Attached</h2>
          <Button variant="secondary" size="sm" onClick={() => void download()}>
            <Download aria-hidden="true" />
            Proposal {row.reference}.pdf
          </Button>
          {problem && (
            <div className="mt-3">
              <Alert tone="danger">{problem}</Alert>
            </div>
          )}
        </div>
      </section>

      <aside className="overflow-hidden rounded-2xl border border-line bg-white">
        {detail.after.length > 0 && (
          <div className="border-b border-line p-5">
            <h2 className="mb-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Your portfolio after this</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              {detail.after.map((klass) => (
                <div key={klass.assetClass} className="contents">
                  <dt className="text-ink-muted">{klass.name}</dt>
                  <dd className="text-right font-semibold whitespace-nowrap tabular-nums">
                    {Number(klass.before).toFixed(1)}% → {Number(klass.after).toFixed(1)}%
                  </dd>
                </div>
              ))}
              {detail.portfolioValue != null && detail.portfolioCurrency && (
                <div className="contents">
                  <dt className="text-ink-muted">Total value</dt>
                  <dd className="text-right font-semibold whitespace-nowrap tabular-nums">
                    {whole(detail.portfolioValue, detail.portfolioCurrency)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="border-b border-line p-5">
          <h2 className="mb-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Trail</h2>
          <ol className="space-y-2 text-sm">
            {detail.trail.map((entry, index) => (
              <li key={index} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-600" />
                <span className="text-ink-soft">
                  <span className="font-semibold text-ink">{entry.event}</span> · {when(entry.at)}
                </span>
              </li>
            ))}
            {row.status === "PENDING" && (
              <li className="flex gap-2.5 text-ink-muted">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-line" />
                Your answer
              </li>
            )}
          </ol>
        </div>

        {row.status === "PENDING" ? (
          <div className="bg-primary-50 p-5">
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-access-view-soft px-3 py-2 text-sm font-semibold text-access-view-ink">
              <Clock aria-hidden="true" className="size-4 shrink-0" />
              Answer by {day(row.answerBy)}, or it expires
            </p>
            <h2 className="text-sm font-bold text-ink">Your answer</h2>
            <p className="mt-1 mb-4 text-sm text-ink-soft">
              Approving moves the money as shown. Rejecting changes nothing; tell {managers || "your relationship manager"} why so a
              better proposal can follow.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="danger-soft" onClick={() => onAnswer("reject")}>
                Reject
              </Button>
              <Button onClick={() => onAnswer("approve")} className="bg-access-full hover:bg-access-full-ink">
                Approve
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <h2 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Outcome</h2>
            <p className="text-sm text-ink-soft">{outcome(detail)}</p>
            {row.answerNote && <p className="mt-2 rounded-lg bg-sidebar px-3 py-2 text-sm text-ink-soft">“{row.answerNote}”</p>}
          </div>
        )}
      </aside>
    </div>
  );
}

/** How it ended, in a sentence. */
function outcome(detail: ClientProposalDetail) {
  const row = detail.summary;
  const how = { CALL: "by phone", EMAIL: "by email", MEETING: "in a meeting" } as const;
  const by = row.clientInstruction ? ` by ${row.answeredByName} on your instruction, ${how[row.clientInstruction]}` : " by you";
  switch (row.status) {
    case "APPROVED":
      return `Approved${by} on ${day(row.decidedAt)}. The money moved as shown.`;
    case "REJECTED":
      return `Rejected${by} on ${day(row.decidedAt)}. Nothing in your portfolio changed.`;
    case "EXPIRED":
      return `This proposal was not answered by ${day(row.answerBy)}, so it expired. Nothing in your portfolio changed.`;
    default:
      return "";
  }
}

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
        {!approving && <p className="-mt-2 text-xs text-ink-muted">
          <RequiredMark /> Required to reject.
        </p>}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={approving ? "primary" : "danger"}
            className={approving ? "bg-access-full hover:bg-access-full-ink" : undefined}
            disabled={answer.isPending}
            onClick={send}
          >
            {approving ? "Approve and move" : "Reject proposal"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
