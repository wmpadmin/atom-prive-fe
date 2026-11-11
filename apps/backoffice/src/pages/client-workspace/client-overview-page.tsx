import { ApiError } from "@atomprive/api-client";
import {
  getGetClientWorkspaceQueryKey,
  useAddClientNote,
  useGetClientWorkspace,
  type BookAumPoint,
  type ClientWorkspace,
  type WorkspaceBankFile,
  type WorkspaceSlice,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, TextArea, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate, formatDateTime } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";
import { INK } from "../portfolios/asset-classes";

/**
 * A client's Overview, laid out the way the firm's own design draws it: what they are worth, the facts of their
 * mandate, how their worth has moved against the benchmark, how it is invested and held against its bands, how it has
 * performed, how quickly it turns to cash, what they hold most of, money coming and going, and alerts and notes.
 *
 * <p>Read only, apart from notes. Every band, deviation and return is the server's. A client whose figures come only
 * from their bank's files is shown that file as it was sent, and "not in bank file" wherever it holds nothing.
 */
export function ClientOverviewPage() {
  const { customerId = "" } = useParams();
  const workspace = useGetClientWorkspace<ClientWorkspace, ApiError>(customerId);
  const data = workspace.data;

  if (workspace.isError) return <Alert tone="danger">{workspace.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Opening the workspace…</p>;

  const file = data.bankFile;
  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Client overview
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">{data.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {[data.code, data.customerType === "ENTITY" ? "Entity" : "Individual", [data.city, data.country].filter(Boolean).join(", ")]
            .filter(Boolean).join(" · ")} · consolidated net worth view · as at {formatDate(data.asOf)}
        </p>
      </header>

      <Headline data={data} />
      <Facts data={data} />

      {file ? <BankFileCards file={file} /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <WorthCard data={data} />
            <AllocationCard data={data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <BandsCard data={data} />
            <PerformanceCard data={data} />
          </div>
          {/* Paired by height, as the design pairs them: two short cards, two long ones, then two lists. */}
          <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <LiquidityCard data={data} />
            <HoldingEntitiesCard data={data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <TopPositionsCard data={data} />
            <CashFlowCard data={data} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <LookThroughCard data={data} />
            <AlertsAndNotes data={data} />
          </div>
        </>
      )}

      {file && <AlertsAndNotes data={data} />}

      <p className="text-xs text-ink-muted">
        {file
          ? "Figures as the bank's files state them, each in its own currency; nothing converted, mapped or filled in."
          : `Values in ${data.currency}. Liquidity buckets, currency exposure, fund commitments, the benchmark's history and notes are recorded for this screen; everything else is read from the platform's own figures.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Header band and facts                                                                                         */

function Headline({ data }: { data: ClientWorkspace }) {
  const { headline: h, currency: cur, bankFile: file } = data;
  const ytd = data.performance?.periods.find((one) => one.key === "YTD");
  const mtd = data.performance?.periods.find((one) => one.key === "MTD");
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">Total net worth · consolidated</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {file ? (
          <div className="flex flex-wrap items-baseline gap-x-4">
            {file.holdings.map((one) => (
              <span key={one.currency} className="text-2xl font-bold tabular-nums">{compact(one.amount, one.currency)}</span>
            ))}
            <Marker>as in bank file · not converted</Marker>
          </div>
        ) : (
          <>
            <span className="text-4xl font-bold tabular-nums">{h.netWorth == null ? "—" : compact(h.netWorth, cur)}</span>
            {h.investableChangeYearToDate != null && (
              <span className={cn("text-sm font-semibold", toneOf(h.investableChangeYearToDate))}>
                {signedCompact(h.investableChangeYearToDate, cur)} invested YTD
                {ytd?.portfolio != null && ` · ${signedPercent(ytd.portfolio)} TWR`}
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {file ? (
          <>{h.accounts} accounts · {h.custodians} custodian{h.custodians === 1 ? "" : "s"} · as of {file.asOf ? formatDate(file.asOf) : "—"}</>
        ) : (
          <>
            Investable {money(h.investable, cur)} · Owned outright {money(h.ownedOutright, cur)} · Liabilities {money(h.liabilities, cur)}
            {" · "}{h.accounts} accounts · {h.custodians} custodian{h.custodians === 1 ? "" : "s"}
          </>
        )}
      </p>
      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="MTD" file={!!file}
          value={mtd?.portfolio == null ? null : signedPercent(mtd.portfolio)}
          note={mtd?.benchmark == null ? null : `Bench ${signedPercent(mtd.benchmark)}`} />
        <Stat label="YTD (TWR)" file={!!file}
          value={ytd?.portfolio == null ? null : signedPercent(ytd.portfolio)}
          note={ytd?.benchmark == null ? null : `Bench ${signedPercent(ytd.benchmark)}${ytd.excess == null ? "" : ` · ${signedPoints(ytd.excess)}`}`} />
        <Stat label="Liquid ≤ 30 days" file={!!file}
          value={h.liquidWithin30Days == null ? null : compact(h.liquidWithin30Days, cur)}
          note={h.liquidShareOfNetWorth == null ? null : `${h.liquidShareOfNetWorth.toFixed(1)}% of net worth`} />
        <Stat label="Unfunded commitments" file={!!file}
          value={h.unfunded == null ? (file ? null : compact(0, cur)) : compact(h.unfunded, cur)}
          note={h.unfunded == null ? "Nothing committed and uncalled" : `${h.vehicles} vehicle${h.vehicles === 1 ? "" : "s"}${h.liquidCover == null ? "" : ` · ${h.liquidCover}× liquid cover`}`} />
        <Stat label="Income · next 12M" file={!!file}
          value={h.incomeNext12Months == null ? null : compact(h.incomeNext12Months, cur)}
          note="Coupons, dividends, distributions" />
      </div>
    </section>
  );
}

function Stat({ label, value, note, file }: { label: string; value: string | null; note: ReactNode; file: boolean }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value ?? (file ? <NotInFile /> : <Muted>—</Muted>)}</p>
      {!file && note && <p className="text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

function Facts({ data }: { data: ClientWorkspace }) {
  const f = data.facts;
  const file = !!data.bankFile;
  const fromFile = (value: ReactNode | null | undefined) => value ?? (file ? <NotInFile /> : <Muted>—</Muted>);
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Fact label="Relationship lead" value={f.relationshipManager ?? <Muted>Not recorded</Muted>} />
      <Fact label="Mandate" value={fromFile(f.mandate)} />
      <Fact label="Benchmark" value={fromFile(f.benchmark && (
        <>{f.benchmark}{f.benchmarkComposition && <span className="block text-xs text-ink-muted">{f.benchmarkComposition}</span>}</>
      ))} />
      <Fact label="Base currency" value={f.baseCurrency ?? <Muted>Not recorded</Muted>} />
      <Fact label="Client since" value={f.clientSince ? formatDate(f.clientSince) : <Muted>—</Muted>} />
      <Fact label="Last review" value={fromFile(f.lastReview && formatDate(f.lastReview))} />
      <Fact label="Next review" value={fromFile(f.nextReview && formatDate(f.nextReview))} />
      <Fact label="Risk profile" value={fromFile(f.riskProfile && titleCase(f.riskProfile))} />
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Worth and allocation                                                                                          */

const RANGES = [
  { id: "1Y", months: 12 },
  { id: "3Y", months: 36 },
  { id: "5Y", months: 60 },
  { id: "ITD", months: null },
] as const;

function WorthCard({ data }: { data: ClientWorkspace }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("ITD");
  const months = RANGES.find((one) => one.id === range)?.months ?? null;
  const cut = (points: BookAumPoint[]) => (months == null ? points : points.slice(-(months + 1)));
  const worth = cut(data.worth);
  const bench = cut(data.benchmarkEquivalent);
  const option = useMemo(() => {
    const colours = ink();
    const days = worth.map((one) => one.on);
    const benchOn = new Map(bench.map((one) => [one.on, one.amount]));
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: {
        type: "category",
        data: days,
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
      series: [
        {
          type: "line", name: "Investable assets", data: worth.map((one) => one.amount), showSymbol: false,
          lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text }, areaStyle: { color: colours.canvas },
        },
        ...(bench.length > 1 ? [{
          type: "line", name: "Benchmark-equivalent (after flows)", data: days.map((day) => benchOn.get(day) ?? null),
          showSymbol: false, lineStyle: { color: colours.danger, type: "dashed", width: 1.5 }, itemStyle: { color: colours.danger },
        }] : []),
      ],
    };
  }, [worth, bench, data.currency]);
  return (
    <Card title="Net Worth Evolution" lead={`Month-end values of the managed portfolio, ${data.currency}`}
      action={<Toggle label="Period shown" value={range} onChange={setRange} options={RANGES.map((one) => [one.id, one.id])} />}>
      {worth.length < 2 ? <Empty>There is no valuation history to draw yet.</Empty> : (
        <Chart option={option} height={260} label="The portfolio's worth at each month end, beside its benchmark-equivalent" />
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">
        What is owned outright and owed has no history on file, so the line is the managed portfolio alone.
        {data.benchmarkEquivalent.length < 2 && " No benchmark history is on file for this mandate."}
      </p>
    </Card>
  );
}

function AllocationCard({ data }: { data: ClientWorkspace }) {
  const [by, setBy] = useState<"class" | "entity" | "currency">("class");
  const slices = by === "class" ? data.byAssetClass : by === "entity" ? data.byEntity : data.byCurrency;
  const total = slices.reduce((sum, one) => sum + one.amount, 0);
  return (
    <Card title="Asset Allocation"
      action={<Toggle label="Broken down by" value={by} onChange={setBy} options={[["class", "Asset class"], ["entity", "Entity"], ["currency", "Currency"]]} />}>
      <Donut slices={slices} currency={data.currency} centre={compact(total, data.currency)}
        centreLabel={by === "currency" ? "Holdings" : "Gross assets"} />
      {by === "entity" && <p className="mt-2 text-3xs text-ink-muted italic">Each top-level entity at look-through value; what no entity holds is a slice of its own.</p>}
      {by === "currency" && <p className="mt-2 text-3xs text-ink-muted italic">The portfolio's lines by the currency each is exposed to; what is owned outright is not in it.</p>}
    </Card>
  );
}

function Donut({ slices, currency, centre, centreLabel }: { slices: WorkspaceSlice[]; currency: string; centre: string; centreLabel: string }) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      tooltip: { trigger: "item", valueFormatter: (value: number) => compact(value, currency) },
      series: [{
        type: "pie", radius: ["62%", "86%"], label: { show: false },
        itemStyle: { borderColor: colours.surface, borderWidth: 2 },
        data: slices.map((one, at) => ({ name: one.name, value: one.amount, itemStyle: { color: INK[at % INK.length] } })),
      }],
    };
  }, [slices, currency]);
  if (slices.length === 0) return <Empty>Nothing to break down yet.</Empty>;
  return (
    <>
      <div className="relative mx-auto w-full max-w-52">
        <Chart option={option} height={190} label={`Breakdown by ${centreLabel.toLowerCase()}`} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{centre}</p>
            <p className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{centreLabel}</p>
          </div>
        </div>
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody className="divide-y divide-line">
          {slices.map((one, at) => (
            <tr key={one.key || "none"}>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-xs" style={{ background: INK[at % INK.length] }} aria-hidden="true" />
                  {one.name}
                </span>
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{compact(one.amount, currency)}</td>
              <td className="w-14 py-1.5 text-right text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Bands and performance                                                                                         */

function BandsCard({ data }: { data: ClientWorkspace }) {
  const bands = data.bands;
  const scale = Math.max(10, ...bands.map((one) => Math.max(one.upper, one.actual))) * 1.1;
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  return (
    <Card title="Target vs Actual Allocation" lead="% of the managed portfolio, against the band each class is held to">
      {bands.length === 0 ? <Empty>No model to measure against yet.</Empty> : (
        <>
          <div className="-mx-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-3 pl-5">Asset class</th>
                  <th scope="col" className="w-2/5 px-3 py-2">Position vs band</th>
                  <th scope="col" className="px-3 py-2 text-right">Actual</th>
                  <th scope="col" className="px-3 py-2 text-right">Target</th>
                  <th scope="col" className="py-2 pr-5 pl-3 text-right">Deviation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bands.map((one) => (
                  <tr key={one.assetClass}>
                    <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-medium">{one.name}</th>
                    <td className="px-3 py-2.5">
                      <span className="relative block h-3" aria-hidden="true"
                        title={`Band ${one.lower.toFixed(1)}% – ${one.upper.toFixed(1)}%`}>
                        <span className="absolute top-0 h-3 rounded-sm bg-slate-100"
                          style={{ left: at(one.lower), width: `calc(${at(one.upper)} - ${at(one.lower)})` }} />
                        <span className={cn("absolute top-1 left-0 h-1 rounded-full", one.deviating ? "bg-red-600" : "bg-primary-600")}
                          style={{ width: at(one.actual) }} />
                        <span className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: at(one.target) }} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{one.actual.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-ink-muted tabular-nums">{one.target.toFixed(1)}%</td>
                    <td className="py-2.5 pr-5 pl-3 text-right">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
                        one.deviating ? "bg-red-50 text-red-700" : "bg-slate-100 text-ink-soft")}
                        title={one.usedPercent == null ? undefined : `${one.usedPercent}% of the band used`}>
                        {signedPoints(one.deviation)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-primary-600" aria-hidden="true" />Actual</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-slate-100" aria-hidden="true" />Band in force</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" aria-hidden="true" />Target</li>
            <li className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-red-600" aria-hidden="true" />Deviation</li>
          </ul>
        </>
      )}
    </Card>
  );
}

function PerformanceCard({ data }: { data: ClientWorkspace }) {
  const periods = data.performance?.periods ?? [];
  return (
    <Card title="Performance" lead="Time-weighted, from the portfolio's own closes">
      {periods.length === 0 ? <Empty>Not enough history to measure yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">Period</th>
                <th scope="col" className="px-3 py-2 text-right">Portfolio</th>
                <th scope="col" className="px-3 py-2 text-right">Bench</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Excess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.map((one) => (
                <tr key={one.key}>
                  <th scope="row" className="py-2 pr-3 pl-5 text-left font-medium whitespace-nowrap">
                    {one.name}
                    {one.key === "ITD" && data.performance?.since && <span className="text-xs text-ink-muted"> ({formatDate(data.performance.since)})</span>}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {one.portfolio == null ? <Muted>{one.key === "ITD" ? "under a year" : "not enough history"}</Muted> : <Signed value={one.portfolio} unit="%" />}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-soft tabular-nums">{one.benchmark == null ? <Muted>—</Muted> : signedPercent(one.benchmark)}</td>
                  <td className="py-2 pr-5 pl-3 text-right tabular-nums">{one.excess == null ? <Muted>—</Muted> : <Signed value={one.excess} unit=" pp" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-3xs text-ink-muted italic">The ITD benchmark is the mandate benchmark's long-run annual figure, not measured from this client's first day.</p>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Liquidity, positions, cash flows                                                                              */

function LiquidityCard({ data }: { data: ClientWorkspace }) {
  const liquidity = data.liquidity;
  const largest = Math.max(1, ...(liquidity?.buckets ?? []).map((one) => one.amount));
  return (
    <Card title="Liquidity Profile" lead="Time to convert to cash at fair value">
      {!liquidity ? <Empty>No holdings written down yet.</Empty> : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm" aria-hidden="true">
            {liquidity.buckets.map((one, at) => (
              <span key={one.key || "none"} style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {liquidity.buckets.map((one, at) => (
              <li key={one.key || "none"} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm">
                <span>{one.name}</span>
                <span className="block h-2 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(one.amount / largest) * 100}%`, background: INK[at % INK.length] }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{compact(one.amount, data.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
            Liquidity buffer (cash)
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-ink-soft tabular-nums">
              {liquidity.buffer == null ? "—" : `${liquidity.buffer.toFixed(1)}%`}
              {liquidity.floor != null && ` · floor ${liquidity.floor.toFixed(1)}%`}
            </span>
          </p>
        </>
      )}
    </Card>
  );
}

