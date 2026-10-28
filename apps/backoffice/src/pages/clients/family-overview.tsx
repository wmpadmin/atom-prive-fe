import type {
  CustomerRow,
  FamilyGroupSummary,
  FamilyInvitationRow,
  FamilyMember,
} from "@atomprive/api-client/backoffice";
import { Avatar, Badge, cn } from "@atomprive/ui";
import { CreditCard, Mail, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { formatDate } from "../../lib/labels";
import { useRelationshipTypes } from "../../lib/relationship-types";
import { kycStatusLabels, kycStatusTones } from "./client-labels";
import { treeOf, type Branch } from "./family-tree";

/**
 * The family group drawn as what it is: one household, and the people under it.
 *
 * <p>The table this sits beside answers "what is true of each of these people". This answers the question
 * asked first and more often — who are they to each other — which a table cannot, because a table's only
 * shape is a list and a family's shape is not a list. The relationship was a column among five; here it is
 * the thing the picture is made of.
 *
 * <p>One tier under the group, not two. The reference this was drawn from nests family members beneath
 * shareholders, and this platform has no such split: a family group is an application with people on it,
 * exactly one of whom is the primary holder. Drawing a second tier would mean inventing one.
 *
 * <p>Nothing here is computed from money. Every figure on this screen — joined date, accounts held, KYC
 * standing, who is primary — is a field the client's own record already carries, so the chart cannot
 * disagree with the table beside it.
 */
export function FamilyChart({
  client,
  family,
  invitations,
  group,
  openTheir,
  backTo,
  onInviteUnder,
  mayInvite,
  children,
}: {
  client: CustomerRow;
  family: FamilyMember[];
  /** Only the ones still waiting. A settled invitation is not a node; it is history. */
  invitations: FamilyInvitationRow[];
  group: FamilyGroupSummary | null;
  openTheir: (id: string) => string;
  backTo: unknown;
  /** Opens the invite window with that person already chosen as the one to invite under. */
  onInviteUnder?: (memberId: string) => void;
  mayInvite: boolean;
  /** The group's own card, which carries its name and the pencil that renames it. */
  children?: React.ReactNode;
}) {
  const { labelFor } = useRelationshipTypes();
  const [picked, setPicked] = useState<Picked>({ kind: "group" });

  // Built from what the server says about parents, and memoised: the shape of a family does not change
  // because somebody clicked a node, and rebuilding it on every click would reorder nothing and cost a
  // walk of the whole group each time.
  const roots = useMemo(() => treeOf(family, invitations), [family, invitations]);
  // A colour per person, fixed by where they sit in the group rather than by what they are — two children
  // drawn in one colour would be the picture saying they were one person.
  const toneOfMember = useMemo(() => {
    const tones = new Map<string, (typeof TONES)[number]>();
    family.forEach((member, at) => tones.set(member.id, toneAt(at)));
    return tones;
  }, [family]);

  // Resolved on every render rather than held in state: a member who has just been restored, or an
  // invitation just cancelled, would otherwise leave the panel describing somebody who is no longer there.
  const chosenMember = picked.kind === "member" ? family.find((one) => one.id === picked.id) : undefined;
  const chosenInvitation =
    picked.kind === "invitation" ? invitations.find((one) => one.id === picked.id) : undefined;

  const accounts = family.reduce((running, member) => running + member.bankAccounts, 0);
  // The name a joint holder is a joint holder alongside. Off the group where the server named it, and
  // off the chart's own holder where it did not, so the card never reads "spouse of —".
  const holderName =
    group?.primaryHolderName ?? family.find((one) => one.primaryHolder)?.fullName ?? null;
  // One branch of the chart, named here because the row below is built from it.
  const branchFor = (root: Branch) => (
    <TreeBranch
      branch={root}
      toneOfMember={toneOfMember}
      picked={picked}
      onPick={setPicked}
      onInviteUnder={onInviteUnder}
      mayInvite={mayInvite}
      labelFor={labelFor}
      clientId={client.id}
      holderName={holderName}
    />
  );

  return (
    <div className="space-y-4 p-6">
      {children}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-2xl border border-line bg-white p-6">
          {/* The holders are the top of the chart, whatever kind of client this is. A node above them
              for the group was tried and taken out: on an entity it repeated the client's own name one
              line above itself, and on anybody else it drew a legal person that does not exist. */}
          <div className="overflow-x-auto">
            <ul className="mx-auto flex w-max items-start gap-8">
              {roots.map((root) => (
                <li key={root.member.id} className="flex">
                  {branchFor(root)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Detail
          group={group}
          client={client}
          family={family}
          invitations={invitations}
          member={chosenMember}
          invitation={chosenInvitation}
          labelFor={labelFor}
          openTheir={openTheir}
          backTo={backTo}
          onPickMember={(id) => setPicked({ kind: "member", id })}
          onPickInvitation={(id) => setPicked({ kind: "invitation", id })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Counted
          icon={<UsersRound />}
          tint="bg-primary-50 text-primary-600"
          label="Members"
          total={family.length}
          rows={[
            ["Generations", group?.generations ?? 1] as const,
            ...byRelationship(family, labelFor),
          ]}
          empty="Nobody but this client."
        />
        <Counted
          icon={<Mail />}
          tint="bg-amber-50 text-amber-600"
          label="Invitations"
          total={invitations.length}
          rows={[["Waiting on them", invitations.length]]}
          empty="Nobody has been asked."
        />
        <Counted
          icon={<CreditCard />}
          tint="bg-slate-100 text-ink-soft"
          label="Bank accounts"
          total={accounts}
          rows={family
            .filter((member) => member.bankAccounts > 0)
            .map((member) => [member.fullName, member.bankAccounts] as const)}
          empty="None registered yet."
        />
      </div>
    </div>
  );
}

/** Which node the right-hand panel is describing. */
type Picked = { kind: "group" } | { kind: "member"; id: string } | { kind: "invitation"; id: string };

/**
 * What a connector is drawn in.
 *
 * <p>Not the line token the borders use. A border has a whole edge to be seen along; a one-pixel rule
 * crossing white space at that colour is invisible, which is how this screen first came out — a group card
 * floating above four unconnected ones.
 */
const RULE = "bg-ink-muted/40";

/**
 * The shape every node on the chart has.
 *
 * <p>One width and one minimum height for all of them, because on a chart a box's size is read as meaning
 * something. Left to its contents, a card for "Xeris" came out half the width of the one for "Harbhajan
 * Singh Kaur" and the tree looked like it was saying something about the two of them.
 *
 * <p>Wide enough for a full name on one line and tall enough that a card with nothing yet to say — no
 * accounts, no KYC — still has the same footprint as one that has.
 *
 * <p>The height has to clear the tallest card there is, not the plainest. At 9.5rem it cleared a primary
 * holder and nobody else: a joint holder carries a line saying whose co-holder they are and an invited
 * relative carries one saying whose branch they are on, and either put their card a line taller than the
 * holder's beside it — which is the chart saying something about them that is not true. The foot of the
 * card is pushed down by mt-auto, so the shorter ones pad rather than float.
 */
const NODE =
  "flex min-h-[12.5rem] w-60 flex-col rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600";

/**
 * The colours a member is drawn in.
 *
 * <p>By position in the group and nothing else, so a person keeps their colour as long as the group's
 * order holds. Not by relationship: two children would then be drawn as the same person.
 *
 * <p>The whole card is tinted, not just the initials. A row of white cards under a blue one is a list with
 * lines drawn over it; what makes a chart readable is that each branch is a colour you can follow from the
 * card to its dot in the panel beside it. The tint is the palest step there is and the edge carries the
 * weight, so four of them side by side still read as one quiet screen.
 */
const TONES = [
  {
    dot: "bg-primary-600",
    edge: "border-l-primary-600",
    card: "bg-primary-50/50 border-primary-100",
    chip: "bg-primary-100 text-primary-700",
    face: "bg-primary-600 text-white",
  },
  {
    dot: "bg-violet-500",
    edge: "border-l-violet-500",
    card: "bg-violet-50/60 border-violet-100",
    chip: "bg-violet-100 text-violet-700",
    face: "bg-violet-500 text-white",
  },
  {
    dot: "bg-amber-500",
    edge: "border-l-amber-500",
    card: "bg-amber-50/60 border-amber-100",
    chip: "bg-amber-100 text-amber-800",
    face: "bg-amber-500 text-white",
  },
  {
    dot: "bg-rose-500",
    edge: "border-l-rose-500",
    card: "bg-rose-50/60 border-rose-100",
    chip: "bg-rose-100 text-rose-700",
    face: "bg-rose-500 text-white",
  },
  {
    dot: "bg-teal-500",
    edge: "border-l-teal-500",
    card: "bg-teal-50/60 border-teal-100",
    chip: "bg-teal-100 text-teal-700",
    face: "bg-teal-500 text-white",
  },
  {
    dot: "bg-indigo-500",
    edge: "border-l-indigo-500",
    card: "bg-indigo-50/60 border-indigo-100",
    chip: "bg-indigo-100 text-indigo-700",
    face: "bg-indigo-500 text-white",
  },
] as const;

function toneAt(at: number) {
  return TONES[at % TONES.length]!;
}

/** Two letters off a name, for the people the firm has no photograph of. */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** The group itself, at the top, because everything below it belongs to this one application. */
/**
 * One person and everything below them, drawn as a branch.
 *
 * <p>Recursive, because a family is. The alternative — a row per generation, laid out by counting — needs
 * the whole tree's width known before anything is drawn and falls apart the moment one branch is deeper
 * than another, which is the normal case rather than the odd one.
 *
 * <p>The rules are elements rather than borders on the cards. A border belongs to the thing it is drawn on
 * and a connector belongs to the gap between two things; drawn as borders they move whenever a card's
 * padding does, and they did.
 */
function TreeBranch({
  branch,
  toneOfMember,
  picked,
  onPick,
  onInviteUnder,
  mayInvite,
  labelFor,
  clientId,
  holderName,
}: {
  branch: Branch;
  toneOfMember: Map<string, (typeof TONES)[number]>;
  picked: Picked;
  onPick: (picked: Picked) => void;
  onInviteUnder?: (memberId: string) => void;
  mayInvite: boolean;
  labelFor: (code: string | null | undefined) => string;
  clientId: string;
  /** The primary holder's name, for a co-holder's card to say whose co-holder they are. */
  holderName: string | null;
}) {
  const tone = toneOfMember.get(branch.member.id) ?? TONES[0];
  // Everybody drawn under this person: those who have arrived, then those still being waited on.
  const below = [
    ...branch.children.map((child) => ({ key: child.member.id, child, invitation: null })),
    ...branch.invited.map((invitation) => ({ key: invitation.id, child: null, invitation })),
  ];

  return (
    <li className="flex flex-col items-center">
      <MemberNode
        member={branch.member}
        tone={tone}
        relationship={
          branch.member.primaryHolder
            ? "Primary holder"
            : (branch.member.relationshipToPrimary ?? labelFor(branch.member.relationship))
        }
        holderName={holderName}
        isThisClient={branch.member.id === clientId}
        chosen={picked.kind === "member" && picked.id === branch.member.id}
        onPick={() => onPick({ kind: "member", id: branch.member.id })}
      />

      {mayInvite && onInviteUnder && (
        <button
          type="button"
          onClick={() => onInviteUnder(branch.member.id)}
          className="mt-2 rounded-lg border border-line bg-white px-2.5 py-1 text-2xs font-semibold text-ink-soft hover:border-primary-600 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          Invite under {firstNameOf(branch.member.fullName)}
        </button>
      )}

      {below.length > 0 && (
        <>
          <span aria-hidden="true" className={cn("h-6 w-px", RULE)} />
          <ul className="flex items-start">
            {below.map((one, at) => (
              <li key={one.key} className="relative flex flex-col items-center px-3 pt-6">
                {/* Half a rule each side, so two neighbours meet in the middle of the gap between them
                    and a lone child gets no rule at all rather than a stub pointing nowhere. */}
                {at > 0 && <span aria-hidden="true" className={cn("absolute top-0 left-0 h-px w-1/2", RULE)} />}
                {at < below.length - 1 && (
                  <span aria-hidden="true" className={cn("absolute top-0 right-0 h-px w-1/2", RULE)} />
                )}
                <span aria-hidden="true" className={cn("absolute top-0 left-1/2 h-6 w-px", RULE)} />
                {one.child ? (
                  <ul className="flex">
                    <TreeBranch
                      branch={one.child}
                      toneOfMember={toneOfMember}
                      picked={picked}
                      onPick={onPick}
                      onInviteUnder={onInviteUnder}
                      mayInvite={mayInvite}
                      labelFor={labelFor}
                      clientId={clientId}
                      holderName={holderName}
                    />
                  </ul>
                ) : (
                  one.invitation && (
                    <InvitedNode
                      invitation={one.invitation}
                      chosen={picked.kind === "invitation" && picked.id === one.invitation.id}
                      onPick={() => onPick({ kind: "invitation", id: one.invitation.id })}
                    />
                  )
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

/** The mark on the person the account belongs to. */
function Crown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3 shrink-0 text-amber-500">
      <path fill="currentColor" d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-1.8 10H4.8L3 8z" />
    </svg>
  );
}

/** What a desk calls somebody on a button, where their whole name would not fit. */
function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function MemberNode({
  member,
  tone,
  relationship,
  holderName,
  isThisClient,
  chosen,
  onPick,
}: {
  member: FamilyMember;
  tone: (typeof TONES)[number];
  relationship: string;
  holderName: string | null;
  isThisClient: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      className={cn(
        NODE,
        "border-l-4 transition-shadow",
        tone.card,
        tone.edge,
        chosen ? "ring-2 ring-primary-600" : "hover:shadow-sm",
      )}
    >
      {/* The face beside what they are, not above it. A column of avatar-then-text reads as a profile
          picture with a caption; a family chart wants a row of people you can scan down the names of. */}
      <span className="flex items-start gap-2.5">
        {/* Their photograph where the firm holds one. The tint stays behind it: it is what lets a branch
            be followed from its card to its dot in the panel, and on a member the firm has no photograph
            for it is the whole of the mark. */}
        <Avatar name={member.fullName} photo={member.photo} className={cn("size-10", tone.face)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            {member.primaryHolder && <Crown />}
            <span className="line-clamp-2 min-w-0 text-xs font-bold break-words">{member.fullName}</span>
          </span>
          <span className="block truncate text-2xs text-ink-muted">
            {isThisClient ? "this client" : member.code}
          </span>
          <span
            className={cn(
              "mt-1 inline-flex rounded-md px-1.5 py-0.5 text-2xs font-bold",
              member.primaryHolder ? "bg-primary-600 text-white" : tone.chip,
            )}
          >
            {member.primaryHolder
              ? "Primary holder"
              : member.accountHolder
                ? "Joint holder"
                : relationship}
          </span>
          {/* A joint holder is a peer, so the chip says what they hold rather than who they are related
              to. The firm still asked that at onboarding and the desk still wants it, so it goes here —
              and only against the primary holder, which is the only person the form asks it about. */}
          {!member.primaryHolder && member.accountHolder && holderName && (
            <span className="mt-1 block truncate text-2xs text-ink-muted">
              {relationship} of {holderName}
            </span>
          )}
          {/* Only where the two differ. On a flat family every relationship is already to the holder, and
              repeating it underneath would be the card saying the same thing twice. */}
          {member.parentName && member.relationshipToPrimary && (
            <span className="mt-1 block truncate text-2xs text-ink-muted">under {member.parentName}</span>
          )}
        </span>
      </span>
      <span className="mt-auto block space-y-1 border-t border-current/10 pt-2">
        <span className="block text-2xs text-ink-muted">
          Joined <span className="text-ink-soft">{formatDate(member.joinedOn)}</span>
        </span>
        <span className="block text-2xs text-ink-muted">
          {member.bankAccounts === 0
            ? "No bank accounts"
            : `${member.bankAccounts} bank account${member.bankAccounts === 1 ? "" : "s"}`}
        </span>
        <Badge tone={kycStatusTones[member.kycStatus]}>{kycStatusLabels[member.kycStatus]}</Badge>
      </span>
    </button>
  );
}

/**
 * Somebody asked who has not come in.
 *
 * <p>Dashed and amber, and on the same tier as the people. Not because an invitation is a person — it is
 * an address — but because the question this picture answers is "who is this household", and a desk that
 * could not see who had been asked would ask them again.
 */
function InvitedNode({
  invitation,
  chosen,
  onPick,
}: {
  invitation: FamilyInvitationRow;
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      className={cn(
        NODE,
        "border-l-4 border-dashed border-amber-400 border-l-amber-500 bg-amber-50/50 transition-shadow",
        chosen ? "ring-2 ring-amber-500" : "hover:shadow-sm",
      )}
    >
      <span className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-amber-400 bg-white text-xs font-bold text-amber-600"
        >
          ?
        </span>
        <span className="min-w-0">
          <span className="block truncate text-2xs font-bold text-amber-900">{invitation.email}</span>
          <span className="block truncate text-2xs text-amber-700/70">not a client yet</span>
        </span>
      </span>
      <span className="mt-2 inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-2xs font-bold text-amber-800">
        {invitation.relationship} · invited
      </span>
      <span className="mt-auto block space-y-1 border-t border-amber-200 pt-2">
        <span className="block text-2xs text-amber-900/70">
          Asked {formatDate(invitation.invitedAt.slice(0, 10))}
        </span>
        {invitation.joinExpiresAt && (
          <span className="block text-2xs text-amber-900/70">
            Link good until {formatDate(invitation.joinExpiresAt.slice(0, 10))}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Whatever is selected, in full, beside the picture.
 *
 * <p>The group is what it opens on, because the group is what somebody arriving on this tab came to see.
 * Clicking a person swaps the panel rather than navigating: their file is a click further on, and a tab
 * that threw you out of the client you were reading every time you looked at their spouse would be unusable.
 */
function Detail({
  group,
  client,
  family,
  invitations,
  member,
  invitation,
  labelFor,
  openTheir,
  backTo,
  onPickMember,
  onPickInvitation,
}: {
  group: FamilyGroupSummary | null;
  client: CustomerRow;
  family: FamilyMember[];
  invitations: FamilyInvitationRow[];
  member: FamilyMember | undefined;
  invitation: FamilyInvitationRow | undefined;
  labelFor: (code: string | null | undefined) => string;
  openTheir: (id: string) => string;
  backTo: unknown;
  onPickMember: (id: string) => void;
  onPickInvitation: (id: string) => void;
}) {
  if (member) {
    return (
      <Panel
        title={member.fullName}
        mark={member.id === client.id ? "This client" : member.code}
        icon={initialsOf(member.fullName)}
        photo={member.photo}
      >
        <Facts
          rows={[
            ["Relationship", member.primaryHolder ? "Primary holder" : labelFor(member.relationship)],
            ["Joined", formatDate(member.joinedOn)],
            ["Bank accounts", String(member.bankAccounts)],
            ["KYC", kycStatusLabels[member.kycStatus]],
            ["Email", member.email ?? "—"],
          ]}
        />
        {member.id !== client.id && (
          <Link
            to={openTheir(member.id)}
            state={{ from: backTo }}
            className="mt-4 block rounded-lg bg-primary-50 px-3 py-2 text-center text-xs font-bold text-primary-700 hover:bg-primary-100"
          >
            Open their file &rarr;
          </Link>
        )}
      </Panel>
    );
  }

  if (invitation) {
    return (
      <Panel title={invitation.email} mark="Invited — not a client yet" icon="?" amber>
        <Facts
          rows={[
            ["Relationship", invitation.relationship],
            ["Asked", formatDate(invitation.invitedAt.slice(0, 10))],
            ["Asked by", invitation.invitedByName ?? "—"],
            [
              "Link good until",
              invitation.joinExpiresAt ? formatDate(invitation.joinExpiresAt.slice(0, 10)) : "—",
            ],
          ]}
        />
        {invitation.personalMessage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-soft italic">
            &ldquo;{invitation.personalMessage}&rdquo;
          </p>
        )}
        {/* What a desk does about an invitation — resend, cancel, read the password out — is on its row in
            the list, where every invitation is, rather than only on whichever one is selected here. */}
        <p className="mt-3 text-2xs text-ink-muted">
          Resend, cancel or read out their password from the List view.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={group?.name ?? client.fullName}
      mark={group && !group.named ? "Worked out from the surname" : "Family group"}
      icon={<UsersRound />}
    >
      <Facts
        rows={[
          ["Primary holder", group?.primaryHolderName ?? "—"],
          ["Account opened", group?.openedOn ? formatDate(group.openedOn) : "—"],
          ["Members", String(family.length)],
          [
            "Waiting on",
            invitations.length === 0
              ? "Nobody"
              : `${invitations.length} invitation${invitations.length === 1 ? "" : "s"}`,
          ],
        ]}
      />
      <ul className="mt-4 border-t border-line pt-1">
        {family.map((one, at) => (
          <li key={one.id}>
            <button
              type="button"
              onClick={() => onPickMember(one.id)}
              className="flex w-full items-center gap-2 rounded border-b border-line py-2 text-left last:border-0 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", toneAt(at).dot)} />
              <span className="flex-1 truncate text-xs font-semibold">{one.fullName}</span>
              <span className="text-2xs whitespace-nowrap text-ink-muted">
                {one.primaryHolder ? "Primary" : labelFor(one.relationship)}
              </span>
            </button>
          </li>
        ))}
        {invitations.map((one) => (
          <li key={one.id}>
            <button
              type="button"
              onClick={() => onPickInvitation(one.id)}
              className="flex w-full items-center gap-2 rounded border-b border-line py-2 text-left last:border-0 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="flex-1 truncate text-xs font-semibold text-amber-900">{one.email}</span>
              <span className="text-2xs whitespace-nowrap text-amber-700">Invited</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Panel({
  title,
  mark,
  icon,
  photo,
  amber,
  children,
}: {
  title: string;
  mark: string;
  icon: React.ReactNode;
  /** Their photograph, where the firm has one; the icon stands in where it has not. */
  photo?: string | null;
  amber?: boolean;
  children: React.ReactNode;
}) {
  // A photograph that will not load falls back to the icon rather than to a hole, the same way the
  // shared avatar does.
  const [broken, setBroken] = useState(false);
  const showing = photo && !broken;
  return (
    <aside className="h-fit rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-bold [&_svg]:size-5",
            amber
              ? "border border-dashed border-amber-400 bg-amber-50 text-amber-600"
              : showing
                ? "bg-slate-200"
                : "bg-primary-600 text-white",
          )}
        >
          {showing ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              onError={() => setBroken(true)}
              className="size-full object-cover"
            />
          ) : (
            icon
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{title}</p>
          <span className="mt-0.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-ink-soft">
            {mark}
          </span>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4">{children}</div>
    </aside>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="shrink-0 text-xs text-ink-muted">{label}</dt>
          <dd className="truncate text-xs font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One of the three totals under the chart, with what makes it up. */
function Counted({
  icon,
  tint,
  label,
  total,
  rows,
  empty,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  total: number;
  rows: readonly (readonly [string, number])[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn("grid size-8 place-items-center rounded-lg [&_svg]:size-4", tint)}>
          {icon}
        </span>
        <div>
          <p className="text-2xs font-bold tracking-wider text-ink-muted uppercase">{label}</p>
          <p className="text-xl font-bold tabular-nums">{total}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
        {rows.length === 0 ? (
          <li className="text-xs text-ink-muted">{empty}</li>
        ) : (
          rows.map(([name, count]) => (
            <li key={name} className="flex justify-between gap-3 text-xs">
              <span className="truncate text-ink-muted">{name}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** The members broken down by what they are to the account, primary holder first and counted apart. */
function byRelationship(family: FamilyMember[], labelFor: (code: string | null | undefined) => string) {
  const counts = new Map<string, number>();
  for (const member of family) {
    const name = member.primaryHolder ? "Primary holder" : labelFor(member.relationship) || "Not recorded";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => [name, count] as const);
}
