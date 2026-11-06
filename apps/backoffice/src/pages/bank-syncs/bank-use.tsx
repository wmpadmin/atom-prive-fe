import { ApiError } from "@atomprive/api-client";
import {
  getBankHoldingsStandingQueryKey,
  getCheckHoldingsQueryKey,
  useBankHoldingsStanding,
  useStopUsingBankHoldings,
  useUseBankHoldings,
  type InUse,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { formatDate } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

/**
 * Where one bank stands on Holdings check: compared only, or switched over (P10, D2). An Admin switches a bank
 * over by signing off that its open differences were checked; from then on what it states is the clients' figures.
 */
export function BankUse({ bankId }: { bankId: string }) {
  const queryClient = useQueryClient();
  const standing = useBankHoldingsStanding<InUse, ApiError>(bankId);
  const mayDecide = hasAuthority(useStaffUser(), "MANAGE_CONFIGURATION:CHANGE");
  const [asking, setAsking] = useState<"use" | "stop" | null>(null);
  const [checked, setChecked] = useState(false);
  const done = (fresh: InUse) => {
    queryClient.setQueryData(getBankHoldingsStandingQueryKey(bankId), fresh);
    void queryClient.invalidateQueries({ queryKey: getCheckHoldingsQueryKey() });
    setAsking(null);
    setChecked(false);
  };
  const use = useUseBankHoldings<ApiError>({ mutation: { onSuccess: done } });
  const stop = useStopUsingBankHoldings<ApiError>({ mutation: { onSuccess: done } });

  if (!standing.data) return null;
  const bank = standing.data;
  const share = bank.linesCompared === 0 ? null : Math.round((100 * bank.linesMatching) / bank.linesCompared);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">{bank.bankName}</h2>
          {bank.inUse ? <Badge tone="success">In use</Badge> : <Badge tone="info">Compared, not used</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {bank.inUse && bank.since
            ? `Its holdings are the clients' figures since ${formatDate(bank.since)}, switched over by ${bank.by}.`
            : "Clients still see the firm's figures for holdings at this bank."}{" "}
          {bank.clients} client{bank.clients === 1 ? "" : "s"}
          {share !== null && ` · ${share}% of lines match now`} · {bank.openDifferences} open difference
          {bank.openDifferences === 1 ? "" : "s"}
        </p>
      </div>
      {mayDecide && (
        bank.inUse ? (
          <Button variant="secondary" onClick={() => setAsking("stop")}>Switch back to compared only</Button>
        ) : (
          <Button disabled={bank.clients === 0} onClick={() => setAsking("use")}>Use {bank.bankName}'s holdings</Button>
        )
      )}

      <Dialog
        open={asking === "use"}
        title={`Use ${bank.bankName}'s holdings from now on?`}
        description={`From now on, the holdings ${bank.bankName} states become the figures for its ${bank.clients} client${bank.clients === 1 ? "" : "s"}, in place of the firm's file — now for its latest statement, and after every run. Each change is written into the client's history.`}
        onClose={() => setAsking(null)}
      >
        <div className="space-y-4">
          {use.error && <Alert tone="danger">{use.error.message}</Alert>}
          <div className="rounded-xl border border-line px-4 py-3">
            <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Now</p>
            <p className="mt-1 text-sm font-semibold">
              {share === null ? "Nothing compared yet" : `${share}% of lines match`} · {bank.openDifferences} open difference
              {bank.openDifferences === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>A holding on file is restated with the bank's units and value.</li>
            <li>One the file does not have is added under the asset class the bank gives it; one with a class the firm does not know is left for Operations to place.</li>
            <li>One the bank no longer states is left as it is.</li>
          </ul>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              id="bank-use-checked"
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 size-4 accent-primary-600"
            />
            <span>I have checked the open differences for {bank.bankName}, and the bank's figures are the right ones.</span>
          </label>
          <p className="text-xs text-ink-muted">Recorded with your name. It can be switched back to compared only at any time.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAsking(null)}>Cancel</Button>
            <Button disabled={!checked || use.isPending} onClick={() => use.mutate({ bankId, data: { checked: true } })}>
              {use.isPending ? "Switching over…" : `Use ${bank.bankName}'s holdings`}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={asking === "stop"}
        title={`Switch ${bank.bankName} back to compared only?`}
        description="Its holdings stop being written into its clients' figures. What has already been written stays: it is the clients' history now."
        onClose={() => setAsking(null)}
      >
        <div className="space-y-4">
          {stop.error && <Alert tone="danger">{stop.error.message}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAsking(null)}>Cancel</Button>
            <Button disabled={stop.isPending} onClick={() => stop.mutate({ bankId })}>Switch back</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
