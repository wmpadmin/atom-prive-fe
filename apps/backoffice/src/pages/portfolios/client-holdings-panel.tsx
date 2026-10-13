import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getListClientHoldingsQueryKey,
  useChangeClientHolding,
  useListClientHoldings,
  useRecordClientHolding,
  useRemoveClientHolding,
  type ModelLine,
  type ClientHoldings,
  type PositionRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { useAssetClasses } from "./asset-classes";
import { driftLabel, standingLabels, standingTones, underManagementLabel } from "./portfolio-labels";
import { asFigure } from "../../lib/figures";

/** Where the sub-class is left blank, the holdings still need a heading to sit under. */
const UNGROUPED = "Not grouped";

/** The row that puts the box back, for a group the model does not name. Never a group's own name. */
const OTHER_GROUP = "\u0000other";

/**
 * What a client actually holds: asset class, then sub-class, then the holdings themselves — the three levels
 * the firm's own review opens downward through.
 *
 * <p>A class written down this way takes its total from its lines, so the figure and the holdings can never
 * disagree. A class nobody has broken down keeps the single figure somebody typed, and says so.
 */
export function ClientHoldingsPanel({
  customerId,
  onChanged,
  onTouched,
  addingFor = null,
  onAddingHandled,
  against = null,
  readOnly = false,
}: {
  customerId: string;
  onChanged: () => void;
  /**
   * A holding this panel has just touched, with what it looked like beforehand — null where it did not
   * exist, because it was being added.
   *
   * <p>The page keeps the first of these per holding, so Discard can put the portfolio back as it stood
   * when Edit was pressed, however the change was made.
   */
  onTouched?: (id: string, before: PositionRow | null) => void;
  /**
   * A class the page has asked to write a holding under, so the dialog opens on it without anybody scrolling
   * down to find this panel. Cleared through onAddingHandled once the dialog is open.
   */
  addingFor?: string | null;
  onAddingHandled?: () => void;
  /** A model picked on screen but not saved, whose groups these holdings should be offered against. */
  against?: string | null;
  /** Read somewhere other than the portfolio screen, where writing them down is not the job. */
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  // Read against the model picked on screen where one is, rather than the one on file: somebody setting a
  // client up picks the model and then writes the holdings into its groups, and the groups have to be the
  // ones they are looking at.
  const held = useListClientHoldings<ClientHoldings, ApiError>(
    customerId,
    against ? { against } : undefined,
  );
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PositionRow | "new" | null>(null);
  /** The class a new holding opens on, where this panel's own button was the one pressed. */
  const [newFor, setNewFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PositionRow | null>(null);

  // The dialog is open because this panel was asked to open it, or because the page was: worked out as it
  // renders rather than copied into state by an effect, which would render twice to say the same thing.
  const open = editing ?? (addingFor === null ? null : "new");
  const startOn = editing === "new" ? newFor : addingFor;
  const closeDialog = () => {
    setEditing(null);
    setNewFor(null);
    onAddingHandled?.();
  };

  const kept = () => {
    void queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) });
    onChanged();
  };
  const remove = useRemoveClientHolding<ApiError>({
    mutation: {
      onSuccess: (_result, sent) => {
        // What it was before it went, so Discard can put it back. The row is gone from the server now.
        if (removing && removing.id === sent.id) onTouched?.(removing.id, removing);
        kept();
        setRemoving(null);
      },
    },
  });

  // A client with nothing written down yet is an ordinary state, not a failure. Shown as one, it put a
  // red banner across the portfolio page of every client whose holdings nobody had typed in.
  if (held.isError && held.error.status !== 404) {
    return <Alert tone="danger">{held.error.message}</Alert>;
  }

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
          {/* Written down one at a time and kept the moment each is confirmed, so Discard has to take them
              back off rather than simply forget them. It asks first, and names how many. */}
          {!readOnly && (
            <p className="mt-1 text-xs text-ink-muted">
              A holding is written down the moment you confirm it, not when you press Save. Discard above puts
              these back as they stood when you pressed Edit, and asks first.
            </p>
          )}
        </div>
        {!readOnly && (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Add a holding
          </Button>
        )}
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
                {/* The class and the way to write something under it, side by side rather than nested: a
                    button inside a button is not a thing a browser will render, and the way to break a class
                    down used to live three panels up the page from the class it breaks down. */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => one.heldAsPositions && toggle(classKey)}
                    disabled={!one.heldAsPositions}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-4 py-2.5 text-left text-sm",
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
                  {/* Opened on this class, so the sub-classes offered are the ones this client's model names
                      inside it rather than the ones inside whichever class the list happened to start on. */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewFor(classKey);
                        setEditing("new");
                      }}
                      aria-label={`Add a holding to ${one.assetClassName || one.assetClass}`}
                      className="mr-3 ml-2 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:underline"
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      Add
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-line bg-slate-50/40 px-4 py-2">
                    {one.subClasses.map((group) => (
                      <div key={group.subClass ?? UNGROUPED} className="py-1.5">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs font-semibold text-ink-soft">
                          <span className="flex items-center gap-2">
                            {group.subClass ?? UNGROUPED}
                            {/* A class can sit on its target while the money inside it sits in the wrong
                                places, because the halves cancel out. This is where that shows. */}
                            {group.standing && group.standing !== "WITHIN_BAND" && (
                              <Badge tone={standingTones[group.standing]}>{standingLabels[group.standing]}</Badge>
                            )}
                          </span>
                          <span className="tabular-nums text-ink-muted">
                            {underManagementLabel(group.valueAmount, currency)} · {group.shareOfClass.toFixed(1)}% of
                            the class
                            {group.targetShare !== null && group.targetShare !== undefined && (
                              <> · {group.targetShare.toFixed(1)}% asked for</>
                            )}
                          </span>
                        </p>
                        {/* What buying or selling would put the line back where the model asks for it. */}
                        {group.suggestion !== null && group.suggestion !== undefined
                          && group.suggestion.toFixed(2) !== "0.00" && (
                          <p className="text-xs tabular-nums text-ink-muted">
                            <span className="font-semibold tracking-wider uppercase">
                              {group.suggestion > 0 ? "Buy" : "Sell"}
                            </span>{" "}
                            {underManagementLabel(Math.abs(group.suggestion), currency)}
                            {group.drift !== null && group.drift !== undefined && ` · ${driftLabel(group.drift)} from target`}
                          </p>
                        )}
                        <ul className="mt-1 divide-y divide-line/70">
                          {group.positions.map((position) => (
                            <li key={position.id} className="flex items-center gap-3 py-1.5 text-sm">
                              <span className="min-w-0 flex-1">
                                {readOnly ? (
                                  <span className="block truncate font-medium">{position.name}</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditing(position)}
                                    className="block truncate text-left font-medium text-primary-700 hover:underline"
                                  >
                                    {position.name}
                                  </button>
                                )}
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
                              {/* The name opens the same dialog, but a coloured word beside a bordered bin
                                  reads as a link to somewhere rather than as the other half of the pair.
                                  Two buttons, so what can be done to a line is visible without hovering. */}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => setEditing(position)}
                                  aria-label={`Edit ${position.name}`}
                                  title={`Edit ${position.name}`}
                                  className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                                >
                                  <Pencil aria-hidden="true" className="size-4" />
                                </button>
                              )}
                              {/* A bare grey glyph reads as decoration. Bordered, it reads as a button. */}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => setRemoving(position)}
                                  aria-label={`Remove ${position.name}`}
                                  title={`Remove ${position.name}`}
                                  className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                                >
                                  <Trash2 aria-hidden="true" className="size-4" />
                                </button>
                              )}
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

      {open && (
        <HoldingDialog
          customerId={customerId}
          position={open === "new" ? null : open}
          startOn={startOn}
          modelSubClasses={held.data?.modelSubClasses ?? {}}
          measuredAgainst={held.data?.measuredAgainst ?? null}
          underManagement={held.data?.underManagement ?? 0}
          classTotals={Object.fromEntries(classes.map((one) => [one.assetClass, one.valueAmount]))}
          currency={currency}
          onClose={closeDialog}
          onSaved={(id, before) => {
            onTouched?.(id, before);
            kept();
            closeDialog();
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
  startOn,
  modelSubClasses,
  measuredAgainst,
  underManagement,
  classTotals,
  currency,
  onClose,
  onSaved,
}: {
  customerId: string;
  position: PositionRow | null;
  /** What the client's model calls the lines inside each class, by class. Empty where it names none. */
  modelSubClasses: Record<string, ModelLine[]>;
  measuredAgainst: string | null;
  /** What the client holds altogether, so the model's share can be read as money rather than a percentage. */
  underManagement: number;
  /**
   * What each class comes to today, so a figure being typed can be read as a share of what its class would
   * come to with it in. By class, because which class a new holding is in is chosen in this dialog.
   */
  classTotals: Record<string, number>;
  currency: string;
  onClose: () => void;
  /** The class to open on, where a new holding was asked for from a particular one. */
  startOn: string | null;
  /** The holding's id, and what it looked like before — null where it did not exist until now. */
  onSaved: (id: string, before: PositionRow | null) => void;
}) {
  const assetClasses = useAssetClasses();
  // A holding already filed under a class keeps it, even one the firm has since retired; a new one starts
  // at the first class still in use rather than at a name compiled in here.
  const [picked, setAssetClass] = useState<string>(position?.assetClass ?? startOn ?? "");
  // The firm's classes arrive after the first render, so seeding the box from them once leaves the state
  // empty while the box on screen shows the first class — and an empty class is what gets submitted. What is
  // shown and what is sent are worked out together instead, so they cannot come apart.
  const assetClass = picked || position?.assetClass || assetClasses.inUse[0]?.code || "";
  const [subClass, setSubClass] = useState(position?.subClass ?? "");
  // A holding already filed under a group the model does not name is edited where it was written, rather
  // than having its group quietly cleared because the list has no row for it.
  const [writingIn, setWritingIn] = useState(
    position?.subClass != null
      && !(modelSubClasses[position.assetClass] ?? []).some((one) => one.name === position.subClass),
  );
  // What the model asks of the group picked. Read after subClass exists, not beside the class above it.
  const asked = (modelSubClasses[assetClass] ?? []).find((one) => one.name === subClass) ?? null;
  const [name, setName] = useState(position?.name ?? "");
  const [identifier, setIdentifier] = useState(position?.identifier ?? "");
  const [issuer, setIssuer] = useState(position?.issuer ?? "");
  const [countryCode, setCountryCode] = useState(position?.countryCode ?? "");
  const [sector, setSector] = useState(position?.sector ?? "");
  const [yieldPercent, setYield] = useState(position?.yieldPercent == null ? "" : String(position.yieldPercent));
  const [duration, setDuration] = useState(position?.durationYears == null ? "" : String(position.durationYears));
  const [creditRating, setCreditRating] = useState(position?.creditRating ?? "");
  const [valueAmount, setValueAmount] = useState(position ? String(position.valueAmount) : "");
  // Where the figure being typed would land this group, worked out as it is typed.
  //
  // A class takes its total from its lines, so writing this one changes the class it sits in: the share is
  // against what the class would come to with this figure in it, not what it comes to now. Without that, the
  // first holding in an empty class reads as nothing rather than as all of it.
  const typed = Number(valueAmount);
  const wouldBe =
    asked && valueAmount.trim() !== "" && Number.isFinite(typed) && typed >= 0
      ? (() => {
          const classNow = (classTotals[assetClass] ?? 0)
            - (position?.assetClass === assetClass ? position.valueAmount : 0);
          const classThen = classNow + typed;
          if (classThen <= 0) return null;
          const share = (typed / classThen) * 100;
          return { share, over: share - asked.shareOfClass };
        })()
      : null;
  const standing =
    wouldBe === null || !asked
      ? null
      : wouldBe.over >= asked.breachAt
        ? "BREACHED"
        : wouldBe.over >= asked.edgeAt
          ? "AT_EDGE"
          : wouldBe.over >= asked.watchAt
            ? "WATCH"
            : null;
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: a short window puts the first fields above the fold.
  useShowFirstError(errors, form);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useRecordClientHolding<ApiError>({
    mutation: { onSuccess: (written) => onSaved(written.id, null), onError },
  });
  const change = useChangeClientHolding<ApiError>({
    // The row as it stood when this dialog opened is what Discard would put back.
    mutation: { onSuccess: () => onSaved(position!.id, position!), onError },
  });
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
          {/* The groups the model names for this class, so a holding goes into one of them by being picked
              rather than by somebody typing its name again. A name typed a shade differently is a group the
              model says nothing about, and the holding then sits outside it with nothing to say why. */}
          <Field
            id="holding-subclass"
            label="Sub-class"
            hint={subClassHint(measuredAgainst, (modelSubClasses[assetClass] ?? []).length > 0)}
            error={errors.fields.subClass}
          >
            {(modelSubClasses[assetClass] ?? []).length > 0 && !writingIn ? (
              <SelectInput
                id="holding-subclass"
                value={subClass}
                onChange={(event) => {
                  if (event.target.value === OTHER_GROUP) {
                    setWritingIn(true);
                    setSubClass("");
                    return;
                  }
                  setSubClass(event.target.value);
                }}
              >
                <option value="">Not grouped</option>
                {(modelSubClasses[assetClass] ?? []).map((one) => (
                  <option key={one.name} value={one.name}>
                    {one.name}
                  </option>
                ))}
                <option value={OTHER_GROUP}>Something else…</option>
              </SelectInput>
            ) : (
              <TextInput id="holding-subclass" value={subClass} onChange={(e) => setSubClass(e.target.value)} />
            )}
            {/* Choosing to write one in was a door that only opened one way: the list was gone and the only
                way back to it was to close the dialog and start again. */}
            {(modelSubClasses[assetClass] ?? []).length > 0 && writingIn && (
              <button
                type="button"
                onClick={() => {
                  setWritingIn(false);
                  setSubClass("");
                }}
                className="mt-1 text-xs font-medium text-primary-700 hover:underline"
              >
                Choose one of the model's groups instead
              </button>
            )}
          </Field>
          {/* What the model asks of the group picked, as a guide and nothing more. Nothing is refused on the
              strength of it: a portfolio that has wandered is exactly the one somebody has to be able to
              write down, and the figure is here to be seen while they do, not to argue with them. */}
          {asked && (
            <p className="-mt-1 text-xs text-ink-muted sm:col-span-2">
              The model asks for <span className="font-semibold text-ink">{asked.shareOfPortfolio.toFixed(1)}%</span>
              {" "}of the portfolio here
              {underManagement > 0 && <> — about {underManagementLabel((asked.shareOfPortfolio / 100) * underManagement, currency)} at what they hold today</>}
              . Write what they actually hold; this is a guide, not a limit.
            </p>
          )}
          {/* Where the figure being typed would land this group, said as it is typed rather than after the
              dialog closes. It is said, not enforced: the holding is still written down as given. */}
          {asked && wouldBe && (
            <p className="-mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted sm:col-span-2">
              {standing ? (
                <Badge tone={standingTones[standing]}>{standingLabels[standing]}</Badge>
              ) : (
                <Badge tone="success">Within band</Badge>
              )}
              <span>
                This would make it {wouldBe.share.toFixed(1)}% of {assetClasses.names[assetClass] ?? assetClass},
                against {asked.shareOfClass.toFixed(1)}% asked for — {driftLabel(wouldBe.over)} from target.
              </span>
            </p>
          )}
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
/**
 * What to say under the Sub-class box.
 *
 * <p>A client nobody has put on a model has no groups to offer, and so did a model that breaks none of its
 * classes down — one sentence covered both, and it blamed the model. Somebody who had simply not picked one
 * yet went looking for a fault in the model instead of at the box at the top of the screen.
 */
function subClassHint(measuredAgainst: string | null, breaksItDown: boolean): string {
  if (measuredAgainst === null) {
    return "This client is on no model yet. Pick one under Measured against and the groups it names are offered here.";
  }
  if (breaksItDown) {
    return "The groups this client's model breaks the class into. Choose Something else to write one it does not name.";
  }
  return `What the firm calls the group, such as US Equities — S&P 500. ${measuredAgainst} does not break this class down.`;
}

function classesOffered(assetClasses: ReturnType<typeof useAssetClasses>, held: string | undefined): string[] {
  const codes = assetClasses.inUse.map((one) => one.code);
  return held && !codes.includes(held) ? [held, ...codes] : codes;
}
