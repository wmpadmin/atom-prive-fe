import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getListClientHoldingsQueryKey,
  useChangeClientHolding,
  useListClientHoldings,
  useRecordClientHolding,
  useRemoveClientHolding,
  type ClientHoldings,
  type PositionRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { useAssetClasses } from "./asset-classes";
import { underManagementLabel } from "./portfolio-labels";
import { asFigure } from "../../lib/figures";

/** Where the sub-class is left blank, the holdings still need a heading to sit under. */
const UNGROUPED = "Not grouped";

/**
 * What a client actually holds: asset class, then sub-class, then the holdings themselves — the three levels
 * the firm's own review opens downward through.
 *
 * <p>A class written down this way takes its total from its lines, so the figure and the holdings can never
 * disagree. A class nobody has broken down keeps the single figure somebody typed, and says so.
 */
export function ClientHoldingsPanel({ customerId, onChanged }: { customerId: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const held = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PositionRow | "new" | null>(null);
  const [removing, setRemoving] = useState<PositionRow | null>(null);

  const kept = () => {
    void queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) });
    onChanged();
  };
  const remove = useRemoveClientHolding<ApiError>({ mutation: { onSuccess: () => { kept(); setRemoving(null); } } });

  if (held.isError) return <Alert tone="danger">{held.error.message}</Alert>;

  const classes = held.data?.classes ?? [];
  const currency = held.data?.currency ?? "USD";
  const toggle = (key: string) =>
    setOpened((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Holdings</h3>
          <p className="text-xs text-ink-muted">
            Asset class, then sub-class, then the holdings. A class written down here takes its total from
            its lines.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          Add a holding
        </Button>
      </div>

      {held.data && held.data.unplaced > 0 && (
        <Alert tone="info">
          {underManagementLabel(held.data.unplaced, currency)} sits in classes nobody has broken down yet —
          a single figure each, with no holdings under them.
        </Alert>
      )}

      {held.isPending ? (
        <p className="py-6 text-center text-sm text-ink-muted">Reading what the client holds…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-ink-muted">
          Nothing is written down yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {classes.map((one) => {
            const classKey = one.assetClass;
            const isOpen = opened.has(classKey);
            return (
              <li key={classKey}>
                <button
                  type="button"
                  onClick={() => one.heldAsPositions && toggle(classKey)}
                  disabled={!one.heldAsPositions}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm",
                    one.heldAsPositions ? "hover:bg-slate-50/60" : "cursor-default",
                  )}
                >
                  {one.heldAsPositions ? (
                    isOpen ? (
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                    )
                  ) : (
                    <span aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 font-semibold">
                    {/* Named by the API from the firm's own list; the code stands in for one it has since taken off. */}
                    {one.assetClassName || one.assetClass}
                  </span>
                  {!one.heldAsPositions && (
                    <span className="text-2xs tracking-wider text-ink-muted uppercase">No holdings listed</span>
                  )}
                  <span className="tabular-nums">{underManagementLabel(one.valueAmount, currency)}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-line bg-slate-50/40 px-4 py-2">
                    {one.subClasses.map((group) => (
                      <div key={group.subClass ?? UNGROUPED} className="py-1.5">
                        <p className="flex items-baseline justify-between gap-3 text-xs font-semibold text-ink-soft">
                          <span>{group.subClass ?? UNGROUPED}</span>
                          <span className="tabular-nums text-ink-muted">
                            {underManagementLabel(group.valueAmount, currency)} · {group.shareOfClass.toFixed(1)}% of
                            the class
                          </span>
                        </p>
                        <ul className="mt-1 divide-y divide-line/70">
                          {group.positions.map((position) => (
                            <li key={position.id} className="flex items-center gap-3 py-1.5 text-sm">
                              <span className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => setEditing(position)}
                                  className="block truncate text-left font-medium text-primary-700 hover:underline"
                                >
                                  {position.name}
                                </button>
                                <span className="block truncate text-xs text-ink-muted">
                                  {[position.identifier, position.issuer, position.countryCode, position.sector, position.creditRating]
                                    .filter(Boolean)
                                    .join(" · ") || "No issuer recorded"}
                                </span>
                              </span>
                              <span className="whitespace-nowrap tabular-nums">
                                {underManagementLabel(position.valueAmount, currency)}
                              </span>
                              <span className="w-16 text-right text-xs whitespace-nowrap tabular-nums text-ink-muted">
                                {position.shareOfPortfolio.toFixed(1)}%
                              </span>
                              <button
                                type="button"
                                onClick={() => setRemoving(position)}
                                aria-label={`Remove ${position.name}`}
                                className="rounded p-1 text-ink-muted hover:text-rose-700"
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <HoldingDialog
          customerId={customerId}
          position={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            kept();
            setEditing(null);
          }}
        />
      )}

      {removing && (
        <Dialog open title={`Remove ${removing.name}?`} onClose={() => setRemoving(null)}>
          <div className="space-y-4">
            <p className="text-sm text-ink">
              The class total goes back to what its remaining holdings come to. Taking the last one off leaves
              the class at nothing rather than at whatever figure was typed before it was broken down.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRemoving(null)} disabled={remove.isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ customerId, id: removing.id })}
              >
                {remove.isPending ? "Removing…" : "Remove it"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function HoldingDialog({
  customerId,
  position,
  onClose,
  onSaved,
}: {
  customerId: string;
  position: PositionRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const assetClasses = useAssetClasses();
  // A holding already filed under a class keeps it, even one the firm has since retired; a new one starts
  // at the first class still in use rather than at a name compiled in here.
  const [assetClass, setAssetClass] = useState<string>(
    position?.assetClass ?? assetClasses.inUse[0]?.code ?? "",
  );
  const [subClass, setSubClass] = useState(position?.subClass ?? "");
  const [name, setName] = useState(position?.name ?? "");
  const [identifier, setIdentifier] = useState(position?.identifier ?? "");
  const [issuer, setIssuer] = useState(position?.issuer ?? "");
  const [countryCode, setCountryCode] = useState(position?.countryCode ?? "");
  const [sector, setSector] = useState(position?.sector ?? "");
  const [yieldPercent, setYield] = useState(position?.yieldPercent == null ? "" : String(position.yieldPercent));
  const [duration, setDuration] = useState(position?.durationYears == null ? "" : String(position.durationYears));
  const [creditRating, setCreditRating] = useState(position?.creditRating ?? "");
  const [valueAmount, setValueAmount] = useState(position ? String(position.valueAmount) : "");
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: a short window puts the first fields above the fold.
  useShowFirstError(errors, form);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useRecordClientHolding<ApiError>({ mutation: { onSuccess: onSaved, onError } });
  const change = useChangeClientHolding<ApiError>({ mutation: { onSuccess: onSaved, onError } });
  const busy = create.isPending || change.isPending;
  // Letters in a figure box are not a small mistake to round away: nothing is saved until it is a number.
  const readable = valueAmount.trim() !== "" && Number.isFinite(Number(valueAmount)) && Number(valueAmount) >= 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(noErrors);
    const data = {
      assetClass,
      subClass: subClass.trim() || null,
      name: name.trim(),
      identifier: identifier.trim() || null,
      issuer: issuer.trim() || null,
      countryCode: countryCode.trim() || null,
      sector: sector.trim() || null,
      // A yield and a duration belong to debt; the API drops them from anything else in any case.
      yieldPercent: yieldPercent.trim() === "" ? null : Number(yieldPercent),
      durationYears: duration.trim() === "" ? null : Number(duration),
      creditRating: creditRating.trim() || null,
      valueAmount: Number(valueAmount),
    };
    if (position) change.mutate({ customerId, id: position.id, data });
    else create.mutate({ customerId, data });
  }

  return (
    <Dialog open title={position ? `Edit ${position.name}` : "Add a holding"} size="lg" onClose={onClose}>
      <form ref={form} onSubmit={submit} className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="holding-class" label="Asset class" required error={errors.fields.assetClass}>
            <SelectInput
              id="holding-class"
              value={assetClass}
              // A holding is in one class: moving it is taking it off one and writing it under the other.
              disabled={position !== null}
              onChange={(event) => setAssetClass(event.target.value)}
            >
              {classesOffered(assetClasses, position?.assetClass).map((one) => (
                <option key={one} value={one}>
                  {assetClasses.names[one] ?? one}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field
            id="holding-subclass"
            label="Sub-class"
            hint="What the firm calls the group, such as US Equities — S&P 500."
            error={errors.fields.subClass}
          >
            <TextInput id="holding-subclass" value={subClass} onChange={(e) => setSubClass(e.target.value)} />
          </Field>
        </div>
        <Field id="holding-name" label="Holding" required error={errors.fields.name}>
          <TextInput
            {...describedBy("holding-name", errors.fields.name)}
            id="holding-name"
            placeholder="Apple Inc"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="holding-id" label="ISIN or ticker" error={errors.fields.identifier}>
            <TextInput id="holding-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </Field>
          <Field
            id="holding-issuer"
            label="Issuer"
            hint="Who the money is actually with. Two holdings from the same house are one exposure."
            error={errors.fields.issuer}
          >
            <TextInput id="holding-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="holding-country" label="Country" hint="Two-letter code." error={errors.fields.countryCode}>
            <TextInput
              id="holding-country"
              maxLength={2}
              placeholder="US"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
            />
          </Field>
          {/* What a plan's sector targets are read against. Nothing for cash, which is in no sector. */}
          <Field
            id="holding-sector"
            label="Sector"
            hint="What line of business it is in."
            error={errors.fields.sector}
          >
            <TextInput
              id="holding-sector"
              maxLength={60}
              placeholder="Technology"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
            />
          </Field>
          <Field
            id="holding-rating"
            label="Credit rating"
            hint="Fixed income only."
            error={errors.fields.creditRating}
          >
            <TextInput
              id="holding-rating"
              maxLength={8}
              placeholder="AA−"
              value={creditRating}
              disabled={assetClass !== "FIXED_INCOME"}
              onChange={(event) => setCreditRating(event.target.value)}
            />
          </Field>
          {/* What the bond yields at today's price, and how far it moves when rates do. Debt only: an equity
              has neither, and the API drops them from anything that is not debt in any case. */}
          <Field
            id="holding-yield"
            label="Yield"
            hint="Fixed income only."
            error={errors.fields.yieldPercent}
          >
            <TextInput
              id="holding-yield"
              inputMode="decimal"
              placeholder="4.25"
              value={yieldPercent}
              disabled={assetClass !== "FIXED_INCOME"}
              onChange={(event) => setYield(asFigure(event.target.value, yieldPercent))}
            />
          </Field>
          <Field
            id="holding-duration"
            label="Duration"
            hint="In years. Fixed income only."
            error={errors.fields.durationYears}
          >
            <TextInput
              id="holding-duration"
              inputMode="decimal"
              placeholder="6.1"
              value={duration}
              disabled={assetClass !== "FIXED_INCOME"}
              onChange={(event) => setDuration(asFigure(event.target.value, duration))}
            />
          </Field>
          <Field id="holding-value" label="Worth" required error={errors.fields.valueAmount}>
            <TextInput
              {...describedBy("holding-value", errors.fields.valueAmount)}
              id="holding-value"
              inputMode="decimal"
              value={valueAmount}
              onChange={(event) => setValueAmount(event.target.value)}
            />
          </Field>
        </div>
        {valueAmount.trim() !== "" && !readable && (
          <p className="text-xs text-rose-700">What a holding is worth is a number, and not less than nothing.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || !readable || busy}>
            {busy ? "Saving…" : position ? "Save the holding" : "Add it"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The classes this holding may sit in: the ones still in use, plus the one it is already filed under. A line
 * written before a class was retired keeps naming it rather than quietly reading as something else.
 */
function classesOffered(assetClasses: ReturnType<typeof useAssetClasses>, held: string | undefined): string[] {
  const codes = assetClasses.inUse.map((one) => one.code);
  return held && !codes.includes(held) ? [held, ...codes] : codes;
}
