import type { DocumentBlock, DocumentCell, DocumentGap } from "@atomprive/api-client/backoffice";
import { DateInput, cn } from "@atomprive/ui";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SignatureMark } from "../../components/signature-mark";
import { namesAPart } from "./document-parts";
import { madeSignature } from "./made-signature";

interface Filling {
  details: Record<string, string>;
  /** On a form Operations complete, what to call when they write in one of its blanks. */
  onFill?: (key: string, value: string) => void;
  /** The boxes that have been ticked, and how to tick one; instead of clears the others in its group. */
  ticked: Record<string, boolean>;
  onTick?: (key: string, ticked: boolean, insteadOf?: string[]) => void;
  /** What the paper itself has in each gap: the firm's own name, or the blank it leaves for a detail. */
  printed: Record<string, string>;
  /** Gaps that read as part of the sentence rather than as something filled in: the firm's own name and details,
   * which the wording repeats in nearly every clause. */
  quiet: Set<string>;
  /** How many rows a table that is a list to write on is showing, and how to ask it for more or fewer. */
  listRows?: Record<string, number>;
  onListRows?: (table: string, rows: number) => void;
  /** Set where this person may sign: the place on the paper, and whose signature the paper asks for there. */
  onSign?: (spot: string, who: string) => void;
}

const FillingContext = createContext<Filling>({ details: {}, printed: {}, quiet: new Set(), ticked: {} });

/**
 * A run of dots, dashes or underscores the paper rules for something to be written on. Long enough not to
 * catch an ellipsis in a sentence: the pack rules these forty characters wide.
 */
const RULE_RUN = /(\.{5,}|\u2026{2,}|_{4,}|[-\u2013\u2014]{4,})/;

/** A line that is nothing but such a rule, which is the paper leaving a whole line to write on. */
function onlyARule(text: string) {
  return text.trim() !== "" && text.split(RULE_RUN).every((part) => RULE_RUN.test(part) || part.trim() === "");
}

/**
 * Whether the rule at this point is a place to sign, and whose signature the paper asks for. The pack rules a
 * line and says underneath what goes on it — Full Name, Signature, Capacity of Signatory — and says above it
 * who is signing.
 */
function signedHere(blocks: DocumentBlock[], at: number): string | null {
  const next = blocks[at + 1];
  const asksForASignature =
    (next?.kind === "COLUMNS" && (next.rows[0] ?? []).some((cell) => /^signature$/i.test(cell.text.trim()))) ||
    /signator/i.test(next?.text ?? "");
  if (!asksForASignature) return null;
  for (let back = at - 1; back >= 0 && back > at - 6; back -= 1) {
    const said = (blocks[back]?.text ?? "").trim();
    if (/^signed by\b/i.test(said)) return said.replace(/^signed by\s+/i, "").toLowerCase() || "the client";
  }
  return /signator/i.test(next?.text ?? "") ? "the firm" : "the client";
}

/** A cell that is the word alone: the paper heading a column, or labelling the space beside it. */
const SIGNATURE_LABEL = /^signature\s*\(?s?\)?\s*:?$/i;

/** Words that name the rule after them as the place to sign: "Signature: ______". */
const SIGNS_WHAT_FOLLOWS = /signature\s*\(?s?\)?\s*:?\s*$/i;

/** "Date: ______" is a day to pick, not a line to type anything on. */
const DATES_WHAT_FOLLOWS = /\bdate(?:d)?\s*\(?s?\)?\s*:?\s*$/i;

/** Today, which is the earliest a day being written on a document now can be. */
function today() {
  return new Date();
}

function yearsFromToday(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() + years, day.getMonth(), day.getDate());
}

/** A whole line the paper rules to write on: written on where this is a form, left as a rule where it is not. */
function RuledBlank({ name }: { name: string }) {
  const { onFill } = useContext(FillingContext);
  if (onFill) return <Blank name={name} wide />;
  return <span aria-hidden="true" className="mt-4 block h-6 w-80 max-w-full border-b border-ink-muted/60" />;
}

/**
 * Where the paper asks for a signature. Unsigned it is the place to sign, the way a signing tool marks one;
 * signed it is the signature itself, over the rule the paper ruled.
 */
function SignatureSpot({ spot, who, where }: { spot: string; who?: string; where?: "inline" | "cell" }) {
  const { details, onSign } = useContext(FillingContext);
  return (
    <SignatureMark
      made={madeSignature(details[spot])}
      who={who}
      shape={where ?? "block"}
      onOpen={onSign ? () => onSign(spot, who ?? "the client") : undefined}
    />
  );
}

