import { ApiError } from "@atomprive/api-client";
import {
  useGetBookOverview,
  useListCurrencies,
  type BookAlert,
  type BookAumPoint,
  type BookCurrencyAmount,
  type BookOverview,
  type BookOverviewClient,
  type BookUpcoming,
  type Currency,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, SelectInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { ScatterChart } from "echarts/charts";
import * as echarts from "echarts/core";
import { CalendarDays, Columns3, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { downloadTextFile } from "../../lib/download";
import { formatDate, formatRelative } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "./asset-classes";

echarts.use([ScatterChart]);

/**
 * The portfolio manager's Book Overview, laid out the way the firm's own design draws it: what the book is worth
 * and how it has moved, how it is invested, every client in it, what needs looking at, what is coming up, how the
 * bank feeds behind it are doing, and how the clients spread on return and risk.
 *
 * <p>Read only. Every figure is the server's: whether a client is outside what their model allows is its verdict
 * and is never worked out again here from a band. A client whose figures come only from their bank's files is shown
 * as those files state them — each currency on its own, nothing converted — and where the files hold nothing the
 * cell says so rather than showing a nought.
 */
export function BookOverviewPage() {
  const [currency, setCurrency] = useState("USD");
  const overview = useGetBookOverview<BookOverview, ApiError>(
    { currency },
    { query: { placeholderData: keepPreviousData, refetchInterval: 120_000 } },
  );
  const currencies = useListCurrencies<Currency[], ApiError>();
  const data = overview.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
            Portfolio management / Book overview
          </p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Book Overview</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data
              ? `${data.kpis.entitiesAccounts.entities} ${plural(data.kpis.entitiesAccounts.entities, "client", "clients")} · consolidated across ${data.kpis.entitiesAccounts.custodians} ${plural(data.kpis.entitiesAccounts.custodians, "custodian", "custodians")} · as at ${formatDate(data.asOf)}, in ${data.currency}`
              : "Your assigned clients, read as one book."}
          </p>
        </div>
        <SelectInput id="book-currency" aria-label="Currency the book is shown in" value={currency}
          onChange={(event) => setCurrency(event.target.value)} className="w-28">
          {(currencies.data ?? [{ code: "USD", name: "US dollar" }]).map((one) => (
            <option key={one.code} value={one.code}>{one.code}</option>
          ))}
        </SelectInput>
      </header>

      {overview.isError && <Alert tone="danger">{overview.error.message}</Alert>}
      {!data ? (
        !overview.isError && <p className="py-16 text-center text-sm text-ink-muted">Reading the book…</p>
      ) : (
        <Board data={data} />
      )}
    </div>
  );
}

