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
import { Alert, Avatar, Badge, Button, cn, describedBy, Dialog, Field, IconButton, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PencilLine } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { formatDay } from "./config-labels";
import { ConfirmDialog } from "./confirm-dialog";
import {
  aClientFillsSomethingIn,
  placeholderValues,
  readPreviewClient,
  rememberPreviewClient,
  type PreviewClient,
} from "./preview-client";
import { SelectClientDialog } from "./select-client-dialog";

type Notice = { tone: "success" | "danger"; message: string };
// Versions used to be the third of these. They are a column of their own now, beside the wording rather
// than behind a tab, so the history and what is being sent are read at the same time.
type Mode = "edit" | "preview";

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
  // Which client the preview and the test email stand in for. Held here rather than inside the editor
  // because it is chosen beside the template, and because it survives moving from one template to another.
  const [previewClient, setPreviewClient] = useState<PreviewClient | null>(readPreviewClient);
  const [pickingClient, setPickingClient] = useState(false);

  function chooseClient(client: PreviewClient | null) {
    setPreviewClient(client);
    rememberPreviewClient(client);
  }

  const list = templates.data ?? [];
  const selected = list.find((template) => template.id === searchParams.get("template")) ?? list[0];
  const selectedId = selected?.id;
  // What the chosen email is given. Asked here as well as in the editor so the picker beside the template
  // can say, before anybody uses it, whether choosing a client would change a word of this one.
  const placeholders = useListEmailPlaceholders<Placeholder[], ApiError>(
    { template: selected?.key ?? "" },
    { query: { enabled: selected !== undefined } },
  );
  const clientMatters = placeholders.data === undefined
    || aClientFillsSomethingIn(placeholders.data.map((one) => one.name));

  function open(id: string) {
    setSearchParams({ tab: "templates", template: id }, { replace: true });
  }

  return (
    <div className="space-y-5">
      {/* One box rather than twenty. The emails ran to a column of cards twice the height of the editor
          beside them, and choosing one is a single choice — which is what a dropdown is for. */}
      <section aria-labelledby="templates-title" className="rounded-2xl border border-line bg-white px-5 py-4">
        <h2 id="templates-title" className="sr-only">
          Email templates
        </h2>
        {templates.isError && <Alert tone="danger">{templates.error.message}</Alert>}
        {templates.isPending && <p className="text-sm text-ink-muted">Loading…</p>}
        {templates.isSuccess && list.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="template"
              label="Template"
              hint={`${list.length} ${list.length === 1 ? "email" : "emails"} the platform sends`}
              className="min-w-0"
            >
              <SelectInput
                id="template"
                value={selectedId ?? ""}
                onChange={(event) => {
                  const wanted = event.target.value;
                  if (wanted === selectedId) return;
                  if (dirty) setSwitchingTo(wanted);
                  else open(wanted);
                }}
              >
                {list.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.currentVersion === null ? " — draft" : ` — v${template.currentVersion}`}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {/* Beside the template rather than inside the editor. The two are one question asked twice —
                which email, and whose details it is read with — and they were a card apart. */}
            <Field
              id="preview-client"
              label="Read it as"
              hint={
                !clientMatters
                  ? "This email has no client details in it. It reads as you."
                  : previewClient
                    ? previewClient.advisorName
                      ? `Relationship manager ${previewClient.advisorName}`
                      : "No relationship manager yet"
                    : undefined
              }
              className="min-w-0"
            >
              {/* The same h-10 the dropdown beside it wears, so the two halves are one line of controls
                  rather than one box taller than the other. The name and the code share that line; what
                  else is known about them is said in the hint under it. */}
              <div
                aria-disabled={!clientMatters}
                className={cn(
                  "flex h-10 min-w-0 items-center gap-2 rounded-lg border border-line pr-1.5 pl-2.5",
                  clientMatters ? "bg-white" : "bg-slate-50",
                )}
              >
                <Avatar
                  name={previewClient?.fullName ?? "Vikram Mehta"}
                  photo={previewClient?.photo ?? null}
                  className={cn("size-6 text-3xs", !clientMatters && "opacity-50")}
                />
                <span className={cn("min-w-0 flex-1 truncate text-sm", !clientMatters && "text-ink-muted")}>
                  <span className={clientMatters ? "font-semibold" : undefined}>
                    {previewClient?.fullName ?? "Vikram Mehta"}
                  </span>
                  <span className="text-ink-muted"> · {previewClient ? previewClient.code : "C1420"}</span>
                </span>
                {clientMatters && previewClient && (
                  <Button size="sm" variant="ghost" onClick={() => chooseClient(null)}>
                    Sample
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!clientMatters}
                  title={clientMatters ? undefined : "This email names no client"}
                  onClick={() => setPickingClient(true)}
                >
                  {previewClient ? "Change" : "Select"}
                </Button>
              </div>
            </Field>
          </div>
        )}
      </section>

      {selectedId ? (
        <TemplateEditor key={selectedId} id={selectedId} onDirtyChange={setDirty} previewClient={previewClient} />
      ) : (
        templates.isSuccess && (
          <section className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center text-sm text-ink-muted">
            No email templates yet. Create the first one with Create template.
          </section>
        )
      )}

      <SelectClientDialog open={pickingClient} onClose={() => setPickingClient(false)} onChoose={chooseClient} />
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

function TemplateEditor({ id, onDirtyChange, previewClient }: {
  id: string;
  onDirtyChange: (dirty: boolean) => void;
  previewClient: PreviewClient | null;
}) {
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
  return (
    <EditorForm
      key={detail.data.versions[0]?.version ?? 0}
      template={detail.data}
      onDirtyChange={onDirtyChange}
      previewClient={previewClient}
    />
  );
}

function EditorForm({ template, onDirtyChange, previewClient }: {
  template: TemplateDetail;
  onDirtyChange: (dirty: boolean) => void;
  previewClient: PreviewClient | null;
}) {
  const queryClient = useQueryClient();
  const user = useStaffUser();
  const current = template.versions[0];
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [mode, setMode] = useState<Mode>("edit");
  /**
   * The version being read, or null for the one being sent.
   *
   * <p>An older one is shown as it was and cannot be typed over: editing it would be a new version written
   * from an old one, which is what Restore is, and offering the same act twice under two names is how
   * somebody ends up doing the other one. Restore brings it back, and then it is editable like anything else.
   */
  const [reading, setReading] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: the subject sits above a body box that fills the screen.
  useShowFirstError(errors, form);
  const [renaming, setRenaming] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Only what this email is actually given. A name its sender doesn't fill in goes out as it was typed, so
  // offering it here would be offering a mistake.
  const placeholders = useListEmailPlaceholders<Placeholder[], ApiError>({ template: template.key });
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
    // The wording is saved as typed; the picked client only stands in for previews and test emails.
    save.mutate({ id: template.id, data: { subject, body, values: null } });
  }

  const older = reading === null ? null : (template.versions.find((one) => one.version === reading) ?? null);
  const shownSubject = older ? older.subject : subject;
  const shownBody = older ? older.body : body;

  // The picked client's details go with the wording, so the preview and the test email read the same way.
  // The reader's own name wherever an email names the member of staff it is written to. A preview read
  // "Hello Priya Nair" to everybody, which is a stranger's name on a letter addressed to you — and on the
  // emails that name no client at all, it was the only name on screen and nothing could change it. Only
  // the preview and the test email: a real send names whoever it is actually going to.
  const values = { ...(placeholderValues(previewClient) ?? {}), staff_name: user.fullName };
  const content = { subject: shownSubject, body: shownBody, values };
  const hasContent = shownSubject.trim() !== "" && shownBody.trim() !== "";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[17rem_1fr]">
      {/* The history, beside the wording rather than behind a tab. Reading what was sent last month and
          what is being sent now are the same question, and a tab made them two. */}
      <section aria-labelledby="versions-title" className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 id="versions-title" className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Saved versions
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">Newest first. Open one to read it.</p>
        </div>
        {template.versions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No versions yet. The first save becomes version 1.
          </p>
        ) : (
          <ul>
            {template.versions.map((version, index) => {
              const open = reading === null ? index === 0 : reading === version.version;
              return (
                <li key={version.version} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    aria-current={open ? "true" : undefined}
                    onClick={() => setReading(index === 0 ? null : version.version)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600",
                      open ? "bg-primary-50 shadow-[inset_3px_0_0_var(--color-primary-600)]" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      Version {version.version}
                      {index === 0 && <Badge tone="success">Being sent</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {formatDay(version.createdAt)} · {version.createdBy}
                    </span>
                  </button>
                  {/* Only on one somebody is actually looking at, so the column is a list of versions
                      rather than a column of buttons. */}
                  {open && index > 0 && (
                    <div className="px-4 pb-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={restore.isPending || dirty}
                        title={dirty ? "Save or discard your edits first" : undefined}
                        onClick={() => {
                          setReading(null);
                          restore.mutate({ id: template.id, version: version.version });
                        }}
                      >
                        Restore this version
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

    <section aria-labelledby="template-name" className="min-w-0 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            {/* Which version is on screen, because with the history beside it that is now a real question. */}
            {older
              ? ` · reading version ${older.version} · ${formatDay(older.createdAt)}`
              : current
                ? ` · version ${current.version}, the one being sent · edited ${formatDay(current.createdAt)}`
                : " · draft, not sent until saved"}
          </p>
        </div>
        <div role="tablist" aria-label="View" className="inline-flex rounded-xl border border-line bg-slate-50 p-1">
          {(["edit", "preview"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                mode === option ? "bg-primary-600 text-on-accent" : "text-ink-soft hover:bg-white",
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
        <form ref={form} id="template-form" onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field id="subject" label="Subject" error={errors.fields.subject}>
            <TextInput
              {...describedBy("subject", errors.fields.subject)}
              name="subject"
              value={shownSubject}
              readOnly={older !== null}
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
              value={shownBody}
              readOnly={older !== null}
              onChange={(event) => setBody(event.target.value)}
              placeholder={current ? undefined : "Paste the email text from the client"}
              rows={14}
              className="block w-full rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm leading-6 text-ink placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none aria-invalid:border-red-500"
            />
          </Field>
          {older && (
            <Alert tone="info">
              You are reading version {older.version} as it was sent. Restore it on the left to edit it, or
              open the version being sent.
            </Alert>
          )}
          {!older && placeholders.data && (
            <div>
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Insert a placeholder</p>
              {placeholders.data.length === 0 && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  Nothing gives this email any details, so anything in {"{{ }}"} would be sent exactly as typed.
                </p>
              )}
              {!template.sentByThePortal && placeholders.data.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Nothing sends this email yet. Write the wording now — these are what it will be given once
                  sending it is built.
                </p>
              )}
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

      {mode === "preview" && <PreviewPanel subject={subject} body={body} values={values} templateKey={template.key} />}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-muted">
          {older
            ? "Reading an older version. Restore it on the left to make it the one being sent."
            : `${dirty ? "Unsaved changes. " : ""}Saving creates a new version — the previous one stays readable on the left.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={older !== null || !hasContent || sendTest.isPending}
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
            disabled={save.isPending || !dirty || mode !== "edit" || older !== null}
            title={
              older !== null
                ? "Restore this version to edit it"
                : mode !== "edit"
                  ? "Switch to Edit to save"
                  : undefined
            }
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
    </div>
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

interface PreviewPanelProps {
  subject: string;
  body: string;
  /** The picked client's details, or null to fill the placeholders with samples. */
  values: Record<string, string> | null;
  /** Which email this is, so a name it is never given is called out rather than quietly stood in for. */
  templateKey: string;
}

function PreviewPanel({ subject, body, values, templateKey }: PreviewPanelProps) {
  const preview = usePreviewEmailTemplate<ApiError>();
  const { mutate } = preview;
  // The values are rebuilt on each render, so the effect watches what is in them rather than the object itself.
  const valuesKey = JSON.stringify(values ?? null);

  useEffect(() => {
    mutate({
      data: { subject, body, values: JSON.parse(valuesKey) as Record<string, string> | null, template: templateKey },
    });
  }, [mutate, subject, body, valuesKey, templateKey]);

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
          This email is never given these, so they would be sent exactly as typed:{" "}
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
      <p className="text-xs text-ink-muted">
        {values
          ? "Filled in with the picked client's details here and in test emails. Anything they can't fill, such as a reference or proposal, keeps its sample value."
          : "Placeholders are filled in with sample values here and in test emails. Pick a client above to see a real one."}
      </p>
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
