import { ApiError } from "@atomprive/api-client";
import {
  useGetClientDirectory,
  useListCurrencies,
  type BookAumPoint,
  type BookCurrencyAmount,
  type ClientDirectory,
  type Currency,
  type DirectoryClient,
  type DirectoryNamed,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, Pagination, SelectInput, TextInput, cn } from "@atomprive/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { CalendarClock, Clock, Download, Search, ShieldCheck, Target, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { downloadTextFile } from "../../lib/download";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { CustomizeButton, LayoutGrid, useViewLayout, type LayoutMeta, type ViewLayoutState } from "../layout/custom-view";
import { useCardLabel } from "../layout/card-settings";
import { cardChart, KindChart, type CardChart } from "../layout/chart-kinds";
import { sharesFigure, type Figures } from "../layout/own-cards";
import { INK } from "./asset-classes";

/**
 * The portfolio manager's Client Directory, laid out the way the firm's own design draws it: how many clients and
 * how big, who is beating their benchmark, whose review is due, whose policy needs looking at, every client as a
 * card or a row, and the book broken down by segment, region, mandate and relationship manager.
 *
 * <p>Read only. A client's status — outside their band, near its edge, waiting on late bank data, or within
 * policy — is the server's reading and is never worked out here from a band. A client whose figures come only from
 * their bank's files shows what their own record says and, for everything a portfolio would say, that the file
 * does not hold it.
 */
export function ClientDirectoryPage() {
  const [currency, setCurrency] = useState("USD");
  const directory = useGetClientDirectory<ClientDirectory, ApiError>(
    { currency },
    { query: { placeholderData: keepPreviousData, refetchInterval: 120_000 } },
  );
  const currencies = useListCurrencies<Currency[], ApiError>();
  const data = directory.data;
  const view = useViewLayout("client-directory", CARDS, DEFAULT_CARDS);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Portfolio Management / Clients</p>
          <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Clients</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Directory of all client families · open a family to see its overview, entity structure, holdings and analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomizeButton view={view} />
          <SelectInput id="directory-currency" aria-label="Currency the directory is shown in" value={currency}
            onChange={(event) => setCurrency(event.target.value)} className="w-28">
            {(currencies.data ?? [{ code: "USD", name: "US dollar" }]).map((one) => (
              <option key={one.code} value={one.code}>{one.code}</option>
            ))}
          </SelectInput>
        </div>
      </header>

      {directory.isError && <Alert tone="danger">{directory.error.message}</Alert>}
      {!data ? (
        !directory.isError && <p className="py-16 text-center text-sm text-ink-muted">Reading the directory…</p>
      ) : (
        <Board data={data} view={view} />
      )}
    </div>
  );
}

type DirectoryCardId = "kpis" | "attention" | "directory" | "segments" | "managers" | "regions" | "mandates";

/** The screen's cards, in the firm's order: every card on by default. */
const CARDS: Record<DirectoryCardId, LayoutMeta> = {
  kpis: { title: "Key figures", group: "Summary", wide: true },
  attention: { title: "Needs attention", group: "Summary", wide: true },
  directory: { title: "Client Directory", group: "Clients", wide: true },
  segments: { title: "By Segment", group: "Breakdowns", charts: ["donut", "horizontal-bar", "treemap", "table"] },
  managers: { title: "By Relationship Manager", group: "Breakdowns", charts: ["table", "horizontal-bar", "donut", "treemap"] },
  regions: { title: "By Region of Residence", group: "Breakdowns", charts: ["horizontal-bar", "donut", "treemap", "table"] },
  mandates: { title: "By Mandate", group: "Breakdowns", charts: ["table", "donut", "horizontal-bar", "treemap"] },
};

// The four that matter most open the screen; every other card waits in Add cards. A layout someone saved is kept.
const DEFAULT_CARDS: DirectoryCardId[] = ["kpis", "attention", "directory", "segments"];

