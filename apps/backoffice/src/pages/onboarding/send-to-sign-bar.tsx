import { ApiError } from "@atomprive/api-client";
import {
  getListCaseFormsQueryKey,
  useSendFormsForSignature,
  type CaseFormRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { readyToSend } from "./ready-to-send";

function today() {
  return new Date();
}

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/**
 * Sending a client's forms out to be signed — one, or several together as one pack. They go to the client and
 * to the advisor who looks after them; the advisor signs their half in the portal.
 */
export function SendToSignBar({
  caseId,
  chosen,
  forms,
  onSent,
}: {
  caseId: string;
  chosen: CaseFormRow[];
  forms: CaseFormRow[];
  onSent: () => void;
}) {
  const queryClient = useQueryClient();
  const send = useSendFormsForSignature<ApiError>();
  const [asking, setAsking] = useState(false);
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const ready = forms.filter(readyToSend).length;

  function submit() {
    send.mutate(
      {
        data: {
          formIds: chosen.map((form) => form.formId).filter((id): id is string => id !== null),
          dueOn,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCaseFormsQueryKey(caseId) });
          setAsking(false);
          setNote("");
          setDueOn(null);
          onSent();
        },
      },
    );
  }

  if (ready === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-6 py-4">
        <p className="text-sm text-ink-muted">
          {chosen.length === 0
            ? `${ready} ${ready === 1 ? "form is" : "forms are"} ready to send for signing.`
            : `${chosen.length} ${chosen.length === 1 ? "form" : "forms"} chosen.`}
        </p>
        <Button size="sm" disabled={chosen.length === 0} onClick={() => setAsking(true)}>
          Send to sign
        </Button>
      </div>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={chosen.length === 1 ? "Send this form to be signed" : `Send ${chosen.length} forms to be signed`}
      >
        <div className="space-y-4">
          {send.isError && <Alert tone="danger">{send.error.message}</Alert>}

          <ul className="space-y-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm">
            {chosen.map((form) => (
              <li key={form.kind} className="text-ink">
                {form.title}
              </li>
            ))}
          </ul>

          <Field id="due-on" label="When it is needed back">
            <DateInput
              id="due-on"
              name="dueOn"
              value={dueOn ?? ""}
              min={today()}
              max={yearsFromToday(1)}
              onChange={setDueOn}
            />
          </Field>

          <Field id="note" label="Anything to say about it">
            <TextArea
              id="note"
              rows={3}
              value={note}
              maxLength={1000}
              placeholder="Optional"
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <p className="text-xs text-ink-muted">
            They go to the client and to the advisor who looks after them. The advisor signs their half here.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={send.isPending}>
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
