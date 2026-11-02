import { ApiError } from "@atomprive/api-client";
import { useMyForms, type PortalFormRow } from "@atomprive/api-client/portal";
import { CalendarClock, CheckCircle2, FileSignature, PenLine } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { when } from "../lib/dates";

/**
 * Every form in the client's pack. Pending holds everything not yet signed by them: what the firm has sent, which they
 * can sign now, and what it is still preparing, which they can read and will sign once it is sent. One sent and still
 * unsigned after its due date shows under Expired and can still be signed; Completed holds what is signed and on file.
 */

const TABS = [
  { id: "PENDING", label: "Pending" },
  { id: "COMPLETED", label: "Completed" },
  { id: "EXPIRED", label: "Expired" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function FormCard({ form }: { form: PortalFormRow }) {
  const signedHere = form.signedHow !== null;
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {form.status === "COMPLETED" ? <CheckCircle2 aria-hidden="true" className="size-5" /> : <FileSignature aria-hidden="true" className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{form.title}</p>
        <p className="text-sm text-ink-muted">
          {[form.reference, form.status === "PENDING" && !form.canSign ? form.stage : null].filter(Boolean).join(" · ")}
          {form.status === "COMPLETED" && form.completedAt
            ? ` · ${signedHere ? "Signed by you" : "Signed copy on file"} ${when(form.completedAt)}`
            : ""}
        </p>
      </div>
      {form.status !== "COMPLETED" && form.dueOn && (
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${form.status === "EXPIRED" ? "text-access-none-ink" : "text-orange-600"}`}>
          <CalendarClock aria-hidden="true" className="size-4" />
          {form.status === "EXPIRED" ? "Was due" : "Due"}: {when(form.dueOn)}
        </p>
      )}
      {form.id ? (
        <Link
          to={`/new/forms/${form.id}`}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${
            !form.canSign
              ? "border border-line bg-white text-ink hover:bg-sidebar"
              : "bg-primary-600 text-on-accent hover:bg-primary-700"
          }`}
        >
          {!form.canSign ? (
            "View"
          ) : (
            <>
              <PenLine aria-hidden="true" className="size-4" />
              Review &amp; sign
            </>
          )}
        </Link>
      ) : (
        <span className="shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">Not started</span>
      )}
    </li>
  );
}

export function FormsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "PENDING";
  const forms = useMyForms<PortalFormRow[], ApiError>();
  const all = forms.data ?? [];
  const shown = all.filter((one) => one.status === tab);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold text-balance text-ink">Forms &amp; Signatures</h1>
        <p className="mt-1 text-sm text-ink-muted">Review and sign your forms and agreements, and see the ones the firm is still preparing.</p>
      </div>

      <div role="tablist" aria-label="Forms" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() =>
              setParams(
                (was) => {
                  const next = new URLSearchParams(was);
                  next.set("tab", one.id);
                  return next;
                },
                { replace: true },
              )
            }
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {one.label} ({all.filter((form) => form.status === one.id).length})
          </button>
        ))}
      </div>

      {forms.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your forms could not be loaded. Refresh the page to try again.</p>
      ) : !forms.data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/60" />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-ink-muted">
          {tab === "PENDING"
            ? "Nothing is waiting for your signature."
            : tab === "EXPIRED"
              ? "Nothing has passed its due date."
              : "Nothing signed yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((form) => (
            <FormCard key={form.id ?? form.kind} form={form} />
          ))}
        </ul>
      )}
    </div>
  );
}
