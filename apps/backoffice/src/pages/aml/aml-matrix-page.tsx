import { ApiError } from "@atomprive/api-client";
import {
  useAddAmlFactor,
  useChangeAmlFactor,
  useGetAmlMatrix,
  useRestoreAmlFactor,
  useRetireAmlFactor,
  useSetAmlBands,
  type BandRow,
  type FactorRow,
  type FactorRowAnsweredFrom,
  type FactorRowGroup,
  type Sheet,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useStaffUser } from "../../auth/session";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { asFigure } from "../../lib/figures";
import { hasAnyAuthority, WRITES_AML_MATRIX } from "../../lib/permissions";
import { bandTone } from "./aml-labels";

/** The parts the assessment divides into, in the order a sheet reads. */
const GROUPS: { group: FactorRowGroup; title: string }[] = [
  { group: "CUSTOMER", title: "The customer" },
  { group: "COUNTRY", title: "Country and geography" },
  { group: "PRODUCT", title: "Product and service" },
  { group: "CHANNEL", title: "How business is done" },
  { group: "VALUE", title: "Value and activity" },
];

type Answer = {
  label: string;
  score: string;
  forcesHighest: boolean;
  /** What this answer covers, as the client's record reads it. Typed as a list, kept as one line. */
  matches: string;
  whenNothingMatches: boolean;
};

type Draft = {
  group: FactorRowGroup;
  name: string;
  guidance: string;
  weight: string;
  /** The fact that answers this line, or "" for one only a person can answer. */
  answeredFrom: string;
  options: Answer[];
};

const emptyAnswer: Answer = { label: "", score: "0", forcesHighest: false, matches: "", whenNothingMatches: false };

const emptyDraft: Draft = {
  group: "CUSTOMER",
  name: "",
  guidance: "",
  weight: "1",
  answeredFrom: "",
  options: [emptyAnswer, emptyAnswer],
};

/**
 * The firm's own AML Risk Rating Matrix — Sheet 1 of the due diligence pack.
 *
 * <p>Nothing here is supplied: the lines, what each answer is worth and where the bands fall are the firm's
 * policy, and a sheet invented by the platform would be a different document wearing the same name. What the
 * platform does is the arithmetic, and refusing to score against a sheet that is not finished.
 */
