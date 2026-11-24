import { ApiError } from "@atomprive/api-client";
import {
  createAgreementTemplate,
  getGetAgreementTemplateQueryKey,
  getListAgreementTemplatesQueryKey,
  getReadAgreementTemplateFileUrl,
  previewAgreementTemplate,
  publishAgreementTemplateVersion,
  saveAgreementTemplateText,
  uploadAgreementTemplateFile,
  useGetAgreementTemplate,
  useListAgreementFields,
  useListAgreementTemplates,
  type AgreementField,
  type AgreementPreview,
  type AgreementTemplateDetail,
  type AgreementTemplateRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStaffUser } from "../../auth/session";
import { toFormErrors } from "../../lib/api-errors";
import { openApiFile } from "../../lib/download";
import { formatDateTime } from "../../lib/labels";
import { SelectClientDialog } from "./select-client-dialog";
import type { PreviewClient } from "./preview-client";

const api = (url: string) => `/api${url.replace("/api", "")}`;

/**
 * Agreement templates (23 Nov 2026): the firm's agreement wording, kept by the Admin. Typed on screen with client fields
 * that fill in for each client, or uploaded as a Word or PDF file. Every save is a new version; the Admin publishes the
 * one new agreements are made from, and older versions are kept.
 */
export function AgreementTemplatesTab() {
  const user = useStaffUser();
  const mayChange = user.activeRole === "ADMIN";
  const templates = useListAgreementTemplates<AgreementTemplateRow[], ApiError>();
  const [chosen, setChosen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const rows = templates.data ?? [];
  const open = chosen ?? rows[0]?.id ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_1fr]">
      <section className="space-y-1 rounded-2xl border border-line bg-white p-3" aria-label="Agreement templates">
        {templates.isLoading && <p className="px-2 py-2 text-sm text-ink-muted">Loading…</p>}
        {rows.map((one) => (
          <button key={one.id} type="button" onClick={() => setChosen(one.id)} aria-current={open === one.id ? "true" : undefined}
            className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm", open === one.id ? "bg-primary-50 text-primary-700" : "hover:bg-canvas")}>
            <span className="block font-semibold">{one.name}</span>
            <span className="block text-xs text-ink-muted">
              {one.publishedVersion ? `v${one.publishedVersion} in use` : "Not published yet"}{one.latestVersion !== one.publishedVersion ? ` · v${one.latestVersion} latest` : ""}
            </span>
          </button>
        ))}
        {mayChange && <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setCreating(true)}>New template</Button>}
      </section>
      {open ? <Editor key={open} id={open} mayChange={mayChange} /> : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">No templates yet.</p>
      )}
      {creating && (
        <CreateDialog onClose={() => setCreating(false)} onCreated={(made) => {
          setCreating(false);
          setChosen(made.id);
          void queryClient.invalidateQueries({ queryKey: getListAgreementTemplatesQueryKey() });
        }} />
      )}
    </div>
  );
}