function Board({ data, view }: { data: ClientDirectory; view: ViewLayoutState<DirectoryCardId> }) {
  const cur = data.currency;
  const { attention } = data;
  return (
    <>
      <LayoutGrid view={view} screen="Client Directory" figures={directoryFigures(data)} render={{
        kpis: <Kpis data={data} />,
        attention: (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AttentionTile icon={Target} tone="danger" label="Deviation from IPS" named={attention.deviations} />
            <AttentionTile icon={CalendarClock} tone="warning" label="Reviews overdue" named={attention.reviewsOverdue}
              extra={(one) => (one.on ? ` (${shortDate(one.on)})` : "")} />
            <AttentionTile icon={Clock} tone="warning" label="Custodian data delayed" named={attention.dataDelayed} />
            <AttentionTile icon={ShieldCheck} tone="neutral" label="KYC / CRS refresh due" named={attention.kycDue}
              count={attention.kycDue.reduce((sum, one) => sum + one.count, 0)} noun={["entity", "entities"]}
              extra={(one) => ` (${one.count})`} />
          </div>
        ),
        directory: <DirectoryCard data={data} />,
        segments: <SegmentCard data={data} chart={cardChart(view, "segments")} />,
        managers: <ManagerCard data={data} chart={cardChart(view, "managers")} />,
        regions: <RegionCard data={data} chart={cardChart(view, "regions")} />,
        mandates: <MandateCard data={data} chart={cardChart(view, "mandates")} />,
      }} />

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>Values in {cur} unless stated; market data as of {formatDate(data.asOf)} close.</span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </>
  );
}

