import type { ClientHoldings, MoveLegRequest, SubClassGroup } from "@atomprive/api-client/backoffice";
import { named } from "../portfolios/money-words";

/** One end of a leg: the class, and the sub-asset or the line inside it where the plan goes that deep. */
export type Place = { assetClass: string; subClass: string | null; subSubClass: string | null };

/**
 * A leg as the form holds it.
 *
 * <p>Both ends are held as the picker's own key rather than as a {@link Place}, because a select carries one
 * string; the amount is held typed, so an empty box reads as nothing rather than as zero.
 */
export type TypedLeg = { from: string; to: string; amount: string };

export const EMPTY_LEG: TypedLeg = { from: "", to: "", amount: "" };

/** A place where money sits or could sit, as the two pickers list it. */
export type Choice = {
  key: string;
  said: string;
  /** What is in it today, or null for somewhere the client holds nothing yet. */
  held: number | null;
};

/** Three fields down one string, so a select can carry a place, and back again. */
export function keyOf(place: Place) {
  return [place.assetClass, place.subClass ?? "", place.subSubClass ?? ""].join("\u001f");
}

export function placeFrom(key: string): Place | null {
  if (key === "") {
    return null;
  }
  const [assetClass, subClass, subSubClass] = key.split("\u001f");
  return { assetClass, subClass: subClass || null, subSubClass: subSubClass || null };
}

/** Every line inside one sub-asset, however deep the plan goes, deepest-first so the finest line is offered. */
function inside(assetClass: string, groups: SubClassGroup[], found: Choice[]) {
  for (const group of groups ?? []) {
    const place = { assetClass, subClass: group.subClass, subSubClass: group.subSubClass };
    found.push({ key: keyOf(place), said: named(group.subClass, assetClass, group.subSubClass),
      held: group.valueAmount });
    inside(assetClass, group.inside, found);
  }
}

/**
 * Where a leg's money may come out of: every line the client actually holds something in.
 *
 * <p>Read from the client's own allocation rather than typed, because a proposal that names a holding in
 * words is a proposal somebody has to translate before a penny can move — which is what left proposals
 * sitting approved with nothing done about them.
 */
export function sources(holdings: ClientHoldings | undefined): Choice[] {
  // Read off what arrived rather than off what the type promises. A reply that is not a client's holdings
  // — an error body, a half-filled cache — used to throw here, and throwing here takes down the whole
  // proposal page, which is the page somebody has to open to answer one.
  const classes = holdings?.classes;
  if (!Array.isArray(classes)) {
    return [];
  }
  const found: Choice[] = [];
  for (const klass of classes) {
    found.push({ key: keyOf({ assetClass: klass.assetClass, subClass: null, subSubClass: null }),
      said: klass.assetClassName, held: klass.valueAmount });
    inside(klass.assetClass, klass.subClasses, found);
  }
  return found.filter((one) => (one.held ?? 0) > 0);
}

/**
 * And where it may go: the same lines, plus the ones the model names that the client holds nothing in.
 *
 * <p>Money has to be able to land somewhere it is not yet, or no proposal could ever start a holding.
 */
export function destinations(holdings: ClientHoldings | undefined): Choice[] {
  const classes = holdings?.classes;
  if (!Array.isArray(classes)) {
    return [];
  }
  const found: Choice[] = [];
  for (const klass of classes) {
    found.push({ key: keyOf({ assetClass: klass.assetClass, subClass: null, subSubClass: null }),
      said: klass.assetClassName, held: klass.valueAmount });
    inside(klass.assetClass, klass.subClasses, found);
    for (const line of holdings?.modelSubClasses?.[klass.assetClass] ?? []) {
      const key = keyOf({ assetClass: klass.assetClass, subClass: line.name, subSubClass: null });
      if (!found.some((one) => one.key === key)) {
        found.push({ key, said: named(line.name, klass.assetClassName), held: null });
      }
    }
  }
  return found;
}

/** A leg counts once it says where the money leaves, where it lands, and how much of it moves. */
export function isWritten(leg: TypedLeg) {
  return leg.from !== "" && leg.to !== "" && Number(leg.amount) > 0;
}

/**
 * The legs as the API takes them.
 *
 * <p>What the source held as the picker read it travels with each one, so that a figure which moves between
 * the writing and the answering is noticed at the answer rather than written over.
 */
export function legsFrom(legs: TypedLeg[], from: Choice[]): MoveLegRequest[] {
  return legs.filter(isWritten).map((leg) => {
    const out = placeFrom(leg.from)!;
    const into = placeFrom(leg.to)!;
    return {
      fromAssetClass: out.assetClass,
      fromSubClass: out.subClass,
      fromSubSubClass: out.subSubClass,
      toAssetClass: into.assetClass,
      toSubClass: into.subClass,
      toSubSubClass: into.subSubClass,
      amount: Number(leg.amount),
      heldWhenRaised: from.find((one) => one.key === leg.from)?.held ?? null,
    };
  });
}

/** A saved proposal's legs, as the form holds them for editing. */
export function typedFrom(legs: MoveLegRequest[]): TypedLeg[] {
  return legs.map((leg) => ({
    from: keyOf({ assetClass: leg.fromAssetClass, subClass: leg.fromSubClass ?? null,
      subSubClass: leg.fromSubSubClass ?? null }),
    to: keyOf({ assetClass: leg.toAssetClass, subClass: leg.toSubClass ?? null,
      subSubClass: leg.toSubSubClass ?? null }),
    amount: String(leg.amount),
  }));
}
