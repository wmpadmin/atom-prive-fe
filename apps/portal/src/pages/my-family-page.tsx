import { ApiError } from "@atomprive/api-client";
import {
  useAnswerRelationshipRequest,
  useAskToBeCalled,
  useFamily,
  useLeaveFamily,
  type FamilyPerson,
  type MyFamily,
  type RelationshipAsk,
} from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { initialsOf, toneAt, treeOf, type Branch, type TONES } from "./family-tree";

/**
 * The client's own family group: who is on the account, how they are related, and who can see whose money.
 *
 * <p>The two are deliberately apart on this screen. The tree says what people are to each other; the
 * Access Status column says who may read whose accounts. Being in the family puts nothing in that column,
 * which is the whole reason it is a column rather than something the tree implies.
 */
export function MyFamilyPage() {
  const [tab, setTab] = useState<"members" | "invitations">("members");
  const [find, setFind] = useState("");
  const family = useFamily<MyFamily, ApiError>();

  if (family.isPending) {
    return <p className="text-sm text-slate-500">Reading your family group…</p>;
  }
  if (family.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {family.error.message}
      </p>
    );
  }

  const {
    name,
    openedOn,
    people,
    asked,
    youArePrimary,
    relationshipAsks,
    generations,
    bankAccountsInTheGroup,
  } = family.data;
  const me = people.find((person) => person.you);
  const mayLeave = people.length > 1 && me !== undefined && !me.primaryHolder;
  const holder = people.find((person) => person.primaryHolder);
  const roots = treeOf(people);
  // Whose co-holder a co-holder is. The client's own screen has no group summary to read it off, so it
  // comes from the one person on the chart the server flagged as primary.
  const holderName = people.find((person) => person.primaryHolder)?.fullName ?? null;
  // A colour per person, fixed by where they sit in the group — two children drawn in one colour would
  // be the picture saying they were the same person.
  const tones = new Map(people.map((person, at) => [person.id, toneAt(at)]));
  const looking = find.trim().toLowerCase();
  const shown = looking ? people.filter((one) => one.fullName.toLowerCase().includes(looking)) : people;

  return (
    <div className="space-y-5">
      {/* Above the two columns, not inside the left one. Inside it, the rail began level with the heading
          and the card below it did not, so the two columns started on different lines. */}
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Family</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your family group, your relationships and who can see which accounts.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{name ?? "Your family"}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {openedOn ? `Created on ${when(openedOn)}` : "Created with your account"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Figure label="Members" value={people.length} />
              <Figure label="Generations" value={generations} />
              {/* The sum of the column one table down, and it has to stay that way: a total that cannot
                  be reconciled with the rows under it reads as a bug, whatever it is actually counting. */}
              <Figure label="Bank Accounts" value={bankAccountsInTheGroup ?? 0} />
            </div>
          </div>

          {/* No node above the people here, ever. The node stands for the entity, and only an entity
              client has one — an entity has no email address, and a portal session is begun against an
              email, so nobody reading this screen is an entity. The group's name and what it holds are
              said in the header above and the rail beside it, which is where they belong. */}
          <div className="mt-6 overflow-x-auto">
            <ul className="mx-auto flex w-max items-start gap-8">
              {roots.map((root) => (
                <TreeBranch key={root.person.id} branch={root} tones={tones} holderName={holderName} />
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
            <div role="tablist" aria-label="Which list" className="flex gap-1">
              {(
                [
                  ["members", `Family Members (${people.length})`],
                  ["invitations", `Invitations (${asked.length})`],
                ] as const
              ).map(([which, label]) => (
                <button
                  key={which}
                  type="button"
                  role="tab"
                  aria-selected={tab === which}
                  onClick={() => setTab(which)}
                  className={
                    tab === which
                      ? "-mb-[13px] border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700"
                      : "-mb-[13px] border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "members" && (
              <input
                type="search"
                aria-label="Search family members"
                placeholder="Search family members…"
                value={find}
                onChange={(event) => setFind(event.target.value)}
                className="ml-auto w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            )}
          </div>

          {tab === "members" ? (
            <Members people={shown} />
          ) : (
            <Invitations asked={asked} />
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <h2 className="text-sm font-bold text-slate-900">Family Group Details</h2>
          <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
            <Detail label="Group Name">{name ?? "Not named yet"}</Detail>
            <Detail label="Primary Holder">{holder?.fullName ?? "—"}</Detail>
            <Detail label="Created On">{openedOn ? when(openedOn) : "—"}</Detail>
            <Detail label="Total Members">{people.length}</Detail>
            <Detail label="Generations">{generations}</Detail>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
          <ul className="mt-3 space-y-1">
            <Action to="/access">View Access Requests</Action>
            <Action to="/permissions">Manage Permissions</Action>
            <Action to="/accounts">View Accounts</Action>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <h2 className="text-sm font-bold text-slate-900">Relationship Management</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Family members can update their own relationship type. Changes require approval by the primary
            holder.
          </p>
          {relationshipAsks.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {relationshipAsks.map((ask) => (
                <RelationshipAskRow key={ask.id} ask={ask} youArePrimary={youArePrimary} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Nothing is waiting.</p>
          )}
          {me && !me.primaryHolder && !relationshipAsks.some((ask) => ask.mine) && (
            <AskToBeCalled now={me.relationship} />
          )}
        </div>

        {mayLeave && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <h2 className="text-sm font-bold text-slate-900">Leave Group</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              You can leave this family group. Your own account and data remain intact.
            </p>
            <LeaveGroup familyName={name ?? "this family group"} />
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}

/** One of the three figures beside the family's name. */
function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
      <span className="text-lg font-bold text-slate-900 tabular-nums">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

/**
 * One person and everything below them.
 *
 * <p>Recursive, because a family is. The rules are elements rather than borders on the cards: a border
 * belongs to the thing it is drawn on, and a connector belongs to the gap between two things.
 */
function TreeBranch({
  branch,
  tones,
  holderName,
}: {
  branch: Branch;
  tones: Tones;
  /** The primary holder's name, so a co-holder's card can say whose co-holder they are. */
  holderName: string | null;
}) {
  const { person, children } = branch;
  const tone = tones.get(person.id) ?? toneAt(0);
  return (
    <li className="flex flex-col items-center">
      <div
        className={`flex w-56 items-start gap-3 rounded-xl border border-l-4 px-3.5 py-3 ${tone.card} ${
          tone.edge
        } ${person.you ? "ring-2 ring-blue-500" : ""}`}
      >
        <Face person={person} big tone={tone.face} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            {person.primaryHolder && <Crown />}
            <span className="min-w-0 truncate text-sm font-bold text-slate-900">{person.fullName}</span>
          </p>
          {person.primaryHolder && <p className="truncate text-xs text-slate-500">Primary holder</p>}
          {/* A joint holder is a peer of the primary holder, not somebody beneath them. The card says
              what they hold, then what they are to the holder — which is still a thing worth knowing
              and is the only relationship the firm ever asked them for. */}
          {!person.primaryHolder && person.accountHolder && (
            <p className="truncate text-xs font-semibold text-slate-600">Joint holder</p>
          )}
          {/* Nothing under the holder's own line. relationshipToPrimary reads "Primary holder" for the
              holder themselves, so printing it here put the words on their card twice. */}
          {!person.primaryHolder && (
            <p className="truncate text-xs text-slate-500">
              {person.accountHolder
                ? person.relationship && holderName
                  ? `${person.relationship} of ${holderName}`
                  : (person.relationship ?? "")
                : (person.relationshipToPrimary ?? person.relationship ?? "Family")}
            </p>
          )}
          {person.you && <p className="mt-0.5 text-2xs font-semibold text-blue-700">You</p>}
        </div>
      </div>

      {children.length > 0 && (
        <>
          <span aria-hidden="true" className="h-6 w-px bg-slate-300" />
          <ul className="flex items-start">
            {children.map((child, at) => (
              <li key={child.person.id} className="relative flex flex-col items-center px-3 pt-6">
                {/* Half a rule each side, so two neighbours meet in the middle of the gap between them and
                    a lone child gets no rule at all rather than a stub pointing nowhere. */}
                {at > 0 && (
                  <span aria-hidden="true" className="absolute top-0 left-0 h-px w-1/2 bg-slate-300" />
                )}
                {at < children.length - 1 && (
                  <span aria-hidden="true" className="absolute top-0 right-0 h-px w-1/2 bg-slate-300" />
                )}
                <span aria-hidden="true" className="absolute top-0 left-1/2 h-6 w-px bg-slate-300" />
                <ul className="flex">
                  <TreeBranch branch={child} tones={tones} holderName={holderName} />
                </ul>
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 shrink-0 text-amber-500">
      <path fill="currentColor" d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-1.8 10H4.8L3 8z" />
    </svg>
  );
}

/** What colour each person is drawn in, by their id. */
type Tones = Map<string, (typeof TONES)[number]>;

/** Their photograph where the firm holds one, and their initials where it does not. */
function Face({
  person,
  big,
  tone = "bg-slate-800 text-slate-200",
}: {
  person: FamilyPerson;
  big?: boolean;
  tone?: string;
}) {
  const size = big ? "size-12 text-sm" : "size-9 text-xs";
  if (person.photo) {
    return <img src={person.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${size} ${tone} grid shrink-0 place-items-center rounded-full font-bold`}
    >
      {initialsOf(person.fullName)}
    </span>
  );
}

/** The members table, with the access column kept apart from the relationship one. */
function Members({ people }: { people: FamilyPerson[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-2xs font-semibold tracking-wider text-slate-500 uppercase">
            <th className="px-5 py-2.5 text-left">Name</th>
            <th className="px-4 py-2.5 text-left">Relationship (to primary)</th>
            <th className="px-4 py-2.5 text-left">Join Date</th>
            <th className="px-4 py-2.5 text-center">Shared Bank Accounts</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b border-slate-100 align-middle last:border-0">
              <td className="px-5 py-3">
                <span className="flex items-center gap-3">
                  <Face person={person} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {person.fullName}
                      {person.you && <span className="ml-2 text-xs font-normal text-slate-500">· you</span>}
                    </span>
                  </span>
                </span>
              </td>
              {/* Said here rather than under their name. It was in both places, which is the same word
                  printed twice on one row. */}
              <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700">
                {person.primaryHolder
                  ? "Primary holder"
                  : (person.relationshipToPrimary ?? person.relationship ?? "Family")}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">{when(person.joinedOn)}</td>
              {/* How many of theirs you may actually open, against how many they hold. Nought of four is
                  the ordinary state and is the point of the column: being in this group opened nothing.
                  The count beside it is the only place the group's banking is said now, so your own row
                  carries a figure rather than a dash — a blank cell among full ones reads as one that
                  failed to load. It says "All 3" and not "3 of 3": on your own accounts there is nothing
                  to grant, and the word shared does not describe them. */}
              <td className="px-4 py-3 text-center text-sm whitespace-nowrap text-slate-700 tabular-nums">
                {person.bankAccounts == null ? (
                  <span className="text-slate-400">—</span>
                ) : person.you ? (
                  <span className={person.bankAccounts > 0 ? "font-semibold text-slate-900" : undefined}>
                    {person.bankAccounts > 0 ? `All ${person.bankAccounts}` : "None"}
                  </span>
                ) : (
                  <>
                    <span className={person.iCanSeeTheirs > 0 ? "font-semibold text-slate-900" : undefined}>
                      {person.iCanSeeTheirs}
                    </span>
                    <span className="text-slate-500"> of {person.bankAccounts}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The column above reads as a puzzle without this. Sharing is the exception on this screen, not
          something the family group itself confers — which is the one thing a reader assumes it confers. */}
      <p className="px-5 py-3 text-xs text-slate-500">
        Access is given one account at a time and can be withdrawn at any time. Being in this family group
        does not give anyone access on its own.
      </p>
    </div>
  );
}

/** Every invitation this family has sent, and what became of each. */
function Invitations({ asked }: { asked: MyFamily["asked"] }) {
  if (asked.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500">
        Nobody has been invited to this family group.
      </p>
    );
  }
  const tones: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    accepted: "bg-emerald-100 text-emerald-800",
    revoked: "bg-slate-200 text-slate-600",
    declined: "bg-red-100 text-red-800",
    expired: "bg-slate-200 text-slate-600",
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-2xs font-semibold tracking-wider text-slate-500 uppercase">
            <th className="px-5 py-2.5 text-left">Email</th>
            <th className="px-4 py-2.5 text-left">Relationship</th>
            <th className="px-4 py-2.5 text-left">Sent</th>
            <th className="px-4 py-2.5 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {asked.map((one) => (
            <tr key={one.id} className="border-b border-slate-100 text-sm last:border-0">
              <td className="px-5 py-3 text-slate-900">{one.email}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-700">{one.relationship}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{when(one.invitedAt)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    tones[one.status] ?? "bg-slate-200 text-slate-600"
                  }`}
                >
                  {one.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The firm invites and the firm chases. A client pressing Resend here would be a client sending mail
          in the firm's name, which is not a thing this portal does. */}
      <p className="px-5 py-3 text-xs text-slate-500">
        Your relationship manager sends these. Ask them if one needs sending again.
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="truncate text-xs font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

function Action({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
      >
        {children}
        <span aria-hidden="true" className="text-slate-300">
          &rsaquo;
        </span>
      </Link>
    </li>
  );
}

/**
 * A member saying the firm has them down as the wrong thing.
 *
 * <p>A request, not a change. The label is how the holder describes their own household, so the member
 * proposes it and the holder agrees — which is why the button says ask and not save.
 */
function AskToBeCalled({ now }: { now: string | null }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const ask = useAskToBeCalled<ApiError>({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setCode("");
        void queryClient.invalidateQueries();
      },
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block text-xs font-semibold text-blue-700 underline hover:text-blue-800"
      >
        {now ? `You are down as a ${now.toLowerCase()} — ask to change it` : "Ask to set your relationship"}
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <select
        aria-label="What you are to this family"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Choose one…</option>
        {RELATIONSHIPS.map((one) => (
          <option key={one.code} value={one.code}>
            {one.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ask.isPending || code === ""}
          onClick={() => ask.mutate({ data: { relationshipCode: code } })}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {ask.isPending ? "Asking…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600"
        >
          Cancel
        </button>
      </div>
      {ask.isError && <p className="text-xs text-red-600">{ask.error.message}</p>}
    </div>
  );
}

/**
 * The firm's relationship types, as the portal offers them.
 *
 * <p>Written out here rather than read from the firm's own list, which the back-office does. A client has
 * no business reading the firm's configuration, and these five are the ones every screen has offered since
 * the list was seeded.
 */
const RELATIONSHIPS = [
  { code: "SPOUSE", name: "Spouse" },
  { code: "CHILD", name: "Child" },
  { code: "PARENT", name: "Parent" },
  { code: "SIBLING", name: "Sibling" },
  { code: "OTHER", name: "Other" },
] as const;

/** One relationship request, as the holder answers it or as the person who made it waits on it. */
function RelationshipAskRow({ ask, youArePrimary }: { ask: RelationshipAsk; youArePrimary: boolean }) {
  const queryClient = useQueryClient();
  const answer = useAnswerRelationshipRequest<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });

  return (
    <li className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2.5">
      <p className="text-xs text-slate-800">
        <b>{ask.mine ? "You" : ask.fullName}</b> asked to be recorded as <b>{ask.to.toLowerCase()}</b>
        {ask.from && <> instead of {ask.from.toLowerCase()}</>}.
      </p>
      {youArePrimary ? (
        <span className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ id: ask.id, answer: "approve" })}
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            Agree
          </button>
          <button
            type="button"
            disabled={answer.isPending}
            onClick={() => answer.mutate({ id: ask.id, answer: "reject" })}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-60"
          >
            Decline
          </button>
        </span>
      ) : (
        <p className="mt-1 text-2xs font-semibold text-slate-500">Waiting on the primary holder</p>
      )}
      {answer.isError && <p className="mt-1 text-xs text-red-600">{answer.error.message}</p>}
    </li>
  );
}

/**
 * Leaving the group, which is the one change to a household a client can make themselves.
 *
 * <p>Behind a confirmation because it is irreversible from this side: the firm has to invite them back.
 */
function LeaveGroup({ familyName }: { familyName: string }) {
  const [asking, setAsking] = useState(false);
  const queryClient = useQueryClient();
  const leave = useLeaveFamily<ApiError>({
    mutation: {
      onSuccess: () => {
        setAsking(false);
        void queryClient.invalidateQueries();
      },
    },
  });

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="mt-4 block w-full rounded-xl border border-red-300 px-4 py-2.5 text-center text-sm font-bold text-red-600 hover:bg-red-50"
      >
        Leave Group
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
      <p className="text-xs text-slate-800">Leave {familyName}?</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        <li>All cross-access grants are revoked, both ways.</li>
        <li>Your own account and bank data remain intact.</li>
        <li>The firm has to invite you again to come back.</li>
      </ul>
      {leave.isError && <p className="mt-2 text-xs text-red-600">{leave.error.message}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={leave.isPending}
          onClick={() => leave.mutate()}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {leave.isPending ? "Leaving…" : "Leave group"}
        </button>
        <button
          type="button"
          disabled={leave.isPending}
          onClick={() => setAsking(false)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
