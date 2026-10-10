import { ApiError } from "@atomprive/api-client";
import {
  useListBenchmarks,
  type BenchmarkRow,
  type ModelRequest,
  type BandRequest,
  type BandRequestBasis,
  type ModelRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { asFigure } from "../../lib/figures";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  type ModelStatus,
} from "./portfolio-labels";

/** A model as the form holds it: every target typed, so an empty box reads as nothing rather than zero. */
type Targets = Record<string, string>;

/**
 * One class's own tolerance, as the form holds it. The three above-target levels empty means the class is
 * judged by the model's own bands; the below ones empty means the same distance either way.
 */
type TypedBand = {
  basis: BandRequestBasis;
  watchAt: string;
  edgeAt: string;
  breachAt: string;
  watchBelow: string;
  edgeBelow: string;
  breachBelow: string;
};

type Bands = Record<string, TypedBand>;

/** One line of a spread by country or by sector, as it is typed. */
type TypedShare = { key: string; share: string };

/** What is on the model, as lines to edit. Always one blank at the end to type the next into. */
function sharesOf(held: Record<string, number> | undefined): TypedShare[] {
  const lines = Object.entries(held ?? {}).map(([key, share]) => ({ key, share: String(share) }));
  return [...lines, { key: "", share: "" }];
}

