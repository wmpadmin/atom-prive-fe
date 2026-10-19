import { ApiError } from "@atomprive/api-client";
import {
  useListClientHoldings,
  useListCurrencies,
  type ClientHoldings,
  type Currency,
  useListClientLoans,
  type ClientLoans,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, SelectInput, TextInput, cn } from "@atomprive/ui";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { barFor, useAssetClasses } from "./asset-classes";
import { BOX, type StepProps } from "./portfolio-setup-dialog";
import { useSubAssetClasses } from "./sub-asset-classes";
import { anythingOnFile, loanOnFile, toThePenny } from "./the-calculator";

/** One line somebody is writing down: where it sits, what it is called, and what it is worth. */
type Line = {
  /** What this line is already written down as, where it is. Null for one nobody has written yet. */
  id: string | null;
  /**
   * The sub-asset this line sits inside, or empty where it is one itself.
   *
   * <p>The plan may break a sub-asset into lines of its own, and then it is those that are held rather
   * than the sub-asset: a plan asking for 60% of Indian equities in large cap has an opinion about large
   * cap and none about an unsplit lump called Indian equities. Where it sits is part of what a line is —
   * "Large cap" under Indian equities and "Large cap" under US equities are two different holdings.
   */
  under: string;
  /** The name as it will be stored. The firm's lines keep theirs; a line of this client's own is theirs to reword. */
  name: string;
  /** What is in it, as typed. Kept as a string so a half-typed figure is not rounded away under the cursor. */
  amount: string;
  /** Whether the firm named this line, and so whether it may be reworded or taken off here. */
  theFirms: boolean;
};

/** Where a line sits, which with its name is what identifies it. */
function whereItSits(subClass: string, subSubClass: string) {
  return `${subClass}\t${subSubClass}`;
}

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
 * Every place inside a class that names the same thing twice, named so the form can say which.
 *
 * <p>A name only has to be unique among its own siblings, which is the only set it is ever read against:
 * "Large cap" may sit under Indian equities and under US equities at once, and those are two different
 * holdings with two different targets. Checked across a whole class, a client whose plan names large cap
 * under two of its sub-assets could not write their holdings down at all, held up by a duplicate that
 * was not one.
 */
function placesNamingTwice(rows: Line[], inClass: string): string[] {
  // Keyed by where a line sits rather than by what that place is called. Keyed by the name, a sub-asset
  // called the same thing as its class — "Forex" inside Forex, which the firm's own list has — shared a
  // bucket with the class itself, and a client holding one line in each was told they had named it twice
  // and could not write their figures down at all.
  const byPlace = new Map<string, { where: string; said: string[] }>();
  for (const one of rows) {
    const name = one.name.trim().toLowerCase();
    if (name === "") continue;
    const under = one.under.trim();
    const key = (under === "") ? "" : `inside\u0000${under}`;
    const place = byPlace.get(key) ?? { where: (under === "") ? inClass : under, said: [] };
    place.said.push(name);
    byPlace.set(key, place);
  }
  return [...byPlace.values()]
    .filter((place) => new Set(place.said).size !== place.said.length)
    .map((place) => place.where);
}

/**
 * What a client's money is actually spread across, written down class by class and line by line.
 *
 * <p>Asked for when a client is first put on a model, because a model says what a portfolio should be and
 * can say nothing at all until somebody has written down what it is. The firm's own sub-assets are set out
 * ready to be filled in; a portfolio holds what it holds, though, so anything the firm has not named can be
 * added here and belongs to this client.
 */
/** The class the firm keeps cash under, and so the one a loan is asked for beside. */
const CASH = "CASH";

