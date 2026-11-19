import { httpFile } from "@atomprive/api-client";
import {
  getReadKycDocumentUrl,
  useGetClientKycFile,
  type ClientKycFile,
  type KycDocumentRow,
} from "@atomprive/api-client/backoffice";
import { Badge, Button } from "@atomprive/ui";
import { Eye, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { ApiError } from "@atomprive/api-client";
import { formatDate } from "../../lib/labels";
import { fileMark, reviewStateLabels, reviewStateTones } from "../kyc/kyc-labels";
import { kycStatusLabels, kycStatusTones } from "./client-labels";

/**
 * The client's KYC papers — passport, proof of address and the rest — as small pictures on their file (#78).
 *
 * <p>The pictures wait for a click. Every look at a paper is written to the audit trail ("Opened a KYC
 * document"), so drawing them as the page opens would log one look per paper on every visit to the client,
 * whether anybody looked or not. Listed first, drawn when asked for, each drawing logged as a real look.
 */
export function KycPapersPanel({ clientId }: { clientId: string }) {
  const file = useGetClientKycFile<ClientKycFile, ApiError>(clientId);
  const [showing, setShowing] = useState(false);

  // A relationship manager reads only their own clients' papers; on anyone else's the server says no, and the
  // card is simply not there rather than an error on somebody else's file.
  if (file.isError) return null;
  const papers = file.data?.documents ?? [];

  return (
    <section aria-labelledby="kyc-papers-title" className="min-w-0 space-y-4 rounded-2xl border border-line bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="kyc-papers-title" className="panel-grip text-base font-bold">KYC documents</h2>
          <p className="mt-0.5 text-xs text-ink-muted">The papers on this client&apos;s file. Opening one is recorded in the audit trail.</p>
        </div>
        <div className="flex items-center gap-2">
          {file.data && <Badge tone={kycStatusTones[file.data.kycStatus]}>KYC {kycStatusLabels[file.data.kycStatus].toLowerCase()}</Badge>}
          {papers.length > 0 && !showing && (
            <Button variant="secondary" size="sm" onClick={() => setShowing(true)}>
              <Eye aria-hidden="true" />
              Show previews
            </Button>
          )}
        </div>
      </div>

      {file.isPending && <p className="text-sm text-ink-muted">Loading…</p>}
      {file.data && papers.length === 0 && <p className="text-sm text-ink-muted">No KYC papers on file yet.</p>}
      {papers.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {papers.map((paper) => (
            <li key={paper.id}>
              <Link
                to={`/kyc/${clientId}/documents/${paper.id}`}
                className="group block rounded-xl border border-line p-2 hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                  {showing ? <Thumbnail paper={paper} /> : <FileMark contentType={paper.contentType} />}
                </div>
                <p className="mt-2 truncate text-sm font-semibold group-hover:text-primary-700" title={paper.kindTitle}>{paper.kindTitle}</p>
                <p className="truncate text-xs text-ink-muted">
                  {paper.expiresOn ? `Expires ${formatDate(paper.expiresOn)}` : `Uploaded ${formatDate(paper.uploadedAt)}`}
                </p>
                <span className="mt-1.5 block"><Badge tone={reviewStateTones[paper.reviewState]}>{reviewStateLabels[paper.reviewState]}</Badge></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileMark({ contentType }: { contentType: string }) {
  return (
    <span className="flex flex-col items-center gap-1 text-ink-muted">
      <FileText className="size-7" aria-hidden="true" />
      <span className="text-[11px] font-semibold tracking-wide">{fileMark(contentType)}</span>
    </span>
  );
}

/** One paper, drawn small: a photograph as it is, a PDF by its first page. */
function Thumbnail({ paper }: { paper: KycDocumentRow }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<string>();
  const [failed, setFailed] = useState(false);
  const isPdf = paper.contentType.includes("pdf");

  useEffect(() => {
    let alive = true;
    let drawn: string | undefined;

    async function draw() {
      const blob = await httpFile(`/api${getReadKycDocumentUrl(paper.id).replace("/api", "")}`);
      if (!alive) return;
      if (!isPdf) {
        drawn = URL.createObjectURL(blob);
        setImage(drawn);
        return;
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const target = canvas.current;
      if (!alive || !target) return;
      const viewport = page.getViewport({ scale: 320 / page.getViewport({ scale: 1 }).width });
      target.width = viewport.width;
      target.height = viewport.height;
      const context = target.getContext("2d");
      if (context) await page.render({ canvas: target, canvasContext: context, viewport }).promise;
    }

    draw().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (drawn) URL.revokeObjectURL(drawn);
    };
  }, [paper.id, isPdf]);

  if (failed) return <FileMark contentType={paper.contentType} />;
  if (isPdf) return <canvas ref={canvas} aria-label={`${paper.kindTitle}, first page`} className="h-full w-full bg-white object-contain" />;
  return image
    ? <img src={image} alt={paper.kindTitle} className="h-full w-full object-contain" />
    : <span className="text-xs text-ink-muted">Loading…</span>;
}
