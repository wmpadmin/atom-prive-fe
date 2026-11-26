import { ApiError, http } from "@atomprive/api-client";
import {
  useGetOnboardingCase,
  useGetProspect,
  type CaseDetail,
  type ProspectDetail,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn } from "@atomprive/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { renderAsync } from "docx-preview";
import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../../lib/labels";
import { holderName, namedControllers, toForm } from "../onboarding/application";
import { OnboardingPdf, SelfCertificationPages } from "../onboarding/onboarding-print";
import { editable, filled, numbered, prepared, withoutEmptyPages, type AgreementValues } from "./agreement-docx";
import entityFile from "./agreement-files/Investment_Advisory_Agreement_Entity.docx?url";
import individualFile from "./agreement-files/Investment_Advisory_Agreement_Individual.docx?url";
// Word's own drawing of the Schedule 6 risk-profile matrix, an EMF in the file that no browser can show (25 Nov 2026).
import riskMatrix from "./agreement-files/risk-profile-matrix.png?url";
import "./agreement-word.css";

/**
 * The firm's Word agreement on a prospect's Agreement tab (25 Nov 2026, kept on localhost for now): the Individual
 * agreement for an individual or joint prospect, the Entity one for an entity, drawn from the Word file itself. Every
 * field in it is typed in or ticked in place by the RM, Operations or the Admin, each change kept as it is made, until
 * the Admin signs; Download Word gives the firm's file with what was typed written into its own fields.
 */
type AgreementFieldsView = {
  kind: "INDIVIDUAL" | "ENTITY";
  values: AgreementValues;
  editable: boolean;
  changedAt: string | null;
  changedBy: string | null;
};

const fieldsKey = (prospectId: string, kind: string) => ["prospect-agreement-fields", prospectId, kind] as const;

/** How long typing pauses before what was typed is kept; a tick is kept at once. */
const TYPING_PAUSE = 700;

