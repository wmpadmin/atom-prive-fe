import { ApiError } from "@atomprive/api-client";
import {
  answerNewHolding,
  answerNewHoldings,
  getListNewHoldingsQueryKey,
  useListNewHoldings,
  type NewHoldingQueue,
  type NewHoldingRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, Field, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HoldingHistoryDialog, HoldingsTree, type TreeLine } from "../../components/holdings-tree";
import { formatDate } from "../../lib/labels";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "all";

const TABS: { id: Status; label: string }[] = [
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "all", label: "All" },
];

const STANDING: Record<string, [string, string]> = {
  PENDING: ["Waiting", "bg-amber-50 text-amber-800"],
  APPROVED: ["Approved", "bg-emerald-50 text-emerald-700"],
  REJECTED: ["Rejected", "bg-red-50 text-red-700"],
};

/** An amount as the bank stated it, in its own currency. */
function stated(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * New holdings: lines a client's bank file brings for the first time. They wait here for the client's portfolio
 * manager and go onto the client's portfolio only on a yes, exactly as the bank stated them. A no keeps the line
 * off, and the next file asks again.
 */
export function NewHoldingsPage() {
  const queryClient = useQueryClient();
  const queue = useListNewHoldings<NewHoldingQueue, ApiError>({ query: { refetchOnWindowFocus: true } });
  const [tab, setTab] = useState<Status>("PENDING");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [declining, setDeclining] = useState<NewHoldingRow[] | null>(null);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [shape, setShape] = useState<"list" | "tree">("list");
  const [reading, setReading] = useState<TreeLine | null>(null);

  const all = queue.data?.items ?? [];
  const rows = all.filter((one) => tab === "all" || one.status === tab);
  const answerable = rows.filter((one) => one.canAnswer);
  const count = (id: Status) => all.filter((one) => id === "all" || one.status === id).length;

  async function settle(work: () => Promise<NewHoldingQueue>) {
    setBusy(true);
    setProblem(null);
    try {
      const fresh = await work();
      queryClient.setQueryData(getListNewHoldingsQueryKey(), fresh);
      setPicked(new Set());
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "That could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function approve(ids: string[]) {
    void settle(() => (ids.length === 1 ? answerNewHolding(ids[0]!, { approve: true, reason: null })
      : answerNewHoldings({ ids, approve: true, reason: null })));
  }

  function reject() {
    setTried(true);
    if (!declining || !reason.trim()) return;
    const ids = declining.map((one) => one.id);
    void settle(() => (ids.length === 1 ? answerNewHolding(ids[0]!, { approve: false, reason: reason.trim() })
      : answerNewHoldings({ ids, approve: false, reason: reason.trim() }))).then(() => {
      setDeclining(null);
      setReason("");
      setTried(false);
    });
  }

  const lineOf = (one: NewHoldingRow): TreeLine => ({
    key: one.id, customerId: one.customerId, name: one.name, isin: one.isin,
    levels: [one.clientName, one.assetClass ?? one.bankClass ?? "Class not stated"],
    units: one.units, amounts: one.amounts.map((amount) => ({ currency: amount.currency, value: amount.value })),
    trailing: one.canAnswer ? (
      <span className="inline-flex gap-2" onDoubleClick={(event) => event.stopPropagation()}>
        <Button size="sm" disabled={busy} onClick={(event) => { event.stopPropagation(); approve([one.id]); }}>Approve</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={(event) => { event.stopPropagation(); setDeclining([one]); }}>Reject</Button>
      </span>
    ) : <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", (STANDING[one.status] ?? ["", "bg-slate-100 text-ink-muted"])[1])}>{(STANDING[one.status] ?? [one.status])[0]}</span>,
  });

  const toggle = (id: string) => setPicked((now) => {
    const next = new Set(now);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const chosen = answerable.filter((one) => picked.has(one.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Holdings that appeared for the first time in a client&apos;s bank file. They join the client&apos;s portfolio only once approved, exactly as the bank sent them.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show">
          {TABS.map((one) => (
            <button key={one.id} type="button" role="tab" aria-selected={tab === one.id}
              onClick={() => { setTab(one.id); setPicked(new Set()); }}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold",
                tab === one.id ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:bg-slate-50")}>
              {one.label} <span className="ml-0.5 tabular-nums">{count(one.id)}</span>
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold" role="tablist" aria-label="Shown as">
          {(["list", "tree"] as const).map((one) => (
            <button key={one} type="button" role="tab" aria-selected={shape === one} onClick={() => setShape(one)}
              className={cn("rounded-md px-2.5 py-1", shape === one ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:text-ink")}>
              {one === "list" ? "List" : "By client"}
            </button>
          ))}
        </div>
        {chosen.length > 0 && shape === "list" && (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => approve(chosen.map((one) => one.id))}>Approve {chosen.length}</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDeclining(chosen)}>Reject {chosen.length}</Button>
          </div>
        )}
      </div>
      {problem && <Alert tone="danger">{problem}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        {queue.isError ? (
          <p className="px-5 py-10 text-center text-sm text-red-700">The new holdings could not be loaded. Refresh to try again.</p>
        ) : !queue.data ? (
          <div className="m-5 h-32 animate-pulse rounded-xl bg-slate-50" />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            {tab === "PENDING" ? "No new holdings are waiting." : "Nothing here yet."}
          </p>
        ) : shape === "tree" ? (
          <div className="px-5 pt-1 pb-3">
            <HoldingsTree lines={rows.map(lineOf)} note="Click a client or class to open it · double-click a holding for its history in the bank's files" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="w-10 py-2.5 pl-5">
                  {answerable.length > 0 && (
                    <input type="checkbox" aria-label="Select every holding you can answer" className="size-4 accent-primary-600"
                      checked={answerable.length > 0 && answerable.every((one) => picked.has(one.id))}
                      onChange={(event) => setPicked(event.target.checked ? new Set(answerable.map((one) => one.id)) : new Set())} />
                  )}
                </th>
                <th scope="col" className="px-3 py-2.5">Client</th>
                <th scope="col" className="px-3 py-2.5">New holding</th>
                <th scope="col" className="px-3 py-2.5 text-right">Quantity</th>
                <th scope="col" className="px-3 py-2.5 text-right">Value, as sent</th>
                <th scope="col" className="px-3 py-2.5">In the file of</th>
                <th scope="col" className="px-3 py-2.5">Status</th>
                <th scope="col" className="py-2.5 pr-5 pl-3"><span className="sr-only">Answer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one) => {
                const [label, tone] = STANDING[one.status] ?? [one.status, "bg-slate-100 text-ink-muted"];
                return (
                  <tr key={one.id} className="cursor-pointer align-top hover:bg-slate-50/60" title="Double-click for its history"
                    onDoubleClick={() => setReading(lineOf(one))}>
                    <td className="py-3 pl-5">
                      {one.canAnswer && (
                        <input type="checkbox" aria-label={`Select ${one.name}`} className="size-4 accent-primary-600"
                          checked={picked.has(one.id)} onChange={() => toggle(one.id)} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{one.clientName}</span>
                      <span className="block text-xs text-ink-muted">{[one.clientCode, one.bankName].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{one.name}</span>
                      <span className="block text-xs text-ink-muted">
                        {[one.isin, one.bankClass && (one.assetClass && one.assetClass !== one.bankClass ? `${one.bankClass} → ${one.assetClass}` : one.bankClass)]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{one.units == null ? "—" : one.units.toLocaleString("en-US")}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {one.amounts.map((amount) => <span key={amount.currency} className="block">{stated(amount.currency, amount.value)}</span>)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-muted">{one.asOf ? formatDate(one.asOf) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", tone)}>{label}</span>
                      {one.answeredBy && (
                        <span className="mt-1 block text-xs text-ink-muted">
                          {one.answeredBy}{one.answeredAt ? `, ${formatDate(one.answeredAt.slice(0, 10))}` : ""}
                        </span>
                      )}
                      {one.status === "REJECTED" && one.reason && <span className="mt-1 block text-xs text-red-700">{one.reason}</span>}
                    </td>
                    <td className="py-3 pr-5 pl-3">
                      {one.canAnswer && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={busy} onClick={() => approve([one.id])}>Approve</Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDeclining([one])}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reading && <HoldingHistoryDialog line={reading} onClose={() => setReading(null)} />}
      <Dialog open={declining !== null} onClose={() => { setDeclining(null); setTried(false); }}
        title={declining && declining.length > 1 ? `Reject ${declining.length} holdings?` : "Reject this holding?"}
        description={declining?.length === 1 ? `${declining[0]!.name} stays off ${declining[0]!.clientName}'s portfolio. The next bank file asks again.`
          : "They stay off the clients' portfolios. The next bank file asks again."}>
        <Field id="new-holding-reason" label="Why" required error={tried && !reason.trim() ? "Say why it is turned down." : undefined}>
          <TextArea id="new-holding-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setDeclining(null); setTried(false); }}>Cancel</Button>
          <Button disabled={busy} onClick={reject}>Reject</Button>
        </div>
      </Dialog>
    </div>
  );
}
