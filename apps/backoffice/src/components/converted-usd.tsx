import { ApiError } from "@atomprive/api-client";
import { useAddMissingFxRate, type WorkspaceConverted } from "@atomprive/api-client/backoffice";
import { Button, Dialog, Field, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../auth/session";
import { formatDate } from "../lib/labels";
import { hasAnyAuthority } from "../lib/permissions";

/** Who may type in a missing rate: Admin, and the portfolio desk. A relationship manager may not. */
const ADDS_MISSING_RATES = ["MANAGE_CONFIGURATION:CHANGE", "APPROVE_PORTFOLIO_CHANGES:CHANGE"] as const;

/**
 * Under a card a bank-file client's figures are converted for: which rates, of which day, and from where; and every
 * currency the file holds that has no rate, which is in no total until somebody adds one.
 */
export function ConvertedNote({ converted }: { converted: WorkspaceConverted }) {
  return (
    <div className="mt-2 space-y-2">
      <p className="text-3xs text-ink-muted italic">
        The bank's figures converted to {converted.currency}
        {converted.ratesOn ? ` at the FX rates of ${formatDate(converted.ratesOn)}` : ""}, from FX rates
        {converted.currencies.length > 0 && ` · ${converted.currencies.filter((one) => one.currency !== "USD")
          .map((one) => `${one.currency} ${one.perUsd.toLocaleString("en-US", { maximumFractionDigits: 4 })}`).join(" · ")} per USD`}.
      </p>
      <MissingRates converted={converted} />
    </div>
  );
}

/** Each currency with no rate, as sent, with a way to add the rate for whoever may. */
export function MissingRates({ converted }: { converted: WorkspaceConverted }) {
  const user = useStaffUser();
  const [adding, setAdding] = useState<string | null>(null);
  if (converted.missing.length === 0) return null;
  const may = hasAnyAuthority(user, ...ADDS_MISSING_RATES);
  return (
    <>
      {converted.missing.map((one) => (
        <div key={one.currency} role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {one.currency} {one.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has no FX rate on file,
            so it is not in the {converted.currency} total.
          </span>
          {may ? (
            <Button variant="secondary" size="sm" onClick={() => setAdding(one.currency)}>Add {one.currency} rate</Button>
          ) : (
            <span className="text-amber-700">An Admin or the portfolio manager can add it.</span>
          )}
        </div>
      ))}
      {adding && <AddRateDialog code={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function AddRateDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const add = useAddMissingFxRate<ApiError>();
  const [rate, setRate] = useState("");
  const value = Number(rate);
  const valid = rate.trim() !== "" && Number.isFinite(value) && value > 0;
  const [tried, setTried] = useState(false);
  return (
    <Dialog open onClose={onClose} title={`Add an FX rate for ${code}`}
      description="Saved to FX rates as a manual rate. Every converted screen uses it straight away; an Admin changes it from FX rates later.">
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (!valid) return;
        add.mutate({ code, data: { unitsPerUsd: value } }, {
          onSuccess: () => {
            void queryClient.invalidateQueries();
            onClose();
          },
        });
      }}>
        <Field id="missing-rate" label={`${code} per 1 USD`} required
          error={tried && !valid ? "Enter a rate above 0." : add.error?.message}>
          <TextInput id="missing-rate" inputMode="decimal" autoFocus value={rate} onChange={(event) => setRate(event.target.value)}
            placeholder="3.75" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save rate"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** How a bank-file client's table is read: the bank's own figures as sent, or converted to dollars. */
export type FileView = "converted" | "bank";

/** The two readings of a bank-file client's table, converted first. */
export function FileViewToggle({ value, onChange }: { value: FileView; onChange: (value: FileView) => void }) {
  return (
    <div role="group" aria-label="How the figures are shown" className="flex rounded-lg border border-line p-0.5 text-xs">
      {([["converted", "Converted · USD"], ["bank", "Bank view"]] as const).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
          className={value === id ? "rounded-md bg-primary-50 px-2.5 py-1 font-semibold text-primary-700" : "rounded-md px-2.5 py-1 font-medium text-ink-soft hover:text-ink"}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** An amount in dollars at the screen's own rates, to the cent; null where FX rates holds none for its currency. */
export function inUsd(amount: number, currency: string | null | undefined, converted: WorkspaceConverted | null | undefined) {
  const rate = converted && currency ? (converted.perUsd as Record<string, number>)[currency] : undefined;
  return rate ? Math.round((amount / rate) * 100) / 100 : null;
}

/** Amounts in several currencies added up in dollars, and the currencies that could not be, for want of a rate. */
export function sumInUsd(amounts: { amount: number; currency: string }[], converted: WorkspaceConverted) {
  let total = 0;
  const missing = new Set<string>();
  for (const one of amounts) {
    const usd = inUsd(one.amount, one.currency, converted);
    if (usd == null) missing.add(one.currency);
    else total += usd;
  }
  return { total: Math.round(total * 100) / 100, missing: [...missing] };
}
