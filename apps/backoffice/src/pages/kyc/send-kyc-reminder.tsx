import { ApiError } from "@atomprive/api-client";
import { getGetClientKycFileQueryKey, useSendKycReminder, type KycReminder } from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";

/** When a reminder went, as somebody reads it on the file: a time today, a date before that. */
function remindedWhen(at: string) {
  const sent = new Date(at);
  const today = new Date().toDateString() === sent.toDateString();
  return today
    ? `today at ${sent.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : `on ${sent.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

/**
 * Emailing a client the KYC papers they still owe, from their KYC file. The server decides what is owed and
 * whether a reminder may go — at most one a day per client — so this asks once and then shows what was sent.
 */
export function SendKycReminder({ customerId, clientName, last, onSent }: {
  customerId: string;
  clientName: string;
  last: KycReminder | null;
  onSent: (reminder: KycReminder) => void;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const send = useSendKycReminder<ApiError>({
    mutation: {
      onSuccess: (reminder) => {
        onSent(reminder);
        setAsking(false);
        void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(customerId) });
      },
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={() => { send.reset(); setAsking(true); }}>
        <Mail aria-hidden="true" />
        Send KYC reminder
      </Button>
      {last && (
        <p className="text-2xs text-ink-muted">
          Reminded {remindedWhen(last.sentAt)} by {last.sentByName}
        </p>
      )}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title="Send a KYC reminder?"
        description={`${clientName} will get an email listing the KYC papers they still have to send, with a link to upload them in the client portal.`}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Papers already sent and waiting for review are not asked for again. A client can be reminded once a day.
          </p>
          {send.isError && <Alert tone="danger">{send.error.message}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAsking(false)} disabled={send.isPending}>
              Cancel
            </Button>
            <Button onClick={() => send.mutate({ customerId })} disabled={send.isPending}>
              <Mail aria-hidden="true" />
              {send.isPending ? "Sending…" : "Send reminder"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** What a reminder asked for, said after it went. */
export function ReminderSent({ clientName, reminder }: { clientName: string; reminder: KycReminder }) {
  return (
    <Alert tone="success">
      Reminder sent to {clientName}&rsquo;s registered email, asking for: {reminder.papers.join("; ")}.
    </Alert>
  );
}
