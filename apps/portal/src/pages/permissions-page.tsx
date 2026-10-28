import { ApiError } from "@atomprive/api-client";
import {
  usePermissions,
  useRelinquish,
  useRevoke,
  type GrantRow,
  type MyPermissions,
} from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { accountKind } from "../lib/money";
import { Face } from "./invitation-card";
import { Aside, Card, Heading, Headings, Nothing, Pill, Row, Table, Tabs, Tick, Tile } from "./panels";

/**
 * Who can see your money, and whose you can see.
 *
 * <p>Two lists, and the second matters more than it looks. A client who can see a relative's accounts ought
 * to be able to find that out and hand it back without asking anybody — sharing that can only be ended by
 * the person who granted it is sharing somebody is stuck with.
 *
 * <p>Ended grants stay on the list, greyed, saying how they ended. What somebody could see, and until when,
 * is a question about a date in the past, and a list that quietly dropped the answer would be a record of
 * only the present.
 */
export function PermissionsPage() {
  const [side, setSide] = useState<"given" | "held">("given");
  const [live, setLive] = useState(true);
  const permissions = usePermissions<MyPermissions, ApiError>();

  const { rows, liveGiven, liveHeld, ended } = useMemo(() => {
    const given = permissions.data?.given ?? [];
    const held = permissions.data?.held ?? [];
    const forSide = side === "given" ? given : held;
    return {
      rows: live ? forSide.filter((one) => one.live) : forSide,
      liveGiven: given.filter((one) => one.live).length,
      liveHeld: held.filter((one) => one.live).length,
      ended: [...given, ...held].filter((one) => !one.live).length,
    };
  }, [permissions.data, side, live]);

  if (permissions.isPending) {
    return <p className="text-sm text-slate-500">Reading your permissions…</p>;
  }
  if (permissions.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {permissions.error.message}
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <Heading title="Permissions" blurb="Who can see your money, and whose you can see." />

        <div className="grid gap-4 sm:grid-cols-3">
          <Tile tint="bg-blue-50 text-blue-700" label="You have granted" value={String(liveGiven)}>
            Accounts of yours a relative may read
          </Tile>
          <Tile tint="bg-violet-50 text-violet-700" label="You have been granted" value={String(liveHeld)}>
            Relatives&rsquo; accounts you may read
          </Tile>
          <Tile tint="bg-slate-100 text-slate-600" label="Ended" value={String(ended)}>
            Expired, revoked or given back
          </Tile>
        </div>

        <Card
          bar={
            <>
              <Tabs
                label="Which permissions"
                chosen={side}
                onChoose={setSide}
                tabs={[
                  ["given", `Access you granted${liveGiven > 0 ? ` (${liveGiven})` : ""}`],
                  ["held", `Access you have${liveHeld > 0 ? ` (${liveHeld})` : ""}`],
                ]}
              />
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={live}
                  onChange={(event) => setLive(event.target.checked)}
                  className="size-4"
                />
                Active only
              </label>
            </>
          }
        >
          {rows.length === 0 ? (
            <Nothing>
              {side === "given"
                ? live
                  ? "You are not sharing any account with anybody."
                  : "You have never shared an account."
                : live
                  ? "Nobody is sharing an account with you."
                  : "Nobody has ever shared an account with you."}
            </Nothing>
          ) : (
            <Table minWidth="60rem">
              <Headings
                of={[
                  "Family member",
                  "Account",
                  "Access type",
                  "Granted on",
                  "Expires",
                  "Status",
                  ["Actions", "right"],
                ]}
              />
              <tbody>
                {rows.map((grant) => (
                  <GrantLine key={grant.id} grant={grant} mine={side === "given"} />
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Aside title="What a grant is">
          <p>
            One account, one person, view-only. It is not a setting on your family group and not something
            being a relative gives anybody — the holder of each account decides it, each time.
          </p>
          <ul className="space-y-2.5 border-t border-slate-100 pt-4">
            <Tick>Balances and movements, nothing else.</Tick>
            <Tick>No moving money, and no sharing it onward.</Tick>
            <Tick>Either side can end it at any time.</Tick>
          </ul>
        </Aside>

        <Aside title="Every use is recorded">
          <p>
            When somebody reads an account you shared, it goes on your report — once a day for each person
            who reads it, with the day and who read it.
          </p>
          <Link
            to="/reports"
            className="mt-4 block rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Open your report &rarr;
          </Link>
        </Aside>
      </aside>
    </div>
  );
}

/** One grant, from whichever side. The button differs; everything else is the same fact. */
function GrantLine({ grant, mine }: { grant: GrantRow; mine: boolean }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const done = {
    mutation: {
      onSuccess: () => {
        setAsking(false);
        void queryClient.invalidateQueries();
      },
    },
  };
  const revoke = useRevoke<ApiError>(done);
  const relinquish = useRelinquish<ApiError>(done);
  const busy = revoke.isPending || relinquish.isPending;
  const failed = revoke.error ?? relinquish.error;

  return (
    <>
      <Row faded={!grant.live}>
        <td className="px-4 py-3">
          <span className="flex items-center gap-3">
            <Face name={grant.theirName} photo={grant.theirPhoto} small />
            <span className="min-w-0">
              <span
                className={`block truncate text-sm font-semibold ${grant.live ? "text-slate-900" : "text-slate-500"}`}
              >
                {grant.theirName}
              </span>
              <span className="block text-xs text-slate-500">
                {mine ? "may read your account" : "shared theirs with you"}
              </span>
            </span>
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block truncate text-sm text-slate-900">
            {grant.bankName} <span className="text-slate-400">••{grant.lastFour}</span>
          </span>
          <span className="block text-xs text-slate-500">{accountKind(grant.accountType)}</span>
        </td>
        <td className="px-4 py-3">
          <Pill tone="cool">View only</Pill>
        </td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">{when(grant.grantedAt)}</td>
        <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">
          {grant.expiresOn ? when(grant.expiresOn) : "No end date"}
        </td>
        <td className="px-4 py-3">
          {grant.live ? <Pill tone="good">Active</Pill> : <Pill tone="quiet">{endedHow(grant)}</Pill>}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {grant.live ? (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="text-xs font-semibold text-slate-500 hover:text-red-600"
            >
              {mine ? "Revoke" : "Give back"}
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              {grant.endedAt ? when(grant.endedAt) : "Ended"}
            </span>
          )}
        </td>
      </Row>

      {/* Asked before it happens, because it happens the instant it is pressed and cannot be undone from
          this side: getting it back means asking again. */}
      {asking && (
        <tr className="border-b border-slate-100">
          <td colSpan={7} className="px-4 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
              <p className="text-sm text-slate-800">
                {mine
                  ? `Stop ${grant.theirName} seeing ${grant.bankName} ••${grant.lastFour}?`
                  : `Give back your access to ${grant.theirName}'s ${grant.bankName} ••${grant.lastFour}?`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {mine
                  ? "They lose sight of it immediately. They would have to ask again."
                  : "You lose sight of it immediately. You would have to ask again."}
              </p>
              {failed && <p className="mt-2 text-xs text-red-600">{failed.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (mine ? revoke.mutate({ id: grant.id }) : relinquish.mutate({ id: grant.id }))}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Stopping…" : mine ? "Revoke access" : "Give it back"}
                </button>
                <button
                  type="button"
                  disabled={busy}
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

/** The firm's own words for how a grant ended. */
function endedHow(grant: GrantRow) {
  switch (grant.endedHow) {
    case "REVOKED":
      return "Revoked";
    case "RELINQUISHED":
      return "Given back";
    case "LEFT_FAMILY":
      return "Left the family";
    case "ACCOUNT_CLOSED":
      return "Account closed";
    default:
      return "Expired";
  }
}
