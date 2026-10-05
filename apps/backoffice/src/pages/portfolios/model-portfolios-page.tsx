import { ApiError } from "@atomprive/api-client";
import {
  getListModelPortfoliosQueryKey,
  useCreateModelPortfolio,
  useDeleteModelPortfolio,
  useListBenchmarks,
  useListModelPortfolios,
  useUpdateModelPortfolio,
  type BenchmarkRow,
  type ModelRequest,
  type ModelRow,
  type ModelsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { ListPageHeader, RecordList } from "../../components/record-list";
import { formatRelative } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { asFigure } from "../../lib/figures";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { barFor, useAssetClasses } from "./asset-classes";
import {
  averageDriftLabel,
  modelStatusLabels,
  modelStatusTones,
  underManagementLabel,
  type ModelStatus,
} from "./portfolio-labels";

/** A model as the form holds it: every target typed, so an empty box reads as nothing rather than zero. */
type Targets = Record<string, string>;

/** One class's own tolerance, as the form holds it. All three empty means it is judged by the model's. */
type TypedBand = { watchAt: string; edgeAt: string; breachAt: string };

type Bands = Record<string, TypedBand>;

const NO_BAND: TypedBand = { watchAt: "", edgeAt: "", breachAt: "" };

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
        watchAt: String(band.watchAt),
        edgeAt: String(band.edgeAt),
        breachAt: String(band.breachAt),
      };
    }
  }
  return typed;
}

/** How much of a class's own tolerance has been filled in: none, all three, or something in between. */
function howFilled(band: TypedBand) {
  const filled = [band.watchAt, band.edgeAt, band.breachAt].filter((one) => one.trim() !== "").length;
  return filled === 0 ? "none" : filled === 3 ? "all" : "part";
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
            watchAt: String(line.band.watchAt),
            edgeAt: String(line.band.edgeAt),
            breachAt: String(line.band.breachAt),
          }
        : { watchAt: "", edgeAt: "", breachAt: "" },
    }));
  }
  return held;
}

