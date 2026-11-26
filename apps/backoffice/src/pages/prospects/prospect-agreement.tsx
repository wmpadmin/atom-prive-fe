import { ApiError } from "@atomprive/api-client";
import {
  getGetProspectAgreementQueryKey,
  getGetProspectQueryKey,
  getListProspectsQueryKey,
  signProspectAgreementAsAdmin,
  useGetProspectAgreement,
  type AgreementView,
} from "@atomprive/api-client/backoffice";
import { SignaturePad } from "@atomprive/forms/signature-pad";
import { Alert, Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, PenLine } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toFormErrors } from "../../lib/api-errors";
import { formatDateTime } from "../../lib/labels";
import { AgreementSelfCertification, AgreementWord } from "./agreement-word";

/**
 * A prospect's Agreement tab (23 Nov 2026). Once Compliance approve everything, the firm's published agreement filled in
 * with the client's details; the Admin signs here and the prospect becomes a client on All clients. The client's own
 * signature on the portal comes later.
 */
export function ProspectAgreement({ prospectId, entity = false }: { prospectId: string; entity?: boolean }) {
  const agreement = useGetProspectAgreement<AgreementView, ApiError>(prospectId);
  const view = agreement.data;
  if (agreement.isError) return <p className="text-sm text-red-700">The agreement couldn't be loaded.</p>;
  if (!view) return <p className="text-sm text-ink-muted">Loading the agreement…</p>;
  const client = view.stage === "ONBOARDED";
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* The firm's Word agreement and the self-certification (25 Nov 2026, local only) in place of the typed template. */}
      <div className="min-w-0 space-y-5">
        <AgreementWord prospectId={prospectId} entity={entity} signed={Boolean(view.adminSignedAt)} />
        <AgreementSelfCertification prospectId={prospectId} entity={entity} />
      </div>

      <aside aria-label="Signatures" className="space-y-4">
        {!view.templateName && (
          <Alert tone="warning">Signing needs an agreement template in use. The Admin chooses one under Config data, Agreement templates.</Alert>
        )}
        <section className="rounded-2xl border border-line bg-white px-5 py-4">
          <h3 className="text-base font-bold">Signatures</h3>
          <ol className="mt-3 space-y-3 text-sm">
            {view.preview && (
              <Step done={false} label="Compliance"
                said="Approve every document and the wealth accumulation first. Signing opens after that." />
            )}
            <Step done={Boolean(view.adminSignedAt)} label="The Admin, for the firm"
              said={view.adminSignedAt ? `Signed by ${view.adminSignedBy ?? "the Admin"}, ${formatDateTime(view.adminSignedAt)}`
                : view.preview ? "Signs once Compliance approve" : "Ready to sign"} />
            <Step done={Boolean(view.clientSignedAt)} label={entity ? "An authorised signatory" : "The client"}
              said={view.clientSignedAt ? `Signed on the portal, ${formatDateTime(view.clientSignedAt)}`
                // An entity's agreement is final once any one of its authorised signatories signs (23 Nov 2026).
                : entity ? "Any one of the entity's authorised signatories signs on the portal, and that is final. Comes later."
                : "Signs on the portal, which comes later. Not needed for now."} />
          </ol>
        </section>
        {view.mayAdminSign && <AdminSign prospectId={prospectId} />}
        {client && (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            {/* Only the Admin signs for now (24 Nov 2026): "both" is said only once the client has signed too. */}
            {view.clientSignedAt ? "Signed by both" : "Signed by the Admin"}: they are a client now.{" "}
            <Link to="/clients" className="font-semibold underline">Open All clients</Link>
          </p>
        )}
      </aside>
    </div>
  );
}

function Step({ done, label, said }: { done: boolean; label: string; said: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
        done ? "bg-emerald-500 text-white" : "bg-slate-200 text-ink-muted")}>
        {done ? <Check className="size-3.5" strokeWidth={3} /> : <Clock className="size-3.5" />}
      </span>
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-ink-muted">{said}</span>
      </span>
    </li>
  );
}

/** The Admin's signature for the firm, drawn in the box; signing makes the prospect a client. */
function AdminSign({ prospectId }: { prospectId: string }) {
  const queryClient = useQueryClient();
  const [drawn, setDrawn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  async function sign() {
    setBusy(true);
    setProblem(undefined);
    try {
      queryClient.setQueryData(getGetProspectAgreementQueryKey(prospectId),
        await signProspectAgreementAsAdmin(prospectId, { signature: drawn }));
      void queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(prospectId) });
      void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
    } catch (caught) {
      const said = toFormErrors(caught);
      setProblem(said.fields.signature ?? said.form ?? "That couldn't be signed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-primary-200 bg-primary-50/30 px-5 py-4">
      <h3 className="flex items-center gap-2 text-base font-bold"><PenLine aria-hidden="true" className="size-4" />Sign for the firm</h3>
      <p className="text-xs text-ink-muted">Signing makes them a client: they move to All clients.</p>
      <SignaturePad onChange={setDrawn} />
      {problem && <Alert tone="danger">{problem}</Alert>}
      <Button className="w-full justify-center" disabled={busy || !drawn} onClick={() => void sign()}>
        {busy ? "Signing…" : "Sign and make them a client"}
      </Button>
    </section>
  );
}
