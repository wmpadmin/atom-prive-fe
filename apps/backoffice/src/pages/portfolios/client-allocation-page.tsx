import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getListClientHoldingsQueryKey,
  useListClientHoldings,
  useChangeClientHolding,
  useRecordClientHolding,
  useRemoveClientHolding,
  useSetClientHoldings,
  type ClientHoldings,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { barFor, useAssetClasses } from "./asset-classes";
import type { StepProps } from "./portfolio-setup-dialog";
import { useSubAssetClasses } from "./sub-asset-classes";

/** One line somebody is writing down: where it sits, what it is called, and what it is worth. */
type Line = {
  /** What this line is already written down as, where it is. Null for one nobody has written yet. */
  id: string | null;
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
  const total = lines.reduce((sum, one) => sum + (isNumber(one.amount) ? Number(one.amount) : 0), 0);
  // To the penny the figures are kept in. A sum carried at full floating-point precision is refused by
  // the API, which compares it against a class total worked out to two places from the same lines.
  return Math.round(total * 100) / 100;
}

/**
 * What a client's money is actually spread across, written down class by class and line by line.
 *
 * <p>Asked for when a client is first put on a model, because a model says what a portfolio should be and
 * can say nothing at all until somebody has written down what it is. The firm's own sub-assets are set out
 * ready to be filled in; a portfolio holds what it holds, though, so anything the firm has not named can be
 * added here and belongs to this client.
 */
