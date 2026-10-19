import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getGetClientValuationsQueryKey,
  getListClientHoldingsQueryKey,
  getListClientLoansQueryKey,
  getListNonFinancialAssetsQueryKey,
  useAskToRewriteAllocation,
  useListClientAllocationChanges,
  useListClientHoldings,
  useListClientLoans,
  useListClientMovePlans,
  useListClientRestores,
  useListNonFinancialAssets,
  useWriteClientAllocation,
  type AllocationChangeRow,
  type ClientHoldings,
  type MovePlanRow,
  type RestoreRow,
  type ClientLoans,
  type LoanRequestSecuredOn,
  type ClientNonFinancialAssets,
  type NonFinancialAssetRequest,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, IconButton, SelectInput, TextArea, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { BOX, type StepProps } from "./portfolio-setup-dialog";
import {
  anythingOnFile, linesOnFile, loanOnFile, ownedOnFile, saysSomethingNew, toThePenny, type Calculator,
} from "./the-calculator";

/**
 * One line of either list: what it is, whatever else has to be said about it, and a figure.
 *
 * <p>The two lists are the same shape because the two questions are: something with a name and a value,
 * as many as there are. What differs is what the name is called and which way the figure is kept.
 */
type Line = {
  /** What it is already written down as, where it is. Null for one nobody has written yet. */
  id: string | null;
  /** Whether somebody chose to write a kind of their own rather than pick one off the firm's list. */
  written?: boolean;
  /** The short name. Empty on a loan, which says what it is in one line and has no second box. */
  item: string;
  /**
   * What a loan is secured on. Not asked for yet — nobody has been told to sort their loans into the two
   * — so every one is written down as against the portfolio and every one comes off the Net AUM, which
   * is what was happening before the question existed. The field and the split behind it stay.
   */
  securedOn: LoanRequestSecuredOn;
  description: string;
  /** Kept as a string so a half-typed figure is not rounded away under the cursor. */
  amount: string;
};

const NOTHING_YET: Line = { id: null, item: "", description: "", amount: "", securedOn: "PORTFOLIO" };

/**
 * The kinds of thing the firm sees often enough to name.
 *
 * <p>Not a closed list. What somebody owns that nobody manages is whatever they own — a vineyard, a
 * stake in a cousin's business, a racehorse — so the list is the common answers and anything else is
 * still typed, rather than an argument with the box.
 */
const KINDS = [
  "Real Estate",
  "Infrastructure",
  "Commodities",
  "Precious Metals",
  "Collectibles & Art",
];

