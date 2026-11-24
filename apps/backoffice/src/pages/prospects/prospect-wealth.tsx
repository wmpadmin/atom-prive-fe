import { ApiError } from "@atomprive/api-client";
import {
  getDownloadProspectWealthTemplateUrl,
  getDownloadProspectWealthUrl,
  getGetProspectQueryKey,
  convertProspect,
  getGetProspectDocumentsQueryKey,
  getGetProspectWealthQueryKey,
  sendProspectToCompliance,
  sendProspectWealthToClient,
  uploadProspectWealth,
  useGetProspectWealth,
  type WealthView,
} from "@atomprive/api-client/backoffice";
import { Button, Dialog, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, PenLine, Save, Send, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toFormErrors } from "../../lib/api-errors";
import { saveApiFile } from "../../lib/download";
import { formatDate } from "../../lib/labels";
import { WealthGrid, WealthText, type SaveRegister } from "./wealth-grid";

const usd = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const api = (url: string) => `/api${url.replace("/api", "")}`;

/**
 * The firm's Wealth Accumulation template (23 Nov 2026), a table per holder, on every prospect from the day it is
 * added: filled in bit by bit after meetings, on screen or from the Excel template uploaded. Earnings, expenses,
 * savings and net worth are worked out on the server with the corrected formulas. It goes to Compliance from here,
 * who check it as proof of the source of funds; approved, it goes to the client to sign.
 */
export function ProspectWealth({ prospectId, prospectName, mayChange }: { prospectId: string; prospectName?: string; mayChange: boolean }) {
  const wealth = useGetProspectWealth<WealthView, ApiError>(prospectId);
  const queryClient = useQueryClient();
  const view = wealth.data;
  if (wealth.isError) return <p className="text-sm text-red-700">The wealth accumulation couldn't be loaded.</p>;
  if (!view) return <p className="text-sm text-ink-muted">Loading the wealth accumulation…</p>;
  // Open from the day the prospect is added until Compliance approve it (23 Nov 2026).
  const editable = mayChange && view.editable;
  const refresh = (next: WealthView) => {
    queryClient.setQueryData(getGetProspectWealthQueryKey(prospectId), next);
    void queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(prospectId) });
  };
  const filled = Boolean(view.holders.find((one) => one.primary)?.periods.length);

  return (
    <div className="space-y-4">
      <WealthTables prospectId={prospectId} prospectName={prospectName} view={view} editable={editable} onSaved={refresh} />
      <WealthSend prospectId={prospectId} view={view} filled={filled} mayChange={mayChange} onSent={refresh} />
    </div>
  );
}

/**
 * Where the wealth table stands, and its two sends (23 Nov 2026): to Compliance first, from here; once they approve it,
 * to the client to sign. The client's signing on the portal comes later, so that send is only marked for now.
 */
function WealthSend({ prospectId, view, filled, mayChange, onSent }: {
  prospectId: string;
  view: WealthView;
  filled: boolean;
  mayChange: boolean;
  onSent: (next: WealthView) => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const approved = view.stage === "AGREEMENT_PENDING" || view.stage === "ONBOARDED";
  const run = async (work: () => Promise<WealthView>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      onSent(await work());
    } catch (caught) {
      setProblem(toFormErrors(caught).form ?? "That couldn't be sent.");
    } finally {
      setBusy(false);
    }
  };
  const toCompliance = () => run(async () => {
    // Not set up yet: sending sets the prospect's documents and checks up first, as the first document does.
    if (!view.stage) await convertProspect(prospectId);
    const sent = await sendProspectToCompliance(prospectId, { wealth: true });
    void queryClient.invalidateQueries({ queryKey: getGetProspectDocumentsQueryKey(prospectId) });
    return sent.wealth;
  });
  const toClient = () => run(() => sendProspectWealthToClient(prospectId));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3 text-sm">
      <div className="space-y-0.5">
        <p className="text-ink-muted">
          {approved ? (view.sentToClientAt
            ? `Approved by Compliance. Sent to the client to sign on ${formatDate(view.sentToClientAt)}${view.sentToClientBy ? ` by ${view.sentToClientBy}` : ""}.`
            : "Approved by Compliance. Next: send it to the client to sign.")
            : view.checkedAt ? `With Compliance since ${formatDate(view.checkedAt)}. Changing it now means sending it again.`
            : filled ? "Filled in, not sent to Compliance yet."
            : "Fill this in any time, on screen or from the Excel template, then send it to Compliance."}
        </p>
        {problem && <p className="text-red-700">{problem}</p>}
      </div>
      {mayChange && !approved && view.editable && filled && !view.checkedAt && (
        <Button disabled={busy} onClick={() => void toCompliance()}><Send aria-hidden="true" />{busy ? "Sending…" : "Send to Compliance"}</Button>
      )}
      {mayChange && approved && !view.sentToClientAt && (
        <Button disabled={busy} onClick={() => void toClient()}><PenLine aria-hidden="true" />{busy ? "Sending…" : "Send to client to sign"}</Button>
      )}
    </div>
  );
}

