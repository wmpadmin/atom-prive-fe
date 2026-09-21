import type { ApiError } from "@atomprive/api-client";
import {
  getOpenMineQueryKey,
  useOpenMine,
  useSaveMine,
  useSignMine,
  type MyDeclaration,
} from "@atomprive/api-client/backoffice";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, DateInput, Field, TextArea, TextInput, cn } from "@atomprive/ui";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { Tick, Written } from "../../components/form-boxes";
import { StepRail, type RailStep } from "../../components/step-rail";
import { formatDate } from "../../lib/labels";
import {
  AGREED,
  declarationBlanks,
  declarationBoxes,
  signingLines,
  signingRows,
  type Blank,
  type Box,
} from "./declaration-questions";
import { SIGN_STEP, declarationParts, notYoursToFillIn, type DeclarationPart } from "./declaration-parts";
import { declarationWording, type WordingBlock } from "./declaration-wording";

type Answers = Record<string, unknown>;

/** The nine the firm asks for; anything else in the address is not one of them. */
type DeclarationKind = MyDeclaration["kind"];

function isOneOfTheNine(said: string): said is DeclarationKind {
  return said in declarationWording;
}

/** Answers are kept in the shape the firm's record uses, so "questions.A1.held" reads and writes a path. */
function read(answers: Answers, path: string): unknown {
  return path.split(".").reduce<unknown>((at, step) => {
    if (at === null || typeof at !== "object") return undefined;
    return (at as Answers)[step];
  }, answers);
}

function write(answers: Answers, path: string, value: unknown): Answers {
  const [step, ...rest] = path.split(".");
  if (rest.length === 0) return { ...answers, [step!]: value };
  const below = answers[step!];
  const inside = below !== null && typeof below === "object" ? (below as Answers) : {};
  return { ...answers, [step!]: write(inside, rest.join("."), value) };
}

/** The boxes a document prints, numbered down the page, so each cell knows which of them it holds. */
function numberTheBoxes(blocks: WordingBlock[]) {
  const startsAt = new Map<string, number>();
  let printed = 0;
  blocks.forEach((block, at) => {
    if (block.kind === "TABLE") {
      block.rows.forEach((row, which) => {
        row.forEach((cell, side) => {
          startsAt.set(`${at}.${which}.${side}`, printed);
          printed += (cell.match(/[☐☒]/g) ?? []).length;
        });
      });
      return;
    }
    startsAt.set(String(at), printed);
    printed += block.kind === "CHECKBOX" ? 1 : (block.text.match(/[☐☒]/g) ?? []).length;
  });
  return startsAt;
}

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/** The mark a line of a list prints: "1." at the top level, "a." under it. */
const NUMBERED = /^(\d+[.)])\s+(.*)$/;
const LETTERED = /^([a-z][.)])\s+(.*)$/;

/**
 * A run of lines the paper sets as a list. Word's own indenting is not in the text, so what carries it is the
 * mark each line prints: a lettered line belongs under the numbered one above it, and a line with no mark at
 * all belongs under the marked line above it.
 */
function laidOut(text: string) {
  let under = -1;
  return text.split("\n").map((line) => {
    const said = line.trim();
    const numbered = NUMBERED.exec(said);
    if (numbered) {
      under = 0;
      return { mark: numbered[1]!, text: numbered[2]!, level: 0 };
    }
    const lettered = LETTERED.exec(said);
    if (lettered) {
      under = 1;
      return { mark: lettered[1]!, text: lettered[2]!, level: 1 };
    }
    return { mark: "", text: said, level: under < 0 ? 0 : under + 1 };
  });
}

const INDENTS = ["", "pl-6", "pl-12"];

