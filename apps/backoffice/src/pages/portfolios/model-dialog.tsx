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
  type SubAllocationRequest,
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

/**
 * What this model already holds its sub-assets to, read off the first line that carries a figure.
 *
 * <p>They are all written together and all the same, so the first one that has anything to say speaks for
 * the rest. A model written before the firm settled on a figure has none at all, and the firm's own is
 * offered instead of a blank box.
 */
function firstLineBand(model: ModelRow | null): string | null {
  for (const lines of Object.values(model?.subAllocations ?? {})) {
    for (const line of lines ?? []) {
      if (line.band?.breachAt != null) return String(line.band.breachAt);
    }
  }
  return null;
}

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

/**
 * The one figure every class on this model is held to, where there is one.
 *
 * <p>Nothing where the classes carry different figures, which is what tells the form to open with the
 * per-class boxes showing: a model written with eight different tolerances must not be reduced to one
 * the moment somebody opens it to change its name.
 */
function oneBandForEveryClass(model: ModelRow | null, codes: string[]): string | null {
  if (model == null) return null;
  const said = codes
    .filter((assetClass) => model.bands?.[assetClass] != null)
    .map((assetClass) => String(model.bands![assetClass]!.breachAt));
  if (said.length === 0) return null;
  return said.every((one) => one === said[0]) ? said[0] : null;
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
type TypedLine = {
  name: string;
  shareOfClass: string;
  written: boolean;
  /**
   * The lines inside this one, which are shares of it rather than of the class above it. Empty for a line
   * nobody has broken down, which is most of them.
   */
  lines: TypedLine[];
};

type Lines = Record<string, TypedLine[]>;

function noLines(codes: string[]): Lines {
  return Object.fromEntries(codes.map((code) => [code, []]));
}

function linesOf(model: ModelRow, codes: string[]): Lines {
  const held = noLines(codes);
  for (const assetClass of codes) {
    held[assetClass] = (model.subAllocations?.[assetClass] ?? []).map(typedFrom);
  }
  return held;
}

/** One saved line as the form holds it, and whatever is inside it, however deep that goes. */
function typedFrom(line: SubAllocationRequest): TypedLine {
  return {
    name: line.name,
    // Settled once the names are in hand, below: a model's own line may be one nobody else has used.
    written: false,
    shareOfClass: String(line.shareOfClass),
    lines: (line.lines ?? []).map(typedFrom),
  };
}

function blankLine(): TypedLine {
  return { name: "", shareOfClass: "", written: false, lines: [] };
}

/** The value the list carries for writing a name nobody has used before. Never a name itself. */
const WRITE_ONE = "\u0000write";

/** What the lines inside one class come to; letters count as nothing until they are numbers. */
function addsInClass(inClass: TypedLine[]) {
  return inClass.reduce((sum, line) => sum + (isNumber(line.shareOfClass) ? Number(line.shareOfClass) : 0), 0);
}

/**
 * Every level inside a class that does not come to the whole of what it sits in, named so the form can say
 * which one.
 *
 * <p>Walked rather than checked once. The lines inside a class come to the class; the lines inside one of
 * those come to that line — the same rule at every depth, and the deepest one is where it is easiest to
 * leave a few percent belonging to nothing. A message that only said "Equities" would send somebody
 * looking at a level that was already right.
 */
function levelsThatFallShort(inClass: TypedLine[], where: string): { where: string; comesTo: number }[] {
  if (inClass.length === 0) return [];
  const wrong: { where: string; comesTo: number }[] = [];
  const comesTo = addsInClass(inClass);
  if (inClass.some((line) => !isNumber(line.shareOfClass)) || comesTo !== 100) {
    wrong.push({ where, comesTo });
  }
  for (const line of inClass) {
    wrong.push(...levelsThatFallShort(line.lines, line.name.trim() || where));
  }
  return wrong;
}

/** Every level that names the same thing twice among its own siblings, named so the form can say which. */
function levelsNamingTwice(inClass: TypedLine[], where: string): string[] {
  if (inClass.length === 0) return [];
  const said = inClass.map((line) => line.name.trim()).filter((name) => name !== "");
  const wrong = new Set(said).size === said.length ? [] : [where];
  for (const line of inClass) {
    wrong.push(...levelsNamingTwice(line.lines, line.name.trim() || where));
  }
  return wrong;
}

/** Whether every line at every depth has been named. A nameless line is a share belonging to nothing. */
function allNamed(inClass: TypedLine[]): boolean {
  return inClass.every((line) => line.name.trim() !== "" && allNamed(line.lines));
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
function ofWholePortfolio(ofWhatItSitsIn: number | null, shareOfParent: string): number | null {
  if (ofWhatItSitsIn === null || !isNumber(shareOfParent)) return null;
  return (ofWhatItSitsIn * Number(shareOfParent)) / 100;
}

/**
 * A share as the firm wrote it, with nothing added and nothing taken away.
 *
 * <p>Four places kept, trailing zeros dropped. A quarter of a quarter of a quarter is 1.5625% of the
 * portfolio, and rounding that to 1.56% on the one screen where somebody is checking the arithmetic hides
 * the figure they came to look at — while printing 25.0000% for a class beside it would be noise dressed
 * as precision. So the places are there when the number needs them and gone when it does not.
 */
function asPercent(share: number): string {
  const places = share.toFixed(4);
  return places.replace(/0+$/, "").replace(/\.$/, "");
}

/** Where a name sits, which is what makes it the same name or a different one: its class and its parent. */
function nameKey(assetClass: string, under: string) {
  return under === "" ? assetClass : `${assetClass}\u0000${under}`;
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
  function gather(assetClass: string, under: string, inClass: SubAllocationRequest[]) {
    for (const line of inClass) {
      const name = line.name.trim();
      if (name === "") continue;
      (seen[nameKey(assetClass, under)] ??= new Set()).add(name);
      // Keyed by where it sits, so the list offered under one line is the list of what has gone under it.
      // "Large cap" belongs under Indian equities and means nothing under Alternatives; one list for the
      // whole class would offer each to the other and read as a firm-wide vocabulary that does not exist.
      gather(assetClass, name, line.lines ?? []);
    }
  }
  for (const model of models) {
    for (const [assetClass, inClass] of Object.entries(model.subAllocations ?? {})) {
      gather(assetClass, "", inClass);
    }
  }
  return Object.fromEntries(
    Object.entries(seen).map(([where, names]) => [where, [...names].sort()]),
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
  signOff,
}: {
  model: ModelRow | null;
  errors: FormErrors;
  busy: boolean;
  onClose: () => void;
  onSave: (data: ModelRequest) => void;
  /**
   * Where this edit has to be signed off rather than written: a live plan, which every client on it is
   * judged by. Absent for a draft, which nobody is measured against.
   */
  signOff?: { why: string; onWhy: (why: string) => void; holders: number };
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
  // One figure for every sub-asset in the model, written against each line rather than left to inherit
  // the class's. The two are deliberately different — a class may wander further than the lines inside
  // it — and only saying both keeps them that way: a line left to inherit carries the class's figure, so
  // editing a model would quietly widen every line in it.
  const [typedLineBand, setLineBand] = useState<string | null>(null);
  const lineBand = typedLineBand ?? firstLineBand(model) ?? "5";
  const [typedBreaches, setBreaches] = useState<Breaches>(
    model ? breachesOf(model, codes) : noBreaches(codes),
  );
  const perClass: Breaches = { ...(model ? breachesOf(model, codes) : noBreaches(codes)), ...typedBreaches };
  /*
   * One figure for every class, with the boxes beside each class kept back until somebody wants them
   * apart. A firm that holds every class to ten and every line inside them to five types two numbers;
   * before, it typed ten eight times over and the one it mistyped was the one nobody noticed.
   *
   * Opened on what the model already is. A model whose classes carry different figures opens with them
   * showing — reducing eight tolerances to one because somebody came to change the model's name would
   * rewrite the plan behind their back.
   */
  const [apart, setApart] = useState(() => model != null && oneBandForEveryClass(model, codes) == null
    && codes.some((assetClass) => model.bands?.[assetClass] != null));
  const [typedClassBand, setClassBand] = useState<string | null>(null);
  const classBand = typedClassBand ?? oneBandForEveryClass(model, codes) ?? "10";
  // Held to the classes the plan actually asks for something of. A class the model names at nothing is
  // on the plan and shown, but writing it a tolerance is writing a rule about money nobody is holding
  // there — and the form never wrote one before, so one figure for all must not quietly start.
  const breaches: Breaches = apart
    ? perClass
    : Object.fromEntries(codes.map((assetClass) =>
        [assetClass, (isNumber(targets[assetClass]) && Number(targets[assetClass]) > 0) ? classBand : ""]));
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
  // The same sub-asset twice in one place. Taken off the list where it is picked, but a name written by
  // hand can still land on one already there, so it is checked rather than only made awkward. Checked at
  // every depth against its own siblings, which is the only set it has to be unique in: "Large cap" may
  // sit under Indian equities and under US equities at once, and those are two different things.
  const twiceNamed = codes.flatMap((assetClass) =>
    levelsNamingTwice(lines[assetClass], names[assetClass] ?? assetClass));
  const shortLines = codes.flatMap((assetClass) =>
    levelsThatFallShort(lines[assetClass], names[assetClass] ?? assetClass));
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
    && codes.every((assetClass) => allNamed(lines[assetClass]));

  /**
   * One line and everything inside it, as the API takes it.
   *
   * <p>The band is written down rather than left to inherit. A line with nothing of its own is held to its
   * class's figure, and the class is allowed to wander further than the lines inside it — so inheriting
   * would widen every line in the model the moment somebody saved it. The same figure goes on a line three
   * deep as on one directly in its class: the firm asked for one figure per model, and a line that is a
   * quarter of a quarter is not a reason to hold it to a different one.
   */
  function asked(line: TypedLine): SubAllocationRequest {
    return {
      name: line.name.trim(),
      shareOfClass: Number(line.shareOfClass),
      band: isNumber(lineBand) && Number(lineBand) > 0
        ? {
            basis: "ABSOLUTE" as const,
            watchAt: Number(lineBand),
            edgeAt: Number(lineBand),
            breachAt: Number(lineBand),
            watchBelow: null,
            edgeBelow: null,
            breachBelow: null,
          }
        : null,
      lines: line.lines.length > 0 ? line.lines.map(asked) : null,
    };
  }

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
          lines[assetClass].map(asked),
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
            A class may be allowed further than the lines inside it, so the sub-assets carry their own
            figure, said once below for the whole model: a line asked for 10% of its class, held to five,
            is sound between 5% and 15% of that class. The same figure holds a line broken down further,
            and one broken down again after that — and it is read against the class every time, however
            deep the line sits.
          </p>

          {/* Said once each, for the classes and for the lines inside them, rather than typed onto every
              row. A firm holding every class to ten and every line to five types two numbers here; it
              used to type ten as many times as it had classes, and the one it mistyped was the one
              nobody noticed. */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2.5">
            <label htmlFor="class-band" className="text-xs font-medium text-ink">
              Every class may wander
            </label>
            <span className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-ink-muted"
              >
                ±
              </span>
              <TextInput
                id="class-band"
                aria-label="How far every class may wander from its target before it has breached"
                inputMode="decimal"
                disabled={apart}
                className="h-8 w-24 pr-6 pl-6 text-right text-sm"
                value={apart ? "" : classBand}
                onChange={(event) => setClassBand(asFigure(event.target.value, classBand))}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-muted"
              >
                %
              </span>
            </span>
            <span className="text-xs text-ink-muted">
              {apart
                ? "each class is held to its own figure, set beside it below."
                : "of the whole portfolio, either side of its target."}
            </span>
            {/* Offered rather than assumed. Most plans hold every class the same, and the ones that do
                not are the ones somebody has thought about. */}
            <button
              type="button"
              onClick={() => setApart(!apart)}
              className="ml-auto text-xs font-medium text-primary-700 underline-offset-2 hover:underline"
            >
              {apart ? "Hold them all to one figure" : "Set a different figure for each class"}
            </button>
          </div>

          {/* One figure for every sub-asset in the model, under the classes it qualifies rather than
              repeated on each of the twenty-odd lines below. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2.5">
            <label htmlFor="line-band" className="text-xs font-medium text-ink">
              Every sub-asset may wander
            </label>
            <span className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-ink-muted"
              >
                ±
              </span>
              <TextInput
                id="line-band"
                aria-label="How far every sub-asset may wander from its share of its class before it has breached"
                inputMode="decimal"
                className="h-8 w-24 pr-6 pl-6 text-right text-sm"
                value={lineBand}
                onChange={(event) => setLineBand(asFigure(event.target.value, lineBand))}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-muted"
              >
                %
              </span>
            </span>
            <span className="text-xs text-ink-muted">
              of its class, either side of its own share — at every depth, however deep the line sits.
            </span>
          </div>

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
                    its target or that far under it before anybody is told.
                    Shown only where the firm has asked for them apart. Held to one figure, the box on
                    every row said the same number as the row above it and the one below, and the figure
                    that mattered was the one somebody mistyped. */}
                {apart && (
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
                    // Marked where the refusal below names this class. The message said "Equities" and
                    // nothing on the row was lit, so a reader with eight classes on screen had to work
                    // out which of sixteen boxes it meant — and the one obvious box, the class's own
                    // target, was already filled.
                    aria-invalid={unsaidBreach.includes(assetClass) || undefined}
                    className={cn("pr-7 pl-7 text-right",
                      unsaidBreach.includes(assetClass) && "border-red-600 ring-1 ring-red-600")}
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
                )}
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
              <LineList
                lines={lines[assetClass]}
                set={(next) => setLines({ ...lines, [assetClass]: next })}
                where={names[assetClass] ?? assetClass}
                ofWhatItSitsIn={isNumber(targets[assetClass]) ? Number(targets[assetClass]) : null}
                assetClass={assetClass}
                under=""
                usedNames={usedNames}
                depth={0}
              />
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

          {twiceNamed.map((where) => (
            <p key={where} className="mt-1.5 text-xs text-red-600">
              {where} names the same thing twice inside it. Each one is a line of the plan, and a line
              named twice has two targets with nothing to say which it is held to.
            </p>
          ))}

          {/* Which way, and by how much. "Do not come to 100%" was said the same whether a class was half
              written or asked for more of itself than exists — and the second is the one somebody has to
              take something off to fix. */}
          {shortLines.map(({ where, comesTo }) => (
            <p key={where} className="mt-1.5 text-xs text-red-600">
              {comesTo > 100
                ? `The lines inside ${where} come to ${comesTo.toFixed(2)}% of it. `
                  + `Take ${(comesTo - 100).toFixed(2)}% off: nothing is ever more than the whole of itself.`
                : `The lines inside ${where} come to ${comesTo.toFixed(2)}% of it. `
                  + `${(100 - comesTo).toFixed(2)}% of it belongs to nothing yet.`}
            </p>
          ))}
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
              {unsaidBreach.length === 1 ? "it" : "they"} may wander — the box marked above. Every breach
              on every client measured
              against this model is read from that figure.
            </p>
          )}
          {errors.fields.targets && <p className="mt-1 text-xs text-red-600">{errors.fields.targets}</p>}
        </fieldset>

        {/* Asked for, where there is something to overrule. The reason is what whoever signs it off is
            really being asked about: a page of targets with no sentence beside it asks somebody to agree
            to arithmetic. */}
        {signOff && (
          <div className="mt-4 rounded-xl border border-line bg-slate-50/60 px-4 py-3">
            <label htmlFor="model-why"
              className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Why it should change
            </label>
            <TextInput
              id="model-why"
              className="mt-1.5"
              value={signOff.why}
              placeholder="The committee moved the equity weight at the October review."
              onChange={(event) => signOff.onWhy(event.target.value)}
            />
            <p className="mt-2 text-xs text-ink-muted">
              This plan is live, so {signOff.holders === 0
                ? "any client put on it"
                : signOff.holders === 1 ? "the client on it" : `all ${signOff.holders} clients on it`}{" "}
              {signOff.holders === 1 ? "is" : "are"} judged by it. Somebody other than you signs this off,
              and nothing changes until they do.
            </p>
          </div>
        )}

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
          <Button type="submit"
            disabled={busy || !readable || !addsUp || (signOff !== undefined && signOff.why.trim() === "")}>
            {busy
              ? (signOff ? "Asking…" : "Saving…")
              : signOff ? "Ask for this change" : model ? "Save the model" : "Create the model"}
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
/**
 * How deep the firm writes a plan: a class, the lines inside it, and the lines inside those.
 *
 * <p>Three, because that is the plan the firm described — a main asset, its sub-assets, and theirs. The
 * store behind this holds a line at any depth, so a fourth level is a question of whether the firm wants
 * one rather than of whether anything could carry it. Offering one nobody asked for would invite a plan
 * that cannot be read on a page.
 */
const DEEPEST = 2;

/**
 * The lines inside one thing — a class, or a line of a class — and the lines inside those.
 *
 * <p>One component at every depth, calling itself, because a line is the same thing wherever it sits: a
 * name, a share of whatever it is inside, and possibly a breakdown of its own. The firm's rule is written
 * once here and therefore holds at the bottom as surely as at the top; a second editor for the third level
 * would be the same rule said twice, and the pair would drift the first time one of them was corrected.
 *
 * <p>Every share typed is a share of its immediate parent, and the figure beside it is what that comes to
 * as a share of the whole portfolio — which is what every band, drift and breach elsewhere is read
 * against. Three levels deep that is three percentages multiplied together, and nobody should be doing it
 * in their head while typing the next line.
 */
function LineList({
  lines, set, where, ofWhatItSitsIn, assetClass, under, usedNames, depth,
}: {
  lines: TypedLine[];
  set: (next: TypedLine[]) => void;
  /** What these lines are inside, as somebody reads it: "Equities", "Indian Equities". */
  where: string;
  /** What that thing is as a share of the whole portfolio, or null while it is unreadable. */
  ofWhatItSitsIn: number | null;
  assetClass: string;
  /** The line these sit inside, or empty where they sit directly in their class. */
  under: string;
  usedNames: Record<string, string[]>;
  depth: number;
}) {
  const offered = usedNames[nameKey(assetClass, under)] ?? [];

  function change(at: number, how: (line: TypedLine) => TypedLine) {
    set(lines.map((one, which) => (which === at ? how(one) : one)));
  }

  return (
    <>
      <ul className={cn("space-y-1.5", depth === 0 ? "mt-2" : "mt-1.5")}>
        {lines.map((line, at) => {
          const ofAll = ofWholePortfolio(ofWhatItSitsIn, line.shareOfClass);
          const named = line.name.trim();
          return (
            <li key={at}>
              {/* Four columns and no fifth standing empty. The two ways of naming a line are different
                  shapes — a box somebody types in, or a dropdown whose own wrapper is only as wide as the
                  word inside it — so left to themselves they lined up at none of their edges. Columns fix
                  that, but a column for the way off the list is a hole on every line that does not use
                  one, so that link went under the name with the other one. What a line comes to of the
                  whole portfolio holds a dash until it can be worked out, for the same reason: a column
                  that empties itself is a gap in the middle of the row. */}
              <div className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem_1.75rem] items-center gap-2">
                {/* Picked from the list, or written on purpose — never half way between. The firm keeps no
                    master list of sub-assets; the names live only inside the models somebody has written,
                    so those are offered and anything else has to be asked for by name. Left as a box to
                    type in, the same line went down three ways across three models and nothing joined them
                    up. */}
                {line.written || (line.name !== "" && !offered.includes(line.name)) ? (
                  <TextInput
                    aria-label={`Name of line ${at + 1} inside ${where}`}
                    placeholder="A name nobody has used yet"
                    className="min-w-0"
                    value={line.name}
                    onChange={(event) =>
                      change(at, (one) => ({ ...one, name: event.target.value, written: true }))}
                  />
                ) : (
                  <SelectInput
                    aria-label={`Name of line ${at + 1} inside ${where}`}
                    className="min-w-0 w-full"
                    value={line.name}
                    onChange={(event) =>
                      change(at, (one) =>
                        event.target.value === WRITE_ONE
                          ? { ...one, name: "", written: true }
                          : { ...one, name: event.target.value, written: false })}
                  >
                    <option value="">Pick a sub-asset…</option>
                    {/* Not the ones already spoken for beside it. A sub-asset is one line of a plan: named
                        twice it has two targets, and nothing can say which it is held to. */}
                    {offered
                      .filter((used) => used === line.name
                        || !lines.some((other, which) => which !== at && other.name === used))
                      .map((used) => (
                        <option key={used} value={used}>{used}</option>
                      ))}
                    <option value={WRITE_ONE}>Something else…</option>
                  </SelectInput>
                )}
                <div className="relative">
                  <TextInput
                    aria-label={`Share of ${where} for line ${at + 1}`}
                    inputMode="decimal"
                    className="pr-7 text-right"
                    value={line.shareOfClass}
                    onChange={(event) =>
                      change(at, (one) => ({
                        ...one,
                        shareOfClass: asFigure(event.target.value, one.shareOfClass),
                      }))}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
                    %
                  </span>
                </div>
                {/* The figure the rest of the platform actually measures against, beside the one being
                    typed: a share of a share is two sums away from it, and of a share of a share, three. */}
                <span className="text-right text-xs whitespace-nowrap tabular-nums text-ink-muted">
                  {ofAll === null ? "—" : `= ${asPercent(ofAll)}% of all`}
                </span>
                <button
                  type="button"
                  aria-label={`Remove line ${at + 1} inside ${where}`}
                  onClick={() => set(lines.filter((_, which) => which !== at))}
                  className="justify-self-end rounded p-1 text-ink-muted hover:text-rose-700"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>

              {/* What is inside this line, indented under it and ruled off, so the eye can see which share
                  belongs to which parent without reading the labels. */}
              {line.lines.length > 0 && (
                <div className="mt-1.5 ml-4 border-l-2 border-line pl-3">
                  <p className="flex items-baseline justify-between gap-2 text-2xs font-semibold text-ink-soft">
                    <span>Inside {named || `line ${at + 1}`} — name and share of it</span>
                    <span className={cn(
                      "tabular-nums",
                      addsInClass(line.lines) === 100 ? "text-emerald-700"
                        : addsInClass(line.lines) > 100 ? "text-red-600" : "text-amber-700",
                    )}>
                      {addsInClass(line.lines).toFixed(2)}% of {named || "it"}
                    </span>
                  </p>
                  <LineList
                    lines={line.lines}
                    set={(next) => change(at, (one) => ({ ...one, lines: next }))}
                    where={named || `line ${at + 1}`}
                    ofWhatItSitsIn={ofAll}
                    assetClass={assetClass}
                    under={named}
                    usedNames={usedNames}
                    depth={depth + 1}
                  />
                </div>
              )}

              {/* Offered once the line has a name, which is all it needs: what goes inside is written as
                  shares OF this line, and those can be written before anybody has said what this line is
                  of its own class. Asked for a share here too, the way in was invisible until somebody
                  filled a box they had no reason to fill first — and nothing on the row said why.
                  The name is still wanted, because the block it opens is headed with it. */}
              {(line.written
                || (line.lines.length === 0 && depth < DEEPEST - 1 && named !== "")) && (
                <span className="mt-1 ml-4 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {/* Back to the list, for a name somebody started typing. The firm keeps no master list
                      of sub-assets, so the names other models have used are all there is to offer, and a
                      line written by hand should be able to go back to them. */}
                  {line.written && (
                    <button
                      type="button"
                      className="text-2xs font-semibold text-primary-700 hover:underline"
                      onClick={() => change(at, (one) => ({ ...one, name: "", written: false }))}
                    >
                      Pick from the list
                    </button>
                  )}
                  {line.lines.length === 0 && depth < DEEPEST - 1 && named !== "" && (
                    <button
                      type="button"
                      onClick={() => change(at, (one) => ({ ...one, lines: [blankLine()] }))}
                      className="text-2xs font-semibold text-primary-700 hover:underline"
                    >
                      Break {named} down further
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => set([...lines, blankLine()])}
        className={cn("mt-2 font-semibold text-primary-700 hover:underline",
          depth === 0 ? "text-xs" : "text-2xs")}
      >
        Add another line{depth === 0 ? "" : ` inside ${where}`}
      </button>
    </>
  );
}

function classesForModel(assetClasses: ReturnType<typeof useAssetClasses>, model: ModelRow | null): string[] {
  const targeted = new Set(Object.keys(model?.targets ?? {}));
  return assetClasses.all
    .filter((one) => one.retiredAt === null || targeted.has(one.code))
    .map((one) => one.code);
}
