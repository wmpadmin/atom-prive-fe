import { ApiError } from "@atomprive/api-client";
import {
  addOwnedAssetCategory,
  askToAddOwnedAsset,
  askToValueOwnedAsset,
  changeOwnedAssetDetails,
  getListOwnedAssetCategoriesQueryKey,
  useListOwnedAssetCategories,
  type OwnedAssetCategoryRow,
  type OwnedAssetChangeRow,
  type OwnedAssetRow,
  type OwnerShareRequest,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, Dialog, Field, SelectInput, TextArea, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { isoDay } from "./book-figures";

/** Somebody who may own part of an item: the client or a member of their family. */
export type Person = { id: string; name: string };

/** What a form sends back: the change asked for, or nothing where it was saved outright. */
type Done = (asked: OwnedAssetChangeRow | null) => void;

/** The earliest day a date here may be: an heirloom can be old, but not older than records go. */
const EARLIEST = new Date(1900, 0, 1);

/** Figures only, and one point. */
function asFigure(typed: string) {
  const kept = typed.replace(/[^0-9.]/g, "");
  return kept.split(".").length > 2 ? kept.slice(0, kept.lastIndexOf(".")) : kept;
}

const figureOrNull = (typed: string) => (typed.trim() === "" ? null : Number(typed));

function problem(caught: unknown) {
  return caught instanceof ApiError ? caught.message : "That could not be saved. Try again.";
}

/**
 * The category picker: the firm's list and the ones portfolio managers have added, with a way to add one more
 * at the end of it.
 */
function CategoryField({ id, value, onChange }: { id: string; value: string; onChange: (id: string) => void }) {
  const queryClient = useQueryClient();
  const listed = useListOwnedAssetCategories<OwnedAssetCategoryRow[], ApiError>({ query: { staleTime: 60_000 } });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await addOwnedAssetCategory({ name });
      await queryClient.invalidateQueries({ queryKey: getListOwnedAssetCategoriesQueryKey() });
      onChange(made.id);
      setAdding(false);
      setName("");
    } catch (caught) {
      setError(problem(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field id={id} label="Category" required error={error ?? undefined}>
      {adding ? (
        <div className="flex gap-2">
          <TextInput id={id} value={name} autoFocus placeholder="e.g. Indian modern art" maxLength={80}
            onChange={(event) => setName(event.target.value)} />
          <Button size="sm" disabled={busy || !name.trim()} onClick={() => void add()}>{busy ? "Adding…" : "Add"}</Button>
          <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setError(null); }}>Cancel</Button>
        </div>
      ) : (
        <SelectInput id={id} value={value} required
          onChange={(event) => (event.target.value === "+new" ? setAdding(true) : onChange(event.target.value))}>
          <option value="" disabled>Pick a category</option>
          {(listed.data ?? []).map((one) => (
            <option key={one.id} value={one.id}>{one.name}{one.addedBy ? " (added by the firm)" : ""}</option>
          ))}
          <option value="+new">+ New category</option>
        </SelectInput>
      )}
    </Field>
  );
}

