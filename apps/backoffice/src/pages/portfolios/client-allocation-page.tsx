import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getListClientHoldingsQueryKey,
  useGetCustomer,
  useListClientHoldings,
  useRecordClientHolding,
  type ClientHoldings,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { barFor, useAssetClasses } from "./asset-classes";
import { useSubAssetClasses } from "./sub-asset-classes";

/** One line somebody is writing down: where it sits, what it is called, and what it is worth. */
type Line = {
  /** The name as it will be stored. The firm's lines keep theirs; a line of this client's own is theirs to reword. */
  name: string;
  /** What is in it, as typed. Kept as a string so a half-typed figure is not rounded away under the cursor. */
  amount: string;
  /** Whether the firm named this line, and so whether it may be reworded or taken off here. */
  theFirms: boolean;
};

/** Figures only, and one point. Letters in a money box are not a small mistake to round away. */
function asFigure(typed: string, before: string) {
  const kept = typed.replace(/[^0-9.]/g, "");
  return (kept.split(".").length > 2) ? before : kept;
}

function isNumber(typed: string) {
  return typed.trim() !== "" && Number.isFinite(Number(typed));
}

function adds(lines: Line[]) {
  return lines.reduce((total, one) => total + (isNumber(one.amount) ? Number(one.amount) : 0), 0);
}

/**
 * What a client's money is actually spread across, written down class by class and line by line.
 *
 * <p>Asked for when a client is first put on a model, because a model says what a portfolio should be and
 * can say nothing at all until somebody has written down what it is. The firm's own sub-assets are set out
 * ready to be filled in; a portfolio holds what it holds, though, so anything the firm has not named can be
 * added here and belongs to this client.
 */
