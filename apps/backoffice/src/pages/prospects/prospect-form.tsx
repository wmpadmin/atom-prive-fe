import { ApiError } from "@atomprive/api-client";
import { SigningAs } from "../../components/signature";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  getListProspectPartiesQueryKey,
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
import { Alert, Button, cn, DateInput, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { saveStaged, StagedParties, type StagedParty } from "./entity-parties";
import { useStaffUser } from "../../auth/session";
import { CountrySelect } from "../../components/country-select";

type Draft = {
  fullName: string;
  clientType: "INDIVIDUAL" | "ENTITY";
  email: string;
  phone: string;
  /** ISO two-letter code, or empty when not said (scope §10). */
  country: string;
  /** Empty until chosen: a draft may be kept without it (22 Nov 2026). */
  source: NonNullable<ProspectRequestSource> | "";
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
    country: prospect?.country ?? "",
    source: prospect?.source ?? "",
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
  const user = useStaffUser();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const assignees = useListProspectAssignees({ query: { enabled: open && !onlyMine } });
  // Added by someone who is a relationship manager themselves: they are its RM until changed (23 Nov 2026).
  const iAmAnRm = !editing && (assignees.data ?? []).some((one) => one.id === me);
  useEffect(() => {
    if (iAmAnRm) setDraft((was) => (was.assignedTo ? was : { ...was, assignedTo: me }));
  }, [iAmAnRm, me]);

  // Asked as they type, so a lead who is already a client — or already a prospect — is caught before saving.
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const duplicates = useCheckProspectDuplicates(
    { email: email || undefined, phone: phone || undefined, except: editing?.prospect.id },
    { query: { enabled: open && (email.length > 4 || phone.replace(/\D/g, "").length > 6) } },
  );

  // An entity's people, held here until the prospect exists, then saved onto it (22 Nov 2026).
  const [staged, setStaged] = useState<StagedParty[]>([]);
  const [savingPeople, setSavingPeople] = useState(false);
  const saved = async (detail: ProspectDetail) => {
    if (!editing && draft.clientType === "ENTITY" && staged.length > 0) {
      setSavingPeople(true);
      const failed = await saveStaged(detail.prospect.id, staged);
      setSavingPeople(false);
      if (failed.length > 0) {
        window.alert(`${detail.prospect.fullName} was added, but ${failed.join(", ")} couldn't be saved. Add them again in the prospect's Stakeholders.`);
      }
      void queryClient.invalidateQueries({ queryKey: getListProspectPartiesQueryKey(detail.prospect.id) });
    }
    afterSave(detail);
  };
  // Set when Cancel or close kept a draft: the list is refreshed and the form just closes.
  const closingAsDraft = useRef(false);
  const afterSave = (detail: ProspectDetail) => {
    void queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey().slice(0, 1) });
    void queryClient.invalidateQueries({ queryKey: getGetClientManagementOverviewQueryKey() });
    queryClient.setQueryData(getGetProspectQueryKey(detail.prospect.id), detail);
    if (closingAsDraft.current) onClose();
    else onSaved(detail);
  };
  const failed = (error: ApiError) => {
    // Cancel always closes (23 Nov 2026): the draft is kept when it can be, and the form shuts even when it can't.
    if (closingAsDraft.current) {
      closingAsDraft.current = false;
      onClose();
      return;
    }
    setErrors(error.problem?.errors ?? {});
    setProblem(error.problem?.errors ? null : error.message);
  };
  const add = useAddProspect<ApiError>({ mutation: { onSuccess: (detail) => void saved(detail), onError: failed } });
  const update = useUpdateProspect<ApiError>({ mutation: { onSuccess: afterSave, onError: failed } });
  const busy = add.isPending || update.isPending || savingPeople;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((was) => ({ ...was, [key]: value }));

  // Another prospect with the same email or phone is asked about once, at saving; an existing client is refused.
  const [askedAboutClash, setAskedAboutClash] = useState<"asking" | "yes" | null>(null);
  const requestOf = (): ProspectRequest => ({
      fullName: draft.fullName,
      clientType: draft.clientType,
      email: email || null,
      phone: phone || null,
      country: draft.country || null,
      source: draft.source || null,
      referredBy: draft.referredBy.trim() || null,
      assignedTo: draft.assignedTo || null,
      nextFollowUp: draft.nextFollowUp || null,
      notes: draft.notes.trim() || null,
      doNotEmail: draft.doNotEmail,
      // Money comes in only through the wealth accumulation (23 Nov 2026), so no expected amount is asked here.
      expectedAum: null,
      expectedCurrency: null,
      // Not asked when adding (24 Nov 2026), of a person or an entity: meetings are planned and recorded on the
      // prospect's Meetings tab, and the stage follows from them.
      meetingStage: null,
      plannedMeeting: null,
      firstMeeting: null,
  });
  // A draft (22 Nov 2026): kept with a name at least, finished later. Only a new prospect or a draft can be one.
  const mayDraft = !editing || editing.prospect.status === "DRAFT";
  const saveDraft = (then?: () => void) => {
    if (!draft.fullName.trim()) {
      setErrors({ fullName: "Enter their name to save a draft." });
      return;
    }
    const options = { onSuccess: then };
    if (editing) update.mutate({ id: editing.prospect.id, data: requestOf(), params: { draft: true } }, options);
    else add.mutate({ data: requestOf(), params: { draft: true } }, options);
  };
  // Closing a new prospect with a name typed keeps it as a draft rather than losing it.
  const close = () => {
    if (!editing && draft.fullName.trim() && !busy) {
      closingAsDraft.current = true;
      saveDraft();
      return;
    }
    onClose();
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (duplicates.data?.prospectName && !duplicates.data.clientName && askedAboutClash !== "yes") {
      setAskedAboutClash("asking");
      return;
    }
    if (editing) update.mutate({ id: editing.prospect.id, data: requestOf() });
    else add.mutate({ data: requestOf() });
  };

  const clash = duplicates.data;
  return (
    <Dialog
      open={open}
      size="xl"
      title={editing ? `Edit ${editing.prospect.fullName}` : "Add Prospective Client"}
      onClose={close}
    >
      <form id="prospect-form" onSubmit={onSubmit} className="space-y-5">
        {/* Chosen when they are added; editing keeps it (23 Nov 2026). */}
        {!editing && (
        <Field id="prospect-type" label="Client type" required>
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
        )}

        {/* Wide rather than long (23 Nov 2026): name beside country, email beside phone. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="prospect-name" label={draft.clientType === "ENTITY" ? "Entity name" : "Name"} required error={errors.fullName}>
            <TextInput id="prospect-name" value={draft.fullName} onChange={(event) => set("fullName", event.target.value)} />
          </Field>
          <Field id="prospect-country" label="Country" error={errors.country}>
            <CountrySelect id="prospect-country" value={draft.country || null} placeholder="Not said" onChange={(code) => set("country", code)} />
          </Field>
        </div>

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
            <MobileNumberInput id="prospect-phone" value={draft.phone} onChange={(value) => set("phone", value)} />
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

        {/* Source and Referred by are no longer asked (23 Nov 2026); an RM adding one is its relationship manager. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="prospect-assigned" label="Relationship manager" error={errors.assignedTo}>
            {onlyMine ? (
              <TextInput id="prospect-assigned" value={`${user.fullName} (you)`} disabled />
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
              // Today or later (23 Nov 2026); an overdue date already set stays shown until it is changed.
              min={new Date()}
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
          {/* Signed by whoever writes them, when the form is saved (23 Nov 2026). */}
          {draft.notes.trim() !== "" && <span className="mt-1 block"><SigningAs name={user.fullName} /></span>}
        </Field>

        {!editing && draft.clientType === "ENTITY" && <StagedParties value={staged} onChange={setStaged} />}
        {editing && draft.clientType === "ENTITY" && (
          <p className="text-xs text-ink-muted">Directors, owners, UBOs and signatories are kept in the prospect's Stakeholders section.</p>
        )}

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
          <Button variant="secondary" onClick={close}>Cancel</Button>
          {mayDraft && (
            <Button variant="secondary" disabled={busy} onClick={() => saveDraft()}>Save as draft</Button>
          )}
          <Button type="submit" disabled={busy || Boolean(clash?.clientName)}>
            {savingPeople ? "Saving people…" : editing?.prospect.status === "DRAFT" ? "Complete and save" : editing ? "Save changes" : "Add prospect"}
          </Button>
        </div>
      </form>
      <Dialog open={askedAboutClash === "asking"} onClose={() => setAskedAboutClash(null)} title="Duplicate prospect detected"
        description={`${clash?.prospectName ?? "Another prospect"} (${clash?.prospectReference ?? ""}) already has this email or phone. Do you want to continue?`}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAskedAboutClash(null)}>Cancel</Button>
          <Button onClick={() => {
            setAskedAboutClash("yes");
            requestAnimationFrame(() => document.querySelector<HTMLFormElement>("form#prospect-form")?.requestSubmit());
          }}>Continue</Button>
        </div>
      </Dialog>
    </Dialog>
  );
}
