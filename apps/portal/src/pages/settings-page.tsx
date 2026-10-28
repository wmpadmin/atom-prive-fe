import { ApiError } from "@atomprive/api-client";
import {
  getNotificationsQueryKey,
  useChooseNotifications,
  useFamily,
  useMe,
  useNotifications,
  useRemoveFromMyFamily,
  useRenameMyFamily,
  type FamilyPerson,
  type Me,
  type MyFamily,
  type MyNotifications,
} from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { Face } from "./invitation-card";
import { Aside, Headings, Heading, Nothing, Pill, Row, Table } from "./panels";
import { toneAt } from "./family-tree";

/**
 * The handful of things on this screen a client may actually change.
 *
 * <p>Deliberately short. Almost everything a client reads about themselves is the firm's record of them —
 * their name, their email, their mobile — and changing it is a desk's job with a reason and an audit entry
 * behind it. A settings screen that let a client edit those would be a settings screen that let somebody
 * quietly change the identity the firm has verified.
 *
 * <p>What is theirs: their photograph, what their family group is called, who is in it, and what they want
 * to be told about.
 */
export function SettingsPage() {
  const me = useMe<Me, ApiError>();
  const family = useFamily<MyFamily, ApiError>();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <Heading title="Settings" blurb="Your details, your family group, and what we tell you about." />

        <Profile me={me.data} failed={me.error} />
        <Group family={family.data} failed={family.error} />
        <Notifications />
      </div>

      <aside className="space-y-4">
        <Aside title="Why most of this is read-only">
          <p>
            Your name, email and mobile are on your client file for regulatory reasons, and the firm keeps a
            record of every change to them. Tell your relationship manager and they will put it right.
          </p>
        </Aside>

        <Aside title="Your photograph">
          <p>
            Yours to set, from the circle beside your name at the top of any screen. It appears on your
            family tree and nowhere outside your group.
          </p>
        </Aside>

        <Aside title="Nothing is sent yet">
          <p>
            We are recording what you want to be told about, but no email or message goes out of the
            platform today. Your choices are kept and will apply the moment it does.
          </p>
        </Aside>
      </aside>
    </div>
  );
}