/** Who owns how much: rows of a person and a share, which must come to 100%. */
function OwnersField({ people, owners, onChange }: { people: Person[]; owners: OwnerShareRequest[]; onChange: (owners: OwnerShareRequest[]) => void }) {
  const total = owners.reduce((sum, one) => sum + (Number(one.share) || 0), 0);
  const unused = people.filter((one) => !owners.some((owner) => owner.customerId === one.id));
  return (
    <Field id="owned-owners" label="Owners and share" required
      error={Math.abs(total - 100) > 0.001 ? `The shares come to ${total}%; they must come to 100%.` : undefined}>
      <div className="space-y-2">
        {owners.map((owner, index) => (
          <div key={owner.customerId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SelectInput aria-label="Owner" value={owner.customerId}
                onChange={(event) => onChange(owners.map((one, at) => (at === index ? { ...one, customerId: event.target.value } : one)))}>
                {people.filter((one) => one.id === owner.customerId || unused.includes(one)).map((one) => (
                  <option key={one.id} value={one.id}>{one.name}</option>
                ))}
              </SelectInput>
            </div>
            <TextInput aria-label="Share %" className="w-24 text-right" value={String(owner.share)}
              onChange={(event) => onChange(owners.map((one, at) => (at === index ? { ...one, share: Number(asFigure(event.target.value)) || 0 } : one)))} />
            <span className="text-sm text-ink-muted">%</span>
            {owners.length > 1 && (
              <button type="button" aria-label="Take this owner off" onClick={() => onChange(owners.filter((_, at) => at !== index))}
                className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-danger">
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        ))}
        {unused.length > 0 && (
          <button type="button" onClick={() => onChange([...owners, { customerId: unused[0]!.id, share: 0 }])}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
            <Plus aria-hidden="true" className="size-4" /> Add a family member
          </button>
        )}
      </div>
    </Field>
  );
}

/** A new item. Once the client has a portfolio it goes to their relationship manager first. */
export function AddItemDialog({ open, customerId, currency, people, asksFirst, onClose, onDone }: {
  open: boolean;
  customerId: string;
  currency: string;
  people: Person[];
  asksFirst: boolean;
  onClose: () => void;
  onDone: Done;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [acquiredOn, setAcquiredOn] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [value, setValue] = useState("");
  const [valuedOn, setValuedOn] = useState<string | null>(isoDay(new Date()));
  const [valuedBy, setValuedBy] = useState("");
  const [location, setLocation] = useState("");
  const [insured, setInsured] = useState("");
  const [owners, setOwners] = useState<OwnerShareRequest[]>(people[0] ? [{ customerId: people[0].id, share: 100 }] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() && categoryId && value.trim() && Math.abs(owners.reduce((sum, one) => sum + Number(one.share), 0) - 100) < 0.001;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const asked = await askToAddOwnedAsset(customerId, {
        name: name.trim(), description: description.trim() || null, categoryId, acquiredOn, cost: figureOrNull(cost),
        value: Number(value), valuedOn, valuedBy: valuedBy.trim() || null, location: location.trim() || null,
        insured: figureOrNull(insured), owners,
      });
      onDone(asked);
    } catch (caught) {
      setError(problem(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} size="lg" title="Add an item"
      description={asksFirst ? "Goes to the client's relationship manager to approve before it is on the list." : undefined}
      onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CategoryField id="owned-category" value={categoryId} onChange={setCategoryId} />
        <Field id="owned-name" label="Name" required>
          <TextInput id="owned-name" value={name} maxLength={200} placeholder="e.g. Patek Philippe 5711" onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="owned-description" label="Description" className="sm:col-span-2">
          <TextArea id="owned-description" rows={2} value={description} maxLength={2000} placeholder="Anything that tells it apart"
            onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field id="owned-acquired" label="Bought on">
          <DateInput id="owned-acquired" name="acquiredOn" min={EARLIEST} value={acquiredOn ?? undefined} clearable max={new Date()}
            onChange={(day) => setAcquiredOn(day ?? null)} />
        </Field>
        <Field id="owned-cost" label={`Cost (${currency})`}>
          <TextInput id="owned-cost" inputMode="decimal" value={cost} placeholder="Optional" onChange={(event) => setCost(asFigure(event.target.value))} />
        </Field>
        <Field id="owned-value" label={`Current value (${currency})`} required>
          <TextInput id="owned-value" inputMode="decimal" value={value} onChange={(event) => setValue(asFigure(event.target.value))} />
        </Field>
        <Field id="owned-valued-on" label="Valued on" required>
          <DateInput id="owned-valued-on" name="valuedOn" min={EARLIEST} value={valuedOn ?? undefined} max={new Date()} onChange={(day) => setValuedOn(day ?? null)} />
        </Field>
        <Field id="owned-valued-by" label="Valued by">
          <TextInput id="owned-valued-by" value={valuedBy} maxLength={200} placeholder="Optional, e.g. Christie's" onChange={(event) => setValuedBy(event.target.value)} />
        </Field>
        <Field id="owned-location" label="Location">
          <TextInput id="owned-location" value={location} maxLength={200} placeholder="Optional" onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field id="owned-insured" label={`Insured for (${currency})`}>
          <TextInput id="owned-insured" inputMode="decimal" value={insured} placeholder="Optional" onChange={(event) => setInsured(asFigure(event.target.value))} />
        </Field>
        <div className="sm:col-span-2">
          <OwnersField people={people} owners={owners} onChange={setOwners} />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Photos and documents are added from the item once it is on the list.</p>
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !ready} onClick={() => void save()}>
          {busy ? "Saving…" : asksFirst ? "Send for approval" : "Add item"}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * What an item is, saved at once; its cost and owners, where they change, go to the relationship manager.
 */
export function EditItemDialog({ open, customerId, currency, people, item, asksFirst, onClose, onDone }: {
  open: boolean;
  customerId: string;
  currency: string;
  people: Person[];
  item: OwnedAssetRow;
  asksFirst: boolean;
  onClose: () => void;
  onDone: Done;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [acquiredOn, setAcquiredOn] = useState<string | null>(item.acquiredOn);
  const [location, setLocation] = useState(item.location ?? "");
  const [insured, setInsured] = useState(item.insured === null ? "" : String(item.insured));
  const [cost, setCost] = useState(item.cost === null ? "" : String(item.cost));
  const [owners, setOwners] = useState<OwnerShareRequest[]>(item.owners.map((one) => ({ customerId: one.customerId, share: one.share })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() && categoryId && Math.abs(owners.reduce((sum, one) => sum + Number(one.share), 0) - 100) < 0.001;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await changeOwnedAssetDetails(customerId, item.id, {
        name: name.trim(), description: description.trim() || null, categoryId, acquiredOn, location: location.trim() || null,
        insured: figureOrNull(insured), cost: figureOrNull(cost), owners,
      });
      onDone(saved.asked);
    } catch (caught) {
      setError(problem(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} size="lg" title={`Edit ${item.name}`}
      description={asksFirst ? "Name, category, description, date bought, location and insurance save at once. A new cost or split between owners goes to the relationship manager." : undefined}
      onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CategoryField id="edit-category" value={categoryId} onChange={setCategoryId} />
        <Field id="edit-name" label="Name" required>
          <TextInput id="edit-name" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="edit-description" label="Description" className="sm:col-span-2">
          <TextArea id="edit-description" rows={2} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field id="edit-acquired" label="Bought on">
          <DateInput id="edit-acquired" name="acquiredOn" min={EARLIEST} value={acquiredOn ?? undefined} clearable max={new Date()} onChange={(day) => setAcquiredOn(day ?? null)} />
        </Field>
        <Field id="edit-location" label="Location">
          <TextInput id="edit-location" value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field id="edit-insured" label={`Insured for (${currency})`}>
          <TextInput id="edit-insured" inputMode="decimal" value={insured} onChange={(event) => setInsured(asFigure(event.target.value))} />
        </Field>
        <Field id="edit-cost" label={`Cost (${currency})`} hint={asksFirst ? "A change goes to the relationship manager." : undefined}>
          <TextInput id="edit-cost" inputMode="decimal" value={cost} onChange={(event) => setCost(asFigure(event.target.value))} />
        </Field>
        <div className="sm:col-span-2">
          <OwnersField people={people} owners={owners} onChange={setOwners} />
        </div>
      </div>
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !ready} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </Dialog>
  );
}

/** A new valuation. Who valued it is optional. */
export function ValuationDialog({ open, customerId, currency, item, asksFirst, onClose, onDone }: {
  open: boolean;
  customerId: string;
  currency: string;
  item: OwnedAssetRow;
  asksFirst: boolean;
  onClose: () => void;
  onDone: Done;
}) {
  const [valuedOn, setValuedOn] = useState<string | null>(isoDay(new Date()));
  const [value, setValue] = useState("");
  const [valuedBy, setValuedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!valuedOn) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await askToValueOwnedAsset(customerId, item.id, { valuedOn, value: Number(value), valuedBy: valuedBy.trim() || null }));
    } catch (caught) {
      setError(problem(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} title={`New valuation of ${item.name}`}
      description={asksFirst ? "Goes to the client's relationship manager to approve. Until then the item stays at its current value." : undefined}
      onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="value-on" label="Valued on" required>
          <DateInput id="value-on" name="valuedOn" min={EARLIEST} value={valuedOn ?? undefined} max={new Date()} onChange={(day) => setValuedOn(day ?? null)} />
        </Field>
        <Field id="value-amount" label={`Value (${currency})`} required>
          <TextInput id="value-amount" inputMode="decimal" value={value} onChange={(event) => setValue(asFigure(event.target.value))} />
        </Field>
        <Field id="value-by" label="Valued by" className="sm:col-span-2">
          <TextInput id="value-by" value={valuedBy} maxLength={200} placeholder="Optional" onChange={(event) => setValuedBy(event.target.value)} />
        </Field>
      </div>
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !value.trim() || !valuedOn} onClick={() => void save()}>
          {busy ? "Saving…" : asksFirst ? "Send for approval" : "Save valuation"}
        </Button>
      </div>
    </Dialog>
  );
}
