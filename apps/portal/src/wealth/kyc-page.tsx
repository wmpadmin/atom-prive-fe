import { ApiError, httpFile } from "@atomprive/api-client";
import {
  getDocumentsQueryKey,
  getMyKycQueryKey,
  useMyKyc,
  useUpload,
  type KycRequirement,
  type MyKyc,
} from "@atomprive/api-client/portal";
import { Alert, Button, Dialog } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, CircleX, Clock, FileText, Upload, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * The client's KYC: every paper the firm asks them for and where each stands, read from the same checklist
 * Compliance work from. What they still have to send comes first, with why a copy was sent back; then what the
 * firm is checking; then what is approved. Uploading goes to Compliance's review queue, as it does from Documents.
 */

type Group = "owed" | "waiting" | "approved";

function groupOf(paper: KycRequirement): Group {
  if (paper.stands === "APPROVED") return "approved";
  if (paper.stands === "AWAITING_REVIEW") return "waiting";
  return "owed";
}

function day(at: string | null | undefined) {
  return at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** What a paper the client still owes says under its name. */
function owedLine(paper: KycRequirement) {
  switch (paper.stands) {
    case "RE_UPLOAD_REQUESTED":
      return `Sent back${paper.decidedAt ? ` on ${day(paper.decidedAt)}` : ""} — please send a new copy`;
    case "REJECTED":
      return `Not accepted${paper.decidedAt ? ` on ${day(paper.decidedAt)}` : ""} — please send a new copy`;
    case "EXPIRED":
      return `Expired${paper.expiresOn ? ` on ${day(paper.expiresOn)}` : ""} — please send the renewed one`;
    default:
      return "Not sent yet";
  }
}

const OWED_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  RE_UPLOAD_REQUESTED: { icon: CircleX, tone: "bg-red-50 text-red-700" },
  REJECTED: { icon: CircleX, tone: "bg-red-50 text-red-700" },
  EXPIRED: { icon: CircleAlert, tone: "bg-amber-50 text-amber-800" },
  NOT_SENT: { icon: FileText, tone: "bg-amber-50 text-amber-800" },
};

