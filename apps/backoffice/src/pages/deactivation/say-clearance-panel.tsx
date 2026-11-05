import { ApiError } from "@atomprive/api-client";
import {
  getReadClearanceQueryKey,
  useSayClearance,
  useSayClearanceWithDocument,
  type RequestClearances,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn, Field, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { standingLabels } from "./clearance-labels";

const TAKES = ["application/pdf", "image/jpeg", "image/png"];

const BIGGEST = 10 * 1024 * 1024;

function sized(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The three answers, in the order a desk is most likely to give them. */
const ANSWERS = [
  {
    id: "GO_AHEAD" as const,
    said: "I confirm nothing of ours is outstanding on this client.",
  },
  { id: "PENDING" as const, said: "We are still working through it." },
  { id: "BLOCKED" as const, said: "We cannot clear it, and here is why." },
];

/**
 * Where a desk answers for itself.
 *
 * <p>Shown only to somebody who holds one of the desks the question was put to — the server refuses
 * anybody else, and a form that submits into a refusal is worse than no form.
 */
export function SayClearancePanel({
  customerId,
  standing,
}: {
  customerId: string;
  standing: RequestClearances;
}) {
  const queryClient = useQueryClient();
  const say = useSayClearance<ApiError>();
  const sayWith = useSayClearanceWithDocument<ApiError>();
  const fileRef = useRef<HTMLInputElement>(null);

  const mine = standing.roles.find((one) => one.mine);
  const [answer, setAnswer] = useState<(typeof ANSWERS)[number]["id"]>("GO_AHEAD");
  const [comments, setComments] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string>();

  if (!mine || !standing.startedAt) {
    return null;
  }

  function take(arriving: File | undefined) {
    if (!arriving) return;
    if (!TAKES.includes(arriving.type)) {
      setProblem("That has to be a PDF, a JPEG or a PNG.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (arriving.size > BIGGEST) {
      setProblem(`That file is ${sized(arriving.size)}, and the most the firm takes is 10 MB.`);
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
    // Said here as well as on the server, so the refusal arrives before the round trip rather than after.
    if (answer === "BLOCKED" && comments.trim() === "") {
      setProblem("Say what is blocking it, so somebody can act on it.");
      return;
    }
    const after = {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getReadClearanceQueryKey(customerId) });
        setComments("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      },
      onError: (caught: ApiError) => setProblem(caught.message),
    };
    if (file) {
      sayWith.mutate(
        {
          customerId,
          data: { file },
          params: { standing: answer, comments: comments.trim() || undefined, role: mine?.role },
        },
        after,
      );
    }
    else {
      say.mutate(
        {
          customerId,
          // Sent as null rather than left out: the field is nullable, and omitting it would leave a
          // previous comment standing beside an answer that no longer carries one.
          // The desk this box is for, so somebody holding several answers for the one shown.
          data: { standing: answer, comments: comments.trim() || null, role: mine?.role ?? null },
        },
        after,
      );
    }
  }

  const sending = say.isPending || sayWith.isPending;
  const already = mine.standing !== "AWAITED";

  return (
    <section className="rounded-2xl border border-line bg-white px-6 py-5">
      <h2 className="text-base font-bold">Your answer, as {mine.roleSaid}</h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        {already
          ? `You said "${standingLabels[mine.standing]}". Answering again replaces it.`
          : "Review anything of yours on this client, then say where it stands."}
      </p>

      <form onSubmit={send} className="mt-4 space-y-4">
        {problem && <Alert tone="danger">{problem}</Alert>}

        <fieldset className="space-y-2">
          <legend className="sr-only">What you are saying</legend>
          {ANSWERS.map((one) => (
            <label
              key={one.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3",
                answer === one.id ? "border-primary-600 bg-primary-50" : "border-line",
              )}
            >
              <input
                type="radio"
                name="standing"
                value={one.id}
                checked={answer === one.id}
                onChange={() => setAnswer(one.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">{standingLabels[one.id]}</span>
                <span className="block text-xs text-ink-muted">{one.said}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Field
          id="clearance-comments"
          label="Comments"
          hint={answer === "BLOCKED" ? "Required — say what is blocking it." : "Optional."}
          required={answer === "BLOCKED"}
        >
          <TextArea
            id="clearance-comments"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={answer === "BLOCKED" ? "A transfer is still in flight." : ""}
          />
        </Field>

        <Field id="clearance-file" label="Supporting document" hint="Optional. A PDF, JPEG or PNG, up to 10 MB.">
          <div
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setOver(false);
              take(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
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
              <p className="text-sm text-ink-soft">
                Drop a file here, or{" "}
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
            )}
            <input
              ref={fileRef}
              id="clearance-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => take(event.target.files?.[0])}
            />
          </div>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : already ? "Change my answer" : "Submit clearance"}
          </Button>
        </div>
      </form>
    </section>
  );
}
