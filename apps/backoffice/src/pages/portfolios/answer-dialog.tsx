import { Alert, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import type { ReactNode } from "react";

/**
 * The window an answer is given in, either way.
 *
 * <p>Rejecting has always opened one, because somebody is being told no and owes them a reason — the
 * server refuses a rejection without one. Approving went straight through on the press, sending nothing,
 * so the column that reports what the answerer said could only ever hold a dash against an approval. A
 * queue of approvals read as a column that had stopped working.
 *
 * <p>So approving opens the same window, with the reason asked for and not demanded. The two halves of
 * one decision are given in one place and read the same way; what differs is which of them owes an
 * explanation. Demanding one on an approval would have put a box in front of the commonest act in the
 * app, and a box that must be filled gets filled with "ok" — which is worse than the dash, because it
 * looks like somebody said something.
 *
 * <p>Drawn once for all four queues. They had four copies of this window already, alike to the comma and
 * drifting apart a line at a time: one carried the figures it was refusing, one showed the error and the
 * others swallowed it, and they named their note field three different things.
 */
export function AnswerDialog({
  open, approved, title, consequence, shownTo, note, onNote, busy, error, onClose, onConfirm,
  confirm, confirming, children,
}: {
  open: boolean;
  /** Which answer is being given. It decides the wording, and whether the reason is owed. */
  approved: boolean;
  title: string;
  /** What saying this does, in the queue's own words — nothing moves, or they stay where they are. */
  consequence: string;
  /** Whoever asked, who is shown whatever is written here. */
  shownTo: string | undefined;
  note: string;
  onNote: (note: string) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  /** What the button says, which is the act and not the verdict: "Approve and move it", "Reject". */
  confirm: string;
  /** And what it says while it is doing it. */
  confirming: string;
  /** What is being answered, where the queue has figures worth putting in front of the reader. */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        {/* The figures the answer is about, so whoever writes the reason can see what they are
            answering rather than remembering it. */}
        {children}
        <p className="text-sm text-ink-muted">
          {consequence} {shownTo ? `What you write here is shown to ${shownTo}.` : ""}
        </p>
        {/* Asked for on an approval, owed on a rejection. The question changes with it: "Why not?"
            against an approval reads as an accusation. */}
        <Field
          id="answer-note"
          label={approved ? "Anything to add?" : "Why not?"}
          hint={approved ? "Optional." : undefined}
          required={!approved}
        >
          <TextArea id="answer-note" rows={3} value={note} onChange={(event) => onNote(event.target.value)} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || (!approved && note.trim() === "")} onClick={onConfirm}>
            {busy ? confirming : confirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