/** A blank on a form, written in here. It looks like the rule the paper leaves, not like a box on a screen. */
function Blank({ name, wide, idle, day }: { name: string; wide?: boolean; idle?: boolean; day?: boolean }) {
  const { details, onFill } = useContext(FillingContext);
  const written = details[name] ?? "";
  if (!onFill) {
    return <span className="text-ink">{written || "\u2007\u2007\u2007\u2007"}</span>;
  }
  if (day) {
    // A day is picked from a calendar rather than typed, and a day already gone is not one a document is
    // being dated with now.
    return (
      <span className={cn("inline-block align-baseline", wide ? "w-full" : "w-44")}>
        <DateInput
          id={name}
          name={name}
          value={written}
          min={today()}
          max={yearsFromToday(2)}
          disabled={idle}
          onChange={(picked) => onFill(name, picked)}
        />
      </span>
    );
  }
  return (
    <input
      type="text"
      aria-label="Fill in"
      value={written}
      // The rule beside a box is only written on once that box is the one ticked.
      disabled={idle}
      onChange={(event) => onFill(name, event.target.value)}
      className={cn(
        // Written on rather than filled in: the cell it sits in is the box, so the field itself keeps out of
        // the way until it is pointed at.
        "rounded-md border border-transparent bg-transparent px-2 py-1 text-ink",
        "hover:border-line focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15 focus:outline-none",
        // A blank in a sentence has no cell around it, so it keeps the rule the paper drew.
        wide ? "w-full" : "w-52 border-b-ink-muted/50",
        idle && "cursor-not-allowed text-ink-muted hover:border-transparent",
      )}
    />
  );
}

/**
 * The wording with the details dropped in. A gap nobody has filled goes on saying what the document says —
 * the blank the firm left — marked so it can be seen at a glance. On a form, a ruled line is written on here.
 */
function useFilledIn() {
  const { details, printed, quiet, onFill } = useContext(FillingContext);

  function gapPiece(piece: string, at: string): ReactNode {
    const gap = /^\{\{(\w+)(\^?)}}$/.exec(piece);
    if (!gap) return piece;
    const key = gap[1]!;
    // Where the paper shouted, as a heading in capitals does, it goes on shouting.
    const asShown = (value: string) => (gap[2] ? value.toUpperCase() : value);
    const filled = details[key]?.trim();
    if (!filled) {
      return (
        <mark key={at} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {asShown(printed[key] ?? "to fill in")}
        </mark>
      );
    }
    return quiet.has(key) ? (
      asShown(filled)
    ) : (
      <mark key={at} className="rounded bg-primary-50 px-1 font-semibold text-primary-800">
        {asShown(filled)}
      </mark>
    );
  }

  return (text: string, where = "", idle = false): ReactNode[] => {
    const said: ReactNode[] = [];
    text.split(/(\{\{\w+\^?}})/).forEach((piece, part) => {
      if (piece.startsWith("{{")) {
        said.push(gapPiece(piece, `${part}`));
        return;
      }
      // The paper rules a run of dots or underscores where something is to be written. On a form that rule is
      // written on; read-only it stays a rule, never the dots themselves.
      const runs = piece.split(RULE_RUN);
      runs.forEach((run, which) => {
        if (!RULE_RUN.test(run)) {
          said.push(run);
          return;
        }
        // "Signature: ______" is a place to sign, not a blank to type in.
        if (SIGNS_WHAT_FOLLOWS.test(runs[which - 1] ?? "")) {
          said.push(<SignatureSpot key={`${part}.${which}`} spot={`${where}.${part}.${which}`} where="inline" />);
          return;
        }
        const asksForADay = DATES_WHAT_FOLLOWS.test(runs[which - 1] ?? "");
        said.push(
          onFill ? (
            <Blank key={`${part}.${which}`} name={`${where}.${part}.${which}`} idle={idle} day={asksForADay} />
          ) : (
            <span
              key={`${part}.${which}`}
              aria-hidden="true"
              className="mx-1 inline-block w-32 max-w-full border-b border-ink-muted/60 align-baseline"
            />
          ),
        );
      });
    });
    return said;
  };
}

// A sub-clause sits in from its clause, but only so far: 3.2.11 is still meant to be read, not hunted for.
// The deepest the pack goes is a bullet under a lettered sub-clause, which is the fourth step.
const INDENTS = ["", "pl-6", "pl-10", "pl-14"];

function indent(level: number) {
  return INDENTS[Math.min(Math.max(level - 1, 0), INDENTS.length - 1)];
}

/**
 * The number a clause prints, in its own column, so every number down the page lines up. A bullet is not a
 * number and does not need that column: it sits just in front of the words it belongs to.
 */
