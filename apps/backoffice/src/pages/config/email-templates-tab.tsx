import { ApiError } from "@atomprive/api-client";
import {
  getGetEmailTemplateQueryKey,
  getListEmailTemplatesQueryKey,
  useCreateEmailTemplate,
  useGetEmailTemplate,
  useListEmailPlaceholders,
  useListEmailTemplates,
  usePreviewEmailTemplate,
  useRenameEmailTemplate,
  useRestoreEmailTemplateVersion,
  useSaveEmailTemplateVersion,
  useSendTestEmail,
  type Placeholder,
  type TemplateDetail,
  type TemplateSummary,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Badge, Button, cn, describedBy, Dialog, Field, IconButton, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PencilLine } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDay } from "./config-labels";
import { ConfirmDialog } from "./confirm-dialog";

type Notice = { tone: "success" | "danger"; message: string };
type Mode = "edit" | "preview" | "versions";

interface EmailTemplatesTabProps {
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}

/** The emails the portal sends, with versions Admins can edit, preview, test and restore (#98). */
export function EmailTemplatesTab({ creating, onCreatingChange }: EmailTemplatesTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const templates = useListEmailTemplates<TemplateSummary[], ApiError>();
  const [dirty, setDirty] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const list = templates.data ?? [];
  const selectedId = list.find((template) => template.id === searchParams.get("template"))?.id ?? list[0]?.id;

  function open(id: string) {
    setSearchParams({ tab: "templates", template: id }, { replace: true });
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[16rem_1fr]">
      <section aria-labelledby="templates-title" className="rounded-2xl border border-line bg-white p-4">
        <h2 id="templates-title" className="text-base font-bold">
          Email templates
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">Every email the portal sends</p>
        {templates.isError && (
          <div className="mt-3">
            <Alert tone="danger">{templates.error.message}</Alert>
          </div>
        )}
        {templates.isPending && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
        <ul className="mt-3 space-y-2">
          {list.map((template) => {
            const selected = template.id === selectedId;
            return (
              <li key={template.id}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    if (selected) return;
                    if (dirty) setSwitchingTo(template.id);
                    else open(template.id);
                  }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                    selected ? "border-primary-600 bg-primary-50" : "border-line bg-slate-50/60 hover:border-primary-100",
                  )}
                >
                  <span className={cn("block text-sm font-semibold", selected && "text-primary-700")}>{template.name}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-2xs text-ink-muted">
                    {template.currentVersion === null
                      ? `draft · created ${formatDay(template.updatedAt)}`
                      : `v${template.currentVersion} · edited ${formatDay(template.updatedAt)}`}
                    {template.currentVersion === null && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-3xs font-bold text-amber-800">DRAFT</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selectedId ? (
        <TemplateEditor key={selectedId} id={selectedId} onDirtyChange={setDirty} />
      ) : (
        templates.isSuccess && (
          <section className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center text-sm text-ink-muted">
            No email templates yet. Create the first one with Create template.
          </section>
        )
      )}

      <CreateTemplateDialog
        open={creating}
        onClose={() => onCreatingChange(false)}
        onCreated={(created) => {
          onCreatingChange(false);
          setDirty(false);
          open(created.id);
        }}
      />
      <ConfirmDialog
        open={switchingTo !== null}
        title="Discard your changes?"
        description="The wording you haven't saved will be lost."
        confirmLabel="Discard and switch"
        tone="danger"
        onConfirm={() => {
          if (switchingTo) open(switchingTo);
          setSwitchingTo(null);
          setDirty(false);
        }}
        onClose={() => setSwitchingTo(null)}
      />
    </div>
  );
}

function TemplateEditor({ id, onDirtyChange }: { id: string; onDirtyChange: (dirty: boolean) => void }) {
  const detail = useGetEmailTemplate<TemplateDetail, ApiError>(id);
  if (detail.isPending) {
    return <section className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">Loading…</section>;
  }
  if (detail.isError) {
    return (
      <section className="rounded-2xl border border-line bg-white p-6">
        <Alert tone="danger">{detail.error.message}</Alert>
      </section>
    );
  }
  // Remounts when a new version is saved, so the fields start from the saved wording.
  return <EditorForm key={detail.data.versions[0]?.version ?? 0} template={detail.data} onDirtyChange={onDirtyChange} />;
}

function EditorForm({ template, onDirtyChange }: { template: TemplateDetail; onDirtyChange: (dirty: boolean) => void }) {
  const queryClient = useQueryClient();
  const user = useStaffUser();
  const current = template.versions[0];
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [mode, setMode] = useState<Mode>("edit");
  const [notice, setNotice] = useState<Notice>();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [renaming, setRenaming] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const placeholders = useListEmailPlaceholders<Placeholder[], ApiError>();
  const dirty = subject !== (current?.subject ?? "") || body !== (current?.body ?? "");

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  async function refresh(saved?: TemplateDetail) {
    if (saved) queryClient.setQueryData(getGetEmailTemplateQueryKey(template.id), saved);
    await queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
  }

  const onError = (error: ApiError) => {
    const formErrors = toFormErrors(error);
    setErrors(formErrors);
    if (formErrors.form) setNotice({ tone: "danger", message: formErrors.form });
  };
  const save = useSaveEmailTemplateVersion<ApiError>({
    mutation: {
      onSuccess: async (saved) => {
        await refresh(saved);
        setNotice({ tone: "success", message: `Saved as version ${saved.versions[0]?.version}. It's used from the next email sent.` });
      },
      onError,
    },
  });
  const restore = useRestoreEmailTemplateVersion<ApiError>({
    mutation: {
      onSuccess: async (saved) => {
        await refresh(saved);
        setNotice({ tone: "success", message: `Restored as version ${saved.versions[0]?.version}.` });
      },
      onError,
    },
  });
  const sendTest = useSendTestEmail<ApiError>({
    mutation: {
      onSuccess: () => setNotice({ tone: "success", message: `Test email sent to ${user.email}.` }),
      onError,
    },
  });

  function insertPlaceholder(name: string) {
    const textarea = bodyRef.current;
    const text = `{{${name}}}`;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    setNotice(undefined);
    save.mutate({ id: template.id, data: { subject, body } });
  }

  const content = { subject, body };
  const hasContent = subject.trim() !== "" && body.trim() !== "";

  return (
    <section aria-labelledby="template-name" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name="Vikram Mehta" tone="navy" />
          <div>
            <p className="text-sm font-semibold">Vikram Mehta</p>
            <p className="text-xs text-ink-muted">Sample client C1420 · Advisor Priya Nair</p>
          </div>
        </div>
        <Button size="sm" disabled title="Available once client accounts are in the platform">
          Select client
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="template-name" className="text-base font-bold">
              {template.name}
            </h2>
            <IconButton label="Rename email" onClick={() => setRenaming(true)} className="size-7">
              <PencilLine aria-hidden="true" />
            </IconButton>
          </div>
          <p className="text-xs text-ink-muted">
            {template.description}
            {current ? ` · v${current.version} · edited ${formatDay(current.createdAt)}` : " · draft, not sent until saved"}
          </p>
        </div>
        <div role="tablist" aria-label="View" className="inline-flex rounded-xl border border-line bg-slate-50 p-1">
          {(["edit", "preview", "versions"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                mode === option ? "bg-primary-600 text-white" : "text-ink-soft hover:bg-white",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.message}</Alert>
        </div>
      )}

      {mode === "edit" && (
        <form id="template-form" onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field id="subject" label="Subject" error={errors.fields.subject}>
            <TextInput
              {...describedBy("subject", errors.fields.subject)}
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={current ? undefined : "Paste the subject line from the client"}
              className="bg-slate-50"
            />
          </Field>
          <Field id="body" label="Body" error={errors.fields.body}>
            <textarea
              {...describedBy("body", errors.fields.body)}
              ref={bodyRef}
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={current ? undefined : "Paste the email text from the client"}
              rows={14}
              className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm leading-6 text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none aria-invalid:border-red-500"
            />
          </Field>
          {placeholders.data && (
            <div>
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Insert a placeholder</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {placeholders.data.map((placeholder) => (
                  <button
                    key={placeholder.name}
                    type="button"
                    title={`Example: ${placeholder.sample}`}
                    onClick={() => insertPlaceholder(placeholder.name)}
                    className="rounded-md border border-line bg-white px-2 py-0.5 font-mono text-2xs text-ink-soft hover:border-primary-600 hover:text-primary-700"
                  >
                    {`{{${placeholder.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      {mode === "preview" && <PreviewPanel subject={subject} body={body} />}

      {mode === "versions" && (
        <div className="mt-4">
          {template.versions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
              No versions yet. The first save becomes version 1.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {template.versions.map((version, index) => (
                <li key={version.version} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Version {version.version}
                        {index === 0 && (
                          <span className="ml-2 align-middle">
                            <Badge tone="success">Being sent</Badge>
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDay(version.createdAt)} · {version.createdBy}
                      </p>
                    </div>
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={restore.isPending || dirty}
                        title={dirty ? "Save or discard your edits first" : undefined}
                        onClick={() => restore.mutate({ id: template.id, version: version.version })}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-ink-soft">{version.subject}</summary>
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 whitespace-pre-wrap text-ink-soft">{version.body}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-muted">
          {dirty ? "Unsaved changes. " : ""}Saving creates a new version — the previous one stays restorable.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!hasContent || sendTest.isPending}
            onClick={() => {
              setNotice(undefined);
              sendTest.mutate({ id: template.id, data: content });
            }}
          >
            {sendTest.isPending ? "Sending…" : "Send test email"}
          </Button>
          <Button size="sm" variant="secondary" disabled title="Available once client accounts are in the platform">
            Send to client
          </Button>
          <Button
            size="sm"
            type="submit"
            form="template-form"
            disabled={save.isPending || !dirty || mode !== "edit"}
            title={mode !== "edit" ? "Switch to Edit to save" : undefined}
          >
            {save.isPending ? "Saving…" : "Save new version"}
          </Button>
        </div>
      </div>

      <RenameTemplateDialog
        template={template}
        open={renaming}
        onClose={() => setRenaming(false)}
        onRenamed={async (renamed) => {
          setRenaming(false);
          await refresh(renamed);
          setNotice({ tone: "success", message: `Renamed to ${renamed.name}.` });
        }}
      />
    </section>
  );
}

interface RenameTemplateDialogProps {
  template: TemplateDetail;
  open: boolean;
  onClose: () => void;
  onRenamed: (template: TemplateDetail) => void;
}

function RenameTemplateDialog({ template, open, onClose, onRenamed }: RenameTemplateDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Rename email" description="Only the name changes. The email is still sent at the same moments, with the same wording.">
      {/* Mounted only while open, so every opening starts from the current name. */}
      {open && <RenameTemplateForm template={template} onCancel={onClose} onRenamed={onRenamed} />}
    </Dialog>
  );
}

function RenameTemplateForm({ template, onCancel, onRenamed }: { template: TemplateDetail; onCancel: () => void; onRenamed: (template: TemplateDetail) => void }) {
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const rename = useRenameEmailTemplate<ApiError>({
    mutation: {
      onSuccess: onRenamed,
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    rename.mutate({ id: template.id, data: { name: String(form.get("name")) } });
  }

  const { fields } = errors;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <Field id="template-new-name" label="Email name" required error={fields.name}>
        <TextInput {...describedBy("template-new-name", fields.name)} name="name" defaultValue={template.name} maxLength={120} required />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={rename.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={rename.isPending}>
          {rename.isPending ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}

function PreviewPanel({ subject, body }: { subject: string; body: string }) {
  const preview = usePreviewEmailTemplate<ApiError>();
  const { mutate } = preview;

  useEffect(() => {
    mutate({ data: { subject, body } });
  }, [mutate, subject, body]);

  if (preview.isError) {
    return (
      <div className="mt-4">
        <Alert tone="danger">{preview.error.message}</Alert>
      </div>
    );
  }
  const rendered = preview.data;
  return (
    <div className="mt-4 space-y-3">
      {rendered && rendered.unknownPlaceholders.length > 0 && (
        <Alert tone="danger">
          These placeholders aren't recognised and would be sent exactly as typed:{" "}
          {rendered.unknownPlaceholders.map((name) => `{{${name}}}`).join(", ")}
        </Alert>
      )}
      <div className="rounded-xl border border-line">
        <p className="border-b border-line px-4 py-3 text-sm">
          <span className="text-ink-muted">Subject: </span>
          <span className="font-semibold">{rendered ? rendered.subject || "(no subject yet)" : "…"}</span>
        </p>
        <p className="min-h-48 px-4 py-4 text-sm leading-6 whitespace-pre-wrap text-ink-soft">
          {rendered ? rendered.body || "Nothing to preview yet." : "Loading preview…"}
        </p>
      </div>
      <p className="text-xs text-ink-muted">Placeholders are filled in with sample values here and in test emails.</p>
    </div>
  );
}

function CreateTemplateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (template: TemplateDetail) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Create template" description="A new email starts as a draft. It isn't sent until its first version is saved.">
      {open && <CreateTemplateForm onCancel={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function CreateTemplateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (template: TemplateDetail) => void }) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const create = useCreateEmailTemplate<ApiError>({
    mutation: {
      onSuccess: async (created) => {
        await queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
        onCreated(created);
      },
      onError: (error) => setErrors(toFormErrors(error)),
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors(noErrors);
    create.mutate({ data: { name: String(form.get("name")), description: String(form.get("description")) } });
  }

  const { fields } = errors;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <Field id="name" label="Email name" error={fields.name}>
        <TextInput {...describedBy("name", fields.name)} name="name" placeholder="Quarterly statement ready" required />
      </Field>
      <Field id="description" label="When it's sent" error={fields.description}>
        <TextInput {...describedBy("description", fields.description)} name="description" placeholder="Sent when a quarterly statement is published" required />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
