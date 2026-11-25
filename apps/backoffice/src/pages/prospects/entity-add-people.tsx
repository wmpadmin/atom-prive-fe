import { type DetailRow, type PartiesView, type PartyRequest } from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { MobileNumberInput } from "../../components/mobile-number-input";
import { toFormErrors } from "../../lib/api-errors";
import type { PartiesApi } from "./entity-parties";

type RoleKey = "director" | "owner" | "ubo" | "trust";

const ROLE_LIST: { key: RoleKey; label: string; one: string }[] = [
  { key: "director", label: "Director", one: "director" },
  { key: "owner", label: "Owners", one: "owner" },
  { key: "ubo", label: "UBO", one: "UBO" },
  // A trust that owns part of the entity (25 Nov 2026): its name and its share, nothing else. Its trustees, settlor and
  // beneficiaries are people, added under Owners or UBO.
  { key: "trust", label: "Trust", one: "trust" },
];

/** The roles a person holds; a trust is not one of them. */
type PersonRole = Exclude<RoleKey, "trust">;

type Person = {
  key: string; name: string; email: string; phone: string; method: string; details: Record<string, string>;
  /** How much of the entity they own, in % (23 Nov 2026); optional. */
  share: string;
  /** Ticked on the person (23 Nov 2026): may sign for the entity. Not a role of its own. */
  signatory: boolean;
};

let made = 0;
const blankPerson = (): Person => ({ key: `p-${++made}`, name: "", email: "", phone: "", method: "", details: {}, share: "", signatory: false });

/** The details Entity details asked for sets for a role, and for a signatory where the person is one. */
function detailsFor(role: PersonRole, signatory: boolean, all: DetailRow[]) {
  return all.filter((one) => !one.retired && ((role === "director" ? one.forDirector : one.forOwner) || (signatory && one.forSignatory)));
}

/**
 * Adding an entity's people (23 Nov 2026): tick the roles, then name everyone under each, with how to reach them and the
 * details their role asks for (passport, PAN and the like, as set under Entity details asked for). The same name under
 * two roles is one person with both.
 */
