import { ApiError } from "@atomprive/api-client";
import {
  getReadClearanceQueryKey,
  useChangeClearanceDeadline,
  useStartClearance,
  type RequestClearances,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Field, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

function daysFromToday(days: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
}

/**
 * Operations sending the question out, and moving the date afterwards.
 *
 * <p>One date for the whole request rather than one per desk. The desks are looking at different work
 * and none of them is waiting on another, so a date each would be four dates to chase instead of one.
 */
export function StartClearancePanel({
  customerId,
  standing,
}: {
  customerId: string;
  standing: RequestClearances;
}) {
  const queryClient = useQueryClient();
  const start = useStartClearance<ApiError>();
  const move = useChangeClearanceDeadline<ApiError>();

  const [deadline, setDeadline] = useState(standing.deadline ?? "");
  const [instructions, setInstructions] = useState("");
  const [why, setWhy] = useState("");
  const [problem, setProblem] = useState<string>();

  const out = standing.startedAt !== null;

  function send(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    if (!deadline) {
      setProblem("Set the date it is all wanted by.");
      return;
    }
    const after = {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getReadClearanceQueryKey(customerId) });
        setWhy("");
      },
      onError: (caught: ApiError) => setProblem(caught.message),
    };
    if (out) {
      // Moving a date already out is a change somebody has to answer for, so the reason is asked for
      // here rather than only refused by the server.
      if (why.trim() === "") {
        setProblem("Say why the date is moving.");
        return;
      }
      move.mutate({ customerId, data: { deadline, why: why.trim() } }, after);
    }
    else {
      start.mutate(
        { customerId, data: { deadline, instructions: instructions.trim() || null } },
        after,
      );
    }
  }

  const sending = start.isPending || move.isPending;

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-base font-bold">{out ? "Move the deadline" : "Send the question to the desks"}</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        {out
          ? "Every move is kept with its reason, and the desks are shown the new date."
          : "One date for every desk. They are asked all at once rather than in turn."}
      </p>

      <form onSubmit={send} className="mt-4 space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}

        <Field id="clearance-deadline" label="Wanted by" required>
          <DateInput
            id="clearance-deadline"
            name="deadline"
            value={deadline}
            min={daysFromToday(0)}
            max={daysFromToday(365)}
            onChange={setDeadline}
          />
        </Field>

        {out ? (
          <Field id="deadline-why" label="Why it is moving" required>
            <TextArea
              id="deadline-why"
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Compliance asked for another fortnight."
            />
          </Field>
        ) : (
          <Field
            id="clearance-instructions"
            label="Anything to tell the desks"
            hint="Optional. Shown to every desk beside the question."
          >
            <TextArea
              id="clearance-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Please clear anything of yours on this client by the date above."
            />
          </Field>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : out ? "Move the deadline" : "Send clearance request"}
          </Button>
        </div>
      </form>
    </section>
  );
}
