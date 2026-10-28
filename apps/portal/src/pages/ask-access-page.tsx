import { ApiError } from "@atomprive/api-client";
import { useAsk, useWhoICanAsk, type WhoICanAsk } from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Face } from "./invitation-card";

/**
 * Asking a relative for sight of what they hold at one bank.
 *
 * <p>By bank, and that is the whole privacy argument of this feature in one form control. Being in
 * somebody's family entitles you to know they bank somewhere — it does not entitle you to a list of their
 * account numbers so you can tick the interesting ones. They see the individual accounts when they answer,
 * because the accounts are theirs, and they choose which of them to share.
 */
export function AskAccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const family = useWhoICanAsk<WhoICanAsk[], ApiError>();
  const [who, setWho] = useState<string>("");
  const [bank, setBank] = useState<string>("");
  const [message, setMessage] = useState("");
  const ask = useAsk<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries();
        void navigate("/access");
      },
    },
  });

  if (family.isPending) {
    return <p className="text-sm text-slate-500">Reading your family…</p>;
  }
  if (family.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {family.error.message}
      </p>
    );
  }

  const chosen = family.data.find((one) => one.customerId === who);
  const banks = chosen?.banks ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        to="/access"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-700"
      >
        <span aria-hidden="true">&larr;</span> Back to access requests
      </Link>

      <h1 className="text-xl font-bold text-slate-900">Request access</h1>

      {family.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
          Nobody in your family has an account the firm knows about.
        </p>
      ) : (
        <form
          className="space-y-5 rounded-2xl border border-slate-200 bg-white px-6 py-6"
          onSubmit={(event) => {
            event.preventDefault();
            ask.mutate({ data: { ownerId: who, bankId: bank, message: message.trim() || null } });
          }}
        >
          <Step number={1} label="Who you want to ask">
            <ul className="space-y-2">
              {family.data.map((one) => (
                <li key={one.customerId}>
                  <button
                    type="button"
                    disabled={one.alreadyAsked}
                    onClick={() => {
                      setWho(one.customerId);
                      setBank("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left disabled:opacity-60 ${
                      who === one.customerId
                        ? "border-blue-500 bg-blue-50/60"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Face name={one.fullName} photo={one.photo} small />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {one.fullName}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {one.relationship ?? "Family"} ·{" "}
                        {one.banks.length === 1 ? "1 bank" : `${one.banks.length} banks`}
                      </span>
                    </span>
                    {one.alreadyAsked && (
                      <span className="shrink-0 text-2xs font-semibold text-amber-700">Already asked</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Step>

          <Step number={2} label="Which bank">
            {/* The bank's name is the whole of what they may know before being let in. How many accounts
                sit behind it is already more than a stranger would get, and is what makes the choice
                meaningful without giving away the accounts themselves. */}
            {chosen === undefined ? (
              <p className="text-sm text-slate-400">Choose somebody first.</p>
            ) : (
              <ul className="space-y-2">
                {banks.map((one) => (
                  <li key={one.bankId}>
                    <button
                      type="button"
                      onClick={() => setBank(one.bankId)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
                        bank === one.bankId
                          ? "border-blue-500 bg-blue-50/60"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-sm font-semibold text-slate-900">{one.bankName}</span>
                      <span className="text-xs text-slate-500">
                        {one.accounts === 1 ? "1 account" : `${one.accounts} accounts`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Step>

          <Step number={3} label="What you would be given">
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <b className="font-semibold text-slate-900">View only.</b> You would see balances and
              statements for whichever accounts they agree to — nothing else, and you could change nothing.
              They choose how long it lasts and can stop it at any time.
            </p>
          </Step>

          <Step number={4} label="A message (optional)">
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="So I can help keep an eye on things."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Step>

          {ask.isError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {ask.error.message}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Link
              to="/access"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={ask.isPending || who === "" || bank === ""}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {ask.isPending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Step({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-600 text-2xs font-bold text-white"
        >
          {number}
        </span>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