export function AmlMatrixPage() {
  const mayWrite = hasAnyAuthority(useStaffUser(), ...WRITES_AML_MATRIX);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const matrix = useGetAmlMatrix<Sheet, ApiError>();
  const saved = {
    onSuccess: () => {
      setErrors(noErrors);
      setEditing(null);
      void matrix.refetch();
    },
    onError: (caught: ApiError) => setErrors(toFormErrors(caught)),
  };
  const add = useAddAmlFactor<ApiError>({ mutation: saved });
  const change = useChangeAmlFactor<ApiError>({ mutation: saved });
  const retire = useRetireAmlFactor<ApiError>({ mutation: { onSuccess: () => void matrix.refetch() } });
  const restore = useRestoreAmlFactor<ApiError>({ mutation: { onSuccess: () => void matrix.refetch() } });

  if (!matrix.data) {
    return matrix.isError ? (
      <Alert tone="danger">{matrix.error.message}</Alert>
    ) : (
      <p className="text-sm text-ink-muted">Loading the matrix…</p>
    );
  }
  const sheet = matrix.data;
  const facts = sheet.facts;
  const reads = editing ? facts.find((fact) => fact.fact === editing.draft.answeredFrom) : undefined;
  const live = sheet.factors.filter((factor) => factor.retiredAt === null);
  const retired = sheet.factors.filter((factor) => factor.retiredAt !== null);

  function save() {
    const draft = editing!.draft;
    const data = {
      group: draft.group,
      name: draft.name.trim(),
      guidance: draft.guidance.trim() || null,
      weight: Number(draft.weight) || 1,
      answeredFrom: (draft.answeredFrom || null) as FactorRowAnsweredFrom | null,
      options: draft.options
        .filter((option) => option.label.trim() !== "")
        .map((option) => ({
          label: option.label.trim(),
          score: Number(option.score) || 0,
          forcesHighest: option.forcesHighest,
          // Only a line the record answers carries covering values; for the rest they mean nothing.
          matches: draft.answeredFrom
            ? option.matches
                .split(",")
                .map((one) => one.trim())
                .filter((one) => one !== "")
            : null,
          whenNothingMatches: draft.answeredFrom ? option.whenNothingMatches : false,
        })),
    };
    if (editing!.id) change.mutate({ id: editing!.id, data });
    else add.mutate({ data });
  }

  return (
    <div className="space-y-6">
      <Link to="/aml-risk" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        AML risk
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold">The firm's AML risk matrix</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Sheet 1 of the due diligence pack. The lines, what each answer is worth and where the bands fall
            are the firm's own — the platform does the arithmetic and will not score against a sheet that
            isn't finished.
          </p>
        </div>
        {mayWrite && (
          <Button onClick={() => setEditing({ id: null, draft: emptyDraft })}>
            <Plus aria-hidden="true" />
            Add a line
          </Button>
        )}
      </header>

      {/* What stops it being usable, said rather than assumed. */}
      {sheet.complete ? (
        <Alert tone="success">The sheet is complete and clients can be scored against it.</Alert>
      ) : (
        <Alert tone="warning">
          <p>Nothing can be scored until these are settled:</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
            {sheet.faults.map((fault) => (
              <li key={fault}>{fault}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Bands bands={sheet.bands} mayWrite={mayWrite} onSaved={() => void matrix.refetch()} />

      <section className="space-y-4">
        <h2 className="text-base font-bold">The lines</h2>
        {live.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-muted">
            Nothing on the sheet yet.
          </p>
        )}
        {GROUPS.map(({ group, title }) => {
          const inGroup = live.filter((factor) => factor.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="rounded-2xl border border-line bg-white">
              <h3 className="border-b border-line px-5 py-3 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                {title}
              </h3>
              <ul className="divide-y divide-line">
                {inGroup.map((factor) => (
                  <FactorLine
                    key={factor.id}
                    factor={factor}
                    mayWrite={mayWrite}
                    onEdit={() => setEditing({ id: factor.id, draft: draftOf(factor) })}
                    onRetire={() => retire.mutate({ id: factor.id })}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {retired.length > 0 && (
        <section className="rounded-2xl border border-line bg-slate-50/60">
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Taken off the sheet</h2>
          <p className="px-5 pt-3 text-xs text-ink-muted">
            Kept rather than deleted: ratings already given were scored on these, and the record has to stay
            readable.
          </p>
          <ul className="divide-y divide-line">
            {retired.map((factor) => (
              <li key={factor.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm text-ink-soft">{factor.name}</span>
                {mayWrite && (
                  <Button variant="secondary" size="sm" onClick={() => restore.mutate({ id: factor.id })}>
                    Put it back
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={editing !== null}
        size={editing?.draft.answeredFrom ? "xl" : "lg"}
        title={editing?.id ? "Change this line" : "Add a line"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <div className="space-y-4">
            {errors.form && <Alert tone="danger">{errors.form}</Alert>}
            <div className="grid items-start gap-4 sm:grid-cols-[1fr_11rem]">
              <Field id="factor-group" label="Part of the risk" required error={errors.fields.group}>
                <SelectInput
                  id="factor-group"
                  value={editing.draft.group}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, group: event.target.value as FactorRowGroup },
                    })
                  }
                >
                  {GROUPS.map((one) => (
                    <option key={one.group} value={one.group}>
                      {one.title}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field
                id="factor-weight"
                label="Counts for"
                hint="Against the other lines."
                error={errors.fields.weight}
              >
                <TextInput
                  id="factor-weight"
                  inputMode="numeric"
                  value={editing.draft.weight}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, weight: asFigure(event.target.value, editing.draft.weight) },
                    })
                  }
                />
              </Field>
            </div>

            <Field id="factor-name" label="The line" required error={errors.fields.name}>
              <TextInput
                id="factor-name"
                value={editing.draft.name}
                placeholder="Country of residence"
                onChange={(event) =>
                  setEditing({ ...editing, draft: { ...editing.draft, name: event.target.value } })
                }
              />
            </Field>

            {/*
              Onboarding entered where a client lives and what sort of client they are. A line that names one
              of those answers itself, and nobody retypes what is already on file.
            */}
            <Field
              id="factor-answered-from"
              label="Answered from the client's record"
              hint={
                editing.draft.answeredFrom
                  ? "Say which values each answer below covers."
                  : "Leave as is for a line only a person can answer."
              }
              error={errors.fields.answeredFrom}
            >
              <SelectInput
                id="factor-answered-from"
                value={editing.draft.answeredFrom}
                onChange={(event) =>
                  setEditing({ ...editing, draft: { ...editing.draft, answeredFrom: event.target.value } })
                }
              >
                <option value="">Nothing — a person answers it</option>
                {facts.map((fact) => (
                  <option key={fact.fact} value={fact.fact}>
                    {fact.title}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              id="factor-guidance"
              label="What it is asking"
              hint="Read by whoever scores it. Optional."
              error={errors.fields.guidance}
            >
              <TextArea
                id="factor-guidance"
                rows={2}
                value={editing.draft.guidance}
                onChange={(event) =>
                  setEditing({ ...editing, draft: { ...editing.draft, guidance: event.target.value } })
                }
              />
            </Field>

            <div className="space-y-2">
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                The answers, and what each is worth
              </p>
              {errors.fields.options && <p className="text-xs text-danger-700">{errors.fields.options}</p>}
              {/* Named once, above the rows, so a bare box of digits is not left to be guessed at. */}
              {/* What the record has to say for this answer to be the one. */}
              {reads && (
                <p className="text-xs text-ink-soft">
                  This line reads <span className="font-semibold">{reads.title.toLowerCase()}</span> off the
                  client&rsquo;s record, which says: {reads.reads}. List those values against the answer each
                  belongs to, separated by commas, and mark the one to fall back on when the record says
                  something nobody listed.
                </p>
              )}
              <div
                className={cn(
                  "hidden gap-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase sm:grid",
                  reads ? "sm:grid-cols-[1.4fr_5rem_1fr_6rem_7rem_2rem]" : "sm:grid-cols-[1fr_5rem_10rem_2rem]",
                )}
              >
                <span>The answer</span>
                <span>Worth</span>
                {reads && <span>Covers</span>}
                {reads && <span>Fall back on it</span>}
                <span>Settles it on its own</span>
                <span className="sr-only">Remove</span>
              </div>
              {editing.draft.options.map((option, at) => (
                <div
                  key={at}
                  className={cn(
                    "grid items-center gap-2",
                    reads ? "sm:grid-cols-[1.4fr_5rem_1fr_6rem_7rem_2rem]" : "sm:grid-cols-[1fr_5rem_10rem_2rem]",
                  )}
                >
                  <TextInput
                    aria-label={`Answer ${at + 1}`}
                    value={option.label}
                    placeholder={at === 0 ? "A country on nobody's list" : ""}
                    onChange={(event) => setOption(editing, setEditing, at, { label: event.target.value })}
                  />
                  <TextInput
                    aria-label={`What answer ${at + 1} is worth`}
                    inputMode="numeric"
                    className="text-right"
                    value={option.score}
                    onChange={(event) =>
                      setOption(editing, setEditing, at, { score: asFigure(event.target.value, option.score) })
                    }
                  />
                  {/* The one answer that is not arithmetic: it settles the band on its own. */}
                  {reads && (
                    <TextInput
                      aria-label={`What answer ${at + 1} covers`}
                      value={option.matches}
                      placeholder="IN, AE, SG"
                      className="uppercase"
                      onChange={(event) => setOption(editing, setEditing, at, { matches: event.target.value })}
                    />
                  )}
                  {/* Only one answer can be the fallback, so they are one choice rather than several boxes. */}
                  {reads && (
                    <label className="flex items-center gap-2 text-xs text-ink-soft">
                      <input
                        type="radio"
                        name="when-nothing-matches"
                        aria-label={`Fall back on answer ${at + 1}`}
                        checked={option.whenNothingMatches}
                        onChange={() =>
                          setEditing({
                            ...editing,
                            draft: {
                              ...editing.draft,
                              options: editing.draft.options.map((one, which) => ({
                                ...one,
                                whenNothingMatches: which === at,
                              })),
                            },
                          })
                        }
                      />
                      <span className="sm:sr-only">Fall back on it</span>
                    </label>
                  )}
                  {/* The column is named once above, so the box needs no words of its own beside it. */}
                  <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      aria-label={`Answer ${at + 1} settles the band on its own`}
                      checked={option.forcesHighest}
                      onChange={(event) =>
                        setOption(editing, setEditing, at, { forcesHighest: event.target.checked })
                      }
                    />
                    <span className="sm:sr-only">Settles it on its own</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove answer ${at + 1}`}
                    className="justify-self-center text-ink-muted hover:text-danger-700"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        draft: {
                          ...editing.draft,
                          options: editing.draft.options.filter((_, which) => which !== at),
                        },
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setEditing({
                    ...editing,
                    draft: {
                      ...editing.draft,
                      options: [...editing.draft.options, emptyAnswer],
                    },
                  })
                }
              >
                <Plus aria-hidden="true" />
                Another answer
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={
                  editing.draft.name.trim() === "" ||
                  editing.draft.options.filter((option) => option.label.trim() !== "").length < 2 ||
                  add.isPending ||
                  change.isPending
                }
                onClick={save}
              >
                {add.isPending || change.isPending ? "Saving…" : "Save the line"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function setOption(
  editing: { id: string | null; draft: Draft },
  setEditing: (next: { id: string | null; draft: Draft }) => void,
  at: number,
  patch: Partial<Answer>,
) {
  setEditing({
    ...editing,
    draft: {
      ...editing.draft,
      options: editing.draft.options.map((option, which) => (which === at ? { ...option, ...patch } : option)),
    },
  });
}

function draftOf(factor: FactorRow): Draft {
  return {
    group: factor.group,
    name: factor.name,
    guidance: factor.guidance ?? "",
    weight: String(factor.weight),
    answeredFrom: factor.answeredFrom ?? "",
    options: factor.options
      .filter((option) => option.retiredAt === null)
      .map((option) => ({
        label: option.label,
        score: String(option.score),
        forcesHighest: option.forcesHighest,
        matches: option.matches.join(", "),
        whenNothingMatches: option.whenNothingMatches,
      })),
  };
}

function FactorLine({
  factor,
  mayWrite,
  onEdit,
  onRetire,
}: {
  factor: FactorRow;
  mayWrite: boolean;
  onEdit: () => void;
  onRetire: () => void;
}) {
  const options = factor.options.filter((option) => option.retiredAt === null);
  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[16rem_1fr_auto]">
      <div>
        <p className="text-sm font-semibold">{factor.name}</p>
        {factor.weight > 1 && <p className="text-xs text-ink-muted">Counts {factor.weight}&times;</p>}
        {factor.answeredFromTitle && (
          <p className="mt-0.5 text-xs font-medium text-primary-700">
            Answered from the record: {factor.answeredFromTitle.toLowerCase()}
          </p>
        )}
        {factor.guidance && <p className="mt-1 text-xs text-ink-soft">{factor.guidance}</p>}
      </div>
      <ul className="flex flex-wrap items-start gap-2 text-xs">
        {options.map((option) => (
          <li
            key={option.id}
            className={cn(
              "rounded-lg border px-2.5 py-1.5",
              option.forcesHighest ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white",
            )}
          >
            {option.label}
            <span className="ml-2 font-semibold tabular-nums">{option.score}</span>
            {option.forcesHighest && <span className="ml-1">· on its own</span>}
            {option.matches.length > 0 && (
              <span className="mt-0.5 block font-mono text-2xs text-ink-muted">{option.matches.join(" ")}</span>
            )}
            {option.whenNothingMatches && (
              <span className="mt-0.5 block text-2xs text-ink-muted">anything else</span>
            )}
          </li>
        ))}
      </ul>
      {mayWrite && (
        <div className="flex items-start gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Change
          </Button>
          <Button variant="secondary" size="sm" onClick={onRetire}>
            Take it off
          </Button>
        </div>
      )}
    </li>
  );
}

/** The bands, saved as one set: they only mean anything together. */
function Bands({ bands, mayWrite, onSaved }: { bands: BandRow[]; mayWrite: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<BandRow[] | null>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const save = useSetAmlBands<ApiError>({
    mutation: {
      onSuccess: () => {
        setErrors(noErrors);
        setDraft(null);
        onSaved();
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });
  const rows = draft ?? bands;

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-bold">The bands</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Read out of 100, so a band still means what it meant when a line is added to the sheet. They have
            to cover the whole scale once each.
          </p>
        </div>
        {mayWrite &&
          (draft === null ? (
            <Button variant="secondary" onClick={() => setDraft(bands)}>
              Change the bands
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(null);
                  setErrors(noErrors);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    data: {
                      bands: rows.map((band) => ({
                        name: band.name,
                        from: band.from,
                        to: band.to,
                        dueDiligence: band.dueDiligence,
                        reviewEveryMonths: band.reviewEveryMonths,
                      })),
                    },
                  })
                }
              >
                {save.isPending ? "Saving…" : "Save the bands"}
              </Button>
            </div>
          ))}
      </div>

      {errors.fields.bands && (
        <div className="px-5 pt-4">
          <Alert tone="danger">{errors.fields.bands}</Alert>
        </div>
      )}

      {rows.length === 0 && draft === null && (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">No bands on the scale yet.</p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-line">
          {rows.map((band, at) => (
            <li key={band.id || at} className="grid items-center gap-3 px-5 py-3 lg:grid-cols-[10rem_1fr_1fr_auto]">
              {draft === null ? (
                <>
                  <Badge tone={bandTone(band.from)}>{band.name}</Badge>
                  <span className="text-sm tabular-nums text-ink-soft">
                    {band.from} to {band.to}
                  </span>
                  <span className="text-sm text-ink-soft">
                    {band.dueDiligenceTitle} due diligence, looked at again every {band.reviewEveryMonths}{" "}
                    {band.reviewEveryMonths === 1 ? "month" : "months"}
                  </span>
                  <span />
                </>
              ) : (
                <>
                  <TextInput
                    aria-label={`Band ${at + 1} name`}
                    value={band.name}
                    onChange={(event) => setDraft(rows.map((one, which) => (which === at ? { ...one, name: event.target.value } : one)))}
                  />
                  <div className="flex items-center gap-2">
                    <TextInput
                      aria-label={`Band ${at + 1} starts at`}
                      inputMode="numeric"
                      value={String(band.from)}
                      onChange={(event) =>
                        setDraft(rows.map((one, which) => (which === at ? { ...one, from: Number(asFigure(event.target.value, String(one.from))) || 0 } : one)))
                      }
                    />
                    <span className="text-sm text-ink-muted">to</span>
                    <TextInput
                      aria-label={`Band ${at + 1} ends at`}
                      inputMode="numeric"
                      value={String(band.to)}
                      onChange={(event) =>
                        setDraft(rows.map((one, which) => (which === at ? { ...one, to: Number(asFigure(event.target.value, String(one.to))) || 0 } : one)))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <SelectInput
                      aria-label={`Band ${at + 1} due diligence`}
                      value={band.dueDiligence}
                      onChange={(event) =>
                        setDraft(rows.map((one, which) => (which === at ? { ...one, dueDiligence: event.target.value as BandRow["dueDiligence"] } : one)))
                      }
                    >
                      <option value="SIMPLIFIED">Simplified</option>
                      <option value="STANDARD">Standard</option>
                      <option value="ENHANCED">Enhanced</option>
                    </SelectInput>
                    <TextInput
                      aria-label={`Band ${at + 1} looked at again every so many months`}
                      inputMode="numeric"
                      value={String(band.reviewEveryMonths)}
                      onChange={(event) =>
                        setDraft(rows.map((one, which) => (which === at ? { ...one, reviewEveryMonths: Number(asFigure(event.target.value, String(one.reviewEveryMonths))) || 1 } : one)))
                      }
                    />
                    <span className="text-xs whitespace-nowrap text-ink-muted">months</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove band ${at + 1}`}
                    className="text-ink-muted hover:text-danger-700"
                    onClick={() => setDraft(rows.filter((_, which) => which !== at))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {draft !== null && (
        <div className="border-t border-line px-5 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setDraft([
                ...rows,
                {
                  id: "",
                  name: "",
                  from: 0,
                  to: 0,
                  dueDiligence: "STANDARD",
                  dueDiligenceTitle: "Standard",
                  reviewEveryMonths: 12,
                  position: rows.length + 1,
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Another band
          </Button>
        </div>
      )}
    </section>
  );
}
