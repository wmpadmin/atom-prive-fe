import { ApiError } from "@atomprive/api-client";
import {
  getGetClientPortfolioQueryKey,
  getListClientHoldingsQueryKey,
  useChangeClientHolding,
  useListClientHoldings,
  useRecordClientHolding,
  useRemoveClientHolding,
  useSetClassTolerance,
  type ModelLine,
  type ClassPositions,
  type SubClassGroup,
  type ClientHoldings,
  type PositionRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextInput, cn, describedBy } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { useShowFirstError } from "../../lib/show-first-error";
import { asFigure } from "../../lib/figures";
import { useAssetClasses } from "./asset-classes";
import {
  anchorFor,
  driftLabel,
  standingLabels,
  standingTones,
  underManagementLabel,
} from "./portfolio-labels";

/**
 * How far one client's asset class may wander, where the firm wants it held to something other than the
 * model's own figures.
 *
 * <p>Its own small dialog rather than three more boxes on a row already carrying a figure and two buttons:
 * it is a decision somebody takes once and rarely, not a thing to be typed past on the way to something
 * else.
 */
function ToleranceDialog({
  customerId,
  one,
  onClose,
  onSaved,
  onTouched,
  onClassTouched,
}: {
  customerId: string;
  one: ClassPositions;
  onClose: () => void;
  onSaved: () => void;
  /** Each sub-asset whose own figures this is about to clear, as it stood, so Discard can put them back. */
  onTouched?: (id: string, before: PositionRow | null) => void;
  /** What the class was held to beforehand — its own figures, or nothing where it followed the model. */
  onClassTouched?: (assetClass: string, before: { watchPp: number; edgePp: number; breachPp: number } | null)
    => void;
}) {
  // Filled in with what this class is held to today, whether that is this client's own figures or the
  // model's. Shown rather than left empty behind placeholders: typing over one of three empty boxes saved
  // none of them, because a tolerance is three figures or none.
  const stands = (figure: number | null | undefined) => (figure == null ? "" : String(figure));
  const [watchPp, setWatchPp] = useState(stands(one.watchAt));
  const [edgePp, setEdgePp] = useState(stands(one.edgeAt));
  const [breachPp, setBreachPp] = useState(stands(one.breachAt));
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const given = [watchPp, edgePp, breachPp].filter((each) => each.trim() !== "").length;
  // Watched, then the edge, then breached: none of them nearer than the one before. Equal is allowed, and
  // is how the firm writes a band now — one figure in all three, which leaves the single verdict it asked
  // for and nothing in between.
  const outOfOrder = given === 3
    && !(Number(watchPp) <= Number(edgePp) && Number(edgePp) <= Number(breachPp));
  const set = useSetClassTolerance<ApiError>({
    mutation: { onError: (failed) => setErrors(toFormErrors(failed)) },
  });
  const change = useChangeClientHolding<ApiError>({
    mutation: { onError: (failed) => setErrors(toFormErrors(failed)) },
  });
  // Sub-assets inside this class that somebody has given figures of their own. They beat whatever is set
  // here, so setting this and watching nothing change was the obvious thing to do and the wrong one.
  const exceptions = one.subClasses
    .flatMap((group) => group.positions)
    .filter((row) => row.watchPp != null || row.edgePp != null || row.breachPp != null);
  const name = one.assetClassName || one.assetClass;
  const busy = set.isPending || change.isPending;
  return (
    <Dialog open title={`How far ${name} may wander`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setErrors(noErrors);
          try {
            // What the class stood on before this, so Discard can put the class itself back and not only
            // the sub-assets underneath it.
            onClassTouched?.(one.assetClass, one.ownTolerance && one.watchAt != null && one.edgeAt != null
              && one.breachAt != null
              ? { watchPp: one.watchAt, edgePp: one.edgeAt, breachPp: one.breachAt }
              : null);
            await set.mutateAsync({
              customerId,
              assetClass: one.assetClass,
              // All three or none. Sent empty, the class goes back on the model's own figures.
              data: given === 3
                ? { watchPp: Number(watchPp), edgePp: Number(edgePp), breachPp: Number(breachPp) }
                : { watchPp: null, edgePp: null, breachPp: null },
            });
            // A figure set here is what the whole class is held to, so the sub-assets holding figures of
            // their own are put back on it. Left standing, they went on being measured by something nobody
            // could see from this screen.
            //
            // Each one is handed to the page as it stood before its figures went, row by row: these are
            // numbers somebody typed on purpose, and Discard said it would put them back while knowing
            // nothing about them at all.
            for (const row of exceptions) {
              await change.mutateAsync({
                customerId,
                id: row.id,
                data: { ...sameBut(row, row.valueAmount), watchPp: null, edgePp: null, breachPp: null },
              });
              onTouched?.(row.id, row);
            }
            onSaved();
          } catch {
            // The error is already on the screen, put there by whichever call failed.
          }
        }}
      >
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        <p className="text-xs text-ink-muted">
          {one.ownTolerance
            ? "Held to its own figures, not the model's. Clear all three to go back to the model."
            : one.watchAt != null
              ? `Held to the model's ${one.watchAt} / ${one.edgeAt} / ${one.breachAt}.`
                + " Change them to hold this client to something of its own."
              : "Held to the model's own figures."}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="class-watch" label="Watched from" error={errors.fields.watchPp}>
            <TextInput
              {...describedBy("class-watch", errors.fields.watchPp)}
              id="class-watch"
              inputMode="decimal"
              className="text-right"
              value={watchPp}
              onChange={(event) => setWatchPp(asFigure(event.target.value, watchPp))}
            />
          </Field>
          <Field id="class-edge" label="At the edge from" error={errors.fields.edgePp}>
            <TextInput
              {...describedBy("class-edge", errors.fields.edgePp)}
              id="class-edge"
              inputMode="decimal"
              className="text-right"
              value={edgePp}
              onChange={(event) => setEdgePp(asFigure(event.target.value, edgePp))}
            />
          </Field>
          <Field id="class-breach" label="Breached from" error={errors.fields.breachPp}>
            <TextInput
              {...describedBy("class-breach", errors.fields.breachPp)}
              id="class-breach"
              inputMode="decimal"
              className="text-right"
              value={breachPp}
              onChange={(event) => setBreachPp(asFigure(event.target.value, breachPp))}
            />
          </Field>
        </div>
        {given > 0 && given < 3 && (
          <p className="text-xs text-amber-700">
            All three or none. With any of them blank this client is held to the model's figures.
          </p>
        )}
        {outOfOrder && (
          <p className="text-xs text-rose-700">
            None of them can be nearer than the one before: watched, then the edge, then breached. The same
            figure in all three is allowed, and leaves one verdict rather than three.
          </p>
        )}
        {/* Said before it happens, not found out afterwards: these are figures somebody wrote on purpose. */}
        {exceptions.length > 0 && (
          <p className="text-xs text-amber-700">
            {exceptions.length === 1
              ? `${exceptions[0].subClass ?? UNGROUPED} has figures of its own.`
              : `${exceptions.length} sub-assets in ${name} have figures of their own.`}{" "}
            Saving here clears them, so the whole class is measured by these.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={outOfOrder || busy}>
            {busy ? "Saving…" : given === 3 ? "Hold it to these" : "Hold it to the model"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Where the sub-class is left blank, the holdings still need a heading to sit under. */
const UNGROUPED = "Not grouped";

/**
 * An amount of money, exactly, for a figure that somebody is going to act on.
 *
 * <p>Not the short form the columns use: "3.3K into one, 310 into another" does not add up on the page,
 * and a figure rounded to the nearest hundred is the wrong thing to hand to a dealer.
 */
function exactly(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * A figure as the firm's own sheet writes one: grouped, to the penny, with the currency said once above it
 * rather than on every cell of a row seven figures wide.
 */
function figure(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A share, to the hundredth of a point, as the sheet shows it. */
function percent(share: number) {
  return `${share.toFixed(2)}%`;
}

/** How much of what the model asks for is actually there — the column the firm's sheet calls % allocated. */
function filled(targetValue: number, actualValue: number) {
  return targetValue === 0 ? "—" : `${((actualValue / targetValue) * 100).toFixed(2)}%`;
}

/** What to do about a line: a figure to buy, or one to sell, never a bare minus sign. */
function toDo(amount: number) {
  if (amount > 0) return { word: "Buy", figure: figure(amount) };
  if (amount < 0) return { word: "Sell", figure: figure(-amount) };
  return { word: "Hold", figure: figure(0) };
}

/** A sub-asset that can take money, how much it can take before it would breach, and the row it is. */
type Destination = { name: string; room: number; into: PositionRow | null };

/**
 * What a sub-asset can take before it would breach, in money: the distance to the far end of its band.
 *
 * <p>The firm's rule, and a deliberate one. A line asked for 30% of its class and allowed five points may
 * be filled to 35%, and that is the figure offered — not the 30% that would leave it furthest from
 * breaching either way. Filling a line to the end of its band has a cost: it reads clean today and goes
 * over on the first week the market moves, having been put there on purpose. The firm has said it wants
 * the whole of the room counted, so the whole of the room is what is offered.
 *
 * <p>This rule finds nothing where a whole class already holds more than the model asks of it, since then
 * every line in it is over its own band too. That is the honest answer, and the table above the classes
 * is where it is explained: the money has to leave the class, and no shuffle inside can do it.
 *
 * <p>Measured inside the class, which is the frame a sub-asset is judged in: the model asks a sub-asset for
 * a share of its own class and allows it a band around that, so the distance to the end of it is a share of
 * what the class is worth. Worked against the whole portfolio instead, a line in a class holding a tenth of
 * the book came out with ten times the room it had.
 */
function capacityFor(targetShare: number, share: number, band: number, classTotal: number) {
  const room = (classTotal * (targetShare + band - share)) / 100;
  // A whole unit or it is nothing. A share worked out by division lands a hair either side of its figure,
  // so a sub-asset sitting exactly at the end of its band came out with room for a ten-thousandth of a
  // penny and took a row in the table to say USD 0.
  return room < 1 ? 0 : room;
}

/**
 * How much each of the other sub-assets in this class can take, biggest room first.
 *
 * <p>Every sub-asset the model names, not only the ones already written down — a client who holds six of a
 * class's nine lines has three standing empty, and reading only what was on the page said "no sub-asset has
 * room" while the model was asking for money in three of them. The lines nobody has written arrive as
 * groups holding nothing now, so there is one list to read rather than two to stitch together.
 */
function capacityIn(groups: SubClassGroup[], except: SubClassGroup, band: number,
  classTotal: number): Destination[] {
  const places: Destination[] = [];
  for (const one of groups) {
    if (one === except || one.subClass === null) continue;
    const room = capacityFor(one.targetShare ?? 0, one.shareOfClass, band, classTotal);
    if (room > 0) places.push({ name: one.subClass, room, into: one.positions[0] ?? null });
  }
  return places.sort((first, second) => second.room - first.room);
}

/**
 * The split this screen suggests: fill the one with most room first, never past it, until the money is gone.
 *
 * <p>Counted in whole units throughout. Rounding each share on its own while the remainder went on being
 * counted to the penny put the parts a unit above the whole — five rows adding to 18,784 against 18,783 to
 * move, and a notice saying a dollar more had been placed than there was, with nowhere it had gone.
 *
 * <p>Each share is rounded down rather than to the nearest, so a figure in a box is never a shade past what
 * the sub-asset beside it is said to have room for.
 */
function suggest(spare: number, places: Destination[]): Record<string, number> {
  let left = Math.round(spare);
  const split: Record<string, number> = {};
  for (const place of places) {
    const takes = Math.max(0, Math.min(left, Math.floor(place.room)));
    split[place.name] = takes;
    left -= takes;
  }
  return split;
}

/**
 * How much has to come out of a sub-asset holding more than it is allowed, or nothing.
 *
 * <p>Down to the end of its band, which is the least that clears the breach: a line allowed 25% of its
 * class and holding 80% has to shed 55 points of it, not the 60 that would put it back on its target. A
 * line breached the other way, short of its range, has nothing to shed and is left to the sentence beside
 * it saying what it can take.
 */
function overIts(group: SubClassGroup, band: number, classTotal: number): number | null {
  if (group.standing !== "BREACHED" || group.targetShare === null || group.targetShare === undefined) {
    return null;
  }
  const over = (classTotal * (group.shareOfClass - (group.targetShare + band))) / 100;
  return over < 1 ? null : over;
}

/** What somebody typed into one of the boxes, as a figure. A half-typed box is worth nothing, not NaN. */
function typed(value: string | undefined) {
  const figure = Number(value);
  return value === undefined || value.trim() === "" || Number.isNaN(figure) ? 0 : figure;
}

/**
 * A holding as it stands, with a different figure against it.
 *
 * <p>Everything else is carried across untouched — the client's own tolerance above all, which is written
 * on the holding and would be quietly dropped by a request built from nothing.
 */
function sameBut(row: PositionRow, valueAmount: number) {
  return {
    assetClass: row.assetClass,
    subClass: row.subClass,
    name: row.name,
    identifier: row.identifier,
    issuer: row.issuer,
    countryCode: row.countryCode,
    sector: row.sector,
    yieldPercent: row.yieldPercent,
    durationYears: row.durationYears,
    creditRating: row.creditRating,
    valueAmount,
    watchPp: row.watchPp,
    edgePp: row.edgePp,
    breachPp: row.breachPp,
  };
}

/**
 * Where the money coming out of one sub-asset can go, as a table somebody can argue with and act on.
 *
 * <p>Naming the groups and no figures read as permission to put the whole sum into any one of them, and the
 * first group to take more than its own target breached on the way in. So every figure is named — and
 * because the screen cannot know what else is going on, every figure can be typed over, with what that
 * would cost said on the row as it is typed. Reset puts the suggestion back.
 *
 * <p>Move writes it down: the figure comes off this sub-asset and goes on to that one, in one go. Discard
 * above puts both back, because each is handed over as a holding this panel has touched.
 */
function MoveOutPlan({ customerId, assetClass, spare, rows, places, className, currency, readOnly,
  claim, release, asksForNone, onMoved }: {
  customerId: string;
  assetClass: string;
  spare: number;
  /**
   * Every row written down under this sub-asset, not just the first.
   *
   * <p>A sub-asset is one line on the screen and may be several in the ledger. The figure to shed is the
   * whole group's, so taking it out of one row alone asked that row to go below nothing wherever the group
   * held more than one — refused by the API, and the only thing on screen was "that could not be written
   * down".
   */
  rows: PositionRow[];
  places: Destination[];
  className: string;
  currency: string;
  /** Read somewhere other than the portfolio screen's own Edit, where nothing may be written down. */
  readOnly: boolean;
  /** Takes the one turn there is to write, for the whole screen. False where somebody else already has it. */
  claim: () => boolean;
  release: () => void;
  /** Whether the model asks for none of this sub-asset at all, rather than less of it than is held. */
  asksForNone: boolean;
  onMoved: (touched: { id: string; before: PositionRow | null }[]) => void | Promise<void>;
}) {
  const from = rows[0]?.subClass ?? UNGROUPED;
  // Emptied from the fullest first, so the smaller lines are left whole where the whole sum does not need
  // them. Nothing is ever asked to go below nothing.
  const deepest = [...rows].sort((first, second) => second.valueAmount - first.valueAmount);
  const inHand = deepest.reduce((sum, row) => sum + row.valueAmount, 0);
  // The rows as they stood when this panel opened, kept for as long as it stays open — the same rows, in
  // the same order, in the same places on the screen.
  //
  // Sorted afresh on every render, a move re-ordered the table under the hand that had just clicked it.
  // Worse, a sub-asset filled to the end of its band has no room left and dropped out of the list
  // altogether, so every row beneath it slid up by one. A second press in the same spot then landed on a
  // different sub-asset and moved money into it — three of them a second apart, from somebody pressing
  // one button. A row that can take nothing more stays where it is, saying so, with no button on it.
  const [opened] = useState(() => places);
  const now = new Map(places.map((place) => [place.name, place]));
  const inOrder = [
    ...opened.map((place) => now.get(place.name) ?? { ...place, room: 0 }),
    ...places.filter((place) => !opened.some((was) => was.name === place.name)),
  ];
  const suggested = suggest(spare, inOrder);
  const asSuggested = () => Object.fromEntries(
    inOrder.map((place) => [place.name, String(suggested[place.name])]),
  );
  const [moves, setMoves] = useState<Record<string, string>>(asSuggested);
  const [failed, setFailed] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // What the last click did, and the fact that it was a click rather than typing. A move used to leave
  // every remaining box filled with a fresh split and the buttons back where they were, so it never looked
  // as though anything had happened — and the whole table sat one click away from going out the door.
  const [done, setDone] = useState<{ amount: number; into: string } | null>(null);

  const change = useChangeClientHolding<ApiError>();
  const write = useRecordClientHolding<ApiError>();
  const placed = inOrder.reduce((sum, place) => sum + typed(moves[place.name]), 0);
  const left = spare - placed;
  // What this class could take in all, however it is split up, and so what genuinely cannot stay in it.
  // Money nobody has placed yet is not money with nowhere to go, and saying it has to leave the class
  // while eight sub-assets sit there with room for it is telling somebody the opposite of the truth.
  const canTake = inOrder.reduce((sum, place) => sum + place.room, 0);
  const beyond = spare - canTake;
  // A table of noughts offering to place a twentieth of what has to move is not a plan, it is eight rows
  // of nothing over the one sentence that matters. Said instead.
  const nowhere = canTake < 1 || canTake < spare / 20;
  // Only where there is something to go back to. Money moved is money written down: the sub-asset is worth
  // what it is worth now, these boxes hold the suggestion made against that, and a button offering to put
  // back a suggestion nobody has changed is a button offering to undo the move — which it cannot do.
  const edited = done === null
    && inOrder.some((place) => (moves[place.name] ?? "") !== String(suggested[place.name]));

  // Both sides first, the page afterwards. Telling the page between the two legs had it read the portfolio
  // back half way through the move — money gone from one sub-asset and not yet on the other — and every box
  // on the screen re-filled itself against figures that were true for no more than a moment.
  //
  // The source goes first of the two: if the second leg fails, the money is missing rather than counted
  // twice, which is the half somebody notices.
  // Only the row that has just gone. Emptying the rest made one click look like eight, and took away
  // figures somebody had lined up on purpose — the plan for the other rows is still the plan.
  function settled(place: Destination, amount: number) {
    setMoves((was) => ({ ...was, [place.name]: "0" }));
    setDone({ amount, into: place.name });
  }

  async function move(place: Destination) {
    const amount = typed(moves[place.name]);
    // One turn for the whole screen, taken in the same breath as the click rather than on the render
    // after it. Kept per table, two breached sub-assets could be emptied into the same sibling at once,
    // each working its new figure out from the same row — and one of the two deposits was written off.
    if (!rows.length || amount <= 0 || amount > inHand || !claim()) return;
    setFailed(null);
    setMoving(place.name);
    // What has already come out, and which rows it came out of. What those rows are worth now is a
    // different figure from the one this move started with, and the difference is what somebody has to be
    // told about.
    const taken: { id: string; before: PositionRow }[] = [];
    try {
      let left = amount;
      for (const row of deepest) {
        if (left <= 0) break;
        const takes = Math.min(left, row.valueAmount);
        await change.mutateAsync({
          customerId, id: row.id, data: sameBut(row, row.valueAmount - takes),
        });
        taken.push({ id: row.id, before: row });
        left -= takes;
      }
      if (place.into) {
        await change.mutateAsync({
          customerId, id: place.into.id, data: sameBut(place.into, place.into.valueAmount + amount),
        });
        // Awaited, so this move is not over until the portfolio has been read back. Every figure below is
        // worked out from rows that came with the last read: released the moment the writes returned, a
        // second Move went out against the source as it stood before the first, which wrote off the first
        // move's deduction while its deposit stood — money out of nowhere.
        await onMoved([...taken, { id: place.into.id, before: place.into }]);
        settled(place, amount);
      } else {
        // A sub-asset the model names and nobody has written down yet. Discard puts it back by removing it,
        // which is what a null before means to the page above.
        const made = await write.mutateAsync({
          customerId,
          data: {
            assetClass, subClass: place.name, name: place.name, identifier: null, issuer: null,
            countryCode: null, sector: null, yieldPercent: null, durationYears: null, creditRating: null,
            valueAmount: amount, watchPp: null, edgePp: null, breachPp: null,
          },
        });
        await onMoved([...taken, { id: made.id, before: null }]);
        settled(place, amount);
      }
    } catch (caught) {
      const said = (caught as ApiError)?.message;
      if (taken.length > 0) {
        // Half way: out of one and not into the other. The page is told, because that is a change somebody
        // has to be able to discard — and the row is disarmed, because pressing it again would take the
        // money out a second time.
        await onMoved(taken);
        setMoves((was) => ({ ...was, [place.name]: "0" }));
        setFailed(`${exactly(amount, currency)} came out of ${from} but could not be put into `
          + `${place.name}${said ? `: ${said}` : "."} Discard puts it back.`);
      } else {
        setFailed(said ?? "That could not be written down. Nothing has moved.");
      }
    } finally {
      release();
      setMoving(null);
    }
  }

  return (
    <div>
      <div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* What is above the window says where the money can go. What is said here is the thing that
                heading cannot: that a sub-asset the model asks nothing of is not one holding too much of
                something, but one holding something the model does not want at all — which no amount of
                shuffling inside the class can answer. */}
            <div className="max-w-xl">
              {asksForNone && (
                <p className="text-sm text-ink-soft">
                  The model asks for none of {from}, so all {exactly(spare, currency)} has to go.
                </p>
              )}
            </div>
            {edited && !readOnly && (
              <Button variant="secondary" size="sm" onClick={() => setMoves(asSuggested())}>
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Reset to suggestion
              </Button>
            )}
          </div>

          {failed && <div className="mt-4"><Alert tone="danger">{failed}</Alert></div>}
          {nowhere ? (
            <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-ink">
              {canTake < 1
                ? `No other sub-asset in ${className} has room for it, so all `
                  + `${exactly(spare, currency)} has to leave the class.`
                : `${className} has room for only ${exactly(canTake, currency)} of it, so the other `
                  + `${exactly(spare - canTake, currency)} has to leave the class.`}
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-ink/20 bg-white">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Where the money coming out of {from} can go.</caption>
                <thead>
                  <tr className="border-b border-ink/15 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th scope="col" className="px-5 py-3">
                      Sub-asset
                    </th>
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">
                      Has room for
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Move
                    </th>
                    <th scope="col" className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {inOrder.map((place) => {
                    const past = typed(moves[place.name]) - place.room;
                    const amount = typed(moves[place.name]);
                    return (
                      <tr key={place.name} className="border-b border-ink/15 last:border-0 align-top">
                        <th scope="row" className="px-5 py-4 text-left font-medium text-ink">
                          {place.name}
                          {/* Said plainly: this one does not exist yet, and moving into it writes it down
                              for the first time. Its whole target is free, which is why it is usually at
                              the top of this list. */}
                          {!place.into && (
                            <span className="mt-1 block text-xs font-normal text-ink-muted">
                              nothing held here yet
                            </span>
                          )}
                          {/* Half a unit, not nought: room worked out in points of a class lands a hair
                              above the figure in the box beside it, and "USD 0 more than it may hold" is a
                              warning about nothing. */}
                          {past > 0.5 && (
                            <span className="mt-1 block text-xs font-normal text-amber-700">
                              {exactly(past, currency)} past the most it may hold
                            </span>
                          )}
                        </th>
                        <td className="px-5 py-4 text-right tabular-nums whitespace-nowrap text-ink-muted">
                          {exactly(place.room, currency)}
                        </td>
                        {/* Off the portfolio screen there is no Edit, and so no Discard to undo a move
                            with. What it would put there is still worth reading, so it is read rather than
                            typed. */}
                        <td className="px-5 py-4 text-right">
                          {readOnly ? (
                            <span className="tabular-nums text-ink-muted">
                              {exactly(typed(moves[place.name]), currency)}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-2">
                              <span className="text-xs text-ink-muted">{currency}</span>
                              <TextInput
                                inputMode="decimal"
                                aria-label={`Move into ${place.name}`}
                                value={moves[place.name] ?? "0"}
                                onChange={(event) => {
                                  setDone(null);
                                  setMoves((was) => ({
                                    ...was,
                                    [place.name]: asFigure(event.target.value, was[place.name] ?? "0"),
                                  }));
                                }}
                                className="h-9 w-32 text-right tabular-nums"
                              />
                            </span>
                          )}
                        </td>
                        {/* No button on a row nothing is going to. A line of greyed-out "Move USD 0"
                            down the table reads as six things that cannot be done, when it is really
                            six boxes waiting for a figure. */}
                        <td className="px-5 py-4 text-right">
                          {amount > 0 && !readOnly && (
                            /* The figure is in the box beside it, so the button does not carry it too:
                               a column of buttons each a different width, because each named a different
                               amount, read as a column of different buttons. The amount still goes to
                               anybody reading the page aloud. */
                            <Button
                              size="sm"
                              className="w-20 justify-center"
                              aria-label={`Move ${exactly(amount, currency)} into ${place.name}`}
                              disabled={!rows.length || moving !== null}
                              onClick={() => move(place)}
                            >
                              {moving === place.name ? "Moving…" : "Move"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Under the table, never above it: put over the rows, the notice pushed every one of them down
              the instant a move landed, which moves the next button under a finger that has not moved. */}
          {done && (
            <div className="mt-4">
              <Alert tone="success">
                <p className="font-semibold">
                  Moved {exactly(done.amount, currency)} into {done.into}.
                </p>
                <p className="mt-1 text-sm">Nothing else moved.</p>
              </Alert>
            </div>
          )}

          {/* A minus sign in a money column is a figure somebody has to stop and decode. This says which way
              it has gone instead, and the figure stays a plain amount. */}
          {!nowhere && (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
              <span className="text-sm font-semibold text-ink">
                {left < -0.5 ? "Placed more than there is" : "Still to place"}
              </span>
              <span className={cn("text-sm font-semibold tabular-nums",
                left < -0.5 ? "text-amber-700" : "text-ink")}>
                {exactly(Math.abs(left), currency)}
              </span>
              <span className="text-xs text-ink-muted">
                {left > 0.5 && (beyond > 0.5
                  ? `${exactly(beyond, currency)} of it has nowhere to go inside ${className} and has to`
                    + " leave the class"
                  : `${className} has room for it — it has not been put anywhere yet`)}
                {left < -0.5 && `more than is coming out of ${from}`}
                {Math.abs(left) <= 0.5 && "all of it placed"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The row that puts the box back, for a group the model does not name. Never a group's own name. */
const OTHER_GROUP = "\u0000other";

/**
 * What a client actually holds: asset class, then sub-class, then the holdings themselves — the three levels
 * the firm's own review opens downward through.
 *
 * <p>A class written down this way takes its total from its lines, so the figure and the holdings can never
 * disagree. A class nobody has broken down keeps the single figure somebody typed, and says so.
 */
export function ClientHoldingsPanel({
  customerId,
  onChanged,
  onTouched,
  onClassTouched,
  offer,
  reveal = null,
  against = null,
  readOnly = false,
}: {
  customerId: string;
  onChanged: () => void;
  /**
   * A holding this panel has just touched, with what it looked like beforehand — null where it did not
   * exist, because it was being added.
   *
   * <p>The page keeps the first of these per holding, so Discard can put the portfolio back as it stood
   * when Edit was pressed, however the change was made.
   */
  onTouched?: (id: string, before: PositionRow | null) => void;
  /**
   * A class whose own tolerance is about to be written over, with what it was held to beforehand — its own
   * three figures, or null where it was following the model.
   *
   * <p>A tolerance is not a holding, so it has no row for Discard to put back. The page keeps it instead.
   */
  onClassTouched?: (assetClass: string, before: { watchPp: number; edgePp: number; breachPp: number } | null)
    => void;
  /**
   * Every class to list, in the firm's own order, so a class holding nothing still has a row to start it
   * in. Without it the list can only show what is already there, and a client holding nothing shows nothing.
   */
  offer?: string[];
  /**
   * A class somebody has asked to see the inside of, from the table that measures it. It opens whether or
   * not it had been shut: being sent to a class and finding it closed is being sent nowhere.
   */
  reveal?: string | null;
  /** A model picked on screen but not saved, whose groups these holdings should be offered against. */
  against?: string | null;
  /** Read somewhere other than the portfolio screen, where writing them down is not the job. */
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  // Read against the model picked on screen where one is, rather than the one on file: somebody setting a
  // client up picks the model and then writes the holdings into its groups, and the groups have to be the
  // ones they are looking at.
  const held = useListClientHoldings<ClientHoldings, ApiError>(
    customerId,
    against ? { against } : undefined,
  );
  // What has been shut, rather than what has been opened: a class is open until somebody closes it. Kept
  // this way round because the classes arrive after the first render, and a set of what is open would have
  // to be filled in from them by an effect that renders twice to say what the list already said.
  const [shut, setShut] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PositionRow | "new" | null>(null);
  /** The class a new holding opens on, where this panel's own button was the one pressed. */
  const [newFor, setNewFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PositionRow | null>(null);
  /** The class whose tolerance is being set, where somebody asked to change what it may wander. */
  const [tolerating, setTolerating] = useState<ClassPositions | null>(null);

  const open = editing;
  const startOn = editing === "new" ? newFor : null;
  const closeDialog = () => {
    setEditing(null);
    setNewFor(null);
  };

  // Settles once the portfolio has actually been read back, so a caller that must not act on yesterday's
  // figures can wait for it. Fired and forgotten, this let a second Move go out against the rows the first
  // one had already written over.
  // One move at a time across the whole screen. A ref rather than state, because a click reads it in the
  // same tick and state arrives a render later: two clicks together would both find the door open. There
  // used to be a flag beside it for the buttons to grey out on, back when several plans could be on screen
  // at once; one plan opens at a time now, and its own buttons already know while it is writing.
  const moveUnderway = useRef(false);
  /**
   * Whose plan is open, by name rather than by the row itself.
   *
   * <p>Held as the object, a move would leave the dialog reading figures from before it: the panel builds
   * fresh rows out of what the API answers, and the one this was pointing at is gone by then. Named, it
   * finds the new row each render and the dialog keeps up with what it has just done.
   */
  const [planning, setPlanning] = useState<{ assetClass: string; subClass: string | null } | null>(null);
  const claimTheMove = () => {
    if (moveUnderway.current) return false;
    moveUnderway.current = true;
    return true;
  };
  const releaseTheMove = () => {
    moveUnderway.current = false;
  };

  const kept = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListClientHoldingsQueryKey(customerId) }),
      queryClient.invalidateQueries({ queryKey: getGetClientPortfolioQueryKey(customerId) }),
    ]);
    onChanged();
  };
  // No hook-level onSuccess: what the row was before it went has to be held from the moment Remove is
  // pressed, not read back out of state afterwards. The dialog can be shut while the write is in flight —
  // its X and Escape are not disabled, only Cancel is — and a callback reading `removing` then reads null,
  // writes nothing down, and leaves a deletion Discard has never heard of.
  const remove = useRemoveClientHolding<ApiError>();

  // The firm's own names for the classes, read before anything returns: a hook skipped on the way out of
  // an early return is a hook React counts as missing on the render after it.
  const catalogue = useAssetClasses();

  // A client with nothing written down yet is an ordinary state, not a failure. Shown as one, it put a
  // red banner across the portfolio page of every client whose holdings nobody had typed in.
  if (held.isError && held.error.status !== 404) {
    return <Alert tone="danger">{held.error.message}</Alert>;
  }

  const written = held.data?.classes ?? [];
  const currency = held.data?.currency ?? "USD";
  // What every share and every target value below is out of. The sheet the firm reads sets a line's target
  // against the whole portfolio, not against the money its class happens to hold.
  const whole = held.data?.underManagement ?? 0;
  // Every class the page offers gets a row, whether or not anything is in it: a class holding nothing is
  // exactly the one somebody is about to write the first figure into, and a list of only what is already
  // there has nowhere to put it. Where no list is handed in, the panel shows what is written and no more.
  const classes: ClassPositions[] = offer
    ? [
        ...offer.map(
          (code) =>
            written.find((one) => one.assetClass === code) ?? {
              assetClass: code,
              assetClassName: catalogue.names[code] ?? code,
              valueAmount: 0,
              heldAsPositions: false,
              // Nothing is held and nothing has been read, so there is nothing to say about where it stands.
              targetShare: null,
              shareOfPortfolio: null,
              drift: null,
              standing: null,
              suggestion: null,
              watchAt: null,
              edgeAt: null,
              breachAt: null,
              ownTolerance: false,
              subClasses: [],
            },
        ),
        ...written.filter((one) => !offer.includes(one.assetClass)),
      ]
    : written;
  const toggle = (key: string) =>
    setShut((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="space-y-3">
      {/* The words take the width they need and no more, so the button keeps its place at the right of the
          row. Left to fill the line, they pushed it onto one of its own, where it began at the left margin
          under the text rather than beside it. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* No heading of its own: the panel above already says what this is, and a second word for the
              same thing between the two read as a different section starting. */}
          <p className="text-xs text-ink-muted">
            Asset class, then the sub-assets inside it. A class written down here takes its total from them.
          </p>
          {/* Written down one at a time and kept the moment each is confirmed, so Discard has to take them
              back off rather than simply forget them. It asks first, and names how many. */}
          {!readOnly && (
            <p className="mt-1 text-xs text-ink-muted">
              A sub-asset is written down the moment you confirm it, not when you press Save. Discard above puts
              these back as they stood when you pressed Edit, and asks first.
            </p>
          )}
        </div>
        {!readOnly && (
          <div className="ml-auto shrink-0">
            <Button variant="secondary" onClick={() => setEditing("new")}>
              <Plus aria-hidden="true" />
              Add a sub-asset
            </Button>
          </div>
        )}
      </div>

      {held.data && held.data.unplaced > 0 && (
        <Alert tone="info">
          {underManagementLabel(held.data.unplaced, currency)} sits in classes nobody has broken down yet —
          a single figure each, with no sub-assets under them.
        </Alert>
      )}

      {held.isPending ? (
        <p className="py-6 text-center text-sm text-ink-muted">Reading what the client holds…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-ink-muted">
          Nothing is written down yet.
        </p>
      ) : (
        /* A card each, rather than one unbroken list. Run together, the holdings of one class sat directly
           above the next class's own row with nothing but a hairline between them, so where one class ended
           and the next began had to be worked out from the indent. */
        <ul className="space-y-3">
          {classes.map((one) => {
            const classKey = one.assetClass;
            const isOpen = one.heldAsPositions && (!shut.has(classKey) || reveal === classKey);
            // What every line in this class may wander from its target, which is the class's own figure:
            // the model allows a sub-asset the distance it allows the class around it, and the band is in
            // percentage points, so the one number answers for both.
            const band = one.breachAt ?? 0;
            return (
              // Named so the table above can send somebody straight here, and given room above it so the
              // card does not land flush against the top of the window when they arrive.
              <li
                key={classKey}
                id={anchorFor(classKey)}
                className="scroll-mt-20 overflow-hidden rounded-xl border border-ink/20 bg-white"
              >
                {/* One row, in columns: the class, what to do about it, what it is worth, and the way to
                    write something under it. The figures used to be pushed left and right by whatever
                    happened to sit beside them, so no two lined up, and what to do about a class hung
                    underneath it on a line of its own that made every row a different height.

                    The class and the way to write under it are side by side rather than nested: a button
                    inside a button is not a thing a browser will render. */}
                <div className="flex items-center gap-3 px-4 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => one.heldAsPositions && toggle(classKey)}
                    disabled={!one.heldAsPositions}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded text-left",
                      one.heldAsPositions ? "hover:underline" : "cursor-default",
                    )}
                  >
                    {one.heldAsPositions ? (
                      isOpen ? (
                        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                      )
                    ) : (
                      <span aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    <span className="font-semibold">
                      {/* Named by the API from the firm's own list; the code stands in for one it has since taken off. */}
                      {one.assetClassName || one.assetClass}
                    </span>
                    {/* The class's own standing, which is not the standing of the lines inside it: a class
                        can breach while every line inside it sits exactly where the model asks, because it
                        is the class that holds too much. */}
                    {one.standing && one.standing !== "WITHIN_BAND" && (
                      <Badge tone={standingTones[one.standing]}>{standingLabels[one.standing]}</Badge>
                    )}
                    {/* A class written down sub-asset by sub-asset carries their verdict as its own now, so
                        a second badge counting what is wrong inside it said the same thing twice over. */}
                  </button>
                  {/* What to buy or sell, and how far the class has wandered, used to be written here as
                      "SELL USD 350 · +70.0pp from target" — a row of figures with no heading over any of
                      them. The same facts are in the table above this one, under columns that name them. */}
                  <span className="flex-1" />
                  {/* Said in the same word the list above uses for them, and on one line: wrapped onto two
                      it made its own row taller than every other. */}
                  <span className="hidden w-32 shrink-0 text-right text-2xs tracking-wider whitespace-nowrap text-ink-muted uppercase sm:block">
                    {one.heldAsPositions ? "From its lines" : "No lines"}
                  </span>
                  {/* Read, never typed. A class is the sum of the sub-assets written under it, and a figure
                      put straight on the class says a client holds something without saying what — which no
                      drift, no band and no trade can be worked out from. Money goes in through Add. */}
                  <span className="w-32 shrink-0 text-right">
                    <span className="tabular-nums">{underManagementLabel(one.valueAmount, currency)}</span>
                  </span>
                  {/* What this class may wander, for a client the firm wants held to something other than
                      the model. Changing it on the model moves it for every client on that model. */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setTolerating(one)}
                      aria-label={`How far ${one.assetClassName || one.assetClass} may wander`}
                      title={`How far ${one.assetClassName || one.assetClass} may wander`}
                      className={cn(
                        "shrink-0 rounded-lg border border-line p-1.5 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                        one.ownTolerance ? "text-primary-700" : "text-ink-soft",
                      )}
                    >
                      <SlidersHorizontal aria-hidden="true" className="size-4" />
                    </button>
                  )}
                  {/* Opened on this class, so the sub-classes offered are the ones this client's model names
                      inside it rather than the ones inside whichever class the list happened to start on. */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewFor(classKey);
                        setEditing("new");
                      }}
                      aria-label={`Add a sub-asset to ${one.assetClassName || one.assetClass}`}
                      className="flex w-16 shrink-0 items-center justify-end gap-1 rounded-lg py-1 text-xs font-medium text-primary-700 hover:underline"
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      Add
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="overflow-x-auto border-t border-ink/15 bg-slate-50/40">
                    {/* A table with its columns named. These were six figures and two phrases run together
                        on one line — "USD 56 · 50.0% of the class · 0.0% asked for" — which told somebody
                        who already knew what each number meant what it was, and told everybody else
                        nothing. Named columns say it once at the top instead. */}
                    <table className="min-w-full text-sm">
                      <caption className="sr-only">
                        What {one.assetClassName || one.assetClass} is made of, by sub-asset. Figures in{" "}
                        {currency}.
                      </caption>
                      <thead>
                        <tr className="border-b border-ink/15 text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                          <th scope="col" className="py-3 pr-3 pl-4">
                            Sub-asset
                          </th>
                          {/* The firm's own sheet, column for column, in the firm's own words. Close to
                              the table that measures the classes above, but not word for word: a value
                              column says so here, where up there the figure beside it makes it plain.

                              Every share is of the whole portfolio, which is the only frame in which a
                              target value and an actual value can be set beside each other and subtracted.
                              What the model asks of a line inside its own class — 9% of equities, say — is
                              still what the line is judged against, and it is still what the target below
                              is worked out from; it is simply not a column any more.

                              Gap used to sit where % allocated does. It said the same thing in points that
                              % allocated says as a proportion, and the sheet has never had it. */}
                          <th scope="col" className="px-3 py-2 text-right">
                            Target allocation %
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Target allocation value
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Current allocation %
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Actual allocation value
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            % allocated
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Suggestion
                          </th>
                          {!readOnly && <th scope="col" className="py-2 pr-4 pl-3" />}
                        </tr>
                      </thead>
                      {one.subClasses.map((group) => {
                        // What the model asks of this line as a share of the whole portfolio: its share of
                        // its class carried through the class's own share of the book. Where the model
                        // names no target for either, there is no figure to carry and the row says so.
                        const ofPortfolio = (group.targetShare == null || one.targetShare == null)
                          ? null
                          : (group.targetShare * one.targetShare) / 100;
                        // Against what the class should be worth, not what it is. A line asked for a tenth
                        // of a class that is itself a sixth of the size the model wants is short by the
                        // whole of that shortfall too, and reading it against the money actually in the
                        // class would hide it: it would sit on its target inside a class holding a sixth
                        // of what it should.
                        const targetValue = ofPortfolio == null ? null : (ofPortfolio * whole) / 100;
                        const actualShare = whole === 0 ? null : (group.valueAmount / whole) * 100;
                        const move = targetValue == null ? null : toDo(targetValue - group.valueAmount);
                        // Whether there is a plan to open behind this row's suggestion: a line holding more
                        // than its band allows has money that has to go somewhere, and where it can go is
                        // the question this opens.
                        const toShed = overIts(group, band, one.valueAmount);
                        const openThePlan = () => setPlanning({
                          assetClass: one.assetClass,
                          subClass: group.subClass,
                        });
                        return (
                        <tbody key={group.subClass ?? UNGROUPED} className="border-b border-ink/15 last:border-0">
                          {/* Anywhere on the row, not only the figure at the end of it: a reader who has
                              just read across a breached line and decided to deal with it should not have
                              to travel back to one cell to say so. The suggestion stays a button of its
                              own all the same, because a row is not reachable from a keyboard. */}
                          <tr
                            className={cn("align-middle",
                              toShed !== null && "cursor-pointer hover:bg-primary-50/40")}
                            onClick={toShed === null ? undefined : openThePlan}
                          >
                            <th scope="rowgroup" className="py-3.5 pr-3 pl-4 text-left font-semibold text-ink">
                              <span className="flex flex-wrap items-center gap-2">
                                {group.subClass ?? UNGROUPED}
                                {/* A class can sit on its target while the money inside it sits in the
                                    wrong places, because the halves cancel out. This is where that shows. */}
                                {group.standing && group.standing !== "WITHIN_BAND" && (
                                  <Badge tone={standingTones[group.standing]}>
                                    {standingLabels[group.standing]}
                                  </Badge>
                                )}
                              </span>
                            </th>
                            {/* A dash, not a nought: the model naming no target for this group is a
                                different thing from it asking for none of it. */}
                            <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
                              {ofPortfolio == null ? "—" : percent(ofPortfolio)}
                            </td>
                            <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
                              {targetValue == null ? "—" : figure(targetValue)}
                            </td>
                            <td className="px-3 py-3.5 text-right tabular-nums">
                              {actualShare == null ? "—" : percent(actualShare)}
                            </td>
                            <td className="px-3 py-3.5 text-right tabular-nums">
                              {figure(group.valueAmount)}
                            </td>
                            <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
                              {targetValue == null ? "—" : filled(targetValue, group.valueAmount)}
                            </td>
                            {/* The way into the plan, on the figure it is about. A table under the row
                                used to carry it, which meant one line at a time — the worst of them — and
                                a reader who wanted to deal with another first had to clear that one before
                                the screen would talk about theirs. Clicking a suggestion opens its own. */}
                            <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
                              {move == null ? "—" : toShed === null ? (
                                <>
                                  <span className="text-2xs font-semibold tracking-wider uppercase">
                                    {move.word}
                                  </span>{" "}
                                  {move.figure}
                                </>
                              ) : (
                                /* Lit, because it is the one figure on the row somebody can act on and it
                                   says so. The row is clickable too — this is also what makes the row
                                   reachable from a keyboard at all, which a tr with an onClick is not. */
                                <button
                                  type="button"
                                  onClick={openThePlan}
                                  className="rounded-lg px-1 font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                                  title={`Where ${exactly(toShed, currency)} out of ${group.subClass ?? UNGROUPED} can go`}
                                >
                                  <span className="text-2xs font-semibold tracking-wider uppercase">
                                    {move.word}
                                  </span>{" "}
                                  {move.figure}
                                </button>
                              )}
                            </td>
                            {/* The sub-asset is the thing written down, so what can be done to it sits on
                                its own row. The buttons used to belong to the instruments underneath. */}
                            {!readOnly && (
                              <td className="py-3.5 pr-4 pl-3">
                                <span className="flex items-center justify-end gap-2">
                                  {/* Their own errands, so they stop the row's. */}
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditing(group.positions[0] ?? null);
                                    }}
                                    disabled={group.positions.length === 0}
                                    aria-label={`Edit ${group.subClass ?? UNGROUPED}`}
                                    title={`Edit ${group.subClass ?? UNGROUPED}`}
                                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                                  >
                                    <Pencil aria-hidden="true" className="size-4" />
                                  </button>
                                  {/* A bare grey glyph reads as decoration. Bordered, it reads as a button. */}
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setRemoving(group.positions[0] ?? null);
                                    }}
                                    disabled={group.positions.length === 0}
                                    aria-label={`Remove ${group.subClass ?? UNGROUPED}`}
                                    title={`Remove ${group.subClass ?? UNGROUPED}`}
                                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                                  >
                                    <Trash2 aria-hidden="true" className="size-4" />
                                  </button>
                                </span>
                              </td>
                            )}
                          </tr>
                        </tbody>
                        );
                      })}
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* The plan for one breached sub-asset, over the screen rather than inside the table that named it.
          Nested, only one could be shown — the worst of them — and a reader who meant to deal with another
          first had to clear that one before the screen would talk about theirs. Any of them opens now, in
          whatever order somebody wants to work. */}
      {planning && (() => {
        const its = classes.find((one) => one.assetClass === planning.assetClass);
        const group = its?.subClasses.find((each) => each.subClass === planning.subClass);
        const band = its?.breachAt ?? 0;
        const toShed = (its && group) ? overIts(group, band, its.valueAmount) : null;
        // Gone, or put right by the move that was just made. Either way there is nothing left to plan.
        if (!its || !group || toShed === null) return null;
        return (
          <Dialog
            open
            size="2xl"
            title={`Where ${exactly(Math.min(toShed, group.valueAmount), currency)} out of `
              + `${group.subClass ?? UNGROUPED} can go`}
            onClose={() => setPlanning(null)}
          >
            <MoveOutPlan
              customerId={customerId}
              spare={Math.min(toShed, group.valueAmount)}
              rows={group.positions}
              assetClass={its.assetClass}
              places={capacityIn(its.subClasses, group, band, its.valueAmount)}
              className={its.assetClassName || its.assetClass}
              currency={currency}
              readOnly={readOnly}
              claim={claimTheMove}
              release={releaseTheMove}
              asksForNone={group.targetShare === 0}
              onMoved={async (touched) => {
                for (const each of touched) onTouched?.(each.id, each.before);
                await kept();
              }}
            />
          </Dialog>
        );
      })()}

      {tolerating && (
        <ToleranceDialog
          customerId={customerId}
          one={tolerating}
          onTouched={onTouched}
          onClassTouched={onClassTouched}
          onClose={() => setTolerating(null)}
          onSaved={() => {
            setTolerating(null);
            void kept();
          }}
        />
      )}

      {open && (
        <HoldingDialog
          customerId={customerId}
          position={open === "new" ? null : open}
          startOn={startOn}
          only={offer}
          modelSubClasses={held.data?.modelSubClasses ?? {}}
          alreadyWritten={Object.fromEntries(
            classes.map((one) => [one.assetClass, one.subClasses.map((group) => group.subClass ?? "")]),
          )}
          classBands={Object.fromEntries(
            classes.map((one) => [
              one.assetClass,
              { watchAt: one.watchAt, edgeAt: one.edgeAt, breachAt: one.breachAt },
            ]),
          )}
          measuredAgainst={held.data?.measuredAgainst ?? null}
          underManagement={held.data?.underManagement ?? 0}
          unwritten={held.data?.unwritten ?? 0}
          currency={currency}
          onClose={closeDialog}
          onSaved={(id, before) => {
            onTouched?.(id, before);
            kept();
            closeDialog();
          }}
        />
      )}

      {removing && (
        /* Named by the sub-asset it is, not by whatever is stored against it. Titled from the stored
           name, these headed themselves with the instrument somebody wrote down before a row was a
           sub-asset at all — "Remove test?" over a row reading Global Equities. */
        <Dialog
          open
          title={`Remove ${removing.subClass ?? UNGROUPED}?`}
          onClose={() => setRemoving(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-ink">
              The class total goes back to what its remaining sub-assets come to. Taking the last one off
              leaves the class at nothing rather than at whatever figure was typed before it was broken down.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRemoving(null)} disabled={remove.isPending}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  // Held here, where it is certainly still the row being removed.
                  const gone = removing;
                  remove.mutate({ customerId, id: gone.id }, {
                    onSuccess: () => {
                      onTouched?.(gone.id, gone);
                      void kept();
                      setRemoving(null);
                    },
                  });
                }}
              >
                {remove.isPending ? "Removing…" : "Remove it"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function HoldingDialog({
  customerId,
  position,
  startOn,
  only,
  modelSubClasses,
  alreadyWritten,
  classBands,
  measuredAgainst,
  unwritten,
  underManagement,
  currency,
  onClose,
  onSaved,
}: {
  customerId: string;
  /** The classes the screen behind this lists, which is what the client's model asks for. */
  only: string[] | undefined;
  /**
   * The sub-assets this client already has written down, by class.
   *
   * <p>A sub-asset is one line of a portfolio. Written down twice it is two rows with one name, each with
   * its own figure and its own tolerance, and nothing can say which of them the model's line is measured
   * against. The one being edited is its own exception.
   */
  alreadyWritten: Record<string, string[]>;
  position: PositionRow | null;
  /** What the client's model calls the lines inside each class, by class. Empty where it names none. */
  modelSubClasses: Record<string, ModelLine[]>;
  /**
   * What each class is allowed to wander. Read where the model names no line to read it from — a class it
   * does not break down, or a sub-asset sitting in no group at all — so the boxes can still say what this
   * client is being held to.
   */
  classBands: Record<string, { watchAt: number | null; edgeAt: number | null; breachAt: number | null }>;
  measuredAgainst: string | null;
  /** What the client holds altogether, so the model's share can be read as money rather than a percentage. */
  underManagement: number;
  /**
   * How much of that nobody has written down yet. Writing a holding places some of it rather than adding
   * to the portfolio, so a figure being typed is read against the same whole as the figures already there.
   */
  unwritten: number;
  currency: string;
  onClose: () => void;
  /** The class to open on, where a new holding was asked for from a particular one. */
  startOn: string | null;
  /** The holding's id, and what it looked like before — null where it did not exist until now. */
  onSaved: (id: string, before: PositionRow | null) => void;
}) {
  const assetClasses = useAssetClasses();
  // A holding already filed under a class keeps it, even one the firm has since retired; a new one starts
  // at the first class still in use rather than at a name compiled in here.
  const [picked, setAssetClass] = useState<string>(position?.assetClass ?? startOn ?? "");
  // The firm's classes arrive after the first render, so seeding the box from them once leaves the state
  // empty while the box on screen shows the first class — and an empty class is what gets submitted. What is
  // shown and what is sent are worked out together instead, so they cannot come apart.
  const assetClass = picked || position?.assetClass || assetClasses.inUse[0]?.code || "";
  const [subClass, setSubClass] = useState(position?.subClass ?? "");
  // A holding already filed under a group the model does not name is edited where it was written, rather
  // than having its group quietly cleared because the list has no row for it.
  const [writingIn, setWritingIn] = useState(
    position?.subClass != null
      && !(modelSubClasses[position.assetClass] ?? []).some((one) => one.name === position.subClass),
  );
  // What the model asks of the group picked. Read after subClass exists, not beside the class above it.
  const asked = (modelSubClasses[assetClass] ?? []).find((one) => one.name === subClass) ?? null;
  const [valueAmount, setValueAmount] = useState(position ? String(position.valueAmount) : "");
  // What this client's own papers allow this sub-asset to wander. Opening a holding fills the boxes with
  // what it is actually held to today — its own figures where somebody wrote them, the model's otherwise —
  // rather than leaving them empty behind grey placeholders. Typing over one of three empty boxes wrote
  // nothing at all, because a tolerance is three figures or none, and the screen said so in small print
  // after the fact. Adding a sub-asset still starts blank: there is no group chosen yet to read a band from.
  const opened = position
    ? ((modelSubClasses[position.assetClass] ?? []).find((one) => one.name === position.subClass)
      ?? classBands[position.assetClass] ?? null)
    : null;
  const standsAt = (own: number | null | undefined, model: number | null | undefined) =>
    own != null ? String(own) : (position && model != null) ? String(model) : "";
  const [watchPp, setWatchPp] = useState(standsAt(position?.watchPp, opened?.watchAt));
  const [edgePp, setEdgePp] = useState(standsAt(position?.edgePp, opened?.edgeAt));
  const [breachPp, setBreachPp] = useState(standsAt(position?.breachPp, opened?.breachAt));
  const ownBand = [watchPp, edgePp, breachPp].filter((one) => one.trim() !== "").length;
  // Watched, then the edge, then breached: each further out than the one before. Two the same way round
  // would make a sub-asset breach before it was ever watched, and the API refuses it — better said here,
  // beside the boxes, than returned as a failure after Save.
  const outOfOrder = ownBand === 3
    && !(Number(watchPp) <= Number(edgePp) && Number(edgePp) <= Number(breachPp));
  // What the model holds this sub-asset to: the line's own tolerance where it names one, and otherwise the
  // class's, which is what a sub-asset in no group at all is measured by.
  const modelBand = asked ?? classBands[assetClass] ?? null;
  // Where the figure being typed would land this group, worked out as it is typed.
  //
  // Out of everything the client has, because that is what every other figure on the screen is out of. Read
  // as a share of its own class instead, this said one thing while the table behind the dialog said another
  // about the very same holding — "14.7% of Equities, breached" against "5.0% of the portfolio, at edge".
  //
  // The whole can grow as the figure is typed. Where the firm has said what the client has in all, writing a
  // holding places money that was already counted and the whole stands; where it has not, the whole is the
  // sum of what is written down and this figure adds to it.
  const typed = Number(valueAmount);
  // What the firm has said this client has in all. The whole never falls below it — but where nobody has
  // said, there is no floor and the whole is simply the sum of what is written down. Read as the whole
  // itself, this floor could never be gone under, so writing a holding down looked like it changed nothing
  // and the figures beside it went on being worked out against a portfolio that no longer existed.
  const declared = unwritten > 0 ? underManagement : 0;
  const wouldBe =
    asked && valueAmount.trim() !== "" && Number.isFinite(typed) && typed >= 0
      ? (() => {
          const written = underManagement - unwritten;
          const writtenThen = written - (position?.valueAmount ?? 0) + typed;
          const wholeThen = Math.max(declared, writtenThen);
          if (wholeThen <= 0) return null;
          const share = (typed / wholeThen) * 100;
          return { share, over: share - asked.shareOfPortfolio };
        })()
      : null;
  /**
   * What the whole portfolio would come to, where writing this figure down would make it smaller.
   *
   * <p>Every share on these screens is out of the whole, and where the firm has not said what the client
   * has in all, the whole is the sum of what is written down. So writing a holding down does not move
   * money, it takes it out of the count — and every other sub-asset's share of a smaller whole is larger.
   * Eight of them sitting a tenth of a point inside their bands went past them at once that way, with
   * nothing on this screen having warned that it would happen.
   */
  const shrinks = (() => {
    if (valueAmount.trim() === "" || !Number.isFinite(typed) || typed < 0) return null;
    const written = underManagement - unwritten;
    const writtenThen = written - (position?.valueAmount ?? 0) + typed;
    const wholeThen = Math.max(declared, writtenThen);
    return wholeThen < underManagement - 0.005 ? { was: underManagement, now: wholeThen } : null;
  })();
  // What this figure would be judged by: this client's own tolerance where all three are typed into the
  // boxes below, and the model's otherwise. Read from the model alone, the dialog went on judging by
  // figures somebody was in the middle of writing over.
  const heldTo: { watchAt: number; edgeAt: number; breachAt: number } | null =
    ownBand === 3
      ? { watchAt: Number(watchPp), edgeAt: Number(edgePp), breachAt: Number(breachPp) }
      : asked;
  const standing =
    wouldBe === null || heldTo === null
      ? null
      : (() => {
          // How far it has wandered, whichever side of the target. Judged only on being over it, a
          // sub-asset far short of what the model asks read as within band in here while the table behind
          // the dialog called the very same figure at edge.
          //
          // Past what is allowed, not level with it, which is the rule the platform is judged by
          // everywhere else: a class at 20 allowed five points may sit at 25, and it is 25.01 that has
          // broken the model. Read as "at least", this dialog called a figure breached while the table
          // behind it, asking the API the same question, called it sound.
          const howFar = Math.abs(wouldBe.over);
          if (howFar > heldTo.breachAt) return "BREACHED";
          if (howFar > heldTo.edgeAt) return "AT_EDGE";
          return howFar > heldTo.watchAt ? "WATCH" : null;
        })();
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  // A refusal takes the reader to it: a short window puts the first fields above the fold.
  useShowFirstError(errors, form);

  const onError = (caught: ApiError) => setErrors(toFormErrors(caught));
  const create = useRecordClientHolding<ApiError>({
    mutation: { onSuccess: (written) => onSaved(written.id, null), onError },
  });
  const change = useChangeClientHolding<ApiError>({
    // The row as it stood when this dialog opened is what Discard would put back.
    mutation: { onSuccess: () => onSaved(position!.id, position!), onError },
  });
  const busy = create.isPending || change.isPending;
  // Letters in a figure box are not a small mistake to round away: nothing is saved until it is a number.
  const readable = valueAmount.trim() !== "" && Number.isFinite(Number(valueAmount)) && Number(valueAmount) >= 0;
  // A name taken off the list can still be written back on by hand, so it is checked as well as hidden.
  const taken = subClass.trim() !== (position?.subClass ?? "")
    && (alreadyWritten[assetClass] ?? []).includes(subClass.trim());
  // Every sub-asset is something. One written down with no name is a figure in a class and nothing more:
  // no target to measure it against, no band, no trade. The ones already recorded that way keep their row.
  const unnamed = subClass.trim() === "" && !(position !== null && position.subClass === null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(noErrors);
    // What is written down is a sub-asset and a figure. The firm does not keep a client's portfolio
    // instrument by instrument, so there is no name, issuer or rating to ask for — the sub-asset is the
    // name, and the model names it.
    const data = {
      assetClass,
      subClass: subClass.trim() || null,
      name: subClass.trim() || (assetClasses.names[assetClass] ?? assetClass),
      identifier: null,
      issuer: null,
      countryCode: null,
      sector: null,
      yieldPercent: null,
      durationYears: null,
      creditRating: null,
      valueAmount: Number(valueAmount),
      // Three or none. The API keeps a tolerance whole for the same reason: two of them say nothing a band
      // can be read from, and the levels nobody filled in would quietly fall back to the model.
      watchPp: ownBand === 3 ? Number(watchPp) : null,
      edgePp: ownBand === 3 ? Number(edgePp) : null,
      breachPp: ownBand === 3 ? Number(breachPp) : null,
    };
    if (position) change.mutate({ customerId, id: position.id, data });
    else create.mutate({ customerId, data });
  }

  return (
    <Dialog
      open
      title={position ? `Edit ${position.subClass ?? UNGROUPED}` : "Add a sub-asset"}
      size="lg"
      onClose={onClose}
    >
      <form ref={form} onSubmit={submit} className="space-y-4">
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        {/* The sub-class carries three lines of explanation under it and the other two boxes carry none, so
            side by side in one row they left a hole under the asset class and the figure stranded on a row
            of its own. A column each instead: the short boxes stacked together, the long note beside them. */}
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <div className="space-y-3">
          <Field id="holding-class" label="Asset class" required error={errors.fields.assetClass}>
            <SelectInput
              id="holding-class"
              value={assetClass}
              // A holding is in one class: moving it is taking it off one and writing it under the other.
              disabled={position !== null}
              onChange={(event) => setAssetClass(event.target.value)}
            >
              {classesOffered(assetClasses, only, position?.assetClass).map((one) => (
                <option key={one} value={one}>
                  {assetClasses.names[one] ?? one}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="holding-value" label="Worth" required error={errors.fields.valueAmount}>
            <TextInput
              {...describedBy("holding-value", errors.fields.valueAmount)}
              id="holding-value"
              inputMode="decimal"
              value={valueAmount}
              onChange={(event) => setValueAmount(event.target.value)}
            />
          </Field>
          </div>
          {/* The groups the model names for this class, so a holding goes into one of them by being picked
              rather than by somebody typing its name again. A name typed a shade differently is a group the
              model says nothing about, and the holding then sits outside it with nothing to say why. */}
          <Field
            id="holding-subclass"
            label="Sub-class"
            hint={subClassHint(measuredAgainst, (modelSubClasses[assetClass] ?? []).length > 0)}
            error={errors.fields.subClass}
          >
            {(modelSubClasses[assetClass] ?? []).length > 0 && !writingIn ? (
              <SelectInput
                id="holding-subclass"
                value={subClass}
                onChange={(event) => {
                  if (event.target.value === OTHER_GROUP) {
                    setWritingIn(true);
                    setSubClass("");
                    return;
                  }
                  setSubClass(event.target.value);
                }}
              >
                {/* Something for the empty state to sit on. Taking the blank option away left the box
                    showing the first name on the list while holding none of it — a browser shows the first
                    option when a select's value matches no option at all, so it read as chosen and would
                    not save, with the complaint pointing at a box that looked filled in.

                    Where a holding is already written down with no sub-asset named, that is what this box
                    holds and it says so. Nothing new goes in that way: money in a class with nothing
                    saying what it is was the figure that used to be typed on the class row, by another
                    door. What is already there can still be opened and read. */}
                {position !== null && position.subClass === null ? (
                  <option value="">Not grouped</option>
                ) : (
                  <option value="" disabled>Pick a sub-asset…</option>
                )}
                {(modelSubClasses[assetClass] ?? [])
                  .filter((one) => one.name === position?.subClass
                    || !(alreadyWritten[assetClass] ?? []).includes(one.name))
                  .map((one) => (
                    <option key={one.name} value={one.name}>
                      {one.name}
                    </option>
                  ))}
                <option value={OTHER_GROUP}>Something else…</option>
              </SelectInput>
            ) : (
              <TextInput id="holding-subclass" value={subClass} onChange={(e) => setSubClass(e.target.value)} />
            )}
            {/* Choosing to write one in was a door that only opened one way: the list was gone and the only
                way back to it was to close the dialog and start again. */}
            {(modelSubClasses[assetClass] ?? []).length > 0 && writingIn && (
              <button
                type="button"
                onClick={() => {
                  setWritingIn(false);
                  setSubClass("");
                }}
                className="mt-1 text-xs font-medium text-primary-700 hover:underline"
              >
                Choose one of the model's groups instead
              </button>
            )}
          </Field>
          {/* What the model asks of the group picked, as a guide and nothing more. Nothing is refused on the
              strength of it: a portfolio that has wandered is exactly the one somebody has to be able to
              write down, and the figure is here to be seen while they do, not to argue with them. */}
          {/* What the model asks, what this figure would make it, and the distance between them — in the
              same words and the same order as the table behind the dialog. It was three sentences of prose
              carrying six figures between them, which had to be read through rather than looked at. */}
          {asked && (
            <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-line bg-canvas px-4 py-3 text-sm sm:col-span-2 sm:grid-cols-3">
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  Model asks for
                </dt>
                <dd className="tabular-nums">
                  {asked.shareOfPortfolio.toFixed(1)}%
                  {underManagement > 0 && (
                    <span className="text-ink-muted">
                      {" · "}
                      {underManagementLabel((asked.shareOfPortfolio / 100) * underManagement, currency)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  This would be
                </dt>
                <dd className="tabular-nums">
                  {wouldBe === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      {wouldBe.share.toFixed(1)}%
                      <span className="text-ink-muted">
                        {" · "}
                        {underManagementLabel(typed, currency)}
                      </span>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Gap</dt>
                <dd className="flex flex-wrap items-center gap-2 tabular-nums">
                  {wouldBe === null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      {driftLabel(wouldBe.over)}
                      {standing ? (
                        <Badge tone={standingTones[standing]}>{standingLabels[standing]}</Badge>
                      ) : (
                        <Badge tone="success">Within band</Badge>
                      )}
                    </>
                  )}
                </dd>
              </div>
              {/* Nothing here refuses a figure: a portfolio that has wandered is exactly the one somebody
                  has to be able to write down. */}
              <p className="text-xs text-ink-muted sm:col-span-3">
                A guide, not a limit. Write what they actually hold.
              </p>
            </dl>
          )}
        </div>
        {/* What this client's sub-asset may wander before it is watched, at the edge and breached. The model
            sets these for every line in it and that is what nearly every client is measured by — but a plan
            written for the firm cannot answer for one client's circumstances, and the only way to hold one
            of them tighter was to edit the model, which moves the ground under everybody else on it. */}
        <fieldset className="rounded-xl border border-line px-4 py-3">
          <legend className="px-1 text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            How far it may wander
          </legend>
          {/* Which of the two it is standing on today. With the boxes filled in either case, "blank: held
              to the model's 2 / 4 / 6" left somebody who had just written 2 / 40 / 60 with no way to tell
              whether it had taken. */}
          <p className="text-xs text-ink-muted">
            {position?.watchPp != null
              ? `Held to its own figures, not the model's${modelBand?.watchAt == null ? ""
                : ` ${modelBand.watchAt} / ${modelBand.edgeAt} / ${modelBand.breachAt}`}. `
                + "Clear all three to go back to the model."
              : modelBand?.watchAt != null
                ? `Held to the model's ${modelBand.watchAt} / ${modelBand.edgeAt} / ${modelBand.breachAt}.`
                  + " Change them to hold this sub-asset to something of its own."
                : "Held to the model's own figures."}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Field id="holding-watch" label="Watched from" error={errors.fields.watchPp}>
              <TextInput
                {...describedBy("holding-watch", errors.fields.watchPp)}
                id="holding-watch"
                inputMode="decimal"
                className="text-right"
                placeholder={modelBand?.watchAt == null ? "" : String(modelBand.watchAt)}
                value={watchPp}
                onChange={(event) => setWatchPp(asFigure(event.target.value, watchPp))}
              />
            </Field>
            <Field id="holding-edge" label="At the edge from" error={errors.fields.edgePp}>
              <TextInput
                {...describedBy("holding-edge", errors.fields.edgePp)}
                id="holding-edge"
                inputMode="decimal"
                className="text-right"
                placeholder={modelBand?.edgeAt == null ? "" : String(modelBand.edgeAt)}
                value={edgePp}
                onChange={(event) => setEdgePp(asFigure(event.target.value, edgePp))}
              />
            </Field>
            <Field id="holding-breach" label="Breached from" error={errors.fields.breachPp}>
              <TextInput
                {...describedBy("holding-breach", errors.fields.breachPp)}
                id="holding-breach"
                inputMode="decimal"
                className="text-right"
                placeholder={modelBand?.breachAt == null ? "" : String(modelBand.breachAt)}
                value={breachPp}
                onChange={(event) => setBreachPp(asFigure(event.target.value, breachPp))}
              />
            </Field>
          </div>
          {/* Said rather than refused: somebody half way through typing three figures has not made a
              mistake, they are half way through. */}
          {ownBand > 0 && ownBand < 3 && (
            <p className="mt-2 text-xs text-amber-700">
              All three or none. With any of them blank this client is held to the model's figures.
            </p>
          )}
          {outOfOrder && (
            <p className="mt-2 text-xs text-rose-700">
              None of them can be nearer than the one before: watched, then the edge, then breached. The same
            figure in all three is allowed, and leaves one verdict rather than three.
            </p>
          )}
        </fieldset>
        {valueAmount.trim() !== "" && !readable && (
          <p className="text-xs text-rose-700">What a sub-asset is worth is a number, and not less than nothing.</p>
        )}
        {unnamed && (
          <p className="text-xs text-rose-700">
            Pick which sub-asset this is. A figure under a class with nothing saying what it is cannot be
            measured against the model, or moved, or traded.
          </p>
        )}
        {taken && (
          <p className="text-xs text-rose-700">
            {subClass.trim() === "" ? "Not grouped" : subClass.trim()} is already written down under{" "}
            {assetClasses.names[assetClass] ?? assetClass}. Edit that one, or give this a name of its own.
          </p>
        )}
        {shrinks && (
          <Alert tone="warning">
            <p className="font-semibold">
              This takes the portfolio from {underManagementLabel(shrinks.was, currency)} to{" "}
              {underManagementLabel(shrinks.now, currency)}.
            </p>
            <p className="mt-1 text-sm">
              Every other sub-asset becomes a larger share of a smaller whole, so gaps widen everywhere.
              Move it to another sub-asset instead and the total holds.
            </p>
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {/* A sub-asset the model does not name can still be written down — somebody holding it is the
              fact, and the model saying nothing about it is a separate one. */}
          <Button type="submit" disabled={!readable || outOfOrder || taken || unnamed || busy}>
            {busy ? "Saving…" : position ? "Save it" : "Add it"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The classes this holding may sit in: the ones still in use, plus the one it is already filed under. A line
 * written before a class was retired keeps naming it rather than quietly reading as something else.
 */
/**
 * What to say under the Sub-class box.
 *
 * <p>A client nobody has put on a model has no groups to offer, and so did a model that breaks none of its
 * classes down — one sentence covered both, and it blamed the model. Somebody who had simply not picked one
 * yet went looking for a fault in the model instead of at the box at the top of the screen.
 */
function subClassHint(measuredAgainst: string | null, breaksItDown: boolean): string {
  if (measuredAgainst === null) {
    return "This client is on no model yet. Pick one under Measured against and the groups it names are offered here.";
  }
  // Nothing where the model names the groups: the list under the box is already every one of them, and
  // the last of them says what to do when none fits.
  if (breaksItDown) return "";
  return `What the firm calls the group, such as US Equities — S&P 500. ${measuredAgainst} does not break this class down.`;
}

/**
 * The classes this holding may sit in: the ones the screen behind it lists, plus the one it is already
 * under.
 *
 * <p>The screen lists what the client's model asks for. Offering more here would let money be written into
 * a class the plan says nothing about, from a dialog opened on a screen that does not show that class —
 * and nothing would be able to measure it afterwards.
 */
function classesOffered(assetClasses: ReturnType<typeof useAssetClasses>, only: string[] | undefined,
  held: string | undefined): string[] {
  const inUse = assetClasses.inUse.map((one) => one.code);
  const codes = only === undefined ? inUse : inUse.filter((code) => only.includes(code));
  return held && !codes.includes(held) ? [held, ...codes] : codes;
}