export function ClientAllocationPage() {
  const { customerId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const assetClasses = useAssetClasses();
  const subAssets = useSubAssetClasses();
  const client = useGetCustomer<CustomerDetail, ApiError>(customerId);
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const write = useRecordClientHolding<ApiError>();

  // Seeded once from the firm's list, which may not have arrived on the first render — so it is rebuilt
  // when it does, and anything typed by then is kept over the top of it.
  const [typed, setTyped] = useState<Record<string, Line[]>>({});
  const blank = useMemo(() => {
    const made: Record<string, Line[]> = {};
    for (const one of assetClasses.inUse) {
      made[one.code] = (subAssets.byClass[one.code] ?? []).map((name) => ({ name, amount: "", theFirms: true }));
    }
    return made;
  }, [assetClasses.inUse, subAssets.byClass]);
  const lines: Record<string, Line[]> = { ...blank, ...typed };
  const codes = assetClasses.inUse.map((one) => one.code);

  function put(assetClass: string, rows: Line[]) {
    setTyped({ ...lines, [assetClass]: rows });
  }

  const currency = holdings.data?.currency ?? "";
  const whole = codes.reduce((total, code) => total + adds(lines[code] ?? []), 0);
  // Nothing is written down until every figure is a figure, and a line nobody has named cannot be stored.
  const unreadable = codes.flatMap((code) =>
    (lines[code] ?? []).filter((one) => one.amount.trim() !== "" && !isNumber(one.amount)));
  const unnamed = codes.flatMap((code) =>
    (lines[code] ?? []).filter((one) => one.amount.trim() !== "" && one.name.trim() === ""));
  // The same line twice in one class is two rows the platform cannot tell apart afterwards.
  const twiceNamed = codes.filter((code) => {
    const said = (lines[code] ?? []).map((one) => one.name.trim().toLowerCase()).filter((name) => name !== "");
    return new Set(said).size !== said.length;
  });
  const readable = unreadable.length === 0 && unnamed.length === 0 && twiceNamed.length === 0;
  const anything = whole > 0;

  // Written one line at a time, because that is what the API takes. Anything already written down is left
  // alone: this screen is for a portfolio nobody has set out yet, not a second way to edit one.
  async function save() {
    setErrors(noErrors);
    try {
      for (const assetClass of codes) {
        for (const line of lines[assetClass] ?? []) {
          if (!isNumber(line.amount) || Number(line.amount) <= 0) {
            continue;
          }
          await write.mutateAsync({
            customerId,
            data: {
              assetClass,
              subClass: line.name.trim(),
              name: line.name.trim(),
              identifier: null, issuer: null, countryCode: null, creditRating: null, sector: null,
              yieldPercent: null, durationYears: null,
              valueAmount: Number(line.amount),
              watchPp: null, edgePp: null, breachPp: null,
            },
          });
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) }),
      ]);
      void navigate(`/portfolio-clients/${customerId}`);
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
  }

  if (assetClasses.isError) {
    return <Alert tone="danger">{assetClasses.error?.message}</Alert>;
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <Link to={`/portfolio-clients/${customerId}`} className="text-xs font-semibold text-primary-700 hover:underline">
          ← Back to the portfolio
        </Link>
        <h1 className="mt-2 text-xl font-bold text-ink">Write down the allocation</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          What {client.data?.client.fullName ?? "this client"}&apos;s money is spread across today. A model says what a
          portfolio should be and can say nothing until this is written down. Leave a line empty where there is
          nothing in it.
        </p>
      </div>

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {assetClasses.inUse.map((one) => {
        const rows = lines[one.code] ?? [];
        const inClass = adds(rows);
        return (
          <section key={one.code} className="rounded-2xl border border-line bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="flex items-center gap-2.5 font-semibold text-ink">
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", barFor(one.code, assetClasses.all))} />
                {one.name}
              </h2>
              <p className="text-sm tabular-nums text-ink-soft">
                {inClass > 0 ? inClass.toLocaleString() : "—"}
                {inClass > 0 && whole > 0 && (
                  <span className="ml-2 text-xs text-ink-muted">
                    {((inClass / whole) * 100).toFixed(2)}% of the portfolio
                  </span>
                )}
              </p>
            </header>

            <ul className="divide-y divide-line">
              {rows.map((line, at) => (
                <li key={at} className="flex items-center gap-3 px-5 py-2.5">
                  {line.theFirms ? (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{line.name}</span>
                  ) : (
                    <TextInput
                      aria-label={`Name of the line added under ${one.name}`}
                      placeholder="What this client holds it in"
                      className="min-w-0 flex-1"
                      value={line.name}
                      onChange={(event) =>
                        put(one.code, rows.map((was, which) =>
                          which === at ? { ...was, name: event.target.value } : was))
                      }
                    />
                  )}
                  <div className="relative w-40 shrink-0">
                    <TextInput
                      aria-label={`What is in ${line.name || "this line"}`}
                      inputMode="decimal"
                      className={cn("text-right", currency && "pr-12")}
                      value={line.amount}
                      onChange={(event) =>
                        put(one.code, rows.map((was, which) =>
                          which === at ? { ...was, amount: asFigure(event.target.value, was.amount) } : was))
                      }
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
                  {/* The firm's own lines are not one client's to take off; what somebody added here is. */}
                  <span className="w-9 shrink-0">
                    {!line.theFirms && (
                      <IconButton
                        label={`Take ${line.name || "this line"} off`}
                        onClick={() => put(one.code, rows.filter((_, which) => which !== at))}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    )}
                  </span>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="px-5 py-3 text-sm text-ink-muted">
                  The firm names nothing under {one.name}. Add what this client holds.
                </li>
              )}
            </ul>

            <div className="border-t border-line px-5 py-2.5">
              <button
                type="button"
                onClick={() => put(one.code, [...rows, { name: "", amount: "", theFirms: false }])}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Add a line under {one.name}
              </button>
            </div>
          </section>
        );
      })}

      {twiceNamed.length > 0 && (
        <Alert tone="danger">
          {twiceNamed.map((code) => assetClasses.names[code] ?? code).join(", ")}{" "}
          {twiceNamed.length === 1 ? "names a line twice" : "name a line twice"}. Two rows with one name cannot be
          told apart afterwards.
        </Alert>
      )}
      {unnamed.length > 0 && (
        <Alert tone="danger">A line with money in it has to be named before it can be written down.</Alert>
      )}
      {unreadable.length > 0 && (
        <Alert tone="danger">A figure box has something in it that is not a figure.</Alert>
      )}

      {/* Kept in sight at the foot, because the total is the figure every percentage on the next screen is
          worked out against and this page is longer than the window. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-x-4 gap-y-2 px-6 py-3">
          <p className="mr-auto text-sm text-ink-soft">
            Written down so far{" "}
            <span className="font-bold tabular-nums text-ink">
              {whole > 0 ? `${whole.toLocaleString()} ${currency}` : "nothing yet"}
            </span>
          </p>
          <Button variant="secondary" type="button" onClick={() => void navigate(`/portfolio-clients/${customerId}`)}>
            Cancel
          </Button>
          <Button type="button" disabled={write.isPending || !readable || !anything} onClick={() => void save()}>
            {write.isPending ? "Writing it down…" : "Write it down"}
          </Button>
        </div>
      </div>
    </div>
  );
}
