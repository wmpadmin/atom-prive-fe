import { ApiError } from "@atomprive/api-client";
import {
  getGetClientKycFileQueryKey,
  getListKycDocumentsQueryKey,
  useListKycPapers,
  useUploadKycDocument,
  type PaperRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, DateInput, Dialog, Field, SelectInput, TextInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

/**
 * What the firm asks a client for, in the order it usually asks: a person's own papers first, then a company's.
 * Every kind is offered whoever the client is, because the firm's checklist asks an individual for a trade
 * licence and audited accounts too where they own a business.
 */

/** The one choice that is not a paper: it is how a paper the firm has never filed before gets named. */
const SOMETHING_ELSE = "something-else";

/** What the firm takes, and the most it takes. Checked here so a refusal is immediate rather than a round trip. */
const TAKES = ["application/pdf", "image/jpeg", "image/png"];

const BIGGEST = 10 * 1024 * 1024;

function sized(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whether this is a file the firm can take, in the words it would use to say why not.
 *
 * <p>A dropped file has not been through the picker's own accept list, so it arrives unchecked — and the
 * two ways in have to refuse the same things or dropping would be a way around a rule the picker keeps.
 */
function whyNot(file: File) {
  if (!TAKES.includes(file.type)) {
    return "That has to be a PDF, a JPEG or a PNG.";
  }
  if (file.size > BIGGEST) {
    return `That file is ${sized(file.size)}, and the most the firm takes is 10 MB.`;
  }
  return null;
}

function yearsFromToday(years: number) {
  const now = new Date();
  return new Date(now.getFullYear() + years, now.getMonth(), now.getDate());
}

/**
 * Puts one of a client's papers on file. Compliance upload on the client's behalf until the customer portal is
 * built and they can hand it over themselves.
 */
export function UploadKycDialog({
  customerId,
  clientName,
  open,
  onClose,
}: {
  customerId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const upload = useUploadKycDocument<ApiError>();
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * The file chosen, however it was chosen.
   *
   * <p>Held here rather than read off the input at the moment of sending, because a file dropped onto the
   * dialog never goes near the input: the two ways of choosing have to end in the same place or the form
   * would have to ask which one was used.
   */
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const papers = useListKycPapers<PaperRow[], ApiError>({ query: { staleTime: 60_000 } });
  /**
   * Which paper is chosen, by its id — or SOMETHING_ELSE, which is how a paper the firm has never filed
   * before gets named.
   */
  const [chosen, setChosen] = useState("");
  const [otherName, setOtherName] = useState("");
  const [reference, setReference] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [problem, setProblem] = useState<string>();

  /**
   * A file arriving, from the picker or from a drop.
   *
   * <p>One function for both, so a refusal reads the same either way and neither route can quietly accept
   * something the other would turn down.
   */
  function take(arriving: File | undefined) {
    if (!arriving) {
      return;
    }
    const no = whyNot(arriving);
    if (no) {
      setProblem(no);
      // Cleared, so the form does not look as though it is holding a file it has just refused.
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setProblem(undefined);
    setFile(arriving);
  }

  function send(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    if (!file) {
      setProblem("Choose the file to put on file.");
      return;
    }
    const paper = (papers.data ?? []).find((one) => one.id === chosen);
    const naming = chosen === SOMETHING_ELSE;
    if (naming && otherName.trim() === "") {
      setProblem("Say what the document is called.");
      return;
    }
    if (!naming && !paper) {
      setProblem("Choose what the document is.");
      return;
    }
    // A built-in paper goes under its own kind. One the firm named — whether picked from the list or being
    // named now — goes under OTHER, carrying the name, and the name joins the list for next time.
    upload.mutate(
      {
        customerId,
        data: { file },
        params: {
          kind: (!naming && paper?.kind) ? paper.kind : "OTHER",
          ...(naming ? { otherName: otherName.trim() } : {}),
          ...(!naming && paper && !paper.kind ? { otherName: paper.name } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(expiresOn ? { expiresOn } : {}),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetClientKycFileQueryKey(customerId) });
          void queryClient.invalidateQueries({ queryKey: getListKycDocumentsQueryKey() });
          setReference("");
          setExpiresOn("");
          setOtherName("");
          setFile(null);
          if (fileRef.current) fileRef.current.value = "";
          onClose();
        },
        onError: (caught) => setProblem(caught.message),
      },
    );
  }

  return (
    <Dialog open={open} size="lg" onClose={onClose} title={`Add a document for ${clientName}`}>
      <form onSubmit={send} className="space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}

        <Field id="kyc-kind" label="What it is" required>
          <SelectInput
            id="kyc-kind"
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
          >
            <option value="" disabled>
              {papers.isPending ? "Reading the list…" : "Choose what it is"}
            </option>
            {(papers.data ?? []).map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
            {/* Last, because it is the way out of the list rather than one of its entries. */}
            <option value={SOMETHING_ELSE}>Something else…</option>
          </SelectInput>
        </Field>

        {/* Asked for only where the list has nothing that fits. What is typed here becomes one of the
            firm's own papers, so the next client who sends the same thing is filed under these words
            rather than a second spelling of them. */}
        {chosen === SOMETHING_ELSE && (
          <Field
            id="kyc-other"
            label="What is it called?"
            required
            hint="It joins the list above, so it can be chosen directly next time."
          >
            <TextInput
              id="kyc-other"
              value={otherName}
              onChange={(event) => setOtherName(event.target.value)}
              placeholder="Title deed"
              maxLength={120}
            />
          </Field>
        )}

        <Field id="kyc-reference" label="Reference" hint="The number the document itself carries, where it has one.">
          <TextInput
            id="kyc-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="K1234567A"
          />
        </Field>

        <Field id="kyc-expires" label="Expires" hint="Leave blank where the document doesn't run out.">
          <DateInput
            id="kyc-expires"
            name="expiresOn"
            value={expiresOn}
            clearable
            min={yearsFromToday(0)}
            max={yearsFromToday(20)}
            onChange={setExpiresOn}
          />
        </Field>

        <Field id="kyc-file" label="The file" required hint="A PDF, JPEG or PNG, up to 10 MB.">
          {/* Both ways in end at take(): the picker for somebody who wants the file browser, the drop for
              somebody who already has the file in front of them. The input is kept in the tree rather than
              replaced by a button, because it is what a screen reader and the keyboard already know how to
              open — the drop zone is an addition to it, not a replacement for it. */}
          <div
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              // Without this the browser leaves the page and opens the file on its own, losing the half-
              // filled form behind it.
              event.preventDefault();
              setOver(false);
              take(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              over ? "border-primary-600 bg-primary-50" : "border-line bg-canvas",
            )}
          >
            {file ? (
              <div className="flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                  <p className="text-xs text-ink-muted">{sized(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Drop the file here, or{" "}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="font-semibold text-primary-700 underline underline-offset-2
                      focus-visible:ring-2 focus-visible:ring-line focus-visible:outline-none"
                  >
                    choose one
                  </button>
                  .
                </p>
              </>
            )}

            <input
              ref={fileRef}
              id="kyc-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => take(event.target.files?.[0])}
            />
          </div>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Put on file"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
