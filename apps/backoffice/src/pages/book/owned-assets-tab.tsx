import { ApiError, httpFile } from "@atomprive/api-client";
import {
  askToRemoveOwnedAsset,
  attachToOwnedAsset,
  detachFromOwnedAsset,
  getListOwnedAssetsQueryKey,
  getReadOwnedAssetFileUrl,
  useListOwnedAssets,
  withdrawOwnedAssetChange,
  type ClientOwnedAssets,
  type OwnedAssetChangeRow,
  type OwnedAssetFileRow,
  type OwnedAssetRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Dialog, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, ImagePlus, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "../../lib/labels";
import { openApiFile } from "../../lib/download";
import { money } from "./book-figures";
import { CategoryChart, TimeChart } from "./overview-charts";
import { rateOn } from "./overview-data";
import { column as col, row as exportRow, useExportSheet } from "./overview-export";
import { AddItemDialog, EditItemDialog, ValuationDialog, type Person } from "./owned-asset-forms";
import type { PanelContext } from "./overview-panels";

/** A change asked for, in words. */
function saying(change: OwnedAssetChangeRow, currency: string) {
  switch (change.kind) {
    case "ADD": return `Add ${change.assetName}${change.item ? ` at ${money(change.item.value)} ${currency}` : ""}`;
    case "VALUE": return `Value ${change.assetName} at ${change.valuation ? money(change.valuation.value) : ""} ${currency}${change.valuation ? ` (${formatDate(change.valuation.valuedOn)})` : ""}`;
    case "EDIT": return `Change the cost or owners of ${change.assetName}`;
    default: return `Take ${change.assetName} off the list`;
  }
}

/**
 * What the client owns outside the managed portfolio: what it cost, what it is worth, how that has moved, and
 * whose it is.
 *
 * <p>Figures are kept in the portfolio's own currency and shown in the page's, at each day's rate — today's for
 * what things are worth now, a valuation's own day for the history. A change to a figure goes to the client's
 * relationship manager once the client has a portfolio; what an item is saves at once.
 */
export function OwnedAssetsTab({ context, people }: { context: PanelContext; people: Person[] }) {
  const { customerId, sources } = context;
  const { overview } = sources;
  const queryClient = useQueryClient();
  const listed = useListOwnedAssets<ClientOwnedAssets, ApiError>(customerId);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const data = listed.data;
  const shown = overview.currency;
  const base = data?.currency ?? overview.baseCurrency;
  // Today's rate for what things are worth now; a valuation's own day's for its history.
  const today = overview.rates.length ? overview.rates[overview.rates.length - 1]!.value : 1;
  const now = (amount: number) => amount * today;
  const on = (amount: number, day: string) => amount * (overview.rates.length ? rateOn(overview.rates, day) : 1);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListOwnedAssetsQueryKey(customerId) });
  const done = async (asked: OwnedAssetChangeRow | null) => {
    setNotice(asked === null ? "Saved." : asked.status === "PENDING"
      ? "Sent to the client's relationship manager to approve. It shows below until they answer."
      : "Saved.");
    await refresh();
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    items.forEach((one) => totals.set(one.category ?? "No category", (totals.get(one.category ?? "No category") ?? 0) + one.value * today));
    return [...totals.entries()].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);
  }, [items, today]);

  useExportSheet(() => data ? {
    columns: [col("Item"), col("Category"), col(`Cost (${shown})`, "MONEY"), col(`Current value (${shown})`, "MONEY"), col("Change %", "PERCENT"),
      col("Last valued"), col("Valued by"), col("Location"), col(`Insured for (${shown})`, "MONEY"), col("Owners")],
    rows: [
      ...items.map((one) => exportRow([one.description ? `${one.name} (${one.description})` : one.name, one.category ?? "", one.cost === null ? null : now(one.cost),
        now(one.value), one.cost ? ((one.value - one.cost) / one.cost) * 100 : null, one.valuedOn, one.valuedBy ?? "", one.location ?? "",
        one.insured === null ? null : now(one.insured), one.owners.map((owner) => `${owner.name} ${owner.share}%`).join(", ")])),
      exportRow(["Total", "", data.items.some((one) => one.cost !== null) ? now(data.cost) : null, now(data.value), null, "", "", "",
        now(data.insured), ""], 0, true),
    ],
  } : null);

  if (listed.isError) return <Alert tone="danger">{listed.error.message}</Alert>;
  if (!data) return <p className="py-10 text-center text-sm text-ink-muted">Reading what the client owns…</p>;
  const opened = items.find((one) => one.id === openId) ?? null;
  const waitingOn = (assetId: string) => data.waiting.find((one) => one.assetId === assetId);
  // Gain counts only the items with a cost on file: one without a cost has not gained its whole value.
  const costed = items.filter((one) => one.cost !== null);
  const gain = costed.length ? costed.reduce((sum, one) => sum + one.value, 0) - data.cost : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-4 sm:divide-x">
        {[
          [`Current value (${shown})`, money(now(data.value)), "text-ink"],
          [`Cost (${shown})`, costed.length ? money(now(data.cost)) : "—", costed.length ? "text-ink" : "text-ink-muted/70"],
          [`Gain since bought (${shown})`, gain === null ? "—" : `${gain > 0 ? "+" : ""}${money(now(gain))}`,
            gain === null ? "text-ink-muted/70" : gain < 0 ? "text-danger" : gain > 0 ? "text-emerald-700" : "text-ink"],
          [`Insured for (${shown})`, money(now(data.insured)), "text-ink"],
        ].map(([label, figure, tone]) => (
          <div key={label} className="px-4 py-4 text-center">
            <p className="text-xs font-semibold text-ink-muted">{label}</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{figure}</p>
          </div>
        ))}
      </div>
      {costed.length > 0 && costed.length < items.length && (
        <p className="-mt-2 text-xs text-ink-muted">Cost and gain count only the {costed.length} of {items.length} items with a cost on file.</p>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {failed && <Alert tone="danger">{failed}</Alert>}

      {data.waiting.length > 0 && (
        <section aria-label="Waiting on the relationship manager" className="rounded-2xl border border-access-view/30 bg-access-view-soft px-5 py-3">
          <h2 className="text-sm font-bold">Waiting on the relationship manager</h2>
          <ul className="mt-2 space-y-1.5">
            {data.waiting.map((one) => (
              <li key={one.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="flex-1">{saying(one, base)}</span>
                <span className="text-xs text-ink-muted">Asked by {one.raisedBy} · {formatDate(one.raisedAt.slice(0, 10))}</span>
                {one.canWithdraw && (
                  <button type="button" className="text-xs font-semibold text-primary-700 hover:underline"
                    onClick={async () => {
                      try { await withdrawOwnedAssetChange(one.id); await refresh(); } catch (caught) { setFailed(caught instanceof ApiError ? caught.message : "It could not be taken back."); }
                    }}>
                    Take back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Items" className="min-w-0 rounded-2xl border border-line bg-white px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Items</h2>
            <Button size="sm" onClick={() => { setNotice(null); setAdding(true); }}>
              <Plus aria-hidden="true" className="size-4" /> Add item
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Nothing owned outside the portfolio is on file yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                    <th scope="col" className="rounded-l-lg px-3 py-2 text-left">Item</th>
                    <th scope="col" className="px-3 py-2 text-left">Category</th>
                    <th scope="col" className="px-3 py-2 text-right">Cost ({shown})</th>
                    <th scope="col" className="px-3 py-2 text-right">Current value ({shown})</th>
                    <th scope="col" className="px-3 py-2 text-right">Change</th>
                    <th scope="col" className="px-3 py-2 text-left">Last valued</th>
                    <th scope="col" className="rounded-r-lg px-3 py-2 text-left">Owners</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((one) => {
                    const change = one.cost ? ((one.value - one.cost) / one.cost) * 100 : null;
                    return (
                      <tr key={one.id} onClick={() => setOpenId(one.id)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-canvas/60">
                        <th scope="row" className="px-3 py-2.5 text-left font-semibold">
                          <button type="button" className="text-left hover:underline" onClick={(event) => { event.stopPropagation(); setOpenId(one.id); }}>{one.name}</button>
                          {one.description && <span className="block text-xs font-normal text-ink-muted">{one.description}</span>}
                          {waitingOn(one.id) && <span className="mt-0.5 inline-block rounded bg-access-view-soft px-1.5 py-0.5 text-3xs font-semibold text-access-view-ink">Change waiting</span>}
                        </th>
                        <td className="px-3 py-2.5"><span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-soft">{one.category ?? "No category"}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{one.cost === null ? <span className="text-ink-muted/70">—</span> : money(now(one.cost))}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(now(one.value))}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", change === null ? "text-ink-muted/70" : change < 0 ? "text-danger" : "text-emerald-700")}>
                          {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft">{formatDate(one.valuedOn)}{one.valuedBy ? ` · ${one.valuedBy}` : ""}</td>
                        <td className="px-3 py-2.5 text-ink-soft">{one.owners.map((owner) => `${owner.name} ${Number(owner.share)}%`).join(" · ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section aria-label="By category" className="h-72 rounded-2xl border border-line bg-white px-5 py-4">
          <h2 className="mb-2 text-base font-bold">By category</h2>
          {byCategory.length === 0 ? <p className="text-sm text-ink-muted">Nothing to show yet.</p>
            : <CategoryChart rows={byCategory} type="PIE" format={money} classes={[]} label="Owned assets by category" />}
        </section>
      </div>
      <p className="text-xs text-ink-muted">
        Figures are kept in {base}{shown !== base ? ` and shown in ${shown} at each day's rate` : ""}. These count in the client&apos;s net worth on
        every tab. {data.asksFirst ? "A new item, a new valuation, a new cost or split between owners, and taking an item off go to the client's relationship manager to approve." : "The client is still being set up, so changes save at once."}
      </p>

      {adding && (
        <AddItemDialog open customerId={customerId} currency={base} people={people} asksFirst={data.asksFirst}
          onClose={() => setAdding(false)} onDone={(asked) => { setAdding(false); void done(asked); }} />
      )}
      {opened && (
        <ItemPanel key={opened.id} customerId={customerId} item={opened} base={base} shown={shown} now={now} on={on}
          people={people} asksFirst={data.asksFirst} waiting={waitingOn(opened.id)} onClose={() => setOpenId(null)}
          onDone={async (asked) => { await done(asked); }} onRemoved={async (asked) => { setOpenId(null); await done(asked); }} />
      )}
    </div>
  );
}

/** One item: what it is, its value over time, and its photos and papers. */
function ItemPanel({ customerId, item, base, shown, now, on, people, asksFirst, waiting, onClose, onDone, onRemoved }: {
  customerId: string;
  item: OwnedAssetRow;
  base: string;
  shown: string;
  now: (amount: number) => number;
  on: (amount: number, day: string) => number;
  people: Person[];
  asksFirst: boolean;
  waiting: OwnedAssetChangeRow | undefined;
  onClose: () => void;
  onDone: (asked: OwnedAssetChangeRow | null) => Promise<void>;
  onRemoved: (asked: OwnedAssetChangeRow | null) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [valuing, setValuing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const history = [...item.valuations].reverse().map((one) => ({ on: one.valuedOn, value: on(one.value, one.valuedOn) }));
  const photos = item.files.filter((one) => one.kind === "PHOTO");
  const documents = item.files.filter((one) => one.kind === "DOCUMENT");
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListOwnedAssetsQueryKey(customerId) });

  const upload = async (kind: "PHOTO" | "DOCUMENT", files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await attachToOwnedAsset(customerId, item.id, { kind }, { file });
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The file could not be added.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (file: OwnedAssetFileRow) => {
    try { await detachFromOwnedAsset(customerId, item.id, file.id); await refresh(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The file could not be taken off."); }
  };

  return (
    <Dialog open size="xl" title={item.name} description={item.category ?? "No category"} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil aria-hidden="true" className="size-4" /> Edit</Button>
          <Button size="sm" disabled={Boolean(waiting)} onClick={() => setValuing(true)}>New valuation</Button>
          <Button size="sm" variant="secondary" disabled={Boolean(waiting)} onClick={() => setRemoving(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> Take off the list
          </Button>
        </div>
        {waiting && <Alert tone="warning">A change is waiting on the relationship manager: {saying(waiting, base)}. Another change waits until it is answered.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[
            ["Bought on", item.acquiredOn ? formatDate(item.acquiredOn) : "—"],
            [`Cost (${shown})`, item.cost === null ? "—" : money(now(item.cost))],
            [`Current value (${shown})`, money(now(item.value))],
            ["Valued on · by", `${formatDate(item.valuedOn)}${item.valuedBy ? ` · ${item.valuedBy}` : ""}`],
            ["Location", item.location ?? "—"],
            [`Insured for (${shown})`, item.insured === null ? "—" : money(now(item.insured))],
            ["Owners", item.owners.map((owner) => `${owner.name} ${Number(owner.share)}%`).join(" · ")],
            ["Description", item.description ?? "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
              <dd className="mt-0.5 text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-label="Value over time">
          <h3 className="mb-2 text-sm font-bold">Value over time</h3>
          <div className="h-56 rounded-xl border border-line px-3 py-2">
            {history.length > 1 ? <TimeChart points={history} label={`${item.name}, value`} axisTitle={shown} format={money} />
              : <p className="grid h-full place-items-center text-sm text-ink-muted">One valuation so far. A second draws the line.</p>}
          </div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {item.valuations.map((one) => (
              <li key={one.id} className="flex justify-between gap-3 py-1.5">
                <span className="text-ink-soft">{formatDate(one.valuedOn)}{one.valuedBy ? ` · ${one.valuedBy}` : ""}</span>
                <span className="font-semibold tabular-nums">{money(on(one.value, one.valuedOn))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Photos">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">Photos</h3>
            <button type="button" disabled={busy} onClick={() => photoInput.current?.click()} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
              <ImagePlus aria-hidden="true" className="size-4" /> Add photos
            </button>
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(event) => { void upload("PHOTO", event.target.files); event.target.value = ""; }} />
          </div>
          {photos.length === 0 ? <p className="text-sm text-ink-muted">No photos yet.</p> : (
            <div className="flex flex-wrap gap-2">
              {photos.map((one) => <Photo key={one.id} customerId={customerId} assetId={item.id} file={one} onRemove={() => void remove(one)} />)}
            </div>
          )}
        </section>

        <section aria-label="Documents">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">Documents</h3>
            <button type="button" disabled={busy} onClick={() => docInput.current?.click()} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
              <Paperclip aria-hidden="true" className="size-4" /> Add documents
            </button>
            <input ref={docInput} type="file" multiple hidden onChange={(event) => { void upload("DOCUMENT", event.target.files); event.target.value = ""; }} />
          </div>
          {documents.length === 0 ? <p className="text-sm text-ink-muted">No documents yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {documents.map((one) => (
                <li key={one.id} className="flex items-center gap-2 py-1.5">
                  <FileText aria-hidden="true" className="size-4 text-ink-muted" />
                  <button type="button" className="flex-1 truncate text-left text-primary-700 hover:underline"
                    onClick={() => void openApiFile(getReadOwnedAssetFileUrl(customerId, item.id, one.id), one.fileName)}>{one.fileName}</button>
                  <span className="text-xs text-ink-muted">{formatDate(one.uploadedAt.slice(0, 10))}</span>
                  <button type="button" aria-label={`Take ${one.fileName} off`} onClick={() => void remove(one)} className="text-ink-muted hover:text-danger">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editing && (
        <EditItemDialog open customerId={customerId} currency={base} people={people} item={item} asksFirst={asksFirst}
          onClose={() => setEditing(false)} onDone={(asked) => { setEditing(false); void onDone(asked); }} />
      )}
      {valuing && (
        <ValuationDialog open customerId={customerId} currency={base} item={item} asksFirst={asksFirst}
          onClose={() => setValuing(false)} onDone={(asked) => { setValuing(false); void onDone(asked); }} />
      )}
      <Dialog open={removing} title={`Take ${item.name} off the list?`}
        description={asksFirst ? "This goes to the client's relationship manager to approve. Until then it stays on the list." : "It comes off the list, with its valuations, photos and documents."}
        onClose={() => setRemoving(false)}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(false)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const asked = await askToRemoveOwnedAsset(customerId, item.id); setRemoving(false); await onRemoved(asked); }
            catch (caught) { setError(caught instanceof ApiError ? caught.message : "It could not be taken off."); setRemoving(false); }
            finally { setBusy(false); }
          }}>{asksFirst ? "Send for approval" : "Take it off"}</Button>
        </div>
      </Dialog>
    </Dialog>
  );
}

/** A photo, fetched with the session's token, as a thumbnail that opens full size. */
function Photo({ customerId, assetId, file, onRemove }: { customerId: string; assetId: string; file: OwnedAssetFileRow; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const url = getReadOwnedAssetFileUrl(customerId, assetId, file.id);
  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    void httpFile(url).then((blob) => {
      if (gone) return;
      made = URL.createObjectURL(blob);
      setSrc(made);
    }).catch(() => undefined);
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [url]);
  return (
    <div className="group relative size-24 overflow-hidden rounded-xl border border-line bg-canvas">
      <button type="button" className="size-full" aria-label={`Open ${file.fileName}`} onClick={() => void openApiFile(url, file.fileName)}>
        {src ? <img src={src} alt={file.fileName} className="size-full object-cover" /> : <span className="text-xs text-ink-muted">…</span>}
      </button>
      <button type="button" aria-label={`Take ${file.fileName} off`} onClick={onRemove}
        className="absolute top-1 right-1 hidden rounded-md bg-white/90 p-0.5 text-ink-muted group-hover:block hover:text-danger">
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