/** What those lines come to, for the running total. */
function addsUpTo(lines: TypedShare[]) {
  return lines.reduce((total, one) => total + (Number(one.share) || 0), 0);
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

/** The boxes of a band that hold a figure. The basis is a choice, not something to type into. */
type BandFigure = Exclude<keyof TypedBand, "basis">;

const NO_BAND: TypedBand = {
  basis: "ABSOLUTE",
  watchAt: "",
  edgeAt: "",
  breachAt: "",
  watchBelow: "",
  edgeBelow: "",
  breachBelow: "",
};

/** A blank of each shape, built from whatever classes the firm keeps rather than a list written in here. */
function noBands(codes: string[]): Bands {
  return Object.fromEntries(codes.map((code) => [code, NO_BAND]));
}

/** What is already on the model, so editing one shows the tolerances it was saved with. */
function bandsOf(model: ModelRow, codes: string[]): Bands {
  const typed = noBands(codes);
  for (const assetClass of codes) {
    const band = model.bands?.[assetClass];
    if (band) {
      typed[assetClass] = {
        basis: band.basis ?? "ABSOLUTE",
        watchAt: String(band.watchAt),
        edgeAt: String(band.edgeAt),
        breachAt: String(band.breachAt),
        // The API fills a missing side in from the one above, so what comes back is always both. Shown as
        // the same distance either way unless it really differs.
        watchBelow: String(band.watchBelow ?? band.watchAt),
        edgeBelow: String(band.edgeBelow ?? band.edgeAt),
        breachBelow: String(band.breachBelow ?? band.breachAt),
      };
    }
  }
  return typed;
}

/**
 * How much of a class's own tolerance has been filled in: none, all three, or something in between. Only the
 * above-target levels count — the ones below are an answer to a further question, not part of this one.
 */
function howFilled(band: TypedBand) {
  const filled = [band.watchAt, band.edgeAt, band.breachAt].filter((one) => one.trim() !== "").length;
  return filled === 0 ? "none" : filled === 3 ? "all" : "part";
}

/** Whether any class is allowed a different distance below its target than above it. */
function anyTwoSided(bands: Bands) {
  return Object.values(bands).some(
    (band) =>
      howFilled(band) === "all" &&
      (band.watchBelow !== band.watchAt ||
        band.edgeBelow !== band.edgeAt ||
        band.breachBelow !== band.breachAt),
  );
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
type TypedLine = { name: string; shareOfClass: string; band: TypedBand };

type Lines = Record<string, TypedLine[]>;

function noLines(codes: string[]): Lines {
  return Object.fromEntries(codes.map((code) => [code, []]));
}

function linesOf(model: ModelRow, codes: string[]): Lines {
  const held = noLines(codes);
  for (const assetClass of codes) {
    held[assetClass] = (model.subAllocations?.[assetClass] ?? []).map((line) => ({
      name: line.name,
      shareOfClass: String(line.shareOfClass),
      band: line.band
        ? {
            ...NO_BAND,
            watchAt: String(line.band.watchAt),
            edgeAt: String(line.band.edgeAt),
            breachAt: String(line.band.breachAt),
          }
        : NO_BAND,
    }));
  }
  return held;
}

function blankLine(): TypedLine {
  return { name: "", shareOfClass: "", band: NO_BAND };
}

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
 * The models the firm invests against: what each one targets in every asset class, and how far a
 * portfolio may wander from those targets before somebody should look at it.
 */
/**
 * A spread by country or by sector: a key and a share, as many as somebody types. A blank line is kept at
 * the end so the next one can be written without reaching for a button first.
 */
function Spread({
  label,
  hint,
  placeholder,
  lines,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  lines: TypedShare[];
  onChange: (lines: TypedShare[]) => void;
}) {
  const total = addsUpTo(lines);
  const anything = lines.some((one) => one.key.trim() !== "");

  function change(at: number, part: Partial<TypedShare>) {
    const next = lines.map((one, which) => (which === at ? { ...one, ...part } : one));
    // Always one blank at the end, and no more than one.
    const filled = next.filter((one) => one.key.trim() !== "" || one.share.trim() !== "");
    onChange([...filled, { key: "", share: "" }]);
  }

  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      <div className="mt-2 space-y-2">
        {lines.map((one, at) => (
          <div key={at} className="flex items-center gap-2">
            <TextInput
              aria-label={`${label} name`}
              placeholder={placeholder}
              value={one.key}
              onChange={(event) => change(at, { key: event.target.value })}
            />
            <TextInput
              aria-label={`${label} share`}
              inputMode="decimal"
              className="w-24 text-right"
              placeholder="0"
              value={one.share}
              onChange={(event) => change(at, { share: asFigure(event.target.value, one.share) })}
            />
            <span className="text-sm text-ink-muted">%</span>
          </div>
        ))}
      </div>
      {anything && (
        <p className={cn("mt-1.5 text-xs", total === 100 ? "text-ink-muted" : "text-amber-700")}>
          Adds up to {total}%.{total === 100 ? "" : " A spread that does not reach 100% leaves the rest unasked for."}
        </p>
      )}
    </div>
  );
}

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
  const [riskProfile, setRiskProfile] = useState(model?.riskProfile ?? "");
  const [status, setStatus] = useState<ModelStatus>((model?.status as ModelStatus) ?? "LIVE");
  // Seeded on the first render, when the firm's list of classes may not have arrived yet. A class that
  // turns up afterwards is folded in here, because reading one the state has never heard of is a crash.
  const [typedTargets, setTargets] = useState<Targets>(model ? targetsOf(model, codes) : noTargets(codes));
  const targets: Targets = { ...(model ? targetsOf(model, codes) : noTargets(codes)), ...typedTargets };
  const [watchAt, setWatchAt] = useState(String(model?.watchAt ?? 2));
  const [edgeAt, setEdgeAt] = useState(String(model?.edgeAt ?? 4));
  const [breachAt, setBreachAt] = useState(String(model?.breachAt ?? 6));
  const [typedBands, setBands] = useState<Bands>(model ? bandsOf(model, codes) : noBands(codes));
  const bands: Bands = { ...(model ? bandsOf(model, codes) : noBands(codes)), ...typedBands };
  const [benchmarkId, setBenchmarkId] = useState(model?.benchmarkId ?? "");
  // Which indices the firm holds. Without one named here, Model performance has nothing to compare against.
  const benchmarks = useListBenchmarks<BenchmarkRow[], ApiError>();
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
  // A class is judged by its own tolerance only once all three of its bands are filled in. One or two on
  // their own would leave the other levels silently falling back to the model's, which reads as a mistake.
  const halfBanded = codes.filter((assetClass) => howFilled(bands[assetClass]) === "part");
  // How many classes are judged by something other than the model's own figures.
  const ownBandCount = codes.filter((assetClass) => howFilled(bands[assetClass]) !== "none").length;
  // Folded away by default, because most plans judge every class the same way — but opened at once on a model
  // that already has exceptions, so nothing it is carrying is hidden from whoever opened it.
  // Read from the model rather than seeded, because the firm's list of classes may not have arrived on the
  // first render — a model's exceptions would then stay folded away on the very screen that carries them.
  // Null until somebody says otherwise, and their choice stands from then on.
  const [openedOwnBands, setShowingOwnBands] = useState<boolean | null>(null);
  const showingOwnBands = openedOwnBands ?? ownBandCount > 0;
  // Most plans allow the same distance either way, so the second half is asked for only where it is wanted —
  // but opened at once on a model that already allows different distances, so nothing it carries is hidden.
  // A plan may want the money spread by country or by line of business as well as by asset class. Separate
  // questions, not a breakdown of the split above: a plan can want a third in Asia whatever classes it is in.
  const [countries, setCountries] = useState<TypedShare[]>(sharesOf(model?.geographyTargets));
  const [sectors, setSectors] = useState<TypedShare[]>(sharesOf(model?.sectorTargets));
  const [chosenTwoSided, setTwoSided] = useState<boolean | null>(null);
  const twoSided = chosenTwoSided ?? anyTwoSided(bands);
  const [typedLines, setLines] = useState<Lines>(model ? linesOf(model, codes) : noLines(codes));
  const lines: Lines = { ...(model ? linesOf(model, codes) : noLines(codes)), ...typedLines };
  const [changeNote, setChangeNote] = useState("");
  // A class broken into lines has to be wholly accounted for: 8% belonging to nothing is not a plan.
  // A class with a target and no lines yet is one somebody could break down.
  const breakable = codes.filter(
    (assetClass) =>
      lines[assetClass].length === 0 && isNumber(targets[assetClass]) && Number(targets[assetClass]) > 0,
  );
  const shortLines = codes.filter((assetClass) => {
    const inClass = lines[assetClass];
    if (inClass.length === 0) return false;
    return inClass.some((line) => !isNumber(line.shareOfClass)) || addsInClass(inClass) !== 100;
  });
  const ownBands = { "Worth watching from": watchAt, "At the edge from": edgeAt, "Breached from": breachAt };
  const unreadableBands = Object.entries(ownBands)
    .filter(([, typed]) => !isNumber(typed))
    .map(([label]) => label);
  // Letters in a figure box are not a small mistake to round away: nothing is saved until they are numbers.
  const readable =
    unreadable.length === 0 && unreadableBands.length === 0 && halfBanded.length === 0 && overWhole.length === 0
    && shortLines.length === 0 && codes.every((a) => lines[a].every((line) => line.name.trim() !== ""));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!readable || !addsUp) return;
    const wanted: Record<string, number> = {};
    for (const assetClass of codes) {
      if (targets[assetClass].trim()) wanted[assetClass] = Number(targets[assetClass]);
    }
    // Only the classes given all three of their own bands; the rest are judged by the model's.
    const perClass: Record<string, BandRequest> = {};
    for (const assetClass of codes) {
      const band = bands[assetClass];
      if (howFilled(band) === "all") {
        perClass[assetClass] = {
          basis: band.basis,
          watchAt: Number(band.watchAt),
          edgeAt: Number(band.edgeAt),
          breachAt: Number(band.breachAt),
          // Left out where both sides are the same, which the API reads as the same distance either way.
          watchBelow: twoSided ? Number(band.watchBelow) : null,
          edgeBelow: twoSided ? Number(band.edgeBelow) : null,
          breachBelow: twoSided ? Number(band.breachBelow) : null,
        };
      }
    }
    onSave({
      name,
      description: description.trim() || null,
      riskProfile,
      status,
      targets: wanted,
      watchAt: Number(watchAt),
      edgeAt: Number(edgeAt),
      breachAt: Number(breachAt),
      bands: perClass,
      benchmarkId: benchmarkId || null,
      geographyTargets: asTargets(countries),
      sectorTargets: asTargets(sectors),
      // Only the classes somebody has actually broken down; the rest stay a single target.
      subAllocations: Object.fromEntries(
        codes.filter((assetClass) => lines[assetClass].length > 0).map((assetClass) => [
          assetClass,
          lines[assetClass].map((line) => ({
            name: line.name.trim(),
            shareOfClass: Number(line.shareOfClass),
            band:
              howFilled(line.band) === "all"
                ? {
                    basis: "ABSOLUTE" as const,
                    watchAt: Number(line.band.watchAt),
                    edgeAt: Number(line.band.edgeAt),
                    breachAt: Number(line.band.breachAt),
                    watchBelow: null,
                    edgeBelow: null,
                    breachBelow: null,
                  }
                : null,
          })),
        ]),
      ),
      changeNote: changeNote.trim() || null,
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
            <Field id="model-risk" label="Risk profile" required error={errors.fields.riskProfile}>
              <TextInput
                {...describedBy("model-risk", errors.fields.riskProfile)}
                id="model-risk"
                placeholder="Balanced"
                value={riskProfile}
                onChange={(event) => setRiskProfile(event.target.value)}
              />
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

          <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
              </div>
            ))}
          </div>

          {/* Each class the committee has broken down, set out under it. */}
          {codes.filter((assetClass) => lines[assetClass].length > 0).map((assetClass) => (
            <div key={assetClass} className="mt-3 rounded-lg border border-line bg-slate-50/50 p-3">
              <p className="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink-soft">
                <span>Inside {(names[assetClass] ?? assetClass)} — name, share of the class, its own band</span>
                <span className={cn("tabular-nums", addsInClass(lines[assetClass]) === 100 ? "text-emerald-700" : "text-amber-700")}>
                  {addsInClass(lines[assetClass])}% of the class
                </span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {lines[assetClass].map((line, at) => (
                  <li key={at} className="flex items-center gap-2">
                    <TextInput
                      aria-label={`Name of line ${at + 1} inside ${(names[assetClass] ?? assetClass)}`}
                      placeholder="US large-cap"
                      className="flex-1"
                      value={line.name}
                      onChange={(event) =>
                        setLines({
                          ...lines,
                          [assetClass]: lines[assetClass].map((one, which) =>
                            which === at ? { ...one, name: event.target.value } : one,
                          ),
                        })
                      }
                    />
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
                    {/* Where this line wanders differently from its class. Left empty it is judged by the
                        class, which is in turn judged by the model. */}
                    <div className="w-20 shrink-0">
                      <TextInput
                        aria-label={`Breach band for line ${at + 1} inside ${(names[assetClass] ?? assetClass)}`}
                        inputMode="decimal"
                        className="text-right"
                        placeholder={`\u00b1${bands[assetClass].breachAt || breachAt}`}
                        value={line.band.breachAt}
                        onChange={(event) =>
                          setLines({
                            ...lines,
                            [assetClass]: lines[assetClass].map((one, which) => {
                              if (which !== at) return one;
                              const breach = asFigure(event.target.value, one.band.breachAt);
                              // A line is given a whole band or none. The watch and edge levels follow the
                              // breach in the proportion the model itself uses, so one box is enough to type
                              // and the three levels cannot be left in an order that makes no sense.
                              const scale = Number(breachAt) > 0 ? Number(breach) / Number(breachAt) : 0;
                              return breach.trim() === "" || !isNumber(breach)
                                ? { ...one, band: { ...NO_BAND, breachAt: breach } }
                                : {
                                    ...one,
                                    band: {
                                      ...NO_BAND,
                                      watchAt: String(Math.round(Number(watchAt) * scale * 10) / 10),
                                      edgeAt: String(Math.round(Number(edgeAt) * scale * 10) / 10),
                                      breachAt: breach,
                                    },
                                  };
                            }),
                          })
                        }
                      />
                    </div>
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

          {shortLines.length > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              The lines inside {andList(shortLines.map((assetClass) => (names[assetClass] ?? assetClass)))} do not come
              to 100% of the class. Every part of a class a plan breaks down has to belong to something.
            </p>
          )}
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
            <span
              className={cn(
                "text-xs",
                untouched ? "text-ink-muted" : addsUp ? "font-medium text-emerald-700" : "font-medium text-amber-700",
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
          {errors.fields.targets && <p className="mt-1 text-xs text-red-600">{errors.fields.targets}</p>}
        </fieldset>

        {/* Tolerance: what every class is judged by, and then — only if asked for — the exceptions. */}
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            How far is too far
          </legend>
          <p className="text-xs text-ink-muted">
            How many percentage points a class may wander from its target before it is worth looking at.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field id="watch-at" label="Worth watching from" error={errors.fields.watchAt}>
              <TextInput id="watch-at" inputMode="decimal" value={watchAt} onChange={(event) => setWatchAt(asFigure(event.target.value, watchAt))} />
            </Field>
            <Field id="edge-at" label="At the edge from" error={errors.fields.edgeAt}>
              <TextInput id="edge-at" inputMode="decimal" value={edgeAt} onChange={(event) => setEdgeAt(asFigure(event.target.value, edgeAt))} />
            </Field>
            <Field id="breach-at" label="Breached from" error={errors.fields.breachAt}>
              <TextInput id="breach-at" inputMode="decimal" value={breachAt} onChange={(event) => setBreachAt(asFigure(event.target.value, breachAt))} />
            </Field>
          </div>
          {unreadableBands.length > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              {andList(unreadableBands)} {unreadableBands.length === 1 ? "is not a number" : "are not numbers"}.
              A band is a distance from the target in percentage points, such as 2 or 4.
            </p>
          )}

          {/* Most plans judge every class the same way, so the exceptions stay folded away until wanted. */}
          <button
            type="button"
            onClick={() => setShowingOwnBands((was) => !was)}
            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
          >
            {showingOwnBands ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
            Let a class wander differently
            {ownBandCount > 0 && (
              <span className="rounded-full bg-primary-50 px-1.5 py-0.5 font-semibold text-primary-700 tabular-nums">
                {ownBandCount}
              </span>
            )}
          </button>

          {showingOwnBands && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <p className="text-xs text-ink-muted">
                Cash moves with every payment in and out, so it is usually allowed to wander further than an
                equity target meant to be held. A class left empty is judged by the figures above, shown greyed.
                Measured in <span className="font-medium text-ink">points</span> is a fixed distance from the
                target; <span className="font-medium text-ink">% of target</span> is a share of it, so the same
                rule holds a large class loosely and a small one tightly.
              </p>
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={twoSided}
                  onChange={(event) => setTwoSided(event.target.checked)}
                  className="size-4 rounded border-line text-primary-600 focus:ring-primary-600/30"
                />
                Allow a different distance under the target than over it
              </label>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                      <th scope="col" className="py-1.5 pr-3">Asset class</th>
                      <th scope="col" className="px-2 py-1.5">Measured in</th>
                      <th scope="col" className="px-2 py-1.5">{twoSided ? "Watching over" : "Watching"}</th>
                      <th scope="col" className="px-2 py-1.5">{twoSided ? "Edge over" : "Edge"}</th>
                      <th scope="col" className={twoSided ? "px-2 py-1.5" : "py-1.5 pl-2"}>
                        {twoSided ? "Breached over" : "Breached"}
                      </th>
                      {twoSided && (
                        <>
                          <th scope="col" className="px-2 py-1.5">Watching under</th>
                          <th scope="col" className="px-2 py-1.5">Edge under</th>
                          <th scope="col" className="py-1.5 pl-2">Breached under</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((assetClass) => {
                      const band = bands[assetClass];
                      const change = (part: BandFigure) => (event: ChangeEvent<HTMLInputElement>) =>
                        setBands({
                          ...bands,
                          [assetClass]: { ...band, [part]: asFigure(event.target.value, band[part]) },
                        });
                      // A relative band is a share of the target, so the model's own points mean nothing as
                      // a hint for it.
                      const hint = (points: string, share: string) =>
                        band.basis === "RELATIVE" ? share : points;
                      return (
                        <tr key={assetClass}>
                          <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink">
                            {(names[assetClass] ?? assetClass)}
                          </th>
                          <td className="px-2 py-1.5">
                            <SelectInput
                              aria-label={`${(names[assetClass] ?? assetClass)} measured in`}
                              value={band.basis ?? "ABSOLUTE"}
                              className="w-auto"
                              onChange={(event) =>
                                setBands({
                                  ...bands,
                                  [assetClass]: { ...band, basis: event.target.value as BandRequestBasis },
                                })
                              }
                            >
                              <option value="ABSOLUTE">points</option>
                              <option value="RELATIVE">% of target</option>
                            </SelectInput>
                          </td>
                          <td className="px-2 py-1.5">
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} worth watching from`}
                              inputMode="decimal"
                              placeholder={hint(watchAt, "10")}
                              value={band.watchAt}
                              onChange={change("watchAt")}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} at the edge from`}
                              inputMode="decimal"
                              placeholder={hint(edgeAt, "15")}
                              value={band.edgeAt}
                              onChange={change("edgeAt")}
                            />
                          </td>
                          <td className={twoSided ? "px-2 py-1.5" : "py-1.5 pl-2"}>
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} breached from`}
                              inputMode="decimal"
                              placeholder={hint(breachAt, "20")}
                              value={band.breachAt}
                              onChange={change("breachAt")}
                            />
                          </td>
                          {twoSided && (
                            <>
                              <td className="px-2 py-1.5">
                                <TextInput
                                  aria-label={`${(names[assetClass] ?? assetClass)} worth watching under`}
                                  inputMode="decimal"
                                  placeholder={band.watchAt || hint(watchAt, "10")}
                                  value={band.watchBelow}
                                  onChange={change("watchBelow")}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <TextInput
                                  aria-label={`${(names[assetClass] ?? assetClass)} at the edge under`}
                                  inputMode="decimal"
                                  placeholder={band.edgeAt || hint(edgeAt, "15")}
                                  value={band.edgeBelow}
                                  onChange={change("edgeBelow")}
                                />
                              </td>
                              <td className="py-1.5 pl-2">
                                <TextInput
                                  aria-label={`${(names[assetClass] ?? assetClass)} breached under`}
                                  inputMode="decimal"
                                  placeholder={band.breachAt || hint(breachAt, "20")}
                                  value={band.breachBelow}
                                  onChange={change("breachBelow")}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {halfBanded.length > 0 && (
                <p className="text-xs text-red-600">
                  {andList(halfBanded.map((assetClass) => (names[assetClass] ?? assetClass)))}{" "}
                  {halfBanded.length === 1 ? "has" : "have"} only part of a tolerance. Give all three levels, or
                  leave all three empty to use the figures above.
                </p>
              )}
              {errors.fields.bands && <p className="text-xs text-red-600">{errors.fields.bands}</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-line px-4 pt-2 pb-4">
          <legend className="px-1.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Where in the world, and in what
          </legend>
          <p className="max-w-prose text-xs text-ink-muted">
            A separate question from the split above, not a breakdown of it: a plan can want a third of the
            money in one country whichever classes it arrives in. Read against the holdings written down line
            by line, because only a line says where it is — a class recorded as one figure says nothing.
            Leave either empty and the plan asks nothing of it.
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <Spread
              label="By country"
              hint="Two-letter codes, such as US or IN."
              placeholder="US"
              lines={countries}
              onChange={setCountries}
            />
            <Spread
              label="By sector"
              hint="As the firm writes them, such as Technology."
              placeholder="Technology"
              lines={sectors}
              onChange={setSectors}
            />
          </div>
          {errors.fields.geographyTargets && (
            <p className="mt-2 text-xs text-red-600">{errors.fields.geographyTargets}</p>
          )}
          {errors.fields.sectorTargets && (
            <p className="mt-2 text-xs text-red-600">{errors.fields.sectorTargets}</p>
          )}
        </fieldset>

        <Field
          id="model-note"
          label="What changed"
          hint="Kept on the plan's version history. Left empty, the platform writes down what moved."
          error={errors.fields.changeNote}
        >
          <TextInput
            id="model-note"
            placeholder="Annual strategic review; alternatives added"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
          />
        </Field>

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
