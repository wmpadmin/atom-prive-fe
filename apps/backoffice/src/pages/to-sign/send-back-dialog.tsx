import { ApiError } from "@atomprive/api-client";
import {
  getGetPackQueryKey,
  getListPacksToSignQueryKey,
  useSendFormBack,
  type PackFormRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Sending a form back instead of signing it. It goes to whoever filled it in — Operations or an advisor —
 * with what has to be put right, and leaves the pack, so what is left there is what still waits on a
 * signature.
 *
 * <p>The reason is required. A form that comes back with nothing said about it is a form that moved, and
 * whoever wrote it would have to guess what was wrong with it.
 *
 * <p>Who it goes to can be named. The default is whoever wrote it up, which is right until two people have
 * worked on a form; after that a correction belongs with whoever can make it.
 */
export function SendBackDialog({
  packId,
  form,
  open,
  onClose,
}: {
  packId: string;
  form: PackFormRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const sendBack = useSendFormBack<ApiError>();
  const [reason, setReason] = useState("");
  const [toStaff, setToStaff] = useState("");
  const [refused, setRefused] = useState<string>();

  function close() {
    setReason("");
    setToStaff("");
    setRefused(undefined);
    onClose();
  }

  function send() {
    if (!form) return;
    sendBack.mutate(
      { packId, formId: form.formId, data: { reason: reason.trim(), toStaff: toStaff === "" ? null : toStaff } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetPackQueryKey(packId) });
          void queryClient.invalidateQueries({ queryKey: getListPacksToSignQueryKey() });
          close();
        },
        onError: (error) => setRefused(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onClose={close} title={form ? `Send ${form.formTitle} back` : "Send it back"} size="md">
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          It goes back with what you write here, and the form comes off this pack until it is put right.
          Nothing is signed. For a smaller change, leave a comment on the form instead and it stays with you.
        </p>
        {refused && <Alert tone="danger">{refused}</Alert>}
        <Field id="send-back-reason" label="What has to be put right" required>
          <TextArea
            id="send-back-reason"
            rows={4}
            value={reason}
            maxLength={1000}
            placeholder="The passport copy is the expired one."
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field
          id="send-back-to"
          label="Who it goes to"
          hint="They are told about it. Left as it is, it goes to whoever filled the form in."
        >
          <SelectInput id="send-back-to" value={toStaff} onChange={(event) => setToStaff(event.target.value)}>
            <option value="">Whoever filled it in</option>
            {(form?.peopleToAsk ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.wroteThisForm ? " — filled this in" : ""}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={close} disabled={sendBack.isPending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sendBack.isPending || reason.trim() === ""}>
            {sendBack.isPending ? "Sending it back…" : "Send it back"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
