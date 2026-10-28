import { ApiError } from "@atomprive/api-client";
import { useDeclineFromLink, useJoin, useOpen, type Invitation, type SignedUp } from "@atomprive/api-client/portal";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useSession } from "../auth/session-context";
import { Household } from "./household";
import { InvitationCard, Joined } from "./invitation-card";

/** The firm's own rule for a password, said in the order somebody fills one in. */
const LEAST = 12;

/**
 * Answering an invitation, and setting yourself up if the answer is yes.
 *
 * <p>Asked before anything is typed. The form used to open straight onto a name and a password, which
 * meant the first thing the firm said to somebody it had never met was "choose a password" — no mention of
 * who had asked for them, which family, or why. Being asked a question and being handed a form are not the
 * same thing, and this is a question.
 *
 * <p>Saying no ends it. Nothing is set up, the link stops opening and the password the firm read out stops
 * working: somebody who refuses does not end up with an account they never wanted, and the firm has to ask
 * again properly if they change their mind.
 *
 * <p>Reached with no session at all, which is the whole point: the person arriving has no account yet. The
 * token in the address is the only thing that says they were asked.
 */
export function JoinPage() {
  const { token = "" } = useParams();
  const { began } = useSession();
  const [at, setAt] = useState<"asked" | "details" | "password" | "declined" | "joined">("asked");
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");

  const invitation = useOpen<Invitation, ApiError>(token);
  const join = useJoin<ApiError>({
    mutation: {
      onSuccess: (signedUp: SignedUp) => {
        // Signed in here rather than on the next screen, but not sent anywhere yet: they are told what
        // they joined first, and go on to it when they are ready.
        began(signedUp.accessToken);
        setAt("joined");
      },
    },
  });
  const refuse = useDeclineFromLink<ApiError>({ mutation: { onSuccess: () => setAt("declined") } });

  if (invitation.isPending) {
    return <Middle>Opening your invitation…</Middle>;
  }
  // A link that has been used, has run out, or was never ours. The server tells them apart; so does this.
  if (invitation.isError) {
    return (
      <Middle>
        <h1 className="text-lg font-bold text-slate-900">This link doesn&rsquo;t work</h1>
        <p className="mt-2 text-sm text-slate-600">{invitation.error.message}</p>
      </Middle>
    );
  }

  const asked = invitation.data;
  const familyName = asked.familyName ?? `${asked.clientName}'s family`;

  if (at === "declined") {
    return (
      <Middle>
        <h1 className="text-lg font-bold text-slate-900">You&rsquo;ve declined</h1>
        <p className="mt-2 text-sm text-slate-600">
          {asked.clientName} has been told. Nothing has been set up for you and this link no longer works —
          if you change your mind, ask them to invite you again.
        </p>
      </Middle>
    );
  }

  if (at === "joined") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
        <Joined familyName={familyName} relationship={asked.relationship}>
          <Link
            to="/family"
            className="block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Go to your family
          </Link>
        </Joined>
      </div>
    );
  }

  if (at === "asked") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-lg">
          <InvitationCard
            clientName={asked.clientName}
            clientPhoto={asked.clientPhoto}
            familyName={asked.familyName}
            relationship={asked.relationship}
            invitedAt={asked.invitedAt}
            personalMessage={asked.personalMessage}
          >
            {refuse.isError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {refuse.error.message}
              </p>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={refuse.isPending}
                onClick={() => refuse.mutate({ token })}
                className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {refuse.isPending ? "Declining…" : "Decline"}
              </button>
              <button
                type="button"
                disabled={refuse.isPending}
                onClick={() => setAt("details")}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Accept
              </button>
            </div>
          </InvitationCard>
          <p className="mt-3 text-center text-xs text-slate-500">
            Sent to {asked.email}. If you were not expecting this, decline and nothing will be set up.
          </p>
        </div>
      </div>
    );
  }

  const tooShort = password.length > 0 && password.length < LEAST;
  const mismatched = again.length > 0 && again !== password;
  const canFinish = password.length >= LEAST && again === password && !join.isPending;

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-sm">
        <Steps on={step} />

        <div className="mt-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Join {asked.clientName}&rsquo;s family</h1>
          <p className="mt-1 text-sm text-slate-600">
            <b>{asked.clientName}</b> has asked you to join their family group as their{" "}
            <b>{asked.relationship.toLowerCase()}</b>.
          </p>
        </div>

        {join.isError && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {join.error.message}
          </p>
        )}

        {at === "details" ? (
          <form
            className="mt-7 grid gap-x-10 gap-y-7 sm:grid-cols-[1fr_15rem] sm:grid-rows-[auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setAt("password");
              setStep(2);
            }}
          >
            <div className="sm:col-start-1 sm:row-start-1">
              <Label htmlFor="join-email">Email</Label>
              {/* Not theirs to change. It is the address the firm wrote to, and the only thing tying whoever
                  holds this link to the person the firm meant to ask. */}
              <input
                id="join-email"
                value={asked.email}
                readOnly
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-400">Set by the invitation — this cannot be changed.</p>

              <Label htmlFor="join-name" className="mt-4">
                Full name
              </Label>
              <input
                id="join-name"
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <Label htmlFor="join-phone" className="mt-4">
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <input
                id="join-phone"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <Label htmlFor="join-relationship" className="mt-4">
                Relationship
              </Label>
              <input
                id="join-relationship"
                value={asked.relationship}
                readOnly
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <Rail asked={asked} />

            <div className="sm:col-span-2 sm:row-start-2">
              <button
                type="submit"
                disabled={fullName.trim().length === 0}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setAt("asked")}
                className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back to the invitation
              </button>
            </div>
          </form>
        ) : (
          <form
            className="mt-7 grid gap-x-10 gap-y-7 sm:grid-cols-[1fr_15rem] sm:grid-rows-[auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              join.mutate({
                token,
                data: { fullName: fullName.trim(), phone: phone.trim() || null, password },
              });
            }}
          >
            <div className="sm:col-start-1 sm:row-start-1">
            <Label htmlFor="join-password">Choose a password</Label>
            <input
              id="join-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className={`mt-1 text-xs ${tooShort ? "text-red-600" : "text-slate-400"}`}>
              At least {LEAST} characters.
            </p>

            <Label htmlFor="join-again" className="mt-4">
              And again
            </Label>
            <input
              id="join-again"
              type="password"
              autoComplete="new-password"
              required
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {mismatched && <p className="mt-1 text-xs text-red-600">These two do not match.</p>}

              <p className="mt-5 text-xs text-slate-500">
                Signing in as <b className="font-semibold text-slate-700">{asked.email}</b>
                {fullName.trim() && <> &middot; {fullName.trim()}</>}
              </p>
            </div>

            <Rail asked={asked} />

            <div className="sm:col-span-2 sm:row-start-2">
              <button
                type="submit"
                disabled={!canFinish}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {join.isPending ? "Setting you up…" : "Create my account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAt("details");
                  setStep(1);
                }}
                className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * The right-hand side of the card, on both steps.
 *
 * <p>It exists because the other half of a two-column form is not spare room. Left to the fields alone the
 * card was a narrow strip of inputs with a quarter of its width empty, and the one thing somebody arriving
 * on this page actually wants to know — whose family, and what joining it does and does not give them —
 * was a footnote underneath.
 *
 * <p>Carried into step two as well, so the card does not change shape between the two and the password is
 * typed with the same three promises still in sight.
 */
