import { ApiError } from "@atomprive/api-client";
import { useListBanksSigningIn, type BankSigningIn } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button } from "@atomprive/ui";
import { useState } from "react";
import { countryName } from "../../lib/countries";
import { formatDate } from "../../lib/labels";
import { connectionLabels } from "./config-labels";
import { CredentialsDialog } from "./credentials-dialog";

/**
 * The IT Admin's way to a bank's credentials (S52). Their role may set them but does not open Config, where
 * Admin sets them beside the rest of a bank's details — so the banks the platform signs in to are listed here,
 * with the same dialog. A bank whose files are uploaded by hand needs none and is not listed.
 */
export function BankCredentialsPage() {
  const banks = useListBanksSigningIn<BankSigningIn[], ApiError>();
  const [open, setOpen] = useState<BankSigningIn | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance">Bank credentials</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Where each bank is and who the platform signs in as. Banks whose files are uploaded by hand need none, so
          they aren&apos;t listed.
        </p>
      </div>

      {banks.isError && <Alert tone="danger">{banks.error.message}</Alert>}

      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th className="px-5 py-3">Bank</th>
              <th className="px-4 py-3">Connection</th>
              <th className="px-4 py-3">Credentials</th>
              <th className="px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {banks.isPending && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-ink-muted">
                  Reading the banks…
                </td>
              </tr>
            )}
            {banks.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-ink-muted">
                  No bank is set up to be signed in to. Admin adds banks on Config → Supported banks.
                </td>
              </tr>
            )}
            {banks.data?.map((bank) => (
              <tr key={bank.bankId} className="border-t border-line">
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{bank.name}</p>
                  <p className="text-xs text-ink-muted">
                    {countryName(bank.countryCode)} · {bank.bic}
                    {bank.enabled ? "" : " · disabled"}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {connectionLabels[bank.connectionType as keyof typeof connectionLabels] ?? bank.connectionType}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Standing bank={bank} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setOpen(bank)}>
                    Credentials
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && (
        <CredentialsDialog
          bank={{ id: open.bankId, name: open.name, connectionType: open.connectionType as never }}
          onClose={() => {
            setOpen(null);
            void banks.refetch();
          }}
        />
      )}
    </div>
  );
}

/** The same words as the Credentials column on Config → Supported banks. */
function Standing({ bank }: { bank: BankSigningIn }) {
  if (!bank.set) return <Badge tone="warning">Not set</Badge>;
  if (bank.testOk === false) return <Badge tone="danger">Set · not connecting</Badge>;
  if (bank.testOk && bank.testedAt) return <Badge tone="success">Set · tested {formatDate(bank.testedAt)}</Badge>;
  return <Badge tone="info">Set · not tested</Badge>;
}
