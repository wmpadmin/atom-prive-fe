import type { FamilyInvitationRow, FamilyMember } from "@atomprive/api-client/backoffice";

/**
 * A family group arranged as it actually is: a holder, their branches, and the branches off those.
 *
 * <p>Plain functions in their own file rather than work done inside a component. What shape a family is
 * does not depend on anything being drawn, and a tree built during a render is rebuilt on every keystroke
 * somewhere else on the screen.
 *
 * <p>The server already says whose branch each person hangs off and how deep they are; this only turns a
 * flat list carrying those two facts into something with children in it. Nothing here decides who belongs
 * where — doing that twice is how two screens come to disagree.
 */

/** One person and everything under them, with any invitation still waiting on that branch. */
export type Branch = {
  member: FamilyMember;
  children: Branch[];
  /** People asked to join under this person who have not arrived. */
  invited: FamilyInvitationRow[];
};

/**
 * Builds the tree, and never loses anybody.
 *
 * <p>Every account holder is a root. A joint account's second and third names are peers of the first, not
 * dependants of it, and the one tier the chart keeps is the tier that is real: somebody invited under
 * somebody. The server says which is which — a co-holder entered at onboarding carries a relationship
 * ("Spouse") exactly as an invited relative does, so nothing here can tell them apart without it.
 *
 * <p>A member whose parent is missing from the group — which the server already guards against, and which
 * a stale screen could still show for a moment — is hung off the holder rather than dropped. A family
 * screen that silently omitted a client would be worse than one that draws them a tier too high.
 */
export function treeOf(family: FamilyMember[], invitations: FamilyInvitationRow[]): Branch[] {
  const byId = new Map<string, Branch>();
  for (const member of family) {
    byId.set(member.id, { member, children: [], invited: [] });
  }

  const holder = family.find((one) => one.primaryHolder) ?? family[0];
  for (const one of invitations) {
    const under = (one.inviteUnder && byId.get(one.inviteUnder)) || (holder && byId.get(holder.id));
    under?.invited.push(one);
  }

  const root = holder ? byId.get(holder.id) : undefined;
  // A group with no holder at all should not happen, and a stale screen could still show one for a
  // moment. Falling back to the single primary holder keeps that group drawn rather than empty.
  const anyHolder = family.some((one) => one.accountHolder);
  const roots: Branch[] = [];
  for (const branch of byId.values()) {
    if (anyHolder ? branch.member.accountHolder : branch === root) {
      roots.push(branch);
      continue;
    }
    const parentId = branch.member.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== branch) {
      parent.children.push(branch);
      continue;
    }
    // Rootless, which should not happen and does after a member is removed from under somebody. They go
    // under the holder rather than becoming a root of their own: one application is one family, and a
    // second tree drawn beside the first would be the screen inventing a group the firm never made.
    if (root) {
      root.children.push(branch);
      continue;
    }
    roots.push(branch);
  }

  return roots;
}

/** Every branch, flattened back out in reading order, for the list that shows the same tree indented. */
export function downTheTree(branches: Branch[], depth = 0): { branch: Branch; depth: number }[] {
  const rows: { branch: Branch; depth: number }[] = [];
  for (const branch of branches) {
    rows.push({ branch, depth });
    rows.push(...downTheTree(branch.children, depth + 1));
  }
  return rows;
}

/**
 * Who somebody may be invited under.
 *
 * <p>Everybody in the group. A family grows at every tier — a grandchild marries, a child has another
 * child — and a platform that only let the holder's own branch grow would be one the firm worked around
 * by recording people in the wrong place.
 */
export function whoCanBeInvitedUnder(family: FamilyMember[]) {
  return [...family].sort((a, b) => a.generation - b.generation || a.fullName.localeCompare(b.fullName));
}
