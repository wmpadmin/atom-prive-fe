import { ApiError } from "@atomprive/api-client";
import {
  getListBenchmarkLevelsQueryKey,
  getListBenchmarksQueryKey,
  getListModelPortfoliosQueryKey,
  useCreateBenchmark,
  useListBenchmarkLevels,
  useListBenchmarks,
  useListCurrencies,
  useRecordBenchmarkLevel,
  type BenchmarkLevelRow,
  type BenchmarkRow,
  type Currency,
} from "@atomprive/api-client/backoffice";
import {
  Alert,
  Badge,
  Button,
  DateInput,
  Dialog,
  Field,
  SelectInput,
  TextArea,
  TextInput,
  cn,
  describedBy,
} from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { useStaffUser } from "../../auth/session";

/** No index the firm would be measuring against predates this, and a typo of 0202 should not be accepted. */
const EARLIEST = new Date(1970, 0, 1);

/**
 * The indices the firm measures its plans against, and what each one stood at day by day.
 *
 * <p>An index is a name, a currency and a series of levels. A return over any period is one level against
 * another, which is how an index actually works — so no period has to be decided here, and a level written
 * down once serves every period that crosses it.
 *
 * <p>A panel on Portfolio settings rather than a screen of its own. It was a screen, reached by a link from
 * the settings page and from nowhere else — not on the menu, so the only way to the thing that makes Model
 * performance work was a line of small print on another screen. The rule it holds is a portfolio rule like
 * the bands above it, and it is now kept where the rest of them are.
 */
export function BenchmarksPanel() {
  const user = useStaffUser();
  const mayChange = hasAuthority(user, "SEND_PROPOSALS:CHANGE");
  const benchmarks = useListBenchmarks<BenchmarkRow[], ApiError>();
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState<BenchmarkRow | null>(null);

  if (benchmarks.isError) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-bold">Benchmarks</h2>
        <div className="mt-3">
          <Alert tone="danger">{benchmarks.error.message}</Alert>
        </div>
      </section>
    );
  }
  const rows = benchmarks.data ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      {/* The way in stays at the top right, beside the heading, where the other panels keep theirs. It
          wrapped underneath because the words beside it were allowed their natural width, which on a
          wide screen is the whole row. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Benchmarks</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            The indices the firm measures its plans against, and what each one stood at. Named with its
            currency, or the comparison means nothing: a plan kept in dollars has not beaten an index quoted
            in rupees just because the number is bigger.
          </p>
        </div>
        {mayChange && (
          <Button className="shrink-0" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            New benchmark
          </Button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Benchmark</th>
              <th scope="col" className="px-4 py-3">Currency</th>
              <th scope="col" className="px-4 py-3 text-right">Levels</th>
              <th scope="col" className="px-4 py-3">Covers</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {benchmarks.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">Reading the benchmarks…</td>
              </tr>
            )}
            {benchmarks.data && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                  No benchmark yet. Until a plan has one, Model performance shows its return and nothing to
                  compare it with — and the Benchmark box on a model has nothing to offer.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60">
                <td className="py-3 pr-4 pl-5">
                  <span className="block font-semibold">{row.name}</span>
                  {row.description && <span className="block text-xs text-ink-muted">{row.description}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{row.currency}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.levels > 0 ? (
                    row.levels
                  ) : (
                    // An index with no levels cannot be compared against anything, which is worth saying
                    // here rather than leaving the performance screen to show an unexplained blank.
                    <Badge tone="warning">None yet</Badge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                  {row.firstLevelOn && row.lastLevelOn ? (
                    `${formatDate(row.firstLevelOn)} — ${formatDate(row.lastLevelOn)}`
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <button
                    type="button"
                    onClick={() => setOpened(row)}
                    className="text-sm font-medium text-primary-700 hover:underline"
                  >
                    {mayChange ? "Levels" : "View levels"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Said under the table rather than above it: somebody reads this when they wonder how many levels to
          write, which is after they have seen what is there. */}
      <p className="mt-3 text-xs text-ink-muted">
        Model performance compares a plan with its index over the same days the plan itself covers, so a
        level is only needed on the days portfolios were written down — and two of them at least, or there
        is no period to compare.
      </p>

      {adding && <NewBenchmarkDialog onClose={() => setAdding(false)} />}
      {opened && <LevelsDialog benchmark={opened} mayChange={mayChange} onClose={() => setOpened(null)} />}
    </section>
  );
}

function NewBenchmarkDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const currencies = useListCurrencies<Currency[], ApiError>();
  const create = useCreateBenchmark();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(noErrors);
    create.mutate(
      { data: { name, currency, description: description.trim() || null } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListBenchmarksQueryKey() });
          onClose();
        },
        onError: (error) => setErrors(toFormErrors(error)),
      },
    );
  }

  return (
    <Dialog open title="New benchmark" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <Field id="benchmark-name" label="Name" required error={errors.fields.name}>
          <TextInput
            {...describedBy("benchmark-name", errors.fields.name)}
            id="benchmark-name"
            placeholder="MSCI World"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          id="benchmark-currency"
          label="Currency"
          required
          hint="The currency the index is quoted in. A comparison without it means nothing."
          error={errors.fields.currency}
        >
          <SelectInput
            id="benchmark-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {(currencies.data ?? []).map((one) => (
              <option key={one.code} value={one.code}>
                {one.code} · {one.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="benchmark-description" label="Description" error={errors.fields.description}>
          <TextArea
            id="benchmark-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Saving…" : "Add benchmark"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** What the index stood at, day by day. Newest first to read, oldest first to measure from. */
function LevelsDialog({
  benchmark,
  mayChange,
  onClose,
}: {
  benchmark: BenchmarkRow;
  mayChange: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const levels = useListBenchmarkLevels<BenchmarkLevelRow[], ApiError>(benchmark.id);
  const record = useRecordBenchmarkLevel();
  const [onDate, setOnDate] = useState("");
  const [level, setLevel] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const rows = levels.data ?? [];
  const already = rows.find((row) => row.onDate === onDate);
  // A level is a fact about a day, and a day has one: writing the same day again corrects it.
  const correcting = already !== undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(noErrors);
    record.mutate(
      { id: benchmark.id, data: { onDate, level: Number(level) } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListBenchmarkLevelsQueryKey(benchmark.id) });
          void queryClient.invalidateQueries({ queryKey: getListBenchmarksQueryKey() });
          // The model list names the benchmark, and performance reads its levels.
          void queryClient.invalidateQueries({ queryKey: getListModelPortfoliosQueryKey() });
          setLevel("");
          setOnDate("");
        },
        onError: (error) => setErrors(toFormErrors(error)),
      },
    );
  }

  const readable = level.trim() !== "" && Number.isFinite(Number(level)) && Number(level) > 0;

  return (
    <Dialog open title={`${benchmark.name} · ${benchmark.currency}`} size="lg" onClose={onClose}>
      <div className="space-y-5">
        {mayChange && (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-slate-50/60 p-4">
            {errors.form && <Alert tone="danger">{errors.form}</Alert>}
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field id="level-date" label="Day" required error={errors.fields.onDate}>
                <DateInput
                  id="level-date"
                  name="onDate"
                  value={onDate}
                  min={EARLIEST}
                  max={new Date()}
                  onChange={setOnDate}
                  required
                />
              </Field>
              <Field id="level-value" label="Index level" required error={errors.fields.level}>
                <TextInput
                  {...describedBy("level-value", errors.fields.level)}
                  id="level-value"
                  inputMode="decimal"
                  placeholder="1042.75"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                />
              </Field>
              <Button type="submit" disabled={!onDate || !readable || record.isPending}>
                {record.isPending ? "Saving…" : correcting ? "Correct the day" : "Add level"}
              </Button>
            </div>
            {correcting && (
              <p className="text-xs text-amber-700">
                {formatDate(onDate)} already stands at {already.level}. Saving replaces it — a level is a fact
                about a day, and a day has one.
              </p>
            )}
            {level.trim() !== "" && !readable && (
              <p className="text-xs text-rose-700">An index level is a number greater than nothing.</p>
            )}
          </form>
        )}

        {levels.isError && <Alert tone="danger">{levels.error.message}</Alert>}

        {levels.isPending ? (
          <p className="py-6 text-center text-sm text-ink-muted">Reading the levels…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nothing written down yet. Until there is, any plan measured against this index shows its return and
            no comparison.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2.5">Day</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Level</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Since the day before</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {/* Newest first to read; the move is against the day before it in time, not the row above. */}
                {[...rows].reverse().map((row, index, reversed) => {
                  const before = reversed[index + 1];
                  const move = before ? ((row.level - before.level) / before.level) * 100 : null;
                  return (
                    <tr key={row.onDate}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(row.onDate)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.level}</td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right whitespace-nowrap tabular-nums",
                          move === null ? "text-ink-muted" : move < 0 ? "text-rose-700" : "text-emerald-700",
                        )}
                      >
                        {move === null
                          ? "—"
                          : `${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move).toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