/** What the firm has down about this client. Every field of it read-only; see the class note. */
function Profile({ me, failed }: { me: Me | undefined; failed: ApiError | null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <h2 className="text-base font-bold text-slate-900">Profile information</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        What the firm holds on your client file. To change any of it, speak to your relationship manager.
      </p>

      {failed && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {failed.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-5 border-t border-slate-100 pt-4">
        <span className="shrink-0">
          {me?.photo ? (
            <img src={me.photo} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <Face name={me?.fullName ?? ""} />
          )}
        </span>
        <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Full name">{me?.fullName ?? "—"}</Fact>
          <Fact label="Client code">
            <span className="tabular-nums">{me?.code ?? "—"}</span>
          </Fact>
          <Fact label="Email">{me?.email ?? "Not on file"}</Fact>
          <Fact label="Mobile">{me?.mobile ?? "Not on file"}</Fact>
          <Fact label="Client since">{me?.joinedOn ? when(me.joinedOn) : "—"}</Fact>
        </dl>
      </div>
    </section>
  );
}

/**
 * The family group's name, and who is in it.
 *
 * <p>Both are the holder's. Everybody else reads the same panel without the controls, because knowing who
 * is on your own account is not the holder's secret — and a screen that hid the list from the rest of the
 * family would be hiding the one thing membership actually means.
 */
function Group({ family, failed }: { family: MyFamily | undefined; failed: ApiError | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const people = family?.people ?? [];
  const yours = family?.youArePrimary ?? false;
  const rename = useRenameMyFamily<ApiError>({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        void queryClient.invalidateQueries();
      },
    },
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Family group</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {yours
              ? "Yours to name, and yours to decide who is counted as part of it."
              : "The group you are part of. The primary holder names it and decides who is in it."}
          </p>
        </div>
        {/* Gated on the same test as the panel below it. The server names a household of one after its
            holder, so without this a lone client reads "Rahul Family" directly above "You are not in a
            family group". */}
        {people.length > 1 && family?.name && <Pill tone="cool">{family.name}</Pill>}
      </div>

      {failed && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {failed.message}
        </p>
      )}

      {people.length < 2 ? (
        <Nothing>
          You are not in a family group. The firm invites family members on your behalf — speak to your
          relationship manager.
        </Nothing>
      ) : (
        <>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">Group name</p>
            {yours && editing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Mehta Family"
                  className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={rename.isPending}
                  onClick={() => rename.mutate({ data: { name: name.trim() } })}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {rename.isPending ? "Saving…" : "Save name"}
                </button>
                <button
                  type="button"
                  disabled={rename.isPending}
                  onClick={() => {
                    // The failure goes with the box it belongs to. Left behind, it sits under "Group
                    // name" attached to nothing and makes the next attempt look as though it has already
                    // failed.
                    rename.reset();
                    setName(family?.name ?? "");
                    setEditing(false);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                {/* Emptying it is not a mistake: the worked-out name comes back, which is what somebody
                    clearing the box is asking for. */}
                <span className="text-2xs text-slate-400">
                  Leave it empty to go back to &ldquo;{workedOut(family)}&rdquo;.
                </span>
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">{family?.name ?? "—"}</p>
                {yours && (
                  <button
                    type="button"
                    onClick={() => {
                      // Seeded here rather than kept in step by an effect: the box only matters while it
                      // is open, and the one moment it needs the current name is the moment it opens.
                      rename.reset();
                      setName(family?.name ?? "");
                      setEditing(true);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Rename
                  </button>
                )}
              </div>
            )}
            {rename.isError && <p className="mt-2 text-xs text-red-600">{rename.error.message}</p>}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">
              Members ({people.length})
            </p>
            <div className="mt-2">
              <Table minWidth="42rem">
                <Headings
                  of={["Member", "Relationship", "Joined", ["Actions", "right"]]}
                />
                <tbody>
                  {people.map((person, at) => (
                    <Member key={person.id} person={person} at={at} yours={yours} />
                  ))}
                </tbody>
              </Table>
            </div>
            {!yours && (
              <p className="mt-3 text-xs text-slate-500">
                You can leave this group yourself from{" "}
                <Link to="/family" className="font-semibold text-blue-700 hover:underline">
                  your family
                </Link>
                .
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** One member, with the holder's one control against them. */
function Member({ person, at, yours }: { person: FamilyPerson; at: number; yours: boolean }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const remove = useRemoveFromMyFamily<ApiError>({
    mutation: {
      onSuccess: () => {
        setAsking(false);
        void queryClient.invalidateQueries();
      },
    },
  });
  const tone = toneAt(at);

  return (
    <>
      <Row>
        <td className="px-4 py-3">
          <span className="flex items-center gap-3">
            {person.photo ? (
              <img src={person.photo} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden="true"
                className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${tone.face}`}
              >
                {initials(person.fullName)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {person.fullName}
                {person.you && <span className="ml-1.5 font-normal text-slate-400">(you)</span>}
              </span>
              {person.primaryHolder && (
                <span className="block text-xs text-slate-500">Primary holder</span>
              )}
            </span>
          </span>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700">
          {person.relationship ?? "Primary holder"}
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">{when(person.joinedOn)}</td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {/* Not the holder, and not the holder themselves: taking yourself out of your own group is
              leaving it, which is a different thing and lives on the family screen. */}
          {yours && !person.primaryHolder && !person.you ? (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="text-xs font-semibold text-slate-500 hover:text-red-600"
            >
              Remove
            </button>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
      </Row>

      {asking && (
        <tr className="border-b border-slate-100">
          <td colSpan={4} className="px-4 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
              <p className="text-sm text-slate-800">Take {person.fullName} out of your family group?</p>
              <p className="mt-0.5 text-xs text-slate-500">
                They stay a client of the firm with their own account. What ends is their place in this
                group — and any sharing between the two of you, in both directions.
              </p>
              {remove.isError && <p className="mt-2 text-xs text-red-600">{remove.error.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ memberId: person.id })}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {remove.isPending ? "Removing…" : "Remove them"}
                </button>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => setAsking(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const SWITCHES = [
  ["accessRequests", "Access requests", "Somebody asks to see one of your accounts."],
  ["accessDecisions", "Answers to what you asked", "A family member approves or refuses your request."],
  ["familyChanges", "Family group changes", "Somebody joins or leaves, or asks to be called something else."],
  ["accountActivity", "Account access activity", "A family member reads an account you have shared."],
] as const;

/**
 * What this client wants to be told about.
 *
 * <p>Saved as a set rather than one switch at a time. A payload carrying a single change would read as
 * "leave the rest alone" to this screen and as "turn the rest off" to the server, and the difference would
 * not show up until somebody stopped being told something.
 */
function Notifications() {
  const queryClient = useQueryClient();
  const held = useNotifications<MyNotifications, ApiError>();
  const choose = useChooseNotifications<ApiError>({
    mutation: {
      onSuccess: (saved) => {
        // The draft is dropped the moment it is saved, and the server's own answer takes its place. Kept,
        // it would outlive the save: a later change made anywhere else would arrive on the next refetch
        // and the screen would go on drawing the stale local copy, offer to save it again, and quietly
        // put the old set back.
        setDraft(null);
        queryClient.setQueryData(getNotificationsQueryKey(), saved);
        void queryClient.invalidateQueries();
      },
    },
  });

  // Untouched until somebody ticks something, and then it is what they ticked. Not kept in step with the
  // server by an effect: this screen is the only thing that changes these, so the server's answer and an
  // untouched draft are the same set of four answers.
  const [draft, setDraft] = useState<MyNotifications | null>(null);
  const shown = draft ?? held.data;
  const changed =
    shown != null && held.data != null && SWITCHES.some(([key]) => shown[key] !== held.data[key]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <h2 className="text-base font-bold text-slate-900">Notification preferences</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        What we will tell you about. Nothing is sent out of the platform yet; your choices are kept for when
        it is.
      </p>

      {held.isError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {held.error.message}
        </p>
      )}

      {/* Not drawn until the answer is in. Four unchecked boxes are a statement — that this client asked
          not to be told anything — and drawing them before the server has said so tells them that and
          then ticks itself in front of them. */}
      {shown == null ? (
        <Nothing>
          {held.isError ? "We could not read your preferences." : "Reading your preferences…"}
        </Nothing>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {SWITCHES.map(([key, label, blurb]) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <input
                  type="checkbox"
                  checked={shown[key]}
                  onChange={(event) => setDraft({ ...shown, [key]: event.target.checked })}
                  className="mt-0.5 size-4"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{blurb}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {choose.isError && <p className="mt-2 text-xs text-red-600">{choose.error.message}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {choose.isSuccess && !changed && <span className="text-xs text-emerald-700">Saved.</span>}
        <button
          type="button"
          disabled={!changed || choose.isPending || shown == null}
          onClick={() => shown != null && choose.mutate({ data: shown })}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {choose.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * The name the platform works out when the firm has not chosen one: the holder's first name and "Family".
 *
 * <p>Said rather than shown, and only as a hint beside an empty box. The name itself always comes from the
 * server — this is the screen explaining what clearing the box will do, not a second place that decides it.
 */
function workedOut(family: MyFamily | undefined) {
  const holder = family?.people.find((one) => one.primaryHolder) ?? family?.people[0];
  return `${holder?.fullName.split(" ")[0] ?? ""} Family`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}