function Rail({ asked }: { asked: Invitation }) {
  return (
    <div className="sm:col-start-2 sm:row-start-1 sm:border-l sm:border-slate-100 sm:pl-8">
      <Household />
      <p className="mt-4 text-center text-2xs font-bold tracking-widest text-blue-700 uppercase">
        You are joining
      </p>
      <p className="mt-1 text-center text-base font-bold text-slate-900">
        {asked.clientName}&rsquo;s family
      </p>
      <ul className="mt-5 space-y-3">
        <Tick>
          You are added as a <b>{asked.relationship.toLowerCase()}</b>, as the firm recorded it.
        </Tick>
        <Tick>Everything you do is recorded in your own name.</Tick>
        {/* Said plainly, because it is the thing somebody will otherwise assume. */}
        <Tick>You will not see {asked.clientName}&rsquo;s money unless the firm shares it with you.</Tick>
      </ul>
    </div>
  );
}

function Steps({ on }: { on: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Your details" },
    { n: 2, label: "Set a password" },
  ];
  return (
    <ol className="flex items-center justify-center gap-3">
      {steps.map((step) => (
        <li key={step.n} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
              on >= step.n ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {step.n}
          </span>
          <span className={`text-xs font-bold ${on >= step.n ? "text-slate-900" : "text-slate-500"}`}>
            {step.label}
          </span>
          {step.n === 1 && <span aria-hidden="true" className="ml-1 h-px w-8 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

function Label({ htmlFor, className, children }: { htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-xs font-bold tracking-wider text-slate-500 uppercase ${className ?? ""}`}
    >
      {children}
    </label>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-snug text-slate-700">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-green-600 text-[9px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function Middle({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-8 text-center text-sm text-slate-600 shadow-sm">
        {children}
      </div>
    </div>
  );
}