export function AgreementWord({ prospectId, entity, signed }: { prospectId: string; entity: boolean; signed: boolean }) {
  const kind = entity ? "ENTITY" : "INDIVIDUAL";
  const queryClient = useQueryClient();
  const prospect = useGetProspect<ProspectDetail, ApiError>(prospectId);
  const name = prospect.data?.prospect.fullName ?? "client";
  const fields = useQuery<AgreementFieldsView, ApiError>({
    queryKey: fieldsKey(prospectId, kind),
    queryFn: () => http<AgreementFieldsView>(`/api/backoffice/prospects/${prospectId}/agreement/fields?kind=${kind}`),
    // Drawn once from what was kept; typing then keeps its own copy, so a refetch never redraws the file under it.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const loaded = fields.data !== undefined;
  const mayChange = fields.data?.editable ?? false;
  const paper = useRef<HTMLDivElement>(null);
  const original = useRef<Blob | null>(null);
  const values = useRef<AgreementValues>({});
  const pending = useRef(new Map<string, { timer: number; run: () => void }>());
  const [count, setCount] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<"loading" | "ready" | "failed">("loading");
  const [saving, setSaving] = useState(0);
  const [saved, setSaved] = useState<{ at: string | null; by: string | null } | null>(null);
  const [problem, setProblem] = useState<string>();
  const [downloading, setDownloading] = useState(false);

  // What is typed is kept field by field, once typing pauses; a field still waiting is kept when the tab is left.
  const keep = useRef((key: string, value: string | boolean) => {
    values.current[key] = value;
    const waiting = pending.current.get(key);
    if (waiting) window.clearTimeout(waiting.timer);
    const run = () => {
      pending.current.delete(key);
      setSaving((now) => now + 1);
      http<AgreementFieldsView>(`/api/backoffice/prospects/${prospectId}/agreement/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, key, value }),
      })
        .then((view) => {
          setSaved({ at: view.changedAt, by: view.changedBy });
          setProblem(undefined);
        })
        .catch((caught: unknown) => setProblem(caught instanceof ApiError ? caught.message : "That couldn't be saved."))
        .finally(() => setSaving((now) => now - 1));
    };
    pending.current.set(key, { timer: window.setTimeout(run, typeof value === "boolean" ? 0 : TYPING_PAUSE), run });
  });
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const { timer, run } of waiting.values()) {
        window.clearTimeout(timer);
        run();
      }
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = paper.current;
    if (!root) return;
    let cancelled = false;
    const kept = queryClient.getQueryData<AgreementFieldsView>(fieldsKey(prospectId, kind));
    values.current = { ...(kept?.values ?? {}) };
    setSaved(kept?.changedAt ? { at: kept.changedAt, by: kept.changedBy } : null);
    setDrawing("loading");
    void (async () => {
      try {
        const file = await (await fetch(kind === "ENTITY" ? entityFile : individualFile)).blob();
        if (cancelled) return;
        original.current = file;
        const matrix = await (await fetch(riskMatrix)).blob();
        if (cancelled) return;
        const ready = await prepared(file, { "image2.emf": matrix });
        if (cancelled) return;
        root.innerHTML = "";
        // Pages break only where the file itself breaks them. Word's record of where its own pages last ended is not
        // followed: the viewer cut a clause in two there and numbered the second half again. The footer's page
        // number is not drawn either, since these pages are not Word's: Download Word has them as Word lays them out.
        await renderAsync(ready.file, root, undefined, {
          inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, renderHeaders: false, renderFooters: false,
        });
        if (cancelled) return;
        numbered(root, ready.labels);
        withoutEmptyPages(root);
        setCount(editable(root, ready.start, values.current, mayChange, (key, value) => keep.current(key, value)));
        setDrawing("ready");
      } catch {
        if (!cancelled) setDrawing("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, kind, mayChange, prospectId, queryClient]);

  async function download() {
    if (!original.current) return;
    setDownloading(true);
    try {
      const url = URL.createObjectURL(await filled(original.current, values.current));
      const link = Object.assign(document.createElement("a"), { href: url, download: `Investment Advisory Agreement - ${name}.docx` });
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="agreement-word" className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-primary-700 uppercase">1 · The agreement</p>
          <h2 id="agreement-word" className="text-lg font-bold">Investment Advisory Agreement – {entity ? "Entity" : "Individual"}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {signed
              ? "Signed by the Admin: the fields are locked as they were signed."
              : mayChange
                ? `The firm's Word file. Every field in it can be typed in or ticked by the RM, Operations or the Admin until the Admin signs${count != null ? ` (${count} fields)` : ""}; each change saves on its own.`
                : "The firm's Word file, as filled in so far. Only the RM, Operations or the Admin type in it."}
          </p>
          <p className="mt-1 text-xs font-semibold" aria-live="polite">
            {problem ? <span className="text-red-700">{problem}</span>
              : saving > 0 ? <span className="text-ink-muted">Saving…</span>
              : saved?.at ? <span className="text-emerald-700">✓ Saved · {formatDateTime(saved.at)}{saved.by ? ` by ${saved.by}` : ""}</span>
              : null}
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={drawing !== "ready" || downloading} onClick={() => void download()}>
          <Download aria-hidden="true" className="size-4" />Download Word
        </Button>
      </div>
      {fields.isError && <Alert tone="danger">The agreement's fields couldn't be loaded: {fields.error.message}</Alert>}
      <div className="agreement-paper mt-4">
        {drawing !== "ready" && (
          <p className="p-10 text-center text-sm text-ink-muted">
            {drawing === "failed" ? "The Word file couldn't be opened." : "Opening the Word file…"}
          </p>
        )}
        {/* Laid out while it is drawn, out of sight, so the clause numbers can be measured. */}
        <div ref={paper} className={cn(drawing !== "ready" && "invisible h-0 overflow-hidden")} />
      </div>
    </section>
  );
}

/**
 * The self-certification as it was filled in at onboarding (25 Nov 2026, local only), read-only: the same pages as in
 * the Download document. An entity's own form with an Annex for each controlling person; each account holder's form
 * for an individual or joint prospect. The chips go to each form.
 */
export function AgreementSelfCertification({ prospectId, entity }: { prospectId: string; entity: boolean }) {
  const prospect = useGetProspect<ProspectDetail, ApiError>(prospectId);
  const caseId = prospect.data?.onboardingCaseId ?? null;
  const name = prospect.data?.prospect.fullName ?? "client";
  const onboarding = useGetOnboardingCase<CaseDetail, ApiError>(caseId ?? "", { query: { enabled: Boolean(caseId) } });
  const application = useMemo(() => (onboarding.data ? toForm(onboarding.data.application) : null), [onboarding.data]);
  const pages = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const chips = useMemo(() => {
    if (!application) return [];
    if (application.clientType === "ENTITY") {
      const form = application.entity.selfCertification;
      return [`${application.entity.legalName || name} (entity)`,
        ...namedControllers(form).map((place) => `Controlling person · ${form.controllingPersons[place]!.fullName!.trim()}`)];
    }
    return application.holders.flatMap((holder, index) => (index === 0 || !holder.details.skipped ? [holderName(holder, index)] : []));
  }, [application, name]);

  function go(at: number) {
    setShown(at);
    const box = pages.current;
    const section = box?.querySelectorAll<HTMLElement>(".op-doc > section")[at];
    if (box && section) box.scrollTo({ top: section.offsetTop - 16, behavior: "smooth" });
  }

  return (
    <section aria-labelledby="agreement-self-cert" className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-primary-700 uppercase">2 · Self-certification</p>
          <h2 id="agreement-self-cert" className="text-lg font-bold">Self-Certification Form – {entity ? "Entity" : "Individual"}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">As filled in at onboarding: the same pages as the self-certification in its Download document, read-only here.</p>
        </div>
        <Button variant="secondary" size="sm" disabled={!application || downloading} onClick={() => setDownloading(true)}>
          <Download aria-hidden="true" className="size-4" />{downloading ? "Preparing…" : "Download PDF"}
        </Button>
      </div>
      {!caseId ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing yet: the self-certification is filled in at onboarding, once documents have started.</p>
      ) : onboarding.isError ? (
        <Alert tone="danger">The onboarding forms couldn't be loaded.</Alert>
      ) : !application ? (
        <p className="mt-4 text-sm text-ink-muted">Opening the self-certification…</p>
      ) : (
        <>
          {chips.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Go to a form">
              {chips.map((label, at) => (
                <button key={label} type="button" onClick={() => go(at)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold",
                    shown === at ? "border-primary-200 bg-primary-50 text-primary-700" : "border-line bg-white text-ink-soft hover:bg-canvas")}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div ref={pages} className="agreement-cert mt-4">
            <div className="op-doc"><SelfCertificationPages application={application} /></div>
          </div>
          {downloading && (
            <OnboardingPdf application={application} fileName={`Self-Certification Form - ${name}.pdf`} selfCertificationOnly
              onDone={() => setDownloading(false)} />
          )}
        </>
      )}
    </section>
  );
}
