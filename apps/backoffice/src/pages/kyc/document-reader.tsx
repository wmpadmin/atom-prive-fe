import { getReadKycDocumentUrl } from "@atomprive/api-client/backoffice";
import { Alert } from "@atomprive/ui";
import { useEffect, useRef, useState } from "react";
import { httpFile } from "@atomprive/api-client";

/**
 * A client's paper, read here rather than in another tab.
 *
 * <p>A PDF is drawn page by page onto canvases rather than handed to the browser's own viewer, so that it lays
 * out in the page alongside the decision taken on it instead of inside a window of its own.
 */
export function DocumentReader({
  documentId,
  contentType,
}: {
  documentId: string;
  contentType: string;
}) {
  const pages = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState<string>();

  useEffect(() => {
    let alive = true;
    let drawn: string | undefined;

    async function show() {
      const blob = await httpFile(`/api${getReadKycDocumentUrl(documentId).replace("/api", "")}`);
      if (!alive) return;
      if (!contentType.includes("pdf")) {
        drawn = URL.createObjectURL(blob);
        setImage(drawn);
        return;
      }
      // Loaded only where a PDF is actually opened: it is the heaviest thing on the screen and most clients
      // send photographs.
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      const file = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
      if (!alive || !pages.current) return;
      pages.current.replaceChildren();
      for (let number = 1; number <= file.numPages; number++) {
        const page = await file.getPage(number);
        if (!alive || !pages.current) return;
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "mx-auto mb-3 w-full max-w-3xl rounded-lg border border-line bg-white shadow-sm";
        pages.current.append(canvas);
        const context = canvas.getContext("2d");
        if (context) {
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
      }
    }

    show()
      .catch((failed: Error) => alive && setProblem(failed.message || "That file couldn't be opened."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      if (drawn) URL.revokeObjectURL(drawn);
    };
    // Nothing resets here: a different document is a different reader, keyed on its own id by whoever opens
    // it, so it starts with its own blank state rather than clearing somebody else's.
  }, [documentId, contentType]);

  return (
    <div className="space-y-2">
      {problem && <Alert tone="danger">{problem}</Alert>}
      {/* No scroller of its own: the document lays out at its full height and the page scrolls it, while the
          decision beside it stays put. A pane within the page would clip the document at its own bottom edge
          and leave a page cut in half. */}
      <div className="rounded-xl border border-line bg-slate-50 p-3">
        {loading && <p className="py-10 text-center text-sm text-ink-muted">Opening the document…</p>}
        {image && <img src={image} alt="" className="mx-auto w-full max-w-3xl rounded-lg border border-line bg-white" />}
        <div ref={pages} />
      </div>
    </div>
  );
}
