import type { FamilyPerson } from "@atomprive/api-client/portal";

/**
 * A family group drawn as generations: a holder, their branches, and the branches off those.
 *
 * <p>Plain functions rather than work done inside a component. What shape a family is does not depend on
 * anything being drawn, and a tree rebuilt on every render is rebuilt on every keystroke elsewhere.
 *
 * <p>The server says whose branch each person hangs off; this only turns a flat list carrying that fact
 * into something with children in it. Nothing here decides who belongs where — doing that twice is how
 * two screens come to disagree.
 */
export type Branch = {
  person: FamilyPerson;
  children: Branch[];
};

/**
 * Builds the tree, and never loses anybody.
 *
 * <p>Every account holder is a root. A joint account's second and third names are peers of the first, not
 * dependants of it, and the one tier the chart keeps is the tier that is real: somebody invited under
 * somebody. The server says which is which — a co-holder entered at onboarding carries a relationship
 * ("Spouse") exactly as an invited relative does, so nothing here can tell them apart without it.
 *
 * <p>Somebody whose parent is missing from the group hangs off the holder rather than becoming a second
 * root. One application is one family, and a second tree drawn beside the first would be the screen
 * inventing a group the firm never made.
 */
export function treeOf(people: FamilyPerson[]): Branch[] {
  const byId = new Map<string, Branch>();
  for (const person of people) {
    byId.set(person.id, { person, children: [] });
  }

  const holder = people.find((one) => one.primaryHolder) ?? people[0];
  const root = holder ? byId.get(holder.id) : undefined;
  // A group with no holder at all should not happen, and a stale screen could still show one for a
  // moment. Falling back to the single primary holder keeps that group drawn rather than empty.
  const anyHolder = people.some((one) => one.accountHolder);
  const roots: Branch[] = [];

  for (const branch of byId.values()) {
    if (anyHolder ? branch.person.accountHolder : branch === root) {
      roots.push(branch);
      continue;
    }
    const parent = branch.person.parentId ? byId.get(branch.person.parentId) : undefined;
    if (parent && parent !== branch) {
      parent.children.push(branch);
      continue;
    }
    if (root) {
      root.children.push(branch);
      continue;
    }
    roots.push(branch);
  }
  return roots;
}

/**
 * The colours a member is drawn in.
 *
 * <p>By position in the group and nothing else, so a person keeps their colour as long as the group's
 * order holds. Not by relationship: two children would then be drawn as one person.
 */
export const TONES = [
  { card: "border-blue-200 bg-blue-50/50", edge: "border-l-blue-500", face: "bg-blue-500 text-white" },
  { card: "border-violet-200 bg-violet-50/50", edge: "border-l-violet-500", face: "bg-violet-500 text-white" },
  { card: "border-amber-200 bg-amber-50/50", edge: "border-l-amber-500", face: "bg-amber-500 text-white" },
  { card: "border-rose-200 bg-rose-50/50", edge: "border-l-rose-500", face: "bg-rose-500 text-white" },
  { card: "border-teal-200 bg-teal-50/50", edge: "border-l-teal-500", face: "bg-teal-500 text-white" },
  { card: "border-indigo-200 bg-indigo-50/50", edge: "border-l-indigo-500", face: "bg-indigo-500 text-white" },
] as const;

export function toneAt(at: number) {
  return TONES[at % TONES.length] ?? TONES[0];
}

/** Two letters off a name, for a face the firm holds no photograph of. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
