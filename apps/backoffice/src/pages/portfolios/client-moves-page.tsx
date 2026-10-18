import { ApiError } from "@atomprive/api-client";
import {
  useAnswerTheMovePlan,
  useGetCustomer,
  useListClientMovePlans,
  type CustomerDetail,
  type MovePlanRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { DealtWithPlan, WaitingPlan } from "./moves-to-approve-page";

/**
 * One client's money moves, on a screen of their own.
 *
 * <p>Grouped under a client in the queue they used to open under the name, which pushed every other client
 * down the page and left what was being read in a drawer rather than on a screen. A client's moves are a
 * subject in themselves — what has been asked for them, what came of it, and what is waiting now — and that
 * is a page, not a panel.
 */
export function ClientMovesPage() {
  const { customerId = "" } = useParams();
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const plans = useListClientMovePlans<MovePlanRow[], ApiError>(customerId, {
    query: { refetchOnWindowFocus: true },
  });
  const [turningDown, setTurningDown] = useState<MovePlanRow | null>(null);
  const [note, setNote] = useState("");
  const [refused, setRefused] = useState<Record<string, string>>({});
  const answer = useAnswerTheMovePlan<ApiError>({
    mutation: {
      onSuccess: () => {
        setTurningDown(null);
        setNote("");
        void plans.refetch();
      },
      onError: (error, variables) => {
        setRefused((was) => ({ ...was, [variables.id]: error.message }));
        void plans.refetch();
      },
    },
  });

  if (plans.isError) {
    return <Alert tone="danger">{plans.error.message}</Alert>;
  }

  const every = plans.data ?? [];
  const waiting = every.filter((one) => one.status === "PENDING");
  const decided = every.filter((one) => one.status !== "PENDING");
  const named = client.data?.client.fullName ?? "";

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/moves-to-approve"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to moves to approve
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={named} />
            <div className="min-w-0">
              <h1 className="text-[1.625rem] font-bold">{named}</h1>
              <p className="font-mono text-xs text-ink-muted">{client.data?.client.code}</p>
            </div>
          </div>
          <Link
            to={`/portfolio-clients/${customerId}?from=moves`}
            className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            Open their portfolio
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Every plan to move money between what this client holds. Nothing has moved: saying yes is what
          moves it.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Waiting for approval
        </h2>
        {plans.isPending ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Reading the plans…</p>
        ) : waiting.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Nothing is waiting for this client.</p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <WaitingPlan
                  row={row}
                  showClient={false}
                  answering={answer.isPending}
                  refusal={refused[row.id]}
                  onApprove={() => answer.mutate({ id: row.id, data: { approved: true, note: null } })}
                  onTurnDown={() => {
                    setTurningDown(row);
                    setNote("");
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {/* Not "answered": one the person who raised it cancelled was never answered by anybody. */}
          <h2 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Everything else asked for this client
          </h2>
          <ul className="divide-y divide-line">
            {decided.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <DealtWithPlan row={row} showClient={false} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The note is collected against what it refuses, so somebody writing it can see what they are
          rejecting rather than remembering it. */}
      <Dialog
        open={turningDown !== null}
        title={turningDown ? `Reject the move for ${turningDown.clientName}?` : "Reject it"}
        onClose={() => setTurningDown(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Nothing moves. What you write here is shown to {turningDown?.raisedByName}.
          </p>
          <Field id="reject-move-note" label="Why not?" required>
            <TextArea
              id="reject-move-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTurningDown(null)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim() === "" || answer.isPending}
              onClick={() =>
                turningDown && answer.mutate({ id: turningDown.id, data: { approved: false, note: note.trim() } })
              }
            >
              {answer.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
