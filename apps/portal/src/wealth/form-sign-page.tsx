import { ApiError } from "@atomprive/api-client";
import {
  getMyFormQueryKey,
  getMyFormsQueryKey,
  getMyPackFormQueryKey,
  useMyForm,
  useMyPackForm,
  useSignMyForm,
  useSignMyPackForm,
  type PortalFormDetail,
} from "@atomprive/api-client/portal";
import { partsOf } from "@atomprive/forms/document-parts";
import { DocumentWording } from "@atomprive/forms/document-wording";
import { readBack } from "@atomprive/forms/read-back";
import { SignatureMark } from "@atomprive/forms/signature-mark";
import { SignaturePad } from "@atomprive/forms/signature-pad";
import { Alert, Button } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, PenLine, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { when } from "../lib/dates";

/**
 * One form the firm sent the client: read through exactly as the firm prepared it, then signed — by typing their
 * name or drawing their signature — once they have said they agree. A signed one reads back with the signature on
 * it and can be printed or saved as a PDF.
 */

/** A part's heading, with any of the client's details it names written in. */
function named(label: string, details: Record<string, string>, printed: Record<string, string>) {
  return label.replace(/\{\{(\w+)(\^?)}}/g, (_whole, key: string, shouted: string) => {
    const said = details[key]?.trim() || printed[key] || "to fill in";
    return shouted ? said.toUpperCase() : said;
  });
}

function TheDocument({ document }: { document: NonNullable<PortalFormDetail["document"]> }) {
  const details = useMemo(() => {
    const held: Record<string, string> = {};
    for (const [key, value] of Object.entries(document.details ?? {})) if (typeof value === "string") held[key] = value;
    return held;
  }, [document]);
  const ticked = useMemo(() => {
    const held: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(document.details ?? {})) if (typeof value === "boolean") held[key] = value;
    return held;
  }, [document]);
  const printed = useMemo(() => {
    const held: Record<string, string> = {};
    for (const gap of document.gaps) if (gap.printed) held[gap.key] = gap.printed;
    return held;
  }, [document]);
  const parts = useMemo(() => partsOf(document.blocks, document.gaps, document.title), [document]);
  return (
    <div className="divide-y divide-line">
      {parts.map((one) => (
        <div key={one.id} className="space-y-4 px-6 py-6 sm:px-8">
          <h3 className="text-base font-bold text-ink">
            {one.number ? `${one.number} ` : ""}
            {named(one.label, details, printed)}
          </h3>
          <article className="text-ink">
            <DocumentWording blocks={one.blocks} part={one.id} gaps={document.gaps} details={details} ticked={ticked} />
          </article>
        </div>
      ))}
    </div>
  );
}

/** A form of the pack by its kind, for one nobody has started yet. */
type PackKind = Parameters<typeof getMyPackFormQueryKey>[0];

