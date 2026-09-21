import type { DocumentBlock, DocumentGap } from "@atomprive/api-client/backoffice";

/**
 * A signed document, cut into the parts it is numbered into, so it is read a part at a time like the forms are
 * filled in a section at a time. Nothing is reworded or reordered: the cut is made where the document itself
 * starts a new numbered heading, and everything before the first one is the part that names the parties.
 */

export interface DocumentPart {
  id: string;
  /** What the document calls the part, as it prints it. */
  label: string;
  /** The part's number, where it prints one. */
  number?: string;
  blocks: DocumentBlock[];
  /** The gaps this part leaves, so each is filled where it is read. */
  gaps: DocumentGap[];
}

/** A heading that starts a part: one the document numbers 1., 2., 3. — not a 4.1 under one of them. */
const TOP_LEVEL = /^\s*(\d+)[.)]?\s*$/;

/** A document may divide itself into lettered parts over its numbered ones, as A and B. */
const DIVISION = /^\s*([A-Z])[.)]?\s*$/;

const NUMBERED_TEXT = /^\s*(\d+)\.\s+\S/;

/** A heading that types its own number, as "14. Governing Law": the number is the part's, the rest its name. */
const TYPED_PART = /^\s*(\d+[.)])\s+(\S.*)$/;

/**
 * Whether a line names a part of the document or is a part of it. Word's heading styles cannot answer that:
 * the pack's agreements set whole clauses in them as well as titles. What a line is is in what it says — a
 * title is short and stops there, where a clause runs on into a sentence.
 */
export function namesAPart(text: string) {
  const said = text.trim();
  return said.length > 0 && said.length < 90 && !/[.;]$/.test(said);
}

/** The mark the document puts against a block, where that mark is one it numbers a whole part with. */
function partMark(block: DocumentBlock) {
  const number = (block.number ?? "").trim();
  if (!number) return null;
  if (!TOP_LEVEL.test(number) && !DIVISION.test(number)) return null;
  return number.replace(/[.)]$/, "");
}

/** A heading always starts the part it names; a document that numbers its headings in the text does too. */
function headingStartsAPart(block: DocumentBlock) {
  if (block.kind !== "HEADING" && block.kind !== "TITLE") return false;
  return block.number ? partMark(block) !== null : NUMBERED_TEXT.test(block.text ?? "");
}

/**
 * Where a document sets one of its sections as a numbered clause rather than a heading — the risk disclosure
 * does it twice — that section still starts a part. It is only a section, though, if its number is one no
 * heading has already claimed: an agreement that numbers a list of clauses 1. to 10. inside a section is
 * numbering the list, not starting ten sections.
 */
function partStarts(blocks: DocumentBlock[]) {
  const starts = new Set<number>();
  const claimed = new Set<string>();
  // The levels the document has been starting its parts at, so an unnumbered one can be recognised by them.
  const levels = new Set<number>();
  let opened = Number.POSITIVE_INFINITY;
  blocks.forEach((block, at) => {
    if (!headingStartsAPart(block)) return;
    starts.add(at);
    levels.add(block.level);
    opened = Math.min(opened, at);
    const mark = partMark(block);
    if (mark) claimed.add(mark);
  });
  blocks.forEach((block, at) => {
    if (block.kind !== "CLAUSE") return;
    const mark = partMark(block);
    if (!mark || claimed.has(mark)) return;
    claimed.add(mark);
    starts.add(at);
  });
  // A document does not always number its last part: the mandates close with "Signatures" and the agreements
  // with "ANNEXURE" and "Section B". A heading that names a part, set where the document has been starting
  // them, starts one too — but only once the numbering has begun, since what comes before it is the title
  // and the parties, which belong together in the opening part.
  blocks.forEach((block, at) => {
    if (at < opened || starts.has(at)) return;
    if (block.kind !== "HEADING" && block.kind !== "TITLE") return;
    if (!levels.has(block.level) || !namesAPart(block.text ?? "")) return;
    starts.add(at);
  });
  return [...starts].sort((a, b) => a - b);
}

function startsAPart(block: DocumentBlock) {
  return headingStartsAPart(block) || (block.kind === "CLAUSE" && partMark(block) !== null);
}

/** What the document has written in a block, including every cell of a table. */
function wordsOf(block: DocumentBlock) {
  if (block.kind === "TABLE" || block.kind === "COLUMNS") {
    return block.rows.flatMap((row) => row.map((cell) => cell.text)).join(" ");
  }
  return `${block.lead ?? ""} ${block.text ?? ""}`;
}

/** The first line of the document that says anything, which is what the opening part is called. */
function openingLabel(blocks: DocumentBlock[], fallback: string) {
  const said = blocks.find((block) => (block.text ?? "").replace(/[{}^\W_]/g, "").length > 0);
  return said?.text?.trim() || fallback;
}

/**
 * The document in the parts it numbers itself into. The blocks before the first numbered heading name the
 * parties and set out what the agreement is for, so they are the first part.
 */
export function partsOf(blocks: DocumentBlock[], gaps: DocumentGap[], title: string): DocumentPart[] {
  const starts = partStarts(blocks);
  const cuts = starts.length > 0 && starts[0]! > 0 ? [0, ...starts] : starts.length > 0 ? starts : [0];
  const parts: DocumentPart[] = [];
  cuts.forEach((from, which) => {
    const to = cuts[which + 1] ?? blocks.length;
    const mine = blocks.slice(from, to);
    // A part that opens with a heading is named by it, so that heading is not printed again inside the part.
    const first = mine[0]!;
    const head = first.kind === "HEADING" || first.kind === "TITLE" || startsAPart(first) ? first : undefined;
    const words = mine.map(wordsOf).join(" ");
    // A document that types the number into the heading rather than letting Word number it says the same
    // thing; the number is taken out of the name so that it is shown once, in the column the others are in.
    const typed = head && !(head.number ?? "").trim() ? TYPED_PART.exec(head.text ?? "") : null;
    parts.push({
      id: `part-${from}`,
      label: typed ? typed[2]!.trim() : head ? (head.text ?? title).trim() : openingLabel(mine, title),
      number: head?.number?.trim() || typed?.[1] || undefined,
      // The heading is shown above the part; printing it again at the top of the part would say it twice.
      blocks: head ? mine.slice(1) : mine,
      gaps: gaps.filter((gap) => words.includes(`{{${gap.key}}}`) || words.includes(`{{${gap.key}^}}`)),
    });
  });
  return parts;
}
