import type { ApiError } from "@atomprive/api-client";
import {
  getListClientBankAccountsQueryKey,
  useDeactivateClientBankAccount,
  useLinkClientBankAccount,
  useListClientBankAccounts,
  useListCurrencies,
  useListSupportedBanks,
  useReactivateClientBankAccount,
  type BankAccountRow,
  type BankList,
  type Currency,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStaffUser } from "../../auth/session";
import { ColumnPicker } from "../../components/column-picker";
import { ViewTabs } from "../../components/view-tabs";
import { useColumnDrag } from "../../lib/column-drag";
import { formatRelative } from "../../lib/labels";
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { hasAuthority } from "../../lib/permissions";
import { useTableView } from "../../lib/table-view";
import { accountTypeLabels, accountTypes, bankAccountStatus } from "./bank-account-labels";

/**
 * The columns a reader may move and take off, in the order the firm wrote them.
 *
 * <p>Neither half of the account's own name is among them. A client with two accounts at one bank is told
 * apart by the last four digits, and four digits under no bank belong to nobody — the pair is what names
 * the row, so neither half can be moved away from the front of it or taken off. Nor is the button at the
 * end: it is what a reader came to the panel to press, and it is only there at all for whoever may.
 */
const MOVABLE: {
  id: string;
  label: string;
  nowrap?: boolean;
  tone?: string;
  cell: (account: BankAccountRow) => ReactNode;
}[] = [
  {
    id: "heldBy",
    label: "Held by",
    cell: (account) => account.holderName,
  },
  {
    id: "type",
    label: "Type",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (account) => `${accountTypeLabels[account.accountType]} · ${account.currency}`,
  },
  {
    id: "status",
    label: "Status",
    cell: (account) => {
      const status = bankAccountStatus(account.status);
      return <Badge tone={status.tone}>{status.label}</Badge>;
    },
  },
  {
    id: "lastSynced",
    label: "Last synced",
    nowrap: true,
    tone: "text-ink-soft",
    cell: (account) => formatRelative(account.lastSyncedAt, "Never"),
  },
];

/**
 * The accounts a client holds at their banks. The firm links them on the client's behalf, keeps the details
 * right, and takes one off when it closes — its history stays, and it can go back on within 90 days.
 */