function Numbered({
  number,
  indented,
  bullet,
  children,
}: {
  number: string | null;
  indented: string;
  bullet?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-x-3", bullet ? "grid-cols-[1rem_minmax(0,1fr)]" : "grid-cols-[4.5rem_minmax(0,1fr)]", indented)}>
      <span className={cn("pt-0.5 text-sm font-semibold text-ink-muted", !bullet && "tabular-nums")}>
        {number}
      </span>
      <div className="text-sm leading-relaxed whitespace-pre-line text-ink">{children}</div>
    </div>
  );
}

/** A box the paper draws for a choice. Operations tick it here; what they tick is kept with the document. */
function TickBox({ id, ticked, onTick, only }: { id: string; ticked: boolean; onTick?: (ticked: boolean) => void; only?: boolean }) {
  return (
    <input
      // One of a set the paper says to pick one of: it looks and behaves as a choice, not a list.
      type={only ? "radio" : "checkbox"}
      id={`tick-${id}`}
      checked={ticked}
      disabled={!onTick}
      onChange={(event) => onTick?.(event.target.checked)}
      className={cn(
        "mt-1.5 size-4 shrink-0 border-ink-muted text-primary-600 accent-primary-600 disabled:opacity-100",
        only ? "rounded-full" : "rounded-[2px]",
      )}
    />
  );
}

/** What a cell says: its words, the boxes it draws to tick, and the lines it rules to write on. */
/** Boxes the paper offers as alternatives: Yes or No, never both. */
const EITHER_OR = /^(yes|no)\b/i;

function Cell({
  cell,
  where,
  naming,
  ticking,
  insteadOf,
  mark,
  signing,
}: {
  cell: DocumentCell;
  where: string;
  naming?: boolean;
  /** The number the paper prints in front of an answer, which sits in the same cell as the answer. */
  mark?: string;
  /** A cell in a column the paper says to tick: a box to pick, not a line to write on. */
  ticking?: boolean;
  /** The other boxes this one is an alternative to, such as the rows of a "Select One" column. */
  insteadOf?: string[];
  /** Where the paper asks for a signature in this cell: in place of what it holds, or after it. */
  signing?: "instead" | "after" | false;
}) {
  const filledIn = useFilledIn();
  const { ticked, onTick, onFill } = useContext(FillingContext);
  const pieces = cell.text.split("☐");
  if (pieces.length === 1) {
    if (ticking && !cell.text.trim()) {
      return (
        <span className="flex justify-center">
          <TickBox
            id={`${where}.1`}
            ticked={Boolean(ticked[`${where}.1`])}
            only
            onTick={onTick ? (on) => onTick(`${where}.1`, on, insteadOf ?? []) : undefined}
          />
        </span>
      );
    }
    // A cell the paper leaves for a signature is signed in, not written in.
    if (signing === "instead") return <SignatureSpot spot={where} where="cell" />;
    if (signing === "after") {
      return (
        <span className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="shrink-0">{filledIn(cell.text, where)}</span>
          <SignatureSpot spot={`${where}.sign`} where="inline" />
        </span>
      );
    }
    // A cell the paper leaves empty is where the answer is written — unless it is naming a column.
    const writable = onFill && !naming && !cell.text.trim();
    if (!writable) return <>{filledIn(cell.text, where)}</>;
    return mark ? (
      <span className="flex items-baseline gap-2">
        <span className="shrink-0 text-ink-muted">{mark}</span>
        <Blank name={where} wide />
      </span>
    ) : (
      <Blank name={where} wide />
    );
  }
  // A box and what it stands for read as one line; several in a cell stack, as they do on the paper.
  const bare = pieces.every((piece, at) => at === 0 || !piece.trim());
  const labels = pieces.slice(1).map((piece) => piece.trim());
  // Yes or No in one cell are alternatives; so is a box in a column the paper heads "Select One".
  const alternatives = labels.length > 1 && labels.every((label) => EITHER_OR.test(label));
  const others = (at: number) =>
    alternatives ? labels.map((_, which) => `${where}.${which + 1}`).filter((key) => key !== `${where}.${at}`) : (insteadOf ?? []);
  return (
    <span className={cn("flex flex-col gap-1.5", bare && "items-center")}>
      {pieces.map((piece, at) =>
        at === 0 && !piece.trim() ? null : (
          <span key={at} className="flex items-start gap-2">
            {at > 0 && (
              <TickBox
                id={`${where}.${at}`}
                ticked={Boolean(ticked[`${where}.${at}`])}
                only={alternatives || (insteadOf?.length ?? 0) > 0}
                onTick={onTick ? (on) => onTick(`${where}.${at}`, on, others(at)) : undefined}
              />
            )}
            {piece.trim() && <span className="flex-1">{filledIn(piece, `${where}.${at}`)}</span>}
          </span>
        ),
      )}
    </span>
  );
}

