import { ApiError } from "@atomprive/api-client";
import { useReceived, useSent, type RequestRow } from "@atomprive/api-client/portal";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { SAID, accountsAsked, direction, theOther, type Status } from "./access-requests";
import { StatusPill } from "./status-pill";
import { Face } from "./invitation-card";
import { Aside, CONTROL, Card, Field, Heading, Headings, Nothing, Row, Table, Tabs, Tick, Tile } from "./panels";

/**
 * Every access request, both ways round, in one queue.
 *
 * <p>One screen rather than two because they are the same conversation seen from either end, and a client
 * with a request out and one waiting on them should not have to remember which page each lives on. Which
 * end they are at is a column, not a different screen.
 *
 * <p>Nothing is answered here. A list is for finding the one that matters; agreeing to let a relative read
 * your bank accounts is a decision, and a decision belongs on a screen that shows what is being decided —
 * which is what View details is for.
 */
type Side = "received" | "sent" | "all";

type Sort = "newest" | "oldest" | "member";

export function AccessPage() {
  const [side, setSide] = useState<Side>("received");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("newest");

  const received = useReceived<RequestRow[], ApiError>();
  const sent = useSent<RequestRow[], ApiError>();
  const failed = received.error ?? sent.error;

  const { rows, waitingOnYou, waitingOnThem, approved, refused } = useMemo(() => {
    const theirs = received.data ?? [];
    const ours = sent.data ?? [];
    const both = [...theirs, ...ours];
    const forSide = side === "received" ? theirs : side === "sent" ? ours : both;
    const narrowed = forSide.filter((one) => status === "ALL" || one.status === status);
    const ordered = [...narrowed].sort((a, b) => {
      if (sort === "member") {
        return theOther(a).name.localeCompare(theOther(b).name);
      }
      const apart = Date.parse(a.askedAt) - Date.parse(b.askedAt);
      return sort === "oldest" ? apart : -apart;
    });
    return {
      rows: ordered,
      waitingOnYou: theirs.filter((one) => one.status === "ASKED").length,
      waitingOnThem: ours.filter((one) => one.status === "ASKED").length,
      approved: both.filter((one) => one.status === "APPROVED").length,
      refused: both.filter((one) => one.status === "REJECTED").length,
    };
  }, [received.data, sent.data, side, status, sort]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <Heading
          title="Access requests"
          blurb="Who has asked to see your accounts, and who you have asked."
        >
          <Link
            to="/access/new"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Request access
          </Link>
        </Heading>

        {failed && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {failed.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile tint="bg-amber-50 text-amber-700" label="Waiting on you" value={String(waitingOnYou)}>
            Requests you have not answered
          </Tile>
          <Tile tint="bg-blue-50 text-blue-700" label="Waiting on them" value={String(waitingOnThem)}>
            Requests you have sent
          </Tile>
          <Tile tint="bg-emerald-50 text-emerald-700" label="Approved" value={String(approved)}>
            Agreed, either way round
          </Tile>
          <Tile tint="bg-rose-50 text-rose-700" label="Refused" value={String(refused)}>
            Declined, either way round
          </Tile>
        </div>

        {/* The tabs are the bar's only item on purpose. The underline is pulled down by a fixed -13px to
            meet the bar's border, so a taller control beside it would centre the strip and leave the
            underline floating in mid-air — which is what the filters did until they moved to their own
            row below. */}
        <Card
          bar={
            <Tabs
              label="Which requests"
              chosen={side}
              onChoose={setSide}
              tabs={[
                ["received", `Received${waitingOnYou > 0 ? ` (${waitingOnYou})` : ""}`],
                ["sent", "Sent"],
                ["all", "All"],
              ]}
            />
          }
        >
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as Status | "ALL")}
                className={CONTROL}
              >
                <option value="ALL">All statuses</option>
                {(Object.keys(SAID) as Status[]).map((one) => (
                  <option key={one} value={one}>
                    {SAID[one]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort by">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className={CONTROL}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="member">Family member</option>
              </select>
            </Field>
          </div>

          {rows.length === 0 ? (
            <Nothing>
              {status !== "ALL"
                ? `No ${SAID[status].toLowerCase()} requests on this list.`
                : side === "received"
                  ? "Nobody has asked to see your accounts."
                  : side === "sent"
                    ? "You have not asked anybody."
                    : "There are no access requests."}
            </Nothing>
          ) : (
            <Table minWidth="56rem">
              <Headings
                of={[
                  "Family member",
                  "Request",
                  "Accounts",
                  "Requested on",
                  "Status",
                  ["Actions", "right"],
                ]}
              />
              <tbody>
                {rows.map((one) => (
                  <Row key={one.id}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Face name={theOther(one).name} photo={theOther(one).photo} small />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {theOther(one).name}
                          </span>
                          {one.message && (
                            <span className="block max-w-xs truncate text-xs text-slate-500 italic">
                              &ldquo;{one.message}&rdquo;
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700">{direction(one)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700 tabular-nums">
                      {one.status === "APPROVED"
                        ? `${one.granted} of ${one.accountsAsked} shared`
                        : accountsAsked(one)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">
                      {when(one.askedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={one.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to={`/access/${one.id}`}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        View details
                      </Link>
                    </td>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Aside title="How sharing works">
          <p>
            Being in the same family group shows you which banks a relative uses and nothing else. Sight of
            an account is given one account at a time, by the person who holds it.
          </p>
          <ul className="space-y-2.5 border-t border-slate-100 pt-4">
            <Tick>Every grant is view-only.</Tick>
            <Tick>The holder may set a date it runs out.</Tick>
            <Tick>Either side can end it at any time.</Tick>
          </ul>
        </Aside>

        <Aside title="Your sent requests">
          <p>The full list of what you have asked for, including anything you withdrew.</p>
          <Link
            to="/access/sent"
            className="mt-4 block rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Open sent requests &rarr;
          </Link>
        </Aside>

        <Aside title="Need access to an account?">
          <p>
            You can ask a family member for view-only sight of what they hold at one of their banks. They
            decide which accounts, and for how long.
          </p>
          <Link
            to="/access/new"
            className="mt-4 block rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Request access &rarr;
          </Link>
        </Aside>
      </aside>
    </div>
  );
}
