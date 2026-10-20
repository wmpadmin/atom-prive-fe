import { ApiError } from "@atomprive/api-client";
import {
  useListClientHoldings,
  useAskOnBehalfOfTheClient,
  useAskToMoveMoney,
  useChangeTheMovePlan,
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
import { useSearchParams } from "react-router";
import { useStaffUser } from "../../auth/session";
import { asFigure } from "../../lib/figures";
import { hasAnyAuthority, hasAuthority } from "../../lib/permissions";
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
type Destination = {
  name: string;
  /**
   * The sub-asset this sits inside, or empty where it is one itself.
   *
   * <p>Carried because a line is identified by where it sits as well as by its name, and a leg naming
   * only "Large cap" is money that could land under Indian equities or under US equities.
   */
  under: string;
  /** What it can still take, after what waiting plans have already promised it. */
  room: number;
  /**
   * How much of its room is already spoken for by a plan nobody has answered.
   *
   * <p>Carried beside the room rather than folded silently into it, because a figure that dropped from
   * 6,694 to 1 with nothing on screen to say why reads as a bug in the ceiling.
   */
  asked: number;
  into: PositionRow | null;
};

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
function theLine(subClass: string | null, subSubClass: string | null) {
  return `${subClass ?? ""}\t${subSubClass ?? ""}`;
}

/**
 * How a line is said on screen: its own name, and the sub-asset around it where there is one.
 *
 * <p>"Large cap" on its own does not say whose large cap it is, and two sub-assets of one class may each
 * have one.
 */
function saidAs(subClass: string | null, subSubClass: string | null) {
  if (subSubClass == null) {
    return subClass ?? UNGROUPED;
  }
  return `${subClass ?? UNGROUPED} · ${subSubClass}`;
}

/**
 * The one group a line names, wherever it sits — the sub-asset itself, or one of the lines inside it.
 *
 * <p>The exact object from this render, not a copy: the list of somewhere-money-can-go excludes its own
 * source by identity, so a rebuilt group would leave the line being emptied standing in its own list of
 * destinations.
 */
function theOneCalled(groups: SubClassGroup[], subClass: string | null,
    subSubClass: string | null): SubClassGroup | undefined {
  for (const one of groups) {
    if (one.subClass === subClass && one.subSubClass === subSubClass) {
      return one;
    }
    const deeper = theOneCalled(one.inside, subClass, subSubClass);
    if (deeper) {
      return deeper;
    }
  }
  return undefined;
}

/** Whether any line of these, at any depth, is the one a waiting plan draws its money out of. */
function anyIs(groups: SubClassGroup[], subClass: string | null, subSubClass: string | null): boolean {
  return theOneCalled(groups, subClass, subSubClass) !== undefined;
}

/**
 * Which line a destination is, which is not what it is called.
 *
 * <p>Every figure this window holds is kept against one of these. Kept against the name alone, a class
 * with a "Large cap" under Indian equities and another under US equities had one box behind two rows:
 * typing into either moved both, and the plan that went out named one of them twice.
 */
function placeKey(place: Destination) {
  return theLine(place.under === "" ? place.name : place.under, place.under === "" ? null : place.name);
}

function capacityIn(groups: SubClassGroup[], except: SubClassGroup | null,
    mine: Record<string, number> = {}): Destination[] {
  const places: Destination[] = [];
  for (const one of groups) {
    if (one === except || one.subClass === null) continue;
    // A sub-asset the plan breaks down is not somewhere money can go: the plan says what the parts of it
    // should be, so the money goes into one of them. Offering the sub-asset itself as well would let
    // somebody put money in a place the plan has an opinion about and no target for, and the same room
    // would be offered twice — once on the parent and once on each line inside it.
    if (one.inside.length > 0) {
      places.push(...capacityIn(one.inside, except, mine));
      continue;
    }
    // What waiting plans have already promised this line, less whatever of that is the plan being changed
    // here. A plan read against its own claim would see the room it has itself taken and offer to split
    // the figures already in its boxes down to nothing.
    const asked = one.askedFor - (mine[theLine(one.subClass, one.subSubClass)] ?? 0);
    // Nothing is asked of a client on no model, so nothing is allowed either: with no ceiling to land under
    // there is no breach to avoid and no room to offer. The class beside it answers the same way, which is
    // what keeps a crossing from opening a door the sub-asset list cannot then fill.
    //
    // Less what is already asked of it. The ceiling and the holding are still the server's own figures and
    // are still true — nothing has moved. What has changed is that a plan waiting on an answer is money
    // this line is spoken for, and a window offering it again offers the same money twice: 6,693 of 6,694
    // promised, and the next window still said 6,694 and pre-filled 5,000 of it.
    const room = one.mostItMayHold === null ? 0 : one.mostItMayHold - one.valueAmount - asked;
    // Listed whether or not it can take anything. Dropped once it was full, a sibling fell out of this
    // list and the window went on showing the copy it had frozen when it opened — whose row still said
    // what the sub-asset held before the money went in. A second move into it wrote that stale figure
    // plus the new one, and the first deposit was gone: 92 into a line, then 50 more, and the line read
    // 250 instead of 342. It stays, saying it has room for nothing, carrying the row as it now stands.
    //
    // A whole unit or it is nothing. A share worked out by division lands a hair either side of its
    // figure, so a sub-asset sitting exactly at the end of its band came out with room for a
    // ten-thousandth of a penny and took a row in the table to say USD 0.
    places.push({
      name: one.subSubClass ?? one.subClass,
      under: (one.subSubClass === null) ? "" : one.subClass,
      // Clamped after the claim is taken off, not before: a line whose room was whole until a plan spoke
      // for all but a hair of it has to come out as nothing, not as that hair.
      room: room < 1 ? 0 : room,
      asked: asked > 0 ? asked : 0,
      into: one.positions[0] ?? null,
    });
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
function roomInClass(klass: ClassPositions, into: Destination[]) {
  // Nothing is asked of this class, so nothing is allowed either: with no ceiling to land under there is
  // no breach to avoid and no room to offer.
  if (klass.mostItMayHold === null) return 0;
  // Money a waiting plan would bring into this class is room the class no longer has. Money asked for
  // between two lines INSIDE it nets to nothing here, which is right — the class total does not move.
  // Never more than its own lines can actually take, which is a real asymmetry and not a rounding guard.
  // A band around a target of nothing is nothing for a LINE, because it is scaled by the share of its
  // class that line is asked for; for a class there is nothing to scale it by, so a class the model asks
  // none of may still hold a band's worth before it has breached. Both figures are the platform's own and
  // both are true — the window said "Forex, room for USD 9,020" and then, under it, "nothing in Forex has
  // room for it", and it was right twice. Offering the lesser is what makes that readable.
  const lines = into.reduce((sum, place) => sum + Math.max(0, place.room), 0);
  return Math.max(0, Math.min(klass.mostItMayHold - klass.valueAmount - klass.askedFor, lines));
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
    split[placeKey(place)] = takes;
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
 *
 * <p>Against the server's own ceiling, like everything else that reads one. Worked out here from the
 * CLASS's band it came out higher than the ceiling the breach was actually called against, so the window
 * asked for less to be moved than clearing the breach takes — and a reader who moved exactly what it
 * asked for was left with the badge still on the row.
 */
function overIts(group: SubClassGroup): number | null {
  if (group.standing !== "BREACHED" || group.mostItMayHold === null) {
    return null;
  }
  const over = group.valueAmount - group.mostItMayHold;
  return over < 1 ? null : over;
}

/**
 * One line of a plan on the holdings table, and whatever the plan breaks it into.
 *
 * <p>One component at every depth, calling itself, because a line is the same thing wherever it sits: a
 * name, what the plan asks of it, what the client holds in it, and a verdict on the gap. Written as two
 * blocks — one for sub-assets and one for the lines inside them — the pair would have been the same row
 * said twice, and they would have parted company the first time one of them was corrected. This table has
 * been bitten by that twice already, both times over a band it worked out for itself while the verdict
 * beside it was read from the server's.
 *
 * <p>Which is why every figure here is the server's own. A line's target, its range and what it would take
 * to close the gap are read off the group rather than worked out again from the class above it — and that
 * is also what makes the deeper level correct for nothing: a nested line's target is a share of its parent
 * rather than of its class, so a screen doing its own arithmetic would have had to learn where it sat.
 */
function SubAssetRow({ group, whole, currency, depth, onPlan }: {
  group: SubClassGroup;
  /** Everything the client has, which is the one denominator every share on this table is out of. */
  whole: number;
  currency: string;
  depth: number;
  /**
   * Opens the plan for whichever line was pressed. Bound by the caller rather than built here from an
   * asset class passed down, so the identity of a line — its class, its sub-asset and itself — is
   * assembled in exactly one place.
   */
  onPlan: (group: SubClassGroup) => void;
}) {
  // What the model asks of this line as a share of the whole portfolio, read back out of the figure the
  // server already worked out rather than multiplied out again here. The server knows how deep this line
  // sits and what it is a share of; this screen would have had to be told.
  const ofPortfolio = (group.targetValue == null || whole === 0) ? null
    : (group.targetValue / whole) * 100;
  // The range the line is actually judged against, as the server states it — not worked out again here.
  // Worked out here it was worked out from the CLASS's band where the verdict beside it is read from the
  // LINE's, which on any model whose lines wander less than their class is a different number: a line
  // sound between 17.50% and 22.50% of the book printed as sound between 15% and 25%, with the Breached
  // badge sitting beside a range that said it was fine.
  //
  // A line inside another may read a tighter ceiling than its parent, which is not a mistake to correct:
  // it cannot be given room the line above it has not got, and the server has already said so.
  const allowed = (group.leastItMayHold == null || group.mostItMayHold == null
    || whole === 0) ? null : {
    low: (group.leastItMayHold / whole) * 100,
    high: (group.mostItMayHold / whole) * 100,
  };
  const targetValue = group.targetValue;
  const actualShare = whole === 0 ? null : (group.valueAmount / whole) * 100;
  const move = group.suggestion == null ? null : toDo(group.suggestion);
  // What the plan breaks this line into. A line with any of these holds everything in them as well as
  // whatever sits in it directly, which is why it is not somewhere money can be sent.
  const broken = group.inside.length > 0;
  // Whether there is a plan to open behind this row's suggestion: a line holding more than its band allows
  // has money that has to go somewhere, and where it can go is the question this opens.
  //
  // Never on a line the plan has broken down. Its overage is partly its own lines' overage, so a press
  // here and a press on one of them would be two plans over the same money — and two plans drawing on one
  // line are refused, so the second could only fail. The list of somewhere-to-put-it says the same thing
  // from the other side: a broken-down line is not a destination either, only its parts are.
  const toShed = broken ? null : overIts(group);
  const named = group.subSubClass ?? group.subClass ?? UNGROUPED;

  return (
    <>
      <tr
        className={cn("align-middle", toShed !== null && "cursor-pointer hover:bg-primary-50/40")}
        onClick={toShed === null ? undefined : () => onPlan(group)}
      >
        {/* A row group is one sub-asset, so only the sub-asset heads one. A line inside it heads its own
            row and nothing below it, which is what scope="row" says. */}
        <th
          scope={depth === 0 ? "rowgroup" : "row"}
          className={cn("py-3.5 pr-3 text-left font-semibold text-ink", depth === 0 ? "pl-4" : "pl-10")}
        >
          <span className="flex flex-wrap items-center gap-2">
            {/* A line is read by where it sits as well as by its name, and the indent alone cannot say
                that on a row somebody has scrolled to. */}
            {named}
            {/* A class can sit on its target while the money inside it sits in the wrong places, because
                the halves cancel out. This is where that shows. */}
            {group.standing && group.standing !== "WITHIN_BAND" && (
              <Badge tone={standingTones[group.standing]}>
                {standingLabels[group.standing]}
              </Badge>
            )}
            {/* What its own figures already include, said once so nobody reads the column down and
                wonders why the parts and the whole both appear in it. */}
            {broken && (
              <span className="text-2xs font-normal text-ink-muted">
                {group.inside.length} lines, counted below
              </span>
            )}
          </span>
        </th>
        {/* A dash, not a nought: the model naming no target for this group is a different thing from it
            asking for none of it. */}
        <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
          {ofPortfolio == null ? "—" : percent(ofPortfolio)}
          {/* Under the target rather than beside it: the firm's sheet has six columns and a seventh for
              this would have been one more than it reads. */}
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
        {/* The way into the plan, on the figure it is about. A table under the row used to carry it, which
            meant one line at a time — the worst of them — and a reader who wanted to deal with another
            first had to clear that one before the screen would talk about theirs. Clicking a suggestion
            opens its own. */}
        <td
          className="px-3 py-3.5 text-right tabular-nums text-ink-muted"
          /* A breached line with no plan behind it is the commonest thing on this table and the screen
             never said why: the plan moves money out of a line holding too much, and a line that is short
             has none to move. */
          /* Only where it is actually short. A line over its range by less than a whole unit has nothing
             worth moving either, and telling its reader it needed money putting in sat over a figure
             saying to sell. */
          title={broken
            ? `${named} is what the lines inside it come to. Money moves in and out of those.`
            : group.standing === "BREACHED" && toShed === null && move != null && move.word === "Buy"
              ? `${named} is short of its range, so there is nothing to move out of it. `
                + "This line needs money put in."
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
            /* Lit, because it is the one figure on the row somebody can act on and it says so. The row is
               clickable too — this is also what makes the row reachable from a keyboard. */
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPlan(group);
              }}
              className="rounded-lg px-1 font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              title={`Where ${exactly(toShed, currency)} out of ${named} can go`}
            >
              <span className="text-2xs font-semibold tracking-wider uppercase">
                {move.word}
              </span>{" "}
              {move.figure}
            </button>
          )}
        </td>
        {/* Nothing is done to a sub-asset here. Its figure came from the calculator, which worked the Net
            AUM out of it; retyping or deleting it on this screen would move the ground under every other
            share on the page. Money leaves a line through the plan on its suggestion, and lands in
            another. */}
      </tr>
      {group.inside.map((deeper) => (
        <SubAssetRow
          key={theLine(deeper.subClass, deeper.subSubClass)}
          group={deeper}
          whole={whole}
          currency={currency}
          depth={depth + 1}
          onPlan={onPlan}
        />
      ))}
    </>
  );
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
function MoveOutPlan({ customerId, assetClass, from, leaving, spare, rows, places, className, currency,
  readOnly, claim, release, asksForNone, settledRight, onAsked, elsewhere, changing, carrying }: {
  customerId: string;
  assetClass: string;
  /**
   * The line the money is leaving, as somebody reads it.
   *
   * <p>Told rather than read off the first holding inside it. A holding carries the sub-asset it counts
   * towards, so a window opened on a line INSIDE a sub-asset named its parent in every sentence — and a
   * window that says Indian equities while it empties large cap is describing a different plan from the
   * one it is about to send.
   */
  from: string;
  /** That same line as the plan names it: which sub-asset, and which line inside it. */
  leaving: { subClass: string | null; subSubClass: string | null };
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
  /**
   * The plan being changed, where somebody is editing one they already asked for rather than raising one.
   *
   * <p>Without this the only way to change one figure of four was to take the whole plan back and type the
   * split again from nothing — the server has always accepted a change, and this window is where it is
   * made. The boxes open on what was asked for, and every one of them counts as typed into, because a
   * figure somebody already decided on is not a suggestion to be re-split under them.
   */
  changing: MovePlanRow | null;
  /** The proposal this window was opened to carry out, where it was. */
  carrying: string | null;
}) {
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
  const [goingTo, setGoingTo] = useState<string | null>(() => {
    const landed = changing?.legs[0]?.toAssetClass;
    return landed === undefined || landed === assetClass ? null : landed;
  });
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
  const now = new Map(where.map((place) => [placeKey(place), place]));
  const inOrder = [
    ...held.map((place) => now.get(placeKey(place)) ?? { ...place, room: 0 }),
    ...where.filter((place) => !held.some((was) => placeKey(was) === placeKey(place))),
  ];
  // The most that may leave this sub-asset: what the breach comes to in whole units, never more than is
  // actually there. Rounding to the nearest is what lands a line cleanly inside its band rather than a
  // hair outside it — but a line the model asks none of has its whole holding to shed, and rounding that
  // up asked for money the line does not have.
  const mostToMove = Math.min(Math.round(spare), inHand);
  // What the window opens on, before anything has been moved out of it.
  const plainly = suggest(mostToMove, inOrder);
  const [moves, setMoves] = useState<Record<string, string>>(() => Object.fromEntries(
    inOrder.map((place) => {
      if (changing === null) return [placeKey(place), String(plainly[placeKey(place)])];
      // Added up rather than found: two legs may land in one sub-asset, and the box that shows them is one.
      const asked = changing.legs
        .filter((leg) => theLine(leg.toSubClass, leg.toSubSubClass) === placeKey(place))
        .reduce((sum, leg) => sum + leg.amount, 0);
      return [placeKey(place), String(asked)];
    }),
  ));
  const [failed, setFailed] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // What the last click did, and the fact that it was a click rather than typing. A move used to leave
  // every remaining box filled with a fresh split and the buttons back where they were, so it never looked
  // as though anything had happened — and the whole table sat one click away from going out the door.
  // What is read off it now is which row to leave out of the next split, so that one button does not come
  // back under the hand that just pressed it.
  /** Why it should move, which is what whoever answers is really being asked about. */
  const [why, setWhy] = useState(changing?.why ?? "");

  // The split as it opens. Nothing is written from this window now, so there is no "after a move" for it
  // to be re-worked against: the figures behind it stand until somebody answers, and the only thing that
  // changes these boxes is somebody typing in them.
  const suggested = plainly;
  const asSuggested = () => Object.fromEntries(
    inOrder.map((place) => [placeKey(place), String(suggested[placeKey(place)])]),
  );

  const user = useStaffUser();
  /**
   * Whether this is the firm asking or the client asking, which decides which door the plan goes through.
   *
   * <p>Two endpoints, because they are two different acts. The firm's own plan is raised by somebody who
   * may write the firm's advice; a relationship manager holds nothing of the sort and that door refuses
   * them — all they can do is write down what the client rang up and asked for, which is what the second
   * one is. Asked here with the same strings the API checks, so the window never posts through a door that
   * is then shut in its face.
   */
  const onTheirBehalf = !hasAuthority(user, "SEND_PROPOSALS:CHANGE")
    && hasAnyAuthority(user, "APPROVE_PORTFOLIO_CHANGES:OWN_CLIENTS", "APPROVE_PORTFOLIO_CHANGES:CHANGE");
  const askToMove = useAskToMoveMoney<ApiError>();
  const askForTheClient = useAskOnBehalfOfTheClient<ApiError>();
  const changeIt = useChangeTheMovePlan<ApiError>();
  const placed = inOrder.reduce((sum, place) => sum + typed(moves[placeKey(place)]), 0);
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
  const edited = inOrder.some((place) =>
    (moves[placeKey(place)] ?? "") !== String(suggested[placeKey(place)]));

  // Both sides first, the page afterwards. Telling the page between the two legs had it read the portfolio
  // back half way through the move — money gone from one sub-asset and not yet on the other — and every box
  // on the screen re-filled itself against figures that were true for no more than a moment.
  //
  // The source goes first of the two: if the second leg fails, the money is missing rather than counted
  /**
   * A figure typed into one row, and nothing else touched.
   *
   * <p>The remainder used to be re-split across every row nobody had typed into yet, there and then.
   * Cutting a suggested 8 down to 2 sent the other 6 into the line below, which nobody had asked for:
   * a figure appeared in a row somebody had not looked at, and the only way to find out where their
   * money had gone was to read every row again.
   *
   * <p>What is left to place is said underneath instead. The screen does the arithmetic and says the
   * answer; where the money goes stays the reader's to decide, one row at a time.
   */
  function typedInto(name: string, said: string) {
    setMoves((was) => ({ ...was, [name]: asFigure(said, was[name] ?? "0") }));
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
    setFailed(null);
    const split = suggest(mostToMove, landing);
    setMoves(Object.fromEntries(landing.map((place) =>
      [placeKey(place), String(split[placeKey(place)] ?? 0)])));
  }

  /**
   * Asks for the whole split to be moved, as one plan.
   *
   * <p>Not a button on each row. Every row in this window takes money out of the same sub-asset, and two
   * plans drawing on one line are refused — so a press per row would raise one plan and then be refused
   * five times over. What is on this screen is one decision anyway: where the money that has to leave this
   * sub-asset should go.
   *
   * <p>Nothing is written. The figures behind this window stand exactly as they are until whoever looks
   * after the client says yes.
   */
  async function ask() {
    const legs = inOrder
      .filter((place) => typed(moves[placeKey(place)]) > 0)
      .map((place) => ({
        fromAssetClass: assetClass,
        // The line the window is about, not the line whichever holding inside it happens to be written
        // under. A plan that named a child as the source of money drawn from the whole sub-asset would
        // move the wrong figure.
        fromSubClass: leaving.subClass,
        fromSubSubClass: leaving.subSubClass,
        toAssetClass: goingTo ?? assetClass,
        // Both ends of where it lands. A destination inside a sub-asset says which sub-asset; one that
        // is a sub-asset itself says only itself, the way every leg did before the plan went three deep.
        toSubClass: place.under === "" ? place.name : place.under,
        toSubSubClass: place.under === "" ? null : place.name,
        amount: typed(moves[placeKey(place)]),
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
      if (changing === null) {
        // Stamped with the proposal where this window was opened to carry one out, so the paper and
        // the act know about each other afterwards.
        const asked = { legs, why: why.trim(), fromProposalId: carrying ?? null };
        if (onTheirBehalf) await askForTheClient.mutateAsync({ customerId, data: asked });
        else await askToMove.mutateAsync({ customerId, data: asked });
      }
      else {
        // The legs are replaced whole, which is what the window has anyway: every box on it, including the
        // ones left at nought, is the plan as it now stands rather than a correction to be merged.
        await changeIt.mutateAsync({
          id: changing.id,
          data: { legs, why: why.trim(), fromProposalId: changing.fromProposalId ?? null },
        });
      }
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
                    const past = typed(moves[placeKey(place)]) - place.room;
                    return (
                      <tr key={placeKey(place)} className="border-b border-ink/15 last:border-0 align-top">
                        <th scope="row" className="px-5 py-4 text-left font-medium text-ink">
                          {/* Named with the sub-asset it sits in where it sits in one. These stand in
                              one list beside sub-assets that were not broken down, and "Large cap" by
                              itself does not say whose large cap it is. */}
                          {place.under !== "" && (
                            <span className="font-normal text-ink-muted">{place.under} · </span>
                          )}
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
                        <td className="px-5 py-4 text-right whitespace-nowrap text-ink-muted">
                          <span className="tabular-nums">{exactly(place.room, currency)}</span>
                          {/* Why it is not more. The room above is what this line can still take after
                              what a plan nobody has answered has already promised it — and a figure that
                              fell from 6,694 to 1 with nothing to say why reads as the ceiling being
                              wrong rather than as the money being spoken for. */}
                          {place.asked >= 1 && (
                            <span className="mt-1 block text-xs font-normal text-amber-700">
                              {exactly(place.asked, currency)} already asked for into this line
                            </span>
                          )}
                        </td>
                        {/* Off the portfolio screen there is no Edit, and so no Discard to undo a move
                            with. What it would put there is still worth reading, so it is read rather than
                            typed. */}
                        <td className="px-5 py-4 text-right">
                          {readOnly ? (
                            <span className="tabular-nums text-ink-muted">
                              {exactly(typed(moves[placeKey(place)]), currency)}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-2">
                              <span className="text-xs text-ink-muted">{currency}</span>
                              <TextInput
                                inputMode="decimal"
                                aria-label={place.under === "" ? `Move into ${place.name}`
                                  : `Move into ${place.name} inside ${place.under}`}
                                value={moves[placeKey(place)] ?? "0"}
                                onChange={(event) => typedInto(placeKey(place), event.target.value)}
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
                {left < -0.5 ? "Placed more than there is"
                  : left > 0.5 ? "Yet to place another" : "Still to place"}
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
              on each row. Every row here draws on the same sub-asset and two plans may not, so a press
              per row would raise one and be refused for the rest; and what is on this screen is one
              decision anyway, which is where the money leaving this sub-asset should go. */}
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
                {/* Said, because the two are not the same thing to the person pressing it: one is the firm
                    asking, and the other is the client's own asking being written down for them. Somebody
                    who thinks they are raising the firm's plan has no reason to be careful that the words
                    in the box are the client's. */}
                <p className="text-xs text-ink-muted">
                  {onTheirBehalf
                    ? "Nothing moves yet. This is written down as the client's own request, and goes to "
                      + "whoever holds the book."
                    : "Nothing moves yet. This goes to whoever looks after the client."}
                </p>
                <Button
                  size="sm"
                  disabled={placed <= 0 || moving !== null}
                  onClick={() => void ask()}
                >
                  {moving === "asking"
                    ? (changing === null ? "Asking…" : "Saving the change…")
                    : changing !== null
                      ? `Change it to ${exactly(placed, currency)}`
                      : onTheirBehalf
                        ? `Ask for ${exactly(placed, currency)} on the client's behalf`
                        : `Ask to move ${exactly(placed, currency)}`}
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
  readOnly = false,
}: {
  customerId: string;
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
  /** Read somewhere other than the portfolio screen, where writing them down is not the job. */
  readOnly?: boolean;
}) {
  // Grouped by whatever the client is measured against on file. The screen no longer holds a model that
  // has been picked but not written, so there is no second answer for this to prefer.
  const held = useListClientHoldings<ClientHoldings, ApiError>(customerId);
  // A proposal this screen was opened to carry out, named in the address by the proposal that sent the
  // reader here. Every move raised while it is in force says which advice it serves.
  const carrying = useSearchParams()[0].get("carrying");
  // What has been shut, rather than what has been opened: a class is open until somebody closes it. Kept
  // this way round because the classes arrive after the first render, and a set of what is open would have
  // to be filled in from them by an effect that renders twice to say what the list already said.
  const [shut, setShut] = useState<Set<string>>(new Set());

  // Settles once the portfolio has actually been read back, so a caller that must not act on yesterday's
  // figures can wait for it. Fired and forgotten, this let a second Move go out against the rows the first
  // one had already written over.
  // One WRITE at a time across the whole screen — not one plan: a client may have several waiting. A ref
  // rather than state, because a click reads it in the same tick and state arrives a render later, so two
  // clicks together would both find the door open. Only one move window is ever open, and its own buttons
  // already know while it is writing, so there is no flag beside this for them to grey out on.
  const moveUnderway = useRef(false);
  /**
   * Whose plan is open, by name rather than by the row itself.
   *
   * <p>Held as the object, a move would leave the dialog reading figures from before it: the panel builds
   * fresh rows out of what the API answers, and the one this was pointing at is gone by then. Named, it
   * finds the new row each render and the dialog keeps up with what it has just done.
   */
  const [planning, setPlanning] = useState<
    {
      assetClass: string;
      subClass: string | null;
      /**
       * Which line inside that sub-asset, or nothing where the plan is about the sub-asset itself.
       *
       * <p>Both, because a sub-asset and a line inside it share a subClass: naming only that, a plan
       * opened on one line of a sub-asset was answered as a plan about the whole of it, and the window
       * filled itself with the parent's figures without anything on screen saying so.
       */
      subSubClass: string | null;
      changing: MovePlanRow | null;
    } | null
  >(null);
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
  // What has already been asked for this client and not yet answered. Several may be, so long as no two
  // of them take money out of the same line — and while any of them stands, the figures on this screen are
  // what is written down rather than what has been asked for.
  //
  // Read as a list rather than the first of them. Taken as one, the second ask a client had waiting was
  // invisible on the screen somebody would go to to check it, and "Cancel this plan" cancelled whichever
  // the server happened to return first.
  const waiting = useListClientMovePlans<MovePlanRow[], ApiError>(customerId);
  const open = (waiting.data ?? []).filter((plan) => plan.status === "PENDING");
  // The last one somebody actually answered. The bell that tells whoever asked that their move was turned
  // down links to this page — and this page used to say nothing at all about it, because the banner above
  // reads only the plan that is still waiting. They arrived at a screen identical to the one before they
  // ever asked, with the reason sitting in a notification they had already clicked away from.
  const answered = (waiting.data ?? [])
    .find((plan) => plan.status === "APPROVED" || plan.status === "REJECTED") ?? null;
  const takeBack = useTakeBackTheMovePlan<ApiError>();
  const user = useStaffUser();
  const [planFailed, setPlanFailed] = useState<string | null>(null);
  /** Which plan is being cancelled, so one plan's button says so and the others simply wait. */
  const [cancelling, setCancelling] = useState<string | null>(null);

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
              // Nothing is written down and nothing has been read, so there is no ceiling to state either.
              mostItMayHold: null,
              // A class nobody holds anything in has nothing asked of it either: a plan can only move
              // money out of a line that holds some, and a class with no lines is in no plan.
              askedFor: 0,
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
  // Whether the window that changes a plan has anything left to open on. It is built around the sub-asset
  // the money leaves, and a plan outlives the figures it was raised against — if that line has since gone
  // from the screen there is nothing to show, and a button that does nothing when pressed is worse than
  // one that says it cannot.
  const canChange = (plan: MovePlanRow) => {
    const leaves = plan.legs[0];
    return leaves !== undefined
      && classes.some((one) => one.assetClass === leaves.fromAssetClass
        // The line itself, however deep it sits. Asked only of the top level, a plan drawing on a line
        // inside a sub-asset was judged by whether its PARENT was still on screen — so the button stayed
        // lit after the line it is about had gone, which is the one thing the test exists to stop.
        && anyIs(one.subClasses, leaves.fromSubClass, leaves.fromSubSubClass));
  };

  return (
    <section className="space-y-3">
      {/* Why this screen was opened. A reader sent here from a proposal has the advice in another tab
          and the lines in front of them; naming it here is what joins the two in their head, and what
          lets the move they raise say which advice it serves. */}
      {carrying !== null && (
        <Alert tone="info">
          <p className="font-semibold">You are carrying out a proposal.</p>
          <p className="mt-1 text-sm">
            Open a line below and ask for the move. Whatever you raise while you are here says it carries
            this advice out, so the proposal stops reading as agreed to and untouched.
          </p>
        </Alert>
      )}
      {/* What has been asked for and not yet answered, over the figures rather than in them. The figures
          below are what the client holds; a plan is not a holding, and writing one in would say the breach
          was fixed when nobody has agreed to fix it yet. */}
      {open.length > 0 && (
        <Alert tone="info">
          {/* How many, said once at the top. A reader counting blocks to find out whether they have one
              plan waiting or three is doing the screen's work for it. */}
          <p className="font-semibold">
            {open.length === 1
              ? `${exactly(open[0]?.amount ?? 0, currency)} is waiting on an answer.`
              : `${open.length} plans are waiting on an answer.`}
          </p>
          {/* One block each, with its own buttons. Shown as a single plan, a second ask was invisible
              here and Cancel cancelled whichever came back first — which is the one thing a button
              beside somebody's own figures must never be vague about. */}
          <div className="mt-2 space-y-3">
            {open.map((plan) => {
              // Whether the person reading this is the person who asked. The row carries the raiser's id
              // for exactly this: a name cannot answer it, because two members of staff can share one.
              const theirs = plan.raisedBy === user.id;
              return (
                <div
                  key={plan.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-current/15 pt-3 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    {open.length > 1 && (
                      <p className="text-sm font-semibold">{exactly(plan.amount, currency)}</p>
                    )}
                    <p className={open.length > 1 ? "mt-0.5 text-sm" : "text-sm"}>
                      {plan.raisedByName} asked for it: {plan.why}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {plan.legs.map((leg, at) => (
                        <li key={`${theLine(leg.fromSubClass, leg.fromSubSubClass)}-${at}`}>
                          {/* Named to the line, not to the sub-asset around it. Said as the sub-asset, a
                              plan moving money between two lines inside one of them read "out of Indian
                              equities and into Indian equities" — which looks like a fault in the screen
                              rather than a plan, and tells nobody which line is already spoken for. */}
                          {exactly(leg.amount, currency)} out of{" "}
                          {saidAs(leg.fromSubClass, leg.fromSubSubClass)} and
                          {" "}into {saidAs(leg.toSubClass, leg.toSubSubClass)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Only to whoever asked. The server has always held both of these to the raiser, and
                      the screen used to offer them to everybody and let the refusal come back —
                      invisibly, since nothing read it. */}
                  {!readOnly && theirs && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {/* Changed rather than taken back and asked again. Somebody who split money across
                          four sub-assets and wants one of them different was retyping the other three
                          from memory; the window opens on what they asked for, and they change the one. */}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={cancelling !== null || !canChange(plan)}
                        onClick={() => {
                          setPlanFailed(null);
                          const from = plan.legs[0];
                          if (from === undefined) return;
                          setPlanning({
                            assetClass: from.fromAssetClass,
                            subClass: from.fromSubClass,
                            subSubClass: from.fromSubSubClass,
                            changing: plan,
                          });
                        }}
                      >
                        Change it
                      </Button>
                      {/* Cancelled, not undone: nothing was written, so there is nothing to put back. */}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={cancelling !== null}
                        onClick={() => {
                          setPlanFailed(null);
                          setCancelling(plan.id);
                          void takeBack
                            .mutateAsync({ id: plan.id })
                            // Both, because the holdings now carry what waiting plans have promised each
                            // line. Read alone, the plans list emptied while every room figure on the
                            // screen went on counting money this plan had just stopped asking for.
                            .then(() => Promise.all([waiting.refetch(), held.refetch()]))
                            .catch((caught: ApiError) => {
                              setPlanFailed(caught?.message ?? "That could not be cancelled.");
                            })
                            .finally(() => setCancelling(null));
                        }}
                      >
                        {cancelling === plan.id ? "Cancelling…" : "Cancel this plan"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-sm">
            Nothing has moved. The figures below are what is written down.
          </p>
          {planFailed && <p className="mt-2 text-sm font-medium text-red-700">{planFailed}</p>}
        </Alert>
      )}

      {/* What was last decided, where nothing is waiting. Only one of the two is ever on the screen: while
          a plan waits, what it is asking for is the thing worth reading, and the answer before it is
          history. */}
      {open.length === 0 && answered && (
        <Alert tone={answered.status === "APPROVED" ? "success" : "warning"}>
          <p className="font-semibold">
            {exactly(answered.amount, currency)} out of{" "}
            {saidAs(answered.legs[0]?.fromSubClass ?? null, answered.legs[0]?.fromSubSubClass ?? null)}
            {" was "}
            {answered.status === "APPROVED" ? "approved" : "rejected"}
            {answered.decidedByName && ` by ${answered.decidedByName}`}.
          </p>
          <p className="mt-1 text-sm">
            {answered.raisedByName} asked for it: {answered.why}
          </p>
          {/* The reason it was refused, which is the whole of what the answerer was asked to give and the
              only part of this a person can act on. */}
          {answered.decisionNote && (
            <p className="mt-1 text-sm font-medium">
              {answered.status === "APPROVED" ? "They added" : "They said"}: {answered.decisionNote}
            </p>
          )}
          <p className="mt-1 text-sm">
            {answered.status === "APPROVED"
              ? "The figures below are what it left behind."
              : "Nothing moved. The figures below stand as they were, and this client can be asked about again."}
          </p>
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
            judged against — the band the model writes on that line, carried through the share of its
            class it is asked for, so a small line has a narrow one.
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
                      {/* One row group per sub-asset, whatever the plan breaks it into: a line inside
                          one is still part of it, and ending the group at each line would make the rule
                          those borders draw — one sub-asset, one block — stop meaning anything. */}
                      {one.subClasses.map((group) => (
                        <tbody
                          key={theLine(group.subClass, group.subSubClass)}
                          className="border-b border-ink/15 last:border-0"
                        >
                          <SubAssetRow
                            group={group}
                            whole={whole}
                            currency={currency}
                            depth={0}
                            onPlan={(which) => setPlanning({
                              changing: null,
                              assetClass: one.assetClass,
                              subClass: which.subClass,
                              subSubClass: which.subSubClass,
                            })}
                          />
                        </tbody>
                      ))}
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
        // Walked rather than looked up at the top: the line a plan is about may sit inside another, and a
        // lookup that stopped at the first level found its parent instead — same name, different money,
        // and a window that opened on figures nobody had pointed at.
        const group = theOneCalled(its?.subClasses ?? [], planning.subClass, planning.subSubClass);
        // Gone from the screen altogether: a sub-asset the model does not name and nobody holds has no
        // row left to plan against. A line the model names stays listed at nought, so this is only ever
        // the window closing on something that is no longer there to talk about.
        if (!its || !group) return null;
        const over = overIts(group);
        // Nought rather than nothing, and the window stays open on it. Closing on the move that puts a
        // line right took the notice saying what had just moved and the button to put it back off the
        // screen in the same instant — and that is the commonest move there is, the whole suggestion
        // accepted at once. It closes when somebody closes it.
        const toShed = over === null ? 0 : Math.min(over, group.valueAmount);
        // Nothing left to shed is not the same as being where it should be. A line taken all the way
        // down is breached the other way, and the window said it was inside its range while the row
        // behind it carried a breach badge and a figure to buy.
        const right = group.standing !== "BREACHED";
        // What the plan being changed has already promised each line. Read back out of its own legs and
        // handed to the room reading so that opening "Change it" on a plan filling a line does not show
        // that line as full — it is full of this very plan, and this is the window for changing it.
        const ours: Record<string, number> = {};
        for (const leg of planning.changing?.legs ?? []) {
          const into = theLine(leg.toSubClass, leg.toSubSubClass);
          ours[into] = (ours[into] ?? 0) + leg.amount;
        }
        return (
          <Dialog
            open
            size="2xl"
            title={planning.changing !== null
              ? `Change what is asked for out of ${saidAs(group.subClass, group.subSubClass)}`
              : toShed >= 1
                ? `Where ${exactly(toShed, currency)} out of ${saidAs(group.subClass, group.subSubClass)} can go`
                : right
                  ? `${saidAs(group.subClass, group.subSubClass)} is inside its range`
                  : `${saidAs(group.subClass, group.subSubClass)} is short of its range`}
            onClose={() => setPlanning(null)}
          >
            <MoveOutPlan
              customerId={customerId}
              spare={toShed}
              rows={group.positions}
              assetClass={its.assetClass}
              from={saidAs(group.subClass, group.subSubClass)}
              leaving={{ subClass: group.subClass, subSubClass: group.subSubClass }}
              places={capacityIn(its.subClasses, group, ours)}
              elsewhere={classes
                .filter((other) => other.assetClass !== its.assetClass && other.targetShare !== null)
                .map((other) => {
                  const into = capacityIn(other.subClasses, null, ours);
                  return {
                    assetClass: other.assetClass,
                    name: other.assetClassName || other.assetClass,
                    room: roomInClass(other, into),
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
              changing={planning.changing}
              carrying={carrying}
              onAsked={async () => {
                setPlanning(null);
                // The holdings too: a line's free room is now read net of what waiting plans have
                // promised it, so raising or changing one changes a figure on this very screen. Refetched
                // alone, the next window opened on the room as it stood before the plan just raised —
                // which is the whole of what this was built to stop.
                await Promise.all([waiting.refetch(), held.refetch()]);
              }}
            />
          </Dialog>
        );
      })()}

    </section>
  );
}
