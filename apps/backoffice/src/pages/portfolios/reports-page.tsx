import { ApiError } from "@atomprive/api-client";
import {
  getDownloadReportUrl,
  getListReportsQueryKey,
  useListCustomers,
  useListModelPortfolios,
  useListReports,
  useProduceReport,
  type CustomerPage,
  type ModelsPage,
  type ReportRow,
  type ReportsPage,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, DateInput, Field, SelectInput, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useStaffUser } from "../../auth/session";
import { ListPageHeader } from "../../components/record-list";
import { noErrors, toFormErrors, type FormErrors } from "../../lib/api-errors";
import { saveApiFile } from "../../lib/download";
import { ReportSchedules } from "./report-schedules";
import { formatDateTime } from "../../lib/labels";
import { hasAuthority } from "../../lib/permissions";

type Kind = ReportRow["kind"];
type Scope = ReportRow["scope"];
type Format = ReportRow["format"];

/** The two files a report comes out as, and what each is for. */
const FORMATS: { format: Format; title: string; forWhat: string }[] = [
  { format: "CSV", title: "Spreadsheet", forWhat: "Opens in Excel or Sheets, to sort and filter." },
  { format: "PDF", title: "On the firm's letterhead", forWhat: "To read as a document, and to send to a client." },
];

/** What each report answers, said where it is chosen rather than left to the title. */
const KINDS: { kind: Kind; title: string; answers: string }[] = [
  { kind: "ALLOCATION_VS_PLAN", title: "Allocation vs plan", answers: "Every class against what the plan wants, and the trade that would put it back." },
  { kind: "HOLDINGS", title: "Holdings", answers: "Every holding line by line, with its issuer, country and rating." },
  { kind: "DRIFT_HISTORY", title: "Drift history", answers: "What a portfolio was worth on each day somebody wrote it down, and how it was split." },
  { kind: "MODEL_PERFORMANCE", title: "Model performance", answers: "How each plan has done, as the performance screen reads it." },
  { kind: "TRADE_ORDERS", title: "Trade orders", answers: "Every order raised in the period, with who raised it, who passed it and when it settled." },
];

