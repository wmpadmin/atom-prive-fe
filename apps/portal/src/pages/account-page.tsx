import { ApiError } from "@atomprive/api-client";
import { useAccount, type AccountStatement } from "@atomprive/api-client/portal";
import { Link, useParams } from "react-router";
import { when } from "../lib/dates";
import { accountKind, money, signed } from "../lib/money";

/**
 * One account, and what has gone through it.
 *
 * <p>The same screen whether it is theirs or shared with them, because it is the same information and two
 * screens would eventually disagree. What changes is the band across the top, which says whose it is and
 * on whose say-so.
 *
 * <p>An account that is neither theirs nor shared is answered by the server as though it did not exist,
 * and this page simply repeats that. A page that said "you may not see this" would confirm the account was
 * real to anybody working through identifiers.
 */
export function AccountPage() {
  const { id = "" } = useParams();
  const statement = useAccount<AccountStatement, ApiError>(id);

  if (statement.isPending) {
    return <p className="text-sm text-slate-500">Reading the account…</p>;
  }
  if (statement.isError) {
    return (
      <div className="space-y-4">
        <BackToAccounts />
        <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
          {statement.error.message}
        </p>
      </div>
    );
  }

  const { account, lines } = statement.data;
  const theirs = !account.mine;

  return (
    <div className="space-y-4">
      <BackToAccounts />

      <div className={`overflow-hidden rounded-2xl border bg-white ${theirs ? "border-emerald-200" : "border-slate-200"}`}>
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900">
                {account.bankName} <span className="font-normal text-slate-400">••{account.lastFour}</span>
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {accountKind(account.accountType)} · {account.currency}
                {account.nickname && ` · ${account.nickname}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {money(account.balance, account.currency)}
              </p>
              <p className="text-2xs text-slate-400">balance</p>
            </div>
          </div>

          {theirs && (
            <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Shared by {account.sharedBy} · view only
              {account.until && ` · until ${when(account.until)}`}
            </p>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">Nothing has gone through it yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-2xs font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-6 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-6 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, at) => (
                <tr key={`${line.bookedOn}-${at}`} className="border-b border-slate-50 text-sm last:border-0">
                  <td className="px-6 py-3 whitespace-nowrap text-slate-500">{when(line.bookedOn)}</td>
                  <td className="px-4 py-3 text-slate-800">{line.description}</td>
                  <td
                    className={`px-6 py-3 text-right font-semibold tabular-nums ${
                      line.amount < 0 ? "text-slate-900" : "text-emerald-700"
                    }`}
                  >
                    {signed(line.amount, line.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Told, not hidden. The firm records that a shared account was opened, and the person doing the
            opening is the one entitled to know that before they do it rather than after. */}
        {theirs && (
          <p className="border-t border-slate-100 px-6 py-3 text-2xs text-slate-400">
            Every time you open a shared account, the firm records that you did.
          </p>
        )}
      </div>
    </div>
  );
}

function BackToAccounts() {
  return (
    <Link
      to="/accounts"
      className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-700"
    >
      <span aria-hidden="true">&larr;</span> Back to accounts
    </Link>
  );
}