function Editor({ id, mayChange }: { id: string; mayChange: boolean }) {
  const detail = useGetAgreementTemplate<AgreementTemplateDetail, ApiError>(id);
  const fields = useListAgreementFields<AgreementField[], ApiError>();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [preview, setPreview] = useState<AgreementPreview | null>(null);
  const [client, setClient] = useState<PreviewClient | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const data = detail.data;
  useEffect(() => {
    if (data) setBody(data.latestBody ?? "");
  }, [data]);
  if (detail.isError) return <p className="text-sm text-red-700">That template couldn't be loaded.</p>;
  if (!data) return <p className="text-sm text-ink-muted">Opening…</p>;
  const latest = data.versions[0];
  const changed = body !== (data.latestBody ?? "");

  const updated = (next: AgreementTemplateDetail, said: string) => {
    queryClient.setQueryData(getGetAgreementTemplateQueryKey(id), next);
    void queryClient.invalidateQueries({ queryKey: getListAgreementTemplatesQueryKey() });
    setNotice(said);
  };
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setProblem(undefined);
    setNotice(undefined);
    try {
      await work();
    } catch (caught) {
      const said = toFormErrors(caught);
      setProblem(said.form ?? (Object.values(said.fields).join(" ") || "That didn't go through."));
    } finally {
      setBusy(false);
    }
  }
  function insert(name: string) {
    const text = `{{${name}}}`;
    const at = area.current?.selectionStart ?? body.length;
    const to = area.current?.selectionEnd ?? at;
    setBody(body.slice(0, at) + text + body.slice(to));
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(at + text.length, at + text.length);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{data.name}</h3>
            <p className="text-xs text-ink-muted">
              {data.publishedVersion ? `Version ${data.publishedVersion} is what new agreements use.` : "No version is published yet."}
              {latest ? ` Latest: version ${latest.version}${latest.kind === "FILE" ? ` (uploaded file ${latest.fileName})` : ""}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mayChange && (
              <>
                <input ref={file} type="file" className="sr-only" aria-label="Upload a Word or PDF file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => {
                    const chosenFile = event.target.files?.[0];
                    event.target.value = "";
                    if (chosenFile) void run(async () => updated(await uploadAgreementTemplateFile(id, { file: chosenFile }), `Uploaded ${chosenFile.name} as a new version.`));
                  }} />
                <Button variant="secondary" disabled={busy} onClick={() => file.current?.click()}><Upload aria-hidden="true" />Upload Word / PDF</Button>
              </>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => void run(async () => setPreview(await previewAgreementTemplate({ body, customerId: client?.id ?? null })))}>
              <Eye aria-hidden="true" />Preview
            </Button>
            {mayChange && latest && latest.version !== data.publishedVersion && !changed && (
              <Button disabled={busy} onClick={() => void run(async () => updated(await publishAgreementTemplateVersion(id, latest.version), `Version ${latest.version} published: new agreements use it now.`))}>
                Publish version {latest.version}
              </Button>
            )}
          </div>
        </div>
        {notice && <div className="mt-3"><Alert tone="success">{notice}</Alert></div>}
        {problem && <div className="mt-3"><Alert tone="danger">{problem}</Alert></div>}

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-muted">Insert a client field:</span>
          {(fields.data ?? []).map((one) => (
            <button key={one.name} type="button" disabled={!mayChange} onClick={() => insert(one.name)}
              className="rounded-md border border-line bg-canvas px-2 py-1 font-medium hover:border-primary-300 disabled:opacity-60">
              {one.label}
            </button>
          ))}
        </div>
        <Field id="agreement-body" label="Wording" hint="Client fields are written like {{clientName}} and fill in for each client.">
          <textarea id="agreement-body" ref={area} rows={18} value={body} readOnly={!mayChange}
            onChange={(event) => setBody(event.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-sm leading-6 text-ink" />
        </Field>
        {mayChange && (
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy}
              onClick={() => {
                if (!body.trim() || window.confirm("Replace the wording in the box with the rough draft? Nothing is saved until you press Save.")) setBody(ROUGH_DRAFT);
              }}>
              Use the rough draft
            </Button>
            <Button disabled={busy || !changed} onClick={() => void run(async () => updated(await saveAgreementTemplateText(id, { body }), "Saved as a new version. Publish it when it is ready."))}>
              Save as new version
            </Button>
          </div>
        )}
      </section>

      {preview && (
        <section className="rounded-2xl border border-line bg-white px-5 py-4" aria-labelledby="agreement-preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="agreement-preview" className="text-base font-bold">Preview{client ? ` for ${client.fullName}` : " with sample details"}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>{client ? "Another client" : "Use a real client"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
          {preview.unknownFields.length > 0 && <div className="mt-2"><Alert tone="warning">Not client fields: {preview.unknownFields.join(", ")}</Alert></div>}
          <pre className="mt-3 rounded-xl bg-canvas px-4 py-3 font-serif text-sm leading-6 whitespace-pre-wrap">{preview.text}</pre>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white px-5 py-4" aria-labelledby="agreement-versions">
        <h3 id="agreement-versions" className="text-base font-bold">Versions</h3>
        <ul className="mt-2 divide-y divide-line text-sm">
          {data.versions.map((one) => (
            <li key={one.version} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">v{one.version}</span>
                <span className="ml-2 text-xs text-ink-muted">
                  {one.kind === "FILE" ? `Uploaded ${one.fileName}` : "Typed"} · {formatDateTime(one.createdAt)} · {one.createdBy}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {one.version === data.publishedVersion && <Badge tone="success">In use</Badge>}
                <Button size="sm" variant="ghost" onClick={() => void openApiFile(api(getReadAgreementTemplateFileUrl(id, one.version)), one.fileName ?? `Client agreement v${one.version}.docx`)}>
                  <Download aria-hidden="true" />{one.kind === "FILE" ? "Open file" : "Download Word"}
                </Button>
                {mayChange && one.version !== data.publishedVersion && (
                  <Button size="sm" variant="secondary" disabled={busy}
                    onClick={() => void run(async () => updated(await publishAgreementTemplateVersion(id, one.version), `Version ${one.version} published: new agreements use it now.`))}>
                    Publish
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SelectClientDialog open={picking} onClose={() => setPicking(false)} onChoose={(next) => {
        setClient(next);
        void run(async () => setPreview(await previewAgreementTemplate({ body, customerId: next?.id ?? null })));
      }} />
    </div>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (made: AgreementTemplateDetail) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  async function save() {
    setError(undefined);
    try {
      onCreated(await createAgreementTemplate({ name }));
    } catch (caught) {
      const said = toFormErrors(caught);
      setError(said.fields.name ?? said.form ?? "That couldn't be added.");
    }
  }
  return (
    <Dialog open onClose={onClose} title="New agreement template" description="Name it, then type the wording or upload a file.">
      <div className="space-y-4">
        <Field id="agreement-name" label="Name" required error={error}>
          <TextInput id="agreement-name" value={name} maxLength={120} placeholder="e.g. DAM Agreement" onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()}>Add template</Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * A rough starting point for the firm's client agreement (23 Nov 2026), to be checked and reworded by the firm's legal
 * team. Only the client fields the template knows are used, so it saves as it is.
 */
const ROUGH_DRAFT = `CLIENT AGREEMENT

Rough draft: to be checked by the firm's legal team before use.

This agreement is made on {{today}} between {{firmName}} ("the firm") and {{clientName}} ("the client"), holder of passport {{passportNumber}}, residing at {{clientAddress}}.

Account holders: {{jointHolders}}
Relationship manager: {{relationshipManager}}

1. Services
1.1 The firm will advise on and, where the client has agreed to it in the investment mandate, manage the client's investments.
1.2 The firm will act in the client's best interests and within the investment objectives and risk profile agreed with the client.
1.3 The client's assets are held by the custodian banks named in the account opening documents, not by the firm.

2. The client's information
2.1 The client confirms that the information and documents given to the firm are true and complete.
2.2 The client will tell the firm promptly of any change to their personal details, financial position or tax residence.

3. Fees
3.1 The firm's fees are as set out in the fee schedule given to the client, which forms part of this agreement.
3.2 Fees are charged as shown in the fee schedule and may be taken from the client's account.

4. Risks
4.1 The value of investments can go down as well as up, and the client may get back less than they invested.
4.2 Past performance is not a guide to future returns. The client has read the risk disclosure given with this agreement.

5. Reports
5.1 The firm will send the client regular statements of their holdings and of the fees charged.

6. Confidentiality and data
6.1 The firm keeps the client's information confidential and uses it only to provide its services and to meet its legal duties.
6.2 The client agrees to the firm sharing information with custodians, regulators and service providers where needed.

7. Ending the agreement
7.1 Either party may end this agreement by giving written notice to the other.
7.2 Ending the agreement does not affect transactions already under way or fees already due.

8. Complaints
8.1 The client may raise a complaint with their relationship manager or with the firm's compliance team.

9. Governing law
9.1 This agreement is governed by the laws stated in the firm's terms of business.

Signatures

Client: {{clientName}}
Signature: ____________________   Date: __________

For {{firmName}}
Signature: ____________________   Date: __________
`;
