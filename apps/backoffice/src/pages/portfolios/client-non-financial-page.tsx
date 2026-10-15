import { ApiError } from "@atomprive/api-client";
import {
  getListNonFinancialAssetsQueryKey,
  useChangeNonFinancialAsset,
  useGetCustomer,
  useListNonFinancialAssets,
  useRecordNonFinancialAsset,
  useRemoveNonFinancialAsset,
  type ClientNonFinancialAssets,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { SetUpSteps } from "./portfolio-setup-steps";

/** One thing somebody is writing down: what it is, whatever else has to be said, and what it is worth. */
type Owned = {
  /** What it is already written down as, where it is. Null for one nobody has written yet. */
  id: string | null;
  item: string;
  description: string;
  /** Kept as a string so a half-typed figure is not rounded away under the cursor. */
  amount: string;
};

const NOTHING_YET: Owned = { id: null, item: "", description: "", amount: "" };

/** Figures only, and one point. Letters in a money box are not a small mistake to round away. */
function asFigure(typed: string, before: string) {
  const kept = typed.replace(/[^0-9.]/g, "");
  return (kept.split(".").length > 2) ? before : kept;
}

function isNumber(typed: string) {
  return typed.trim() !== "" && Number.isFinite(Number(typed));
}

/**
 * What a client owns that nobody manages: a house, a painting, a stake in their own company.
 *
 * <p>Its own screen, apart from the allocation, because it is a different question. An allocation is a plan
 * for money that can be moved to follow it; none of this can be moved, so a target for it would mean
 * nothing and counting it in would make every percentage on the portfolio a share of money that is not
 * there to invest. It belongs in what the client is worth, and nowhere else.
 */
export function ClientNonFinancialPage() {
  const { customerId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const write = useRecordNonFinancialAsset<ApiError>();
  const change = useChangeNonFinancialAsset<ApiError>();
  const forget = useRemoveNonFinancialAsset<ApiError>();
  const busy = write.isPending || change.isPending || forget.isPending;

  // Seeded from what is already written down, with one blank line at the end so the next thing can be
  // written without reaching for a button first.
  const [typed, setTyped] = useState<Owned[] | null>(null);
  const asRead = useMemo<Owned[]>(() => [
    ...(owned.data?.items ?? []).map((one) => ({
      id: one.id,
      item: one.item,
      description: one.description ?? "",
      amount: String(one.valueAmount),
    })),
    NOTHING_YET,
  ], [owned.data]);
  const rows = typed ?? asRead;
  const wasRead = new Map(asRead.filter((one) => one.id !== null).map((one) => [one.id, one]));

  const currency = owned.data?.currency ?? "";
  const whole = Math.round(rows.reduce(
    (total, one) => total + (isNumber(one.amount) ? Number(one.amount) : 0), 0) * 100) / 100;
  // A line with a figure on it has to say what it is; one with neither is the blank line at the end.
  const unnamed = rows.filter((one) => one.amount.trim() !== "" && one.item.trim() === "");
  const unreadable = rows.filter((one) => one.amount.trim() !== "" && !isNumber(one.amount));
  const readable = unnamed.length === 0 && unreadable.length === 0;

  function put(at: number, part: Partial<Owned>) {
    const put = rows.map((was, which) => (which === at ? { ...was, ...part } : was));
    // The blank line at the end is kept blank: once somebody writes in it, another one follows it.
    const last = put[put.length - 1];
    setTyped((last && (last.item.trim() !== "" || last.amount.trim() !== "")) ? [...put, NOTHING_YET] : put);
  }

  /**
   * Written one at a time, because that is what the API takes. Something already written down is changed
   * where it still has a name, and taken off where its name has been cleared; a line nobody touched is
   * left alone.
   */
  async function save() {
    setErrors(noErrors);
    try {
      for (const one of rows) {
        const named = one.item.trim() !== "";
        if (!named) {
          if (one.id !== null) {
            await forget.mutateAsync({ customerId, id: one.id });
          }
          continue;
        }
        const data = {
          item: one.item.trim(),
          description: one.description.trim() || null,
          valueAmount: isNumber(one.amount) ? Number(one.amount) : 0,
        };
        if (one.id === null) {
          await write.mutateAsync({ customerId, data });
          continue;
        }
        const was = wasRead.get(one.id);
        if (was?.item === one.item && was.description === one.description && was.amount === one.amount) {
          continue;
        }
        await change.mutateAsync({ customerId, id: one.id, data });
      }
      await queryClient.invalidateQueries({ queryKey: getListNonFinancialAssetsQueryKey(customerId) });
      setTyped(null);
      // On to what they owe, which is the last of the three and the one the other two are read against.
      void navigate(`/portfolio-clients/${customerId}/loans`);
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
  }

  if (owned.isError) {
    return <Alert tone="danger">{owned.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <SetUpSteps
        step={2}
        customerId={customerId}
        heading="What they own but nobody manages"
        lead={<>
          A house, a painting, a stake in {client.data?.client.fullName ?? "the client"}&apos;s own company.
          It counts towards what they are worth. It is not on the allocation, because none of it can be sold
          to put a portfolio back where its plan wants it.
        </>}
      />

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <section className="rounded-2xl border border-line bg-white">
        <div className="grid grid-cols-[1fr_1.5fr_10rem_2.25rem] items-center gap-3 border-b border-line px-5 py-2.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Item</span>
          <span>Description</span>
          <span className="text-right">Value</span>
          <span className="sr-only">Take it off</span>
        </div>

        <ul className="divide-y divide-line">
          {rows.map((one, at) => (
            <li
              key={one.id ?? `new-${at}`}
              className="grid grid-cols-[1fr_1.5fr_10rem_2.25rem] items-start gap-3 px-5 py-2.5"
            >
              <TextInput
                aria-label={`What the client owns, line ${at + 1}`}
                placeholder="Flat, Juhu"
                value={one.item}
                onChange={(event) => put(at, { item: event.target.value })}
              />
              <TextArea
                aria-label={`About ${one.item || `line ${at + 1}`}`}
                placeholder="Whatever else has to be said about it"
                rows={1}
                value={one.description}
                onChange={(event) => put(at, { description: event.target.value })}
              />
              <div className="relative">
                <TextInput
                  aria-label={`What ${one.item || `line ${at + 1}`} is worth`}
                  inputMode="decimal"
                  className={cn("text-right", currency && "pr-12")}
                  value={one.amount}
                  onChange={(event) => put(at, { amount: asFigure(event.target.value, one.amount) })}
                />
                {currency && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-muted"
                  >
                    {currency}
                  </span>
                )}
              </div>
              {/* The blank line at the end has nothing to take off yet. */}
              <span className="pt-1">
                {(one.item.trim() !== "" || one.amount.trim() !== "") && (
                  <IconButton
                    label={`Take ${one.item || `line ${at + 1}`} off`}
                    onClick={() => put(at, { item: "", description: "", amount: "" })}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </IconButton>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-5 py-2.5">
          <button
            type="button"
            onClick={() => setTyped([...rows, NOTHING_YET])}
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

      <section className="rounded-2xl border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-semibold text-ink">Non-financial assets ($)</h2>
            <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
              What it all comes to. Counted in what the client is worth, and in nothing else.
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-ink">
            {whole > 0 ? `${whole.toLocaleString()} ${currency}` : "—"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button
          variant="secondary"
          type="button"
          onClick={() => void navigate(`/portfolio-clients/${customerId}/allocation`)}
        >
          Back
        </Button>
        <Button type="button" disabled={busy || !readable} onClick={() => void save()}>
          {busy ? "Writing it down…" : "Next"}
        </Button>
      </div>
    </div>
  );
}
