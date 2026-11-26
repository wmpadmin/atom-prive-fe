import { ApiError } from "@atomprive/api-client";
import { MobileNumberInput } from "../../components/mobile-number-input";
import { useGetPartySettings, type PartySettings } from "@atomprive/api-client/backoffice";
import {
  addOnboardingParty,
  addProspectParty,
  getListOnboardingPartiesQueryKey,
  getListProspectPartiesQueryKey,
  removeOnboardingParty,
  removeProspectParty,
  updateOnboardingParty,
  updateProspectParty,
  useCheckProspectDuplicates,
  useListOnboardingParties,
  useListProspectParties,
  type DetailRow,
  type PartiesView,
  type PartyRequest,
  type PartyRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Landmark, Pencil, Plus, Trash2, User } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { AddPeopleDialog } from "./entity-add-people";

/**
 * The people and owners behind an entity prospect (22 Nov 2026): directors, owners, ultimate beneficial owners and
 * authorised signatories, and the trusts and companies an owner holds through, trusts of trusts included. Read as a
 * list or as a graph of who owns whom; "Owns over" 15, 25, 50 or 75% keeps the people who own more than that of the entity
 * through every layer, and the trusts and companies they hold through. Details only, never documents.
 */

type Role = "ALL" | "DIRECTOR" | "OWNER" | "UBO";

const ROLES: { id: Role; label: string; has: (one: PartyRow) => boolean }[] = [
  { id: "ALL", label: "Everyone", has: () => true },
  { id: "DIRECTOR", label: "Directors", has: (one) => one.director },
  { id: "OWNER", label: "Owners", has: (one) => one.owner },
  { id: "UBO", label: "UBOs", has: (one) => one.ubo },
];

const KIND_LABEL: Record<PartyRow["kind"], string> = { PERSON: "Person", TRUST: "Entity", COMPANY: "Company" };

const OVER = 25;

/** The ownership lines the Owns over filter offers (23 Nov 2026). */
const LINES = [15, 25, 50, 75];