/** Type a name or draw it, say yes, and sign. A form nobody had started is opened by signing it. */
function SignPanel({ formId, kind, title }: { formId?: string; kind?: PackKind; title: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [how, setHow] = useState<"TYPED" | "DRAWN">("TYPED");
  const [typed, setTyped] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const done = (signed: PortalFormDetail) => {
    void queryClient.invalidateQueries({ queryKey: getMyFormsQueryKey() });
    if (formId) {
      void queryClient.invalidateQueries({ queryKey: getMyFormQueryKey(formId) });
    } else if (signed.form.id) {
      // Signing opened the form, so it now has a page of its own.
      void navigate(`/new/forms/${signed.form.id}`, { replace: true });
    }
  };
  const byId = useSignMyForm<ApiError>({ mutation: { onSuccess: done } });
  const byKind = useSignMyPackForm<ApiError>({ mutation: { onSuccess: done } });
  const sign = formId ? byId : byKind;
  const signature = how === "TYPED" ? typed.trim() : (drawn ?? "");

  return (
    <section aria-labelledby="sign-title" className="rounded-2xl border border-line bg-white p-6 print:hidden">
      <h2 id="sign-title" className="text-lg font-bold text-ink">
        Sign this form
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Your signature is recorded with your name, the time and where you signed from.</p>

      <div role="radiogroup" aria-label="How to sign" className="mt-4 inline-flex rounded-lg bg-canvas p-0.5">
        {(
          [
            ["TYPED", "Type my name"],
            ["DRAWN", "Draw my signature"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={how === value}
            onClick={() => setHow(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${how === value ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-w-xl">
        {how === "TYPED" ? (
          <>
            <label htmlFor="typed-signature" className="mb-1.5 block text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              Your full name
            </label>
            <input
              id="typed-signature"
              value={typed}
              maxLength={200}
              onChange={(event) => setTyped(event.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-white px-4 font-serif text-xl italic focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600"
            />
          </>
        ) : (
          <SignaturePad onChange={setDrawn} disabled={sign.isPending} />
        )}
      </div>

      <label className="mt-4 flex max-w-xl items-start gap-3 text-sm text-ink">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 size-4 accent-primary-600" />
        I have read the {title} and agree to it. I understand this is my electronic signature.
      </label>

      {sign.isError && (
        <div className="mt-4 max-w-xl">
          <Alert tone="danger">{sign.error.message}</Alert>
        </div>
      )}

      <Button
        className="mt-5"
        disabled={!signature || !agreed || sign.isPending}
        onClick={() => {
          const data = { signatureKind: how, signature, agreed };
          if (formId) byId.mutate({ id: formId, data });
          else if (kind) byKind.mutate({ kind, data });
        }}
      >
        <PenLine aria-hidden="true" />
        {sign.isPending ? "Signing…" : "Sign"}
      </Button>
    </section>
  );
}

export function FormSignPage() {
  const { id = "", kind } = useParams();
  const byId = useMyForm<PortalFormDetail, ApiError>(id, { query: { enabled: Boolean(id) } });
  const byKind = useMyPackForm<PortalFormDetail, ApiError>(kind as PackKind, { query: { enabled: Boolean(kind) } });
  const detail = kind ? byKind : byId;

  if (detail.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">This form can't be found.</p>
      </div>
    );
  }
  if (!detail.data) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/60" />;
  }
  const { form, answers, attachments, document, signature } = detail.data;
  const done = form.status === "COMPLETED";

  return (
    <div className="space-y-5">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-bold text-balance text-ink">{form.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{form.reference}</p>
        </div>
        <div className="flex items-center gap-3">
          {!done && form.dueOn && (
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${form.status === "EXPIRED" ? "text-access-none-ink" : "text-orange-600"}`}>
              <CalendarClock aria-hidden="true" className="size-4" />
              {form.status === "EXPIRED" ? "Was due" : "Due"} {when(form.dueOn)}
            </span>
          )}
          {done && (
            <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
              <Printer aria-hidden="true" />
              Print or save as PDF
            </Button>
          )}
        </div>
      </div>

      {done ? (
        <Alert tone="success">
          {signature ? `You signed this on ${when(signature.signedAt)}.` : `Your signed copy is on file${form.completedAt ? `, from ${when(form.completedAt)}` : ""}.`} This is the
          record of what was signed.
        </Alert>
      ) : (
        <Alert tone="info">Read the form through. If anything in it is wrong, contact your relationship manager before you sign.</Alert>
      )}

      <section className="rounded-2xl border border-line bg-white">
        {document ? (
          <>
            <div className="border-b border-line px-6 py-6 sm:px-8">
              <h2 className="text-2xl leading-tight font-bold">{document.title}</h2>
            </div>
            <TheDocument document={document} />
          </>
        ) : (
          <div className="p-6">{readBack(form.kind, answers, attachments, id || form.kind)}</div>
        )}
      </section>

      {signature && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-3 text-base font-bold text-ink">Your signature</h2>
          <div className="max-w-sm">
            <SignatureMark made={{ kind: signature.signatureKind, signature: signature.signature ?? "", signerName: signature.signerName, at: signature.signedAt }} />
          </div>
        </section>
      )}

      {form.canSign && <SignPanel formId={id || undefined} kind={kind ? (kind as PackKind) : undefined} title={form.title} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/new/forms" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline print:hidden">
      <ChevronLeft aria-hidden="true" className="size-4" />
      Forms &amp; Signatures
    </Link>
  );
}
