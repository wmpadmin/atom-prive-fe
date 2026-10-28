import { ApiError } from "@atomprive/api-client";
import { useAccept, useDecline, useRequests, type FamilyRequest } from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { InvitationCard, Joined } from "./invitation-card";

/**
 * One request, read properly before it is answered.
 *
 * <p>Its own screen rather than a card in a list. Joining a family group is a thing a client agrees to
 * once and cannot quietly undo, and the list it came from shows four lines — who asked, and what they would
 * become. What it cannot show, and what somebody actually decides on, is the rest: which family, when they
 * were asked, and the sentence the person asking wrote in their own words.
 *
 * <p>And then it says what happened. A screen that answers a request by emptying itself and returning to a
 * list leaves the client wondering whether they pressed the button at all.
 */
export function RequestPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Held, not re-read. Answering takes the request off the server's list, and the screen that says what
  // they joined needs the family's name and their relationship after it has gone.
  const [joined, setJoined] = useState<FamilyRequest | null>(null);

  const waiting = useRequests<FamilyRequest[], ApiError>();
  const settled = { mutation: { onSuccess: () => void queryClient.invalidateQueries() } };
  const accept = useAccept<ApiError>(settled);
  const decline = useDecline<ApiError>(settled);
  const busy = accept.isPending || decline.isPending;
  const failed = accept.error ?? decline.error;

  if (joined) {
    return <Welcomed request={joined} />;
  }
  if (waiting.isPending) {
    return <p className="text-sm text-slate-500">Reading your request…</p>;
  }
  if (waiting.isError) {
    return <Gone message={waiting.error.message} />;
  }

  const request = waiting.data.find((one) => one.id === id);
  if (!request) {
    // Answered somewhere else, withdrawn by the firm, or never theirs. One wording for all three: which
    // of them it was is not the client's business to be told.
    return <Gone message="This request is no longer waiting on you." />;
  }

  return (
    <RequestCard
      request={request}
      busy={busy}
      error={failed?.message}
      onDecline={() => decline.mutate({ id: request.id }, { onSuccess: () => void navigate("/requests") })}
      onAccept={() => accept.mutate({ id: request.id }, { onSuccess: () => setJoined(request) })}
      declining={decline.isPending}
      accepting={accept.isPending}
    />
  );
}

/** The request as it is read: everything the client decides on, and the two ways of answering. */
export function RequestCard({
  request,
  busy,
  error,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  request: FamilyRequest;
  busy: boolean;
  error?: string;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg">
      <BackToRequests />

      <h1 className="mt-4 text-xl font-bold text-slate-900">Family join request</h1>

      <div className="mt-3">
        <InvitationCard
          clientName={request.clientName}
          clientPhoto={request.clientPhoto}
          familyName={request.familyName}
          relationship={request.relationship}
          invitedAt={request.invitedAt}
          personalMessage={request.personalMessage}
        >
          {/* Only an existing client reads this one, and they have an account of their own that joining
              does not touch. Worth saying: it is the thing somebody hesitates over. */}
          <p className="mt-2 text-xs text-slate-500">Your own account stays exactly as it is.</p>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {declining ? "Declining…" : "Decline"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {accepting ? "Joining…" : "Accept"}
            </button>
          </div>
        </InvitationCard>
      </div>
    </div>
  );
}

/** What they joined, with the two places a signed-in client can go next. */
export function Welcomed({ request }: { request: FamilyRequest }) {
  const familyName = request.familyName ?? `${request.clientName}'s family`;
  return (
    <Joined familyName={familyName} relationship={request.relationship}>
      <Link
        to="/family"
        className="block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
      >
        Go to your family
      </Link>
      <Link
        to="/requests"
        className="block rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        Back to requests
      </Link>
    </Joined>
  );
}

function Gone({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <BackToRequests />
      <p className="mt-4 rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}

function BackToRequests() {
  return (
    <Link to="/requests" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-700">
      <span aria-hidden="true">&larr;</span> Back to requests
    </Link>
  );
}