export function KycPage() {
  const kyc = useMyKyc<MyKyc, ApiError>();
  const [uploading, setUploading] = useState<KycRequirement>();
  const [problem, setProblem] = useState<string>();

  if (!kyc.data) {
    return (
      <div className="space-y-5">
        <Heading />
        {kyc.isError ? <Alert tone="danger">{kyc.error.message}</Alert> : <div className="h-40 animate-pulse rounded-2xl bg-white" />}
      </div>
    );
  }

  const papers = kyc.data.papers;
  const owed = papers.filter((one) => groupOf(one) === "owed");
  const waiting = papers.filter((one) => groupOf(one) === "waiting");
  const approved = papers.filter((one) => groupOf(one) === "approved");

  const view = async (paper: KycRequirement) => {
    if (!paper.documentId) return;
    setProblem(undefined);
    // Opened while the click is still the client's, or the browser takes it for a pop-up.
    const opened = window.open("", "_blank");
    try {
      const blob = await httpFile(`/api/portal/documents/kyc/${paper.documentId}`);
      const href = URL.createObjectURL(blob);
      if (opened) opened.location.replace(href);
      else window.location.assign(href);
    } catch (caught) {
      opened?.close();
      setProblem(caught instanceof ApiError ? caught.message : "The document could not be opened.");
    }
  };

  return (
    <div className="space-y-5">
      <Heading />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Status settled={approved.length} total={papers.length} owed={owed.length} waiting={waiting.length}
            remindedAt={kyc.data.remindedAt} />
          {problem && <Alert tone="danger">{problem}</Alert>}

          {owed.length > 0 && (
            <Section title="What we need from you" note={count(owed.length)}>
              {owed.map((paper) => {
                const look = OWED_LOOK[paper.stands] ?? OWED_LOOK.NOT_SENT!;
                return (
                  <Row key={paper.paperId} icon={look.icon} tone={look.tone} title={paper.kindTitle} line={owedLine(paper)}
                    action={
                      <Button onClick={() => setUploading(paper)}>
                        <Upload aria-hidden="true" />
                        {paper.stands === "NOT_SENT" || paper.stands === "EXPIRED" ? "Upload" : "Upload new copy"}
                      </Button>
                    }
                  >
                    {paper.reason && (paper.stands === "RE_UPLOAD_REQUESTED" || paper.stands === "REJECTED") && (
                      <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{paper.reason}</p>
                    )}
                  </Row>
                );
              })}
            </Section>
          )}

          {waiting.length > 0 && (
            <Section title="With us for review" note="Usually within 2 working days">
              {waiting.map((paper) => (
                <Row key={paper.paperId} icon={Clock} tone="bg-slate-100 text-ink-soft" title={paper.kindTitle}
                  line={[paper.receivedAt && `Received ${day(paper.receivedAt)}`, paper.fileName].filter(Boolean).join(" · ")}
                  action={
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink-soft">
                      Awaiting review
                    </span>
                  }
                />
              ))}
            </Section>
          )}

          {approved.length > 0 && (
            <Section title="Approved" note={count(approved.length)}>
              {approved.map((paper) => (
                <Row key={paper.paperId} icon={Check} tone="bg-emerald-50 text-emerald-700" title={paper.kindTitle}
                  line={[paper.decidedAt && `Approved ${day(paper.decidedAt)}`, paper.expiresOn && `expires ${day(paper.expiresOn)}`]
                    .filter(Boolean).join(" · ")}
                  action={paper.documentId && (
                    <Button variant="secondary" onClick={() => void view(paper)}>View</Button>
                  )}
                />
              ))}
            </Section>
          )}

          {papers.length === 0 && (
            <p className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-ink-muted">
              The firm hasn&rsquo;t asked you for any documents.
            </p>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-ink">How it works</h2>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>Upload a clear scan or photo (PDF, JPG or PNG).</li>
              <li>Our compliance team reviews it, usually within 2 working days.</li>
              <li>If we need a better copy, we&rsquo;ll tell you why here and by email.</li>
            </ol>
            <p className="mt-3 text-sm text-ink-muted">We&rsquo;ll remind you before a document expires, so your account stays verified.</p>
          </section>
          {kyc.data.relationshipManager && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Questions?</p>
              <div className="mt-2.5 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {initials(kyc.data.relationshipManager)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{kyc.data.relationshipManager}</p>
                  <p className="text-xs text-ink-muted">Your relationship manager</p>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {uploading && <UploadPaper paper={uploading} onClose={() => setUploading(undefined)} />}
    </div>
  );
}

function Heading() {
  return (
    <div>
      <h1 className="text-[1.625rem] font-bold text-balance text-ink">KYC</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The documents we need to keep your account verified. Upload what is missing and we&rsquo;ll review it.
      </p>
    </div>
  );
}

function count(n: number) {
  return `${n} ${n === 1 ? "document" : "documents"}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

/** Where the client stands overall: the ring, the line under it, and the firm's last reminder. */
function Status({ settled, total, owed, waiting, remindedAt }: {
  settled: number; total: number; owed: number; waiting: number; remindedAt: string | null;
}) {
  const share = total === 0 ? 0 : Math.round((settled / total) * 100);
  const done = total > 0 && settled === total;
  const said = [
    owed > 0 && `${owed} ${owed === 1 ? "document still needs" : "documents still need"} to come from you`,
    waiting > 0 && `${waiting} ${waiting === 1 ? "is" : "are"} with us for review`,
  ].filter(Boolean).join(", and ");
  return (
    <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-white px-6 py-5">
      <div
        role="img"
        aria-label={`${settled} of ${total} documents approved`}
        className="grid size-20 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--color-primary-600) 0 ${share}%, var(--color-primary-50) ${share}% 100%)` }}
      >
        <span className="grid size-15 place-items-center rounded-full bg-white text-base font-extrabold text-ink tabular-nums">
          {settled} / {total}
        </span>
      </div>
      <div className="min-w-60 flex-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${done
          ? "bg-emerald-50 text-emerald-700" : owed > 0 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-ink-soft"}`}
        >
          {done ? "All approved" : owed > 0 ? "Action needed" : "With us for review"}
        </span>
        <h2 className="mt-2 text-lg font-bold text-ink">
          {settled} of {total} {total === 1 ? "document" : "documents"} approved
        </h2>
        {said && <p className="text-sm text-ink-muted">{said[0]!.toUpperCase() + said.slice(1)}.</p>}
        {remindedAt && owed > 0 && (
          <p className="mt-2.5 inline-block rounded-lg bg-primary-50 px-3 py-1.5 text-sm text-primary-700">
            Atom Privé sent you a reminder on {day(remindedAt)}.
          </p>
        )}
      </div>
    </section>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5 pb-2">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <span className="text-sm text-ink-muted">{note}</span>
      </div>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function Row({ icon: Icon, tone, title, line, action, children }: {
  icon: LucideIcon; tone: string; title: string; line: string; action?: ReactNode; children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 px-6 py-3.5 sm:flex-nowrap">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {line && <p className="text-sm text-ink-muted">{line}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

/** Sending one paper the firm asked for: it is filed under that paper and waits for Compliance. */
function UploadPaper({ paper, onClose }: { paper: KycRequirement; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUpload<ApiError>({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getMyKycQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getDocumentsQueryKey() });
        onClose();
      },
    },
  });
  // A paper the platform has its own name for is sent as that kind; one the firm named is sent by its name.
  const kind = paper.kind ?? "OTHER";

  return (
    <Dialog open onClose={onClose} title={`Upload ${paper.kindTitle}`}
      description="It goes to our compliance team, and shows as with us for review until they have checked it."
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="kyc-file" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            File
          </label>
          <input
            id="kyc-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
          />
          <p className="mt-1 text-xs text-ink-muted">PDF, JPEG or PNG, up to 10 MB.</p>
        </div>
        <div>
          <label htmlFor="kyc-expires" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Expires on (if it has a date)
          </label>
          <input
            id="kyc-expires"
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
          />
        </div>
        {upload.isError && <Alert tone="danger">{upload.error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>Cancel</Button>
          <Button
            disabled={!file || upload.isPending}
            onClick={() =>
              file &&
              upload.mutate({
                params: { kind, otherName: kind === "OTHER" ? paper.kindTitle : undefined, expiresOn: expiresOn || undefined },
                data: { file },
              })
            }
          >
            <Upload aria-hidden="true" />
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