/** The value the list carries for writing a kind nobody has used before. Never a kind itself. */
const WRITE_ONE = "\u0000write";

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
/** "a money move", "a money move and a restore" — a list as a sentence says it. */
function andList(words: string[]) {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

export function WorthStep({ customerId, onDone, onBack, draft, onDraft }: StepProps) {
  const queryClient = useQueryClient();
  const owned = useListNonFinancialAssets<ClientNonFinancialAssets, ApiError>(customerId);
  const owed = useListClientLoans<ClientLoans, ApiError>(customerId);
  // What the client holds, which this step does not change and does have to send: the calculator goes
  // as one value, so the step that finishes it carries the lines whether or not anybody typed them.
  const holdings = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  /** Why the figures should change, which only an ask needs and only an ask shows a box for. */
  const [why, setWhy] = useState("");

  const writeAllocation = useWriteClientAllocation<ApiError>();
  const askToRewrite = useAskToRewriteAllocation<ApiError>();
  // One flag for the whole save, not the six mutations' own. They run one after another, so between
  // any two of them every one of them is idle for a tick, and the button flicked back and in again on
  // each one.
  const [busy, setBusy] = useState(false);

  // Seeded from what is already written down, with one blank line at the end of each so the next thing
  // can be written without reaching for a button first.
  const [typedOwned, setOwned] = useState<Line[] | null>(null);
  const [typedOwed, setOwed] = useState<Line[] | null>(null);

  const ownedAsRead = useMemo<Line[]>(() => {
    // What was typed here earlier in this walk, where somebody has been and gone back. Nothing is sent
    // until this step's own button now, so coming back has to find what was left rather than the list on
    // file, which is the one being changed.
    const already: Line[] = draft?.owned
      ? draft.owned.map((one) => ({
        id: null,
        item: one.item,
        description: one.description ?? "",
        amount: String(one.valueAmount),
        securedOn: "PORTFOLIO" as const,
      }))
      : (owned.data?.items ?? []).map((one) => ({
        id: one.id,
        item: one.item,
        description: one.description ?? "",
        amount: String(one.valueAmount),
        securedOn: "PORTFOLIO" as const,
      }));
    return [...already, NOTHING_YET];
  }, [owned.data, draft]);

  const owedAsRead = useMemo<Line[]>(() => {
    // What the step before typed, where somebody has been there, rather than what is on file. This
    // reads the loan back and says to go back and change it, so it has to show the figure that would
    // go — otherwise it tells somebody who just typed 7,000 that they owe 2,000.
    const typedBefore = draft?.held?.loanAmount;
    const loans = (typedBefore != null)
      ? (typedBefore === 0 ? [] : [{
        id: null, description: "Loan", securedOn: "PORTFOLIO" as const, valueAmount: typedBefore,
      }])
      : (owed.data?.loans ?? []);
    return [
      ...loans.map((one) => ({
        id: one.id,
        item: "",
        description: one.description,
        securedOn: one.securedOn,
        // Shown as a plain figure, because nobody writes a minus sign to say what they owe. It is kept
        // negative, so what comes back is turned round to be read.
        amount: String(Math.abs(one.valueAmount)),
      })),
      NOTHING_YET,
    ];
  }, [owed.data, draft]);

  const ownedRows = typedOwned ?? ownedAsRead;
  const owedRows = typedOwed ?? owedAsRead;
  // Whether this client has figures already, which is what decides written outright against asked for.
  const alreadyWritten = anythingOnFile(holdings.data);

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

  /** What this step says the client owns outright, in the shape the calculator sends. */
  const sending: NonFinancialAssetRequest[] = ownedRows.filter((one) => named(one, true)).map((one) => ({
    item: one.item.trim(),
    description: one.description.trim() || null,
    valueAmount: isNumber(one.amount) ? toThePenny(Number(one.amount)) : 0,
  }));

  /** What is on file right now, read as one calculator, so what is being sent can be set beside it. */
  const onFile: Calculator = {
    classes: linesOnFile(holdings.data),
    currency: holdings.data?.currency ?? null,
    netAum: holdings.data?.underManagement ?? null,
    loanAmount: loanOnFile(owed.data),
    ownedOutright: ownedOnFile(owned.data),
  };

  /**
   * The whole calculator: the lines and the loan the first step typed, or the ones on file where nobody
   * went there, and the list typed here. One value, sent once, by the step that finishes it.
   */
  const held = draft?.held;
  const whole: Calculator = {
    classes: held?.classes ?? onFile.classes,
    currency: held?.currency ?? onFile.currency,
    netAum: held?.netAum ?? onFile.netAum,
    loanAmount: (held === undefined) ? onFile.loanAmount : held.loanAmount,
    ownedOutright: sending,
  };

  /**
   * Whether this walk through the calculator says anything the client's figures do not already say.
   *
   * <p>Nothing is asked for where nothing changed, and the screen says so rather than making somebody
   * find out by pressing: no reason is asked for, and the button is the plain one that walks on. Somebody
   * who opened the calculator to read it, or cleared a box and typed the same figure back into it, has
   * changed nothing and owes nobody an answer — and a request raised for that would put a real decision
   * in front of whoever looks after the client with nothing in it to decide.
   */
  const changing = !holdings.isPending && !owned.isPending && !owed.isPending
    && saysSomethingNew(whole, onFile);
  const asking = changing && alreadyWritten;
  /*
   * What is already waiting on this client, which the server refuses to let anything be raised over.
   * Each of the three asks is weighed against the figures as they stand and applied as though it were
   * the only one, so a second raised over a first asks for money out of a line that may no longer hold it.
   *
   * Read here, where the walk can be stopped before it starts. The refusal came from the server at the
   * last press, so somebody typed four steps and a reason to be told at the end that none of it could be
   * asked for — and the figures they had typed went with the dialog.
   */
  const moves = useListClientMovePlans<MovePlanRow[], ApiError>(customerId);
  const restoring = useListClientRestores<RestoreRow[], ApiError>(customerId);
  const rewriting = useListClientAllocationChanges<AllocationChangeRow[], ApiError>(customerId);
  const already = [
    (moves.data ?? []).find((one) => one.status === "PENDING" || one.status === "RETURNED")
      && "a money move",
    (restoring.data ?? []).find((one) => one.status === "PENDING") && "an ask to put the figures back",
    (rewriting.data ?? []).find((one) => one.status === "PENDING") && "an ask to rewrite these figures",
  ].filter((one): one is string => typeof one === "string");

  async function save() {
    if (!changing) {
      onDraft?.({});
      onDone();
      return;
    }
    setErrors(noErrors);
    setBusy(true);
    try {
      // Written outright the first time and asked for every time after. The first has nothing to
      // overrule: no figures an advisor could be protecting, no drift to change, no day to re-close.
      if (asking) {
        await askToRewrite.mutateAsync({ customerId, data: { allocation: whole, why: why.trim() } });
      }
      else {
        await writeAllocation.mutateAsync({ customerId, data: whole });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListNonFinancialAssetsQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getListClientLoansQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) }),
        queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) }),
        // The day's history too. Every change writes its own version, so the act somebody has just taken
        // is one the tracker is meant to show — and without this it would not until something unrelated
        // happened to refetch.
        queryClient.invalidateQueries({ queryKey: getGetClientValuationsQueryKey(customerId) }),
      ]);
      setOwned(null);
      setOwed(null);
      onDraft?.({});
      onDone();
    }
    catch (caught) {
      setErrors(toFormErrors(caught as ApiError));
    }
    finally {
      setBusy(false);
    }
  }

  /** Back with what was typed here kept, the same way the first step's figures are kept coming forward. */
  function back() {
    onDraft?.({ ...draft, owned: sending });
    onBack?.();
  }

  if (owned.isError || owed.isError || holdings.isError) {
    return <Alert tone="danger">{(owned.error ?? owed.error ?? holdings.error)?.message}</Alert>;
  }

  const money = (figure: number, brackets: boolean) =>
    (figure > 0 ? (brackets ? `(${figure.toLocaleString()})` : figure.toLocaleString()) : "—");

  return (
    <div className="flex flex-1 flex-col space-y-4">
      {/* Said before anything is typed rather than after it is all typed. The server refuses to raise a
          second ask over a first, and it refused at the last press — so a reader filled four steps and a
          reason, was told none of it could be asked for, and lost the figures with the dialog. */}
      {already.length > 0 && (
        <Alert tone="warning">
          <p className="font-semibold">
            {already.length === 1
              ? `There is already ${already[0]} waiting on this client.`
              : `There are already ${andList(already)} waiting on this client.`}
          </p>
          <p className="mt-1 text-sm">
            Nothing more can be asked for until that is answered or taken back. Each ask is weighed
            against the figures as they stand and applied as though it were the only one, so a second
            raised over the first would ask for money out of a line that may no longer hold it.
          </p>
        </Alert>
      )}
      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      {/* What they own. Three boxes, because a flat and a painting need different things said about them. */}
      <section className="rounded-2xl border border-line bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Non Financial Asset</h2>
          {/* Said, because an empty row with a "Pick what it is…" in it reads as a question that has to
              be answered. Plenty of clients own nothing outside the portfolio, and the row is left
              exactly as it is for them. */}
          <p className="text-xs font-normal text-ink-muted">
            A house, a painting, a stake in their own company. Leave it empty where there is none.
          </p>
          <p className="text-sm font-bold tabular-nums text-ink">
            {ownedTotal > 0 ? `${money(ownedTotal, false)} ${currency}` : "—"}
          </p>
        </header>
        <div className="grid grid-cols-[1fr_1.5fr_9rem_2.25rem] items-center gap-3 px-4 pt-2.5 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          <span>Item</span>
          <span>Description</span>
          <span className="text-right">Value</span>
          <span className="sr-only">Take it off</span>
        </div>
        <ul className="divide-y divide-ink/15">
          {ownedRows.map((one, at) => (
            <li
              key={one.id ?? `new-${at}`}
              className="grid grid-cols-[1fr_1.5fr_9rem_2.25rem] items-start gap-3 px-4 py-1.5"
            >
              {/* One control, whatever is in it. The list carries the firm's own kinds, plus whatever
                  this line is already written down as where that is not one of them — a client's
                  vineyard stays a vineyard, and reading them back is not the moment to quietly reword
                  it. Other opens a box under the list rather than replacing it, so a row somebody is
                  typing into still looks like the row above it. */}
              <span className="flex min-w-0 flex-col gap-1.5">
                <SelectInput
                  aria-label={`What the client owns, line ${at + 1}`}
                  className={BOX}
                  value={one.written ? WRITE_ONE : one.item}
                  onChange={(event) =>
                    putOwned(at, event.target.value === WRITE_ONE
                      ? { item: "", written: true }
                      : { item: event.target.value, written: false })
                  }
                >
                  <option value="">Pick what it is…</option>
                  {(one.item !== "" && !one.written && !KINDS.includes(one.item)
                    ? [one.item, ...KINDS] : KINDS).map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                  <option value={WRITE_ONE}>Other…</option>
                </SelectInput>
                {one.written && (
                  <TextInput
                    aria-label={`What the client owns, line ${at + 1}, written out`}
                    placeholder="A vineyard, a racehorse"
                    className={BOX}
                    value={one.item}
                    onChange={(event) => putOwned(at, { item: event.target.value })}
                  />
                )}
              </span>
              <TextArea
                aria-label={`About ${one.item || `line ${at + 1}`}`}
                placeholder="Whatever else has to be said about it"
                rows={1}
                className={BOX}
                value={one.description}
                onChange={(event) => putOwned(at, { description: event.target.value })}
              />
              <div className="relative">
                <TextInput
                  aria-label={`What ${one.item || `line ${at + 1}`} is worth`}
                  inputMode="decimal"
                  className={cn(BOX, "text-right tabular-nums", currency && "pr-10")}
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

        <div className="border-t border-ink/15 px-4 py-1.5">
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

      {/* Loans, read and not written. What the client owes is asked for a step earlier now, beside the
          cash it offsets, because that is where somebody has their bank statement open. Asked for in
          both places it would be two boxes holding one figure, and whichever was saved last would win
          — so this one reads.

          Still shown, because this is the step that says what the client is worth beside what they owe,
          and a page about their worth that left out the borrowing would be answering half the question. */}
      <section className="rounded-2xl border border-line bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 px-4 py-2">
          <h2 className="font-semibold text-ink">Loan</h2>
          <p className={cn("text-sm font-bold tabular-nums", owedTotal > 0 ? "text-red-700" : "text-ink")}>
            {owedTotal > 0 ? `${money(owedTotal, true)} ${currency}` : "—"}
          </p>
        </header>
        <p className="px-4 pt-2 text-xs text-ink-muted">
          Written in the step before, under Cash &amp; cash equivalents. Go back to change it.
        </p>
        {owedRows.filter((one) => one.amount.trim() !== "").length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-muted">Nothing owed.</p>
        ) : (
          <ul className="divide-y divide-ink/15">
            {owedRows.filter((one) => one.amount.trim() !== "").map((one, at) => (
              <li
                key={one.id ?? `owed-${at}`}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {one.description.trim() === "" ? "Loan" : one.description}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {money(Number(one.amount), true)} {currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unnamed.length > 0 && (
        <Alert tone="danger">Something with a figure on it has to say what it is.</Alert>
      )}
      {unreadable.length > 0 && (
        <Alert tone="danger">A figure box has something in it that is not a figure.</Alert>
      )}

      {/* Asked for, where there is something to overrule. The reason is what whoever answers is really
          being asked about: a page of figures with no sentence beside it asks somebody to agree to
          arithmetic. Here rather than a step back, because this is the step that sends. */}
      {/* Marked while it is empty, not merely starred. This box appears because something on one of the
          steps was changed — on either of them: what the walk holds is the lines from the first step and
          the list from this one, weighed together against what is on file. It is the one thing holding
          the only button on the step, and a reader who could not see that went hunting through the step
          for a box they had failed to fill. */}
      {asking && (
        <div className={cn("mt-6 rounded-xl border px-4 py-3",
          why.trim() === "" ? "border-red-600 bg-red-50/40" : "border-line bg-slate-50/60")}>
          <label htmlFor="why-it-changed"
            className="block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Why it should change <span aria-hidden="true" className="text-red-700">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <TextInput
            id="why-it-changed"
            aria-invalid={why.trim() === "" || undefined}
            className={cn("mt-1.5", why.trim() === "" && "border-red-600 ring-1 ring-red-600")}
            value={why}
            placeholder="The custodian statement came in at a different figure."
            onChange={(event) => setWhy(event.target.value)}
          />
          {why.trim() === "" && (
            <p className="mt-1.5 text-xs font-medium text-red-700">
              A figure has changed, so this is needed before it can be asked for.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            This client's figures are already written down, so the whole calculator — what they hold, what
            they owe and what they own outright — is answered by whoever looks after them. Nothing changes
            until they agree, and nothing is asked for if nothing changed.
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line pt-4">
        <Button variant="secondary" size="lg" type="button" onClick={back}>
          Back
        </Button>
        {/* What is holding the button, beside the button. Disabled with nothing to say, it sent its
            reader hunting through the step for a box they had failed to fill — and the likeliest guess,
            the empty row at the top asking what the client owns outright, is the one thing on this step
            that may be left alone. */}
        {!busy && (!readable || already.length > 0 || (asking && why.trim() === "")) && (
          <p className="mr-auto text-xs text-red-700">
            {already.length > 0
              ? "Nothing can be asked for while something is waiting on this client."
              : !readable
                ? "Put right what is marked above first."
                : "Say why it should change. Whoever answers is being asked about the reason."}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={busy || !readable || already.length > 0 || (asking && why.trim() === "")}
          onClick={() => void save()}
        >
          {busy
            ? (asking ? "Asking…" : "Writing it down…")
            : asking ? "Ask for this change" : "Next"}
        </Button>
      </div>
    </div>
  );
}
