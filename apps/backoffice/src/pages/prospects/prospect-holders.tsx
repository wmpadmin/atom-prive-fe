import { ApiError } from "@atomprive/api-client";
import { MobileNumberInput } from "../../components/mobile-number-input";
import {
  addProspectHolder,
  changeProspectHolder,
  getListProspectHoldersQueryKey,
  removeProspectHolder,
  useListProspectHolders,
  type HolderRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Avatar, Button, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { useRelationshipTypes } from "../../lib/relationship-types";
import { FamilyStructure } from "../clients/family-group-view";

/**
 * A joint prospect's account holders (23 Nov 2026): the prospect is the main holder, and anyone else who will hold the
 * account is named here with a way to reach them. Converting registers each of them, and each hands in their own
 * documents before Compliance; their full details come after onboarding.
 *
 * <p>Laid out as a client's Family group tab is (24 Nov 2026): the account's structure as a tree (or a list), every card
 * the same size, the line between holders named "joint holder"; then the holders in a table, with Add holder above it.
 */
export function ProspectHolders({ prospectId, mainName, mainEmail, mainPhone, mayChange }: {
  prospectId: string;
  mainName: string;
  mainEmail: string | null;
  mainPhone: string | null;
  mayChange: boolean;
}) {
  const holders = useListProspectHolders<HolderRow[], ApiError>(prospectId);
  const queryClient = useQueryClient();
  const { labelFor } = useRelationshipTypes();
  const [editing, setEditing] = useState<HolderRow | "new" | null>(null);
  const rows = holders.data ?? [];
  const refresh = (next: HolderRow[]) => queryClient.setQueryData(getListProspectHoldersQueryKey(prospectId), next);
  const remove = (one: HolderRow) => void removeProspectHolder(prospectId, one.id).then(refresh);
  return (
    <div className="space-y-5">
      <FamilyStructure
        title="Account structure"
        tree={
          <div className="overflow-x-auto py-4">
            <div className="mx-auto flex w-max items-center">
              <HolderCard name={mainName} badge="Primary holder" />
              {rows.map((one) => (
                <Fragment key={one.id}>
                  <JointLine />
                  <HolderCard name={one.fullName} badge="Joint holder" />
                </Fragment>
              ))}
            </div>
          </div>
        }
        list={
          <ul className="divide-y divide-line">
            {[{ id: "main", fullName: mainName, role: "Primary holder" },
              ...rows.map((one) => ({ id: one.id, fullName: one.fullName, role: one.relationship ? `Joint holder · ${labelFor(one.relationship)}` : "Joint holder" }))]
              .map((one) => (
                <li key={one.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={one.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{one.fullName}</span>
                    <span className="block truncate text-xs text-ink-muted">{one.role}</span>
                  </span>
                </li>
              ))}
          </ul>
        }
      />

      <section aria-labelledby="holders-title" className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h2 id="holders-title" className="text-lg font-bold">Account holders ({1 + rows.length})</h2>
          {mayChange && rows.length < 3 && (
            <Button variant="secondary" onClick={() => setEditing("new")}><Plus aria-hidden="true" />Add holder</Button>
          )}
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="rounded-l-lg px-4 py-2.5 text-left">Member</th>
                <th className="px-4 py-2.5 text-left">Relationship</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Phone</th>
                <th className="rounded-r-lg px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <HolderRowLine name={mainName} note="This prospect" relationship="Primary holder" email={mainEmail} phone={mainPhone} />
              {rows.map((one) => (
                <HolderRowLine key={one.id} name={one.fullName}
                  relationship={one.relationship ? `Joint holder · ${labelFor(one.relationship)}` : "Joint holder"}
                  email={one.email ?? null} phone={one.phone ?? null}
                  actions={mayChange && (
                    <span className="inline-flex gap-0.5">
                      <button type="button" aria-label={`Change ${one.fullName}`} onClick={() => setEditing(one)}
                        className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil aria-hidden="true" className="size-4" /></button>
                      <button type="button" aria-label={`Remove ${one.fullName}`} onClick={() => remove(one)}
                        className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-red-700"><Trash2 aria-hidden="true" className="size-4" /></button>
                    </span>
                  )} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <HolderDialog prospectId={prospectId} editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)} onSaved={(next) => { refresh(next); setEditing(null); }} />
      )}
    </div>
  );
}

/** One holder in the table, as a family member's row is drawn. */
function HolderRowLine({ name, note, relationship, email, phone, actions }: {
  name: string;
  note?: string;
  relationship: string;
  email: string | null;
  phone: string | null;
  actions?: ReactNode;
}) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <span className="flex items-center gap-3">
          <Avatar name={name} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            {note && <span className="block text-xs text-ink-muted">{note}</span>}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm">{relationship}</td>
      <td className="px-4 py-3 text-sm">{email ?? <span className="text-ink-muted">—</span>}</td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">{phone ?? <span className="text-ink-muted">—</span>}</td>
      <td className="px-4 py-3 text-right">{actions}</td>
    </tr>
  );
}

