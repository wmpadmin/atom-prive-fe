import { ApiError } from "@atomprive/api-client";
import {
  getListFxRatesQueryKey,
  useAddCurrency,
  useListFxRates,
  useUpdateFxRate,
  type FxRateRow,
  type FxRateTable,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, describedBy, Dialog, Field, Pagination, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { PAGE_SIZES } from "../../lib/page-sizes";
import { usePagedRows } from "../../lib/use-paged-rows";
import { formatUtc } from "./config-labels";

type Notice = { tone: "success" | "danger"; message: string };

const currencyNames = new Intl.DisplayNames(["en-GB"], { type: "currency" });

/** Currencies and their rates against USD, the reporting currency (#100, #102). Entered by hand until a feed exists. */
export function FxRatesTab() {
  const queryClient = useQueryClient();
  const rates = useListFxRates<FxRateTable, ApiError>();
  const [updating, setUpdating] = useState<FxRateRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getListFxRatesQueryKey() });
  }

  const table = rates.data;
  const paged = usePagedRows(table?.rates ?? [], 10);
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
              {table.feedConnected ? "Rate feed connected" : "No rate feed connected · rates entered by hand"}
            </span>
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

      <div className="-mx-5 mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Currency</th>
              <th scope="col" className="px-4 py-3">Rate</th>
              <th scope="col" className="px-4 py-3">Converted · 1 unit in USD</th>
              <th scope="col" className="px-4 py-3">Source</th>
              <th scope="col" className="px-4 py-3">As of</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rates.isPending && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading rates…</td>
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
                <td className="px-4 py-3">
                  {rate.unitsPerUsd === null ? (
                    <span className="text-ink-muted">Not set</span>
                  ) : (
                    <>
                      <p className="font-semibold tabular-nums">{formatRate(rate.unitsPerUsd)}</p>
                      <p className="text-2xs text-ink-muted">{rate.code} per USD</p>
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  {rate.usdPerUnit === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      <p className="font-semibold text-primary-600 tabular-nums">{formatConverted(rate.usdPerUnit)}</p>
                      <p className="text-2xs text-ink-muted">USD per {rate.code}</p>
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  {rate.source === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <Badge>{rate.source === "FEED" ? "Rate feed" : "Entered by hand"}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {rate.asOf === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      <p className="text-ink-soft tabular-nums">{formatUtc(rate.asOf)}</p>
                      {rate.recordedBy && <p className="text-2xs text-ink-muted">by {rate.recordedBy}</p>}
                    </>
                  )}
                </td>
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

      {paged.totalItems > 0 && (
        <div className="mt-2 border-t border-line px-1 py-3">
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            totalItems={paged.totalItems}
            onPageChange={paged.setPage}
            pageSizes={PAGE_SIZES}
            onPageSizeChange={paged.setPageSize}
            noun={["currency", "currencies"]}
          />
        </div>
      )}
      {table && (
        <p className="mt-2 text-xs text-ink-muted">
          Reporting currency {table.reportingCurrency} · each rate change is kept, with who made it and when.
        </p>
      )}

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

/** Rates as quoted: 1.3142 SGD per USD, 147.26 JPY per USD. */
function formatRate(value: number) {
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

/** Small conversions keep four significant digits: 0.7609, 0.0120, 0.006791. */
function formatConverted(value: number) {
  return value >= 0.01 ? value.toFixed(4) : value.toPrecision(4);
}
