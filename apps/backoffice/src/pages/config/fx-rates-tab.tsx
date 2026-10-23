import { ApiError } from "@atomprive/api-client";
import {
  getListFxRateHistoryQueryKey,
  getListFxRatesQueryKey,
  useAddCurrency,
  useListFxRateHistory,
  useListFxRates,
  useRefreshFxRates,
  useUpdateFxRate,
  type FeedPull,
  type FxRateHistory,
  type FxRateHistoryRow,
  type FxRateRow,
  type FxRateTable,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn, describedBy, Dialog, Field, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useColumnDrag } from "../../lib/column-drag";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { usePagedRows } from "../../lib/paged-rows";
import { useTableView } from "../../lib/table-view";
import { formatUtc } from "./config-labels";

type Notice = { tone: "success" | "info" | "danger"; message: string };

const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** A day the rates are for, as the feed dates them: the day itself, never shifted by the reader's time zone. */
function formatDay(date: string) {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parsed ? day.format(new Date(Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3])))) : date;
}

/** What to say about a pull, whether it brought anything back or not. */
function pulled(result: FeedPull, feedName: string): Notice {
  if (result.problem) {
    return { tone: "danger", message: `${feedName}: ${result.problem} The rates already on record stand.` };
  }
  const forDay = result.publishedOn ? formatDay(result.publishedOn) : "today";
  const missing = result.notPublished;
  const left =
    missing.length > 0
      ? ` ${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} published by the feed, so ${missing.length === 1 ? "it's" : "they're"} unchanged.`
      : "";
  if (result.recorded.length === 0) {
    return { tone: "info", message: `Nothing new: the rates for ${forDay} were already on record.${left}` };
  }
  return {
    tone: "success",
    message: `Recorded ${result.recorded.length} rate${result.recorded.length === 1 ? "" : "s"} for ${forDay}: ${result.recorded.join(", ")}.${left}`,
  };
}

const currencyNames = new Intl.DisplayNames(["en-GB"], { type: "currency" });

type RateColumn = {
  id: string;
  label: string;
  nowrap?: boolean;
  cell: (rate: FxRateRow) => ReactNode;
};

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Built rather than written out, because Source says what the feed did not cover, and which feed that
 * is belongs to the screen rather than to the row.
 *
 * <p>The currency is not among them, and neither is the button at the end. A rate with no currency named
 * on it converts nothing, and the button has no heading to drag or to find in a list.
 */
function movableRatesFor({ feedName, feedPublishedOn }: {
  feedName: string | null;
  feedPublishedOn: string | null;
}): RateColumn[] {
  return [
    {
      id: "rate",
      label: "Rate",
      cell: (rate) => (rate.unitsPerUsd === null ? (
        <span className="text-ink-muted">Not set</span>
      ) : (
        <>
          <p className="font-semibold tabular-nums">{formatRate(rate.unitsPerUsd)}</p>
          <p className="text-2xs text-ink-muted">{rate.code} per USD</p>
        </>
      )),
    },
    {
      id: "converted",
      label: "Converted · 1 unit in USD",
      cell: (rate) => (rate.usdPerUnit === null ? (
        <span className="text-ink-muted">—</span>
      ) : (
        <>
          <p className="font-semibold text-primary-600 tabular-nums">{formatConverted(rate.usdPerUnit)}</p>
          <p className="text-2xs text-ink-muted">USD per {rate.code}</p>
        </>
      )),
    },
    {
      id: "source",
      label: "Source",
      cell: (rate) => (
        <>
          {rate.source === null ? (
            <span className="text-ink-muted">—</span>
          ) : (
            <Badge tone={rate.source === "FEED" ? "info" : "neutral"}>
              {rate.source === "FEED" ? "Rate feed" : "Entered by hand"}
            </Badge>
          )}
          {/* Said once the feed has run: before that, nothing is known about what it covers. */}
          {feedPublishedOn && !rate.publishedByFeed && (
            <p className="mt-1 text-2xs text-ink-muted">Not published by {feedName} · kept by hand</p>
          )}
        </>
      ),
    },
    {
      id: "asOf",
      label: "As of",
      nowrap: true,
      cell: (rate) => (rate.asOf === null ? (
        <span className="text-ink-muted">—</span>
      ) : (
        <>
          <p className="text-ink-soft tabular-nums">
            {rate.source === "FEED" ? formatDay(rate.asOf.slice(0, 10)) : formatUtc(rate.asOf)}
          </p>
          {rate.recordedBy && <p className="text-2xs text-ink-muted">by {rate.recordedBy}</p>}
        </>
      )),
    },
  ];
}

