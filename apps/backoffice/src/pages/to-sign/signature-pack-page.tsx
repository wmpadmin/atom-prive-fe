import type { ApiError } from "@atomprive/api-client";
import { useGetPack, type PackFormRow, type SignaturePackDetail } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Card, cn } from "@atomprive/ui";
import { ArrowLeft, Check, FileText } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { SignFormDialog } from "./sign-form-dialog";
import { packTones } from "./to-sign-labels";

/**
 * One pack of forms sent out to be signed, and the advisor's half of the signing. Every form is read and
 * signed on its own, because each of them is its own document.
 */
export function SignaturePackPage() {
  const { packId = "" } = useParams();
  const pack = useGetPack<SignaturePackDetail, ApiError>(packId);
  const [signing, setSigning] = useState<PackFormRow | null>(null);

  if (pack.isError) {
    return (
      <div className="space-y-4">
        <BackToList />
        <Alert tone="danger">{pack.error.message}</Alert>
      </div>
    );
  }
  if (!pack.data) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  const { summary, forms } = pack.data;
  const left = forms.filter((form) => !form.signedByMe).length;

  return (
    <div className="space-y-6">
      <BackToList />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">{summary.clientName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {summary.reference} · {summary.clientCode} · sent by {summary.sentByName} on{" "}
            {formatDate(summary.sentAt)}
            {summary.dueOn ? ` · due ${formatDate(summary.dueOn)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary.overdue && <Badge tone="danger">Overdue</Badge>}
          <Badge tone={packTones[summary.status]}>{summary.statusLabel}</Badge>
        </div>
      </header>

      {summary.note && (
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">From Operations</p>
          <p className="mt-1 text-sm text-ink">{summary.note}</p>
        </Card>
      )}

      {summary.status === "OUT" && left > 0 && (
        <Alert tone="info">
          {left === 1 ? "One form still needs your signature." : `${left} forms still need your signature.`}
        </Alert>
      )}
      {left === 0 && summary.status !== "WITHDRAWN" && (
        <Alert tone="success">
          You have signed every form in this pack. The client's own signature is still to come.
        </Alert>
      )}

      <ul className="space-y-2">
        {forms.map((form) => (
          <li
            key={form.formId}
            className={cn(
              "flex flex-wrap items-center gap-4 rounded-2xl border bg-white px-5 py-4",
              form.signedByMe ? "border-line" : "border-primary-100",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-muted">
              {form.signedByMe ? (
                <Check aria-hidden="true" className="size-4 text-emerald-700" />
              ) : (
                <FileText aria-hidden="true" className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{form.formTitle}</span>
              <span className="block text-xs text-ink-muted">
                {form.reference}
                {form.signatures.map((made) => (
                  <span key={made.signedAs}>
                    {" · "}
                    {made.signedAsLabel} signed by {made.signerName} on {formatDateTime(made.signedAt)}
                  </span>
                ))}
              </span>
            </span>

            {form.awaiting.length > 0 && (
              <span className="text-xs text-ink-muted">Awaiting: {form.awaiting.join(", ")}</span>
            )}

            <Link
              to={`/forms/${form.formId}`}
              className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink shadow-xs"
            >
              Read it
            </Link>
            {form.signedByMe ? (
              <Badge tone="success">Signed</Badge>
            ) : (
              <Button size="sm" onClick={() => setSigning(form)} disabled={summary.status !== "OUT"}>
                Sign
              </Button>
            )}
          </li>
        ))}
      </ul>

      <SignFormDialog packId={packId} form={signing} open={signing !== null} onClose={() => setSigning(null)} />
    </div>
  );
}

function BackToList() {
  return (
    <Link to="/to-sign" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
      <ArrowLeft aria-hidden="true" className="size-4" />
      To sign
    </Link>
  );
}