/** What a block of the document says, set out the way it sets it out. */
function Prose({ text, className }: { text: string; className?: string }) {
  const lines = laidOut(text);
  if (lines.length === 1) {
    return (
      <p className={cn("text-sm leading-relaxed", className ?? "text-ink-soft")}>
        <Written text={lines[0]!.text} />
      </p>
    );
  }
  return (
    <div className={cn("space-y-1", className ?? "text-ink-soft")}>
      {lines.map((line, at) =>
        line.text ? (
          <div
            key={at}
            className={cn("flex gap-2 text-sm leading-relaxed", INDENTS[Math.min(line.level, INDENTS.length - 1)])}
          >
            {line.mark && <span className="shrink-0 font-semibold tabular-nums">{line.mark}</span>}
            <span className="min-w-0 flex-1">
              <Written text={line.text} />
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}

/** A line short enough to be a heading, that stops rather than running on into a sentence. */
function namesAPart(text: string) {
  const said = text.trim();
  return said.length > 0 && said.length < 90 && !/[.;]$/.test(said);
}

interface Filling {
  answers: Answers;
  boxes: Box[];
  blanks: Record<string, Blank>;
  startsAt: Map<string, number>;
  carried: Set<string>;
  printed: Record<string, string>;
  disabled: boolean;
  say: (path: string, value: unknown) => void;
}

/**
 * One declaration, read a part at a time and signed at the end. Every word on it is the firm's own, printed
 * from the document; what the screen does is set it out and make the boxes and blanks it draws real.
 */
export function MyDeclarationPage() {
  const { kind: said = "" } = useParams();
  const kind = isOneOfTheNine(said) ? said : undefined;
  const queryClient = useQueryClient();
  const open = useOpenMine<MyDeclaration, ApiError>(kind!, { query: { enabled: Boolean(kind) } });
  const sign = useSignMine<ApiError>();
  const save = useSaveMine<ApiError>();
  /** Whatever has been filled in this visit; until something is, what was kept last time stands. */
  const [draft, setDraft] = useState<Answers>();
  const [problem, setProblem] = useState<string>();
  const [kept, setKept] = useState(false);
  const [at, setAt] = useState<string>();
  // Which parts have been read through. Most parts ask nothing, so ticking one nobody has opened would say
  // work had been done that hasn't.
  const [readThrough, setReadThrough] = useState<ReadonlySet<string>>(new Set());

  const user = useStaffUser();
  const wording = kind ? declarationWording[kind] : undefined;
  const held = draft ?? ((open.data?.answers ?? {}) as Answers);
  // The firm already knows whose declaration this is, so their name is on it before they open it. Typing over
  // it, or clearing it, stands: what has been written is what is held, blank included.
  const answers: Answers = "name" in held ? held : { ...held, name: user.fullName };
  const signed = open.data?.signed ?? false;
  // Written from what is held now, not from this render's copy, so two answers in one go don't undo each other.
  const say = (path: string, value: unknown) =>
    setDraft((held) => write(held ?? ((open.data?.answers ?? {}) as Answers), path, value));

  const startsAt = useMemo(() => numberTheBoxes(wording?.blocks ?? []), [wording]);

  function keep() {
    setProblem(undefined);
    setKept(false);
    if (!kind) return;
    save.mutate(
      { kind, data: answers as never },
      {
        onSuccess: () => {
          setKept(true);
          void queryClient.invalidateQueries({ queryKey: getOpenMineQueryKey(kind) });
        },
        onError: (error) => setProblem(error.message),
      },
    );
  }

  function submit() {
    setProblem(undefined);
    setKept(false);
    if (!kind) return;
    sign.mutate(
      { kind, data: answers as never },
      {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: getOpenMineQueryKey(kind) }),
        onError: (error) => setProblem(error.message),
      },
    );
  }

  if (!kind || !open.data || !wording) {
    return (
      <div className="space-y-4">
        <BackLink />
        {open.isError ? (
          <Alert tone="danger">{open.error.message}</Alert>
        ) : (
          <p className="text-sm text-ink-muted">{kind ? "Loading the declaration…" : "No such declaration."}</p>
        )}
      </div>
    );
  }

  const parts = declarationParts[kind] ?? [];
  const theirs = new Set(notYoursToFillIn[kind] ?? []);
  const carried = new Set(signingRows[kind] ?? []);
  const filling: Filling = {
    answers,
    boxes: declarationBoxes[kind] ?? [],
    blanks: declarationBlanks[kind] ?? {},
    startsAt,
    carried,
    printed: wording.printed,
    disabled: signed,
    say,
  };

  // A part asks something when it draws a box or rules a blank the employee fills in.
  const asksSomething = (part: DeclarationPart) => !theirs.has(part.id) && whatItAsks(part, wording.blocks, filling).length > 0;
  const answered = (part: DeclarationPart) =>
    whatItAsks(part, wording.blocks, filling).every((path) => filled(read(answers, path)));

  const steps: RailStep[] = [
    ...parts.map((part) => ({
      id: part.id,
      group: part.mark,
      label: part.label,
      complete: readThrough.has(part.id) && (!asksSomething(part) || answered(part)),
    })),
    { id: SIGN_STEP, group: "—", label: "Sign this declaration", complete: signed },
  ];
  const current = steps.find((step) => step.id === at) ?? steps[0]!;
  const index = steps.findIndex((step) => step.id === current.id);
  const part = parts.find((one) => one.id === current.id);
  const onSign = current.id === SIGN_STEP;

  const goTo = (to: RailStep | undefined) => {
    if (!to) return;
    setReadThrough((already) => new Set(already).add(current.id));
    setAt(to.id);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-base font-bold">{open.data.title}</h1>
          <span className="text-line">|</span>
          <p className="text-sm text-ink-muted">{open.data.schedule}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={signed ? "success" : "danger"}>{signed ? "Signed" : "Unsigned"}</Badge>
          {!signed && (
            <Button variant="secondary" size="sm" disabled={save.isPending || sign.isPending} onClick={keep}>
              <Check aria-hidden="true" />
              {save.isPending ? "Saving…" : "Save what I've filled in"}
            </Button>
          )}
        </div>
      </header>

      {signed && (
        <Alert tone="success">
          You signed this on {open.data.signedOn ? formatDate(open.data.signedOn) : "file"}. A signed
          declaration cannot be changed; the firm keeps it for the regulator.
        </Alert>
      )}
      {problem && <Alert tone="danger">{problem}</Alert>}
      {kept && !signed && <Alert tone="info">Saved. You can come back and finish this later.</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <StepRail
          steps={steps}
          currentId={current.id}
          onSelect={(to) => goTo(steps.find((step) => step.id === to))}
          intro="Read it through and answer what it asks. Go to any part — nothing is locked."
          note={{
            title: "Nothing is sent until you sign",
            body: "Save as you go and come back to it. Once you sign, it becomes the firm's record and can't be changed.",
          }}
          footer={
            <Link to="/my-declarations" className="text-xs font-medium text-primary-700 hover:underline">
              Back to my declarations
            </Link>
          }
        />

        <section aria-labelledby="part-title" className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-6 py-6 sm:px-8">
            <p className="text-2xs font-semibold tracking-wider text-primary-600 uppercase">
              {onSign ? "Finish" : open.data.title}
            </p>
            <h2 id="part-title" className="mt-1.5 text-2xl leading-tight font-bold text-balance">
              {current.label}
            </h2>
            {onSign && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Read the declaration through, then make it in your own name.
              </p>
            )}
            {part && theirs.has(part.id) && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                This part is your manager's to complete. It is here so you can see what the form asks of them.
              </p>
            )}
          </div>

          <div key={current.id} className="space-y-5 px-6 py-6 sm:px-8">
            {onSign ? (
              <SignOff
                lines={signingLines[kind]!}
                answers={answers}
                disabled={signed}
                say={say}
                signed={signed}
                busy={sign.isPending}
                onSign={submit}
              />
            ) : (
              part?.blocks.map((which) => {
                const block = wording.blocks[which];
                return block ? (
                  <Block key={which} block={block} at={which} label={part.label} filling={filling} />
                ) : null;
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
            <Button variant="ghost" disabled={index === 0} onClick={() => goTo(steps[index - 1])}>
              <ChevronLeft aria-hidden="true" />
              Back
            </Button>
            {index < steps.length - 1 && (
              <Button variant="secondary" onClick={() => goTo(steps[index + 1])}>
                Continue
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function filled(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

/** Every answer a part asks for: a box it draws, and a blank it rules. */
function whatItAsks(part: DeclarationPart, blocks: WordingBlock[], filling: Filling): string[] {
  const asked = new Set<string>();
  for (const which of part.blocks) {
    const block = blocks[which];
    if (!block) continue;
    if (block.kind === "TABLE") {
      block.rows.forEach((row, at) => {
        if (filling.carried.has(`${which}.${at}`)) return;
        const blank = filling.blanks[`${which}.${at}`];
        if (blank) asked.add(blank.id);
        row.forEach((cell, side) => {
          const from = filling.startsAt.get(`${which}.${at}.${side}`) ?? 0;
          (cell.match(/[☐☒]/g) ?? []).forEach((_box, step) => {
            const box = filling.boxes[from + step];
            if (box) asked.add(box.id);
          });
        });
      });
      continue;
    }
    if (filling.carried.has(String(which))) continue;
    const from = filling.startsAt.get(String(which)) ?? 0;
    const count = block.kind === "CHECKBOX" ? 1 : (block.text.match(/[☐☒]/g) ?? []).length;
    for (let step = 0; step < count; step += 1) {
      const box = filling.boxes[from + step];
      if (box) asked.add(box.id);
    }
  }
  return [...asked];
}

function BackLink() {
  return (
    <Link
      to="/my-declarations"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-primary-700"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      My declarations
    </Link>
  );
}

function fillIn(text: string, printed: Record<string, string>) {
  return text.replace(/\{\{(\w+)(\^?)}}/g, (whole, key: string, shouted: string) => {
    const said = printed[key];
    if (!said) return whole;
    return shouted ? said.toUpperCase() : said;
  });
}

/** One of the document's blocks, set out as what it is: a heading, a line to read, a note, or a table. */
function Block({
  block,
  at,
  label,
  filling,
}: {
  block: WordingBlock;
  at: number;
  label: string;
  filling: Filling;
}) {
  if (block.kind === "TABLE") return <Panel block={block} at={at} label={label} filling={filling} />;

  const said = fillIn(block.text, filling.printed);
  if (filling.carried.has(String(at))) return null;
  if (block.kind === "CHECKBOX") {
    return <Boxes text={`☐ ${said}`} from={filling.startsAt.get(String(at)) ?? 0} filling={filling} />;
  }
  if (!said.trim()) return null;
  if (said === label) return null;
  if (block.kind === "HEADING") return <h3 className="text-base font-bold text-ink">{said}</h3>;
  if (/[☐☒]/.test(said)) {
    return <Boxes text={said} from={filling.startsAt.get(String(at)) ?? 0} filling={filling} />;
  }
  return <Prose text={block.number ? `${block.number} ${said}` : said} className={block.strong ? "font-semibold text-ink" : "text-ink-soft"} />;
}

/**
 * A table the document draws. Where it really is a table — a heading row over rows of the same thing — it is
 * set out as one. Most of them are not: they are the paper's way of boxing a section off, so they are set out
 * as what they hold, a line at a time.
 */
function Panel({
  block,
  at,
  label,
  filling,
}: {
  block: WordingBlock;
  at: number;
  label: string;
  filling: Filling;
}) {
  const rows = block.rows
    .map((row, which) => ({ row, which }))
    .filter(({ which }) => !filling.carried.has(`${at}.${which}`));
  if (rows.length === 0) return null;

  const widest = Math.max(...rows.map(({ row }) => row.filter((cell) => cell.trim()).length));
  const isTable = rows.length >= 3 && rows[0]!.row.filter((cell) => cell.trim()).length === widest && widest > 1;

  if (isTable) {
    const [head, ...body] = rows;
    return (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-canvas">
              {head!.row.map((cell, side) => (
                <th key={side} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-muted">
                  {fillIn(cell, filling.printed)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map(({ row, which }) => (
              <tr key={which} className="border-t border-line align-top">
                {row.map((cell, side) => (
                  <td
                    key={side}
                    className={cn(
                      "px-4 py-3 leading-relaxed",
                      side === 0 ? "font-semibold whitespace-nowrap text-ink" : "text-ink-soft",
                      /[☐☒]/.test(cell) && "text-center",
                    )}
                  >
                    <Cell cell={cell} where={`${at}.${which}.${side}`} filling={filling} bare />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map(({ row, which }) => {
        const blank = filling.blanks[`${at}.${which}`];
        const said = row.map((cell) => cell.trim()).filter(Boolean);
        // A row of one short line that stops is the paper heading the lines under it.
        const heads = said.length === 1 && namesAPart(said[0]!) && !/[☐☒]/.test(said[0]!);
        if (heads && said[0] === label) return blank ? <BlankLine key={which} blank={blank} filling={filling} /> : null;
        return (
          <div key={which} className={cn(heads ? "" : "space-y-2")}>
            {heads ? (
              <h3 className="text-sm font-bold text-ink">{fillIn(said[0]!, filling.printed)}</h3>
            ) : (
              row.map((cell, side) =>
                cell.trim() ? (
                  <div key={side} className={cn(side === 0 && row.length > 1 && "text-sm font-semibold text-ink")}>
                    <Cell cell={cell} where={`${at}.${which}.${side}`} filling={filling} />
                  </div>
                ) : null,
              )
            )}
            {blank && <BlankLine blank={blank} filling={filling} />}
          </div>
        );
      })}
    </div>
  );
}

/** What one cell of the document says: its words, and the boxes it draws on them. */
function Cell({ cell, where, filling, bare }: { cell: string; where: string; filling: Filling; bare?: boolean }) {
  const said = fillIn(cell, filling.printed);
  if (!/[☐☒]/.test(said)) return <Prose text={said} />;
  return <Boxes text={said} from={filling.startsAt.get(where) ?? 0} filling={filling} bare={bare} />;
}

/**
 * The boxes a line draws, as boxes to pick from. The paper writes what a box stands for on either side of it:
 * after it, as "☐ Within 1 month", or before it, as the "YES☐ NO☐" a question is answered with. Which it is
 * the line itself says — where nothing follows the last box on a line, the words come before them.
 */
function readTheLine(line: string) {
  const pieces = line.split(/[☐☒]/);
  if (pieces.length === 1) return { lead: line, boxes: [] as string[] };
  const labelled = pieces[pieces.length - 1]!.trim() === "" ? "before" : "after";
  const boxes =
    labelled === "before"
      ? pieces.slice(0, -1).map((piece) => piece.trim())
      : pieces.slice(1).map((piece) => piece.trim());
  return { lead: labelled === "before" ? "" : pieces[0]!.trim(), boxes };
}

function Boxes({ text, from, filling, bare }: { text: string; from: number; filling: Filling; bare?: boolean }) {
  // Read down the line as the paper sets it: a line of its own above a box is what that box is called.
  const runs: { caption: string; lead: string; boxes: string[]; from: number }[] = [];
  const trailing: string[] = [];
  let caption = "";
  let counted = from;
  for (const line of text.split("\n")) {
    const { lead, boxes } = readTheLine(line);
    if (boxes.length === 0) {
      if (caption) trailing.push(caption);
      caption = line.trim();
      continue;
    }
    runs.push({ caption, lead, boxes, from: counted });
    counted += boxes.length;
    caption = "";
  }
  if (caption) trailing.push(caption);

  // A short run of boxes answering one question — a YES and a NO — belongs on one line, whether or not the
  // paper had the room to print it on one. Where it broke the line, the run is put back together.
  const together: typeof runs = [];
  for (const run of runs) {
    const last = together[together.length - 1];
    const short = (one: (typeof runs)[number]) => one.boxes.every((label) => label.length <= 4);
    if (last && !run.caption && !run.lead && short(last) && short(run) && last.from + last.boxes.length === run.from) {
      last.boxes.push(...run.boxes);
      continue;
    }
    together.push(run);
  }

  return (
    <div className="space-y-3">
      {together.map((run) => (
        <div key={run.from} className="space-y-2">
          {run.caption && <p className="text-sm font-semibold text-ink">{run.caption}</p>}
          {run.lead && <Prose text={run.lead} />}
          <Run boxes={run.boxes} from={run.from} filling={filling} bare={bare} />
        </div>
      ))}
      {trailing.map((line, at) => (
        <Prose key={at} text={line} />
      ))}
    </div>
  );
}

/** One line's worth of boxes. A short run of them — a YES and a NO — sits along the line, as the paper sets it. */
function Run({ boxes, from, filling, bare }: { boxes: string[]; from: number; filling: Filling; bare?: boolean }) {
  const alongTheLine = boxes.every((label) => label.length <= 4);
  return (
    <div className={cn(alongTheLine ? "flex flex-wrap gap-2" : "space-y-2", bare && "justify-center")}>
      {boxes.map((label, step) => {
        const box = filling.boxes[from + step];
        const id = `${from + step}`;
        if (!box) {
          // A box that is not the employee's to tick: the paper draws it, so it is drawn.
          return (
            <div key={id} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] border border-line bg-slate-50"
              />
              {label && (
                <span className="flex-1">
                  <Written text={label} />
                </span>
              )}
            </div>
          );
        }
        const wanted = "yes" in box ? box.yes : box.value;
        const ticked = read(filling.answers, box.id) === wanted;
        if (!label) {
          // A box the paper draws on its own, in a column of a table. The whole cell picks it, not the circle.
          return (
            <label
              key={id}
              className={cn(
                "-m-3 flex items-center justify-center p-3",
                filling.disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <span className="sr-only">{"yes" in box ? (box.yes ? "Yes" : "No") : String(wanted)}</span>
              <input
                type="radio"
                name={box.id}
                checked={ticked}
                disabled={filling.disabled}
                onChange={() => filling.say(box.id, wanted)}
                className="size-4 accent-primary-600"
              />
            </label>
          );
        }
        return (
          <Tick
            key={id}
            kind="radio"
            name={box.id}
            id={`${box.id}.${id}`}
            checked={ticked}
            disabled={filling.disabled}
            onChange={() => filling.say(box.id, wanted)}
            text={label}
          >
            {"then" in box && box.then && ticked ? (
              <div className="border-t border-line px-3.5 py-3">
                <BlankLine blank={box.then} filling={filling} />
              </div>
            ) : null}
          </Tick>
        );
      })}
    </div>
  );
}

/** A blank the paper rules, made a field to write in. */
function BlankLine({ blank, filling }: { blank: Blank; filling: Filling }) {
  const value = String(read(filling.answers, blank.id) ?? "");
  const change = (said: string) => filling.say(blank.id, said);
  if (blank.kind === "long") {
    return (
      <TextArea
        id={blank.id}
        aria-label="Your answer"
        rows={4}
        value={value}
        disabled={filling.disabled}
        onChange={(event) => change(event.target.value)}
      />
    );
  }
  return (
    <TextInput
      id={blank.id}
      aria-label="Your answer"
      value={value}
      disabled={filling.disabled}
      onChange={(event) => change(event.target.value)}
    />
  );
}

/** The lines the document signs off with, in its own words. */
function SignOff({
  lines,
  answers,
  disabled,
  say,
  signed,
  busy,
  onSign,
}: {
  lines: { name: string; signature: string; date: string; position?: string };
  answers: Answers;
  disabled: boolean;
  say: (path: string, value: unknown) => void;
  signed: boolean;
  busy: boolean;
  onSign: () => void;
}) {
  return (
    <div className="space-y-6">
      <label
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4 transition-colors",
          answers["agreed"] ? "border-primary-600 bg-primary-50/70" : "border-line bg-white hover:border-primary-100",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded-[3px] accent-primary-600"
          checked={Boolean(answers["agreed"])}
          disabled={disabled}
          onChange={(event) => say("agreed", event.target.checked)}
        />
        <span className="text-sm leading-relaxed text-ink">{AGREED}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label={lines.name} required>
          <TextInput
            id="name"
            value={String(answers["name"] ?? "")}
            disabled={disabled}
            onChange={(event) => say("name", event.target.value)}
          />
        </Field>
        {lines.position && (
          <Field id="position" label={lines.position} required>
            <TextInput
              id="position"
              value={String(answers["position"] ?? "")}
              disabled={disabled}
              onChange={(event) => say("position", event.target.value)}
            />
          </Field>
        )}
        <Field id="signature" label={lines.signature} required>
          <TextInput
            id="signature"
            placeholder="Type your full name"
            value={String(answers["signature"] ?? "")}
            disabled={disabled}
            onChange={(event) => say("signature", event.target.value)}
          />
        </Field>
        <Field id="signedOn" label={lines.date} required>
          <DateInput
            id="signedOn"
            name="signedOn"
            value={String(answers["signedOn"] ?? "")}
            min={yearsFromToday(-1)}
            max={yearsFromToday(0)}
            required
            disabled={disabled}
            onChange={(chosen) => say("signedOn", chosen)}
          />
        </Field>
      </div>

      {!signed && (
        <div className="flex justify-end">
          <Button onClick={onSign} disabled={busy}>
            {busy ? "Signing…" : "Sign this declaration"}
          </Button>
        </div>
      )}
    </div>
  );
}
