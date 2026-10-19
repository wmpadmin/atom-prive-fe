import { ApiError } from "@atomprive/api-client";
import {
  getListClientCashflowsQueryKey,
  getListClientReturnsQueryKey,
  useListClientCashflows,
  useRecordClientCashflow,
  useRemoveClientCashflow,
  type CashflowList,
  type CashflowRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, DateInput, IconButton, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "../../lib/labels";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { exactly } from "./money-words";

/** As far back as a movement may be dated. A portfolio older than this is not one anybody is correcting. */
function yearsAgo(years: number) {
  const then = new Date();
  then.setFullYear(then.getFullYear() - years);
  return then;
}

/** Which way the money went, as somebody says it rather than as a sign on a figure. */
const WAYS = [
  { id: "in", label: "Paid in", hint: "The client put money into the portfolio" },
  { id: "out", label: "Taken out", hint: "The client took money out of the portfolio" },
] as const;

/**
 * Money paid into a client's portfolio and taken out of it, with the day each movement happened.
 *
 * <p>The one thing every return on this platform is built on and the one thing nothing could write down.
 * A return works by taking these back out of the answer — that is the whole of what separates what the
 * money earned from what somebody deposited — and it can only take out what is here. With nothing on
 * file a client whose figures were written at 728 one day and 28,640 the next reads as having earned
 * 3,831%, and every figure on the Return tab says the same thing in a different arrangement.
 *
 * <p>The day matters as much as the amount, which is why it is asked for rather than taken as today. A
 * million that arrived in December earned three weeks of whatever the year did; the same million dated
 * January earns the whole of it, and nothing downstream can tell the two apart afterwards.
 *
 * <p>Written straight down rather than asked for. It is not a figure about the portfolio — it does not
 * move a rupee between anything the client holds, and nobody is being asked to agree to a statement of
 * what already happened. What it changes is how the figures already on file are read.
 */
export function ClientCashflowsPanel({ customerId, currency }: {
  customerId: string;
  /** What the portfolio is kept in, so a movement is written in the same money as the figures it bends. */
  currency: string;
}) {
  const queryClient = useQueryClient();
  const listed = useListClientCashflows<CashflowList, ApiError>(customerId);
  const [adding, setAdding] = useState(false);
  const [on, setOn] = useState("");
  const [way, setWay] = useState<(typeof WAYS)[number]["id"]>("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  function written() {
    setAdding(false);
    setOn("");
    setAmount("");
    setNote("");
    setErrors(noErrors);
    // The returns are read off these, so every one of them is stale the moment one is written.
    void queryClient.invalidateQueries({ queryKey: getListClientCashflowsQueryKey(customerId) });
    void queryClient.invalidateQueries({ queryKey: getListClientReturnsQueryKey(customerId) });
  }
  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const record = useRecordClientCashflow<ApiError>({ mutation: { onSuccess: written, onError } });
  const remove = useRemoveClientCashflow<ApiError>({ mutation: { onSuccess: written, onError } });
  const busy = record.isPending || remove.isPending;

  const rows: CashflowRow[] = listed.data?.items ?? [];
  const typed = Number(amount);
  const readable = on !== "" && amount.trim() !== "" && Number.isFinite(typed) && typed > 0;

  function save() {
    setErrors(noErrors);
    record.mutate({
      customerId,
      data: {
        happenedOn: on,
        // Out of the portfolio is a negative figure, which is how everything downstream reads it. Asked
        // for as a direction and a plain amount, because nobody types a minus sign on purpose and a
        // withdrawal written as a positive is a deposit as far as every return is concerned.
        amount: way === "in" ? typed : -typed,
        currency,
        note: note.trim() || null,
      },
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Money in and out</h2>
          <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
            What the client paid in and took out, and the day each one happened. Every return on this
            screen works by taking these back out of the answer, so what is not written here is read as
            something the money earned.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => { setErrors(noErrors); setAdding(true); }}>
            <Plus aria-hidden="true" />
            Write one down
          </Button>
        )}
      </header>

      {errors.form && <div className="px-5 pt-4"><Alert tone="danger">{errors.form}</Alert></div>}

      {adding && (
        <div className="border-b border-line bg-slate-50/60 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                The day it moved
              </span>
              <span className="mt-1 block w-44">
                <DateInput id="cashflow-on" name="happenedOn" value={on}
                  min={yearsAgo(20)} max={new Date()}
                  onChange={(next) => setOn(next ?? "")} />
              </span>
            </label>
            <label className="block">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Which way
              </span>
              <SelectInput id="cashflow-way" value={way} className="mt-1 w-36"
                onChange={(event) => setWay(event.target.value as (typeof WAYS)[number]["id"])}>
                {WAYS.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
              </SelectInput>
            </label>
            <label className="block">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                How much ({currency})
              </span>
              <TextInput id="cashflow-amount" inputMode="decimal" value={amount} className="mt-1 w-40 text-right"
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} />
            </label>
            <label className="block min-w-48 flex-1">
              <span className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                What it was
              </span>
              <TextInput id="cashflow-note" value={note} className="mt-1"
                placeholder="Transfer from the client's current account"
                onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink-muted">{WAYS.find((one) => one.id === way)?.hint}.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={!readable || busy} onClick={save}>
              {record.isPending ? "Writing it down…" : "Write it down"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setAdding(false); setErrors(noErrors); }}>
              Cancel
            </Button>
            {!readable && (
              <span className="text-xs text-ink-muted">A day and an amount above nothing are both needed.</span>
            )}
          </div>
        </div>
      )}

      {listed.isPending ? (
        <p className="px-5 py-8 text-sm text-ink-muted">Reading what has moved…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-muted">
          Nothing written down yet. Until something is, every return on this screen reads the whole of
          what the figures changed by as something the money earned.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Money paid in and taken out, oldest first.</caption>
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3 whitespace-nowrap">The day it moved</th>
                <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Amount</th>
                <th scope="col" className="px-5 py-3">What it was</th>
                <th scope="col" className="px-5 py-3 whitespace-nowrap">Written down by</th>
                <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Take it off</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 whitespace-nowrap text-ink">{row.happenedOn}</td>
                  <td className={cn("px-5 py-3 text-right font-medium tabular-nums whitespace-nowrap",
                    row.amount < 0 ? "text-red-700" : "text-emerald-700")}>
                    {row.amount > 0 ? "+" : "−"}{exactly(Math.abs(row.amount), row.currency)}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{row.note ?? "—"}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-ink-muted">
                    {row.recordedBy ?? "—"}
                    <span className="block text-2xs">{formatDateTime(row.recordedAt)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {/* A movement written down wrongly bends every return that crosses it, so it comes
                        back off rather than being corrected into something else. */}
                    <IconButton
                      label={`Take the ${row.happenedOn} movement off`}
                      onClick={() => remove.mutate({ customerId, id: row.id })}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
