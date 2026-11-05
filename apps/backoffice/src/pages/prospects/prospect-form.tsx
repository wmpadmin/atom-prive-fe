import { ApiError } from "@atomprive/api-client";
import {
  getGetProspectQueryKey,
  getListProspectsQueryKey,
  getGetClientManagementOverviewQueryKey,
  useAddProspect,
  useCheckProspectDuplicates,
  useListProspectAssignees,
  useUpdateProspect,
  type ProspectDetail,
  type ProspectRequest,
  type ProspectRequestSource,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { SOURCE_LABELS } from "./prospect-labels";

type Draft = {
  fullName: string;
  clientType: "INDIVIDUAL" | "ENTITY";
  email: string;
  phone: string;
  source: ProspectRequestSource;
  referredBy: string;
  assignedTo: string;
  nextFollowUp: string;
  notes: string;
  doNotEmail: boolean;
};

function draftOf(detail: ProspectDetail | null, me: string | null): Draft {
  const prospect = detail?.prospect;
  return {
    fullName: prospect?.fullName ?? "",
    clientType: prospect?.clientType ?? "INDIVIDUAL",
    email: prospect?.email ?? "",
    phone: prospect?.phone ?? "",
    source: prospect?.source ?? "REFERRAL",
    referredBy: detail?.referredBy ?? "",
    assignedTo: prospect?.assignedTo?.id ?? me ?? "",
    nextFollowUp: prospect?.nextFollowUp ?? "",
    notes: detail?.notes ?? "",
    doNotEmail: prospect?.doNotEmail ?? false,
  };
}

/**
 * Adding a prospective client, or editing one: basic details only. Drawn afresh each time it opens, so it
 * always starts from the prospect as they are now. The full details are asked for when they
 * are converted, on the onboarding form, and not before.
 *
 * @param onlyMine a relationship manager adds prospects for themselves, so "Assigned to" is them and fixed
 */
export function ProspectForm({ open, editing, onlyMine, me, onClose, onSaved }: {
  open: boolean;
  editing: ProspectDetail | null;
  onlyMine: boolean;
  me: string;
  onClose: () => void;
  onSaved: (saved: ProspectDetail) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(editing, onlyMine ? me : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const assignees = useListProspectAssignees({ query: { enabled: open && !onlyMine } });

  // Asked as they type, so a lead who is already a client — or already a prospect — is caught before saving.
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const duplicates = useCheckProspectDuplicates(
    { email: email || undefined, phone: phone || undefined, except: editing?.prospect.id },
    { query: { enabled: open && (email.length > 4 || phone.replace(/\D/g, "").length > 6) } },
  );

  const saved = (detail: ProspectDetail) => {
    void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
    void queryClient.invalidateQueries({ queryKey: getGetClientManagementOverviewQueryKey() });
    queryClient.setQueryData(getGetProspectQueryKey(detail.prospect.id), detail);
    onSaved(detail);
  };
  const failed = (error: ApiError) => {
    setErrors(error.problem?.errors ?? {});
    setProblem(error.problem?.errors ? null : error.message);
  };
  const add = useAddProspect<ApiError>({ mutation: { onSuccess: saved, onError: failed } });
  const update = useUpdateProspect<ApiError>({ mutation: { onSuccess: saved, onError: failed } });
  const busy = add.isPending || update.isPending;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((was) => ({ ...was, [key]: value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const request: ProspectRequest = {
      fullName: draft.fullName,
      clientType: draft.clientType,
      email: email || null,
      phone: phone || null,
      source: draft.source,
      referredBy: draft.referredBy.trim() || null,
      assignedTo: draft.assignedTo || null,
      nextFollowUp: draft.nextFollowUp || null,
      notes: draft.notes.trim() || null,
      doNotEmail: draft.doNotEmail,
    };
    if (editing) update.mutate({ id: editing.prospect.id, data: request });
    else add.mutate({ data: request });
  };

  const clash = duplicates.data;
  return (
    <Dialog
      open={open}
      size="lg"
      title={editing ? `Edit ${editing.prospect.fullName}` : "Add Prospective Client"}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field id="prospect-type" label="Client type">
          <div id="prospect-type" role="radiogroup" className="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
            {(["INDIVIDUAL", "ENTITY"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={draft.clientType === type}
                onClick={() => set("clientType", type)}
                className={cn(
                  "h-10 text-sm",
                  draft.clientType === type ? "bg-primary-50 font-semibold text-primary-700" : "text-ink-soft hover:bg-slate-50",
                )}
              >
                {type === "INDIVIDUAL" ? "Individual" : "Entity"}
              </button>
            ))}
          </div>
        </Field>

        <Field id="prospect-name" label={draft.clientType === "ENTITY" ? "Entity name" : "Name"} required error={errors.fullName}>
          <TextInput id="prospect-name" value={draft.fullName} onChange={(event) => set("fullName", event.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="prospect-email" label="Email" error={errors.email}>
            <TextInput
              id="prospect-email"
              type="email"
              value={draft.email}
              onChange={(event) => set("email", event.target.value)}
            />
          </Field>
          <Field id="prospect-phone" label="Phone" error={errors.phone}>
            <TextInput id="prospect-phone" type="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} />
          </Field>
        </div>

        {clash?.clientName && (
          <Alert tone="danger">{clash.clientName} is already a client with these details, so they can't be added as a prospect.</Alert>
        )}
        {!clash?.clientName && clash?.prospectName && (
          <Alert tone="warning">
            Another prospect, {clash.prospectName} ({clash.prospectReference}), has these details. You can still save.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="prospect-source" label="Source" required>
            <SelectInput
              id="prospect-source"
              value={draft.source}
              onChange={(event) => set("source", event.target.value as ProspectRequestSource)}
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectInput>
          </Field>
          <Field id="prospect-referred" label="Referred by">
            <TextInput id="prospect-referred" value={draft.referredBy} onChange={(event) => set("referredBy", event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="prospect-assigned" label="Assigned to" error={errors.assignedTo}>
            {onlyMine ? (
              <TextInput id="prospect-assigned" value="You" disabled />
            ) : (
              <SelectInput id="prospect-assigned" value={draft.assignedTo} onChange={(event) => set("assignedTo", event.target.value)}>
                <option value="">Nobody yet</option>
                {(assignees.data ?? []).map((one) => (
                  <option key={one.id} value={one.id}>{one.fullName} ({one.role})</option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field id="prospect-next" label="Next follow up">
            <DateInput
              id="prospect-next"
              name="nextFollowUp"
              value={draft.nextFollowUp}
              min={new Date(2000, 0, 1)}
              max={new Date(2100, 0, 1)}
              clearable
              onChange={(value) => set("nextFollowUp", value)}
            />
          </Field>
        </div>

        <Field id="prospect-notes" label="Notes">
          <TextArea
            id="prospect-notes"
            rows={3}
            value={draft.notes}
            placeholder="What they are looking for"
            onChange={(event) => set("notes", event.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            id="prospect-do-not-email"
            type="checkbox"
            checked={draft.doNotEmail}
            onChange={(event) => set("doNotEmail", event.target.checked)}
            className="size-4 rounded border-line"
          />
          They asked not to be emailed
        </label>

        {problem && <Alert tone="danger">{problem}</Alert>}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || Boolean(clash?.clientName)}>
            {editing ? "Save changes" : "Add prospect"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