/** The six figures across the top. */
function Kpis({ data }: { data: ClientDirectory }) {
  const cur = data.currency;
  const { kpis } = data;
  const fileNote = data.bankFileClients.join(", ");
  const segments = kpis.segments
    .filter((one) => one.segment != null)
    .map((one) => `${one.clients} ${segmentLabel(one.segment)}`)
    .join(" · ");
  return (
    <>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        <Kpi label="Client families" value={String(kpis.clients)} note={segments || "No segment recorded yet"} />
        <Kpi label="Assets under management" value={compact(kpis.totalAum, cur)}
          note={
            <>
              {kpis.averageAum == null ? "No AUM on file" : `Average ${compact(kpis.averageAum, cur)} · median ${compact(kpis.medianAum ?? 0, cur)}`}
              {fileNote && <FootNote>{fileNote}: bank-file holdings unconverted, not in these figures.</FootNote>}
            </>
          } />
        <Kpi label="Outperforming benchmark" value={`${kpis.outperforming} of ${kpis.measured}`}
          note={
            <>
              YTD, net of fees
              {kpis.measured < kpis.clients && <FootNote>{kpis.clients - kpis.measured} without a return or benchmark to set against.</FootNote>}
            </>
          } />
        <Kpi label="Reviews due · 30 days" value={String(kpis.reviewsOverdue + kpis.reviewsScheduled)}
          note={
            <>
              <span className={kpis.reviewsOverdue > 0 ? "font-semibold text-red-700" : undefined}>{kpis.reviewsOverdue} overdue</span>
              {" · "}{kpis.reviewsScheduled} scheduled
            </>
          } />
        <Kpi label="IPS status"
          value={
            <>
              <span className="text-red-700">{kpis.deviations}</span>
              <span className="text-ink-muted"> · </span>
              <span className="text-amber-700">{kpis.nearEdge}</span>
            </>
          }
          note="Deviation · near edge" />
        <Kpi label="Onboarding pipeline" value={String(kpis.prospects)}
          note={
            <>
              {kpis.prospectsValued > 0 ? `${compact(kpis.prospectValue, cur)} prospective` : "No expected value recorded"}
              {" · from Client Onboarding"}
              <FootNote>
                Every open prospect at the firm
                {kpis.prospectsValued < kpis.prospects ? `; ${kpis.prospects - kpis.prospectsValued} without an expected value.` : "."}
              </FootNote>
            </>
          } />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Directory                                                                                                     */

type Sort = "aum" | "ytd" | "review" | "name";

const PAGE = 12;

const STATUSES = [
  { id: "DEVIATION", label: "Deviation" },
  { id: "NEAR_EDGE", label: "Near edge" },
  { id: "DATA_DELAYED", label: "Data delayed" },
  { id: "WITHIN_POLICY", label: "Within policy" },
] as const;

function DirectoryCard({ data }: { data: ClientDirectory }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [mandate, setMandate] = useState("");
  const [region, setRegion] = useState("");
  const [manager, setManager] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("aum");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [page, setPage] = useState(0);
  const navigate = useNavigate();

  const options = useMemo(() => ({
    segments: unique(data.clients.map((one) => one.segment)),
    mandates: unique(data.clients.map((one) => one.mandate)),
    regions: unique(data.clients.map((one) => one.region)),
    managers: unique(data.clients.map((one) => one.relationshipManager)),
  }), [data.clients]);

  const shown = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    const kept = data.clients.filter((one) =>
      (!wanted || [one.name, one.code, one.city, one.mandate, ...one.entityNames].some((text) => text?.toLowerCase().includes(wanted)))
      && (!segment || one.segment === segment)
      && (!mandate || one.mandate === mandate)
      && (!region || one.region === region)
      && (!manager || one.relationshipManager === manager)
      && (!status || one.status === status));
    const last = (value: number | null | undefined, fallback: number) => (value == null ? fallback : value);
    return [...kept].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "ytd") return last(b.yearToDate, -Infinity) - last(a.yearToDate, -Infinity);
      if (sort === "review") {
        return (a.nextReviewOn ?? "9999").localeCompare(b.nextReviewOn ?? "9999");
      }
      return last(b.aum, -Infinity) - last(a.aum, -Infinity);
    });
  }, [data.clients, query, segment, mandate, region, manager, status, sort]);

  const pageRows = shown.slice(page * PAGE, (page + 1) * PAGE);
  const reset = () => setPage(0);
  const open = (one: DirectoryClient) => navigate(`/client-workspace/${one.customerId}`);

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Client Directory</h2>
          <p className="mt-0.5 text-xs text-ink-muted">All client families under coverage · select a family to open its workspace</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => exportCsv(shown, data.currency)}>
          <Download aria-hidden="true" />
          Export list
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-80">
          <span className="sr-only">Search families, codes and entities</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <TextInput value={query} onChange={(event) => { setQuery(event.target.value); reset(); }}
            placeholder="Search families, codes, entities…" className="h-9 pl-9" />
        </label>
        <Filter label="Segment" value={segment} onChange={(next) => { setSegment(next); reset(); }}
          options={options.segments.map((one) => [one, segmentLabel(one) ?? one])} />
        <Filter label="Mandate" value={mandate} onChange={(next) => { setMandate(next); reset(); }}
          options={options.mandates.map((one) => [one, one])} />
        <Filter label="Region" value={region} onChange={(next) => { setRegion(next); reset(); }}
          options={options.regions.map((one) => [one, one])} />
        <Filter label="RM" value={manager} onChange={(next) => { setManager(next); reset(); }}
          options={options.managers.map((one) => [one, one])} />
        <Filter label="IPS status" value={status} onChange={(next) => { setStatus(next); reset(); }}
          options={STATUSES.map((one) => [one.id, one.label])} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-muted">Sort</span>
        <Toggle label="Sort by" value={sort} onChange={(next) => { setSort(next); reset(); }}
          options={[["aum", "AUM"], ["ytd", "YTD"], ["review", "Review date"], ["name", "A–Z"]]} />
        <Toggle label="Shown as" value={view} onChange={setView} options={[["cards", "Cards"], ["table", "Table"]]} />
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">
          {data.clients.length === 0 ? "No client families under coverage yet." : "No client family matches these filters."}
        </p>
      ) : view === "cards" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pageRows.map((one) => <ClientTile key={one.customerId} one={one} currency={data.currency} onOpen={() => open(one)} />)}
        </div>
      ) : (
        <ClientTable rows={pageRows} currency={data.currency} onOpen={open} />
      )}

      {shown.length > 0 && (
        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE} totalItems={shown.length} onPageChange={setPage} noun={["family", "families"]} />
        </div>
      )}
    </section>
  );
}