export function AllocationStep({ customerId, onDone }: StepProps) {
  const queryClient = useQueryClient();
  const assetClasses = useAssetClasses();
  const subAssets = useSubAssetClasses();
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const write = useRecordClientHolding<ApiError>();
  const change = useChangeClientHolding<ApiError>();
  const forget = useRemoveClientHolding<ApiError>();
  const setHoldings = useSetClientHoldings<ApiError>();

  // Seeded once from the firm's list, which may not have arrived on the first render — so it is rebuilt
  // when it does, and anything typed by then is kept over the top of it.
  const [typed, setTyped] = useState<Record<string, Line[]>>({});
  const blank = useMemo(() => {
    const made: Record<string, Line[]> = {};
    for (const one of assetClasses.inUse) {
      // What this client already has written down under this class, by the name it was written under.
      const written = (holdings.data?.classes ?? [])
        .find((each) => each.assetClass === one.code)?.subClasses
        .flatMap((group) => group.positions) ?? [];
      const byName = new Map(written.map((each) => [(each.subClass ?? each.name).trim(), each]));
      const rows: Line[] = (subAssets.byClass[one.code] ?? []).map((name) => {
        const already = byName.get(name);
        byName.delete(name);
        return {
          id: already?.id ?? null,
          name,
          amount: (already == null) ? "" : String(already.valueAmount),
          theFirms: true,
        };
      });
      // Written down under a name the firm does not list: this client's own, and theirs to reword.
      for (const each of byName.values()) {
        rows.push({
          id: each.id,
          name: (each.subClass ?? each.name).trim(),
          amount: String(each.valueAmount),
          theFirms: false,
        });
      }
      made[one.code] = rows;
    }
    return made;
  }, [assetClasses.inUse, subAssets.byClass, holdings.data]);
  const lines: Record<string, Line[]> = { ...blank, ...typed };
  // What each written line was when it was read, so a save can leave alone the ones nobody touched.
  // Pressing Write it down on a portfolio of two dozen lines was two dozen calls, every one of them
  // sending a figure back exactly as it came.
  const asRead = new Map(Object.values(blank).flat()
    .filter((line) => line.id !== null)
    .map((line) => [line.id, line]));
  const codes = assetClasses.inUse.map((one) => one.code);

  function put(assetClass: string, rows: Line[]) {
    setTyped({ ...lines, [assetClass]: rows });
  }

  const currency = holdings.data?.currency ?? "";
  const busy = write.isPending || change.isPending || forget.isPending || setHoldings.isPending;
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

  /**
   * Written one line at a time, because that is what the API takes.
   *
   * <p>A line already written down is changed where it has a figure and taken off where it no longer has
   * one — emptying a box is how somebody says the client holds none of it, and leaving the line standing
   * at its old figure would be ignoring them. A line nobody has written yet is only written where it has
   * a figure, so a class left untouched writes nothing at all.
   */
  async function save() {
    setErrors(noErrors);
    try {
      for (const assetClass of codes) {
        for (const line of lines[assetClass] ?? []) {
          const holds = isNumber(line.amount) && Number(line.amount) > 0;
          if (!holds) {
            if (line.id !== null) {
              await forget.mutateAsync({ customerId, id: line.id });
            }
            continue;
          }
          const data = {
            assetClass,
            subClass: line.name.trim(),
            name: line.name.trim(),
            identifier: null, issuer: null, countryCode: null, creditRating: null, sector: null,
            yieldPercent: null, durationYears: null,
            valueAmount: Number(line.amount),
            watchPp: null, edgePp: null, breachPp: null,
          };
          if (line.id !== null) {
            const was = asRead.get(line.id);
            if (was?.amount === line.amount && was.name === line.name) {
              continue;
            }
            await change.mutateAsync({ customerId, id: line.id, data });
          }
          else {
            await write.mutateAsync({ customerId, data });
          }
        }
      }
      // And then the figure they all come to, kept as the portfolio's own. Every class's total is sent
      // back exactly as its lines come to, because the API refuses to be told a different total for a
      // class written down line by line — which is the whole of what was just written.
      const perClass: Record<string, number> = {};
      for (const assetClass of codes) {
        const inClass = adds(lines[assetClass] ?? []);
        if (inClass > 0) {
          perClass[assetClass] = inClass;
        }
      }
      await setHoldings.mutateAsync({
        customerId,
        data: { holdings: perClass, currency: currency || null, netAum: whole },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) }),
      ]);
      onDone();
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
  }

  if (assetClasses.isError) {
    return <Alert tone="danger">{assetClasses.error?.message}</Alert>;
  }

  return (
    <div className="space-y-4">
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {assetClasses.inUse.map((one) => {
        const rows = lines[one.code] ?? [];
        const inClass = adds(rows);
        return (
          <section key={one.code} className="rounded-2xl border border-line bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2">
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
                <li key={at} className="flex items-center gap-3 px-4 py-1">
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
                  <div className="relative w-32 shrink-0">
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
                <li className="px-4 py-2 text-sm text-ink-muted">
                  The firm names nothing under {one.name}. Add what this client holds.
                </li>
              )}
            </ul>

            {/* A class is not typed in: it is what the lines inside it come to. Set out under them, in
                the column they were typed in, so it reads as the sum rather than a figure of its own. */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 border-t-2 border-ink/15 px-4 py-1.5">
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                  {one.name}, added up
                </span>
                <span className="w-32 shrink-0 pr-3 text-right text-sm font-bold tabular-nums text-ink">
                  {inClass > 0 ? inClass.toLocaleString() : "—"}
                </span>
                <span className="w-9 shrink-0" />
              </div>
            )}

            {/* Writing a line the firm has not named is off for now. A client who already has one keeps
                it, with its name to reword and its bin, because it is already part of what they hold —
                there is just no way to write another. Putting this back is putting the button back. */}
          </section>
        );
      })}

      {/* What the six classes come to, said once and at the end — after the last of them has been
          written down, not following the page down beside the buttons. This is the figure every
          percentage the portfolio is read against is a share of. */}
      <section className="rounded-2xl border border-line bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-semibold text-ink">Total</h2>
            <p className="mt-0.5 max-w-prose text-xs text-ink-muted">
              What all six classes come to. A house, a painting or a stake in their own company is not one
              of them, and is asked for next.
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
        <Button variant="secondary" type="button" onClick={onDone}>
          Skip
        </Button>
        <Button
          type="button"
          disabled={busy || !readable || !anything}
          onClick={() => void save()}
        >
          {busy ? "Writing it down…" : "Next"}
        </Button>
      </div>
    </div>
  );
}
