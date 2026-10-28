import { ApiError } from "@atomprive/api-client";
import { useCancel, useSent, type RequestRow } from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { SAID, accountsAsked, type Status } from "./access-requests";
import { StatusPill } from "./status-pill";
import { Face } from "./invitation-card";
import { Aside, Card, Heading, Headings, Nothing, Row, Table, Tabs, Tick, Tile } from "./panels";

/**
 * What this client has asked for, and how each of it went.
 *
 * <p>Its own screen rather than a tab, because it answers a different question. The queue answers "what
 * needs me"; this answers "what did I ask for, and what came of it" — including the ones that came to
 * nothing, which is why withdrawn requests have a tab of their own rather than being quietly dropped.
 *
 * <p>No counts of anybody's accounts beyond what was asked for. The person who asked is told how many
 * accounts the request covered and how many were agreed to, and nothing about the rest of what a relative
 * holds.
 */
type Tab = Status | "ALL";

export function SentAccessPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const sent = useSent<RequestRow[], ApiError>();

  const { rows, counts } = useMemo(() => {
    const all = sent.data ?? [];
    const per = (status: Status) => all.filter((one) => one.status === status).length;
    return {
      rows: tab === "ALL" ? all : all.filter((one) => one.status === tab),
      counts: {
        all: all.length,
        ASKED: per("ASKED"),
        APPROVED: per("APPROVED"),
        REJECTED: per("REJECTED"),
        CANCELLED: per("CANCELLED"),
      },
    };
  }, [sent.data, tab]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <Heading title="Sent access requests" blurb="Everything you have asked for, and how each went.">
          <Link
            to="/access/new"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Request access
          </Link>
        </Heading>

        {sent.isError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {sent.error.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile tint="bg-amber-50 text-amber-700" label="Pending" value={String(counts.ASKED)}>
            Waiting on a family member
          </Tile>
          <Tile tint="bg-emerald-50 text-emerald-700" label="Approved" value={String(counts.APPROVED)}>
            Agreed, in whole or in part
          </Tile>
          <Tile tint="bg-rose-50 text-rose-700" label="Refused" value={String(counts.REJECTED)}>
            They said no
          </Tile>
          <Tile tint="bg-slate-100 text-slate-600" label="Withdrawn" value={String(counts.CANCELLED)}>
            You took it back
          </Tile>
        </div>

        <Card
          bar={
            <Tabs
              label="Which sent requests"
              chosen={tab}
              onChoose={setTab}
              tabs={[
                ["ALL", `All (${counts.all})`],
                ["ASKED", `Pending (${counts.ASKED})`],
                ["APPROVED", `Approved (${counts.APPROVED})`],
                ["REJECTED", `Refused (${counts.REJECTED})`],
                ["CANCELLED", `Withdrawn (${counts.CANCELLED})`],
              ]}
            />
          }
        >
          {rows.length === 0 ? (
            <Nothing>
              {tab === "ALL"
                ? "You have not asked anybody for access yet."
                : `You have no ${SAID[tab].toLowerCase()} requests.`}
            </Nothing>
          ) : (
            <Table minWidth="58rem">
              <Headings
                of={[
                  "Requested from",
                  "Accounts",
                  "Your message",
                  "Sent on",
                  "Answered",
                  "Status",
                  ["Actions", "right"],
                ]}
              />
              <tbody>
                {rows.map((one) => (
                  <SentRow key={one.id} request={one} />
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Aside title="What happens next">
          <p>
            A pending request sits with the family member until they answer it. They choose which of their
            accounts to share and may set a date it runs out.
          </p>
          <ul className="space-y-2.5 border-t border-slate-100 pt-4">
            <Tick>You can withdraw a pending request.</Tick>
            <Tick>A refusal always comes with a reason.</Tick>
            <Tick>Approved access appears under Permissions.</Tick>
          </ul>
        </Aside>

        <Aside title="Received requests">
          <p>Anybody who has asked to see your accounts is on the main access queue.</p>
          <Link
            to="/access"
            className="mt-4 block rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Back to the queue &rarr;
          </Link>
        </Aside>
      </aside>
    </div>
  );
}

/** One sent request. Withdrawing is here as well as on the details page: a list of five is where you do it. */
function SentRow({ request }: { request: RequestRow }) {
  const queryClient = useQueryClient();
  const cancel = useCancel<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });

  return (
    <Row faded={request.status === "CANCELLED"}>
      <td className="px-4 py-3">
        <span className="flex items-center gap-3">
          <Face name={request.ownerName} photo={request.ownerPhoto} small />
          <span className="block truncate text-sm font-semibold text-slate-900">{request.ownerName}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700 tabular-nums">
        {request.status === "APPROVED"
          ? `${request.granted} of ${request.accountsAsked} shared`
          : accountsAsked(request)}
      </td>
      <td className="px-4 py-3">
        <span className="block max-w-xs truncate text-xs text-slate-500 italic">
          {request.message ? `“${request.message}”` : "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">{when(request.askedAt)}</td>
      <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">
        {request.decidedAt ? when(request.decidedAt) : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={request.status} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="flex items-center justify-end gap-3">
          {request.status === "ASKED" && (
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ id: request.id })}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-60"
            >
              {cancel.isPending ? "Withdrawing…" : "Withdraw"}
            </button>
          )}
          <Link
            to={`/access/${request.id}`}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            View details
          </Link>
        </span>
      </td>
    </Row>
  );
}
