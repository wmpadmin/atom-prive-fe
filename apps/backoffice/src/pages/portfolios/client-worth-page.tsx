import { ApiError } from "@atomprive/api-client";
import {
  getListClientLoansQueryKey,
  getListNonFinancialAssetsQueryKey,
  useChangeClientLoan,
  useChangeNonFinancialAsset,
  useListClientLoans,
  useListNonFinancialAssets,
  useRecordClientLoan,
  useRecordNonFinancialAsset,
  useRemoveClientLoan,
  useRemoveNonFinancialAsset,
  type ClientLoans,
  type ClientNonFinancialAssets,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import type { StepProps } from "./portfolio-setup-dialog";

/**
 * One line of either list: what it is, whatever else has to be said about it, and a figure.
 *
 * <p>The two lists are the same shape because the two questions are: something with a name and a value,
 * as many as there are. What differs is what the name is called and which way the figure is kept.
 */
type Line = {
  /** What it is already written down as, where it is. Null for one nobody has written yet. */
  id: string | null;
  /** The short name. Empty on a loan, which says what it is in one line and has no second box. */
  item: string;
  description: string;
  /** Kept as a string so a half-typed figure is not rounded away under the cursor. */
  amount: string;
};

const NOTHING_YET: Line = { id: null, item: "", description: "", amount: "" };

/** Figures only, and one point. Letters in a money box are not a small mistake to round away. */
function asFigure(typed: string, before: string) {
  const kept = typed.replace(/[^0-9.]/g, "");
  return (kept.split(".").length > 2) ? before : kept;
}

function isNumber(typed: string) {
  return typed.trim() !== "" && Number.isFinite(Number(typed));
}

function adds(rows: Line[]) {
  const total = rows.reduce((sum, one) => sum + (isNumber(one.amount) ? Number(one.amount) : 0), 0);
  return Math.round(total * 100) / 100;
}

/** What tells one line from another: a name where there is one, and the description where there is not. */
function named(one: Line, hasItem: boolean) {
  return (hasItem ? one.item : one.description).trim() !== "";
}

/**
 * What a client is worth beside their portfolio: what they own that nobody manages, and what they owe.
 *
 * <p>One screen, because they are the same question asked twice — what else is there, and against it, what
 * is owed — and neither is long enough to be worth a sitting of its own. Both are kept off the allocation:
 * a target is a share of money that can be moved to reach it, and neither a house nor a debt can be moved.
 */
export function WorthStep({ customerId, onDone, onBack }: StepProps) {
  const queryClient = useQueryClient();
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId);
  const owed = useListClientLoans<ClientLoans, ApiError>(customerId);
  const [errors, setErrors] = useState<FormErrors>(noErrors);

  const writeOwned = useRecordNonFinancialAsset<ApiError>();
  const changeOwned = useChangeNonFinancialAsset<ApiError>();
  const forgetOwned = useRemoveNonFinancialAsset<ApiError>();
  const writeOwed = useRecordClientLoan<ApiError>();
  const changeOwed = useChangeClientLoan<ApiError>();
  const forgetOwed = useRemoveClientLoan<ApiError>();
  const busy = writeOwned.isPending || changeOwned.isPending || forgetOwned.isPending
    || writeOwed.isPending || changeOwed.isPending || forgetOwed.isPending;

  // Seeded from what is already written down, with one blank line at the end of each so the next thing
  // can be written without reaching for a button first.
  const [typedOwned, setOwned] = useState<Line[] | null>(null);
  const [typedOwed, setOwed] = useState<Line[] | null>(null);

  const ownedAsRead = useMemo<Line[]>(() => [
    ...(owned.data?.items ?? []).map((one) => ({
      id: one.id,
      item: one.item,
      description: one.description ?? "",
      amount: String(one.valueAmount),
    })),
    NOTHING_YET,
  ], [owned.data]);
  const owedAsRead = useMemo<Line[]>(() => [
    ...(owed.data?.loans ?? []).map((one) => ({
      id: one.id,
      item: "",
      description: one.description,
      // Shown as a plain figure, because nobody writes a minus sign to say what they owe. It is kept
      // negative, so what comes back is turned round to be read.
      amount: String(Math.abs(one.valueAmount)),
    })),
    NOTHING_YET,
  ], [owed.data]);

  const ownedRows = typedOwned ?? ownedAsRead;
  const owedRows = typedOwed ?? owedAsRead;
  const wasOwned = new Map(ownedAsRead.filter((one) => one.id !== null).map((one) => [one.id, one]));
  const wasOwed = new Map(owedAsRead.filter((one) => one.id !== null).map((one) => [one.id, one]));

  const currency = owned.data?.currency ?? owed.data?.currency ?? "";
  const ownedTotal = adds(ownedRows);
  const owedTotal = adds(owedRows);

  // A line with a figure on it has to say what it is; one with neither is the blank line at the end.
  const unnamed = [...ownedRows.filter((one) => one.amount.trim() !== "" && !named(one, true)),
    ...owedRows.filter((one) => one.amount.trim() !== "" && !named(one, false))];
  const unreadable = [...ownedRows, ...owedRows]
    .filter((one) => one.amount.trim() !== "" && !isNumber(one.amount));
  const readable = unnamed.length === 0 && unreadable.length === 0;

  /** The blank line at the end is kept blank: once somebody writes in it, another one follows it. */
  function put(rows: Line[], set: (rows: Line[]) => void, hasItem: boolean) {
    return (at: number, part: Partial<Line>) => {
      const after = rows.map((was, which) => (which === at ? { ...was, ...part } : was));
      const last = after[after.length - 1];
      set((last && (named(last, hasItem) || last.amount.trim() !== ""))
        ? [...after, NOTHING_YET] : after);
    };
  }
  const putOwned = put(ownedRows, setOwned, true);
  const putOwed = put(owedRows, setOwed, false);

  /**
   * Written one at a time, because that is what the API takes. Something already written down is changed,
   * something whose name has been cleared is taken off, and anything nobody touched is left alone.
   */
  async function save() {
    setErrors(noErrors);
    try {
      for (const one of ownedRows) {
        if (!named(one, true)) {
          if (one.id !== null) await forgetOwned.mutateAsync({ customerId, id: one.id });
          continue;
        }
        const data = {
          item: one.item.trim(),
          description: one.description.trim() || null,
          valueAmount: isNumber(one.amount) ? Number(one.amount) : 0,
        };
        if (one.id === null) {
          await writeOwned.mutateAsync({ customerId, data });
          continue;
        }
        const was = wasOwned.get(one.id);
        if (was?.item === one.item && was.description === one.description && was.amount === one.amount) {
          continue;
        }
        await changeOwned.mutateAsync({ customerId, id: one.id, data });
      }

      for (const one of owedRows) {
        if (!named(one, false)) {
          if (one.id !== null) await forgetOwed.mutateAsync({ customerId, id: one.id });
          continue;
        }
        const data = {
          description: one.description.trim(),
          valueAmount: isNumber(one.amount) ? Number(one.amount) : 0,
        };
        if (one.id === null) {
          await writeOwed.mutateAsync({ customerId, data });
          continue;
        }
        const was = wasOwed.get(one.id);
        if (was?.description === one.description && was.amount === one.amount) continue;
        await changeOwed.mutateAsync({ customerId, id: one.id, data });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListNonFinancialAssetsQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getListClientLoansQueryKey(customerId) }),
      ]);
      setOwned(null);
      setOwed(null);
      onDone();
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
  }

  if (owned.isError || owed.isError) {
    return <Alert tone="danger">{(owned.error ?? owed.error)?.message}</Alert>;
  }

  const money = (figure: number, brackets: boolean) =>
    (figure > 0 ? (brackets ? `(${figure.toLocaleString()})` : figure.toLocaleString()) : "—");

  return (
    <div className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {/* What they own. Three boxes, because a flat and a painting need different things said about them. */}
      <section className="rounded-2xl border border-line bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="font-semibold text-ink">Non Financial Asset</h2>
          <p className="text-sm font-bold tabular-nums text-ink">
            {ownedTotal > 0 ? `${money(ownedTotal, false)} ${currency}` : "—"}
          </p>
        </header>
        <p className="px-4 pt-2 text-xs text-ink-muted">
          A house, a painting, a stake in their own company. None of it can be sold to put a portfolio back
          where its plan wants it, so none of it is on the allocation.
        </p>
        <div className="grid grid-cols-[1fr_1.5fr_8rem_2.25rem] items-center gap-3 px-4 pt-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Item</span>
          <span>Description</span>
          <span className="text-right">Value</span>
          <span className="sr-only">Take it off</span>
        </div>
        <ul className="divide-y divide-line">
          {ownedRows.map((one, at) => (
            <li
              key={one.id ?? `new-${at}`}
              className="grid grid-cols-[1fr_1.5fr_8rem_2.25rem] items-start gap-3 px-4 py-1.5"
            >
              <TextInput
                aria-label={`What the client owns, line ${at + 1}`}
                placeholder="Flat, Juhu"
                value={one.item}
                onChange={(event) => putOwned(at, { item: event.target.value })}
              />
              <TextArea
                aria-label={`About ${one.item || `line ${at + 1}`}`}
                placeholder="Whatever else has to be said about it"
                rows={1}
                value={one.description}
                onChange={(event) => putOwned(at, { description: event.target.value })}
              />
              <div className="relative">
                <TextInput
                  aria-label={`What ${one.item || `line ${at + 1}`} is worth`}
                  inputMode="decimal"
                  className={cn("text-right", currency && "pr-11")}
                  value={one.amount}
                  onChange={(event) => putOwned(at, { amount: asFigure(event.target.value, one.amount) })}
                />
                {currency && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-2xs text-ink-muted"
                  >
                    {currency}
                  </span>
                )}
              </div>
              <span className="pt-1">
                {(one.item.trim() !== "" || one.amount.trim() !== "") && (
                  <IconButton
                    label={`Take ${one.item || `line ${at + 1}`} off`}
                    onClick={() => putOwned(at, { item: "", description: "", amount: "" })}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </IconButton>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-4 py-1.5">
          <button
            type="button"
            onClick={() => setOwned([...ownedRows, NOTHING_YET])}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add another
          </button>
        </div>
      </section>

      {/* Loans. One line of text, because who it is from and what it is secured on is one answer. */}
      <section className="rounded-2xl border border-line bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="font-semibold text-ink">Loan</h2>
          <p className={cn("text-sm font-bold tabular-nums", owedTotal > 0 ? "text-red-700" : "text-ink")}>
            {owedTotal > 0 ? `${money(owedTotal, true)} ${currency}` : "—"}
          </p>
        </header>
        <p className="px-4 pt-2 text-xs text-ink-muted">
          Borrowed against the portfolio, against a property, against anything. Write what is owed as a
          plain figure: it is kept as a figure that is owed, so everything that has to allow for it adds it.
        </p>
        <div className="grid grid-cols-[1fr_8rem_2.25rem] items-center gap-3 px-4 pt-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Description</span>
          <span className="text-right">Owed</span>
          <span className="sr-only">Take it off</span>
        </div>
        <ul className="divide-y divide-line">
          {owedRows.map((one, at) => (
            <li
              key={one.id ?? `new-${at}`}
              className="grid grid-cols-[1fr_8rem_2.25rem] items-start gap-3 px-4 py-1.5"
            >
              <TextArea
                aria-label={`What the client owes, line ${at + 1}`}
                placeholder="Mortgage on the Juhu flat — HDFC, secured on the flat"
                rows={1}
                value={one.description}
                onChange={(event) => putOwed(at, { description: event.target.value })}
              />
              <div className="relative">
                <TextInput
                  aria-label={`What is owed on ${one.description || `line ${at + 1}`}`}
                  inputMode="decimal"
                  className={cn("text-right", currency && "pr-11")}
                  value={one.amount}
                  onChange={(event) => putOwed(at, { amount: asFigure(event.target.value, one.amount) })}
                />
                {currency && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-2xs text-ink-muted"
                  >
                    {currency}
                  </span>
                )}
              </div>
              <span className="pt-1">
                {(one.description.trim() !== "" || one.amount.trim() !== "") && (
                  <IconButton
                    label={`Take ${one.description || `line ${at + 1}`} off`}
                    onClick={() => putOwed(at, { description: "", amount: "" })}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </IconButton>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-4 py-1.5">
          <button
            type="button"
            onClick={() => setOwed([...owedRows, NOTHING_YET])}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add another
          </button>
        </div>
      </section>

      {unnamed.length > 0 && (
        <Alert tone="danger">Something with a figure on it has to say what it is.</Alert>
      )}
      {unreadable.length > 0 && (
        <Alert tone="danger">A figure box has something in it that is not a figure.</Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" type="button" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={busy || !readable} onClick={() => void save()}>
          {busy ? "Saving…" : "Save as draft"}
        </Button>
      </div>
    </div>
  );
}
