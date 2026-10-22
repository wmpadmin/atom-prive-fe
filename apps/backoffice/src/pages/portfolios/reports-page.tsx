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
import { PagedFooter, usePagedRows } from "../../lib/paged-rows";
import { NotAsked, ReportFields } from "./report-fields";
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
  { kind: "ALLOCATION_VS_PLAN", title: "Allocation vs plan", answers: "What each client holds in each asset class, next to what their model says they should, and what would have to be bought or sold to fix the gap." },
  { kind: "HOLDINGS", title: "Holdings", answers: "Every individual holding, one per line, with who issued it, which country it is in and its credit rating." },
  { kind: "DRIFT_HISTORY", title: "Drift history", answers: "What each portfolio was worth on every day somebody wrote the holdings down, and how the money was split between classes on that day." },
  { kind: "MODEL_PERFORMANCE", title: "Model performance", answers: "How each model has performed, the same figures the Model performance screen shows." },
];

/** Nothing happened tomorrow, and the firm's record does not go back twenty years. */
function today() {
  const day = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

function yearsAgo(years: number) {
  const day = new Date();
  return new Date(day.getFullYear() - years, day.getMonth(), day.getDate());
}

/**
 * The reports read by date rather than as a position.
 *
 * <p>None of them. The one that was is gone with the blotter it read: bulk rebalancing asks the client's
 * manager now instead of raising orders, so there are no orders to list over a period. Kept as a list
 * rather than deleted, because a report read over a stretch is a thing the firm will want again.
 */
const OVER_A_PERIOD: Kind[] = [];

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
  // The record comes back whole rather than a page at a time, so the page is taken here.
  const paged = usePagedRows(rows);
  const chosen = KINDS.find((one) => one.kind === kind);
  const overAperiod = OVER_A_PERIOD.includes(kind);

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Reports"
        lead="Make a spreadsheet or a PDF out of what the platform already holds. Each one is kept, so you can open it again later and see exactly what it said on the day."
      />

      {mayProduce && (
        <section className="rounded-2xl border border-line bg-white p-5">
          {/* The two panels are told apart by once against over and over, so each heading says which it is
              rather than leaving the difference to be worked out from the buttons. */}
          <h2 className="text-base font-bold">Get a report now — just this once</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Pick what you want, press the button, and download it straight away. Nothing is set up and
            nothing happens again afterwards.
          </p>
          {errors.form && (
            <div className="mt-3">
              <Alert tone="danger">{errors.form}</Alert>
            </div>
          )}
          {/* Four across, the same four the scheduling form below uses, so the two line up down the page.
              The button sits on its own row: wedged into the grid it squeezed whichever field it sat
              beside, and the date fields underneath lined up with nothing at all. */}
          <form onSubmit={submit} className="mt-3 space-y-4">
            <ReportFields>
            <Field id="report-kind" label="What you want" error={errors.fields.kind}>
              <SelectInput id="report-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((one) => (
                  <option key={one.kind} value={one.kind}>
                    {one.title}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="report-scope" label="Who it is about" error={errors.fields.scope}>
              <SelectInput
                id="report-scope"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as Scope);
                  setScopeId("");
                }}
              >
                <option value="FIRM">Every client</option>
                <option value="MODEL">Everyone on one model</option>
                <option value="CLIENT">Just one client</option>
              </SelectInput>
            </Field>
            {scope === "FIRM" ? (
              <NotAsked id="report-which" label="Which one" says="Every client — nothing to pick" />
            ) : (
              <Field id="report-which" label="Which one" error={errors.fields.scopeId}>
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
              </Field>
            )}
            <Field id="report-format" label="File type" error={errors.fields.format}>
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

              {/* Only for a report read by date, and in the same grid as the rest so the two sit under
                  Report and Covering rather than under nothing. */}
              {overAperiod && (
                <>
                  <Field id="report-from" label="From this date" error={errors.fields.from}>
                    <DateInput
                      id="report-from"
                      name="from"
                      value={from}
                      min={yearsAgo(20)}
                      max={today()}
                      onChange={(next) => setFrom(next ?? "")}
                    />
                  </Field>
                  <Field id="report-to" label="To this date" error={errors.fields.to}>
                    <DateInput
                      id="report-to"
                      name="to"
                      value={to}
                      min={yearsAgo(20)}
                      max={today()}
                      onChange={(next) => setTo(next ?? "")}
                    />
                  </Field>
                </>
              )}
            </ReportFields>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-prose text-xs text-ink-muted">
                {chosen ? `${chosen.answers} ${FORMATS.find((one) => one.format === format)?.forWhat}` : ""}
                {overAperiod
                  ? " Leave the dates empty to cover everything on record. The last day you pick is included."
                  : ""}
              </p>
              <Button type="submit" disabled={produce.isPending || (scope !== "FIRM" && !scopeId)}>
                <FileText aria-hidden="true" />
                {produce.isPending ? "Making it…" : "Make it"}
              </Button>
            </div>
          </form>
        </section>
      )}

      <ReportSchedules
        mayChange={mayProduce}
        kinds={KINDS}
        clients={clients.data?.items ?? []}
        models={models.data?.items ?? []}
      />

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="px-5 pt-5 text-base font-bold">Reports already made</h2>
        {/* The sideways scroll is its own box so that the footer below sits still while a table wider
            than the card is dragged across. */}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-5">Report</th>
                <th scope="col" className="px-4 py-3">Who it covered</th>
                <th scope="col" className="px-4 py-3">File type</th>
                <th scope="col" className="px-4 py-3 text-right">Lines</th>
                <th scope="col" className="px-4 py-3">Made by</th>
                <th scope="col" className="px-4 py-3">Made how</th>
                <th scope="col" className="py-3 pr-5 pl-4">
                  <span className="sr-only">Download</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.isPending && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">Looking for reports…</td>
                </tr>
              )}
              {reports.data && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                    No reports made yet. Make one above and it appears here.
                  </td>
                </tr>
              )}
              {paged.shown.map((row) => (
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
        </div>
        {/* Not while the record is still being read: a count of nothing, said before anybody has looked,
            reads as there being nothing. */}
        {!reports.isPending && <PagedFooter paged={paged} noun={["report", "reports"]} />}
      </section>
    </div>
  );
}
