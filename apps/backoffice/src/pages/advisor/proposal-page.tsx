import { ApiError } from "@atomprive/api-client";
import {
  useCreateProposal,
  useGetProposal,
  useListMyClients,
  useResendProposal,
  useSubmitProposal,
  useUpdateProposal,
  type CustomerPage,
  type ProposalDetail,
  type ProposalRowStatus,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, describedBy, Field, SelectInput, TextInput } from "@atomprive/ui";
import { ChevronLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate, formatDateTime } from "../../lib/labels";
import { expiryLabel, formatValue, proposalStatusLabels, proposalStatusTones } from "./proposal-labels";

/**
 * Writing a proposal, and reading one back (#86, #87, #88, #93). A draft can be edited and sent; once it has gone it
 * is read-only, and an expired one is copied as a fresh draft.
 */
export function ProposalPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const writing = proposalId === undefined;
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [notice, setNotice] = useState<string>();

  const detail = useGetProposal<ProposalDetail, ApiError>(proposalId ?? "", { query: { enabled: !writing } });
  // Proposals can only be written for clients assigned to you, so the picker offers exactly those.
  const clients = useListMyClients<CustomerPage, ApiError>({ size: 100 });

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useCreateProposal<ApiError>({
    mutation: { onSuccess: (saved) => navigate(`/proposals/${saved.summary.id}`, { replace: true }), onError },
  });
  const update = useUpdateProposal<ApiError>({
    mutation: { onSuccess: () => setNotice("Saved."), onError },
  });
  const submit = useSubmitProposal<ApiError>({
    mutation: {
      onSuccess: (saved) =>
        setNotice(
          saved.summary.status === "PENDING_MANAGER_REVIEW"
            ? "Sent to your manager for sign-off."
            : "Sent to the client.",
        ),
      onError,
    },
  });
  const resend = useResendProposal<ApiError>({
    mutation: { onSuccess: (copy) => navigate(`/proposals/${copy.summary.id}`), onError },
  });

  if (!writing && !detail.data) {
    return detail.isError ? (
      <Alert tone="danger">{detail.error.status === 404 ? "This proposal doesn't exist." : detail.error.message}</Alert>
    ) : (
      <p className="text-sm text-ink-muted">Loading the proposal…</p>
    );
  }

  const proposal = detail.data;
  const status = (proposal?.summary.status ?? "DRAFT") as ProposalRowStatus;
  const editable = writing || status === "DRAFT";
  const busy = create.isPending || update.isPending || submit.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = String(form.get("valueAmount")).trim();
    const data = {
      customerId: String(form.get("customerId")),
      title: String(form.get("title")),
      summary: String(form.get("summary")).trim() || null,
      body: String(form.get("body")),
      valueAmount: amount ? Number(amount) : null,
      valueCurrency: String(form.get("valueCurrency")).trim() || null,
      affectedAccounts: String(form.get("affectedAccounts")).trim() || null,
    };
    setErrors(noErrors);
    setNotice(undefined);
    if (writing) create.mutate({ data });
    else update.mutate({ id: proposalId!, data });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link to="/proposals" className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Proposals
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.625rem] leading-tight font-bold">
              {writing ? "New proposal" : proposal!.summary.title}
            </h1>
            {!writing && (
              <p className="mt-0.5 text-sm text-ink-muted">
                {proposal!.summary.reference} · {proposal!.summary.customerName} ({proposal!.summary.customerCode})
              </p>
            )}
          </div>
          {!writing && <Badge tone={proposalStatusTones[status]}>{proposalStatusLabels[status]}</Badge>}
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {proposal?.summary.managerComment && (
        <Alert tone="warning">
          <span className="font-semibold">Your manager sent this back:</span> {proposal.summary.managerComment}
        </Alert>
      )}

      {status === "EXPIRED" && (
        <Alert tone="danger">
          This proposal ran out before the client answered, so it can't be approved. Send it again as a new one.
        </Alert>
      )}

      {proposal?.clientComment && (
        <Alert tone={status === "APPROVED" ? "success" : "danger"}>
          <span className="font-semibold">The client {status === "APPROVED" ? "approved" : "rejected"} this:</span>{" "}
          {proposal.clientComment}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-line bg-white p-6">
        <Field id="customerId" label="Client" error={errors.fields.customerId}>
          <SelectInput
            {...describedBy("customerId", errors.fields.customerId)}
            name="customerId"
            defaultValue={proposal?.summary.customerId ?? ""}
            disabled={!editable}
            required
            className="w-auto"
          >
            <option value="" disabled>
              Choose a client
            </option>
            {(clients.data?.items ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName} · {client.code}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field id="title" label="Title" error={errors.fields.title}>
          <TextInput
            {...describedBy("title", errors.fields.title)}
            name="title"
            defaultValue={proposal?.summary.title ?? ""}
            placeholder="Rebalance — equities"
            disabled={!editable}
            required
          />
        </Field>

        <Field id="summary" label="One-line summary" error={errors.fields.summary} hint="Shown under the title in the list.">
          <TextInput
            {...describedBy("summary", errors.fields.summary)}
            name="summary"
            defaultValue={proposal?.summary.summary ?? ""}
            placeholder="Reduce single-name concentration"
            disabled={!editable}
          />
        </Field>

        <Field id="body" label="The changes you're proposing" error={errors.fields.body}>
          <textarea
            {...describedBy("body", errors.fields.body)}
            name="body"
            defaultValue={proposal?.body ?? ""}
            rows={10}
            disabled={!editable}
            required
            className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm leading-6 text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none disabled:text-ink-soft aria-invalid:border-red-500"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="valueAmount" label="Value" error={errors.fields.valueAmount} hint="What the change is worth, if it has a figure.">
            <TextInput
              {...describedBy("valueAmount", errors.fields.valueAmount)}
              name="valueAmount"
              type="number"
              step="0.01"
              defaultValue={proposal?.summary.valueAmount ?? ""}
              disabled={!editable}
            />
          </Field>
          <Field id="valueCurrency" label="Currency" error={errors.fields.valueCurrency}>
            <TextInput
              {...describedBy("valueCurrency", errors.fields.valueCurrency)}
              name="valueCurrency"
              defaultValue={proposal?.summary.valueCurrency ?? "USD"}
              maxLength={3}
              disabled={!editable}
              className="w-28 uppercase"
            />
          </Field>
        </div>

        <Field
          id="affectedAccounts"
          label="Accounts this touches"
          error={errors.fields.affectedAccounts}
          hint="One per line. A proper checklist arrives with the bank accounts."
        >
          <textarea
            {...describedBy("affectedAccounts", errors.fields.affectedAccounts)}
            name="affectedAccounts"
            defaultValue={proposal?.affectedAccounts ?? ""}
            rows={3}
            disabled={!editable}
            placeholder={"Custody ••4410\nManaged ••2290"}
            className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none disabled:text-ink-soft"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">
            {writing
              ? "Saved as a draft first. Nothing reaches the client until you send it."
              : proposal!.summary.sentAt
                ? `Sent ${formatDate(proposal!.summary.sentAt)} · ${expiryLabel(proposal!.summary.expiresAt, status)}`
                : `Draft, last saved ${formatDateTime(proposal!.summary.createdAt)}`}
          </p>
          <div className="flex flex-wrap gap-3">
            {status === "EXPIRED" && (
              <Button variant="secondary" disabled={resend.isPending} onClick={() => resend.mutate({ id: proposalId! })}>
                {resend.isPending ? "Copying…" : "Send again as new"}
              </Button>
            )}
            {editable && (
              <Button type="submit" variant="secondary" disabled={busy}>
                {busy ? "Saving…" : writing ? "Save draft" : "Save"}
              </Button>
            )}
            {!writing && editable && (
              <Button disabled={busy} onClick={() => submit.mutate({ id: proposalId! })}>
                {submit.isPending ? "Sending…" : "Send"}
              </Button>
            )}
          </div>
        </div>
      </form>

      {!writing && proposal!.summary.valueAmount !== null && (
        <p className="text-xs text-ink-muted">
          Value {formatValue(proposal!.summary.valueAmount, proposal!.summary.valueCurrency)} · advisory only, the
          platform never places a trade.
        </p>
      )}
    </div>
  );
}
