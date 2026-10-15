import { ApiError } from "@atomprive/api-client";
import {
  useListBenchmarks,
  useListModelPortfolios,
  type BenchmarkRow,
  type ModelsPage,
  type ModelRequest,
  type ModelRequestRiskProfile,
  type BandRequest,
  type ModelRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { asFigure } from "../../lib/figures";
import { RISK_PROFILES } from "./portfolio-labels";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  type ModelStatus,
} from "./portfolio-labels";

/** A model as the form holds it: every target typed, so an empty box reads as nothing rather than zero. */
type Targets = Record<string, string>;

/**
 * How far each class may wander from its target before it has breached, as the form holds it: one figure
 * per class, in percentage points, the same distance either way.
 *
 * <p>One, not three. The platform can hold a class to three widening levels — worth watching, at the edge,
 * then broken — and the firm asked for the last of them alone: a client is inside their plan or they are
 * not. The three are still written underneath, all set to this figure, which collapses the ladder on its
 * own: nothing can be past an edge equal to the breach without being past the breach first.
 */
type Breaches = Record<string, string>;

/** One line of a spread by country or by sector, as it is typed. */
type TypedShare = { key: string; share: string };

/** What is on the model, as lines to edit. Always one blank at the end to type the next into. */
function sharesOf(held: Record<string, number> | undefined): TypedShare[] {
  const lines = Object.entries(held ?? {}).map(([key, share]) => ({ key, share: String(share) }));
  return [...lines, { key: "", share: "" }];
}
/** Only the lines somebody has actually filled in, keyed as the API keeps them. */
function asTargets(lines: TypedShare[]) {
  const targets: Record<string, number> = {};
  for (const one of lines) {
    const key = one.key.trim().toUpperCase();
    if (key !== "" && isNumber(one.share) && Number(one.share) > 0) targets[key] = Number(one.share);
  }
  return targets;
}

/** A blank of each shape, built from whatever classes the firm keeps rather than a list written in here. */
function noBreaches(codes: string[]): Breaches {
  return Object.fromEntries(codes.map((code) => [code, ""]));
}

/**
 * What is already on the model, so editing one shows the figures it was saved with.
 *
 * <p>Read off the breach level, which is the one the firm sets. A model saved before the firm asked for a
 * single figure may hold three that widen, and what it is read as here is the one that decides anything.
 */
function breachesOf(model: ModelRow, codes: string[]): Breaches {
  const typed = noBreaches(codes);
  for (const assetClass of codes) {
    const band = model.bands?.[assetClass];
    if (band) {
      typed[assetClass] = String(band.breachAt);
    }
  }
  return typed;
}

function noTargets(codes: string[]): Targets {
  return Object.fromEntries(codes.map((code) => [code, ""]));
}

function targetsOf(model: ModelRow, codes: string[]): Targets {
  const typed = noTargets(codes);
  for (const assetClass of codes) {
    const target = model.targets[assetClass];
    if (target !== undefined) typed[assetClass] = String(target);
  }
  return typed;
}

/** One line inside a class, as it is typed: a name and a share of its own class. */
/**
 * @param written whether this line's name is being typed rather than picked. A name the firm has used
 * before is chosen from the list; anything else is written on purpose, and saying so is what keeps the two
 * apart — an empty box is otherwise indistinguishable from one nobody has reached yet.
 */
type TypedLine = { name: string; shareOfClass: string; written: boolean };

type Lines = Record<string, TypedLine[]>;

function noLines(codes: string[]): Lines {
  return Object.fromEntries(codes.map((code) => [code, []]));
}

function linesOf(model: ModelRow, codes: string[]): Lines {
  const held = noLines(codes);
  for (const assetClass of codes) {
    held[assetClass] = (model.subAllocations?.[assetClass] ?? []).map((line) => ({
      name: line.name,
      // Settled once the names are in hand, below: a model's own line may be one nobody else has used.
      written: false,
      shareOfClass: String(line.shareOfClass),
    }));
  }
  return held;
}

function blankLine(): TypedLine {
  return { name: "", shareOfClass: "", written: false };
}

/** The value the list carries for writing a name nobody has used before. Never a name itself. */
const WRITE_ONE = "\u0000write";