function TopPositionsCard({ data }: { data: ClientWorkspace }) {
  const positions = data.topPositions;
  const largest = Math.max(1, ...positions.map((one) => one.weightPercent));
  const total = positions.reduce((sum, one) => sum + one.value, 0);
  const weight = positions.reduce((sum, one) => sum + one.weightPercent, 0);
  return (
    <Card title="Top 10 Positions" lead="The portfolio's lines and what is owned outright"
      action={<Link to={`/client-workspace/${data.customerId}/holdings`} className="text-xs font-semibold text-primary-700 hover:underline">All holdings</Link>}>
      {positions.length === 0 ? <Empty>No holdings written down yet.</Empty> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">#</th>
                <th scope="col" className="px-3 py-2">Position</th>
                <th scope="col" className="px-3 py-2 text-right">Value</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {positions.map((one, at) => (
                <tr key={`${one.name}-${at}`}>
                  <td className="py-2 pr-2 pl-5 text-xs text-ink-muted tabular-nums">{String(at + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{one.name}</span>
                    <span className="block text-xs text-ink-muted">{one.kind}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">{compact(one.value, data.currency)}</td>
                  <td className="py-2 pr-5 pl-3">
                    <span className="flex items-center justify-end gap-2">
                      <span className="text-xs tabular-nums">{one.weightPercent.toFixed(1)}%</span>
                      <span className="block h-1.5 w-14 rounded-full bg-slate-100" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.weightPercent / largest) * 100}%` }} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td className="px-3 py-2">Top {positions.length} total</td>
                <td className="px-3 py-2 text-right tabular-nums">{compact(total, data.currency)}</td>
                <td className="py-2 pr-5 pl-3 text-right text-xs tabular-nums">{weight.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CashFlowCard({ data }: { data: ClientWorkspace }) {
  const option = useMemo(() => {
    const colours = ink();
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: colours.muted, fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: {
        type: "category", data: data.cashFlowMonths.map((one) => monthLabel(one.month)),
        axisLabel: { color: colours.muted }, axisLine: { lineStyle: { color: colours.line } }, axisTick: { show: false },
      },
      yAxis: {
        type: "value", axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } },
      },
      series: [
        { type: "bar", name: "Inflows", stack: "flows", data: data.cashFlowMonths.map((one) => one.inflows), itemStyle: { color: colours.primary } },
        { type: "bar", name: "Outflows", stack: "flows", data: data.cashFlowMonths.map((one) => one.outflows), itemStyle: { color: colours.danger } },
      ],
    };
  }, [data.cashFlowMonths, data.currency]);
  return (
    <Card title="Projected Cash Flows · 12 Months" lead="Coupons, dividends, distributions, maturities, capital calls, running costs">
      <div className="space-y-3">
        {data.cashFlows.length === 0 ? <Empty>Nothing expected in the next twelve months.</Empty> : (
          <Chart option={option} height={220} label="Money expected in and out each month for the next twelve" />
        )}
        <ul className="max-h-64 divide-y divide-line overflow-y-auto text-sm">
          {data.cashFlows.map((one, at) => (
            <li key={`${one.on}-${at}`} className="flex items-center gap-3 py-2">
              <span className="w-14 shrink-0 text-xs text-ink-muted tabular-nums">{dayMonth(one.on)}</span>
              <span className="min-w-0 flex-1 truncate">{one.title}{one.detail && ` · ${one.detail}`}</span>
              <span className={cn("shrink-0 font-semibold tabular-nums", toneOf(one.amount))}>{signedCompact(one.amount, one.currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function HoldingEntitiesCard({ data }: { data: ClientWorkspace }) {
  const largest = Math.max(1, ...data.holdingEntities.map((one) => one.value));
  return (
    <Card title="Holding Entities" lead="Top-level ownership · subsidiaries rolled up"
      action={<Link to={`/client-workspace/${data.customerId}/structure`} className="text-xs font-semibold text-primary-700 hover:underline">Structure</Link>}>
      {data.holdingEntities.length === 0 ? <Empty>No entity is on file for this client yet.</Empty> : (
        <ul className="divide-y divide-line">
          {data.holdingEntities.map((one) => (
            <li key={one.id} className="grid grid-cols-[1fr_6rem_5rem] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{one.name}</p>
                <p className="truncate text-xs text-ink-muted">{one.jurisdiction}{one.description && ` · ${one.description}`}</p>
              </div>
              <span className="block h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary-600" style={{ width: `${(one.value / largest) * 100}%` }} />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">{compact(one.value, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LookThroughCard({ data }: { data: ClientWorkspace }) {
  const people = data.beneficialLookThrough;
  return (
    <Card title="Beneficial Look-through" lead="Economic interest after trust and entity look-through">
      {people.length === 0 ? <Empty>No beneficiary is on file for this client yet.</Empty> : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
            {people.map((one, at) => (
              <span key={one.id} style={{ width: `${one.sharePercent}%`, background: INK[at % INK.length] }} />
            ))}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {people.map((one) => (
              <li key={one.id} className="flex items-center gap-3 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-50 text-sm font-bold text-primary-700" aria-hidden="true">
                  {one.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{one.name}</p>
                  <p className="text-xs text-ink-muted">{one.generation ?? (one.kind === "CHARITY" ? "Charitable" : "—")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{compact(one.value, data.currency)}</p>
                  <p className="text-xs text-ink-muted tabular-nums">{one.sharePercent.toFixed(1)}%</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The bank-file client                                                                                          */

function BankFileCards({ file }: { file: WorkspaceBankFile }) {
  return (
    <>
      <Card title="Holdings in the Bank File"
        lead={`${file.banks.join(", ") || "No bank"} · as of ${file.asOf ? formatDate(file.asOf) : "—"} · ranked within each currency`}>
        {file.byCurrency.length === 0 ? <NotInFile /> : (
          <div className="space-y-5">
            {file.byCurrency.map((group) => (
              <div key={group.currency}>
                <p className="flex items-baseline justify-between border-b border-line pb-1 text-sm font-bold">
                  {group.currency}
                  <span className="tabular-nums">{compact(group.total, group.currency)}</span>
                </p>
                <div className="-mx-5 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                        <th scope="col" className="py-1.5 pr-3 pl-5">Line</th>
                        <th scope="col" className="px-3 py-1.5">Identifier</th>
                        <th scope="col" className="px-3 py-1.5">Bank's class</th>
                        <th scope="col" className="px-3 py-1.5 text-right">Quantity</th>
                        <th scope="col" className="px-3 py-1.5 text-right">Price</th>
                        <th scope="col" className="px-3 py-1.5 text-right">Value</th>
                        <th scope="col" className="py-1.5 pr-5 pl-3 text-right">Accrued</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {group.lines.map((one, at) => (
                        <tr key={`${one.name}-${at}`}>
                          <td className="py-1.5 pr-3 pl-5 font-medium">{one.name}</td>
                          <td className="px-3 py-1.5 text-xs text-ink-muted">{one.identifier ?? <NotInFile />}</td>
                          <td className="px-3 py-1.5 text-xs">{one.assetClass ?? <NotInFile />}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{one.quantity == null ? <NotInFile /> : plain(one.quantity)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{one.price == null ? <NotInFile /> : plain(one.price)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{exact(one.value, one.currency)}</td>
                          <td className="py-1.5 pr-5 pl-3 text-right tabular-nums">{one.accruedInterest == null ? <NotInFile /> : exact(one.accruedInterest, one.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-3xs text-ink-muted italic">
          Not ranked across currencies: that would need a rate the bank did not send. Every line counts at the value the bank states.
        </p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Accounts" lead="At the banks whose files state this client's holdings">
          {file.accounts.length === 0 ? <NotInFile /> : (
            <ul className="divide-y divide-line text-sm">
              {file.accounts.map((one, at) => (
                <li key={`${one.lastFour}-${one.currency}-${at}`} className="flex justify-between py-2">
                  <span>{one.bank} · ••{one.lastFour}</span>
                  <span className="text-ink-muted">{one.currency} · {titleCase(one.accountType)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Movements" lead="As the bank's files state them">
          {file.movements.length === 0 ? <NotInFile /> : (
            <ul className="divide-y divide-line text-sm">
              {file.movements.map((one, at) => (
                <li key={`${one.bookedOn}-${at}`} className="flex items-start gap-3 py-2">
                  <span className="w-20 shrink-0 text-xs text-ink-muted">{formatDate(one.bookedOn)}</span>
                  <span className="min-w-0 flex-1">
                    {one.type ?? <NotInFile />}
                    <span className="block truncate text-xs text-ink-muted">{one.description}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", toneOf(one.amount))}>{exact(one.amount, one.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-ink-muted">
        Net worth evolution, allocation, bands, performance, liquidity, top positions and projected cash flows: <NotInFile />
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Alerts and notes                                                                                              */

const ALERT_TAGS: Record<string, [string, string]> = {
  DEVIATION: ["Deviation", "bg-red-50 text-red-700"],
  IPS_WARNING: ["Monitor", "bg-amber-50 text-amber-700"],
  DATA_DELAYED: ["Data", "bg-amber-50 text-amber-700"],
  CAPITAL_CALL: ["Capital call", "bg-slate-100 text-ink-soft"],
};

function AlertsAndNotes({ data }: { data: ClientWorkspace }) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const add = useAddClientNote<ApiError>({
    mutation: {
      onSuccess: () => {
        setWriting(false);
        setBody("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: getGetClientWorkspaceQueryKey(data.customerId) });
      },
      onError: (caught) => setError(caught.message),
    },
  });
  return (
    <Card title="Alerts & Notes"
      action={!writing && (
        <Button variant="secondary" size="sm" onClick={() => setWriting(true)}>
          <Plus aria-hidden="true" />
          Add note
        </Button>
      )}>
      {writing && (
        <form className="mb-4 space-y-2" onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ customerId: data.customerId, data: { body } });
        }}>
          <label htmlFor="client-note" className="sr-only">Note</label>
          <TextArea id="client-note" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)}
            placeholder="What should the next person to open this client know?" />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>Save note</Button>
            <Button variant="ghost" size="sm" onClick={() => { setWriting(false); setBody(""); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
      {data.alerts.length === 0 && data.notes.length === 0 ? <Empty>Nothing to look at, and no notes yet.</Empty> : (
        <ul className="divide-y divide-line">
          {data.alerts.map((one, at) => {
            const [label, tone] = ALERT_TAGS[one.kind] ?? [one.kind, "bg-slate-100 text-ink-soft"];
            return (
              <li key={`alert-${at}`} className="py-2.5">
                <span className={cn("rounded-md px-1.5 py-0.5 text-2xs font-semibold", tone)}>{label}</span>
                <p className="mt-1 text-sm">{one.text}{one.on && <span className="text-ink-muted"> · {formatDate(one.on)}</span>}</p>
              </li>
            );
          })}
          {data.notes.map((one) => (
            <li key={one.id} className="py-2.5">
              <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-2xs font-semibold text-primary-700">PM note</span>
              <p className="mt-1 text-sm whitespace-pre-line">{one.body}</p>
              <p className="text-xs text-ink-muted">— {one.writtenBy}, {formatDateTime(one.writtenAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                  */

function Card({ title, lead, action, children }: { title: string; lead?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5">
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

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function Signed({ value, unit }: { value: number; unit: string }) {
  return <span className={toneOf(value)}>{value > 0 ? "+" : ""}{value.toFixed(1)}{unit}</span>;
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function money(amount: number | null, currency: string) {
  return amount == null ? "—" : compact(amount, currency);
}

/** A bank's figure in full, to the cent, as the bank wrote it. */
function exact(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function plain(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
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

function titleCase(text: string) {
  return text.toLowerCase().replace(/_/g, " ").replace(/^\w/, (first) => first.toUpperCase());
}

function monthLabel(day: string) {
  const date = new Date(day);
  return date.getMonth() === 0 ? `Jan ${String(date.getFullYear()).slice(2)}` : date.toLocaleString("en-GB", { month: "short" });
}

function dayMonth(day: string) {
  return new Date(day).toLocaleString("en-GB", { day: "2-digit", month: "short" });
}