function HolderDialog({ prospectId, editing, onClose, onSaved }: {
  prospectId: string;
  editing: HolderRow | null;
  onClose: () => void;
  onSaved: (next: HolderRow[]) => void;
}) {
  const { inUse } = useRelationshipTypes();
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [relationship, setRelationship] = useState(editing?.relationship ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save() {
    setErrors({});
    const body = { fullName, relationship: relationship || null, email: email || null, phone: phone || null };
    try {
      onSaved(editing ? await changeProspectHolder(prospectId, editing.id, body) : await addProspectHolder(prospectId, body));
    } catch (caught) {
      const said = toFormErrors(caught);
      setErrors({ ...said.fields, ...(said.form ? { form: said.form } : {}) });
    }
  }
  return (
    <Dialog open onClose={onClose} title={editing ? "Change the holder" : "Add a joint holder"} description="Their name and a way to reach them. The rest of their details are entered after onboarding.">
      <div className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="holder-name" label="Full name" required error={errors.fullName}>
          <TextInput id="holder-name" value={fullName} maxLength={200} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field id="holder-relationship" label="Relationship to the main holder">
          <SelectInput id="holder-relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)}>
            <option value="">Not said</option>
            {inUse.map((one) => <option key={one.code} value={one.code}>{one.name}</option>)}
          </SelectInput>
        </Field>
        {/* A way to reach them is required (24 Nov 2026): either one, so both carry the mark and the line says so. */}
        <div className="space-y-1.5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="holder-email" label="Email" required error={errors.email}>
              <TextInput id="holder-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field id="holder-phone" label="Phone" required error={errors.phone}>
              <MobileNumberInput id="holder-phone" value={phone} onChange={setPhone} />
            </Field>
          </div>
          <p className="text-xs text-ink-muted">An email or a phone number: one of the two is enough.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()}>{editing ? "Save" : "Add holder"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** One holder, as a card of the family tree (24 Nov 2026): their name and whether primary or joint, every card alike. */
function HolderCard({ name, badge }: { name: string; badge: string }) {
  return (
    <div className="w-60 shrink-0 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3.5 shadow-sm">
      <span className="flex items-center gap-3">
        <Avatar name={name} className="size-11 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-base font-bold">{name}</span>
          <span className="mt-1 inline-block rounded-md bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>
        </span>
      </span>
    </div>
  );
}

/** The line between two holders, named for what joins them. */
function JointLine() {
  return (
    <span aria-hidden="true" className="relative flex w-20 shrink-0 items-center self-center">
      <span className="h-0.5 w-full bg-primary-400" />
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full border border-line bg-white px-2 py-0.5 text-2xs font-semibold whitespace-nowrap text-ink-muted">
        joint holder
      </span>
    </span>
  );
}