function blankLine(): TypedLine {
  return { name: "", shareOfClass: "", band: { watchAt: "", edgeAt: "", breachAt: "" } };
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
export function ModelPortfoliosPage() {
  const queryClient = useQueryClient();
  const models = useListModelPortfolios<ModelsPage, ApiError>();
  const { all } = useAssetClasses();
  // Every class, not only those still in use: a model written before one was retired still targets it, and a
  // bar that quietly left the slice out would show a plan that no longer came to 100%.
  const codes = all.map((one) => one.code);
  const canChange = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const [editing, setEditing] = useState<ModelRow | "new" | null>(null);
  const [removing, setRemoving] = useState<ModelRow | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [search, setSearch] = useState("");

  function kept() {
    setEditing(null);
    setRemoving(null);
    setErrors(noErrors);
    void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
  }
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useCreateModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const update = useUpdateModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const remove = useDeleteModelPortfolio<ApiError>({ mutation: { onSuccess: kept, onError } });
  const busy = create.isPending || update.isPending || remove.isPending;

  if (models.isError) {
    return <Alert tone="danger">{models.error.message}</Alert>;
  }
  const rows = models.data?.items ?? [];
  const looking = search.trim().toLowerCase();
  const shown = looking
    ? rows.filter((model) =>
        `${model.name} ${model.description ?? ""} ${model.riskProfile}`.toLowerCase().includes(looking),
      )
    : rows;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Model portfolios"
        lead="What a client's money is supposed to be spread across, and how far it may wander before somebody looks."
      >
        {canChange && (
          <Button
            onClick={() => {
              setErrors(noErrors);
              setEditing("new");
            }}
          >
            <Plus aria-hidden="true" />
            New model
          </Button>
        )}
      </ListPageHeader>

      <RecordList
        caption="Model portfolios"
        subtitle="By name"
        filters={
          <label className="w-full max-w-sm">
            <span className="sr-only">Search models</span>
            <TextInput
              id="model-search"
              value={search}
              placeholder="Search models"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        }
        filtered={search.trim() !== ""}
        onClear={() => setSearch("")}
        head={
          <>
            <th scope="col" className="px-5 py-3 text-left font-semibold">Model</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Risk profile</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Clients</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">AUM tracked</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Revision</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Avg drift</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Last updated</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </>
        }
        columns={9}
        loading={models.isLoading}
        empty={
          shown.length > 0 ? undefined : search.trim() ? (
            "No model matches what you searched for."
          ) : (
            "No model portfolios yet. A client measured against none has nothing to drift from."
          )
        }
        page={0}
        size={shown.length || 1}
        total={0}
        noun={["model", "models"]}
        onPage={() => undefined}
        onSize={() => undefined}
      >
        {shown.map((model) => (
          <tr key={model.id} className="border-t border-line">
            <td className="px-5 py-3">
              <p className="font-semibold text-ink">{model.name}</p>
              {model.description && <p className="text-xs text-ink-muted">{model.description}</p>}
              <div className="mt-1.5 flex h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                {codes.filter((assetClass) => model.targets[assetClass]).map((assetClass) => (
                  <span
                    key={assetClass}
                    className={cn("h-full", barFor(assetClass, all))}
                    style={{ width: `${model.targets[assetClass]}%` }}
                  />
                ))}
              </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">{model.riskProfile}</td>
            <td className="px-4 py-3 text-right tabular-nums">{model.clients}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {model.aumTracked > 0 ? (
                <span className="font-semibold text-ink">
                  {underManagementLabel(model.aumTracked, model.aumCurrency)}
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
              {/* A client whose currency has no rate on file is missing from the total, so the total says so
                  rather than quietly being short. */}
              {model.aumUnconverted > 0 && (
                <span className="mt-0.5 block text-2xs font-normal text-amber-700">
                  {model.aumUnconverted} not converted
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-ink-soft">v{model.revision}</td>
            <td
              className={cn(
                "px-4 py-3 text-right font-semibold whitespace-nowrap",
                model.averageDrift == null
                  ? "text-ink-muted"
                  : model.averageDrift >= model.breachAt
                    ? "text-red-600"
                    : model.averageDrift >= model.watchAt
                      ? "text-amber-700"
                      : "text-emerald-700",
              )}
            >
              {model.averageDrift == null ? "—" : averageDriftLabel(model.averageDrift)}
            </td>
            <td className="px-4 py-3">
              <Badge tone={modelStatusTones[model.status as ModelStatus]}>
                {modelStatusLabels[model.status as ModelStatus]}
              </Badge>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(model.updatedAt)}</td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {/* Opening a plan is reading it in full. Changing it is a second, deliberate step. */}
              <Link to={`/model-portfolios/${model.id}`} className="text-sm font-medium text-primary-700 hover:underline">
                Open
              </Link>
              {canChange && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setErrors(noErrors);
                      setEditing(model);
                    }}
                    className="ml-3 text-sm font-medium text-primary-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(model)}
                    className="ml-3 text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </RecordList>

      {editing && (
        <ModelDialog
          model={editing === "new" ? null : editing}
          errors={errors}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(data) =>
            editing === "new"
              ? create.mutate({ data })
              : update.mutate({ id: editing.id, data })
          }
        />
      )}

      <Dialog open={removing !== null} title="Delete this model?" onClose={() => setRemoving(null)}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {removing?.name} goes for good. A model clients are measured against can't be deleted; take them off
            it first.
          </p>
          {errors.form && <Alert tone="danger">{errors.form}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => removing && remove.mutate({ id: removing.id })}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ModelDialog({
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
  const [targets, setTargets] = useState<Targets>(model ? targetsOf(model, codes) : noTargets(codes));
  const [watchAt, setWatchAt] = useState(String(model?.watchAt ?? 2));
  const [edgeAt, setEdgeAt] = useState(String(model?.edgeAt ?? 4));
  const [breachAt, setBreachAt] = useState(String(model?.breachAt ?? 6));
  const [bands, setBands] = useState<Bands>(model ? bandsOf(model, codes) : noBands(codes));
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
  const [showingOwnBands, setShowingOwnBands] = useState(ownBandCount > 0);
  const [lines, setLines] = useState<Lines>(model ? linesOf(model, codes) : noLines(codes));
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
    const perClass: Record<string, { watchAt: number; edgeAt: number; breachAt: number }> = {};
    for (const assetClass of codes) {
      const band = bands[assetClass];
      if (howFilled(band) === "all") {
        perClass[assetClass] = {
          watchAt: Number(band.watchAt),
          edgeAt: Number(band.edgeAt),
          breachAt: Number(band.breachAt),
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
                    watchAt: Number(line.band.watchAt),
                    edgeAt: Number(line.band.edgeAt),
                    breachAt: Number(line.band.breachAt),
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
                                ? { ...one, band: { watchAt: "", edgeAt: "", breachAt: breach } }
                                : {
                                    ...one,
                                    band: {
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
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                      <th scope="col" className="py-1.5 pr-3">Asset class</th>
                      <th scope="col" className="px-2 py-1.5">Watching</th>
                      <th scope="col" className="px-2 py-1.5">Edge</th>
                      <th scope="col" className="py-1.5 pl-2">Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((assetClass) => {
                      const band = bands[assetClass];
                      const change = (part: keyof TypedBand) => (event: ChangeEvent<HTMLInputElement>) =>
                        setBands({
                          ...bands,
                          [assetClass]: { ...band, [part]: asFigure(event.target.value, band[part]) },
                        });
                      return (
                        <tr key={assetClass}>
                          <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink">
                            {(names[assetClass] ?? assetClass)}
                          </th>
                          <td className="px-2 py-1.5">
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} worth watching from`}
                              inputMode="decimal"
                              placeholder={watchAt}
                              value={band.watchAt}
                              onChange={change("watchAt")}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} at the edge from`}
                              inputMode="decimal"
                              placeholder={edgeAt}
                              value={band.edgeAt}
                              onChange={change("edgeAt")}
                            />
                          </td>
                          <td className="py-1.5 pl-2">
                            <TextInput
                              aria-label={`${(names[assetClass] ?? assetClass)} breached from`}
                              inputMode="decimal"
                              placeholder={breachAt}
                              value={band.breachAt}
                              onChange={change("breachAt")}
                            />
                          </td>
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