function ClientTile({ one, currency, onOpen }: { one: DirectoryClient; currency: string; onOpen: () => void }) {
  const file = one.bankFile;
  return (
    <article onClick={onOpen}
      className="flex cursor-pointer flex-col rounded-xl border border-line p-4 transition-colors hover:border-primary-300 hover:bg-slate-50">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-50 text-sm font-bold text-primary-700" aria-hidden="true">
          {one.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/client-workspace/${one.customerId}`} onClick={(event) => event.stopPropagation()}
            className="block truncate text-base font-bold hover:text-primary-700 hover:underline">
            {one.name}
          </Link>
          <p className="text-xs text-ink-muted">
            {one.code} · {file ? <NotInFile /> : segmentLabel(one.segment) ?? <Muted>no segment</Muted>}
            {place(one) && ` · ${place(one)}`}
          </p>
        </div>
        <StatusPill one={one} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">AUM</p>
          {file ? <InTheirCurrencies amounts={file.holdings} /> : (
            <p className="text-xl font-bold tabular-nums">{one.aum == null ? <Muted>—</Muted> : compact(one.aum, currency)}</p>
          )}
        </div>
        {!file && one.trend.length > 1 && <Sparkline points={one.trend} />}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">YTD</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{file ? <NotInFile /> : <Percent value={one.yearToDate} />}</dd>
        </div>
        <div>
          <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">vs Bench</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{file ? <NotInFile /> : <Points value={one.versusBenchmark} />}</dd>
        </div>
        <div>
          <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">Entities</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{one.entities}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span>
          {file ? <NotInFile /> : one.mandate ?? <Muted>No model</Muted>}
          {one.portfolioManagers.length > 0 && ` · ${one.portfolioManagers.join(", ")}`}
        </span>
        <span className="whitespace-nowrap">
          {file ? <NotInFile /> : one.nextReviewOn ? `Review ${formatDate(one.nextReviewOn)}` : <Muted>No review set</Muted>}
        </span>
      </div>
      {file && (
        <p className="mt-2 text-3xs font-semibold text-primary-700">
          Bank file · {file.banks.join(", ") || "no holdings yet"}{file.asOf && ` · as of ${formatDate(file.asOf)}`}
        </p>
      )}
    </article>
  );
}

function ClientTable({ rows, currency, onOpen }: { rows: DirectoryClient[]; currency: string; onOpen: (one: DirectoryClient) => void }) {
  return (
    <div className="-mx-5 mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
            <th scope="col" className="py-2.5 pr-3 pl-5">Client</th>
            <th scope="col" className="px-3 py-2.5">Segment</th>
            <th scope="col" className="px-3 py-2.5">Status</th>
            <th scope="col" className="px-3 py-2.5 text-right">AUM</th>
            <th scope="col" className="px-3 py-2.5 text-right">YTD</th>
            <th scope="col" className="px-3 py-2.5 text-right">vs Bench</th>
            <th scope="col" className="px-3 py-2.5 text-right">Entities</th>
            <th scope="col" className="px-3 py-2.5">Mandate · PM</th>
            <th scope="col" className="px-3 py-2.5">RM</th>
            <th scope="col" className="py-2.5 pr-5 pl-3">Next review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((one) => {
            const file = one.bankFile;
            return (
              <tr key={one.customerId} onClick={() => onOpen(one)} className="cursor-pointer align-top hover:bg-slate-50">
                <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal">
                  <Link to={`/client-workspace/${one.customerId}`} onClick={(event) => event.stopPropagation()}
                    className="font-semibold whitespace-nowrap hover:text-primary-700 hover:underline">{one.name}</Link>
                  <span className="block text-xs whitespace-nowrap text-ink-muted">{[one.code, place(one)].filter(Boolean).join(" · ")}</span>
                </th>
                <td className="px-3 py-2.5 whitespace-nowrap">{file ? <NotInFile /> : segmentLabel(one.segment) ?? <Muted>—</Muted>}</td>
                <td className="px-3 py-2.5"><StatusPill one={one} /></td>
                <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                  {file ? <InTheirCurrencies amounts={file.holdings} /> : one.aum == null ? <Muted>—</Muted> : compact(one.aum, currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{file ? <NotInFile /> : <Percent value={one.yearToDate} />}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{file ? <NotInFile /> : <Points value={one.versusBenchmark} />}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{one.entities}</td>
                <td className="px-3 py-2.5 text-xs">
                  {file ? <NotInFile /> : one.mandate ?? <Muted>No model</Muted>}
                  {one.portfolioManagers.length > 0 && <span className="block text-ink-muted">{one.portfolioManagers.join(", ")}</span>}
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{one.relationshipManager ?? <Muted>—</Muted>}</td>
                <td className="py-2.5 pr-5 pl-3 text-xs whitespace-nowrap">
                  {file ? <NotInFile /> : one.nextReviewOn ? formatDate(one.nextReviewOn) : <Muted>—</Muted>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The server's reading of where a client stands; a bank-file client's file says nothing about a model. */
function StatusPill({ one }: { one: DirectoryClient }) {
  if (one.status == null) return one.bankFile ? <NotInFile /> : <Muted>Not measured</Muted>;
  const [label, tone] = one.status === "DEVIATION" ? ["Deviation", "bg-red-50 text-red-700"]
    : one.status === "NEAR_EDGE" ? ["Near edge", "bg-amber-50 text-amber-700"]
    : one.status === "DATA_DELAYED" ? ["Data delayed", "bg-amber-50 text-amber-700"]
    : ["Within policy", "bg-emerald-50 text-emerald-700"];
  return <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{label}</span>;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Breakdowns                                                                                                    */

function SegmentCard({ data, chart }: { data: ClientDirectory; chart: CardChart }) {
  const slices = data.bySegment;
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, data.currency) },
      series: [{
        type: "pie",
        radius: ["62%", "86%"],
        label: { show: false },
        itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: slices.map((one, at) => ({ name: one.name, value: one.aum, itemStyle: { color: INK[at % INK.length] } })),
      }],
    };
  }, [slices, data.currency]);
  const total = slices.reduce((sum, one) => sum + one.aum, 0);
  return (
    <Card title="By Segment" picker={slices.length > 0 && chart.picker}>
      {slices.length === 0 ? <Empty>No client families yet.</Empty> : !chart.own ? (
        <AumChart rows={slices} currency={data.currency} chart={chart} label="AUM by segment" />
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-48">
            <Chart option={option} height={180} label="AUM by segment" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{compact(total, data.currency)}</p>
                <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">AUM</p>
              </div>
            </div>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {slices.map((one, at) => (
                <tr key={one.key}>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                      {one.name}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{compact(one.aum, data.currency)}</td>
                  <td className="w-16 py-2 text-right text-xs text-ink-muted tabular-nums">{one.clients} fam.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function RegionCard({ data, chart }: { data: ClientDirectory; chart: CardChart }) {
  const largest = Math.max(1, ...data.byRegion.map((one) => one.aum));
  return (
    <Card title="By Region of Residence" picker={data.byRegion.length > 0 && chart.picker}>
      {data.byRegion.length === 0 ? <Empty>No client families yet.</Empty> : !chart.own ? (
        <AumChart rows={data.byRegion} currency={data.currency} chart={chart} label="AUM by region of residence" />
      ) : (
        <ul className="space-y-2.5">
          {data.byRegion.map((one) => (
            <li key={one.key} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm">
              <span className="truncate">{one.name}</span>
              <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.aum / largest) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums" title={`${one.clients} ${one.clients === 1 ? "family" : "families"}`}>
                {compact(one.aum, data.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MandateCard({ data, chart }: { data: ClientDirectory; chart: CardChart }) {
  return (
    <Card title="By Mandate" picker={data.byMandate.length > 0 && chart.picker}>
      {data.byMandate.length === 0 ? <Empty>No client families yet.</Empty> : !chart.own ? (
        <AumChart rows={data.byMandate} currency={data.currency} chart={chart} label="AUM by mandate" />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Mandate</th>
                <th scope="col" className="px-3 py-2 text-right">Families</th>
                <th scope="col" className="px-3 py-2 text-right">AUM</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Avg. excess YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.byMandate.map((one) => (
                <tr key={one.name}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium">{one.name}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{one.clients}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{compact(one.aum, data.currency)}</td>
                  <td className="py-2 pr-5 pl-3 text-right tabular-nums"><Points value={one.averageVersusBenchmark} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.bankFileClients.length > 0 && (
        <p className="mt-3 text-3xs text-ink-muted italic">{data.bankFileClients.join(", ")}: no mandate in the bank file.</p>
      )}
    </Card>
  );
}

function ManagerCard({ data, chart }: { data: ClientDirectory; chart: CardChart }) {
  return (
    <Card title="By Relationship Manager" picker={data.byRelationshipManager.length > 0 && chart.picker}>
      {data.byRelationshipManager.length === 0 ? <Empty>No client families yet.</Empty> : !chart.own ? (
        <AumChart rows={data.byRelationshipManager} currency={data.currency} chart={chart} label="AUM by relationship manager" />
      ) : (
        <ul className="divide-y divide-line">
          {data.byRelationshipManager.map((one) => (
            <li key={one.key} className="flex items-center gap-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-50 text-xs font-bold text-primary-700" aria-hidden="true">
                {initials(one.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{one.name}</p>
                <p className="text-xs text-ink-muted">{one.clients} {one.clients === 1 ? "family" : "families"}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{compact(one.aum, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      {data.bankFileClients.length > 0 && (
        <p className="mt-3 text-3xs text-ink-muted italic">
          {data.bankFileClients.join(", ")} is counted under their relationship manager; their bank-file holdings are not in the AUM.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

/** A breakdown of the book's AUM drawn as the kind picked for its card. */
function AumChart({ rows, currency, chart, label }: { rows: { name: string; aum: number }[]; currency: string; chart: CardChart; label: string }) {
  return (
    <KindChart kind={chart.kind!} format={(value) => compact(value, currency)} height={240} label={label}
      data={{ shape: "shares", items: rows.map((one) => ({ name: one.name, value: one.aum })) }} />
  );
}

/** What the Client Directory offers for a card of the reader's own: the book's AUM broken down four ways. */
function directoryFigures(data: ClientDirectory): Figures {
  const amount = (value: number) => compact(value, data.currency);
  const rows = (list: { name: string; aum: number }[]) => list.map((one) => ({ name: one.name, value: one.aum }));
  return {
    "aum.segments": sharesFigure("AUM by segment", "Breakdowns", rows(data.bySegment), amount),
    "aum.managers": sharesFigure("AUM by relationship manager", "Breakdowns", rows(data.byRelationshipManager), amount),
    "aum.regions": sharesFigure("AUM by region of residence", "Breakdowns", rows(data.byRegion), amount),
    "aum.mandates": sharesFigure("AUM by mandate", "Breakdowns", rows(data.byMandate), amount),
    "clients.segments": sharesFigure("Client families by segment", "Clients", data.bySegment.map((one) => ({ name: one.name, value: one.clients })),
      (value) => String(Math.round(value)), ["donut", "horizontal-bar", "bar", "table"]),
  };
}

/** @param picker the chart type switcher, beside the title, for a card that draws a chart */
function Card({ title, lead, picker, children }: { title: string; lead?: string; picker?: ReactNode; children: ReactNode }) {
  // The reader's own name and line for the card, where they set them through Add card.
  const label = useCardLabel(title, lead);
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{label.title}</h2>
          {label.lead && <p className="mt-0.5 text-xs text-ink-muted">{label.lead}</p>}
        </div>
        {picker}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 text-xs text-ink-muted">{note}</div>
    </div>
  );
}

function AttentionTile({ icon: Icon, tone, label, named, count = named.length, noun = ["family", "families"], extra }: {
  icon: LucideIcon;
  tone: "danger" | "warning" | "neutral";
  label: string;
  named: DirectoryNamed[];
  count?: number;
  noun?: [string, string];
  extra?: (one: DirectoryNamed) => string;
}) {
  const colour = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-ink-soft";
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", colour)}>
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-base font-bold">{count} {count === 1 ? noun[0] : noun[1]}</p>
        {named.length > 0 && (
          <p className="text-xs text-ink-soft">
            {named.map((one, at) => (
              <span key={one.customerId}>
                {at > 0 && " · "}
                <Link to={`/client-workspace/${one.customerId}`} className="hover:text-primary-700 hover:underline">{one.name}</Link>
                {extra?.(one)}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <SelectInput aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-auto min-w-36">
      <option value="">{label}: All</option>
      {options.map(([id, name]) => <option key={id} value={id}>{label}: {name}</option>)}
    </SelectInput>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line p-0.5">
      {options.map(([id, name]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn("rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
            value === id ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-soft hover:bg-slate-50")}>
          {name}
        </button>
      ))}
    </div>
  );
}

/** A small line of a figure over time, drawn without axes. */
function Sparkline({ points }: { points: BookAumPoint[] }) {
  const values = points.map((one) => one.amount);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const path = values.map((value, at) => `${(at / (values.length - 1)) * 96},${26 - ((value - low) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 96 28" className="h-7 w-24 shrink-0 text-primary-600" aria-hidden="true">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A bank-file client's holdings, each currency on its own line as the bank wrote it. */
function InTheirCurrencies({ amounts }: { amounts: BookCurrencyAmount[] }) {
  if (amounts.length === 0) return <NotInFile />;
  return (
    <span className="flex flex-col gap-0.5 text-xs font-semibold tabular-nums">
      {amounts.map((one) => (
        <span key={one.currency} title={`${one.currency} ${one.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} as the bank states it`}>
          {compact(one.amount, one.currency)}
        </span>
      ))}
      <Marker>as in bank file</Marker>
    </span>
  );
}

/** Where a bank-file client's files hold nothing: left blank, and said so, rather than shown as a nought. */
function NotInFile() {
  return <Marker>not in bank file</Marker>;
}

function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-3xs font-medium whitespace-nowrap text-ink-muted">
      {children}
    </span>
  );
}

function FootNote({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-3xs leading-snug text-ink-muted italic">{children}</span>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function Percent({ value }: { value: number | null }) {
  if (value == null) return <Muted>—</Muted>;
  return <span className={toneOf(value)}>{value > 0 ? "+" : ""}{value.toFixed(1)}%</span>;
}

function Points({ value }: { value: number | null }) {
  if (value == null) return <Muted>—</Muted>;
  return <span className={toneOf(value)}>{value > 0 ? "+" : ""}{value.toFixed(1)} pp</span>;
}

function exportCsv(rows: DirectoryClient[], currency: string) {
  const header = ["Client", "Code", "Segment", "City", "Country", "Region", "Status", `AUM (${currency})`,
    "Bank file holdings (as stated, unconverted)", "YTD %", "vs Bench (pp)", "Entities", "Mandate", "Portfolio managers",
    "Relationship manager", "Next review"];
  const cell = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const NOT = "not in bank file";
  const lines = rows.map((one) => {
    const file = one.bankFile;
    return [
      one.name, one.code, file ? NOT : segmentLabel(one.segment), one.city, one.country, one.region,
      one.status ? statusLabel(one.status) : file ? NOT : "", file ? "" : one.aum,
      file ? file.holdings.map((amount) => `${amount.currency} ${amount.amount}`).join("; ") : "",
      file ? NOT : one.yearToDate, file ? NOT : one.versusBenchmark, one.entities, file ? NOT : one.mandate,
      one.portfolioManagers.join("; "), one.relationshipManager, file ? NOT : one.nextReviewOn,
    ].map(cell).join(",");
  });
  downloadTextFile(`client-directory-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...lines].join("\n"), "text/csv");
}

function statusLabel(status: string) {
  return STATUSES.find((one) => one.id === status)?.label ?? status;
}

function segmentLabel(segment: string | null | undefined) {
  if (segment == null) return null;
  return segment === "HNW_PLUS" ? "HNW+" : segment === "FOUNDATION" ? "Foundation" : segment;
}

function place(one: DirectoryClient) {
  return [one.city, one.country].filter(Boolean).join(", ");
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((one): one is string => !!one))].sort((a, b) => a.localeCompare(b));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "—";
}

function shortDate(day: string) {
  return new Date(day).toLocaleString("en-GB", { month: "short", year: "numeric" });
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function toneOf(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}
