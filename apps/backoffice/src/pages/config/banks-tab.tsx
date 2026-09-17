import { ApiError } from "@atomprive/api-client";
import {
  getGetFieldMappingSummaryQueryKey,
  getListSupportedBanksQueryKey,
  useDisableSupportedBank,
  useEnableSupportedBank,
  useListSupportedBanks,
  type BankList,
  type BankView,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, SelectInput } from "@atomprive/ui";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { countryName } from "../../lib/countries";
import { formatRelative } from "../../lib/labels";
import { BankDialog } from "./bank-dialog";
import { connectionLabels, scheduleLabels } from "./config-labels";
import { ConfirmDialog } from "./confirm-dialog";

type Filter = "" | "live" | "disabled";
type Notice = { tone: "success" | "danger"; message: string };

/** The banks the platform takes data from (#101). */
export function BanksTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("");
  const [editing, setEditing] = useState<BankView | "new" | null>(null);
  const [disabling, setDisabling] = useState<BankView | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const banks = useListSupportedBanks<BankList, ApiError>(
    { enabled: filter === "" ? undefined : filter === "live" },
    { query: { placeholderData: keepPreviousData } },
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getListSupportedBanksQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetFieldMappingSummaryQueryKey() });
  }

  const onError = (error: ApiError) => setNotice({ tone: "danger", message: error.message });
  const disable = useDisableSupportedBank<ApiError>({
    mutation: {
      onSuccess: async (bank) => {
        await refresh();
        setDisabling(null);
        setNotice({ tone: "success", message: `${bank.name} is disabled. Its syncs are paused; its data is kept.` });
      },
      onError: (error) => {
        setDisabling(null);
        onError(error);
      },
    },
  });
  const enable = useEnableSupportedBank<ApiError>({
    mutation: {
      onSuccess: async (bank) => {
        await refresh();
        setNotice({ tone: "success", message: `${bank.name} is live again.` });
      },
      onError,
    },
  });

  const counts = banks.data?.counts;
  const rows = banks.data?.items ?? [];

  return (
    <section aria-labelledby="banks-title" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="banks-title" className="text-base font-bold">
            Supported banks
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Manage connected banks — add, edit or enable a bank and set its connection details
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <label>
            <span className="sr-only">Show</span>
            <SelectInput
              id="bank-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-8 w-32 text-xs"
            >
              <option value="">All banks</option>
              <option value="live">Live</option>
              <option value="disabled">Disabled</option>
            </SelectInput>
          </label>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Add bank
          </Button>
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.message}</Alert>
        </div>
      )}
      {banks.isError && (
        <div className="mt-4">
          <Alert tone="danger">{banks.error.message}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Connected banks" value={counts?.total ?? "–"}>
          {counts ? `${counts.live} live · ${counts.disabled} disabled` : " "}
        </Stat>
        <Stat label="Accounts covered" value={counts?.linkedAccounts ?? "–"}>
          {counts ? `across ${counts.countries} ${counts.countries === 1 ? "country" : "countries"}` : " "}
        </Stat>
        <Stat label="Feeds needing attention" value={counts?.feedsNeedingAttention ?? "–"}>
          Shown once bank feeds are running
        </Stat>
        <Stat label="Oldest successful sync" value={counts?.oldestSuccessfulSyncAt ? formatRelative(counts.oldestSuccessfulSyncAt) : "—"}>
          {counts?.oldestSuccessfulSyncAt ? "across live banks" : "No syncs yet"}
        </Stat>
      </div>

      <div className="-mx-5 mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Bank</th>
              <th scope="col" className="px-4 py-3">Country</th>
              <th scope="col" className="px-4 py-3">Connection</th>
              <th scope="col" className="px-4 py-3">Schedule</th>
              <th scope="col" className="px-4 py-3 text-right">Accounts</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Last sync</th>
              <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {banks.isPending && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">Loading banks…</td>
              </tr>
            )}
            {!banks.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-ink-muted">
                  {filter ? "No banks match this filter." : "No banks yet. Add the first one with Add bank."}
                </td>
              </tr>
            )}
            {rows.map((bank) => (
              <tr key={bank.id} className="hover:bg-slate-50/60">
                <td className="py-3 pr-4 pl-5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-slate-50 text-3xs font-bold text-ink-soft">
                      {bank.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{bank.name}</p>
                      <p className="font-mono text-2xs text-ink-muted">{bank.bic}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{countryName(bank.countryCode)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{connectionLabels[bank.connectionType]}</p>
                  <p className="max-w-56 truncate font-mono text-2xs text-ink-muted" title={bank.endpoint ?? undefined}>
                    {bank.endpoint ?? "Operations upload files"}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink-soft">{scheduleLabels[bank.schedule]}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{bank.linkedAccounts}</td>
                <td className="px-4 py-3">
                  <Badge tone={bank.enabled ? "success" : "neutral"}>{bank.enabled ? "Live" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatRelative(bank.lastSyncAt)}</td>
                <td className="py-3 pr-5 pl-4">
                  <div className="flex justify-end gap-2">
                    {bank.enabled ? (
                      <Button size="sm" variant="secondary" onClick={() => setDisabling(bank)}>
                        Disable
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={enable.isPending} onClick={() => enable.mutate({ id: bank.id })}>
                        Enable
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="bg-primary-50 text-primary-600 hover:bg-primary-100" onClick={() => setEditing(bank)}>
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {counts && (
        <p className="mt-4 text-xs text-ink-muted">
          Showing {rows.length} of {counts.total} {counts.total === 1 ? "bank" : "banks"} · disabling a bank pauses its
          syncs but keeps all historical data
        </p>
      )}

      <BankDialog
        bank={editing}
        onClose={() => setEditing(null)}
        onSaved={async (bank, added) => {
          await refresh();
          setEditing(null);
          setNotice({ tone: "success", message: added ? `${bank.name} is added and live.` : `${bank.name} is updated.` });
        }}
      />
      <ConfirmDialog
        open={disabling !== null}
        title={`Disable ${disabling?.name ?? "bank"}?`}
        description="Its syncs pause and clients can't add new accounts with it. Everything already received is kept, and you can enable it again at any time."
        confirmLabel="Disable bank"
        tone="danger"
        busy={disable.isPending}
        onConfirm={() => disabling && disable.mutate({ id: disabling.id })}
        onClose={() => setDisabling(null)}
      />
    </section>
  );
}

function Stat({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-2xs text-ink-muted">{children}</p>
    </div>
  );
}
