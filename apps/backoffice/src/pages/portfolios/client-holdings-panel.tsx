import { ApiError } from "@atomprive/api-client";
import {
  useListClientHoldings,
  useAskToMoveMoney,
  useListClientMovePlans,
  useTakeBackTheMovePlan,
  type ClassPositions,
  type SubClassGroup,
  type ClientHoldings,
  type MovePlanRow,
  type PositionRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, TextInput, cn } from "@atomprive/ui";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { asFigure } from "../../lib/figures";
import { useAssetClasses } from "./asset-classes";
import {
  anchorFor,
  standingLabels,
  standingTones,
  underManagementLabel,
} from "./portfolio-labels";


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
 * How much each of the other sub-assets in this class can take, biggest room first.
 *
 * <p>Every sub-asset the model names, not only the ones already written down — a client who holds six of a
 * class's nine lines has three standing empty, and reading only what was on the page said "no sub-asset has
 * room" while the model was asking for money in three of them. The lines nobody has written arrive as
 * groups holding nothing now, so there is one list to read rather than two to stitch together.
 *
 * <p>The ceiling itself is the server's figure, not arithmetic repeated here. This screen used to work it
 * out from the class target and its band, and the two frames drifted apart: a class the model asks none of
 * has a band around nothing, so the window offered "Forex, room for USD 9,020" and then said underneath
 * that nothing in Forex had room for it. The platform decides what a line may hold when it decides whether
 * that line has breached, and now says so in the same breath — so the room offered here and the verdict
 * read beside it cannot disagree, because there is only one of them.
 */
function capacityIn(groups: SubClassGroup[], except: SubClassGroup | null): Destination[] {
  const places: Destination[] = [];
  for (const one of groups) {
    if (one === except || one.subClass === null) continue;
    // Nothing is asked of a client on no model, so nothing is allowed either: with no ceiling to land under
    // there is no breach to avoid and no room to offer. The class beside it answers the same way, which is
    // what keeps a crossing from opening a door the sub-asset list cannot then fill.
    const room = one.mostItMayHold === null ? 0 : one.mostItMayHold - one.valueAmount;
    // Listed whether or not it can take anything. Dropped once it was full, a sibling fell out of this
    // list and the window went on showing the copy it had frozen when it opened — whose row still said
    // what the sub-asset held before the money went in. A second move into it wrote that stale figure
    // plus the new one, and the first deposit was gone: 92 into a line, then 50 more, and the line read
    // 250 instead of 342. It stays, saying it has room for nothing, carrying the row as it now stands.
    //
    // A whole unit or it is nothing. A share worked out by division lands a hair either side of its
    // figure, so a sub-asset sitting exactly at the end of its band came out with room for a
    // ten-thousandth of a penny and took a row in the table to say USD 0.
    places.push({ name: one.subClass, room: room < 1 ? 0 : room, into: one.positions[0] ?? null });
  }
  return places.sort((first, second) => second.room - first.room);
}

/**
 * What a whole asset class can take before IT would breach, in money.
 *
 * <p>The first question a crossing has to answer, and one this screen never had to ask while money only
 * moved inside a class: a sub-asset with room is no use if the class around it is already at the end of
 * its own band, because the money would land inside one line's range and outside the class's.
 */
function roomInClass(klass: ClassPositions, into: Destination[], whole: number) {
  if (klass.targetShare === null) return 0;
  const ceiling = (whole * (klass.targetShare + (klass.breachAt ?? 0))) / 100;
  // Never more than its own lines can actually take. The two were worked out separately and disagreed:
  // a class the model asks none of has a band around nothing, so the class arithmetic offered a tenth of
  // the portfolio while every line inside it — each asked for none of the class — had room for nothing at
  // all. The window said "Forex, room for USD 9,020" and then, under it, "nothing in Forex has room for
  // it". Taking the lesser of the two makes that contradiction impossible rather than merely unlikely.
  const lines = into.reduce((sum, place) => sum + Math.max(0, place.room), 0);
  return Math.max(0, Math.min(ceiling - klass.valueAmount, lines));
}

