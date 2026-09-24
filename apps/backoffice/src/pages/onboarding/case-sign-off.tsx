import { ApiError } from "@atomprive/api-client";
import {
  getGetOnboardingCaseQueryKey,
  getListOnboardingCasesQueryKey,
  useDecideCaseSignOff,
  useSendCaseForSignOff,
  type CaseDetail,
  type SentForSignOff,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";

const signOffLabels: Record<CaseDetail["summary"]["signOff"], string> = {
  NOT_SUBMITTED: "KYC not sent",
  AWAITING: "With Compliance",
  APPROVED: "KYC signed off",
  RETURNED: "Sent back",
};

const signOffTones: Record<CaseDetail["summary"]["signOff"], "neutral" | "warning" | "success" | "danger"> = {
  NOT_SUBMITTED: "neutral",
  AWAITING: "warning",
  APPROVED: "success",
  RETURNED: "danger",
};

/**
 * KYC sign-off, which is Compliance's alone: Operations send the case over, Compliance sign it off or send it
 * back with what needs putting right.
 */
export function CaseSignOff({
  detail,
  canChange,
  onSent,
}: {
  detail: CaseDetail;
  canChange: boolean;
  /** Told what came of writing to Compliance, so the page can say it where there is room to. */
  onSent: (result: SentForSignOff) => void;
}) {
  const user = useStaffUser();
  const decides = hasAuthority(user, "APPROVE_ONBOARDING:CHANGE");
  const queryClient = useQueryClient();
  const [sendingBack, setSendingBack] = useState(false);
  const [comment, setComment] = useState("");

  const send = useSendCaseForSignOff<ApiError>();
  const decide = useDecideCaseSignOff<ApiError>();
  const busy = send.isPending || decide.isPending;
  const { signOff } = detail.summary;

  function kept(updated: CaseDetail) {
    queryClient.setQueryData(getGetOnboardingCaseQueryKey(updated.summary.id), updated);
    void queryClient.invalidateQueries({ queryKey: getListOnboardingCasesQueryKey() });
  }

  function sent(result: SentForSignOff) {
    kept(result.sentCase);
    onSent(result);
  }

  const canSend = canChange && detail.summary.submitted && (signOff === "NOT_SUBMITTED" || signOff === "RETURNED");

  return (
    <>
      <Badge tone={signOffTones[signOff]}>{signOffLabels[signOff]}</Badge>
      {canSend && (
        <Button size="sm" disabled={busy} onClick={() => send.mutate({ id: detail.summary.id }, { onSuccess: sent })}>
          <ShieldCheck aria-hidden="true" />
          {send.isPending ? "Sending…" : "Submit for KYC sign-off"}
        </Button>
      )}
      {decides && signOff === "AWAITING" && (
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setSendingBack(true)}>
            Send back
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => decide.mutate({ id: detail.summary.id, data: { approved: true, comment: null } }, { onSuccess: kept })}
          >
            <ShieldCheck aria-hidden="true" />
            {decide.isPending ? "Signing off…" : "Sign off KYC"}
          </Button>
        </>
      )}

      <Dialog open={sendingBack} title="Send this case back?" onClose={() => setSendingBack(false)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Operations will see what you write here and put it right.</p>
          {decide.isError && <Alert tone="danger">{decide.error.message}</Alert>}
          <Field id="send-back-comment" label="What needs putting right?" required>
            <TextArea id="send-back-comment" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendingBack(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!comment.trim() || busy}
              onClick={() =>
                decide.mutate(
                  { id: detail.summary.id, data: { approved: false, comment } },
                  {
                    onSuccess: (updated) => {
                      kept(updated);
                      setSendingBack(false);
                      setComment("");
                    },
                  },
                )
              }
            >
              Send it back
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** The message at the top of a case about where its KYC sign-off has got to. */
export function SignOffNotice({ detail, told }: { detail: CaseDetail; told?: SentForSignOff }) {
  const { signOff, signOffComment } = detail.summary;
  if (signOff === "AWAITING") {
    // Whether Compliance were actually written to is only known just after sending, so it is said then.
    if (told?.emailStillADraft) {
      return (
        <Alert tone="warning">
          This case is with Compliance for KYC sign-off, but nobody was emailed: the "Ready for KYC review" email
          is still a draft. Write it under Configuration → Email templates, or tell Compliance yourself.
        </Alert>
      );
    }
    if (told && told.complianceNotified > 0) {
      return (
        <Alert tone="success">
          Sent to Compliance for KYC sign-off. {told.complianceNotified}{" "}
          {told.complianceNotified === 1 ? "person has" : "people have"} been emailed.
        </Alert>
      );
    }
    if (told) {
      return (
        <Alert tone="warning">
          This case is with Compliance for KYC sign-off, but nobody was emailed — check that somebody holds the
          Compliance role.
        </Alert>
      );
    }
    return <Alert tone="info">This case is with Compliance for KYC sign-off.</Alert>;
  }
  if (signOff === "RETURNED") {
    return <Alert tone="warning">Compliance sent this back: {signOffComment}</Alert>;
  }
  if (signOff === "APPROVED") {
    return <Alert tone="success">Compliance has signed off the KYC for this case.</Alert>;
  }
  return null;
}