/** Currencies and their rates against USD, the reporting currency (#100, #102). Entered by hand until a feed exists. */
export function FxRatesTab() {
  const queryClient = useQueryClient();
  const rates = useListFxRates<FxRateTable, ApiError>();
  const [updating, setUpdating] = useState<FxRateRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [showHistory, setShowHistory] = useState(false);
  const pull = useRefreshFxRates<ApiError>();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getListFxRatesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListFxRateHistoryQueryKey() });
  }

  /** Pulls today's rates now, rather than waiting for the daily pull. */
  function pullNow() {
    setNotice(undefined);
    pull.mutate(undefined, {
      onSuccess: (result: FeedPull) => {
        setNotice(pulled(result, rates.data?.feedName ?? "The rate feed"));
        void refresh();
      },
      onError: (caught) => setNotice({ tone: "danger", message: caught.message }),
    });
  }

  const table = rates.data;
  const paged = usePagedRows(table?.rates ?? [], 10);
  const movable = movableRatesFor({
    feedName: table?.feedName ?? null,
    feedPublishedOn: table?.feedPublishedOn ?? null,
  });
  const view = useTableView("fx-rates", movable.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(movable.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);
  return (
    <section aria-labelledby="fx-title" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="fx-title" className="text-base font-bold">
            FX rates
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            The portal reports every portfolio in <strong className="text-ink">{table?.reportingCurrency ?? "USD"}</strong>.
            These are the daily rates used to convert holdings held in other currencies into{" "}
            {table?.reportingCurrency ?? "USD"}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {table && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs text-ink-soft">
              <span aria-hidden="true" className={`size-2 rounded-full ${table.feedConnected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {table.feedConnected
                ? table.feedPublishedOn
                  ? `${table.feedName} · rates for ${formatDay(table.feedPublishedOn)}`
                  : `${table.feedName} · not pulled yet`
                : "No rate feed connected · rates entered by hand"}
            </span>
          )}
          {table?.feedConnected && (
            <Button size="sm" variant="secondary" onClick={pullNow} disabled={pull.isPending}>
              <RefreshCw aria-hidden="true" />
              {pull.isPending ? "Refreshing…" : "Refresh rates"}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Add currency
          </Button>
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.message}</Alert>
        </div>
      )}
      {rates.isError && (
        <div className="mt-4">
          <Alert tone="danger">{rates.error.message}</Alert>
        </div>
      )}

      {/* Above the table, the two together: which of their arrangements a reader is in, and the way to
          change it. */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
        <ViewTabs
          views={view.views}
          current={view.current}
          edited={view.current === null ? view.arranged : view.changed}
          onPick={(name) => (name === null ? view.reset() : view.apply(name))}
          onSave={view.saveAs}
          onDelete={view.remove}
          firstLabel="Every currency"
        />
        <ColumnPicker
          columns={movable.map((one) => ({ id: one.id, label: one.label }))}
          shown={new Set(view.shown)}
          order={view.order}
          arranged={view.arranged}
          onChange={(next) => {
            for (const one of movable) {
              if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
            }
          }}
          onMove={view.move}
          onReset={view.reset}
        />
      </div>

      <div className="-mx-5 mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Currency</th>
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-3 select-none",
                    column.nowrap && "whitespace-nowrap",
                    drag.dragging === column.id && "cursor-grabbing opacity-40",
                    drag.over === column.id && "bg-primary-50",
                  )}
                  title={`Drag to move ${column.label}`}
                >
                  {column.label}
                  <span className="sr-only">
                    , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                  </span>
                </th>
              ))}
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rates.isPending && (
              <tr>
                <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">Loading rates…</td>
              </tr>
            )}
            {paged.shown.map((rate) => (
              <tr key={rate.code} className="hover:bg-slate-50/60">
                <td className="py-3 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-11 shrink-0 place-items-center rounded-md border border-line bg-slate-50 text-2xs font-bold text-ink-soft">
                      {rate.code}
                    </span>
                    <span className="font-semibold">{rate.name}</span>
                  </div>
                </td>
                {/* The cells in the order the headings are in, out of the one list that holds both. */}
                {shownColumns.map((column) => (
                  <td key={column.id} className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap")}>
                    {column.cell(rate)}
                  </td>
                ))}
                <td className="py-3 pr-5 pl-4 text-right">
                  <Button size="sm" variant="ghost" className="bg-primary-50 text-primary-600 hover:bg-primary-100" onClick={() => setUpdating(rate)}>
                    {rate.unitsPerUsd === null ? "Set rate" : "Update rate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paged.total > 0 && (
        <div className="mt-2 border-t border-line px-1 py-3">
          <Pagination
            page={paged.page}
            pageSize={paged.size}
            totalItems={paged.total}
            onPageChange={paged.onPage}
            pageSizes={PAGE_SIZES}
            onPageSizeChange={paged.onSize}
            noun={["currency", "currencies"]}
          />
        </div>
      )}
      {table && (
        <p className="mt-2 text-xs text-ink-muted">
          Reporting currency {table.reportingCurrency} · each rate change is kept, with who made it and when.
        </p>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowHistory((shown) => !shown)}
          className="text-sm font-semibold text-primary-700 hover:underline"
        >
          {showHistory ? "Hide stored rates" : "View stored rates by date"}
        </button>
        {showHistory && <RateHistory codes={(table?.rates ?? []).map((rate) => rate.code)} />}
      </div>

      <UpdateRateDialog
        rate={updating}
        onClose={() => setUpdating(null)}
        onSaved={async (saved) => {
          await refresh();
          setUpdating(null);
          setNotice({ tone: "success", message: `${saved.name} rate saved: 1 USD = ${formatRate(saved.unitsPerUsd ?? 0)} ${saved.code}.` });
        }}
      />
      <AddCurrencyDialog
        open={adding}
        existing={table?.rates.map((rate) => rate.code).concat(table.reportingCurrency) ?? []}
        onClose={() => setAdding(false)}
        onAdded={async (added) => {
          await refresh();
          setAdding(false);
          setNotice({ tone: "success", message: `${added.name} added. Set its rate to start converting it.` });
        }}
      />
    </section>
  );
}

function UpdateRateDialog({ rate, onClose, onSaved }: { rate: FxRateRow | null; onClose: () => void; onSaved: (rate: FxRateRow) => void }) {
  return (
    <Dialog
      open={rate !== null}
      onClose={onClose}
      title={rate ? `${rate.unitsPerUsd === null ? "Set" : "Update"} the ${rate.name} rate` : "Update rate"}
      description="The new rate applies from now. Earlier rates stay on record for past valuations."
    >
      {rate && <UpdateRateForm rate={rate} onCancel={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function UpdateRateForm({ rate, onCancel, onSaved }: { rate: FxRateRow; onCancel: () => void; onSaved: (rate: FxRateRow) => void }) {
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [value, setValue] = useState(rate.unitsPerUsd === null ? "" : String(rate.unitsPerUsd));
  const update = useUpdateFxRate<ApiError>({ mutation: { onSuccess: onSaved, onError: (error) => setErrors(toFormErrors(error)) } });
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    update.mutate({ code: rate.code, data: { unitsPerUsd: parsed } });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <Field
        id="unitsPerUsd"
        label={`${rate.code} per 1 USD`}
        hint={valid ? `So 1 ${rate.code} = ${formatConverted(1 / parsed)} USD` : "How much one US dollar buys, for example 1.3142."}
        error={errors.fields.unitsPerUsd}
      >
        <TextInput
          {...describedBy("unitsPerUsd", errors.fields.unitsPerUsd)}
          name="unitsPerUsd"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="tabular-nums"
          required
        />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending || !valid}>
          {update.isPending ? "Saving…" : "Save rate"}
        </Button>
      </div>
    </form>
  );
}

function AddCurrencyDialog({ open, existing, onClose, onAdded }: { open: boolean; existing: string[]; onClose: () => void; onAdded: (rate: FxRateRow) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add currency" description="Holdings in this currency will be converted to USD using the rate you set.">
      {open && <AddCurrencyForm existing={existing} onCancel={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

function AddCurrencyForm({ existing, onCancel, onAdded }: { existing: string[]; onCancel: () => void; onAdded: (rate: FxRateRow) => void }) {
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const add = useAddCurrency<ApiError>({ mutation: { onSuccess: onAdded, onError: (error) => setErrors(toFormErrors(error)) } });
  const choices = Intl.supportedValuesOf("currency")
    .filter((code) => !existing.includes(code))
    .map((code) => ({ code, name: currencyNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(noErrors);
    add.mutate({ data: { code: String(new FormData(event.currentTarget).get("code")) } });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}
      <Field id="code" label="Currency" error={errors.fields.code}>
        <SelectInput {...describedBy("code", errors.fields.code)} name="code" defaultValue="" required>
          <option value="" disabled>
            Choose a currency
          </option>
          {choices.map((choice) => (
            <option key={choice.code} value={choice.code}>
              {choice.name} ({choice.code})
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add currency"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The columns of the stored rates a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Neither the day nor the currency is among them. A stored rate is named by the pair of them — this
 * list runs across every currency unless one is chosen — so a row missing either names nothing.
 */
const MOVABLE_STORED: {
  id: string;
  label: string;
  nowrap?: boolean;
  /** The ink the cell is written in, where it is quieter than the day it belongs to. */
  tone?: string;
  cell: (row: FxRateHistoryRow) => ReactNode;
}[] = [
  {
    id: "rate",
    label: "Rate",
    tone: "tabular-nums",
    cell: (row) => formatRate(row.unitsPerUsd),
  },
  {
    id: "converted",
    label: "1 unit in USD",
    tone: "text-primary-600 tabular-nums",
    cell: (row) => formatConverted(row.usdPerUnit),
  },
  {
    id: "source",
    label: "Source",
    cell: (row) => (
      <Badge tone={row.source === "FEED" ? "info" : "neutral"}>
        {row.source === "FEED" ? "Rate feed" : "Entered by hand"}
      </Badge>
    ),
  },
  {
    id: "recorded",
    label: "Recorded",
    nowrap: true,
    cell: (row) => (
      <>
        <p className="text-ink-soft tabular-nums">{formatUtc(row.recordedAt)}</p>
        {row.recordedBy && <p className="text-2xs text-ink-muted">by {row.recordedBy}</p>}
      </>
    ),
  },
];

/** Rates as quoted: 1.3142 SGD per USD, 147.26 JPY per USD. */
/**
 * Every rate the platform has stored, newest day first, with where each came from. Rates are never overwritten,
 * so this is the record of what the platform held on any given day.
 */
function RateHistory({ codes }: { codes: string[] }) {
  const [code, setCode] = useState("");
  const history = useListFxRateHistory<FxRateHistory, ApiError>(code ? { code } : undefined);
  const rows = history.data?.rates ?? [];
  const paged = usePagedRows(rows, 10);
  const view = useTableView("fx-rate-history", MOVABLE_STORED.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE_STORED.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">Stored rates</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            {history.data
              ? `${rows.length} rate${rows.length === 1 ? "" : "s"} across ${history.data.days} day${history.data.days === 1 ? "" : "s"}`
              : "Loading…"}
          </p>
        </div>
        <Field id="history-code" label="Currency">
          <SelectInput id="history-code" value={code} onChange={(event) => setCode(event.target.value)}>
            <option value="">Every currency</option>
            {codes.map((one) => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {history.isError && (
        <div className="mt-3">
          <Alert tone="danger">{history.error.message}</Alert>
        </div>
      )}

      {/* This list has its own arrangement: the rates on record are read for a different reason from the
          rates in force, and one saved view over both would be a view of neither. */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <ViewTabs
          views={view.views}
          current={view.current}
          edited={view.current === null ? view.arranged : view.changed}
          onPick={(name) => (name === null ? view.reset() : view.apply(name))}
          onSave={view.saveAs}
          onDelete={view.remove}
          firstLabel="Every stored rate"
        />
        <ColumnPicker
          columns={MOVABLE_STORED.map((one) => ({ id: one.id, label: one.label }))}
          shown={new Set(view.shown)}
          order={view.order}
          arranged={view.arranged}
          onChange={(next) => {
            for (const one of MOVABLE_STORED) {
              if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
            }
          }}
          onMove={view.move}
          onReset={view.reset}
        />
      </div>

      <div className="-mx-5 mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-2.5 pr-4 pl-5">Date</th>
              <th scope="col" className="px-4 py-2.5">Currency</th>
              {shownColumns.map((column, at) => (
                <th
                  key={column.id}
                  scope="col"
                  {...drag.headingProps(column.id)}
                  className={cn(
                    "cursor-grab touch-none px-4 py-2.5 select-none",
                    at === shownColumns.length - 1 && "pr-5",
                    column.nowrap && "whitespace-nowrap",
                    drag.dragging === column.id && "cursor-grabbing opacity-40",
                    drag.over === column.id && "bg-primary-50",
                  )}
                  title={`Drag to move ${column.label}`}
                >
                  {column.label}
                  <span className="sr-only">
                    , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && !history.isPending && (
              <tr>
                <td colSpan={shownColumns.length + 2} className="px-5 py-8 text-center text-ink-muted">
                  No rates stored yet. Refresh the rates, or set one by hand.
                </td>
              </tr>
            )}
            {paged.shown.map((row) => (
              <tr key={`${row.asOf}.${row.code}.${row.recordedAt}`} className="hover:bg-slate-50/60">
                <td className="py-2.5 pr-4 pl-5 font-semibold whitespace-nowrap tabular-nums">{formatDay(row.asOf)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{row.code}</span>
                  <span className="ml-2 text-2xs text-ink-muted">{row.name}</span>
                </td>
                {/* The cells in the order the headings are in, out of the one list that holds both. */}
                {shownColumns.map((column, at) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-4 py-2.5",
                      at === shownColumns.length - 1 && "pr-5",
                      column.nowrap && "whitespace-nowrap",
                      column.tone,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paged.total > 0 && (
        <div className="mt-2 border-t border-line px-1 py-3">
          <Pagination
            page={paged.page}
            pageSize={paged.size}
            totalItems={paged.total}
            onPageChange={paged.onPage}
            pageSizes={PAGE_SIZES}
            onPageSizeChange={paged.onSize}
            noun={["rate", "rates"]}
          />
        </div>
      )}
    </div>
  );
}

function formatRate(value: number) {
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

/** Small conversions keep four significant digits: 0.7609, 0.0120, 0.006791. */
function formatConverted(value: number) {
  return value >= 0.01 ? value.toFixed(4) : value.toPrecision(4);
}
