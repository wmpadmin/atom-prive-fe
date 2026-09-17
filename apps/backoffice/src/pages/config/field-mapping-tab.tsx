import { ApiError } from "@atomprive/api-client";
import {
  getGetBankFieldMappingQueryKey,
  getGetFieldMappingSummaryQueryKey,
  useGetBankFieldMapping,
  useGetFieldMappingOptions,
  useGetFieldMappingSummary,
  useRemoveIncomingField,
  useSaveBankFieldMapping,
  type BankMapping,
  type FieldChoice,
  type MappedField,
  type MappingOptions,
  type MappingSummary,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, cn, IconButton, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { countryName } from "../../lib/countries";
import { AddFieldDialog } from "./add-field-dialog";
import { ConfirmDialog } from "./confirm-dialog";

type Notice = { tone: "success" | "danger"; message: string };

/** Mapping each bank's incoming fields to the portal's standard fields, with alerts for unmapped ones (N3). */
export function FieldMappingTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const summary = useGetFieldMappingSummary<MappingSummary, ApiError>();
  const options = useGetFieldMappingOptions<MappingOptions, ApiError>();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const banks = summary.data?.banks ?? [];
  const bankId = banks.find((bank) => bank.bankId === searchParams.get("bank"))?.bankId ?? banks[0]?.bankId;

  function selectBank(id: string) {
    setSearchParams({ tab: "mapping", bank: id }, { replace: true });
  }

  return (
    <section aria-labelledby="mapping-title" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="mapping-title" className="text-base font-bold">
            Bank-format mapping &amp; alerts
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Map each bank's incoming fields to the portal's standard fields. Unmapped or changed fields raise an alert before
            data reaches dashboards.
          </p>
        </div>
        {banks.length > 0 && (
          <label className="shrink-0">
            <span className="sr-only">Bank</span>
            <SelectInput
              id="mapping-bank"
              value={bankId}
              onChange={(event) => (dirty ? setSwitchingTo(event.target.value) : selectBank(event.target.value))}
              className="h-9 w-80 bg-slate-50 text-xs font-semibold"
            >
              {banks.map((bank) => (
                <option key={bank.bankId} value={bank.bankId}>
                  {bank.bankName} · {countryName(bank.countryCode)}
                  {bank.unmappedFields > 0 ? ` (${bank.unmappedFields} unmapped)` : ""}
                </option>
              ))}
            </SelectInput>
          </label>
        )}
      </div>

      {(summary.isError || options.isError) && (
        <div className="mt-4">
          <Alert tone="danger">{(summary.error ?? options.error)?.message}</Alert>
        </div>
      )}
      {summary.isPending && <p className="mt-6 text-sm text-ink-muted">Loading banks…</p>}
      {summary.isSuccess && banks.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          Add a bank on the Supported banks tab first, then map its fields here.
        </p>
      )}
      {bankId && options.data && (
        <BankMappingEditor key={bankId} bankId={bankId} options={options.data} onDirtyChange={setDirty} />
      )}

      <ConfirmDialog
        open={switchingTo !== null}
        title="Discard your changes?"
        description="The mapping changes you haven't saved for this bank will be lost."
        confirmLabel="Discard and switch"
        tone="danger"
        onConfirm={() => {
          if (switchingTo) selectBank(switchingTo);
          setSwitchingTo(null);
          setDirty(false);
        }}
        onClose={() => setSwitchingTo(null)}
      />
    </section>
  );
}

type Draft = Record<string, FieldChoice>;

