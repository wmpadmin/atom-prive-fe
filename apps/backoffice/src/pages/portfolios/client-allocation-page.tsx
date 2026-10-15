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
import { Link, Navigate, useNavigate, useParams } from "react-router";
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
      void navigate("/portfolio-clients");
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
  }

  if (assetClasses.isError) {
    return <Alert tone="danger">{assetClasses.error?.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portfolio-clients" className="text-xs font-semibold text-primary-700 hover:underline">
          ← Back to the clients
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
              {/* The figure only. This screen is where somebody writes down what is held; what any of it
                  comes to as a share of the whole is a reading of it, and belongs where it is read. */}
              <p className="text-sm font-bold tabular-nums text-ink">
                {inClass > 0 ? `${inClass.toLocaleString()} ${currency}` : "—"}
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

            {/* A class is not typed in: it is what the lines inside it come to. Set out under them, in
                the column they were typed in, so it reads as the sum rather than a figure of its own. */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 border-t-2 border-ink/15 px-5 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                  {one.name}, added up
                </span>
                <span className="w-40 shrink-0 pr-3 text-right text-sm font-bold tabular-nums text-ink">
                  {inClass > 0 ? inClass.toLocaleString() : "—"}
                </span>
                <span className="w-9 shrink-0" />
              </div>
            )}

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

      {/* What the six classes come to, said once and at the end — after the last of them has been
          written down, not following the page down beside the buttons. This is the figure every
          percentage the portfolio is read against is a share of. */}
      <section className="rounded-2xl border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-semibold text-ink">Investment AUM ($)</h2>
            <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
              What all six classes come to.
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-ink">
            {whole > 0 ? `${whole.toLocaleString()} ${currency}` : "—"}
          </p>
        </div>
      </section>

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

      {/* In the page rather than lying over it: the figure that had to be kept in sight is said at the
          end now, so the buttons can line up with the cards above them like every other screen's do. */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" type="button" onClick={() => void navigate("/portfolio-clients")}>
          Cancel
        </Button>
        <Button type="button" disabled={write.isPending || !readable || !anything} onClick={() => void save()}>
          {write.isPending ? "Writing it down…" : "Write it down"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Where a client's portfolio screen used to be. Keeps that address working while the screen is off, so
 * every link into it — from the queues, the dashboard, the client file — goes on working untouched.
 *
 * <p>The screen itself is still there, in client-portfolio-page.tsx, unreferenced and unchanged: putting
 * it back is giving it its route again and taking this off.
 */
export function ToTheAllocation() {
  const { customerId = "" } = useParams();
  return <Navigate replace to={`/portfolio-clients/${customerId}/allocation`} />;
}