export function BankAccountsPanel({ client }: { client: CustomerDetail["client"] }) {
  const user = useStaffUser();
  const canManage = hasAuthority(user, "MANAGE_BANK_FEEDS:CHANGE");
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(false);

  const accounts = useListClientBankAccounts<BankAccountRow[], ApiError>(client.id);
  const deactivate = useDeactivateClientBankAccount<ApiError>();
  const reactivate = useReactivateClientBankAccount<ApiError>();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListClientBankAccountsQueryKey(client.id) });

  const rows = accounts.data ?? [];
  const busy = deactivate.isPending || reactivate.isPending;
  const paged = usePagedRows(rows);
  // How this reader has arranged the panel is a thing about them rather than about what came back, so it is
  // read whichever way the fetch went and whether or not there is anything to draw.
  const view = useTableView("client-bank-accounts", MOVABLE.map((one) => one.id));
  const drag = useColumnDrag(view);
  const byId = new Map(MOVABLE.map((one) => [one.id, one]));
  const shownColumns = view.shown.map((id) => byId.get(id)).filter((one) => one !== undefined);

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-base font-bold">Bank accounts</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            The accounts this client holds at their banks, and what each one is doing.
          </p>
        </div>
        {/* On the card's own line, beside the one thing this card does. Offered only once there is a table
            to arrange: a panel with no accounts linked has no columns worth moving. */}
        <div className="flex flex-wrap items-end justify-end gap-3">
          {rows.length > 0 && (
            <>
              <ViewTabs
                views={view.views}
                current={view.current}
                edited={view.current === null ? view.arranged : view.changed}
                onPick={(name) => (name === null ? view.reset() : view.apply(name))}
                onSave={view.saveAs}
                onDelete={view.remove}
                firstLabel="Every account"
              />
              <ColumnPicker
                columns={MOVABLE.map((one) => ({ id: one.id, label: one.label }))}
                shown={new Set(view.shown)}
                order={view.order}
                arranged={view.arranged}
                onChange={(next) => {
                  for (const one of MOVABLE) {
                    if (next.has(one.id) === view.hidden.includes(one.id)) view.toggle(one.id);
                  }
                }}
                onMove={view.move}
                onReset={view.reset}
              />
            </>
          )}
          {canManage && (
            <Button variant="secondary" size="sm" onClick={() => setLinking(true)}>
              <Plus aria-hidden="true" />
              Link an account
            </Button>
          )}
        </div>
      </div>

      {(accounts.isError || deactivate.isError || reactivate.isError) && (
        <div className="px-6 pt-4">
          <Alert tone="danger">
            {(accounts.error ?? deactivate.error ?? reactivate.error)?.message}
          </Alert>
        </div>
      )}

      {accounts.isPending ? (
        <p className="px-6 py-8 text-center text-sm text-ink-muted">Loading their accounts…</p>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600 [&_svg]:size-5" aria-hidden="true">
            <Banknote />
          </span>
          <p className="mt-3 font-semibold">No accounts linked yet</p>
          <p className="mt-1 max-w-md text-sm text-ink-muted">
            {canManage
              ? "Link the client's first account and the daily sync will start reading it."
              : "Operations link a client's accounts."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-6">Bank</th>
                <th scope="col" className="px-4 py-3">Account</th>
                {shownColumns.map((column, at) => (
                  <th
                    key={column.id}
                    scope="col"
                    {...drag.headingProps(column.id)}
                    className={cn(
                      "cursor-grab touch-none px-4 py-3 select-none",
                      drag.dragging === column.id && "cursor-grabbing opacity-40",
                      drag.over === column.id && "bg-primary-50",
                    )}
                    title={`Drag to move ${column.label}`}
                  >
                    {column.label}
                    <span className="sr-only">
                      , column {at + 1} of {shownColumns.length}. Use the Columns button to move or hide it.
                    </span>
                  </th>
                ))}
                {canManage && <th scope="col" className="py-3 pr-6 pl-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.shown.map((account) => {
                const off = account.status === "DEACTIVATED";
                return (
                  <tr key={account.id} className={cn(off && "opacity-60")}>
                    <td className="py-3 pr-4 pl-6 font-semibold">{account.bankName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs">•••• {account.lastFour}</span>
                      {account.nickname && (
                        <span className="block text-xs text-ink-muted">{account.nickname}</span>
                      )}
                    </td>
                    {/* The cells in the order the headings are in, out of the one list that holds both. */}
                    {shownColumns.map((column) => (
                      <td
                        key={column.id}
                        className={cn("px-4 py-3", column.nowrap && "whitespace-nowrap", column.tone)}
                      >
                        {column.cell(account)}
                      </td>
                    ))}
                    {canManage && (
                      <td className="py-3 pr-6 pl-4 text-right whitespace-nowrap">
                        {off ? (
                          account.canBeReactivated ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                reactivate.mutate({ customerId: client.id, accountId: account.id }, { onSuccess: refresh })
                              }
                            >
                              Put it back
                            </Button>
                          ) : (
                            <span className="text-xs text-ink-muted">Link it afresh</span>
                          )
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              deactivate.mutate({ customerId: client.id, accountId: account.id }, { onSuccess: refresh })
                            }
                          >
                            Take it off
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Under the list and inside the card, the way the client requests queue draws its own. Left off
          while the accounts are still being read, and where none are linked: the empty panel says that
          itself, and a count of nothing under it says it twice. */}
      {!accounts.isPending && rows.length > 0 && (
        <PagedFooter paged={paged} noun={["account", "accounts"]} />
      )}

      <LinkAccountDialog
        open={linking}
        clientId={client.id}
        holderName={client.fullName}
        onClose={() => setLinking(false)}
        onLinked={() => {
          setLinking(false);
          void refresh();
        }}
      />
    </section>
  );
}

/** Linking an account. The number is taken once and never shown again. */
function LinkAccountDialog({
  open,
  clientId,
  holderName,
  onClose,
  onLinked,
}: {
  open: boolean;
  clientId: string;
  holderName: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  // Only the banks the firm has switched on can take a new account.
  const banks = useListSupportedBanks<BankList, ApiError>({ enabled: true }, { query: { enabled: open } });
  const link = useLinkClientBankAccount<ApiError>();
  const [bankId, setBankId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [heldBy, setHeldBy] = useState(holderName);
  const [accountType, setAccountType] = useState<BankAccountRow["accountType"]>("CURRENT");
  const [currency, setCurrency] = useState("AED");
  const currencies = useListCurrencies<Currency[], ApiError>({ query: { enabled: open } });
  const [nickname, setNickname] = useState("");

  const offered = banks.data?.items ?? [];

  return (
    <Dialog open={open} title="Link a bank account" onClose={onClose}>
      <div className="space-y-4">
        {link.isError && <Alert tone="danger">{link.error.message}</Alert>}

        <Field id="bank" label="Bank" required>
          <SelectInput id="bank" value={bankId} onChange={(event) => setBankId(event.target.value)}>
            <option value="">Choose the bank</option>
            {offered.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field id="account-number" label="Account number" required hint="Taken once. Only the last four are shown afterwards.">
          <TextInput id="account-number" value={accountNumber} autoComplete="off"
            onChange={(event) => setAccountNumber(event.target.value)} />
        </Field>

        <Field id="held-by" label="Name the bank holds it in" required hint="It has to read as the client's registered name.">
          <TextInput id="held-by" value={heldBy} onChange={(event) => setHeldBy(event.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="account-type" label="Kind of account" required>
            <SelectInput id="account-type" value={accountType}
              onChange={(event) => setAccountType(event.target.value as BankAccountRow["accountType"])}>
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {accountTypeLabels[type]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="currency" label="Currency" required>
            <SelectInput id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {/* Until the list arrives, what is already chosen is still worth showing. */}
              {!(currencies.data ?? []).some((one) => one.code === currency) && (
                <option value={currency}>{currency}</option>
              )}
              {(currencies.data ?? []).map((one) => (
                <option key={one.code} value={one.code}>
                  {one.code} — {one.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field id="nickname" label="Nickname" hint="What the client calls it, such as “Salary”.">
          <TextInput id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={link.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!bankId || !accountNumber.trim() || !heldBy.trim() || link.isPending}
            onClick={() =>
              link.mutate(
                {
                  customerId: clientId,
                  data: {
                    bankId,
                    accountNumber: accountNumber.trim(),
                    holderName: heldBy.trim(),
                    accountType,
                    currency,
                    nickname: nickname.trim() || null,
                  },
                },
                { onSuccess: onLinked },
              )
            }
          >
            {link.isPending ? "Linking…" : "Link the account"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