function Board({ data }: { data: BookOverview }) {
  const cur = data.currency;
  const fileNote = bankFileNote(data.bankFileClients);
  const { aum, netFlows, bookReturn, entitiesAccounts, openAlerts, capitalCalls } = data.kpis;
  return (
    <>
      {/* Six figures, as the design's first row. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Book AUM" value={compact(aum.total, cur)} spark={data.aumHistory.slice(-13)}
          note={
            <>
              {aum.yearToDateChange != null && (
                <span className={toneOf(aum.yearToDateChange)}>{signedCompact(aum.yearToDateChange, cur)} YTD · </span>
              )}
              {aum.counted} of {aum.clients} clients
              {fileNote && <FootNote>{fileNote} unconverted, not in the total.</FootNote>}
            </>
          } />
        <Kpi label="Net flows YTD" value={signedCompact(netFlows.net, cur)} spark={netFlows.cumulative}
          note={
            <>
              Inflows {compact(netFlows.inflows, cur)} · Outflows {compact(netFlows.outflows, cur)}
              {fileNote && <FootNote>{fileNote}: the bank file holds no movements this year.</FootNote>}
            </>
          } />
        <Kpi label="Book return YTD" value={bookReturn.yearToDate == null ? "—" : signedPercent(bookReturn.yearToDate)}
          note={
            <>
              {bookReturn.blendedBenchmark == null ? "No mandate benchmark on file" : (
                <>
                  Blended bench {signedPercent(bookReturn.blendedBenchmark)}
                  {bookReturn.versusBenchmark != null && (
                    <span className={toneOf(bookReturn.versusBenchmark)}> · {signedPoints(bookReturn.versusBenchmark)}</span>
                  )}
                </>
              )}
              <FootNote>
                Measured on {bookReturn.measured} of {bookReturn.clients} clients, weighted by AUM
                {fileNote ? `; ${fileNote}: no return in the bank file.` : "."}
              </FootNote>
            </>
          } />
        <Kpi label="Entities · Accounts" value={`${entitiesAccounts.entities} · ${entitiesAccounts.accounts}`}
          note={`${entitiesAccounts.custodians} ${plural(entitiesAccounts.custodians, "custodian", "custodians")}`} />
        <Kpi label="Open alerts" value={String(openAlerts.total)}
          note={
            <>
              <span className={openAlerts.critical > 0 ? "font-semibold text-red-700" : undefined}>
                {openAlerts.critical} critical
              </span>{" "}
              · {openAlerts.warning} warning · {openAlerts.info} info
            </>
          } />
        <Kpi label="Capital calls · 30 days" value={compact(capitalCalls.total, cur)}
          note={`${capitalCalls.clients} ${plural(capitalCalls.clients, "client", "clients")} · ${capitalCalls.notices} ${plural(capitalCalls.notices, "notice", "notices")} · ${compact(capitalCalls.dueThisWeek, cur)} due this week`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <AumCard data={data} />
        <MandateCard data={data} />
      </div>

      <ClientBookCard data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AlertQueue alerts={data.alerts} />
        <NextThirtyDays upcoming={data.upcoming} />
        <CustodianFeeds data={data} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <RiskReturnCard data={data} />
        <DispersionCard data={data} />
      </div>

      <p className="text-xs text-ink-muted">
        Values in {cur} unless stated, converted at the latest rate on file. Capital calls, events, IPS status, mandate
        benchmarks and volatility are recorded for this screen; everything else is read from the platform's own figures.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Cards                                                                                                         */

function Card({ title, lead, action, children, className }: {
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note, spark }: { label: string; value: string; note: ReactNode; spark?: BookAumPoint[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {spark && spark.length > 1 && <Sparkline points={spark} />}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{note}</div>
    </div>
  );
}

/** A small line of a figure over time, drawn without axes. */
function Sparkline({ points }: { points: BookAumPoint[] }) {
  const values = points.map((one) => one.amount);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const path = values
    .map((value, at) => `${(at / (values.length - 1)) * 80},${22 - ((value - low) / span) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20 shrink-0 text-primary-600" aria-hidden="true">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function FootNote({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-3xs leading-snug text-ink-muted italic">{children}</span>;
}

const RANGES = [
  { id: "1Y", months: 12 },
  { id: "2Y", months: 24 },
  { id: "3Y", months: 36 },
  { id: "ITD", months: null },
] as const;

function AumCard({ data }: { data: BookOverview }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("2Y");
  const months = RANGES.find((one) => one.id === range)?.months ?? null;
  const points = months == null ? data.aumHistory : data.aumHistory.slice(-(months + 1));
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => compact(value, data.currency),
      },
      xAxis: {
        type: "category",
        data: points.map((one) => one.on),
        axisLabel: { color: colours.muted, formatter: (value: string) => monthLabel(value) },
        axisLine: { lineStyle: { color: colours.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } },
      },
      series: [{
        type: "line",
        name: "Book AUM",
        data: points.map((one) => one.amount),
        showSymbol: false,
        lineStyle: { color: colours.text, width: 1.5 },
        itemStyle: { color: colours.text },
        areaStyle: { color: colours.canvas },
      }],
    };
  }, [points, data.currency]);
  const mix = data.assetMix;
  return (
    <Card title="Assets Under Management" lead={`Month-end AUM, your clients, ${data.currency}`}
      action={
        <div role="group" aria-label="Period shown" className="flex rounded-lg border border-line p-0.5">
          {RANGES.map((one) => (
            <button key={one.id} type="button" onClick={() => setRange(one.id)} aria-pressed={range === one.id}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold",
                range === one.id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
              {one.id}
            </button>
          ))}
        </div>
      }>
      {points.length < 2 ? (
        <Empty>There is no valuation history to draw yet.</Empty>
      ) : (
        <Chart option={option} height={240} label="Book AUM at each month end" />
      )}
      <p className="mt-4 text-2xs font-semibold tracking-wider text-ink-muted uppercase">Book asset mix</p>
      {mix.length === 0 ? (
        <Empty>None of your clients holds anything yet.</Empty>
      ) : (
        <>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-sm" aria-hidden="true">
            {mix.map((one, at) => (
              <span key={one.code} style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {mix.map((one, at) => (
              <li key={one.code} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                {one.name}
                <span className="text-ink-muted tabular-nums">{one.sharePercent.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {data.bankFileClients.length > 0 && (
        <p className="mt-3 text-3xs text-ink-muted italic">
          {bankFileNote(data.bankFileClients)} is not in the chart or the mix: the bank file states holdings in several
          currencies, unconverted, and in the bank's own classes.
        </p>
      )}
    </Card>
  );
}

function MandateCard({ data }: { data: BookOverview }) {
  const total = data.byMandate.reduce((sum, one) => sum + one.amount, 0);
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, data.currency) },
      series: [{
        type: "pie",
        radius: ["62%", "86%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: data.byMandate.map((one, at) => ({ name: one.name, value: one.amount, itemStyle: { color: INK[at % INK.length] } })),
      }],
    };
  }, [data.byMandate, data.currency]);
  return (
    <Card title="AUM by Mandate" lead="The model each client is measured against">
      {data.byMandate.length === 0 ? (
        <Empty>None of your clients is on a model yet.</Empty>
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-56">
            <Chart option={option} height={200} label="AUM by mandate" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-xl font-bold tabular-nums">{compact(total, data.currency)}</p>
                <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Book AUM</p>
              </div>
            </div>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {data.byMandate.map((one, at) => (
                <tr key={one.modelPortfolioId ?? one.name}>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                      {one.name}
                      <span className="text-xs text-ink-muted">· {one.clients}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{compact(one.amount, data.currency)}</td>
                  <td className="w-14 py-2 text-right text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {data.bankFileClients.length > 0 && (
        <p className="mt-3 text-3xs text-ink-muted italic">
          {bankFileNote(data.bankFileClients)}: no mandate in the bank file.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Client book                                                                                                   */

type Chip = "all" | "deviations" | "warnings" | "review";

const COLUMNS = [
  { id: "mandate", label: "Mandate" },
  { id: "aum", label: "AUM" },
  { id: "share", label: "Share" },
  { id: "mtd", label: "MTD" },
  { id: "ytd", label: "YTD" },
  { id: "bench", label: "vs Bench" },
  { id: "deviation", label: "Max deviation" },
  { id: "ips", label: "IPS status" },
  { id: "next", label: "Next event" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

function ClientBookCard({ data }: { data: BookOverview }) {
  const [chip, setChip] = useState<Chip>("all");
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const navigate = useNavigate();
  const rows = data.clients;
  const counts = {
    all: rows.length,
    deviations: rows.filter((one) => one.deviating).length,
    warnings: rows.filter((one) => one.ipsStatus === "WARNING").length,
    review: rows.filter((one) => one.reviewDue).length,
  };
  const shown = rows.filter((one) =>
    chip === "all" ? true : chip === "deviations" ? one.deviating : chip === "warnings" ? one.ipsStatus === "WARNING" : one.reviewDue,
  );
  const largestShare = Math.max(1, ...rows.map((one) => one.sharePercent ?? 0));
  const on = (id: ColumnId) => !hidden.has(id);
  const open = (row: BookOverviewClient) => navigate(`/client-workspace/${row.customerId}`);

  return (
    <Card title="Client Book" lead={`Showing ${shown.length} of ${rows.length} clients · sorted by AUM`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Which clients are listed" className="flex rounded-lg border border-line p-0.5">
            {([
              ["all", "All"],
              ["deviations", "Deviations"],
              ["warnings", "Warnings"],
              ["review", "Review due"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setChip(id)} aria-pressed={chip === id}
                className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                  chip === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
                {label} {counts[id]}
              </button>
            ))}
          </div>
          <ColumnsMenu hidden={hidden} onChange={setHidden} />
          <Button variant="secondary" size="sm" onClick={() => exportCsv(shown, data.currency)}>
            <Download aria-hidden="true" />
            Export
          </Button>
        </div>
      }>
      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="py-2.5 pr-3 pl-5">Client</th>
              {on("mandate") && <th scope="col" className="px-3 py-2.5">Mandate</th>}
              {on("aum") && <th scope="col" className="px-3 py-2.5 text-right">AUM</th>}
              {on("share") && <th scope="col" className="px-3 py-2.5">Share</th>}
              {on("mtd") && <th scope="col" className="px-3 py-2.5 text-right">MTD</th>}
              {on("ytd") && <th scope="col" className="px-3 py-2.5 text-right">YTD</th>}
              {on("bench") && <th scope="col" className="px-3 py-2.5 text-right">vs Bench</th>}
              {on("deviation") && <th scope="col" className="px-3 py-2.5 text-right">Max deviation</th>}
              {on("ips") && <th scope="col" className="px-3 py-2.5">IPS status</th>}
              {on("next") && <th scope="col" className="py-2.5 pr-5 pl-3">Next event</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-5 py-10 text-center text-ink-muted">
                  {rows.length === 0 ? "You have no clients assigned yet." : "No client of yours is in this list."}
                </td>
              </tr>
            )}
            {shown.map((row) => {
              const file = row.bankFile;
              return (
                <tr key={row.customerId} onClick={() => open(row)}
                  className={cn("cursor-pointer align-top hover:bg-slate-50", row.deviating && "bg-red-50/40")}>
                  <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal">
                    <span className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary-50 text-xs font-bold text-primary-700" aria-hidden="true">
                        {row.name.charAt(0)}
                      </span>
                      <span>
                        <Link to={`/client-workspace/${row.customerId}`} onClick={(event) => event.stopPropagation()}
                          className="font-semibold whitespace-nowrap hover:text-primary-700 hover:underline">
                          {row.name}
                        </Link>
                        <span className="block text-xs whitespace-nowrap text-ink-muted">
                          {[row.code, typeLabel(row.customerType), row.city].filter(Boolean).join(" · ")}
                        </span>
                        {file && (
                          <span className="mt-0.5 block text-3xs font-semibold text-primary-700">
                            Bank file · {file.banks.join(", ") || "no holdings yet"}
                            {file.asOf && ` · as of ${formatDate(file.asOf)}`}
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  {on("mandate") && <td className="px-3 py-2.5 whitespace-nowrap">{file ? <NotInFile /> : row.mandate ?? <Muted>No model</Muted>}</td>}
                  {on("aum") && (
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                      {file ? <InTheirCurrencies amounts={file.holdings} /> : row.aum == null ? <Muted>—</Muted> : compact(row.aum, data.currency)}
                    </td>
                  )}
                  {on("share") && (
                    <td className="px-3 py-2.5">
                      {file ? <Marker>not converted</Marker> : row.sharePercent == null ? <Muted>—</Muted> : (
                        <span className="flex items-center gap-2" title={`${row.sharePercent.toFixed(1)}% of the book`}>
                          <span className="block h-1.5 w-20 rounded-full bg-slate-100" aria-hidden="true">
                            <span className="block h-full rounded-full bg-primary-600"
                              style={{ width: `${(row.sharePercent / largestShare) * 100}%` }} />
                          </span>
                          <span className="text-xs text-ink-muted tabular-nums">{row.sharePercent.toFixed(1)}%</span>
                        </span>
                      )}
                    </td>
                  )}
                  {on("mtd") && <td className="px-3 py-2.5 text-right tabular-nums">{file ? <NotInFile /> : <Percent value={row.monthToDate} />}</td>}
                  {on("ytd") && <td className="px-3 py-2.5 text-right tabular-nums">{file ? <NotInFile /> : <Percent value={row.yearToDate} />}</td>}
                  {on("bench") && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {file ? <NotInFile /> : row.versusBenchmark == null ? <Muted>—</Muted> : (
                        <span className={toneOf(row.versusBenchmark)}>{signedPoints(row.versusBenchmark)}</span>
                      )}
                    </td>
                  )}
                  {on("deviation") && (
                    <td className="px-3 py-2.5 text-right">
                      {file ? <NotInFile /> : row.maxDeviation == null ? <Muted>—</Muted> : (
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
                          row.deviating ? "bg-red-50 text-red-700" : "bg-slate-100 text-ink-soft")}>
                          {row.maxDeviation.toFixed(1)} pp
                        </span>
                      )}
                    </td>
                  )}
                  {on("ips") && <td className="px-3 py-2.5">{file ? <NotInFile /> : <IpsStatus row={row} />}</td>}
                  {on("next") && (
                    <td className="py-2.5 pr-5 pl-3 text-xs">
                      {file ? <NotInFile /> : row.nextEvent ? (
                        <span className="block max-w-56 truncate" title={eventLine(row.nextEvent)}>
                          {row.nextEvent.title} {formatDate(row.nextEvent.on)}
                        </span>
                      ) : <Muted>—</Muted>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ColumnsMenu({ hidden, onChange }: { hidden: Set<ColumnId>; onChange: (next: Set<ColumnId>) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Columns3 aria-hidden="true" />
        Columns
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-white p-2 shadow-lg">
          {COLUMNS.map((one) => (
            <label key={one.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={!hidden.has(one.id)}
                onChange={() => {
                  const next = new Set(hidden);
                  if (next.has(one.id)) next.delete(one.id);
                  else next.add(one.id);
                  onChange(next);
                }} />
              {one.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function IpsStatus({ row }: { row: BookOverviewClient }) {
  if (row.ipsStatus == null) return <Muted>—</Muted>;
  const [label, tone] = row.ipsStatus === "DEVIATION" ? ["Deviation", "bg-red-50 text-red-700"]
    : row.ipsStatus === "WARNING" ? ["Warning", "bg-amber-50 text-amber-700"]
    : ["Compliant", "bg-emerald-50 text-emerald-700"];
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span title={row.ipsWarning ?? undefined} className={cn("rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tone)}>
        {label}
      </span>
      {row.reviewDue && row.nextReviewOn && (
        <span className="text-3xs whitespace-nowrap text-ink-muted">Review {formatDate(row.nextReviewOn)}</span>
      )}
    </span>
  );
}

/** A bank-file client's holdings, each currency on its own line as the bank wrote it. */
function InTheirCurrencies({ amounts }: { amounts: BookCurrencyAmount[] }) {
  if (amounts.length === 0) return <NotInFile />;
  return (
    <span className="flex flex-col items-end gap-0.5 text-xs">
      {amounts.map((one) => (
        <span key={one.currency} title={`${one.currency} ${one.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} as the bank states it`}>
          {compact(one.amount, one.currency)}
        </span>
      ))}
      <Marker>as in bank file</Marker>
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Alerts, events, feeds                                                                                         */

function AlertQueue({ alerts }: { alerts: BookAlert[] }) {
  const tone = (severity: string) =>
    severity === "CRITICAL" ? "bg-red-50 text-red-700" : severity === "WARNING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-soft";
  const label = (severity: string) => (severity === "CRITICAL" ? "Critical" : severity === "WARNING" ? "Warning" : "Info");
  return (
    <Card title="Alert Queue" lead="Deviations, IPS and data-feed monitors"
      action={<Link to="/drift" className="text-xs font-semibold text-primary-700 hover:underline">Drift & deviations</Link>}>
      {alerts.length === 0 ? <Empty>Nothing needs looking at.</Empty> : (
        <ul className="-my-2 max-h-96 divide-y divide-line overflow-y-auto">
          {alerts.map((one, at) => (
            <li key={`${one.severity}-${one.subject}-${at}`} className="flex gap-3 py-2.5">
              <span className={cn("h-fit w-16 shrink-0 rounded-md px-1.5 py-0.5 text-center text-2xs font-semibold", tone(one.severity))}>
                {label(one.severity)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {one.customerId ? (
                    <Link to={`/client-workspace/${one.customerId}`} className="hover:text-primary-700 hover:underline">{one.subject}</Link>
                  ) : one.subject}
                </p>
                <p className="text-xs text-ink-muted">{one.detail}</p>
              </div>
              {one.at && <span className="shrink-0 text-2xs whitespace-nowrap text-ink-muted">{formatRelative(one.at)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NextThirtyDays({ upcoming }: { upcoming: BookUpcoming[] }) {
  return (
    <Card title="Next 30 Days" lead="Cash events and client milestones"
      action={<CalendarDays className="size-4 text-ink-muted" aria-hidden="true" />}>
      {upcoming.length === 0 ? <Empty>Nothing is coming up in the next thirty days.</Empty> : (
        <ul className="-my-2 max-h-96 divide-y divide-line overflow-y-auto">
          {upcoming.map((one, at) => {
            const day = new Date(one.on);
            return (
              <li key={`${one.on}-${one.customerId}-${at}`} className="flex items-center gap-3 py-2.5">
                <span className="grid w-11 shrink-0 place-items-center rounded-lg border border-line py-1 leading-none">
                  <span className="text-base font-bold tabular-nums">{String(day.getDate()).padStart(2, "0")}</span>
                  <span className="text-3xs font-semibold text-ink-muted uppercase">
                    {day.toLocaleString("en-GB", { month: "short" })}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {one.title} ·{" "}
                    <Link to={`/client-workspace/${one.customerId}`} className="hover:text-primary-700 hover:underline">{one.clientName}</Link>
                  </p>
                  {one.detail && <p className="truncate text-xs text-ink-muted">{one.detail}</p>}
                </div>
                <span className={cn("shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums",
                  one.amount == null ? "text-ink-muted" : one.amount < 0 ? "text-red-700" : "text-emerald-700")}>
                  {one.amount == null || one.currency == null ? "—" : signedCompact(one.amount, one.currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CustodianFeeds({ data }: { data: BookOverview }) {
  return (
    <Card title="Custodian Data Feeds" lead="Accounts, holdings as each bank's files state them, and the latest file">
      {data.custodians.length === 0 ? <Empty>None of your clients has a bank account linked.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Custodian</th>
                <th scope="col" className="px-3 py-2 text-right">Accts</th>
                <th scope="col" className="px-3 py-2 text-right">AUM</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Last file</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.custodians.map((one) => (
                <tr key={one.bankId} className="align-top">
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium">
                    {one.bank}
                    {one.lastOutcome === "FAILED" && <span className="block text-3xs font-semibold text-red-700">Latest run failed</span>}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{one.accounts}</td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap tabular-nums">
                    {one.holdings.length === 0 ? <Marker>no holdings in file</Marker> : one.holdings.map((amount) => (
                      <span key={amount.currency} className="block">{compact(amount.amount, amount.currency)}</span>
                    ))}
                  </td>
                  <td className="py-2 pr-5 pl-3 text-right text-xs whitespace-nowrap text-ink-muted">
                    {one.lastFileAt ? formatDate(one.lastFileAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Return against risk, and dispersion                                                                           */

function RiskReturnCard({ data }: { data: BookOverview }) {
  const mandates = useMemo(
    () => [...new Set(data.riskReturn.map((one) => one.mandate ?? "No model"))],
    [data.riskReturn],
  );
  const option = useMemo(() => {
    const colours = ink();
    const largest = Math.max(1, ...data.riskReturn.map((one) => one.aum));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 28, bottom: 24, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      tooltip: {
        trigger: "item",
        formatter: (point: { seriesName: string; data: [number, number, number, string] }) =>
          point.seriesName === "Policy frontier"
            ? `${point.data[3]} benchmark<br/>Volatility ${point.data[0]}% · YTD ${point.data[1]}%`
            : `${point.data[3]}<br/>Volatility ${point.data[0]}% · YTD ${point.data[1]}%<br/>${compact(point.data[2], data.currency)}`,
      },
      xAxis: {
        type: "value",
        name: "Annualised volatility (3Y), %",
        nameLocation: "middle",
        nameGap: 24,
        nameTextStyle: { color: colours.muted, fontSize: 10 },
        scale: true,
        axisLabel: { color: colours.muted, formatter: "{value}%" },
        splitLine: { lineStyle: { color: colours.line } },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: colours.muted, formatter: "{value}%" },
        splitLine: { lineStyle: { color: colours.line } },
      },
      series: [
        ...mandates.map((mandate, at) => ({
          type: "scatter",
          name: mandate,
          itemStyle: { color: INK[at % INK.length], opacity: 0.85, borderColor: colours.surface, borderWidth: 1 },
          symbolSize: (value: [number, number, number]) => 8 + Math.sqrt(value[2] / largest) * 22,
          data: data.riskReturn
            .filter((one) => (one.mandate ?? "No model") === mandate)
            .map((one) => [one.volatility, one.yearToDate, one.aum, one.name]),
        })),
        ...(data.frontier.length > 1 ? [{
          type: "line",
          name: "Policy frontier",
          data: data.frontier.map((one) => [one.volatility, one.yearToDate, 0, one.mandate]),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: colours.danger, type: "dashed", width: 1.5 },
          itemStyle: { color: colours.danger },
        }] : []),
      ],
    };
  }, [data.riskReturn, data.frontier, data.currency, mandates]);
  return (
    <Card title="Return vs Risk" lead="YTD return against 3-year annualised volatility · bubble size = AUM">
      {data.riskReturn.length === 0 ? (
        <Empty>No client has both a year-to-date return and a volatility on file yet.</Empty>
      ) : (
        <Chart option={option} height={300} label="Each client's year-to-date return against its volatility" />
      )}
      {data.bankFileClients.length > 0 && (
        <p className="mt-2 text-3xs text-ink-muted italic">{bankFileNote(data.bankFileClients)}: no return or volatility in the bank file.</p>
      )}
    </Card>
  );
}

function DispersionCard({ data }: { data: BookOverview }) {
  const rows = data.dispersion;
  const values = rows.flatMap((one) => [one.lowest, one.highest, ...(one.benchmark == null ? [] : [one.benchmark])]);
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const at = (value: number) => `${((value - low) / (high - low || 1)) * 100}%`;
  return (
    <Card title="YTD Dispersion by Mandate" lead="Lowest to highest client return within each mandate">
      {rows.length === 0 ? <Empty>No client on a mandate has a year-to-date return yet.</Empty> : (
        <>
          <ul className="space-y-3">
            {rows.map((one) => (
              <li key={one.mandate} className="grid grid-cols-[8rem_1fr_6.5rem] items-center gap-3 text-sm">
                <span className="truncate" title={`${one.mandate} · ${one.clients} ${plural(one.clients, "client", "clients")}`}>{one.mandate}</span>
                <span className="relative h-4" aria-hidden="true">
                  <span className="absolute top-1/2 h-px w-full bg-line" />
                  <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary-100"
                    style={{ left: at(one.lowest), width: `calc(${at(one.highest)} - ${at(one.lowest)})` }} />
                  <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                    style={{ left: at(one.median) }} />
                  {one.benchmark != null && (
                    <span className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-red-600" style={{ left: at(one.benchmark) }} />
                  )}
                </span>
                <span className="text-right text-xs text-ink-soft tabular-nums">
                  {one.lowest.toFixed(1)} – {one.highest.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-primary-100" aria-hidden="true" />Range of client returns</li>
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" aria-hidden="true" />Median</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-red-600" aria-hidden="true" />Mandate benchmark</li>
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

/** Where a bank-file client's files hold nothing: left blank, and said so, rather than shown as a nought. */
function NotInFile() {
  return <Marker>not in bank file</Marker>;
}

function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      {children}
    </span>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function Percent({ value }: { value: number | null }) {
  if (value == null) return <Muted>—</Muted>;
  return <span className={toneOf(value)}>{signedPercent(value)}</span>;
}

function exportCsv(rows: BookOverviewClient[], currency: string) {
  const header = ["Client", "Code", "Type", "City", "Mandate", `AUM (${currency})`, "Bank file holdings (as stated, unconverted)",
    "Share %", "MTD %", "YTD %", "vs Bench (pp)", "Max deviation (pp)", "Deviating", "IPS status", "Next event", "Next event date"];
  const cell = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((row) => [
    row.name, row.code, typeLabel(row.customerType), row.city, row.bankFile ? "not in bank file" : row.mandate,
    row.bankFile ? "" : row.aum,
    row.bankFile ? row.bankFile.holdings.map((one) => `${one.currency} ${one.amount}`).join("; ") : "",
    row.sharePercent, row.monthToDate, row.yearToDate, row.versusBenchmark, row.maxDeviation,
    row.bankFile ? "" : row.deviating ? "yes" : "no", row.ipsStatus, row.nextEvent?.title, row.nextEvent?.on,
  ].map(cell).join(","));
  downloadTextFile(`book-overview-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...lines].join("\n"), "text/csv");
}

function bankFileNote(names: string[]) {
  return names.length === 0 ? null : names.join(", ");
}

function eventLine(event: BookUpcoming) {
  return [event.title, event.detail, formatDate(event.on)].filter(Boolean).join(" · ");
}

function typeLabel(type: string) {
  return type === "ENTITY" ? "Entity" : type === "INDIVIDUAL" ? "Individual" : type;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function signedCompact(amount: number, currency: string) {
  return `${amount > 0 ? "+" : ""}${compact(amount, currency)}`;
}

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function signedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function toneOf(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}

function monthLabel(day: string) {
  const date = new Date(day);
  return date.getMonth() === 0
    ? `Jan ${String(date.getFullYear()).slice(2)}`
    : date.toLocaleString("en-GB", { month: "short" });
}
