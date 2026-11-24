import { httpFile } from "@atomprive/api-client";
import { Button, Dialog } from "@atomprive/ui";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { saveApiFile } from "../lib/download";

/**
 * A file shown on the same screen (24 Nov 2026), not in a new tab: fetched with the session's token, then drawn in a
 * box over the page. Pictures and PDFs show inside it; anything else offers the download.
 */
export function FileViewer({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const [file, setFile] = useState<{ href: string; type: string }>();
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    let href: string | undefined;
    let gone = false;
    httpFile(url)
      .then((blob) => {
        if (gone) return;
        href = URL.createObjectURL(blob);
        setFile({ href, type: blob.type || guessType(fileName) });
      })
      .catch(() => { if (!gone) setProblem("The file couldn't be opened."); });
    return () => {
      gone = true;
      if (href) URL.revokeObjectURL(href);
    };
  }, [url, fileName]);
  const picture = file?.type.startsWith("image/");
  const pdf = file?.type === "application/pdf";
  return (
    <Dialog open size="2xl" tall title={fileName} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-line bg-canvas">
          {problem ? <p className="text-sm text-red-700">{problem}</p>
            : !file ? <p className="text-sm text-ink-muted">Opening…</p>
            : picture ? <img src={file.href} alt={fileName} className="max-h-full max-w-full object-contain" />
            : pdf ? <iframe src={file.href} title={fileName} className="size-full min-h-[70vh] bg-white" />
            : <p className="text-sm text-ink-muted">This kind of file can't be shown here. Download it to open it.</p>}
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => void saveApiFile(url, fileName)}><Download aria-hidden="true" />Download</Button>
        </div>
      </div>
    </Dialog>
  );
}

function guessType(name: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  return "";
}