/** What the lines inside one class come to; letters count as nothing until they are numbers. */
function addsInClass(inClass: TypedLine[]) {
  return inClass.reduce((sum, line) => sum + (isNumber(line.shareOfClass) ? Number(line.shareOfClass) : 0), 0);
}

function adds(targets: Targets) {
  return Object.values(targets).reduce((total, typed) => total + (Number(typed) || 0), 0);
}

/** Whether what was typed is a number at all, so letters are not quietly counted as nothing. */
function isNumber(typed: string) {
  return typed.trim() !== "" && Number.isFinite(Number(typed));
}

/** The classes whose box holds something that isn't a number, named so the form can say which. */
function notNumbers(targets: Targets) {
  return Object.keys(targets).filter(
    (assetClass) => targets[assetClass].trim() !== "" && !isNumber(targets[assetClass]),
  );
}

/** "Equities", "Equities and Cash", "Equities, Forex and Cash" — a list as a sentence says it. */
function andList(words: string[]) {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * What a line comes to as a share of the whole portfolio: its share of the class, of the class's share.
 *
 * <p>Two percentages away from the figure that is actually measured. Typing 89% of a class that is 12% of
 * the portfolio means 10.68% of it, and that 10.68 is what every drift, band and breach on every other
 * screen is read against — so it is worked out here rather than left to be done in somebody's head while
 * they type the next line.
 */
function ofWholePortfolio(classTarget: string, shareOfClass: string): number | null {
  if (!isNumber(classTarget) || !isNumber(shareOfClass)) return null;
  if (classTarget.trim() === "" || shareOfClass.trim() === "") return null;
  return (Number(classTarget) * Number(shareOfClass)) / 100;
}

/**
 * The sub-asset names the firm has already written under each class, across every model it has.
 *
 * <p>Offered rather than imposed. There is no firm-wide list of sub-assets to pick from — the names exist
 * only inside the models somebody has written — so this gathers them and hands them over as suggestions.
 * The box stays a box: a name nobody has used before can still be typed, which is how the first one got
 * there and how the next new thing will.
 */
function namesAlreadyUsed(models: ModelRow[]): Record<string, string[]> {
  const seen: Record<string, Set<string>> = {};
  for (const model of models) {
    for (const [assetClass, inClass] of Object.entries(model.subAllocations ?? {})) {
      for (const line of inClass) {
        const name = line.name.trim();
        if (name === "") continue;
        (seen[assetClass] ??= new Set()).add(name);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(seen).map(([assetClass, names]) => [assetClass, [...names].sort()]),
  );
}

/**
 * The models the firm invests against: what each one targets in every asset class, and how far a
 * portfolio may wander from those targets before somebody should look at it.
 */
export function ModelDialog({
  model,
  errors,
  busy,
  onClose,
  onSave,
}: {
  model: ModelRow | null;
  errors: FormErrors;
  busy: boolean;
  onClose: () => void;
  onSave: (data: ModelRequest) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  // A refusal takes the reader to it: the fields are a screen above the button that sends them.
  useShowFirstError(errors, form);
  const assetClasses = useAssetClasses();
  const { names, all } = assetClasses;
  // A model is built out of the classes the firm still uses, plus any retired one it already targets — that
  // target has to stay visible and movable, even though nothing new may be written under it.
  const codes = classesForModel(assetClasses, model);
  const [name, setName] = useState(model?.name ?? "");
  const [description, setDescription] = useState(model?.description ?? "");
  const [riskProfile, setRiskProfile] = useState<ModelRequestRiskProfile>(model?.riskProfile ?? null);
  const [status, setStatus] = useState<ModelStatus>((model?.status as ModelStatus) ?? "LIVE");
  // Seeded on the first render, when the firm's list of classes may not have arrived yet. A class that
  // turns up afterwards is folded in here, because reading one the state has never heard of is a crash.
  const [typedTargets, setTargets] = useState<Targets>(model ? targetsOf(model, codes) : noTargets(codes));
  const targets: Targets = { ...(model ? targetsOf(model, codes) : noTargets(codes)), ...typedTargets };
  // The model's own figure, which answers only for a class the firm has not given one — today none of
  // them, tomorrow whichever one somebody adds. Flat across the three levels, like every class's, so a
  // class nobody has reached yet is judged the same way as the ones beside it.
  const watchAt = model?.watchAt ?? 5;
  const edgeAt = model?.edgeAt ?? 5;
  const breachAt = model?.breachAt ?? 5;
  // Seeded like the targets beside them, and for the same reason: the firm's classes may arrive a render
  // after this one.
  const [typedBreaches, setBreaches] = useState<Breaches>(
    model ? breachesOf(model, codes) : noBreaches(codes),
  );
  const breaches: Breaches = { ...(model ? breachesOf(model, codes) : noBreaches(codes)), ...typedBreaches };
  const [benchmarkId, setBenchmarkId] = useState(model?.benchmarkId ?? "");
  // Which indices the firm holds. Without one named here, Model performance has nothing to compare against.
  const benchmarks = useListBenchmarks<BenchmarkRow[], ApiError>();
  // Already in hand on the screen this dialog opens from, so asking again costs nothing and the names are
  // there on the first render rather than a moment later.
  const everyModel = useListModelPortfolios<ModelsPage, ApiError>();
  const usedNames = namesAlreadyUsed(everyModel.data?.items ?? []);
  const total = adds(targets);
  const unreadable = notNumbers(targets);
  // A form nobody has typed in yet is not wrong, it is empty: it says what is wanted rather than warning.
  const untouched = codes.every((assetClass) => targets[assetClass].trim() === "");
  // No single class can be more than the whole portfolio, so it is worth saying which one is, rather than
  // leaving a total in the tens of thousands as the only clue.
  const overWhole = codes.filter(
    (assetClass) => isNumber(targets[assetClass]) && Number(targets[assetClass]) > 100,
  );
  // The one hard rule a model has to satisfy. Saying so on the button saves a trip to the server to be told.
  const addsUp = total === 100;
  // Carried from the model and sent back as they came: the dialog no longer asks for a spread by country
  // or by sector, and a model that already has one keeps it.
  const countries = sharesOf(model?.geographyTargets);
  const sectors = sharesOf(model?.sectorTargets);
  const [typedLines, setLines] = useState<Lines>(model ? linesOf(model, codes) : noLines(codes));
  const lines: Lines = { ...(model ? linesOf(model, codes) : noLines(codes)), ...typedLines };
  // A class broken into lines has to be wholly accounted for: 8% belonging to nothing is not a plan.
  // A class with a target and no lines yet is one somebody could break down.
  const breakable = codes.filter(
    (assetClass) =>
      lines[assetClass].length === 0 && isNumber(targets[assetClass]) && Number(targets[assetClass]) > 0,
  );
  // The same sub-asset twice in one class. Taken off the list where it is picked, but a name written by
  // hand can still land on one already there, so it is checked rather than only made awkward.
  const twiceNamed = codes.filter((assetClass) => {
    const said = lines[assetClass].map((line) => line.name.trim()).filter((name) => name !== "");
    return new Set(said).size !== said.length;
  });
  const shortLines = codes.filter((assetClass) => {
    const inClass = lines[assetClass];
    if (inClass.length === 0) return false;
    return inClass.some((line) => !isNumber(line.shareOfClass)) || addsInClass(inClass) !== 100;
  });
  // A class the model asks for money in has to say how far it may wander. The figure is what every breach
  // on every client measured against this model is read from, so leaving it out is not leaving a box empty
  // — it is handing the answer to the model's own figure, which this screen does not show.
  const unsaidBreach = codes.filter(
    (assetClass) =>
      isNumber(targets[assetClass]) && Number(targets[assetClass]) > 0
      && !(isNumber(breaches[assetClass]) && Number(breaches[assetClass]) > 0),
  );
  // Letters in a figure box are not a small mistake to round away: nothing is saved until they are numbers.
  const readable =
    unreadable.length === 0 && overWhole.length === 0
    && shortLines.length === 0 && twiceNamed.length === 0 && unsaidBreach.length === 0
    && codes.every((a) => lines[a].every((line) => line.name.trim() !== ""));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!readable || !addsUp) return;
    const wanted: Record<string, number> = {};
    for (const assetClass of codes) {
      if (targets[assetClass].trim()) wanted[assetClass] = Number(targets[assetClass]);
    }
    // One figure a class, written into all three levels. Percentage points, not a share of the target, so
    // five means five points wherever it is read: a class asked for 20 is allowed 15 to 25, and a line
    // inside it asked for 10 of its class is allowed 5 to 15 of its class.
    //
    // The below figures are left out, which the API reads as the same distance either way.
    const perClass: Record<string, BandRequest> = {};
    for (const assetClass of codes) {
      const said = breaches[assetClass];
      if (isNumber(said) && Number(said) > 0) {
        perClass[assetClass] = {
          basis: "ABSOLUTE",
          watchAt: Number(said),
          edgeAt: Number(said),
          breachAt: Number(said),
          watchBelow: null,
          edgeBelow: null,
          breachBelow: null,
        };
      }
    }
    onSave({
      name,
      description: description.trim() || null,
      riskProfile,
      status,
      targets: wanted,
      watchAt,
      edgeAt,
      breachAt,
      bands: perClass,
      benchmarkId: benchmarkId || null,
      geographyTargets: asTargets(countries),
      sectorTargets: asTargets(sectors),
      // Only the classes somebody has actually broken down; the rest stay a single target.
      subAllocations: Object.fromEntries(
        codes.filter((assetClass) => lines[assetClass].length > 0).map((assetClass) => [
          assetClass,
          // Every sub-asset in a class is held to the same figures — the class's, or the model's where
          // the class has none of its own. One line allowed to wander four times as far as the rest was a
          // rule nothing on the page explained and nobody could see from the class it sat in.
          lines[assetClass].map((line) => ({
            name: line.name.trim(),
            shareOfClass: Number(line.shareOfClass),
            band: null,
          })),
        ]),
      ),
      // Left for the platform to write down what moved, now that nobody is asked for a reason.
      changeNote: null,
    });
  }

  return (
    <Dialog open title={model ? `Edit ${model.name}` : "New model portfolio"} size="xl" onClose={onClose}>
      <form ref={form} onSubmit={submit} className="space-y-6">
        {errors.form && (
          <div data-form-error>
            <Alert tone="danger">{errors.form}</Alert>
          </div>
        )}

        {/* What the plan is. Four short answers rather than a column of full-width boxes. */}
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="model-name" label="Name" required error={errors.fields.name}>
              <TextInput
                {...describedBy("model-name", errors.fields.name)}
                id="model-name"
                placeholder="Balanced 60/40"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            {/* The five the Investment Risk Profile questionnaire derives, because a client's answer comes
                from there. A line to type in let a model be written for "Balanced" and a client come out
                "BALANCE", which is the same thing and matches on nothing. */}
            <Field
              id="model-risk"
              label="Risk profile"
              error={errors.fields.riskProfile}
              hint="Who the model is written for. A client is matched to it by the profile their questionnaire came out as."
            >
              <SelectInput
                {...describedBy("model-risk", errors.fields.riskProfile)}
                id="model-risk"
                value={riskProfile ?? ""}
                onChange={(event) => setRiskProfile((event.target.value || null) as ModelRequestRiskProfile)}
              >
                <option value="">Nobody has said yet</option>
                {RISK_PROFILES.map((profile) => (
                  <option key={profile.value} value={profile.value}>
                    {profile.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field id="model-description" label="What it is for" error={errors.fields.description}>
            <TextInput
              id="model-description"
              placeholder="Long-term growth with income, for clients who can hold through a fall."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="model-status" label="Status" required error={errors.fields.status}>
              <SelectInput
                id="model-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ModelStatus)}
              >
                <option value="DRAFT">Draft — nobody is measured against it</option>
                <option value="LIVE">Live — in use</option>
                <option value="RETIRED">Retired — nobody new goes on it</option>
              </SelectInput>
            </Field>
            <Field
              id="model-benchmark"
              label="Benchmark"
              hint="Without one, Model performance has nothing to compare it with."
              error={errors.fields.benchmarkId}
            >
              <SelectInput
                id="model-benchmark"
                value={benchmarkId}
                onChange={(event) => setBenchmarkId(event.target.value)}
              >
                <option value="">No benchmark</option>
                {(benchmarks.data ?? []).map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.name} · {one.currency}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </section>

        {/* The split itself: one box per class, and the plan drawn as it is typed. */}
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            The split
          </legend>

          {/* Two figures a class, and what each of them is. Said once above the boxes rather than labelled
              on every row, which at six classes was the same two words twelve times. */}
          <p className="mb-3 text-xs text-ink-muted">
            What each class is asked to be, and how far it may wander either way before it has breached.
            The second figure is the class&apos;s own, and every sub-asset inside it is held to that same
            distance from its own target: a class allowed five points, broken into a line asked for 10% of
            the class, allows that line 5% to 15% of the class.
          </p>

          <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
            {codes.map((assetClass) => (
              <div key={assetClass} className="flex items-center gap-2.5">
                <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", barFor(assetClass, all))} />
                <label htmlFor={`target-${assetClass}`} className="min-w-0 flex-1 truncate text-sm text-ink">
                  {(names[assetClass] ?? assetClass)}
                </label>
                <div className="relative w-20 shrink-0">
                  <TextInput
                    id={`target-${assetClass}`}
                    inputMode="decimal"
                    className="pr-7 text-right"
                    value={targets[assetClass]}
                    onChange={(event) =>
                      setTargets({ ...targets, [assetClass]: asFigure(event.target.value, targets[assetClass]) })
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted"
                  >
                    %
                  </span>
                </div>
                {/* Plus or minus, because it is the same distance either way: a class may be that far over
                    its target or that far under it before anybody is told. */}
                <div className="relative w-24 shrink-0">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted"
                  >
                    ±
                  </span>
                  <TextInput
                    id={`breach-${assetClass}`}
                    aria-label={`How far ${(names[assetClass] ?? assetClass)} may wander before it has breached`}
                    inputMode="decimal"
                    className="pr-7 pl-7 text-right"
                    value={breaches[assetClass]}
                    onChange={(event) =>
                      setBreaches({
                        ...breaches,
                        [assetClass]: asFigure(event.target.value, breaches[assetClass]),
                      })
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted"
                  >
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Each class the committee has broken down, set out under it. */}
          {codes.filter((assetClass) => lines[assetClass].length > 0).map((assetClass) => (
            <div key={assetClass} className="mt-3 rounded-lg border border-line bg-slate-50/50 p-3">
              <p className="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink-soft">
                <span>Inside {(names[assetClass] ?? assetClass)} — name and share of the class</span>
                <span className={cn(
                  "tabular-nums",
                  addsInClass(lines[assetClass]) === 100 ? "text-emerald-700"
                    : addsInClass(lines[assetClass]) > 100 ? "text-red-600" : "text-amber-700",
                )}>
                  {addsInClass(lines[assetClass]).toFixed(2)}% of the class
                </span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {lines[assetClass].map((line, at) => (
                  <li key={at} className="flex items-center gap-2">
                    {/* Picked from the list, or written on purpose — never half way between. The firm
                        keeps no master list of sub-assets; the names live only inside the models somebody
                        has written, so those are offered and anything else has to be asked for by name.
                        Left as a box to type in, the same line went down three ways across three models
                        and nothing joined them up. */}
                    {line.written || (line.name !== "" && !(usedNames[assetClass] ?? []).includes(line.name)) ? (
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <TextInput
                          aria-label={`Name of line ${at + 1} inside ${(names[assetClass] ?? assetClass)}`}
                          placeholder="A name nobody has used yet"
                          className="min-w-0 flex-1"
                          value={line.name}
                          onChange={(event) =>
                            setLines({
                              ...lines,
                              [assetClass]: lines[assetClass].map((one, which) =>
                                which === at ? { ...one, name: event.target.value, written: true } : one,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary-700 hover:underline"
                          onClick={() =>
                            setLines({
                              ...lines,
                              [assetClass]: lines[assetClass].map((one, which) =>
                                which === at ? { ...one, name: "", written: false } : one,
                              ),
                            })
                          }
                        >
                          Pick from the list
                        </button>
                      </span>
                    ) : (
                      <SelectInput
                        aria-label={`Name of line ${at + 1} inside ${(names[assetClass] ?? assetClass)}`}
                        className="min-w-0 flex-1"
                        value={line.name}
                        onChange={(event) =>
                          setLines({
                            ...lines,
                            [assetClass]: lines[assetClass].map((one, which) =>
                              which === at
                                ? event.target.value === WRITE_ONE
                                  ? { ...one, name: "", written: true }
                                  : { ...one, name: event.target.value, written: false }
                                : one,
                            ),
                          })
                        }
                      >
                        <option value="">Pick a sub-asset…</option>
                        {/* Not the ones this class has already spoken for. A sub-asset is one line of a
                            plan: named twice it has two targets, and nothing can say which it is held to. */}
                        {(usedNames[assetClass] ?? [])
                          .filter((used) => used === line.name
                            || !lines[assetClass].some((other, which) => which !== at && other.name === used))
                          .map((used) => (
                            <option key={used} value={used}>{used}</option>
                          ))}
                        <option value={WRITE_ONE}>Something else…</option>
                      </SelectInput>
                    )}
                    <div className="relative w-24 shrink-0">
                      <TextInput
                        aria-label={`Share of ${(names[assetClass] ?? assetClass)} for line ${at + 1}`}
                        inputMode="decimal"
                        className="pr-7 text-right"
                        value={line.shareOfClass}
                        onChange={(event) =>
                          setLines({
                            ...lines,
                            [assetClass]: lines[assetClass].map((one, which) =>
                              which === at
                                ? { ...one, shareOfClass: asFigure(event.target.value, one.shareOfClass) }
                                : one,
                            ),
                          })
                        }
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
                        %
                      </span>
                    </div>
                    {/* The figure the rest of the platform actually measures against, beside the one being
                        typed: a share of a share is two sums away from it. */}
                    <span className="w-24 shrink-0 text-right text-xs whitespace-nowrap tabular-nums text-ink-muted">
                      {(() => {
                        const share = ofWholePortfolio(targets[assetClass], line.shareOfClass);
                        return share === null ? "" : `= ${share.toFixed(2)}% of all`;
                      })()}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove line ${at + 1} inside ${(names[assetClass] ?? assetClass)}`}
                      onClick={() =>
                        setLines({ ...lines, [assetClass]: lines[assetClass].filter((_, which) => which !== at) })
                      }
                      className="rounded p-1 text-ink-muted hover:text-rose-700"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  setLines({ ...lines, [assetClass]: [...lines[assetClass], blankLine()] })
                }
                className="mt-2 text-xs font-semibold text-primary-700 hover:underline"
              >
                Add another line
              </button>
            </div>
          ))}

          {/* A class is a single target until somebody breaks it down, which is where every plan starts.
              Nothing is offered until a class has a target: there is nothing to break down yet, and a label
              with no buttons after it reads as something that failed to load. */}
          {breakable.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span>Break a class into lines:</span>
              {breakable.map((assetClass) => (
                <button
                  key={assetClass}
                  type="button"
                  onClick={() => setLines({ ...lines, [assetClass]: [blankLine()] })}
                  className="rounded-full border border-line bg-white px-2 py-0.5 font-medium text-primary-700 hover:border-primary-300"
                >
                  {(names[assetClass] ?? assetClass)}
                </button>
              ))}
            </div>
          )}

          {twiceNamed.map((assetClass) => (
            <p key={assetClass} className="mt-1.5 text-xs text-red-600">
              {names[assetClass] ?? assetClass} names the same sub-asset twice. Each one is a line of the
              plan, and a line named twice has two targets with nothing to say which it is held to.
            </p>
          ))}

          {/* Which way, and by how much. "Do not come to 100%" was said the same whether a class was half
              written or asked for more of itself than exists — and the second is the one somebody has to
              take something off to fix. */}
          {shortLines.map((assetClass) => {
            const inClass = addsInClass(lines[assetClass]);
            const named = names[assetClass] ?? assetClass;
            return (
              <p key={assetClass} className="mt-1.5 text-xs text-red-600">
                {inClass > 100
                  ? `The lines inside ${named} come to ${inClass.toFixed(2)}% of the class. `
                    + `Take ${(inClass - 100).toFixed(2)}% off: a class is only ever the whole of itself.`
                  : `The lines inside ${named} come to ${inClass.toFixed(2)}% of the class. `
                    + `${(100 - inClass).toFixed(2)}% of it belongs to nothing yet.`}
              </p>
            );
          })}
          {errors.fields.subAllocations && (
            <p className="mt-1 text-xs text-red-600">{errors.fields.subAllocations}</p>
          )}

          {/* The plan as a bar, so a split that is wrong looks wrong before the total is read. */}
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100">
            {codes.filter((assetClass) => isNumber(targets[assetClass]) && Number(targets[assetClass]) > 0).map(
              (assetClass) => (
                <span
                  key={assetClass}
                  className={cn("h-full", barFor(assetClass, all))}
                  style={{ width: `${Math.min(Number(targets[assetClass]), 100)}%` }}
                />
              ),
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold tabular-nums">{total}% placed</span>
            {/* Short of a hundred is a plan half written; past it is a plan that cannot exist. The second
                is not a shade worse than the first, so it is not said in the same colour. */}
            <span
              className={cn(
                "text-xs font-medium",
                untouched ? "text-ink-muted" : addsUp ? "text-emerald-700"
                  : total < 100 ? "text-amber-700" : "text-red-600",
              )}
            >
              {untouched
                ? "A plan has to add up to 100%."
                : addsUp
                  ? "Adds up."
                  : total < 100
                    ? `${100 - total}% still to place.`
                    : `${total - 100}% over.`}
            </span>
          </p>

          {/* Said in full, under the bar, where the figures are. A portfolio is the whole of what somebody
              has: a plan for more than all of it cannot be followed, and nothing is saved until it comes
              down — so it is put as plainly as the thing that is wrong. */}
          {!untouched && total > 100 && (
            <p className="mt-1.5 text-xs text-red-600">
              The split comes to {total}%, and a portfolio is only ever 100%. Take{" "}
              {total - 100}% off before this can be saved.
            </p>
          )}

          {unreadable.length > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              {andList(unreadable.map((assetClass) => (names[assetClass] ?? assetClass)))}{" "}
              {unreadable.length === 1 ? "is not a number" : "are not numbers"}. A target is a percentage, such
              as 30 or 7.5.
            </p>
          )}
          {overWhole.length > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              {andList(overWhole.map((assetClass) => (names[assetClass] ?? assetClass)))}{" "}
              {overWhole.length === 1 ? "is" : "are"} over 100%. No one class can be more than the whole
              portfolio.
            </p>
          )}
          {unsaidBreach.length > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              {andList(unsaidBreach.map((assetClass) => (names[assetClass] ?? assetClass)))}{" "}
              {unsaidBreach.length === 1 ? "has" : "have"} money asked of{" "}
              {unsaidBreach.length === 1 ? "it" : "them"} but no figure beside it for how far{" "}
              {unsaidBreach.length === 1 ? "it" : "they"} may wander. Every breach on every client measured
              against this model is read from that figure.
            </p>
          )}
          {errors.fields.targets && <p className="mt-1 text-xs text-red-600">{errors.fields.targets}</p>}
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
          {/* Said beside the button as well as against the field. Somebody who presses Save at the foot of a
              long form has to be told here that it was refused, not only where the fault is. */}
          {Object.keys(errors.fields).length > 0 && (
            <p className="mr-auto text-xs text-red-600">
              Something above still needs putting right.
            </p>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !readable || !addsUp}>
            {busy ? "Saving…" : model ? "Save the model" : "Create the model"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The classes a model may be built on: everything still in use, plus any the model already targets. A class
 * retired after a model was written stays on that model until somebody moves its target somewhere else.
 */
function classesForModel(assetClasses: ReturnType<typeof useAssetClasses>, model: ModelRow | null): string[] {
  const targeted = new Set(Object.keys(model?.targets ?? {}));
  return assetClasses.all
    .filter((one) => one.retiredAt === null || targeted.has(one.code))
    .map((one) => one.code);
}