function percent(value: number | null | undefined) {
  if (value == null) return "";
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** A person's roles; the graph and the flow chart leave Authorised signatory out (23 Nov 2026). */
function rolesOf(one: PartyRow, signatory = true) {
  const roles: string[] = [];
  if (one.kind !== "PERSON") roles.push(KIND_LABEL[one.kind]);
  if (one.ubo) roles.push("UBO");
  else if (one.owner && one.kind === "PERSON") roles.push("Owner");
  if (one.director) roles.push("Director");
  if (signatory && one.signatory) roles.push("Authorised signatory");
  return roles.join(" · ");
}

/** The required details a party should have given and has not, as Entity details asked for sets them. */
export function missingDetails(one: PartyRow, details: DetailRow[]) {
  return details.filter((detail) => !detail.retired && detail.required && (one.kind === "PERSON"
    ? (one.director && detail.forDirector) || ((one.owner || one.ubo) && detail.forOwner) || (one.signatory && detail.forSignatory)
    : detail.forHolding) && !(one.details[detail.id] ?? "").trim());
}

/** Whoever owns more than the line (a quarter unless said) of the entity, and every trust and company above them on the way. */
function overTheLine(parties: PartyRow[], line = OVER) {
  const byId = new Map(parties.map((one) => [one.id, one]));
  const keep = new Set<string>();
  for (const one of parties) {
    if (one.kind === "PERSON" && (one.ofTheEntity ?? 0) > line) {
      keep.add(one.id);
      let up = one.ownedThrough;
      while (up && !keep.has(up)) {
        keep.add(up);
        up = byId.get(up)?.ownedThrough ?? null;
      }
    }
  }
  return keep;
}

/** Where the people are kept: on the prospect, or on the onboarding case it became (22 Nov 2026). */
export type PartiesApi = {
  key: readonly unknown[];
  add: (body: PartyRequest) => Promise<PartiesView>;
  update: (partyId: string, body: PartyRequest) => Promise<PartiesView>;
  remove: (partyId: string) => Promise<PartiesView>;
  /** The prospect itself, left out of the duplicate check of its own people. */
  prospectId?: string;
};

function partiesApi(prospectId: string | undefined, caseId: string | undefined): PartiesApi {
  if (caseId) {
    return {
      key: getListOnboardingPartiesQueryKey(caseId),
      add: (body) => addOnboardingParty(caseId, body),
      update: (partyId, body) => updateOnboardingParty(caseId, partyId, body),
      remove: (partyId) => removeOnboardingParty(caseId, partyId),
    };
  }
  const id = prospectId ?? "";
  return {
    key: getListProspectPartiesQueryKey(id),
    add: (body) => addProspectParty(id, body),
    update: (partyId, body) => updateProspectParty(id, partyId, body),
    remove: (partyId) => removeProspectParty(id, partyId),
    prospectId: id,
  };
}

export function EntityParties({ prospectId, caseId, mayChange, startOn = "list", entityName }: {
  prospectId?: string;
  caseId?: string;
  mayChange: boolean;
  /** Where it opens: the list, or the ownership graph where there is room for it (the prospect's own page). */
  startOn?: "list" | "graph" | "flow";
  /** The entity's own name, at the top of the flow chart; "The entity" when not known. */
  entityName?: string;
}) {
  const onProspect = useListProspectParties<PartiesView, ApiError>(prospectId ?? "", { query: { enabled: !caseId && Boolean(prospectId) } });
  const onCase = useListOnboardingParties<PartiesView, ApiError>(caseId ?? "", { query: { enabled: Boolean(caseId) } });
  const parties = caseId ? onCase : onProspect;
  const api = partiesApi(prospectId, caseId);
  const [mode, setMode] = useState<"list" | "graph" | "flow">(startOn);
  const [role, setRole] = useState<Role>("ALL");
  const [line, setLine] = useState<number | null>(null);
  const [editing, setEditing] = useState<PartyRow | "new" | null>(null);
  const [removing, setRemoving] = useState<PartyRow | null>(null);
  // Opened by clicking a name in the list or a box in the graph (22 Nov 2026).
  const [viewing, setViewing] = useState<PartyRow | null>(null);
  const queryClient = useQueryClient();
  const rows = useMemo(() => parties.data?.parties ?? [], [parties.data]);
  const overLine = useMemo(() => (line == null ? null : overTheLine(rows, line)), [rows, line]);
  const depth = useMemo(() => {
    const byId = new Map(rows.map((one) => [one.id, one]));
    return (one: PartyRow) => {
      let level = 0;
      let up = one.ownedThrough;
      while (up && level < 20) {
        level += 1;
        up = byId.get(up)?.ownedThrough ?? null;
      }
      return level;
    };
  }, [rows]);

  if (parties.isError) return <p className="text-sm text-red-700">The people and owners couldn't be loaded.</p>;
  if (!parties.data) return <p className="text-sm text-ink-muted">Loading the people and owners…</p>;
  const pick = ROLES.find((one) => one.id === role)!;
  const shown = rows.filter((one) => pick.has(one) && (!overLine || overLine.has(one.id)));
  const remove = async (one: PartyRow) => {
    const view = await api.remove(one.id);
    queryClient.setQueryData(api.key, view);
    setRemoving(null);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xs font-bold tracking-wider text-ink-muted uppercase">Stakeholders</h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label htmlFor="parties-role" className="text-xs font-semibold text-ink-muted">Show</label>
          <SelectInput id="parties-role" value={role} onChange={(event) => setRole(event.target.value as Role)}
            className="h-8 w-40 rounded-lg pr-8 pl-3 text-xs font-semibold">
            {ROLES.map((one) => (
              <option key={one.id} value={one.id}>{one.label} ({rows.filter(one.has).length})</option>
            ))}
          </SelectInput>
          {/* Owns over (23 Nov 2026): only the people over the chosen share of the entity, through every trust and company. */}
          <label htmlFor="parties-owns-over" className="ml-1 text-xs font-semibold text-ink-muted">Owns over</label>
          <SelectInput id="parties-owns-over" value={line == null ? "" : String(line)} onChange={(event) => setLine(event.target.value ? Number(event.target.value) : null)}
            className="h-8 w-32 rounded-lg pr-8 pl-3 text-xs font-semibold">
            <option value="">Any</option>
            {LINES.map((one) => (
              <option key={one} value={one}>&gt; {one}% ({rows.filter((row) => row.kind === "PERSON" && (row.ofTheEntity ?? 0) > one).length})</option>
            ))}
          </SelectInput>
          <div role="tablist" aria-label="How to show them" className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
            {(["list", "graph", "flow"] as const).map((one) => (
              <button key={one} type="button" role="tab" aria-selected={mode === one} onClick={() => setMode(one)}
                className={cn("rounded-md px-2.5 py-1", mode === one ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:text-ink")}>
                {one === "list" ? "List" : one === "graph" ? "Graph" : "Flow chart"}
              </button>
            ))}
          </div>
          {mayChange && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden="true" />
              Add stakeholder
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
          No directors, owners or signatories yet.
          {mayChange && " Add them one by one: people, and the trusts or companies an owner holds through."}
        </p>
      ) : mode === "flow" ? (
        <EntityFlowChart rows={rows} shown={new Set(shown.map((one) => one.id))} entityName={entityName} onOpen={setViewing} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {line != null ? `Nobody owns more than ${line}% of the entity.` : "Nobody in this group."}{" "}
          <button type="button" onClick={() => { setLine(null); setRole("ALL"); }} className="font-semibold text-primary-700 hover:underline">
            Show everyone
          </button>
        </p>
      ) : mode === "graph" ? (
        <OwnershipGraph rows={rows} shown={new Set(shown.map((one) => one.id))} onOpen={setViewing} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((one) => {
            const Icon = one.kind === "PERSON" ? User : one.kind === "TRUST" ? Landmark : Building2;
            return (
              <li key={one.id} className="flex items-start gap-3 py-2.5 text-sm" style={{ paddingLeft: `${Math.min(depth(one), 4) * 1.25}rem` }}>
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => setViewing(one)}
                      className="font-semibold text-ink hover:text-primary-700 hover:underline">{one.fullName}</button>
                    {missingDetails(one, parties.data.settings.details).length > 0 && (
                      <span title={`Missing: ${missingDetails(one, parties.data.settings.details).map((d) => d.name).join(", ")}`}
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800">
                        {missingDetails(one, parties.data.settings.details).length} required missing
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-ink-muted">{rolesOf(one)}</span>
                  {(one.email || one.phone || one.contactMethod) && (
                    <span className="block text-xs text-ink-muted">
                      {[one.email, one.phone, one.contactMethod && `Prefers ${one.contactMethod}`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {one.sharePercent != null && (
                  <span className="text-right whitespace-nowrap">
                    <span className="block font-semibold tabular-nums">{percent(one.sharePercent)}</span>
                    {one.ownedThrough && one.ofTheEntity != null && (
                      <span className="block text-2xs text-ink-muted tabular-nums">{percent(one.ofTheEntity)} of the entity</span>
                    )}
                  </span>
                )}
                {mayChange && (
                  <span className="flex shrink-0 gap-0.5">
                    <button type="button" aria-label={`Change ${one.fullName}`} onClick={() => setEditing(one)}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink">
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Remove ${one.fullName}`} onClick={() => setRemoving(one)}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-red-700">
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {rows.some((one) => one.ownedThrough) && mode === "list" && (
        <p className="text-2xs text-ink-muted">A share is of whatever is directly above; "of the entity" counts through every trust and company.</p>
      )}

      {editing === "new" && <AddPeopleDialog api={api} view={parties.data} onClose={() => setEditing(null)} />}
      {editing && editing !== "new" && (
        <PartyDialog api={api} view={parties.data} editing={editing} onClose={() => setEditing(null)} />
      )}
      {viewing && (
        <PartyDetails one={rows.find((r) => r.id === viewing.id) ?? viewing} rows={rows} details={parties.data.settings.details}
          mayChange={mayChange} onClose={() => setViewing(null)}
          onEdit={(one) => { setViewing(null); setEditing(one); }} />
      )}
      {removing && (
        <Dialog open onClose={() => setRemoving(null)} title={`Remove ${removing.fullName}?`}
          description={removing.kind === "PERSON" ? "They come off this entity's people and owners."
            : "Whoever owns a share through it moves up to own a share of what it owned."}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void remove(removing)}>Remove</Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

/**
 * Stakeholders held on the Add prospect form before the prospect exists (22 Nov 2026). Checked as the server
 * checks them, so what is added here saves without surprises once the prospect is: a role for a person, shares of
 * any one thing at most 100%, and nobody owning a share of themselves.
 */
export type StagedParty = PartyRow;

function ofTheEntityOf(rows: PartyRow[]): PartyRow[] {
  const byId = new Map(rows.map((one) => [one.id, one]));
  return rows.map((one) => {
    if (one.sharePercent == null) return { ...one, ofTheEntity: null };
    let held = one.sharePercent;
    let up = one.ownedThrough;
    const seen = new Set<string>();
    while (up && !seen.has(up)) {
      seen.add(up);
      const above = byId.get(up);
      if (!above || above.sharePercent == null) return { ...one, ofTheEntity: null };
      held = (held * above.sharePercent) / 100;
      up = above.ownedThrough;
    }
    return { ...one, ofTheEntity: Math.round(held * 100) / 100 };
  });
}

function refused(fields: Record<string, string>): never {
  throw new ApiError(400, { status: 400, detail: "Some fields need attention.", errors: fields });
}

function stagedRow(id: string, body: PartyRequest, settings: PartySettings): PartyRow {
  const person = body.kind === "PERSON";
  return {
    id, kind: body.kind, fullName: body.fullName.trim(), director: person && body.director, owner: !person || body.owner,
    ubo: person && body.ubo, signatory: person && body.signatory, ownedThrough: body.ownedThrough ?? null,
    sharePercent: body.sharePercent ?? null, ofTheEntity: null, email: body.email ?? null, phone: body.phone ?? null,
    contactMethodId: body.contactMethodId ?? null,
    contactMethod: settings.contactMethods.find((one) => one.id === body.contactMethodId)?.name ?? null,
    details: body.details ?? {},
  };
}

function checkStaged(body: PartyRequest, id: string, rows: PartyRow[]) {
  const wrong: Record<string, string> = {};
  if (!body.fullName.trim()) wrong.fullName = "Enter their name.";
  const person = body.kind === "PERSON";
  if (person && !(body.email ?? "").trim()) wrong.email = "Enter their email.";
  if (person && !(body.phone ?? "").trim()) wrong.phone = "Enter their phone number.";
  if (person && !body.director && !body.owner && !body.ubo && !body.signatory) wrong.roles = "Choose at least one role.";
  if (!person && body.sharePercent == null) wrong.sharePercent = "Enter the share it owns.";
  if (body.sharePercent != null && (body.sharePercent <= 0 || body.sharePercent > 100)) wrong.sharePercent = "A share is more than 0% and at most 100%.";
  if (body.ownedThrough) {
    let up: string | null = body.ownedThrough;
    while (up) {
      if (up === id) { wrong.ownedThrough = `That would have ${body.fullName.trim()} owning a share of itself.`; break; }
      up = rows.find((one) => one.id === up)?.ownedThrough ?? null;
    }
  }
  if (body.sharePercent != null && !wrong.sharePercent && !wrong.ownedThrough) {
    const taken = rows.filter((one) => one.id !== id && (one.ownedThrough ?? null) === (body.ownedThrough ?? null))
      .reduce((sum, one) => sum + (one.sharePercent ?? 0), 0);
    if (taken + body.sharePercent > 100) {
      const of = body.ownedThrough ? rows.find((one) => one.id === body.ownedThrough)?.fullName : "the entity";
      wrong.sharePercent = `Only ${+(100 - taken).toFixed(2)}% of ${of} is left to own.`;
    }
  }
  if (Object.keys(wrong).length) refused(wrong);
}

export function StagedParties({ value, onChange }: { value: StagedParty[]; onChange: (next: StagedParty[]) => void }) {
  const settings = useGetPartySettings<PartySettings, ApiError>();
  const [editing, setEditing] = useState<PartyRow | "new" | null>(null);
  // The list as it stands after each add: Add stakeholder saves several people one after another, and each must see
  // the ones before it, or only the last is kept (23 Nov 2026).
  const latest = useRef(value);
  latest.current = value;
  if (!settings.data) return <p className="text-sm text-ink-muted">Loading…</p>;
  const data = settings.data;
  const rows = ofTheEntityOf(value);
  const keep = (next: StagedParty[]) => {
    latest.current = next;
    onChange(next);
  };
  const view: PartiesView = { entity: true, parties: rows, settings: data };
  const api: PartiesApi = {
    key: ["staged-parties"],
    add: async (body) => {
      const id = `staged-${crypto.randomUUID()}`;
      checkStaged(body, id, latest.current);
      const next = [...latest.current, stagedRow(id, body, data)];
      keep(next);
      return { ...view, parties: ofTheEntityOf(next) };
    },
    update: async (partyId, body) => {
      checkStaged(body, partyId, latest.current);
      const next = latest.current.map((one) => (one.id === partyId ? stagedRow(partyId, body, data) : one));
      keep(next);
      return { ...view, parties: ofTheEntityOf(next) };
    },
    remove: async (partyId) => {
      const gone = latest.current.find((one) => one.id === partyId);
      const next = latest.current.filter((one) => one.id !== partyId)
        .map((one) => (one.ownedThrough === partyId ? { ...one, ownedThrough: gone?.ownedThrough ?? null } : one));
      keep(next);
      return { ...view, parties: ofTheEntityOf(next) };
    },
  };
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-2xs font-bold tracking-wider text-ink-muted uppercase">Stakeholders (optional)</legend>
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add stakeholder
        </Button>
      </div>
      <p className="text-xs text-ink-muted">Directors, owners, UBOs and authorised signatories, and any trust or company an owner holds through. Saved with the prospect; more can be added later.</p>
      {rows.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((one) => (
            <li key={one.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{one.fullName}</span>
                <span className="block text-xs text-ink-muted">
                  {[rolesOf(one), one.ownedThrough ? `of ${rows.find((up) => up.id === one.ownedThrough)?.fullName}` : null,
                    one.contactMethod && `Prefers ${one.contactMethod}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {one.sharePercent != null && (
                <span className="text-right text-xs whitespace-nowrap tabular-nums">
                  <span className="block font-semibold">{percent(one.sharePercent)}</span>
                  {one.ownedThrough && one.ofTheEntity != null && <span className="block text-ink-muted">{percent(one.ofTheEntity)} of entity</span>}
                </span>
              )}
              <button type="button" aria-label={`Change ${one.fullName}`} onClick={() => setEditing(one)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink">
                <Pencil aria-hidden="true" className="size-3.5" />
              </button>
              <button type="button" aria-label={`Remove ${one.fullName}`} onClick={() => void api.remove(one.id)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-red-700">
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        // Inside the prospect's own form: Enter in one of these fields must not add the prospect.
        <div onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") event.preventDefault(); }}>
          {editing === "new" ? <AddPeopleDialog api={api} view={view} onClose={() => setEditing(null)} />
            : <PartyDialog api={api} view={view} editing={editing} onClose={() => setEditing(null)} />}
        </div>
      )}
    </fieldset>
  );
}

/** Saves staged people onto the prospect just added, each owner after what it owns a share of. */
export async function saveStaged(prospectId: string, staged: StagedParty[]): Promise<string[]> {
  const real = new Map<string, string>();
  const failed: string[] = [];
  const placed = new Set<string>();
  const order: StagedParty[] = [];
  const place = (one: StagedParty) => {
    if (placed.has(one.id)) return;
    const up = staged.find((other) => other.id === one.ownedThrough);
    if (up) place(up);
    placed.add(one.id);
    order.push(one);
  };
  staged.forEach(place);
  for (const one of order) {
    try {
      const view = await addProspectParty(prospectId, {
        kind: one.kind, fullName: one.fullName, director: one.director, owner: one.owner, ubo: one.ubo, signatory: one.signatory,
        ownedThrough: one.ownedThrough ? (real.get(one.ownedThrough) ?? null) : null, sharePercent: one.sharePercent,
        email: one.email, phone: one.phone, contactMethodId: one.contactMethodId, details: one.details,
      });
      const saved = [...view.parties].reverse().find((row) => row.fullName === one.fullName);
      if (saved) real.set(one.id, saved.id);
    } catch {
      failed.push(one.fullName);
    }
  }
  return failed;
}

/** One person, trust or company opened from the list or the graph: everything kept about them, read-only. */
function PartyDetails({ one, rows, details, mayChange, onClose, onEdit }: {
  one: PartyRow;
  rows: PartyRow[];
  details: DetailRow[];
  mayChange: boolean;
  onClose: () => void;
  onEdit: (one: PartyRow) => void;
}) {
  const above = one.ownedThrough ? rows.find((r) => r.id === one.ownedThrough) : null;
  const below = rows.filter((r) => r.ownedThrough === one.id);
  // Only what was filled in (23 Nov 2026): nothing empty, nothing marked missing.
  const given = details.filter((d) => (one.details[d.id] ?? "").trim() !== "");
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  );
  const none = <span className="text-ink-muted">—</span>;
  return (
    <Dialog open onClose={onClose} title={one.fullName} description={one.kind === "PERSON" ? rolesOf(one) : KIND_LABEL[one.kind]}>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
          {one.kind !== "PERSON" && <Row label="Is a">{KIND_LABEL[one.kind]}</Row>}
          {one.kind === "PERSON" && <Row label="Roles">{rolesOf(one) || none}</Row>}
          {one.sharePercent != null && (
            <Row label="Owns">
              {percent(one.sharePercent)} of {above ? above.fullName : "the entity"}
              {above && one.ofTheEntity != null && <span className="text-ink-muted"> · {percent(one.ofTheEntity)} of the entity</span>}
            </Row>
          )}
          {below.length > 0 && <Row label="Owned by">{below.map((b) => `${b.fullName} (${percent(b.sharePercent)})`).join(", ")}</Row>}
          {one.email && <Row label="Email">{one.email}</Row>}
          {one.phone && <Row label="Phone">{one.phone}</Row>}
          {one.contactMethod && <Row label="Prefers to be contacted by">{one.contactMethod}</Row>}
          {given.map((d) => <Row key={d.id} label={d.name}>{(one.details[d.id] ?? "").trim()}</Row>)}
        </dl>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {mayChange && <Button onClick={() => onEdit(one)}><Pencil aria-hidden="true" />Edit</Button>}
      </div>
    </Dialog>
  );
}

/** Who owns whom, the entity at the top and every owner below what they own a share of. */
function OwnershipGraph({ rows, shown, onOpen }: { rows: PartyRow[]; shown: Set<string>; onOpen: (one: PartyRow) => void }) {
  const owners = rows.filter((one) => one.sharePercent != null);
  const others = rows.filter((one) => one.sharePercent == null && shown.has(one.id) && rolesOf(one, false));
  const W = 150;
  const H = 46;
  const GAP_X = 18;
  const GAP_Y = 54;
  // Lay each owner out under what they own: a subtree is as wide as its leaves.
  const children = new Map<string | null, PartyRow[]>();
  for (const one of owners) {
    const key = one.ownedThrough && owners.some((o) => o.id === one.ownedThrough) ? one.ownedThrough : null;
    children.set(key, [...(children.get(key) ?? []), one]);
  }
  const width = (id: string | null): number => {
    const under = children.get(id) ?? [];
    return under.length === 0 ? 1 : under.reduce((sum, one) => sum + width(one.id), 0);
  };
  const placed: { one: PartyRow; x: number; y: number; parentX: number; parentY: number }[] = [];
  const lay = (id: string | null, left: number, level: number, px: number, py: number) => {
    let at = left;
    for (const one of children.get(id) ?? []) {
      const span = width(one.id);
      const x = (at + span / 2) * (W + GAP_X) - (W + GAP_X) / 2;
      const y = (level + 1) * (H + GAP_Y);
      placed.push({ one, x, y, parentX: px, parentY: py });
      lay(one.id, at, level + 1, x, y);
      at += span;
    }
  };
  const total = width(null);
  const rootX = (total / 2) * (W + GAP_X) - (W + GAP_X) / 2;
  lay(null, 0, 0, rootX, 0);
  const viewWidth = Math.max(total * (W + GAP_X), W + GAP_X);
  const viewHeight = (Math.max(0, ...placed.map((p) => p.y)) + H) + 8;
  // Theme colours, so the boxes read in light and dark alike; the edge says person or trust/company.
  const tone = (one: PartyRow) => (one.kind === "PERSON" ? "fill-white stroke-violet-400" : "fill-white stroke-teal-500");

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-white p-2">
        <svg viewBox={`-4 -4 ${viewWidth + 8} ${viewHeight + 8}`} width={viewWidth + 8} height={viewHeight + 8}
          className="mx-auto block max-w-none"
          role="img" aria-label="Who owns the entity, through which trusts and companies">
          {placed.map(({ one, x, y, parentX, parentY }) => (
            <g key={`edge-${one.id}`} className={shown.has(one.id) ? undefined : "opacity-25"}>
              <line x1={x + W / 2} y1={y} x2={parentX + W / 2} y2={parentY + H} className="stroke-line" strokeWidth={1.5} />
              <text x={(x + parentX) / 2 + W / 2 + 4} y={(y + parentY + H) / 2 + 4} className="fill-ink-soft text-[11px] font-semibold">
                {percent(one.sharePercent)}
              </text>
            </g>
          ))}
          <g>
            <rect x={rootX} y={0} width={W} height={H} rx={8} className="fill-canvas stroke-ink-muted" strokeWidth={1.5} />
            <text x={rootX + W / 2} y={28} textAnchor="middle" className="fill-ink text-[12px] font-bold">The entity</text>
          </g>
          {placed.map(({ one, x, y }) => (
            <g key={one.id} className={cn("cursor-pointer", !shown.has(one.id) && "opacity-25")} role="button" tabIndex={0}
              aria-label={`Open ${one.fullName}`} onClick={() => onOpen(one)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(one); } }}>
              <title>{`${one.fullName} · ${rolesOf(one, false)}${one.ofTheEntity != null ? ` · ${percent(one.ofTheEntity)} of the entity` : ""}`}</title>
              <rect x={x} y={y} width={W} height={H} rx={8} className={tone(one)} strokeWidth={1.5} />
              <text x={x + W / 2} y={y + 19} textAnchor="middle" className="fill-ink text-[12px] font-bold">
                {one.fullName.length > 20 ? `${one.fullName.slice(0, 19)}…` : one.fullName}
              </text>
              <text x={x + W / 2} y={y + 35} textAnchor="middle" className="fill-ink-muted text-[10.5px]">
                {one.ownedThrough && one.ofTheEntity != null
                  ? `${percent(one.sharePercent)} · ${percent(one.ofTheEntity)} of entity`
                  : (one.kind === "PERSON" ? rolesOf(one, false) : KIND_LABEL[one.kind]).slice(0, 26)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="text-2xs text-ink-muted">
        Each line carries the share of what is directly above; "of entity" counts through every trust and company.
      </figcaption>
      {others.length > 0 && (
        <p className="text-xs text-ink-soft">
          <span className="font-semibold">Own no share:</span>{" "}
          {others.map((one, i) => (
            <span key={one.id}>
              {i > 0 && ", "}
              <button type="button" onClick={() => onOpen(one)} className="font-medium text-ink hover:text-primary-700 hover:underline">{one.fullName}</button>
              {` (${rolesOf(one, false)})`}
            </span>
          ))}
        </p>
      )}
    </figure>
  );
}

/**
 * The entity as a flow chart (23 Nov 2026): the entity at the top, then its directors and its owners side by side
 * (authorised signatories left out of it, 23 Nov 2026). Owners run down through every trust and company to the people at the end, each with
 * their share; the same person shows in every branch they belong to. A branch with nobody in it says so.
 */
function EntityFlowChart({ rows, shown, entityName, onOpen }: {
  rows: PartyRow[];
  shown: Set<string>;
  entityName?: string;
  onOpen: (one: PartyRow) => void;
}) {
  const W = 168;
  const H = 50;
  const GAP_X = 16;
  const GAP_Y = 46;
  const STACK = 12;
  const COL = 36;
  const HEAD = 34;
  const byId = new Map(rows.map((one) => [one.id, one]));
  // Each person once, under the role ticked (23 Nov 2026): UBOs holds those ticked UBO; Owners those ticked Owner, and
  // trusts and companies; a director with a share stays under Directors with the share under the name.
  const ubos = rows.filter((one) => one.kind === "PERSON" && one.ubo);
  const owners = rows.filter((one) => !ubos.includes(one)
    && (one.kind !== "PERSON" || one.owner || (one.sharePercent != null && !one.director)));
  const allDirectors = rows.filter((one) => one.kind === "PERSON" && one.director);
  const directors = allDirectors.filter((one) => !owners.includes(one) && !ubos.includes(one));
  const ownerIds = new Set(owners.map((one) => one.id));
  const children = new Map<string | null, PartyRow[]>();
  for (const one of owners) {
    const key = one.ownedThrough && ownerIds.has(one.ownedThrough) ? one.ownedThrough : null;
    children.set(key, [...(children.get(key) ?? []), one]);
  }
  const span = (id: string | null, seen = new Set<string>()): number => {
    const under = (children.get(id) ?? []).filter((one) => !seen.has(one.id));
    if (under.length === 0) return 1;
    return under.reduce((sum, one) => sum + span(one.id, new Set([...seen, one.id])), 0);
  };
  const ownersWide = Math.max(1, span(null)) * (W + GAP_X) - GAP_X;
  const cols = { directors: 0, owners: W + COL, ubos: W + COL + ownersWide + COL };
  const total = cols.ubos + W;
  const entityW = Math.max(W + 40, Math.min(320, (entityName ?? "The entity").length * 8 + 40));
  const entityX = total / 2 - entityW / 2;
  const busY = H + 22;
  const headY = busY + 20;
  const firstY = headY + HEAD + 28;
  const heads = [
    { key: "directors", label: `Directors (${allDirectors.length})`, x: cols.directors, w: W },
    { key: "owners", label: `Owners (${owners.filter((one) => one.kind === "PERSON").length} people)`, x: cols.owners, w: ownersWide },
    { key: "ubos", label: `UBOs (${ubos.length})`, x: cols.ubos, w: W },
  ];

  type Box = { one: PartyRow; x: number; y: number; sub: string; key: string };
  const boxes: Box[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number; label?: string; dim: boolean }[] = [];
  // Only the roles ticked show (23 Nov 2026): owning over 25% does not make anyone a UBO here.
  const isUbo = (one: PartyRow) => one.kind === "PERSON" && one.ubo;
  const stack = (list: PartyRow[], x: number, branch: string) => list.forEach((one, i) => {
    const y = firstY + i * (H + STACK);
    boxes.push({ one, x, y, key: `${branch}-${one.id}`, sub: [one.sharePercent != null ? percent(one.ofTheEntity ?? one.sharePercent) : null, isUbo(one) && branch !== "u" ? "UBO" : null,
      one.owner && branch !== "o" ? "Owner" : null, one.director && branch !== "d" ? "Director" : null].filter(Boolean).join(" · ") });
    lines.push({ x1: x + W / 2, y1: i === 0 ? headY + HEAD : y - STACK, x2: x + W / 2, y2: y, dim: !shown.has(one.id) });
  });
  stack(directors, cols.directors, "d");
  stack(ubos, cols.ubos, "u");
  const subOf = (one: PartyRow) => {
    if (one.kind !== "PERSON") return `${KIND_LABEL[one.kind]}${one.sharePercent != null ? ` · owns ${percent(one.sharePercent)}` : ""}`;
    const above = one.ownedThrough ? byId.get(one.ownedThrough) : undefined;
    const share = one.ofTheEntity ?? (above ? null : one.sharePercent);
    const parts = [share != null ? (above ? `${percent(share)} via ${KIND_LABEL[above.kind].toLowerCase()}` : percent(share)) : null,
      isUbo(one) ? "UBO" : one.sharePercent == null ? "Owner" : null, one.director ? "Director" : null];
    return parts.filter(Boolean).join(" · ");
  };
  const lay = (id: string | null, left: number, level: number, px: number, py: number, seen: Set<string>) => {
    let at = left;
    for (const one of (children.get(id) ?? []).filter((o) => !seen.has(o.id))) {
      const wide = span(one.id, new Set([...seen, one.id]));
      const x = cols.owners + at * (W + GAP_X) + (wide * (W + GAP_X) - GAP_X) / 2 - W / 2;
      const y = firstY + level * (H + GAP_Y);
      boxes.push({ one, x, y, key: `o-${one.id}`, sub: subOf(one) });
      lines.push({ x1: x + W / 2, y1: y, x2: px, y2: py, label: id ? percent(one.sharePercent) : undefined, dim: !shown.has(one.id) });
      lay(one.id, at, level + 1, x + W / 2, y + H, new Set([...seen, one.id]));
      at += wide;
    }
  };
  // Top-level owners hang off a short bar under the Owners heading, deeper ones off what they own a share of.
  lay(null, 0, 0, cols.owners + ownersWide / 2, headY + HEAD, new Set());
  const empties = heads.filter((head) => (head.key === "directors" ? directors : head.key === "owners" ? owners : ubos).length === 0);
  const bottom = Math.max(firstY + H, ...boxes.map((box) => box.y + H));
  const tone = (one: PartyRow) => (one.kind === "PERSON" ? "fill-white stroke-violet-400" : "fill-white stroke-teal-500");
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-white p-3">
        <svg viewBox={`-4 -4 ${total + 8} ${bottom + 12}`} width={total + 8} height={bottom + 12} className="mx-auto block max-w-none"
          role="img" aria-label="The entity's directors, and its owners through every trust and company">
          <line x1={total / 2} y1={H} x2={total / 2} y2={busY} className="stroke-line" strokeWidth={1.5} />
          <line x1={W / 2} y1={busY} x2={cols.ubos + W / 2} y2={busY} className="stroke-line" strokeWidth={1.5} />
          {heads.map((head) => (
            <line key={`bus-${head.key}`} x1={head.x + head.w / 2} y1={busY} x2={head.x + head.w / 2} y2={headY} className="stroke-line" strokeWidth={1.5} />
          ))}
          {lines.map((one, i) => (
            <g key={`line-${i}`} className={one.dim ? "opacity-25" : undefined}>
              {one.x2 === one.x1 ? (
                <line x1={one.x1} y1={one.y1} x2={one.x2} y2={one.y2} className="stroke-line" strokeWidth={1.5} />
              ) : (
                <path d={`M${one.x2} ${one.y2} V${(one.y1 + one.y2) / 2} H${one.x1} V${one.y1}`} fill="none" className="stroke-line" strokeWidth={1.5} />
              )}
              {one.label && (
                <text x={one.x1 + 6} y={one.y1 - 7} className="fill-ink-soft text-[11px] font-semibold">{one.label}</text>
              )}
            </g>
          ))}
          <g>
            <rect x={entityX} y={0} width={entityW} height={H} rx={8} className="fill-canvas stroke-ink-muted" strokeWidth={1.5} />
            <text x={total / 2} y={H / 2 + 4} textAnchor="middle" className="fill-ink text-[13px] font-bold">{clip(entityName || "The entity", 36)}</text>
          </g>
          {heads.map((head) => (
            <g key={head.key}>
              <rect x={head.x} y={headY} width={head.w} height={HEAD} rx={6} className="fill-canvas stroke-line" strokeWidth={1} />
              <text x={head.x + head.w / 2} y={headY + HEAD / 2 + 4} textAnchor="middle" className="fill-ink text-[12px] font-bold">{head.label}</text>
            </g>
          ))}
          {empties.map((head) => (
            <g key={`none-${head.key}`}>
              <line x1={head.x + head.w / 2} y1={headY + HEAD} x2={head.x + head.w / 2} y2={firstY} className="stroke-line" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={head.x + head.w / 2 - W / 2} y={firstY} width={W} height={H} rx={8} className="fill-none stroke-ink-muted" strokeWidth={1} strokeDasharray="4 3" />
              <text x={head.x + head.w / 2} y={firstY + H / 2 + 4} textAnchor="middle" className="fill-ink-muted text-[11.5px]">
                {head.key === "directors" && allDirectors.length > 0 ? "Shown in another branch"
                  : head.key === "owners" && rows.some((one) => one.owner) ? "Shown under UBOs" : "None added yet"}
              </text>
            </g>
          ))}
          {boxes.map(({ one, x, y, sub, key }) => (
            <g key={key} className={cn("cursor-pointer", !shown.has(one.id) && "opacity-25")} role="button" tabIndex={0}
              aria-label={`Open ${one.fullName}`} onClick={() => onOpen(one)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(one); } }}>
              <title>{`${one.fullName} · ${rolesOf(one, false)}${one.ofTheEntity != null ? ` · ${percent(one.ofTheEntity)} of the entity` : ""}`}</title>
              <rect x={x} y={y} width={W} height={H} rx={8} className={tone(one)} strokeWidth={1.5} />
              <text x={x + W / 2} y={sub ? y + 21 : y + H / 2 + 4} textAnchor="middle" className="fill-ink text-[12px] font-bold">{clip(one.fullName, 22)}</text>
              {sub && <text x={x + W / 2} y={y + 37} textAnchor="middle" className="fill-ink-muted text-[10.5px]">{clip(sub, 28)}</text>}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

/** One person, trust or company: who they are, what they own of what, how to reach them and the details asked of them. */
function PartyDialog({ api, view, editing, onClose }: {
  api: PartiesApi;
  view: PartiesView;
  editing: PartyRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PartyRow["kind"]>(editing?.kind ?? "PERSON");
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [director, setDirector] = useState(editing?.director ?? false);
  const [owner, setOwner] = useState(editing?.owner ?? false);
  const [ubo, setUbo] = useState(editing?.ubo ?? false);
  const [signatory, setSignatory] = useState(editing?.signatory ?? false);
  const [through, setThrough] = useState(editing?.ownedThrough ?? "");
  const [share, setShare] = useState(editing?.sharePercent != null ? String(editing.sharePercent) : "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [method, setMethod] = useState(editing?.contactMethodId ?? "");
  const [details, setDetails] = useState<Record<string, string>>({ ...(editing?.details ?? {}) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A message goes the moment its field is changed: it was about what was there before.
  const cleared = (...keys: string[]) => setErrors((was) => {
    if (!keys.some((key) => key in was)) return was;
    const next = { ...was };
    keys.forEach((key) => delete next[key]);
    return next;
  });
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Checked as they type, like the prospect's own email and phone: a warning, never a lock (22 Nov 2026).
  const typedEmail = email.trim();
  const typedPhone = phone.trim();
  const duplicates = useCheckProspectDuplicates(
    { email: typedEmail || undefined, phone: typedPhone || undefined, except: api.prospectId },
    { query: { enabled: typedEmail.length > 4 || typedPhone.replace(/\D/g, "").length > 6 } },
  );
  const clash = duplicates.data;
  const person = kind === "PERSON";
  const owns = !person || owner || ubo;
  // A holder can own through any trust or company of the entity but itself or anything under it.
  const below = useMemo(() => {
    const out = new Set<string>();
    if (!editing) return out;
    out.add(editing.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const one of view.parties) {
        if (one.ownedThrough && out.has(one.ownedThrough) && !out.has(one.id)) {
          out.add(one.id);
          grew = true;
        }
      }
    }
    return out;
  }, [editing, view.parties]);
  const holdings = view.parties.filter((one) => one.kind !== "PERSON" && !below.has(one.id));
  const asked = (one: DetailRow) => !one.retired && (person
    ? (director && one.forDirector) || ((owner || ubo) && one.forOwner) || (signatory && one.forSignatory)
    : one.forHolding);
  const fields = view.settings.details.filter((one) => asked(one) || (details[one.id] ?? "") !== "");
  const methods = view.settings.contactMethods.filter((one) => !one.retired || one.id === method);

  async function save() {
    setErrors({});
    setProblem(undefined);
    const body: PartyRequest = {
      kind, fullName, director: person && director, owner: !person || owner, ubo: person && ubo, signatory: person && signatory,
      ownedThrough: (owns || person) && through ? through : null,
      sharePercent: (owns || person) && share.trim() ? Number(share) : null,
      email: email.trim() || null, phone: phone.trim() || null, contactMethodId: method || null,
      details: Object.fromEntries(fields.map((one) => [one.id, details[one.id] ?? ""]).filter(([, value]) => value.trim() !== "")),
    };
    setSaving(true);
    try {
      const next = editing ? await api.update(editing.id, body) : await api.add(body);
      queryClient.setQueryData(api.key, next);
      onClose();
    } catch (caught) {
      const read = toFormErrors(caught);
      setErrors(read.fields);
      setProblem(read.form ?? (Object.keys(read.fields).length ? undefined : "It couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open size="lg" onClose={onClose} title={editing ? `Change ${editing.fullName}` : "Add stakeholder"}
      description={person ? undefined : "Details only. Documents are collected later."}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {problem && <Alert tone="danger">{problem}</Alert>}
        {/* A person is just a person (23 Nov 2026): the kind is asked only of a trust or company already added. */}
        {!person && (
          <Field id="party-kind" label="Is this a" required>
            <SelectInput id="party-kind" value={kind} onChange={(event) => { setKind(event.target.value as PartyRow["kind"]); cleared("kind", "roles", "sharePercent"); }}>
              <option value="TRUST">Trust</option>
              <option value="COMPANY">Company</option>
            </SelectInput>
          </Field>
        )}
        {person && (
          <fieldset>
            <legend className="mb-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Roles <span aria-hidden="true" className="text-red-600">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([["Director", director, setDirector], ["Owner", owner, setOwner], ["UBO", ubo, setUbo]] as const).map(([label, on, set]) => (
                <label key={label} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                  on ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line hover:border-primary-300")}>
                  <input type="checkbox" checked={on} onChange={(event) => { set(event.target.checked); cleared("roles", "sharePercent"); }} />
                  {label}
                </label>
              ))}
            </div>
            {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles}</p>}
          </fieldset>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="party-name" label={person ? "Name" : "Full name"} required error={errors.fullName}>
            <TextInput id="party-name" value={fullName} maxLength={300} aria-invalid={Boolean(errors.fullName) || undefined}
              onChange={(event) => { setFullName(event.target.value); cleared("fullName"); }} />
          </Field>
          <Field id="party-phone" label="Phone" required={person} error={errors.phone}>
            <MobileNumberInput id="party-phone" value={phone} onChange={(value) => { setPhone(value); cleared("phone"); }} />
          </Field>
          <Field id="party-email" label="Email" required={person} error={errors.email}>
            <TextInput id="party-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); cleared("email"); }} />
          </Field>
          <Field id="party-method" label="Prefers to be contacted by" error={errors.contactMethodId}>
            <SelectInput id="party-method" value={method} onChange={(event) => { setMethod(event.target.value); cleared("contactMethodId"); }}>
              <option value="">Not said</option>
              {methods.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
            </SelectInput>
          </Field>
        </div>
        {clash && (clash.clientName || clash.prospectName) && (
          <Alert tone="warning">
            {clash.clientName
              ? `${clash.clientName}, an existing client, has this email or phone.`
              : `${clash.prospectName} (${clash.prospectReference}), another prospect, has this email or phone.`} You can still save.
          </Alert>
        )}
        {!person && (
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field id="party-through" label="Owns a share of" error={errors.ownedThrough}>
              <SelectInput id="party-through" value={through} onChange={(event) => { setThrough(event.target.value); cleared("ownedThrough", "sharePercent"); }}>
                <option value="">The entity itself</option>
                {holdings.map((one) => <option key={one.id} value={one.id}>{one.fullName} ({KIND_LABEL[one.kind].toLowerCase()})</option>)}
              </SelectInput>
            </Field>
            <Field id="party-share" label="Share %" required error={errors.sharePercent}>
              <TextInput id="party-share" inputMode="decimal" value={share} aria-invalid={Boolean(errors.sharePercent) || undefined}
                onChange={(event) => { setShare(event.target.value.replace(/[^0-9.]/g, "")); cleared("sharePercent"); }} placeholder="40" />
            </Field>
          </div>
        )}
        {fields.length > 0 && (
          <div className="space-y-1">
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((one) => (
                <Field key={one.id} id={`party-detail-${one.id}`} label={one.name} required={one.required}>
                  <TextInput id={`party-detail-${one.id}`} value={details[one.id] ?? ""} maxLength={200}
                    onChange={(event) => { setDetails((was) => ({ ...was, [one.id]: event.target.value.toUpperCase() })); cleared("details"); }} />
                </Field>
              ))}
            </div>
            {errors.details && <p className="text-xs text-red-600">{errors.details}</p>}
          </div>
        )}
        {person && (
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <Field id="party-share" label="Owns (% of the entity)" error={errors.sharePercent}>
              <TextInput id="party-share" inputMode="decimal" value={share} aria-invalid={Boolean(errors.sharePercent) || undefined}
                onChange={(event) => { setShare(event.target.value.replace(/[^0-9.]/g, "")); cleared("sharePercent"); }} placeholder="40" />
            </Field>
            <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium">
              <input type="checkbox" checked={signatory} onChange={(event) => { setSignatory(event.target.checked); cleared("roles"); }} />
              Authorised signatory
            </label>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add"}</Button>
      </div>
    </Dialog>
  );
}