/** The tables themselves, one holder at a time. Read-only for Compliance; editable by the desk while it is the step. */
export function WealthTables({ prospectId, prospectName, view, editable, onSaved }: {
  prospectId: string;
  prospectName?: string;
  view: WealthView;
  editable: boolean;
  onSaved?: (next: WealthView) => void;
}) {
  const [holderAt, setHolderAt] = useState(0);
  // Save (23 Nov 2026): the rows, brief profile and note on screen, all at once; each still saves on leaving it too.
  const savers = useRef(new Set<() => Promise<boolean>>());
  const register = useCallback<SaveRegister>((save) => {
    savers.current.add(save);
    return () => { savers.current.delete(save); };
  }, []);
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const holder = view.holders[Math.min(holderAt, view.holders.length - 1)];
  if (!holder) return null;
  async function saveAll() {
    setSaving(true);
    setSaid(undefined);
    const results = await Promise.all([...savers.current].map((save) => save()));
    setSaving(false);
    setSaid(results.every(Boolean) ? { ok: true, text: "Saved." } : { ok: false, text: "Some figures couldn't be saved. See the rows marked in red." });
  }
  const saved = (next: WealthView) => onSaved?.(next);
  const t = holder.totals;
  const download = () => void saveApiFile(api(getDownloadProspectWealthUrl(prospectId)),
    `Wealth accumulation - ${prospectName ?? "prospect"}.xlsx`);
  const template = () => void saveApiFile(api(getDownloadProspectWealthTemplateUrl(prospectId)),
    `Wealth accumulation template - ${prospectName ?? "prospect"}.xlsx`);
  return (
    <section className="rounded-2xl border border-line bg-white px-5 py-4" aria-labelledby="wealth-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="wealth-title" className="text-base font-bold">Source of income and wealth accumulation · {holder.name}</h3>
          <p className="text-xs text-ink-muted">All figures in USD. Type in the yellow cells; the grey ones work themselves out.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button size="sm" variant="secondary" onClick={template}><FileSpreadsheet aria-hidden="true" />Blank template</Button>}
          {editable && <UploadButton prospectId={prospectId} onSaved={saved} />}
          <Button size="sm" variant="secondary" onClick={download}><Download aria-hidden="true" />Download Excel</Button>
        </div>
      </div>

      {view.holders.length > 1 && (
        <div role="tablist" aria-label="Whose wealth" className="mt-3 flex flex-wrap gap-1">
          {view.holders.map((one, i) => (
            <button key={one.holderId} type="button" role="tab" aria-selected={one === holder} onClick={() => setHolderAt(i)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium",
                one === holder ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line text-ink-soft hover:border-primary-200")}>
              {one.name} · {one.primary ? "main" : "joint"}{one.periods.length === 0 ? " · not filled" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <WealthText key={`profile-${holder.holderId}`} prospectId={prospectId} holder={holder} field="briefProfile" editable={editable} onSaved={saved} register={register} />
        <WealthGrid key={holder.holderId} prospectId={prospectId} holder={holder} editable={editable} onSaved={saved} register={register} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total savings" value={t.savings} />
        <Stat label="Equity / fixed income" value={t.equity} />
        <Stat label="Real estate" value={t.realEstate} />
        <Stat label="Cash and other" value={t.cashAndOther} warn={t.cashAndOther < 0} />
      </div>
      <div className="mt-3 rounded-xl bg-primary-50 px-4 py-3">
        <p className="text-sm text-primary-700">Total net worth (approx.)</p>
        <p className="text-2xl font-bold text-primary-700 tabular-nums">USD {usd.format(t.netWorth)}</p>
      </div>
      {t.cashAndOther < 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Equity and real estate come to more than the savings worked out. Check the periods, or note where the rest came from.
        </p>
      )}
      <div className="mt-4">
        <WealthText key={`note-${holder.holderId}`} prospectId={prospectId} holder={holder} field="note" editable={editable} onSaved={saved} register={register} />
      </div>
      {editable && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {said && <span className={cn("text-sm", said.ok ? "text-emerald-700" : "text-red-700")}>{said.text}</span>}
          <Button size="lg" disabled={saving} onClick={() => void saveAll()}><Save aria-hidden="true" />{saving ? "Saving…" : "Save"}</Button>
        </div>
      )}
    </section>
  );
}


function Stat({ label, value, strong, warn }: { label: string; value: number; strong?: boolean; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg px-3 py-2", strong ? "bg-primary-50" : "bg-canvas")}>
      <p className={cn("text-xs", strong ? "text-primary-700" : "text-ink-muted")}>{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", strong && "text-primary-700", warn && "text-amber-800")}>{usd.format(value)}</p>
    </div>
  );
}



/**
 * The template filled in by hand, uploaded: each holder's sheet with anything on it replaces what they had. Every
 * problem comes back naming its sheet and row, and nothing is saved until the file reads cleanly.
 */
function UploadButton({ prospectId, onSaved }: { prospectId: string; onSaved: (next: WealthView) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [done, setDone] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    setProblem(undefined);
    setDone(false);
    try {
      onSaved(await uploadProspectWealth(prospectId, { file }));
      setDone(true);
    } catch (caught) {
      const said = toFormErrors(caught);
      setProblem(said.form ?? (Object.values(said.fields).join(" ") || "That file couldn't be uploaded."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
        aria-label="Filled-in wealth accumulation template" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />{busy ? "Uploading…" : "Upload filled template"}
      </Button>
      {problem && (
        <Dialog open onClose={() => setProblem(undefined)} title="The template couldn't be read" description="Nothing was saved. Put these right and upload it again.">
          <p className="text-sm whitespace-pre-line text-red-800">{problem}</p>
          <div className="mt-4 flex justify-end"><Button onClick={() => setProblem(undefined)}>OK</Button></div>
        </Dialog>
      )}
      {done && <span role="status" className="self-center text-xs font-semibold text-emerald-700">Filled in from the template.</span>}
    </>
  );
}