function BankMappingEditor({ bankId, options, onDirtyChange }: { bankId: string; options: MappingOptions; onDirtyChange: (dirty: boolean) => void }) {
  const queryClient = useQueryClient();
  const mapping = useGetBankFieldMapping<BankMapping, ApiError>(bankId);
  const [draft, setDraft] = useState<Draft>({});
  const [alertOnChange, setAlertOnChange] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const dirty = Object.keys(draft).length > 0 || alertOnChange !== null;

  // Lets the tab ask before switching bank with unsaved changes.
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getGetBankFieldMappingQueryKey(bankId) });
    await queryClient.invalidateQueries({ queryKey: getGetFieldMappingSummaryQueryKey() });
  }

  const save = useSaveBankFieldMapping<ApiError>({
    mutation: {
      onSuccess: async (saved) => {
        queryClient.setQueryData(getGetBankFieldMappingQueryKey(bankId), saved);
        await queryClient.invalidateQueries({ queryKey: getGetFieldMappingSummaryQueryKey() });
        setDraft({});
        setAlertOnChange(null);
        setNotice({ tone: "success", message: `Mapping saved as version ${saved.version}.` });
      },
      onError: (error) => setNotice({ tone: "danger", message: error.message }),
    },
  });
  const remove = useRemoveIncomingField<ApiError>({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setNotice(undefined);
      },
      onError: (error) => setNotice({ tone: "danger", message: error.message }),
    },
  });

  if (mapping.isPending) return <p className="mt-6 text-sm text-ink-muted">Loading mapping…</p>;
  if (mapping.isError) {
    return (
      <div className="mt-4">
        <Alert tone="danger">{mapping.error.message}</Alert>
      </div>
    );
  }

  const bank = mapping.data;
  const choices = bank.fields.map((field) => draft[field.id] ?? choiceOf(field));
  const counts = {
    mapped: choices.filter((choice) => !choice.ignored && choice.standardField).length,
    unmapped: choices.filter((choice) => !choice.ignored && !choice.standardField).length,
    ignored: choices.filter((choice) => choice.ignored).length,
  };
  const alert = alertOnChange ?? bank.alertOnFormatChange;

  function choose(field: MappedField, change: Partial<FieldChoice>) {
    setNotice(undefined);
    setDraft((current) => {
      const next = { ...(current[field.id] ?? choiceOf(field)), ...change };
      const { [field.id]: _previous, ...others } = current;
      return sameChoice(next, choiceOf(field)) ? others : { ...others, [field.id]: next };
    });
  }

  function focusFirstUnmapped() {
    const first = bank.fields.find((_field, index) => !choices[index].ignored && !choices[index].standardField);
    if (first) document.getElementById(`standard-${first.id}`)?.focus();
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}
        {counts.unmapped > 0 && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {counts.unmapped} {counts.unmapped === 1 ? "field" : "fields"} with no mapping
                </p>
                <p className="text-xs text-amber-800">
                  {bank.bankName}'s values for {counts.unmapped === 1 ? "this field are" : "these fields are"} held back from
                  dashboards until each is mapped or explicitly ignored.
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-amber-700 hover:bg-amber-800" onClick={focusFirstUnmapped}>
              Map field
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Add incoming field
        </Button>
      </div>

      <div className="-mx-5 mt-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Incoming field (bank)</th>
              <th scope="col" className="px-4 py-3">Sample value</th>
              <th scope="col" className="px-4 py-3">Portal standard field</th>
              <th scope="col" className="px-4 py-3">Transform</th>
              <th scope="col" className="px-4 py-3">State</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bank.fields.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-muted">
                  No incoming fields yet. They're added automatically when {bank.bankName}'s first file arrives, or you can
                  add them now from the bank's file specification.
                </td>
              </tr>
            )}
            {bank.fields.map((field, index) => {
              const choice = choices[index];
              const unmapped = !choice.ignored && !choice.standardField;
              const selectValue = choice.ignored ? "__ignored" : (choice.standardField ?? "");
              return (
                <tr key={field.id} className={cn(unmapped && "bg-red-50/60")}>
                  <td className="py-2.5 pr-4 pl-5 font-mono text-xs font-semibold">{field.incomingField}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{field.sampleValue ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <label>
                      <span className="sr-only">Portal field for {field.incomingField}</span>
                      <SelectInput
                        id={`standard-${field.id}`}
                        value={selectValue}
                        onChange={(event) => {
                          const value = event.target.value;
                          choose(field, {
                            ignored: value === "__ignored",
                            standardField: value === "__ignored" || value === "" ? null : (value as FieldChoice["standardField"]),
                          });
                        }}
                        className={cn("h-9 w-60 bg-slate-50 text-xs font-semibold", unmapped && "border-red-400 bg-white")}
                      >
                        <option value="">— not mapped —</option>
                        {options.standardFields.map((option) => (
                          <option key={option.field} value={option.field}>
                            {option.label}
                          </option>
                        ))}
                        <option value="__ignored">Ignore this field</option>
                      </SelectInput>
                    </label>
                  </td>
                  <td className="px-4 py-2.5">
                    <label>
                      <span className="sr-only">Transform for {field.incomingField}</span>
                      <SelectInput
                        id={`transform-${field.id}`}
                        value={choice.transform}
                        disabled={!choice.standardField || choice.ignored}
                        onChange={(event) => choose(field, { transform: event.target.value as FieldChoice["transform"] })}
                        className="h-9 w-48 text-xs"
                      >
                        {options.transforms.map((option) => (
                          <option key={option.transform} value={option.transform}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </label>
                  </td>
                  <td className="px-4 py-2.5">
                    {choice.ignored ? (
                      <Badge>Ignored</Badge>
                    ) : unmapped ? (
                      <Badge tone="danger">Unmapped</Badge>
                    ) : (
                      <Badge tone="success">Mapped</Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-5 pl-4 text-right">
                    <IconButton
                      label={`Remove ${field.incomingField}`}
                      disabled={remove.isPending || dirty}
                      title={dirty ? "Save or discard your changes first" : `Remove ${field.incomingField}`}
                      onClick={() => remove.mutate({ bankId, fieldId: field.id })}
                    >
                      <Trash2 />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-muted">
          {bank.fields.length} incoming {bank.fields.length === 1 ? "field" : "fields"} · {counts.mapped} mapped ·{" "}
          {counts.unmapped} unmapped · {counts.ignored} ignored
          {bank.version > 0 && ` · version ${bank.version}`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              className="size-4 rounded border-line accent-primary-600"
              checked={alert}
              onChange={(event) => {
                const value = event.target.checked;
                setAlertOnChange(value === bank.alertOnFormatChange ? null : value);
              }}
            />
            Alert Ops &amp; Admin when a bank changes its format
          </label>
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setDraft({});
                setAlertOnChange(null);
              }}
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            disabled={save.isPending || (!dirty && bank.version > 0) || bank.fields.length === 0}
            onClick={() => save.mutate({ bankId, data: { fields: choices, alertOnFormatChange: alert } })}
          >
            {save.isPending ? "Saving…" : "Save mapping"}
          </Button>
        </div>
      </div>

      <AddFieldDialog
        open={adding}
        bankId={bankId}
        bankName={bank.bankName}
        onClose={() => setAdding(false)}
        onAdded={async (field) => {
          await refresh();
          setAdding(false);
          setNotice({ tone: "success", message: `${field.incomingField} added. Choose its portal field, then save the mapping.` });
        }}
      />
    </>
  );
}

function choiceOf(field: MappedField): FieldChoice {
  return { id: field.id, standardField: field.standardField, transform: field.transform, ignored: field.state === "IGNORED" };
}

function sameChoice(a: FieldChoice, b: FieldChoice) {
  return a.standardField === b.standardField && a.transform === b.transform && a.ignored === b.ignored;
}