/** One other class money could cross into, and where inside it the money could land. */
type Elsewhere = { assetClass: string; name: string; room: number; places: Destination[] };

/**
 * The split this screen suggests: fill the one with most room first, never past it, until the money is gone.
 *
 * <p>Takes the figure to place already worked out, rather than the breach it came from. Rounding it here
 * put a figure in the boxes that the move beside them would not write: a line the model asks none of has
 * its whole holding to shed, so half-up on a holding of 960.50 suggested 961, and every press of Move
 * bounced off the check that nothing may go below nothing. The button was live and did nothing at all.
 *
 * <p>Counted in whole units throughout. Rounding each share on its own while the remainder went on being
 * counted to the penny put the parts a unit above the whole — five rows adding to 18,784 against 18,783 to
 * move, and a notice saying a dollar more had been placed than there was, with nowhere it had gone.
 *
 * <p>Each share is rounded down rather than to the nearest, so a figure in a box is never a shade past what
 * the sub-asset beside it is said to have room for.
 */
function suggest(toPlace: number, places: Destination[]): Record<string, number> {
  let left = toPlace;
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
function overIts(group: SubClassGroup, classTarget: number, band: number, whole: number): number | null {
  if (group.standing !== "BREACHED" || group.targetShare === null || group.targetShare === undefined) {
    return null;
  }
  // Down to the line's own upper limit, which is its share of the class taken through the class's.
  const ceiling = (whole * group.targetShare * (classTarget + band)) / 10_000;
  const over = group.valueAmount - ceiling;
  return over < 1 ? null : over;
}

/** What somebody typed into one of the boxes, as a figure. A half-typed box is worth nothing, not NaN. */
function typed(value: string | undefined) {
  const figure = Number(value);
  return value === undefined || value.trim() === "" || Number.isNaN(figure) ? 0 : figure;
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
  claim, release, asksForNone, settledRight, onAsked, elsewhere }: {
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
  /** With nothing left to shed, whether the sub-asset is where it should be or short of where it should be. */
  settledRight: boolean;
  /** Told once a plan has been asked for, so the screen above can go and read it. */
  onAsked: () => void | Promise<void>;
  /**
   * Every other class the money could cross into, with what each can take and where inside it.
   *
   * <p>Worked out above rather than here, because the whole portfolio is what a class's own room is read
   * against and this window only knows one class of it.
   */
  elsewhere: Elsewhere[];
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
  /**
   * Which class the money is going into: nothing for this one, or the code of another.
   *
   * <p>Money crossing out of a class is a different question from money moving inside it — the class it
   * lands in has a band of its own, and a sub-asset with room is no use inside a class that has none. So
   * it is asked first, before any figure is typed, rather than left to be discovered.
   */
  const [goingTo, setGoingTo] = useState<string | null>(null);
  const crossing = goingTo === null ? null : (elsewhere.find((one) => one.assetClass === goingTo) ?? null);
  const where = crossing === null ? places : crossing.places;
  // The rows as they stood when this list was chosen, kept for as long as it is — the same rows, in the
  // same order, in the same places on the screen.
  //
  // Sorted afresh on every render, a sub-asset filled to the end of its band has no room left, drops out
  // of the list altogether, and every row beneath it slides up by one under the hand that is typing.
  const [opened, setOpened] = useState<{ forClass: string | null; places: Destination[] }>(
    () => ({ forClass: null, places }),
  );
  const held = opened.forClass === goingTo ? opened.places : where;
  const now = new Map(where.map((place) => [place.name, place]));
  const inOrder = [
    ...held.map((place) => now.get(place.name) ?? { ...place, room: 0 }),
    ...where.filter((place) => !held.some((was) => was.name === place.name)),
  ];
  // The most that may leave this sub-asset: what the breach comes to in whole units, never more than is
  // actually there. Rounding to the nearest is what lands a line cleanly inside its band rather than a
  // hair outside it — but a line the model asks none of has its whole holding to shed, and rounding that
  // up asked for money the line does not have.
  const mostToMove = Math.min(Math.round(spare), inHand);
  // What the window opens on, before anything has been moved out of it.
  const plainly = suggest(mostToMove, inOrder);
  const [moves, setMoves] = useState<Record<string, string>>(() => Object.fromEntries(
    inOrder.map((place) => [place.name, String(plainly[place.name])]),
  ));
  /**
   * The rows somebody has typed into, which are theirs and are left alone.
   *
   * <p>What is left over after them is split across the rest, there and then. Asked to put 100 into one
   * sub-asset and told 20 instead, the other 80 has to go somewhere, and a screen that leaves it sitting
   * in a "still to place" line makes somebody work out the rest by hand across five boxes. Rows already
   * typed into are not touched: a figure somebody put there is their plan for it, and a fresh split would
   * write over the very thing they just said.
   */
  const [typedIn, setTypedIn] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // What the last click did, and the fact that it was a click rather than typing. A move used to leave
  // every remaining box filled with a fresh split and the buttons back where they were, so it never looked
  // as though anything had happened — and the whole table sat one click away from going out the door.
  // What is read off it now is which row to leave out of the next split, so that one button does not come
  // back under the hand that just pressed it.
  /** Why it should move, which is what whoever answers is really being asked about. */
  const [why, setWhy] = useState("");

  // The split as it opens. Nothing is written from this window now, so there is no "after a move" for it
  // to be re-worked against: the figures behind it stand until somebody answers, and the only thing that
  // changes these boxes is somebody typing in them.
  const suggested = plainly;
  const asSuggested = () => Object.fromEntries(
    inOrder.map((place) => [place.name, String(suggested[place.name])]),
  );

  const askToMove = useAskToMoveMoney<ApiError>();
  const placed = inOrder.reduce((sum, place) => sum + typed(moves[place.name]), 0);
  const left = spare - placed;
  // What this class could take in all, however it is split up, and so what genuinely cannot stay in it.
  // Money nobody has placed yet is not money with nowhere to go, and saying it has to leave the class
  // while eight sub-assets sit there with room for it is telling somebody the opposite of the truth.
  const canTake = inOrder.reduce((sum, place) => sum + place.room, 0);
  const beyond = spare - canTake;
  // A table of noughts offering to place a twentieth of what has to move is not a plan, it is eight rows
  // of nothing over the one sentence that matters. Said instead.
  // Whether any other class could take it, which decides whether telling somebody to choose one is help
  // or a dead end dressed up as advice.
  const anywhereElse = elsewhere.some((other) => other.assetClass !== goingTo && other.room >= 1);
  const nowhere = canTake < 1 || canTake < spare / 20;
  // Nothing left to move out of this sub-asset — which, after a move, is what success looks like. The
  // window used to close on exactly this, taking the notice saying what had just gone and the button to
  // put it back off the screen together. That is the commonest press there is: the suggestion is accepted
  // whole, the breach clears, and the screen said nothing at all about what it had just done.
  const nothingLeft = spare < 1;
  // Only where there is something to go back to. Money moved is money written down: the sub-asset is worth
  // what it is worth now, these boxes hold the suggestion made against that, and a button offering to put
  // back a suggestion nobody has changed is a button offering to undo the move — which it cannot do.
  // Only where there is something to go back to. After a move these boxes hold the suggestion made
  // against what is left, so they compare equal to it and no button is offered — which is what gating
  // this on the move was for, before the boxes were refilled at all.
  const edited = inOrder.some((place) => (moves[place.name] ?? "") !== String(suggested[place.name]));

  // Both sides first, the page afterwards. Telling the page between the two legs had it read the portfolio
  // back half way through the move — money gone from one sub-asset and not yet on the other — and every box
  // on the screen re-filled itself against figures that were true for no more than a moment.
  //
  // The source goes first of the two: if the second leg fails, the money is missing rather than counted
  /**
   * A figure typed into one row, and the remainder re-split across the rest, there and then.
   *
   * <p>The loop the firm asked for. Told 20 where the window suggested 100, the other 80 is offered to the
   * sub-assets that have not been spoken for, and again on the next figure, until what is left to place is
   * nothing. Left out, somebody dividing a breach across five lines does the arithmetic themselves and the
   * window only tells them when they are wrong.
   *
   * <p>Rows already typed into are never written over. The figure in them is somebody's plan for that
   * line, and re-splitting across it would undo the very thing they just said.
   */
  function typedInto(name: string, said: string) {
    const mine = new Set(typedIn).add(name);
    setTypedIn(mine);
    setMoves((was) => {
      const next = { ...was, [name]: asFigure(said, was[name] ?? "0") };
      const claimed = inOrder
        .filter((place) => mine.has(place.name))
        .reduce((sum, place) => sum + typed(next[place.name]), 0);
      const rest = inOrder.filter((place) => !mine.has(place.name));
      const split = suggest(Math.max(0, mostToMove - claimed), rest);
      for (const place of rest) {
        next[place.name] = String(split[place.name] ?? 0);
      }
      return next;
    });
  }

  /** A different class to land in: the figures start again, because the room they were split against has. */
  function land(assetClass: string | null) {
    // This class's own sub-assets, read from the prop rather than from `where`. `where` is worked out from
    // the class chosen on the render this is running in, which is the one being left — so coming back to
    // this class from another one froze the other one's list, and its sub-assets then sat above this
    // class's own, all of them saying they had room for nothing. The list grew every time somebody came
    // back to where they started.
    const landing = assetClass === null
      ? places
      : (elsewhere.find((one) => one.assetClass === assetClass)?.places ?? []);
    setGoingTo(assetClass);
    setOpened({ forClass: assetClass, places: landing });
    setTypedIn(new Set());
    setFailed(null);
    const split = suggest(mostToMove, landing);
    setMoves(Object.fromEntries(landing.map((place) => [place.name, String(split[place.name] ?? 0)])));
  }

  /**
   * Asks for the whole split to be moved, as one plan.
   *
   * <p>Not a button on each row. A client may have one plan waiting at a time — two open on one portfolio
   * are each weighed against figures the other is spending — so a press per row would raise one plan and
   * then be refused five times. What is on this screen is one decision anyway: where the money that has to
   * leave this sub-asset should go.
   *
   * <p>Nothing is written. The figures behind this window stand exactly as they are until whoever looks
   * after the client says yes.
   */
  async function ask() {
    const legs = inOrder
      .filter((place) => typed(moves[place.name]) > 0)
      .map((place) => ({
        fromAssetClass: assetClass,
        fromSubClass: rows[0]?.subClass ?? null,
        toAssetClass: goingTo ?? assetClass,
        toSubClass: place.name,
        amount: typed(moves[place.name]),
        heldWhenRaised: inHand,
      }));
    if (!rows.length || legs.length === 0) return;
    const asking = legs.reduce((sum, leg) => sum + leg.amount, 0);
    // More than has to leave is a breach of its own, the other way round. Typing 5,000 into a window
    // about 4,708 empties the sub-asset altogether and leaves it below its floor — and the window, having
    // nothing left to shed, then says the line is inside its range. Said instead, where it is typed.
    if (asking > mostToMove) {
      setFailed(`Only ${exactly(mostToMove, currency)} has to leave ${from}. Asking for more would put it `
        + "below its own range.");
      return;
    }
    if (why.trim() === "") {
      setFailed("Say why this should move. Whoever answers is being asked about the reason, not the figures.");
      // The cursor goes where the thing that stopped the press is, rather than near it.
      document.getElementById("why-it-moves")?.focus();
      return;
    }
    if (!claim()) return;
    setFailed(null);
    setMoving("asking");
    try {
      await askToMove.mutateAsync({ customerId, data: { legs, why: why.trim() } });
      await onAsked();
    } catch (caught) {
      setFailed((caught as ApiError)?.message ?? "That could not be asked for. Nothing has moved.");
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
              {asksForNone && !nothingLeft && (
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


          {/* Where it lands, asked before any figure is typed. Money crossing out of a class is a
              different question from money moving inside it: the class it lands in has a band of its own,
              and a sub-asset with room is no use inside a class that has none. Each choice carries what it
              can take, so the one that cannot take it says so before it is chosen. */}
          {!readOnly && !nothingLeft && (
            <div className="mt-4">
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Where it goes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={goingTo === null}
                  onClick={() => land(null)}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    goingTo === null
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-ink/20 text-ink hover:border-ink/40")}
                >
                  Inside {className}
                </button>
                {elsewhere.map((other) => (
                  <button
                    key={other.assetClass}
                    type="button"
                    aria-pressed={goingTo === other.assetClass}
                    disabled={other.room < 1}
                    onClick={() => land(other.assetClass)}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      other.room < 1 && "cursor-not-allowed opacity-50",
                      goingTo === other.assetClass
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-ink/20 text-ink hover:border-ink/40")}
                  >
                    {other.name}
                    <span className={cn("ml-1.5 font-normal",
                      goingTo === other.assetClass ? "text-white/80" : "text-ink-muted")}>
                      {other.room < 1 ? "no room" : `room for ${exactly(other.room, currency)}`}
                    </span>
                  </button>
                ))}
              </div>
              {crossing !== null && (
                <p className="mt-2 text-xs text-ink-muted">
                  Money leaving {className} altogether. {crossing.name} can take{" "}
                  {exactly(crossing.room, currency)} before it is past its own range — which is a separate
                  question from whether the sub-asset it lands in has room.
                </p>
              )}
            </div>
          )}

          {nothingLeft ? (
            <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-ink">
              {settledRight
                ? `Nothing more has to leave ${from}. It is inside its range.`
                : `Nothing more can leave ${from}. It is short of its range now — it needs money put in, `
                  + "which is not something this window does."}
            </p>
          ) : nowhere ? (
            <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-ink">
              {canTake < 1
                ? `No sub-asset in ${crossing?.name ?? className} has room for it.`
                  + (anywhereElse
                    ? " Another class above can take it."
                    : " Nothing else the model asks for has room either, so this needs money taken out of"
                      + " the portfolio rather than moved around inside it.")
                : `${crossing?.name ?? className} has room for only ${exactly(canTake, currency)} of it.`
                  + ` The other ${exactly(spare - canTake, currency)} has to go somewhere else`
                  + (anywhereElse ? " — another class above can take it." : ".")}
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
                                onChange={(event) => typedInto(place.name, event.target.value)}
                                className="h-9 w-32 text-right tabular-nums"
                              />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* A minus sign in a money column is a figure somebody has to stop and decode. This says which way
              it has gone instead, and the figure stays a plain amount. */}
          {!nowhere && !nothingLeft && (
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

          {/* One plan for the whole split, under the table where the figures are settled — not a button
              on each row. A client may have one plan waiting at a time, so a press per row would raise
              one and be refused for the rest; and what is on this screen is one decision anyway, which
              is where the money leaving this sub-asset should go. */}
          {!readOnly && !nowhere && !nothingLeft && (
            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="why-it-moves" className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                Why it should move
              </label>
              <p className="mt-1 text-xs text-ink-muted">
                Whoever answers is being asked about the reason, not the figures. They can see those.
              </p>
              <TextInput
                id="why-it-moves"
                name="why-it-moves"
                value={why}
                onChange={(event) => setWhy(event.target.value)}
                placeholder={`${from} is past its band and this puts it back inside`}
                className="mt-2"
              />
              {/* Beside the button that produced it. Put at the top of the window, with a table of
                  sub-assets between the two, pressing the button scrolled the answer out of sight — so
                  the press did nothing anybody could see, which reads as a broken button rather than as a
                  question. */}
              {failed && <div className="mt-3"><Alert tone="danger">{failed}</Alert></div>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  Nothing moves yet. This goes to whoever looks after the client.
                </p>
                <Button
                  size="sm"
                  disabled={placed <= 0 || moving !== null}
                  onClick={() => void ask()}
                >
                  {moving === "asking" ? "Asking…" : `Ask to move ${exactly(placed, currency)}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What a client actually holds: asset class, then sub-class, then the holdings themselves — the three levels
 * the firm's own review opens downward through.
 *
 * <p>A class written down this way takes its total from its lines, so the figure and the holdings can never
 * disagree. A class nobody has broken down keeps the single figure somebody typed, and says so.
 */
export function ClientHoldingsPanel({
  customerId,
  offer,
  reveal = null,
  against = null,
  readOnly = false,
}: {
  customerId: string;
  // A sub-asset this panel wrote down and has since taken off again. The page was told about it when it
  // was written, and has to be told about this too: it is not there to be put back, and a Discard that
  // goes looking for it finds nothing and reports a refusal over work that is already undone.
  /**
   * A class whose own tolerance is about to be written over, with what it was held to beforehand — its own
   * three figures, or null where it was following the model.
   *
   * <p>A tolerance is not a holding, so it has no row for Discard to put back. The page keeps it instead.
   */
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


  // The firm's own names for the classes, read before anything returns: a hook skipped on the way out of
  // an early return is a hook React counts as missing on the render after it.
  const catalogue = useAssetClasses();
  // What has already been asked for this client and not yet answered. A client may have one plan at a
  // time, so this is at most one — and while it stands, the figures on this screen are what is written
  // down rather than what has been asked for.
  const waiting = useListClientMovePlans<MovePlanRow[], ApiError>(customerId);
  const open = (waiting.data ?? []).find((plan) => plan.status === "PENDING") ?? null;
  const takeBack = useTakeBackTheMovePlan<ApiError>();

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
      {/* What has been asked for and not yet answered, over the figures rather than in them. The figures
          below are what the client holds; a plan is not a holding, and writing one in would say the breach
          was fixed when nobody has agreed to fix it yet. */}
      {open && (
        <Alert tone="info">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {exactly(open.amount, currency)} is waiting on an answer.
              </p>
              <p className="mt-1 text-sm">
                {open.raisedByName} asked for it: {open.why}
              </p>
              <ul className="mt-2 space-y-0.5 text-sm">
                {open.legs.map((leg, at) => (
                  <li key={`${leg.fromSubClass ?? ""}-${leg.toSubClass ?? ""}-${at}`}>
                    {exactly(leg.amount, currency)} out of {leg.fromSubClass ?? "what is not grouped"} and
                    {" "}into {leg.toSubClass ?? "what is not grouped"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                Nothing has moved. The figures below are what is written down.
              </p>
            </div>
            {/* Taken back, not undone: nothing was written, so there is nothing to put back. */}
            {!readOnly && (
              <Button
                variant="secondary"
                size="sm"
                disabled={takeBack.isPending}
                onClick={() => {
                  void takeBack.mutateAsync({ id: open.id }).then(() => waiting.refetch());
                }}
              >
                {takeBack.isPending ? "Taking it back…" : "Take it back"}
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* The words take the width they need and no more, so the button keeps its place at the right of the
          row. Left to fill the line, they pushed it onto one of its own, where it began at the left margin
          under the text rather than beside it. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* No heading of its own: the panel above already says what this is, and a second word for the
              same thing between the two read as a different section starting. */}
          <p className="text-xs text-ink-muted">
            Asset class, then the sub-assets inside it. A class written down here takes its total from them.
            Every share is of the whole portfolio, and the range under each target is what that line is
            judged against — its share of the class taken through the class&apos;s own limits, so a small
            line has a narrow one.
          </p>
          {/* Figures are not written here. The calculator works a client's Net AUM out of what they hold,
              what they own that nobody manages and what they owe, and every share on this screen is a share
              of that figure — so a holding added, retyped or taken away here would move the ground under
              every other line on the page. What this screen does is move money between the lines that are
              already there, which leaves the total where the calculator left it. */}
          {!readOnly && (
            <p className="mt-1 text-xs text-ink-muted">
              The figures are the ones the Net AUM calculator was given. Money is moved between sub-assets
              from a breached line&apos;s suggestion, never added to or taken off here.
            </p>
          )}
        </div>
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
            // What the class may wander, in points. A line inside it gets that same figure scaled by the
            // share of the class it is asked for — the firm's rule is its share times the class's own
            // limits, which comes to the same thing.
            const band = one.breachAt ?? 0;
            // Where the class itself stands against its own range. This decides whether the lines below can
            // be put right at all: a line's floor is its share of the class's floor and its ceiling its
            // share of the class's ceiling, and the shares add to 100%, so the lines' floors add to exactly
            // the class's floor and their ceilings to its ceiling. Moving money between them can satisfy
            // every line only when the class is already inside its own band. Outside it, every line reads
            // breached and no shuffle inside the class will clear them — which the screen said nothing
            // about, leaving a reader with nine breached rows, an action on two of them and no reason given
            // for the other seven.
            const classLow = one.targetShare == null ? null : Math.max(one.targetShare - band, 0);
            const classHigh = one.targetShare == null ? null : one.targetShare + band;
            const classShare = one.shareOfPortfolio;
            const starved = classLow != null && classShare != null && classShare < classLow;
            const stuffed = classHigh != null && classShare != null && classShare > classHigh;
            // In money, because points are what the class is judged in and money is what somebody has to
            // find. A class short by ten points of a portfolio nobody has in front of them is not an
            // amount anybody can go and look for.
            const adrift = classLow == null || classHigh == null ? 0
              : starved ? (whole * classLow) / 100 - one.valueAmount
                : one.valueAmount - (whole * classHigh) / 100;
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
                </div>

                {isOpen && (starved || stuffed) && classLow != null && classHigh != null
                  && classShare != null && (
                  /* Above the table rather than on a row inside it: it is true of every line below at
                     once, and said against one of them it would read as that line's problem.

                     About the class and nothing else. A second paragraph stood here saying what the
                     lines below could still do among themselves, to keep a suggestion to sell from
                     reading as advice given against the line directly above it. Two blocks of prose over
                     a table is more than a reader of it wants, and what the rows do is the rows' own
                     business. The one thing this has to say is that the class is out by an amount no
                     press on this screen will fix. */
                  <p className="border-t border-ink/15 bg-amber-50/70 px-4 py-2.5 text-xs text-ink">
                    <span className="font-semibold">
                      {one.assetClassName || one.assetClass} holds {percent(classShare)} of the portfolio
                      against an allowed {classLow.toFixed(2)}–{classHigh.toFixed(2)}
                    </span>
                    {" — "}
                    {starved ? "short" : "over"} by {exactly(Math.abs(adrift), currency)}. Only{" "}
                    {starved ? "money from another class" : "money moved out to another class"} puts that
                    right, and nothing on this screen moves money between classes.
                  </p>
                )}

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
                        </tr>
                      </thead>
                      {one.subClasses.map((group) => {
                        // What the model asks of this line as a share of the whole portfolio: its share of
                        // its class carried through the class's own share of the book. Where the model
                        // names no target for either, there is no figure to carry and the row says so.
                        const ofPortfolio = (group.targetShare == null || one.targetShare == null)
                          ? null
                          : (group.targetShare * one.targetShare) / 100;
                        // The range the line is actually judged against, which is the one figure this table
                        // never showed. The firm's rule: its share of the class taken through the class's
                        // own limits. A line asked for 2% of a class allowed 25% to 35% sits between 0.50%
                        // and 0.70% of the book — a band a tenth of a point wide, not the five the class
                        // carries. Without it on the page, a line on a target of 0.60% holding 0.48% looks
                        // comfortably inside a band of five and still says breached, and there is nothing
                        // on the row a reader can check that against.
                        const allowed = (group.targetShare == null || one.targetShare == null) ? null : {
                          low: (group.targetShare * Math.max(one.targetShare - band, 0)) / 100,
                          high: (group.targetShare * (one.targetShare + band)) / 100,
                        };
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
                        const toShed = overIts(group, one.targetShare ?? 0, band, whole);
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
                              {/* Under the target rather than beside it: the firm's sheet has six columns
                                  and a seventh for this would have been one more than it reads. */}
                              {allowed && (
                                <span className="mt-0.5 block text-2xs whitespace-nowrap text-ink-muted/70">
                                  {allowed.low.toFixed(2)}–{allowed.high.toFixed(2)} allowed
                                </span>
                              )}
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
                            <td
                              className="px-3 py-3.5 text-right tabular-nums text-ink-muted"
                              /* A breached line with no plan behind it is the commonest thing on this
                                 table and the screen never said why: the plan moves money out of a line
                                 holding too much, and a line that is short has none to move. */
                              /* Only where it is actually short. A line over its range by less than a
                                 whole unit has nothing worth moving either, and telling its reader it
                                 needed money putting in sat over a figure saying to sell. */
                              title={group.standing === "BREACHED" && toShed === null && move != null
                                && move.word === "Buy"
                                ? `${group.subClass ?? UNGROUPED} is short of its range, so there is `
                                  + "nothing to move out of it. This line needs money put in."
                                : undefined}
                            >
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
                            {/* Nothing is done to a sub-asset here. Its figure came from the calculator,
                                which worked the Net AUM out of it; retyping or deleting it on this screen
                                would move the ground under every other share on the page. Money leaves a
                                line through the plan on its suggestion, and lands in another. */}
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
        // Gone from the screen altogether: a sub-asset the model does not name and nobody holds has no
        // row left to plan against. A line the model names stays listed at nought, so this is only ever
        // the window closing on something that is no longer there to talk about.
        if (!its || !group) return null;
        const over = overIts(group, its.targetShare ?? 0, band, whole);
        // Nought rather than nothing, and the window stays open on it. Closing on the move that puts a
        // line right took the notice saying what had just moved and the button to put it back off the
        // screen in the same instant — and that is the commonest move there is, the whole suggestion
        // accepted at once. It closes when somebody closes it.
        const toShed = over === null ? 0 : Math.min(over, group.valueAmount);
        // Nothing left to shed is not the same as being where it should be. A line taken all the way
        // down is breached the other way, and the window said it was inside its range while the row
        // behind it carried a breach badge and a figure to buy.
        const right = group.standing !== "BREACHED";
        return (
          <Dialog
            open
            size="2xl"
            title={toShed >= 1
              ? `Where ${exactly(toShed, currency)} out of ${group.subClass ?? UNGROUPED} can go`
              : right
                ? `${group.subClass ?? UNGROUPED} is inside its range`
                : `${group.subClass ?? UNGROUPED} is short of its range`}
            onClose={() => setPlanning(null)}
          >
            <MoveOutPlan
              customerId={customerId}
              spare={toShed}
              rows={group.positions}
              assetClass={its.assetClass}
              places={capacityIn(its.subClasses, group)}
              elsewhere={classes
                .filter((other) => other.assetClass !== its.assetClass && other.targetShare !== null)
                .map((other) => {
                  const into = capacityIn(other.subClasses, null);
                  return {
                    assetClass: other.assetClass,
                    name: other.assetClassName || other.assetClass,
                    room: roomInClass(other, into, whole),
                    places: into,
                  };
                })
                .sort((first, second) => second.room - first.room)}
              className={its.assetClassName || its.assetClass}
              currency={currency}
              readOnly={readOnly}
              settledRight={right}
              claim={claimTheMove}
              release={releaseTheMove}
              asksForNone={group.targetShare === 0}
              onAsked={async () => {
                setPlanning(null);
                await waiting.refetch();
              }}
            />
          </Dialog>
        );
      })()}

    </section>
  );
}