export function AllocationStep({ customerId, onDone, draft, onDraft }: StepProps) {
  const assetClasses = useAssetClasses();
  const subAssets = useSubAssetClasses();
  // What the client owes, which is asked for here beside the cash it offsets rather than a step later.
  // It is not a holding: a holding is money the client has, cannot be negative, and has to add up to the
  // class total the API is told. A loan is the opposite of all three, so it is kept where it has always
  // been kept and only asked for here.
  const owed = useListClientLoans<ClientLoans, ApiError>(customerId);
  const [typedLoan, setLoan] = useState<string | null>(null);
  // Held as a negative and typed as a plain figure: nobody writes a minus sign in front of what they owe.
  const onFile = owed.data?.loans ?? [];
  const alreadyTyped = draft?.held?.loanAmount;
  const loan = typedLoan
    ?? ((alreadyTyped != null) ? (alreadyTyped === 0 ? "" : String(Math.abs(alreadyTyped)))
      : (onFile.length === 0 ? "" : String(Math.abs(loanOnFile(owed.data) ?? 0))));
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);

  // Seeded once from the firm's list, which may not have arrived on the first render — so it is rebuilt
  // when it does, and anything typed by then is kept over the top of it.
  const [typed, setTyped] = useState<Record<string, Line[]>>({});
  const blank = useMemo(() => {
    const made: Record<string, Line[]> = {};
    for (const one of assetClasses.inUse) {
      // What this client already has written down under this class, by the name it was written under —
      // or what was typed here earlier in this walk, where somebody has been and walked on. Nothing is
      // sent until the next step now, so coming back has to find what was left rather than the figures
      // on file, which are the ones being changed.
      const written = draft?.held
        ? (draft.held.classes.find((each) => each.assetClass === one.code)?.lines ?? [])
          .map((line) => ({
            id: line.id,
            subClass: (line.under ?? "") === "" ? line.name : line.under,
            subSubClass: (line.under ?? "") === "" ? null : line.name,
            name: line.name,
            valueAmount: line.valueAmount,
          }))
        : (holdings.data?.classes ?? [])
          .find((each) => each.assetClass === one.code)?.subClasses
          // Everything inside the class, however deep: what sits in a sub-asset and what sits in a line
          // of one. Reading only the first of those left the deeper figures out of the boxes on this
          // screen — and what this screen stops naming is what the client stops holding, so a line the
          // boxes never showed would have been taken off them by saving a screen nobody meant to change.
          .flatMap((group) => [...group.positions, ...group.inside.flatMap((deeper) => deeper.positions)])
        ?? [];
      const byName = new Map(written.map((each) =>
        [whereItSits((each.subClass ?? each.name).trim(), each.subSubClass ?? ""), each]));
      // What this client's own plan breaks each sub-asset into, read off the figures already in hand.
      // The platform lists a line the plan names even where nobody holds any of it, so this is the plan's
      // own breakdown rather than a reading of what happens to have money in it.
      const planned = new Map((holdings.data?.classes ?? [])
        .find((each) => each.assetClass === one.code)?.subClasses
        .map((group) => [group.subClass ?? "", group.inside.map((deeper) => deeper.subSubClass ?? "")]) ?? []);
      const rows: Line[] = (subAssets.byClass[one.code] ?? []).flatMap((name) => {
        const inside = (planned.get(name) ?? []).filter((deeper) => deeper !== "");
        // A sub-asset the plan has broken down is not typed into itself: what is held are its parts, and
        // a box for the parent beside boxes for its parts would count the same money twice.
        const named = (inside.length > 0) ? inside.map((deeper) => ({ under: name, name: deeper }))
          : [{ under: "", name }];
        return named.map((where) => {
          const key = whereItSits(where.under === "" ? where.name : where.under,
            where.under === "" ? "" : where.name);
          const already = byName.get(key);
          byName.delete(key);
          return {
            id: already?.id ?? null,
            under: where.under,
            name: where.name,
            amount: (already == null) ? "" : String(already.valueAmount),
            theFirms: true,
          };
        });
      });
      // Written down somewhere the firm's list and this client's plan do not name: their own, and theirs
      // to reword. A line inside a sub-asset keeps where it sits — reworded into a bare name it would
      // land somewhere else, which is money moving because somebody edited a label.
      for (const each of byName.values()) {
        const deeper = (each.subSubClass ?? "").trim();
        rows.push({
          id: each.id,
          under: (deeper === "") ? "" : (each.subClass ?? "").trim(),
          name: (deeper === "") ? (each.subClass ?? each.name).trim() : deeper,
          amount: String(each.valueAmount),
          theFirms: false,
        });
      }
      made[one.code] = rows;
    }
    return made;
  }, [assetClasses.inUse, subAssets.byClass, holdings.data, draft]);
  const lines: Record<string, Line[]> = { ...blank, ...typed };
  const codes = assetClasses.inUse.map((one) => one.code);

  function put(assetClass: string, rows: Line[]) {
    setTyped({ ...lines, [assetClass]: rows });
  }

  const currencies = useListCurrencies<Currency[], ApiError>();
  const [chosenCurrency, setCurrency] = useState<string | null>(null);
  const currency = chosenCurrency ?? draft?.held?.currency ?? holdings.data?.currency ?? "";
  // Restating a portfolio and retyping its figures cannot be asked for in one go: the typed figures
  // would be in the currency being left behind, and nothing could say which of the two was meant.
  const figuresTyped = Object.keys(typed).length > 0;
  const whole = codes.reduce((total, code) => total + adds(lines[code] ?? []), 0);
  // Nothing is written down until every figure is a figure, and a line nobody has named cannot be stored.
  const unreadable = codes.flatMap((code) =>
    (lines[code] ?? []).filter((one) => one.amount.trim() !== "" && !isNumber(one.amount)));
  const unnamed = codes.flatMap((code) =>
    (lines[code] ?? []).filter((one) => one.amount.trim() !== "" && one.name.trim() === ""));
  // The same line twice in one place is two rows the platform cannot tell apart afterwards. A place at a
  // time rather than the class at once, which is how the model asks the same question of itself.
  const twiceNamed = codes.flatMap((code) =>
    placesNamingTwice(lines[code] ?? [], assetClasses.names[code] ?? code));
  const readable = unreadable.length === 0 && unnamed.length === 0 && twiceNamed.length === 0;
  // Whether this client has figures already, which is what decides written outright against asked for.
  // Read here only to say so; the deciding and the sending are the next step's.
  const alreadyWritten = anythingOnFile(holdings.data);
  const anything = whole > 0;

  /**
   * Written one line at a time, because that is what the API takes.
   *
   * <p>A line already written down is changed where it has a figure and taken off where it no longer has
   * one — emptying a box is how somebody says the client holds none of it, and leaving the line standing
   * at its old figure would be ignoring them. A line nobody has written yet is only written where it has
   * a figure, so a class left untouched writes nothing at all.
   */
  /**
   * What the client owes, as one figure, kept negative.
   *
   * <p>Negative because every line that allows for a loan adds it rather than subtracting — there is no
   * subtraction anywhere in the Net AUM, which is what keeps a loan from being taken off twice.
   *
   * <p>One loan, not a list. It is asked for in one box, so a client who already has several would have
   * that box edit something it does not name; null leaves those exactly as they are, and the box is read
   * off their total, which is what the figure means either way.
   */
  const owing = (onFile.length > 1) ? null
    : (isNumber(loan) && Number(loan) > 0) ? -Math.abs(toThePenny(Number(loan))) : 0;

  /**
   * Handed on rather than sent.
   *
   * <p>This screen used to write: the lines in one call and the loan beside them in another, which on a
   * client with figures meant the lines waited on whoever looks after them while the loan landed at once.
   * Half an act landing is the thing being fixed, so the whole calculator is sent once — by the step that
   * finishes it, which is the next one.
   *
   * <p>Every line goes, not only the ones that moved: a line this screen no longer names is one the
   * client no longer holds, and that is how it comes off. The API leaves alone any line whose name and
   * figure have not moved, so what is not on this screen — a line's own tolerance above all — survives a
   * save that was not about it.
   */
  function next() {
    onDraft?.({
      ...draft,
      held: {
        classes: codes.map((assetClass) => ({
          assetClass,
          lines: (lines[assetClass] ?? [])
            .filter((line) => isNumber(line.amount) && Number(line.amount) > 0)
            .map((line) => ({
              id: line.id,
              under: line.under,
              name: line.name.trim(),
              valueAmount: toThePenny(Number(line.amount)),
            })),
        })),
        currency: currency || null,
        netAum: whole,
        loanAmount: owing,
      },
    });
    onDone();
  }

  if (assetClasses.isError) {
    return <Alert tone="danger">{assetClasses.error?.message}</Alert>;
  }

  return (
    // A class and its total are one block to read; the next class is another. Room between them so the
    // eye stops at the end of one rather than running into the heading of the next.
    <div className="flex flex-1 flex-col space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor="holdings-currency" className="text-xs font-semibold text-ink-soft">
          Currency
        </label>
        <SelectInput
          id="holdings-currency"
          className={cn(BOX, "w-auto")}
          value={currency}
          disabled={figuresTyped}
          onChange={(event) => setCurrency(event.target.value)}
        >
          {/* Whatever the portfolio is already written in stays offered, even if the firm has since
              stopped dealing in it. */}
          {currency !== "" && !(currencies.data ?? []).some((one) => one.code === currency) && (
            <option value={currency}>{currency}</option>
          )}
          {(currencies.data ?? []).map((one) => (
            <option key={one.code} value={one.code}>
              {one.code} — {one.name}
            </option>
          ))}
        </SelectInput>
        {figuresTyped && (
          <p className="w-full text-right text-xs text-ink-muted">
            Write the figures down first. Restating them in another currency is a separate thing to ask for.
          </p>
        )}
      </div>

      {assetClasses.inUse.map((one) => {
        const rows = lines[one.code] ?? [];
        const inClass = adds(rows);
        return (
          <section key={one.code} className="rounded-2xl border border-line bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-4 py-2">
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

            {/* Two to a row. A class of nine lines ran the height of the dialog on its own, so half of
                it was read by scrolling past the half above. */}
            <ul className="grid grid-cols-1 gap-x-6 px-4 sm:grid-cols-2">
              {/* Over each column, because the two halves of a class read as two lists side by side and
                  one heading over the left of them would be a heading over half the boxes. */}
              {[0, 1].map((half) => (
                <li
                  key={`head-${half}`}
                  className={cn(
                    "flex items-center gap-3 border-b border-ink/15 py-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase",
                    half === 1 && "hidden sm:flex",
                  )}
                >
                  <span className="min-w-0 flex-1">Sub-asset</span>
                  <span className="w-40 shrink-0 text-right">Current allocation</span>
                  <span className="w-9 shrink-0" />
                </li>
              ))}
              {rows.map((line, at) => (
                <li key={at} className="flex items-center gap-3 border-b border-ink/15 py-1">
                  {line.theFirms ? (
                    // Named with where it sits where that is not the class itself. These sit in one list
                    // beside the sub-assets that were not broken down, and "Large cap" on its own says
                    // nothing about which sub-asset's large cap it is.
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {line.under === "" ? line.name : (
                        <>
                          <span className="text-ink-muted">{line.under} · </span>
                          {line.name}
                        </>
                      )}
                    </span>
                  ) : (
                    <TextInput
                      aria-label={`Name of the line added under ${one.name}`}
                      placeholder="What this client holds it in"
                      className={cn(BOX, "min-w-0 flex-1")}
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
                      className={cn(BOX, "text-right tabular-nums", currency && "pr-11")}
                      value={line.amount}
                      onChange={(event) =>
                        put(one.code, rows.map((was, which) =>
                          which === at ? { ...was, amount: asFigure(event.target.value, was.amount) } : was))
                      }
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
              {/* What the client owes, read as one more line under the cash it offsets, because that is
                  where somebody has the bank statement open and cash and borrowing sit on the same page
                  of it.

                  Out of the class's total all the same, which is why it is last. A class total has to
                  equal the lines written under it — the API refuses any other figure — and a loan cannot
                  be one of them: a holding is money the client has and may not be negative. It is counted
                  where everything else allows for it, which is the Net AUM. */}
              {one.code === CASH && (
                <li className="flex items-center gap-3 border-b border-ink/15 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">Loan</span>
                  <div className="relative w-40 shrink-0">
                    <TextInput
                      aria-label="What the client owes"
                      inputMode="decimal"
                      disabled={onFile.length > 1}
                      className={cn(BOX, "text-right tabular-nums", currency && "pr-11")}
                      value={loan}
                      onChange={(event) => setLoan(asFigure(event.target.value, loan))}
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
                  <span className="w-9 shrink-0" />
                </li>
              )}
              {rows.length === 0 && (
                <li className="py-2 text-sm text-ink-muted sm:col-span-2">
                  The firm names nothing under {one.name}. Add what this client holds.
                </li>
              )}
            </ul>

            {/* A portfolio holds what it holds. The firm's own lines are what it names, not the whole of
                what exists, and a client with money in something nobody has written down has to be able
                to say so rather than have it rounded into a line that is not it.
                
                What goes in here is this client's, named and taken off on this screen. The plan says
                nothing about it, which is read as the plan asking for none of it — so money sitting in
                one is a breach, said plainly, rather than a line with no answer beside it. */}
            <div className="border-t border-ink/15 px-4 py-1.5">
              <button
                type="button"
                onClick={() => put(one.code, [...rows,
                  { id: null, under: "", name: "", amount: "", theFirms: false }])}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Add a sub-asset to {one.name}
              </button>
            </div>

            {/* A class is not typed in: it is what the lines inside it come to. Set out under them, in
                the column they were typed in, so it reads as the sum rather than a figure of its own. */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 border-t-2 border-ink/30 px-4 py-1.5">
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
        {/* Said here rather than discovered. This screen writes down what a client holds and asks nobody;
            deciding to put money somewhere else is a different act with a different door, and the two are
            easy to mistake for each other because typing two figures here has the same effect as moving
            money between them. */}
        <p className="mt-3 max-w-prose border-t border-line pt-3 text-xs text-ink-muted">
          This writes down what the client holds, as their statement has it, and asks nobody. Deciding to
          move money from one thing into another is asked for on their portfolio and answered by whoever
          looks after them — and while something is waiting on that answer, nothing here can be saved.
        </p>
      </section>

      {/* One for each place, naming it. A client who holds large cap under two sub-assets has to be told
          which of the two it is in, not handed the class and left to read every line under it. */}
      {twiceNamed.map((where) => (
        <Alert key={where} tone="danger">
          {where} names a line twice. Two rows with one name cannot be told apart afterwards.
        </Alert>
      ))}
      {unnamed.length > 0 && (
        <Alert tone="danger">A line with money in it has to be named before it can be written down.</Alert>
      )}
      {unreadable.length > 0 && (
        <Alert tone="danger">A figure box has something in it that is not a figure.</Alert>
      )}

      {/* Said here, where somebody is typing the figures, rather than sprung on them a step later. The
          reason and the sending both belong to the step that finishes the calculator, because the two
          screens are one act — so this one says where it is going and the next one asks why. */}
      {alreadyWritten && (
        <Alert tone="info">
          These figures are already written down, so changing them is answered by whoever looks after
          this client. Nothing is sent until the next step, and nothing moves until they agree.
        </Alert>
      )}

      {/* In the page rather than lying over it: the figure that had to be kept in sight is said at the
          end now, so the buttons can line up with the cards above them like every other screen's do. */}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" size="lg" type="button" onClick={onDone}>
          Skip
        </Button>
        <Button type="button" size="lg" disabled={!readable || !anything} onClick={next}>
          Next
        </Button>
      </div>
    </div>
  );
}
