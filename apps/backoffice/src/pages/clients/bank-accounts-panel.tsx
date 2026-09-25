import type { ApiError } from "@atomprive/api-client";
import {
  getListClientBankAccountsQueryKey,
  useDeactivateClientBankAccount,
  useLinkClientBankAccount,
  useListClientBankAccounts,
  useListSupportedBanks,
  useReactivateClientBankAccount,
  type BankAccountRow,
  type BankList,
  type CustomerDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog, Field, SelectInput, TextInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatRelative } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";
import { accountTypeLabels, accountTypes, bankAccountStatus, currencies } from "./bank-account-labels";

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

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-base font-bold">Bank accounts</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            The accounts this client holds at their banks, and what each one is doing.
          </p>
        </div>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setLinking(true)}>
            <Plus aria-hidden="true" />
            Link an account
          </Button>
        )}
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
                <th scope="col" className="px-4 py-3">Held by</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Last synced</th>
                {canManage && <th scope="col" className="py-3 pr-6 pl-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((account) => {
                const status = bankAccountStatus(account.status);
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
                    <td className="px-4 py-3">{account.holderName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {accountTypeLabels[account.accountType]} · {account.currency}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      {formatRelative(account.lastSyncedAt, "Never")}
                    </td>
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
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
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
