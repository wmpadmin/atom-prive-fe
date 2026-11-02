import { ApiError } from "@atomprive/api-client";
import {
  getAccountsQueryKey,
  getPermissionsQueryKey,
  useAccounts,
  useGrant,
  useWhoICanAsk,
  type AccountRow,
  type WhoICanAsk,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { accountKind, initialsOf } from "../lib/money";
import { accountName, balance } from "./account-labels";
import { AccessPill } from "./access-pill";

/**
 * The client's bank accounts: their own, and any a relative has let them see. Their own carry Full Access, a
 * relative's View Only; a relative's is never more than sight. The holder can give a family member sight of
 * their own accounts from here without waiting to be asked.
 */

function tomorrow() {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** Choose a family member, tick the accounts, and say until when — or for good. */
export function GrantDialog({ own, onClose }: { own: AccountRow[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const family = useWhoICanAsk<WhoICanAsk[], ApiError>();
  const [who, setWho] = useState<string>();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [until, setUntil] = useState("");
  const grant = useGrant<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getPermissionsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getAccountsQueryKey() });
        onClose();
      },
    },
  });
  const toggle = (id: string) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const people = family.data ?? [];

  return (
    <Dialog open onClose={onClose} title="Grant access" description="Let a family member see some of your accounts. They can see balances and transactions, never move money.">
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Family member</legend>
          {family.isPending ? (
            <div className="h-16 animate-pulse rounded-xl bg-sidebar" />
          ) : people.length === 0 ? (
            <p className="rounded-xl bg-sidebar px-4 py-3 text-sm text-ink-muted">There is nobody else in your family group to share with yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {people.map((one) => (
                <li key={one.customerId}>
                  <button
                    type="button"
                    aria-pressed={who === one.customerId}
                    onClick={() => setWho(one.customerId)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                      who === one.customerId ? "border-primary-600 bg-primary-50" : "border-line hover:bg-sidebar"
                    }`}
                  >
                    {one.photo ? (
                      <img src={one.photo} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{initialsOf(one.fullName)}</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{one.fullName}</span>
                      {one.relationship && <span className="block text-xs text-ink-muted">{one.relationship}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Accounts</legend>
          <ul className="space-y-2">
            {own.map((one) => (
              <li key={one.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-sidebar">
                  <input type="checkbox" checked={ticked.has(one.id)} onChange={() => toggle(one.id)} className="size-4 accent-primary-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{accountName(one)}</span>
                    <span className="block text-xs text-ink-muted">•••• {one.lastFour}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div>
          <label htmlFor="grant-until" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Until (optional)
          </label>
          <input
            id="grant-until"
            name="grant-until"
            type="date"
            min={tomorrow()}
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
          <p className="mt-1 text-xs text-ink-muted">Leave empty to keep sharing until you take it back.</p>
        </div>

        {grant.isError && <Alert tone="danger">{grant.error.message}</Alert>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={grant.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!who || ticked.size === 0 || grant.isPending}
            onClick={() => who && grant.mutate({ data: { granteeId: who, accounts: [...ticked], expiresOn: until || null } })}
          >
            <Check aria-hidden="true" />
            {grant.isPending ? "Granting…" : "Grant access"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AccountsPage() {
  const accounts = useAccounts<AccountRow[], ApiError>();
  const navigate = useNavigate();
  const [granting, setGranting] = useState(false);
  const own = (accounts.data ?? []).filter((one) => one.mine);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">Accounts</h1>
          <p className="mt-1 text-sm text-ink-muted">View your accounts, balances and access details.</p>
        </div>
        {own.length > 0 && (
          <Button onClick={() => setGranting(true)}>
            <Plus aria-hidden="true" />
            Grant access
          </Button>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        {accounts.isError ? (
          <p className="py-8 text-center text-sm text-access-none-ink">Your accounts could not be loaded. Refresh the page to try again.</p>
        ) : !accounts.data ? (
          <div className="h-60 animate-pulse rounded-xl bg-sidebar" />
        ) : accounts.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Wallet aria-hidden="true" className="size-8 text-ink-muted" />
            <p className="text-sm font-semibold text-ink">No accounts yet</p>
            <p className="text-sm text-ink-muted">Your accounts appear here once the firm has linked them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  <th scope="col" className="py-3 pr-4 pl-3">Account name</th>
                  <th scope="col" className="px-4 py-3">Account no.</th>
                  <th scope="col" className="px-4 py-3">Account type</th>
                  <th scope="col" className="px-4 py-3">Currency</th>
                  <th scope="col" className="px-4 py-3 text-right">Balance</th>
                  <th scope="col" className="py-3 pr-3 pl-4">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accounts.data.map((one) => (
                  <tr key={one.id} className="cursor-pointer hover:bg-sidebar" onClick={() => void navigate(`/new/accounts/${one.id}`)}>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => void navigate(`/new/accounts/${one.id}`)} className="text-left">
                        <span className="block font-semibold text-ink">{accountName(one)}</span>
                        <span className="block text-xs text-ink-muted">{one.bankName}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-ink-soft tabular-nums">•••• {one.lastFour}</td>
                    <td className="px-3 py-3 text-ink-soft">{accountKind(one.accountType)}</td>
                    <td className="px-3 py-3 text-ink-soft">{one.currency}</td>
                    <td className="px-3 py-3 text-right font-semibold text-ink tabular-nums">{balance(one.balance, one.currency)}</td>
                    <td className="px-3 py-3">
                      <AccessPill mine={one.mine} />
                      {!one.mine && one.sharedBy && (
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          Shared by {one.sharedBy}
                          {one.sharedByRelationship ? ` (${one.sharedByRelationship})` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {granting && <GrantDialog own={own} onClose={() => setGranting(false)} />}
    </div>
  );
}
