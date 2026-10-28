import { ApiError } from "@atomprive/api-client";
import { useAccounts, type AccountRow } from "@atomprive/api-client/portal";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { when } from "../lib/dates";
import { accountKind, initialsOf, money } from "../lib/money";
import { Face } from "./invitation-card";

/**
 * What this client may look at: their accounts, and the ones a relative has agreed to share.
 *
 * <p>Two tables, never one. The single thing somebody must not be confused about here is whose money they
 * are reading, and a shared account sitting among their own — even with a label on it — is a mistake
 * waiting for somebody in a hurry.
 *
 * <p>Shared with me holds only accounts with a live grant behind it. Being in the same family puts nothing
 * in this list; the server decides it on every read, and this screen only draws what it is given.
 */
export function AccountsPage() {
  const accounts = useAccounts<AccountRow[], ApiError>();
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [find, setFind] = useState("");

  const { mine, shared, total, currency } = useMemo(() => {
    const all = accounts.data ?? [];
    const ours = all.filter((one) => one.mine);
    return {
      mine: ours,
      shared: all.filter((one) => !one.mine),
      total: all.reduce((running, one) => running + one.balance, 0),
      currency: all[0]?.currency ?? "GBP",
    };
  }, [accounts.data]);

  if (accounts.isPending) {
    return <p className="text-sm text-slate-500">Reading your accounts…</p>;
  }
  if (accounts.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {accounts.error.message}
      </p>
    );
  }

  const matching = (rows: AccountRow[]) => {
    const looking = find.trim().toLowerCase();
    if (looking === "") {
      return rows;
    }
    return rows.filter((one) =>
      [one.bankName, one.nickname ?? "", one.lastFour, one.sharedBy ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(looking),
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">
            View your personal accounts and accounts shared with you.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Tile tint="bg-blue-50 text-blue-700" label="My Accounts" value={String(mine.length)}>
            Accounts you own
          </Tile>
          <Tile tint="bg-violet-50 text-violet-700" label="Shared with Me" value={String(shared.length)}>
            Accounts shared by family members
          </Tile>
          <Tile tint="bg-emerald-50 text-emerald-700" label="Total Value" value={money(total, currency)}>
            Total value of all visible accounts
          </Tile>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
            <div role="tablist" aria-label="Which accounts" className="flex gap-1">
              {(
                [
                  ["mine", `My Accounts (${mine.length})`],
                  ["shared", `Shared with Me (${shared.length})`],
                ] as const
              ).map(([which, label]) => (
                <button
                  key={which}
                  type="button"
                  role="tab"
                  aria-selected={tab === which}
                  onClick={() => setTab(which)}
                  className={
                    tab === which
                      ? "-mb-[13px] border-b-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700"
                      : "-mb-[13px] border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              aria-label="Search accounts"
              placeholder="Search accounts…"
              value={find}
              onChange={(event) => setFind(event.target.value)}
              className="ml-auto w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          {tab === "mine" ? (
            <Section
              title="My Accounts"
              blurb="Accounts that you own and manage."
              rows={matching(mine)}
              empty="The firm has not linked any accounts to you yet."
            />
          ) : (
            <Section
              title="Shared with Me"
              blurb="Accounts shared by your family members. You have view-only access."
              rows={matching(shared)}
              empty="Nobody has shared an account with you."
            />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <h2 className="text-sm font-bold text-slate-900">Access &amp; privacy</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            You can only see accounts that are either owned by you or explicitly shared with you by a family
            member. All shared access is view-only and requires approval.
          </p>
          <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
            <Tick>Your individual account data remains private.</Tick>
            <Tick>You can request access to family members&rsquo; accounts.</Tick>
            <Tick>Access can be revoked at any time by the account owner.</Tick>
          </ul>
          <Link
            to="/permissions"
            className="mt-4 block rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Manage permissions &rarr;
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <h2 className="text-sm font-bold text-slate-900">Need access to another account?</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            You can request view-only access to a family member&rsquo;s account. They will need to approve
            your request.
          </p>
          <Link
            to="/access/new"
            className="mt-4 block rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Request Access &rarr;
          </Link>
        </div>
      </aside>
    </div>
  );
}

/** One of the three figures across the top. */
function Tile({
  tint,
  label,
  value,
  children,
}: {
  tint: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>
          <span className="size-4 rounded-sm bg-current opacity-70" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{children}</p>
    </div>
  );
}

/** One table of accounts, with its own heading row. */
function Section({
  title,
  blurb,
  rows,
  empty,
}: {
  title: string;
  blurb: string;
  rows: AccountRow[];
  empty: string;
}) {
  return (
    <section className="px-5 py-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{blurb}</p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem]">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-2xs font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-4 py-2.5 text-left">Account Name</th>
                <th className="px-4 py-2.5 text-left">Account Type</th>
                <th className="px-4 py-2.5 text-left">Owner</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-left">Last Updated</th>
                <th className="px-4 py-2.5 text-left">Access Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((one) => (
                <tr key={one.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-2xs font-bold text-slate-600"
                      >
                        {initialsOf(one.bankName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {one.nickname ?? one.bankName} • {one.lastFour}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{one.bankName}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-700">
                    {accountKind(one.accountType)}
                  </td>
                  <td className="px-4 py-3">
                    {/* A face only where the owner is somebody else. On your own accounts the column says
                        "You", and your own photograph beside your own money tells the reader nothing. */}
                    {one.mine ? (
                      <>
                        <span className="block truncate text-sm text-slate-900">You</span>
                        <span className="block truncate text-xs text-slate-500">(You)</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <Face name={one.sharedBy ?? ""} photo={one.sharedByPhoto} size="size-9 text-2xs" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-900">{one.sharedBy}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {one.sharedByRelationship ? `(${one.sharedByRelationship})` : ""}
                          </span>
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                    {money(one.balance, one.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500">
                    {one.lastUpdated ? when(one.lastUpdated) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {one.mine ? (
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Owner
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        View Only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      to={`/accounts/${one.id}`}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-xs leading-snug text-slate-600">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-white"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