/** A row of a list is numbered and otherwise blank; the number is the paper's, not an answer. */
const MARK_ONLY = /^\s*(\d+|[a-z])[.)]?\s*$/i;

/**
 * A table whose rows after the first say nothing but their own number is not a table to read: it is a list to
 * be written on, and the paper rules as many rows as it guessed would be wanted. On screen the rows are added
 * as they are needed instead, so a fifth client is not turned away by a table that stops at four.
 */
function listToWriteOn(rows: DocumentCell[][]) {
  if (rows.length < 3) return false;
  return rows.slice(1).every((row) =>
    row.every((cell, which) => (which === 0 ? !cell.text.trim() || MARK_ONLY.test(cell.text) : !cell.text.trim())),
  );
}

function Table({ rows: printed, widths, where }: { rows: DocumentCell[][]; widths: number[]; where: string }) {
  const { onFill, listRows, onListRows } = useContext(FillingContext);
  const asList = Boolean(onFill && onListRows) && listToWriteOn(printed);
  const shown = Math.max(1, listRows?.[where] ?? 1);
  // Every row of the list takes its columns from the heading above it, so each answer sits under what asks for
  // it. The paper merges its own rows unevenly, which leaves an answer straddling two headings.
  const listRow = () => printed[0]!.map((heading) => ({ ...heading, text: "", shaded: false }));
  const rows = asList ? [printed[0]!, ...Array.from({ length: shown }, listRow)] : printed;
  const widest = Math.max(...rows.map((row) => row.reduce((wide, cell) => wide + cell.across, 0)));
  // A row the paper tints all the way across names what follows it; a cell tinted on its own is just a question,
  // and a question and its answer sit on the same ground.
  const banded = (row: DocumentCell[]) => row.length > 0 && row.every((cell) => cell.shaded);
  // Where a cell of every row sits, so a column can be followed down the table.
  const columns = rows.map((row) => {
    let column = 0;
    return row.map((cell) => {
      const from = column;
      column += cell.across;
      return from;
    });
  });
  // A column that only ever holds a short mark — A, B, C1, 1, 2 — numbers the rows rather than answering.
  const numbering = new Set(
    Array.from({ length: widest }, (_, column) => column).filter((column) => {
      const said = rows
        .flatMap((row, at) => row.flatMap((cell, which) => (columns[at]![which] === column ? [cell.text.trim()] : [])))
        .filter(Boolean);
      return said.length > 0 && said.every((text) => text.length <= 4);
    }),
  );
  // The columns the paper heads Signature, as the width each heading covers. The pack merges its rows unevenly,
  // so a cell belongs to that heading when it runs under any part of it, not only when it starts where it does.
  const signatureSpans = (rows[0] ?? []).flatMap((cell, which) =>
    SIGNATURE_LABEL.test(cell.text.trim()) ? [[columns[0]![which]!, columns[0]![which]! + cell.across] as const] : [],
  );
  const cols = (row: number, which: number) => columns[row]![which]!;
  const underASignatureHeading = (from: number, across: number) =>
    signatureSpans.some(([starts, ends]) => from < ends && starts < from + across);
  /**
   * Whether the paper asks for a signature here: "instead" where it leaves the space empty, "after" where the
   * word takes the whole cell and the signature goes beside it.
   */
  const signsHere = (row: DocumentCell[], at: number, which: number, from: number): "instead" | "after" | false => {
    const cell = row[which]!;
    if (!cell.text.trim()) {
      if (at > 0 && underASignatureHeading(from, cell.across)) return "instead";
      for (let back = which - 1; back >= 0; back -= 1) {
        const said = row[back]!.text.trim();
        if (said) return SIGNATURE_LABEL.test(said) ? "instead" : false;
      }
      return false;
    }
    // The word on its own. Where the paper leaves space under it — a column headed "Signature(s)" with the
    // clients listed below — that space is where they sign, and the heading is only a heading. Where there is
    // no such space, as on a line reading "Signature:", the signature goes beside the word.
    if (!SIGNATURE_LABEL.test(cell.text.trim())) {
      return false;
    }
    const spaceBelow = rows.some((other, below) => below > at
      && other.some((one, which) => !one.text.trim() && cols(below, which) < from + cell.across
        && from < cols(below, which) + one.across));
    return spaceBelow ? false : "after";
  };
  // A column the paper heads "Select One", or "Tick approp box", is one choice down the table.
  const chosenOnce = new Set(
    (rows[0] ?? []).flatMap((cell, which) =>
      /select\s*one|tick\b/i.test(cell.text) ? [columns[0]![which]!] : [],
    ),
  );
  // The mark a row carries in its index column, such as the A of "A  An Individual:".
  const markOf = (row: DocumentCell[], at: number) => {
    const which = row.findIndex((_, of) => numbering.has(columns[at]![of]!));
    return which < 0 ? "" : row[which]!.text.trim();
  };
  // A lettered row names the rows that follow it only when rows do follow it; where the next mark comes
  // straight after, or the table ends, that row is the option itself.
  const namesWhatFollows = (at: number) => {
    if (!markOf(rows[at]!, at)) return false;
    for (let next = at + 1; next < rows.length; next++) {
      if (!rows[next]!.some((cell) => cell.text.trim())) continue;
      return !markOf(rows[next]!, next);
    }
    return false;
  };
  // "AND", "Or", "Either" join two conditions together; they are not conditions themselves.
  const JOINING = /^(and|or|either)\b[:.]?$/i;
  const nothingToTick = (row: DocumentCell[], at: number) => {
    const said = row
      .filter((_, of) => !numbering.has(columns[at]![of]!) && !chosenOnce.has(columns[at]![of]!))
      .map((cell) => cell.text.trim())
      .filter(Boolean);
    if (said.length === 0 || said.every((text) => JOINING.test(text))) return true;
    return namesWhatFollows(at);
  };
  const boxesDown = (column: number, exceptRow: number) =>
    rows.flatMap((row, at) =>
      at === 0 || at === exceptRow
        ? []
        : row.flatMap((_, which) => (columns[at]![which] === column ? [`${where}.${at}.${which}.1`] : [])),
    );
  return (
    <div className="overflow-x-auto pt-4 pb-4">
      {/* The frame is drawn round the table rather than by it, so the table closes on every side. */}
      <div className="overflow-hidden rounded-lg border border-line">
        {/* Every column the same width, so a question and the box for its answer are the same size. */}
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            {/* The share of the width the firm gives each column, or an even split where it says nothing. */}
            {Array.from({ length: widest }, (_, column) => (
              <col key={column} style={{ width: `${widths[column] ?? 100 / widest}%` }} />
            ))}
          </colgroup>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.map((row, at) => {
              let column = 0;
              return (
                <tr key={at}>
                  {row.map((cell, which) => {
                    const from = column;
                    column += cell.across;
                    return (
                      <td
                        key={which}
                        colSpan={cell.across}
                        rowSpan={cell.down}
                        className={cn(
                          "border-r border-b border-line px-5 py-3.5 align-top leading-relaxed whitespace-pre-line text-ink",
                          // The frame already draws the right-hand edge.
                          from + cell.across >= widest && "border-r-0",
                          cell.shaded && "font-semibold",
                          banded(row) && "bg-slate-50",
                          banded(row) && at === 0 && "text-sm tracking-wider text-ink-muted uppercase",
                        )}
                      >
                        <Cell
                          cell={cell}
                          where={`${where}.${at}.${which}`}
                          naming={
                            banded(row) || numbering.has(from) || (chosenOnce.has(from) && nothingToTick(row, at))
                          }
                          ticking={chosenOnce.has(from) && at > 0 && !nothingToTick(row, at)}
                          insteadOf={chosenOnce.has(from) ? boxesDown(from, at) : undefined}
                          mark={asList && at > 0 && which === 0 ? `${at})` : undefined}
                          signing={signsHere(row, at, which, from)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {asList && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onListRows?.(where, shown + 1)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Add a row
          </button>
          {shown > 1 && (
            <button
              type="button"
              onClick={() => onListRows?.(where, shown - 1)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink-muted hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Remove the last row
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A document as it reads on paper: its title, its headings, its numbered clauses set out under them, and its
 * tables. Reading one through is the whole point of this screen, so it is set out to be read rather than scanned.
 */
export function DocumentWording({
  blocks,
  gaps,
  details,
  ticked,
  onTick,
  onFill,
  listRows,
  onListRows,
  onSign,
}: {
  blocks: DocumentBlock[];
  gaps: DocumentGap[];
  details: Record<string, string>;
  ticked: Record<string, boolean>;
  /** insteadOf names the other boxes this one is an alternative to, which go back when it is ticked. */
  onTick?: (key: string, ticked: boolean, insteadOf?: string[]) => void;
  /** Set on a form Operations complete: its blanks and empty cells are written in. */
  onFill?: (key: string, value: string) => void;
  /** How many rows each list-to-write-on is showing, and how to ask it for more or fewer. */
  listRows?: Record<string, number>;
  onListRows?: (table: string, rows: number) => void;
  /** Set where this person may sign, which turns each signature place into one they can sign in. */
  onSign?: (spot: string, who: string) => void;
}) {
  const filling = useMemo(
    () => ({
      details,
      ticked,
      onTick,
      onFill,
      listRows,
      onListRows,
      onSign,
      printed: Object.fromEntries(gaps.flatMap((gap) => (gap.printed ? [[gap.key, gap.printed]] : []))),
      quiet: new Set(gaps.filter((gap) => gap.about === "FIRM").map((gap) => gap.key)),
    }),
    [details, gaps, ticked, onTick, onFill, listRows, onListRows, onSign],
  );
  return (
    <FillingContext.Provider value={filling}>
      <Wording blocks={blocks} />
    </FillingContext.Provider>
  );
}

const NOTE = /^\(?(note|notes)\b/i;

/** A bold line that ends in a colon is a label for the line under it, not a heading over a section. */
const LABELS_WHAT_FOLLOWS = /:\s*$/;

/**
 * Some of the pack's documents type their own list markers rather than letting Word number the list, so the
 * bullet arrives as the first character of the paragraph. It is still a bullet, and is set as one: Word's own
 * second-level marker is a lower-case o, which sits a further step in.
 */
const TYPED_BULLET = /^\s*([•▪‣])\s+/;

const TYPED_SUB_BULLET = /^\s*o\s+(?=\S)/;

/** A heading the document numbers under its part, such as "6.1 Prohibited Investments", typed as a paragraph. */
const TYPED_SUB_HEADING = /^\s*\d+\.\d+\s+\S/;

function typedAsList(block: DocumentBlock) {
  const text = block.text ?? "";
  if (TYPED_BULLET.test(text)) return { marker: "•", level: 1, text: text.replace(TYPED_BULLET, "") };
  if (TYPED_SUB_BULLET.test(text)) return { marker: "◦", level: 2, text: text.replace(TYPED_SUB_BULLET, "") };
  return null;
}

/** A line the document sets as a heading of its own, without giving it a heading's style. */
function typedAsHeading(block: DocumentBlock) {
  const text = (block.text ?? "").trim();
  if (!TYPED_SUB_HEADING.test(text)) return false;
  // A heading names something; it does not run on into a sentence.
  return text.length < 80 && !/[.;:]$/.test(text);
}

/** A number the document builds out of its parts, as 2.1 or 3.2.11. */
const BUILT_UP = /^\d+(?:\.\d+)+\.?$/;

/** A number the document typed at the head of the line rather than letting Word number the line for it. */
const TYPED_NUMBER = /^\s*(\d+(?:\.\d+)*\.?)\s+(?=\S)/;

/** A cell that holds nothing but a number: the document's way of setting a heading's number in its own column. */
const JUST_A_NUMBER = /^\d+(?:\.\d+)*\.?$/;

/**
 * The number a line prints and the words that follow it. Some of the pack's lines are numbered by Word and
 * some are typed with their number in front, and both are read here the same way, so that every number down
 * the page ends up in the one column whichever way the document happens to set it.
 */
function marked(block: DocumentBlock) {
  const text = block.text ?? "";
  const number = (block.number ?? "").trim();
  if (number) return { mark: number, text };
  const typed = TYPED_NUMBER.exec(text);
  return typed ? { mark: typed[1]!, text: text.slice(typed[0].length) } : { mark: null, text };
}

/**
 * How far in a line sits. A built-up number says that for itself, and it is worth more than the level Word
 * recorded: the agreements set one clause as a heading and the next as a list item, so the level jumps about
 * where the printed number does not.
 */
function depthOf(block: DocumentBlock, mark: string | null) {
  if (mark && BUILT_UP.test(mark)) return mark.replace(/\.$/, "").split(".").length - 1;
  return block.level;
}

/** A line that names a part of the document, with its number in the column every other number sits in. */
function Heading({ mark, depth, children }: { mark: string | null; depth: number; children: ReactNode }) {
  return (
    <h3 className={cn("pt-5 text-sm text-ink", depth === 0 ? "font-semibold" : "font-medium", indent(depth))}>
      <span className={cn("grid gap-x-3", mark && "grid-cols-[4.5rem_minmax(0,1fr)]")}>
        {mark && <span className="tabular-nums text-ink-muted">{mark}</span>}
        <span>{children}</span>
      </span>
    </h3>
  );
}

/** What the firm calls a part of a form: set as a quiet rule across the page, with room above it. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="border-b border-line pt-8 pb-2 text-sm font-semibold tracking-wider text-ink-muted uppercase">
      {children}
    </h4>
  );
}

/** A paragraph the paper sets between two boxes to say they are alternatives. */
const OR_BETWEEN = /^or$/i;

/**
 * The boxes the paper prints in a run, which it asks to be initialled one of. A run is the boxes that follow
 * one another, and the paper's own "Or" between two of them does not break it — that is what marks them as
 * alternatives in the first place. Ticking one of a run puts the others back.
 */
function alternativesIn(blocks: DocumentBlock[]) {
  const sets = new Map<number, string[]>();
  let run: number[] = [];
  const close = () => {
    const keys = run.map((at) => blocks[at]!.key).filter((key): key is string => Boolean(key));
    if (keys.length > 1) for (const at of run) sets.set(at, keys);
    run = [];
  };
  blocks.forEach((block, at) => {
    if (block.kind === "CHECKBOX") {
      run.push(at);
      return;
    }
    if (run.length > 0 && OR_BETWEEN.test((block.text ?? "").trim())) return;
    close();
  });
  close();
  return sets;
}

/**
 * The sub-headings a document sets as numbered clauses rather than as headings. A clause numbered 22.1 may
 * head what follows it — "22.1 General" — or be the first line of a list of clauses, and the document itself
 * says which: where every clause sharing a number reads as a name rather than as a sentence, that run is the
 * section's headings, and where any one of them runs on into a sentence the whole run is clauses.
 */
function subHeadingsIn(blocks: DocumentBlock[]) {
  const runs = new Map<string, number[]>();
  blocks.forEach((block, at) => {
    const mark = (block.number ?? "").trim();
    if (block.kind !== "CLAUSE" || !BUILT_UP.test(mark)) return;
    const under = mark.replace(/\.$/, "").split(".").slice(0, -1).join(".");
    runs.set(under, [...(runs.get(under) ?? []), at]);
  });
  const headings = new Set<number>();
  for (const run of runs.values()) {
    if (run.every((at) => namesAPart(blocks[at]?.text ?? ""))) for (const at of run) headings.add(at);
  }
  return headings;
}

function Wording({ blocks }: { blocks: DocumentBlock[] }) {
  const filledIn = useFilledIn();
  const { ticked, onTick } = useContext(FillingContext);
  const alternatives = useMemo(() => alternativesIn(blocks), [blocks]);
  const subHeadings = useMemo(() => subHeadingsIn(blocks), [blocks]);
  /** A line the paper opens with a bold label, such as "Asset Management Fees:". */
  const said = (block: DocumentBlock, where: string, idle = false, saying?: string) => {
    const text = saying ?? block.text ?? "";
    if (!block.lead || !text.startsWith(block.lead)) return filledIn(text, where, idle);
    return [<strong key="lead">{block.lead}</strong>, ...filledIn(text.slice(block.lead.length), where, idle)];
  };
  return (
    <div className="space-y-3.5">
      {blocks.map((block, at) => {
        // A line that is nothing but a ruled blank: the place a signature goes, or a rule to write on.
        if (onlyARule(block.text ?? "")) {
          const who = signedHere(blocks, at);
          return who ? <SignatureSpot key={at} spot={`s${at}`} who={who} /> : <RuledBlank key={at} name={`r${at}`} />;
        }
        const words = said(block, `b${at}`);
        switch (block.kind) {
          case "TITLE":
            return (
              <p key={at} className="pt-2 pb-1 text-sm font-bold tracking-wide text-ink">
                {words}
              </p>
            );
          case "HEADING": {
            const { mark, text } = marked(block);
            const depth = depthOf(block, mark);
            const saying = said(block, `b${at}`, false, text);
            // A clause the document happens to have set in a heading style is still a clause, and is read as
            // one: in the same column, at the same depth and in the same weight as the clauses around it.
            if (namesAPart(text)) {
              return (
                <Heading key={at} mark={mark} depth={depth}>
                  {saying}
                </Heading>
              );
            }
            if (!mark) {
              return (
                <p key={at} className={cn("text-sm leading-relaxed whitespace-pre-line text-ink", indent(depth))}>
                  {saying}
                </p>
              );
            }
            return (
              <Numbered key={at} number={mark} indented={indent(depth)}>
                {saying}
              </Numbered>
            );
          }
          case "CLAUSE": {
            const depth = depthOf(block, block.number);
            // A clause the document uses to head its next few paragraphs is read as the heading it is.
            if (subHeadings.has(at)) {
              return (
                <Heading key={at} mark={block.number} depth={depth}>
                  {words}
                </Heading>
              );
            }
            return (
              <Numbered key={at} number={block.number} indented={indent(depth)}>
                {words}
              </Numbered>
            );
          }
          case "BULLET":
            return (
              // A bullet under a clause sits in from it, as the paper sets it.
              <Numbered key={at} number="•" bullet indented={indent(block.level + 1)}>
                {words}
              </Numbered>
            );
          case "CHECKBOX":
            return (
              <div key={at} className={cn("flex gap-3", indent(block.level))}>
                <TickBox
                  id={block.key ?? String(at)}
                  ticked={Boolean(block.key && ticked[block.key])}
                  // The paper asks for one of a run to be initialled, so ticking one puts the others back.
                  only={(alternatives.get(at)?.length ?? 0) > 1}
                  onTick={
                    block.key && onTick
                      ? (on) =>
                          onTick(
                            block.key!,
                            on,
                            (alternatives.get(at) ?? []).filter((key) => key !== block.key),
                          )
                      : undefined
                  }
                />
                <label
                  htmlFor={`tick-${block.key ?? at}`}
                  className={cn("text-sm leading-relaxed text-ink", onTick && "cursor-pointer")}
                >
                  {/* Named after the box, so what is written on its rule goes back with it. */}
                  {said(block, block.key ?? `b${at}`, !(block.key && ticked[block.key]))}
                </label>
              </div>
            );
          case "TABLE":
            return <Table key={at} rows={block.rows} widths={block.widths} where={`t${at}`} />;
          case "COLUMNS": {
            // A heading the document typed as a number, a tab and a title arrives as two columns. It is a
            // heading, not a pair of columns, and is set as one — otherwise its title sits out in mid-page.
            const cells = block.rows[0] ?? [];
            const mark = cells.length === 2 ? cells[0]!.text.trim() : "";
            if (JUST_A_NUMBER.test(mark) && cells[1]!.text.trim()) {
              return (
                <Heading key={at} mark={mark} depth={depthOf(block, mark)}>
                  {filledIn(cells[1]!.text, `c${at}.1`)}
                </Heading>
              );
            }
            // The paper sets some of its signature lines as a label and a colon, with the space left after.
            const signHere = SIGNATURE_LABEL.test((cells[0]?.text ?? "").trim())
              && cells.slice(1).every((cell) => !cell.text.replace(/[:\s]/g, ""));
            return (
              <div key={at} className="flex flex-wrap items-end gap-x-10 gap-y-1 pt-2 text-sm text-ink">
                {cells.map((cell, column) => (
                  <span key={column} className={cn("min-w-[8rem]", signHere ? "shrink-0" : "flex-1")}>
                    {filledIn(cell.text, `c${at}.${column}`)}
                  </span>
                ))}
                {signHere && <SignatureSpot spot={`c${at}.sign`} where="inline" />}
              </div>
            );
          }
          default: {
            const listed = typedAsList(block);
            if (listed) {
              // The marker the paper typed is dropped: the bullet itself is drawn, so it is not printed twice.
              return (
                <Numbered key={at} number={listed.marker} bullet indented={indent(block.level + listed.level)}>
                  {filledIn(listed.text, `b${at}`)}
                </Numbered>
              );
            }
            if (typedAsHeading(block)) {
              const { mark, text } = marked(block);
              return (
                <Heading key={at} mark={mark} depth={depthOf(block, mark)}>
                  {said(block, `b${at}`, false, text)}
                </Heading>
              );
            }
            // The paper centres its own display lines, such as a schedule's subtitle. They are the document
            // speaking, not a heading over a section, so they keep their own case.
            if (block.centred) {
              return (
                <p key={at} className="text-sm leading-relaxed font-medium text-ink">
                  {words}
                </p>
              );
            }
            // A bold line that ends in a colon labels the line under it — "Detailed Objective:" — rather than
            // heading a section, so it is set as a label and kept with what it introduces.
            if (block.strong && LABELS_WHAT_FOLLOWS.test(block.text ?? "")) {
              return (
                <p key={at} className={cn("-mb-1 text-sm leading-relaxed font-semibold text-ink", indent(block.level))}>
                  {words}
                </p>
              );
            }
            if (block.strong) {
              return <SectionHeading key={at}>{words}</SectionHeading>;
            }
            if (block.lead && NOTE.test(block.lead)) {
              // A note is guidance about the form, not part of it.
              return (
                <p key={at} className="rounded-xl bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
                  {words}
                </p>
              );
            }
            // A paragraph the paper sets in among the numbered clauses carries on from the one above it, so it
            // is set in that clause's own column rather than out at the margin on its own.
            if (block.level >= 2 && !block.centred) {
              return (
                <Numbered key={at} number={null} indented={indent(block.level)}>
                  {words}
                </Numbered>
              );
            }
            return (
              <p
                key={at}
                className={cn(
                  // A line break the paper puts inside one paragraph is a line on the page, and stays one.
                  "text-sm leading-relaxed whitespace-pre-line text-ink",
                  indent(block.level),
                )}
              >
                {words}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
