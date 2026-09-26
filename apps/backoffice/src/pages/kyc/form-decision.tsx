import { ApiError } from "@atomprive/api-client";
import {
  getListCaseFormsQueryKey,
  getListClientChecklistQueryKey,
  getListFormsAwaitingComplianceQueryKey,
  useDecideOnForm,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, TextArea, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";

/**
 * Approving a form, or sending it back with what is wrong with it, in a dialog. Shown from the queue, from
 * the client's case, and from the form itself, so the decision is taken in the same words wherever it is read.
 */
export function FormDecisionDialog({
  deciding,
  onClose,
  onDecided,
}: {
  /** The form being decided on and which way, or null when nothing is. */
  deciding: FormToDecide | null;
  onClose: () => void;
  onDecided: () => void;
}) {
  return (
    <Dialog
      open={deciding !== null}
      title={deciding?.approved ? "Approve this form" : "Send this form back to Operations"}
      description={deciding ? `${deciding.title} · ${deciding.clientName}` : null}
      onClose={onClose}
    >
      {deciding && <DecisionForm deciding={deciding} onCancel={onClose} onDecided={onDecided} />}
    </Dialog>
  );
}

/** Tomorrow, which is the earliest a date still to come can be. */
function tomorrow() {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return day;
}

function yearsFromToday(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() + years, day.getMonth(), day.getDate());
}

/** A form waiting on Compliance, and which way it is about to go. */
export interface FormToDecide {
  formId: string;
  title: string;
  clientName: string;
  approved: boolean;
  /** Whose file to read again once it is decided; both are only known where the screen knows them. */
  customerId?: string;
  caseId?: string | null;
}

function DecisionForm({
  deciding,
  onCancel,
  onDecided,
}: {
  deciding: FormToDecide;
  onCancel: () => void;
  onDecided: () => void;
}) {
  const { formId, approved } = deciding;
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const decide = useDecideOnForm<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListFormsAwaitingComplianceQueryKey() });
        if (deciding.customerId) {
          void queryClient.invalidateQueries({
            queryKey: getListClientChecklistQueryKey(deciding.customerId),
          });
        }
        if (deciding.caseId) {
          void queryClient.invalidateQueries({ queryKey: getListCaseFormsQueryKey(deciding.caseId) });
        }
        onDecided();
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    decide.mutate({ id: formId, data: { approved, comment: comment.trim() || null, dueOn: dueOn || null } });
  }

  const error = errors.fields.comment;
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <p className="text-sm leading-relaxed text-ink">
        {approved
          ? "Approving it sends the form to the client. They sign it, or read it over where Operations have already signed on their behalf; either way their signed copy is what finishes it."
          : "The form goes back to Operations to be put right and sent for review again. What you write is what they see."}
      </p>

      {/* The form leaves you either way, so either way it is wanted back by a day: from the client once
          they have signed, or from Operations once they have put it right. A day already gone cannot be
          that day, so the earliest is tomorrow. */}
      <Field
        id="decision-due-on"
        label={approved ? "Signed copy wanted back by" : "Corrected form wanted back by"}
        required
        error={errors.fields.dueOn}
      >
        <DateInput
          id="decision-due-on"
          name="dueOn"
          value={dueOn}
          min={tomorrow()}
          max={yearsFromToday(2)}
          onChange={setDueOn}
          required
        />
      </Field>

      <Field
        id="compliance-comment"
        label={approved ? "Anything to note (optional)" : "What is wrong with it"}
        required={!approved}
        error={error}
      >
        <TextArea
          {...describedBy("compliance-comment", error)}
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          required={!approved}
        />
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={decide.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={decide.isPending || dueOn === "" || (!approved && comment.trim() === "")}>
          {decide.isPending ? "Saving…" : approved ? "Approve" : "Send back"}
        </Button>
      </div>
    </form>
  );
}