/** Nothing was traded tomorrow, and the firm's record does not go back twenty years. */
function today() {
  const day = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/** The reports read by date. Only the record of what was traded is a period rather than a position. */
const OVER_A_PERIOD: Kind[] = ["TRADE_ORDERS"];

/**
 * Reports produced from what the platform holds, and the record of every one that has been.
 *
 * <p>The firm's own portfolio review is not here. It is produced in a template the firm already uses, and
 * that template dictates its columns and its sheets — one generated here would be a different document
 * wearing the same name.
 */
export function PortfolioReportsPage() {
  const queryClient = useQueryClient();
  const mayProduce = hasAuthority(useStaffUser(), "SEND_PROPOSALS:CHANGE");
  const reports = useListReports<ReportsPage, ApiError>();
  const models = useListModelPortfolios<ModelsPage, ApiError>();

  const [kind, setKind] = useState<Kind>("ALLOCATION_VS_PLAN");
  const [scope, setScope] = useState<Scope>("FIRM");
  const [scopeId, setScopeId] = useState("");
  const [format, setFormat] = useState<Format>("CSV");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [taking, setTaking] = useState<string | null>(null);
  // Only fetched when a report for one client is actually being chosen.
  // Also wanted by the schedules below, which can cover one client, so it is fetched whichever is choosing.
  const clients = useListCustomers<CustomerPage, ApiError>({ size: 200 });

  const produce = useProduceReport<ApiError>({
    mutation: {
      onSuccess: () => {
        setErrors(noErrors);
        void queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
      onError: (caught) => setErrors(toFormErrors(caught)),
    },
  });

  async function take(report: ReportRow) {
    setTaking(report.id);
    try {
      // Fetched as a file rather than as text: a report on the letterhead is a PDF, not something to read
      // as a string. The API says what it is sending and the filename already carries the extension.
      await saveApiFile(getDownloadReportUrl(report.id), report.filename);
    } finally {
      setTaking(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    produce.mutate({
      data: {
        kind,
        scope,
        scopeId: scope === "FIRM" ? null : scopeId || null,
        format,
        // A report that is a position rather than a period carries no dates, whatever is left in the fields.
        from: overAperiod ? from || null : null,
        to: overAperiod ? to || null : null,
      },
    });
  }

  const rows = reports.data?.items ?? [];
  const chosen = KINDS.find((one) => one.kind === kind);
  const overAperiod = OVER_A_PERIOD.includes(kind);

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Reports"
        lead="Produced from what the platform holds, and kept with what each one said at the time."
      />

      {/* The firm's own note: the portfolio review is produced in a template nobody has supplied yet. */}
      <Alert tone="info">
        The firm's portfolio review is not here yet. It is produced in a template the firm already uses, and
        that template sets its columns and its sheets — one generated here would be a different document
        wearing the same name. Everything below can be produced either as a spreadsheet or on the firm's own
        letterhead.
      </Alert>

      {mayProduce && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-bold">Produce one now</h2>
          {errors.form && (
            <div className="mt-3">
              <Alert tone="danger">{errors.form}</Alert>
            </div>
          )}
          <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
            <Field id="report-kind" label="Report" error={errors.fields.kind}>
              <SelectInput id="report-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((one) => (
                  <option key={one.kind} value={one.kind}>
                    {one.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="report-scope" label="Covering" error={errors.fields.scope}>
              <SelectInput
                id="report-scope"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as Scope);
                  setScopeId("");
                }}
              >
                <option value="FIRM">Every client</option>
                <option value="MODEL">Everyone on a model</option>
                <option value="CLIENT">One client</option>
              </SelectInput>
            </Field>
            <Field id="report-which" label="Which" error={errors.fields.scopeId}>
              {scope === "FIRM" ? (
                <SelectInput id="report-which" value="" disabled>
                  <option value="">Not needed</option>
                </SelectInput>
              ) : (
                <SelectInput id="report-which" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">{scope === "MODEL" ? "Choose a model" : "Choose a client"}</option>
                  {scope === "MODEL"
                    ? (models.data?.items ?? []).map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))
                    : (clients.data?.items ?? []).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName}
                        </option>
                      ))}
                </SelectInput>
              )}
            </Field>
            <Field id="report-format" label="As" error={errors.fields.format}>
              <SelectInput
                id="report-format"
                value={format}
                onChange={(event) => setFormat(event.target.value as Format)}
              >
                {FORMATS.map((one) => (
                  <option key={one.format} value={one.format}>
                    {one.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button type="submit" disabled={produce.isPending || (scope !== "FIRM" && !scopeId)}>
              <FileText aria-hidden="true" />
              {produce.isPending ? "Producing…" : "Produce"}
            </Button>
          </form>

          {/* Only for a report read by date. Left empty, it covers everything on record. */}
          {overAperiod && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field id="report-from" label="From" error={errors.fields.from}>
                <DateInput
                  id="report-from"
                  name="from"
                  value={from}
                  min={yearsAgo(20)}
                  max={today()}
                  onChange={(next) => setFrom(next ?? "")}
                />
              </Field>
              <Field id="report-to" label="To" error={errors.fields.to}>
                <DateInput
                  id="report-to"
                  name="to"
                  value={to}
                  min={yearsAgo(20)}
                  max={today()}
                  onChange={(next) => setTo(next ?? "")}
                />
              </Field>
              <p className="pb-2 text-xs text-ink-muted">
                Left empty, it covers everything on record. The last day is counted whole.
              </p>
            </div>
          )}
          {chosen && (
            <p className="mt-2 text-xs text-ink-muted">
              {chosen.answers} {FORMATS.find((one) => one.format === format)?.forWhat}
            </p>
          )}
        </section>
      )}

      <ReportSchedules
        mayChange={mayProduce}
        kinds={KINDS}
        clients={clients.data?.items ?? []}
        models={models.data?.items ?? []}
      />

      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <h2 className="px-5 pt-5 text-base font-bold">Produced</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Report</th>
              <th scope="col" className="px-4 py-3">Scope</th>
              <th scope="col" className="px-4 py-3">Format</th>
              <th scope="col" className="px-4 py-3 text-right">Lines</th>
              <th scope="col" className="px-4 py-3">Produced by</th>
              <th scope="col" className="px-4 py-3">Schedule</th>
              <th scope="col" className="py-3 pr-5 pl-4">
                <span className="sr-only">Download</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reports.isPending && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">Reading the record…</td>
              </tr>
            )}
            {reports.data && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                  Nothing has been produced yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60">
                <td className="py-3 pr-4 pl-5 font-semibold">{row.title}</td>
                <td className="px-4 py-3 text-ink-soft">{row.scopeLabel}</td>
                <td className="px-4 py-3">
                  <Badge tone="neutral">{row.format}</Badge>
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums",
                    // A report that came to nothing is worth noticing rather than downloading to find out.
                    row.lineCount === 0 ? "text-amber-700" : "text-ink-soft",
                  )}
                >
                  {row.lineCount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                  {row.producedBy ?? "System"}
                  <span className="block text-xs text-ink-muted">{formatDateTime(row.producedAt)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{row.schedule}</td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <button
                    type="button"
                    onClick={() => void take(row)}
                    disabled={taking === row.id}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline disabled:text-ink-muted"
                  >
                    <Download aria-hidden="true" className="size-3.5" />
                    {taking === row.id ? "Fetching…" : "Download"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
