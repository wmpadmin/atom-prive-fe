import { ApiError } from "@atomprive/api-client";
import {
  useAnswer,
  useCancel,
  useReceived,
  useSent,
  type RequestRow,
} from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { exactly, when } from "../lib/dates";
import { accountKind, money } from "../lib/money";
import { SAID, accountsAsked, theOther } from "./access-requests";
import { StatusPill } from "./status-pill";
import { Face } from "./invitation-card";
import { Aside, Nothing, Tick } from "./panels";

/**
 * One access request, read properly before it is answered.
 *
 * <p>Its own screen rather than a panel on the list. Letting a relative read a bank account is a decision
 * with a date on it, and what somebody actually decides on — which accounts, what they hold, the sentence
 * the person asking wrote — does not fit a row. A queue finds the request; this answers it.
 *
 * <p>Both sides read the same screen, and what differs is what each may see. The holder is shown the
 * accounts, because they are theirs. The person who asked is shown a count: they asked about a bank, and
 * what is behind it is the thing they are waiting to be told.
 */
export function AccessRequestPage() {
  const { id = "" } = useParams();
  const received = useReceived<RequestRow[], ApiError>();
  const sent = useSent<RequestRow[], ApiError>();

  if (received.isPending || sent.isPending) {
    return <p className="text-sm text-slate-500">Reading the request…</p>;
  }

  const failed = received.error ?? sent.error;
  if (failed) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {failed.message}
      </p>
    );
  }

  const request =
    (received.data ?? []).find((one) => one.id === id) ?? (sent.data ?? []).find((one) => one.id === id);

  if (!request) {
    // Withdrawn, answered elsewhere, or never theirs. One wording for all three: which of them it was is
    // not this client's business to be told.
    return (
      <div className="mx-auto max-w-2xl">
        <Back />
        <Nothing>This request is no longer on your list.</Nothing>
      </div>
    );
  }

  const other = theOther(request);
  const waiting = request.status === "ASKED";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <Back />

        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start gap-4">
            <Face name={other.name} photo={other.photo} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900">{other.name}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {request.mine ? "You asked them" : "Asked you"} for sight of {accountsAsked(request)} at one
                bank.
              </p>
              <p className="mt-1 text-xs text-slate-400">Requested {exactly(request.askedAt)}</p>
            </div>
            <StatusPill status={request.status} />
          </div>

          {request.message && (
            <blockquote className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 italic">
              &ldquo;{request.message}&rdquo;
              <footer className="mt-1 text-xs text-slate-500 not-italic">
                — {request.mine ? "you" : other.name}
              </footer>
            </blockquote>
          )}

          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Fact label="Asked by">{request.mine ? "You" : other.name}</Fact>
            <Fact label="Asked of">{request.mine ? other.name : "You"}</Fact>
            <Fact label="Accounts in question">{accountsAsked(request)}</Fact>
            <Fact label="Status">{SAID[request.status]}</Fact>
            {request.decidedAt && <Fact label="Answered">{exactly(request.decidedAt)}</Fact>}
            {request.status === "APPROVED" && (
              <Fact label="Shared">
                {request.granted === request.accountsAsked
                  ? "All of them"
                  : `${request.granted} of ${request.accountsAsked}`}
              </Fact>
            )}
          </dl>

          {request.decisionComment && (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">{request.mine ? other.name : "You"} said:</span>{" "}
              {request.decisionComment}
            </p>
          )}
        </div>

        {/* The accounts, and only for the person who holds them. The asker's own screen says how many,
            which is what they asked about. */}
        {/* Not while the answer form is below it: that form lists the same accounts, with the same
            balances, and a client would scroll past their own figures twice working out which of the two
            lists decides anything. Kept for an answered request, where there is no form. */}
        {!request.mine && !waiting && request.accounts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
            <h2 className="text-base font-bold text-slate-900">Your accounts at that bank</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              These are the accounts the request covered.
            </p>
            <ul className="mt-3 space-y-1.5">
              {request.accounts.map((one) => (
                <li
                  key={one.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {one.nickname ?? one.bankName}{" "}
                      <span className="font-normal text-slate-400">••{one.lastFour}</span>
                    </span>
                    <span className="block text-xs text-slate-500">{accountKind(one.accountType)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-700 tabular-nums">
                    {money(one.balance, one.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {waiting && (request.mine ? <TakeBack request={request} /> : <Answer request={request} />)}
      </div>

      <aside className="space-y-4">
        <Aside title="What you are deciding">
          <p>
            {request.mine
              ? "They will decide which of their accounts to share with you, and may set a date it runs out."
              : "Sharing is view-only. They see balances and movements; they cannot move money, change anything, or share it onward."}
          </p>
          <ul className="space-y-2.5 border-t border-slate-100 pt-4">
            <Tick>You choose account by account.</Tick>
            <Tick>You may set a date it ends.</Tick>
            <Tick>You can revoke it whenever you like.</Tick>
          </ul>
        </Aside>

        <Aside title="Where this shows up">
          <p>
            Once answered, it appears under Permissions, and every step of it is on your access report —
            asked, answered, read and revoked.
          </p>
          <Link
            to="/reports"
            className="mt-4 block rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Open your report &rarr;
          </Link>
        </Aside>
      </aside>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Back() {
  return (
    <Link
      to="/access"
      className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-700"
    >
      <span aria-hidden="true">&larr;</span> Back to access requests
    </Link>
  );
}

/**
 * The holder answering, account by account.
 *
 * <p>Every account starts ticked, because somebody who opened this to agree should not have to tick four
 * boxes to do the ordinary thing — and somebody who wants to share only one has to make that choice
 * deliberately, which is the right way round for a decision about who sees your money.
 *
 * <p>Agreeing to none of them is a refusal, whatever the button said, and a refusal owes a reason: it is
 * the only thing the person who asked will be told.
 */
function Answer({ request }: { request: RequestRow }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string[]>(request.accounts.map((one) => one.id));
  const [until, setUntil] = useState("");
  const [comment, setComment] = useState("");
  const answer = useAnswer<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });

  const refusing = chosen.length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <h2 className="text-base font-bold text-slate-900">Your answer</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Untick anything you would rather keep to yourself. Sharing none of them is a refusal.
      </p>

      <ul className="mt-4 space-y-1.5">
        {request.accounts.map((one) => (
          <li key={one.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 hover:border-blue-300">
              <input
                type="checkbox"
                checked={chosen.includes(one.id)}
                onChange={(event) =>
                  setChosen((was) =>
                    event.target.checked ? [...was, one.id] : was.filter((id) => id !== one.id),
                  )
                }
                className="size-4"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {one.nickname ?? one.bankName}{" "}
                  <span className="font-normal text-slate-400">••{one.lastFour}</span>
                </span>
                <span className="block text-xs text-slate-500">{accountKind(one.accountType)}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-700 tabular-nums">
                {money(one.balance, one.currency)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          Until
          <input
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          />
          <span className="mt-1 block text-2xs font-normal text-slate-400">
            Leave empty to last until you stop it.
          </span>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {refusing ? "Why (required)" : "A comment (optional)"}
          <textarea
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
      </div>

      {answer.isError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {answer.error.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Link
          to="/access"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Not now
        </Link>
        <button
          type="button"
          disabled={answer.isPending || (refusing && comment.trim() === "")}
          onClick={() =>
            answer.mutate({
              id: request.id,
              data: { accounts: chosen, expiresOn: until || null, comment: comment.trim() || null },
            })
          }
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${
            refusing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {answer.isPending
            ? "Saving…"
            : refusing
              ? "Refuse the request"
              : chosen.length === request.accounts.length
                ? "Share all of them"
                : `Share ${chosen.length} of ${request.accounts.length}`}
        </button>
      </div>
    </div>
  );
}

/** The asker taking it back before it has been answered. */
function TakeBack({ request }: { request: RequestRow }) {
  const queryClient = useQueryClient();
  const cancel = useCancel<ApiError>({
    mutation: { onSuccess: () => void queryClient.invalidateQueries() },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
      <h2 className="text-base font-bold text-slate-900">Waiting on them</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Sent {when(request.askedAt)}. You can take it back until they answer; you would have to ask again.
      </p>
      {cancel.isError && <p className="mt-2 text-xs text-red-600">{cancel.error.message}</p>}
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate({ id: request.id })}
        className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-60"
      >
        {cancel.isPending ? "Taking it back…" : "Withdraw this request"}
      </button>
    </div>
  );
}
