import { ApiError } from "@atomprive/api-client";
import { useAccount, usePermissions, type AccountStatement, type MyPermissions } from "@atomprive/api-client/portal";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { when } from "../lib/dates";
import { accountKind, initialsOf } from "../lib/money";
import { AccessPill } from "./access-pill";
import { accountName, balance } from "./account-labels";
import { Card } from "./card";

/**
 * One account: what is in it, whose it is, who else may see it, and what has gone through it. A relative's account
 * is read the same way, and says whose it is; who else sees it is the holder's business and is not shown.
 */
export function AccountPage() {
  const { id = "" } = useParams();
  const statement = useAccount<AccountStatement, ApiError>(id);
  const permissions = usePermissions<MyPermissions, ApiError>();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (statement.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This account could not be found.</p>
      </div>
    );
  }
  if (!statement.data) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/60" />;
  }
  const { account, lines } = statement.data;
  const sees = (permissions.data?.given ?? []).filter((one) => one.live && one.bankAccountId === account.id);
  const wanted = search.trim().toLowerCase();
  const shown = lines.filter(
    (one) => (!wanted || one.description.toLowerCase().includes(wanted)) && (!from || one.bookedOn >= from) && (!to || one.bookedOn <= to),
  );
  const moneyIn = shown.filter((one) => one.amount > 0).reduce((sum, one) => sum + one.amount, 0);
  const moneyOut = shown.filter((one) => one.amount < 0).reduce((sum, one) => sum + one.amount, 0);

  return (
    <div className="space-y-5">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance text-ink">{accountName(account)}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {account.bankName} · {accountKind(account.accountType)} · •••• {account.lastFour} · {account.currency}
          </p>
        </div>
        <AccessPill mine={account.mine} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Balance" value={balance(account.balance, account.currency)} />
        <Tile label="Account holder" value={account.mine ? "You" : `${account.sharedBy ?? "A family member"}${account.sharedByRelationship ? ` (${account.sharedByRelationship})` : ""}`} />
        <Tile label="Last updated" value={account.lastUpdated ? when(account.lastUpdated) : "—"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Transactions">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Search transactions</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="transaction-search"
                type="search"
                value={search}
                placeholder="Search transactions…"
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              From
              <input id="transaction-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink" />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              To
              <input id="transaction-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink" />
            </label>
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">{lines.length === 0 ? "No transactions yet." : "No transactions match."}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="bg-sidebar text-xs text-ink-soft">
                      <th scope="col" className="rounded-l-lg px-3 py-2.5 font-semibold">Date</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Description</th>
                      <th scope="col" className="rounded-r-lg px-3 py-2.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((one, index) => {
                      const into = one.amount >= 0;
                      const Icon = into ? ArrowDownLeft : ArrowUpRight;
                      return (
                        <tr key={`${one.bookedOn}-${index}`}>
                          <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{when(one.bookedOn)}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2 text-ink">
                              <Icon aria-hidden="true" className={`size-4 shrink-0 ${into ? "text-access-full-ink" : "text-orange-600"}`} />
                              {one.description}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${into ? "text-access-full-ink" : "text-ink"}`}>
                            {into ? "+" : "−"}
                            {balance(Math.abs(one.amount), one.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 flex flex-wrap justify-end gap-4 text-xs text-ink-muted">
                <span>
                  In <span className="font-semibold text-access-full-ink tabular-nums">{balance(moneyIn, account.currency)}</span>
                </span>
                <span>
                  Out <span className="font-semibold text-ink tabular-nums">{balance(Math.abs(moneyOut), account.currency)}</span>
                </span>
              </p>
            </>
          )}
        </Card>

        <Card title="Who can see it">
          {!account.mine ? (
            <p className="text-sm text-ink-muted">
              {account.sharedBy ?? "The holder"} shared this account with you{account.until ? ` until ${when(account.until)}` : ""}. You can see it; you can't move money.
            </p>
          ) : sees.length === 0 ? (
            <p className="text-sm text-ink-muted">Only you. Use Grant access on the Accounts page to share it with a family member.</p>
          ) : (
            <ul className="space-y-3">
              {sees.map((one) => (
                <li key={one.id} className="flex items-center gap-3">
                  {one.theirPhoto ? (
                    <img src={one.theirPhoto} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{initialsOf(one.theirName)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{one.theirName}</span>
                    <span className="block text-xs text-ink-muted">{one.expiresOn ? `View only, until ${when(one.expiresOn)}` : "View only"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/new/accounts" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
      <ChevronLeft aria-hidden="true" className="size-4" />
      Accounts
    </Link>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}