export function AddPeopleDialog({ api, view, onClose }: { api: PartiesApi; view: PartiesView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Record<RoleKey, Person[] | null>>({ director: null, owner: null, ubo: null, trust: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const methods = view.settings.contactMethods.filter((one) => !one.retired);

  const toggle = (role: RoleKey, on: boolean) => setRoles((was) => ({ ...was, [role]: on ? (was[role] ?? [blankPerson()]) : null }));
  const change = (role: RoleKey, key: string, patch: Partial<Person>) =>
    setRoles((was) => ({ ...was, [role]: (was[role] ?? []).map((one) => (one.key === key ? { ...one, ...patch } : one)) }));
  const add = (role: RoleKey) => setRoles((was) => ({ ...was, [role]: [...(was[role] ?? []), blankPerson()] }));
  const drop = (role: RoleKey, key: string) => setRoles((was) => ({ ...was, [role]: (was[role] ?? []).filter((one) => one.key !== key) }));

  // Everyone named, one entry per name: the same name under two roles is one person with both roles. A trust is its own.
  const merged = () => {
    const byName = new Map<string, { body: PartyRequest; label: string }>();
    for (const one of roles.trust ?? []) {
      const name = one.name.trim();
      if (!name) continue;
      byName.set(`trust:${name.toLowerCase().replace(/\s+/g, " ")}`, {
        label: name,
        body: {
          kind: "TRUST", fullName: name, director: false, owner: true, ubo: false, signatory: false, ownedThrough: null,
          sharePercent: one.share.trim() ? Number(one.share) : null, email: null, phone: null, contactMethodId: null, details: {},
        },
      });
    }
    for (const { key: role } of ROLE_LIST) {
      if (role === "trust") continue;
      for (const one of roles[role] ?? []) {
        const name = one.name.trim();
        if (!name) continue;
        const id = name.toLowerCase().replace(/\s+/g, " ");
        const was = byName.get(id)?.body;
        const body: PartyRequest = was ?? {
          kind: "PERSON", fullName: name, director: false, owner: false, ubo: false, signatory: false, ownedThrough: null,
          sharePercent: null, email: null, phone: null, contactMethodId: null, details: {},
        };
        body[role] = true;
        body.signatory = body.signatory || one.signatory;
        body.email = body.email || one.email.trim() || null;
        body.phone = body.phone || one.phone.trim() || null;
        body.contactMethodId = body.contactMethodId || one.method || null;
        if (body.sharePercent == null && one.share.trim()) body.sharePercent = Number(one.share);
        for (const [detail, value] of Object.entries(one.details)) {
          if (value.trim() && !(body.details ?? {})[detail]) body.details = { ...(body.details ?? {}), [detail]: value.trim() };
        }
        byName.set(id, { body, label: name });
      }
    }
    return [...byName.values()];
  };
  const people = merged();

  async function save() {
    setErrors({});
    setProblem(undefined);
    const wrong: Record<string, string> = {};
    if (!ROLE_LIST.some(({ key }) => roles[key])) wrong.roles = "Tick at least one role.";
    // A trust gives its name and the share it owns, as the server asks.
    for (const one of roles.trust ?? []) {
      const share = Number(one.share);
      if (!one.name.trim()) wrong[`${one.key}.name`] = "Enter the trust's name.";
      if (!one.share.trim()) wrong[`${one.key}.share`] = "Enter the share this trust owns.";
      else if (!(share > 0 && share <= 100)) wrong[`${one.key}.share`] = "Between 0 and 100.";
    }
    for (const { key: role } of ROLE_LIST) {
      if (role === "trust") continue;
      for (const one of roles[role] ?? []) {
        if (!one.name.trim()) wrong[`${one.key}.name`] = "Enter their name.";
        if (!one.email.trim()) wrong[`${one.key}.email`] = "Enter their email.";
        if (!one.phone.trim()) wrong[`${one.key}.phone`] = "Enter their phone number.";
        const share = Number(one.share);
        if (one.share.trim() && !(share > 0 && share <= 100)) wrong[`${one.key}.share`] = "Between 0 and 100.";
        for (const detail of detailsFor(role, one.signatory, view.settings.details).filter((d) => d.required)) {
          if (!(one.details[detail.id] ?? "").trim()) wrong[`${one.key}.${detail.id}`] = `Enter their ${detail.name.toLowerCase()}.`;
        }
      }
    }
    if (Object.keys(wrong).length) {
      setErrors(wrong);
      return;
    }
    setSaving(true);
    const done: string[] = [];
    try {
      for (const one of people) {
        try {
          queryClient.setQueryData(api.key, await api.add(one.body));
          done.push(one.label);
        } catch (caught) {
          const read = toFormErrors(caught);
          throw new Error(`${one.label}: ${read.form ?? Object.values(read.fields).join(" ")}`);
        }
      }
      onClose();
    } catch (caught) {
      setProblem(`${done.length ? `Added ${done.join(", ")}. ` : ""}${caught instanceof Error ? caught.message : "It couldn't be saved."}`);
      setRoles((was) => Object.fromEntries(Object.entries(was).map(([role, list]) =>
        [role, list ? list.filter((one) => !done.some((name) => name.toLowerCase() === one.name.trim().toLowerCase())) : list])) as typeof was);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open size="lg" onClose={onClose} title="Add stakeholder" description="Directors, owners, UBOs and trusts, with their details. Tick Authorised signatory on whoever may sign.">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {problem && <Alert tone="danger">{problem}</Alert>}
        <fieldset>
          <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Roles <span aria-hidden="true" className="text-red-600">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {ROLE_LIST.map(({ key, label }) => (
              <label key={key} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                roles[key] ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line hover:border-primary-300")}>
                <input type="checkbox" checked={Boolean(roles[key])} onChange={(event) => toggle(key, event.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles}</p>}
        </fieldset>

        {ROLE_LIST.filter(({ key }) => roles[key]).map(({ key: role, label, one: singular }) => {
          return (
            <section key={role} className="space-y-3 border-t border-line pt-4">
              <h3 className="text-sm font-bold">{label}</h3>
              {(roles[role] ?? []).map((person, i) => {
                if (role === "trust") {
                  return (
                    <div key={person.key} className="space-y-3 rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink-muted">Trust {i + 1}</p>
                        {(roles.trust ?? []).length > 1 && (
                          <button type="button" aria-label={`Remove trust ${i + 1}`} onClick={() => drop(role, person.key)}
                            className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"><X aria-hidden="true" className="size-4" /></button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id={`${person.key}-name`} label="Name of the trust" required error={errors[`${person.key}.name`]}>
                          <TextInput id={`${person.key}-name`} value={person.name} maxLength={300}
                            onChange={(event) => change(role, person.key, { name: event.target.value })} />
                        </Field>
                        <Field id={`${person.key}-share`} label="Owns (% of the entity)" required error={errors[`${person.key}.share`]}>
                          <TextInput id={`${person.key}-share`} inputMode="decimal" value={person.share} placeholder="70"
                            onChange={(event) => change(role, person.key, { share: event.target.value.replace(/[^0-9.]/g, "") })} />
                        </Field>
                      </div>
                      <p className="text-xs text-ink-muted">Its trustees, settlor and beneficiaries are added as people, under Owners or UBO.</p>
                    </div>
                  );
                }
                const asked = detailsFor(role, person.signatory, view.settings.details);
                return (
                <div key={person.key} className="space-y-3 rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-muted">{label === "UBO" ? "UBO" : singular.charAt(0).toUpperCase() + singular.slice(1)} {i + 1}</p>
                    {(roles[role] ?? []).length > 1 && (
                      <button type="button" aria-label={`Remove ${singular} ${i + 1}`} onClick={() => drop(role, person.key)}
                        className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-700"><X aria-hidden="true" className="size-4" /></button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={`${person.key}-name`} label="Name" required error={errors[`${person.key}.name`]}>
                      <TextInput id={`${person.key}-name`} value={person.name} maxLength={300}
                        onChange={(event) => change(role, person.key, { name: event.target.value })} />
                    </Field>
                    <Field id={`${person.key}-phone`} label="Phone" required error={errors[`${person.key}.phone`]}>
                      <MobileNumberInput id={`${person.key}-phone`} value={person.phone} onChange={(value) => change(role, person.key, { phone: value })} />
                    </Field>
                    <Field id={`${person.key}-email`} label="Email" required error={errors[`${person.key}.email`]}>
                      <TextInput id={`${person.key}-email`} type="email" value={person.email}
                        onChange={(event) => change(role, person.key, { email: event.target.value })} />
                    </Field>
                    <Field id={`${person.key}-method`} label="Prefers to be contacted by">
                      <SelectInput id={`${person.key}-method`} value={person.method} onChange={(event) => change(role, person.key, { method: event.target.value })}>
                        <option value="">Not said</option>
                        {methods.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                  {asked.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {asked.map((detail) => (
                          <Field key={detail.id} id={`${person.key}-${detail.id}`} label={detail.name} required={detail.required}
                            error={errors[`${person.key}.${detail.id}`]}>
                            <TextInput id={`${person.key}-${detail.id}`} value={person.details[detail.id] ?? ""} maxLength={200}
                              onChange={(event) => change(role, person.key, { details: { ...person.details, [detail.id]: event.target.value.toUpperCase() } })} />
                          </Field>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid items-end gap-3 sm:grid-cols-2">
                    <Field id={`${person.key}-share`} label="Owns (% of the entity)" error={errors[`${person.key}.share`]}>
                      <TextInput id={`${person.key}-share`} inputMode="decimal" value={person.share} placeholder="40"
                        onChange={(event) => change(role, person.key, { share: event.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium">
                      <input type="checkbox" checked={person.signatory}
                        onChange={(event) => change(role, person.key, { signatory: event.target.checked })} />
                      Authorised signatory
                    </label>
                  </div>
                </div>
                );
              })}
              <button type="button" onClick={() => add(role)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
                <Plus aria-hidden="true" className="size-4" />Add another {singular}
              </button>
            </section>
          );
        })}
        {people.length > 0 && ROLE_LIST.filter(({ key }) => key !== "trust" && roles[key]).length > 1 && (
          <p className="text-xs text-ink-muted">The same name under two roles is saved as one person with both roles.</p>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Adding…" : people.length > 1 ? `Add ${people.length} stakeholders` : "Add stakeholder"}
        </Button>
      </div>
    </Dialog>
  );
}
