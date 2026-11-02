import { ApiError } from "@atomprive/api-client";
import { useInsights, type PortfolioInsights } from "@atomprive/api-client/portal";
import { ChevronRight } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Card } from "./card";
import { AllocationRing, BarChart, LineChart, ValueChart } from "./dashboard-charts";
import { INK, compact, percent } from "./figures";

/**
 * The client's portfolio, in the sections of the firm's reference wealth report — Overview, Asset Allocation,
 * Performance, Performance Attribution, Explainer, Cash Flow and Holdings — as tabs, the way a client's file is
 * laid out on the staff side. The tab and the period are in the address, so a reload opens the same view.
 *
 * <p>What only the custodian feed can say is shown as a dash with the reason, never as nought.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "allocation", label: "Asset Allocation" },
  { id: "performance", label: "Performance" },
  { id: "attribution", label: "Performance Attribution" },
  { id: "explainer", label: "Explainer" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "holdings", label: "Holdings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PERIODS = ["3M", "YTD", "1Y", "MAX"] as const;

const NOT_SENT = "Not sent by your bank yet";

const GAIN = "var(--color-access-full)";
const LOSS = "#f97316";
const STEADY = "#a3b8d4";

const countries = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  try {
    return countries.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** An amount the way the reference writes it in a table: 1,234.56, and a loss in brackets. */
function exact(value: number) {
  const drawn = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
  return value < 0 ? `(${drawn})` : drawn;
}

function Tone({ value, children }: { value: number | null | undefined; children: ReactNode }) {
  const tone = value === null || value === undefined || value === 0 ? "text-ink" : value > 0 ? "text-access-full-ink" : "text-orange-600";
  return <span className={tone}>{children}</span>;
}

/** A figure tile: its name, and a large value or a dash where it is not known yet. */
function Stat({ label, value, tone, why }: { label: string; value: string | null; tone?: number | null; why?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-white px-4 py-5 text-center">
      <p className="truncate text-xs font-semibold text-ink-soft" title={label}>
        {label}
      </p>
      {value === null ? (
        <p className="text-2xl font-bold text-ink-muted" title={why}>
          —
        </p>
      ) : (
        <p className="text-2xl font-bold tabular-nums">
          <Tone value={tone}>{value}</Tone>
        </p>
      )}
      {value === null && why && <p className="text-3xs text-ink-muted">{why}</p>}
    </div>
  );
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (next: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-canvas p-0.5">
      {options.map((one) => (
        <button
          key={one.id}
          type="button"
          role="radio"
          aria-checked={value === one.id}
          onClick={() => onChange(one.id)}
          className={`rounded-md px-3 py-1 text-xs font-semibold ${value === one.id ? "bg-white text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
        >
          {one.label}
        </button>
      ))}
    </div>
  );
}

const pct = (value: number) => percent(value);
const pctTick = (value: number) => `${value.toFixed(Math.abs(value) < 1 && value !== 0 ? 2 : 1)}%`;
const moneyTick = (value: number) => compact(value);

function Overview({ data, period, onPeriod }: { data: PortfolioInsights; period: string; onPeriod: (next: string) => void }) {
  const [view, setView] = useState<"twr" | "value">("twr");
  const c = data.currency;
  return (
    <div className="space-y-5">
      <Stats>
        <Stat label={`Market Value (${c})`} value={compact(data.marketValue)} />
        <Stat label={`Assets (${c})`} value={compact(data.assets)} />
        <Stat label={`Liabilities (${c})`} value={compact(data.liabilities)} />
        <Stat label={`TWR (${c}) (YTD)`} value={data.twrYearToDate === null ? null : pct(data.twrYearToDate)} tone={data.twrYearToDate} why="Not valued this year yet" />
      </Stats>
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Toggle
            label="Chart"
            value={view}
            onChange={setView}
            options={[
              { id: "twr", label: "Performance" },
              { id: "value", label: "Portfolio Value" },
            ]}
          />
          <Toggle label="Period" value={period} onChange={onPeriod} options={PERIODS.map((one) => ({ id: one, label: one }))} />
        </div>
        {view === "twr" ? (
          <LineChart
            series={[{ name: "TWR", colour: "var(--color-primary-600)", points: data.performance, area: true }]}
            format={pct}
            tick={pctTick}
            label="Time-weighted return over the period"
            empty="Your return appears here once your portfolio has been valued in this period."
          />
        ) : (
          <ValueChart points={data.valueLine} currency={c} empty="Your portfolio's value appears here once it has been valued in this period." />
        )}
      </section>
    </div>
  );
}

function Allocation({ data }: { data: PortfolioInsights }) {
  const positive = data.byAssetClass.filter((one) => one.value > 0).map((one) => ({ key: one.key, name: one.name, value: one.value, share: one.share }));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Market Value Weight by Asset Class">
        <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="mx-auto w-44 [&_ul]:hidden">
            <AllocationRing slices={positive} currency={data.currency} />
          </div>
          <ul className="space-y-2.5">
            {data.byAssetClass.map((one, index) => (
              <li key={one.key} className="flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: one.value > 0 ? INK[positive.findIndex((p) => p.key === one.key) % INK.length] : INK[index % INK.length] }} />
                <span className="min-w-0 flex-1 truncate text-ink-soft">{one.name}</span>
                <span className="font-semibold text-ink tabular-nums">{one.share.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <div className="space-y-5">
        <Card title="Market Value Weight by Sub Asset Class">
          {data.bySubClass.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">No sub-classes recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.bySubClass.map((one) => (
                <li key={one.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-xs">
                  <span className="truncate text-right text-ink-soft" title={one.name}>
                    {one.name}
                  </span>
                  <span className="h-3 rounded-sm bg-canvas">
                    <span className="block h-3 rounded-sm bg-access-full" style={{ width: `${Math.max(1, Math.min(100, one.share))}%` }} />
                  </span>
                  <span className="text-ink-muted tabular-nums">{one.share.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-right text-3xs text-ink-muted">Market value weight (%) ({data.currency})</p>
        </Card>
        <Card title="Market Value Weight by Geography">
          <BarChart
            bars={data.byCountry.map((one) => ({ label: countryName(one.key), value: one.share }))}
            format={(value) => `${value.toFixed(2)}%`}
            tick={(value) => `${value.toFixed(0)}%`}
            label="Market value weight by country"
            empty="No countries recorded for your holdings yet."
          />
        </Card>
        <Card title="Market Value Weight % by Custodian">
          <p className="py-4 text-center text-sm text-ink-muted">— {NOT_SENT}</p>
        </Card>
      </div>
    </div>
  );
}

function Performance({ data }: { data: PortfolioInsights }) {
  const c = data.currency;
  return (
    <div className="space-y-5">
      <Stats>
        <Stat label={`TWR (${c}) (MTD)`} value={data.twrMonthToDate === null ? null : pct(data.twrMonthToDate)} tone={data.twrMonthToDate} why="Not valued this month yet" />
        <Stat label={`TWR (${c}) (YTD)`} value={data.twrYearToDate === null ? null : pct(data.twrYearToDate)} tone={data.twrYearToDate} why="Not valued this year yet" />
        <Stat label={`TWR (${c}) (Since start)`} value={data.twrSinceStart === null ? null : pct(data.twrSinceStart)} tone={data.twrSinceStart} why="Not valued yet" />
        <Stat label={`Total Trading Profit (${c})`} value={null} why={NOT_SENT} />
      </Stats>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="TWR by Day">
          <LineChart
            series={[{ name: "TWR", colour: "var(--color-primary-600)", points: data.performance, area: true }]}
            format={pct}
            tick={pctTick}
            label="Time-weighted return by day"
            empty="Your return appears here once your portfolio has been valued in this period."
          />
        </Card>
        <div className="space-y-5">
          <Card title="Net Gain/Loss by Asset Class">
            <BarChart
              bars={data.gainByAssetClass.map((one) => ({ label: one.name, value: one.change }))}
              format={(value) => `${c} ${exact(value)}`}
              tick={moneyTick}
              label="Net gain or loss by asset class"
              empty="Nothing to compare in this period yet."
            />
          </Card>
          <Card title="Total Trading Profit by Month">
            <p className="py-4 text-center text-sm text-ink-muted">— {NOT_SENT}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Each day's close at the end of each month, for the market-value-by-month line. */
function monthEnds(points: PortfolioInsights["valueLine"]) {
  return points.filter((one, index) => index === points.length - 1 || one.on.slice(0, 7) !== points[index + 1]!.on.slice(0, 7));
}

function Attribution({ data }: { data: PortfolioInsights }) {
  const c = data.currency;
  const told = data.explained;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label={`Realised Earnings - Change (${c})`} value={null} why={NOT_SENT} />
        <Stat label={`Unrealised Earnings - Change (${c})`} value={told ? compact(told.earned) : null} tone={told?.earned} why="Needs two valued days" />
        <Stat label={`Funding/Transfer (${c})`} value={told ? compact(told.funded) : null} tone={told?.funded} why="Needs two valued days" />
        <Stat label={`Capital FX Gain/Loss - Change (${c})`} value={null} why={NOT_SENT} />
        <Stat label={`Market Value (${c})`} value={compact(data.marketValue)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Performance Attribution">
          <BarChart
            bars={[
              { label: "Unrealised earnings", value: told?.earned ?? null, colour: told && told.earned >= 0 ? GAIN : LOSS },
              { label: "FX gain/loss", value: null },
              { label: "Market value change", value: told?.changed ?? null, colour: told && told.changed >= 0 ? GAIN : LOSS },
            ]}
            format={(value) => `${c} ${exact(value)}`}
            tick={moneyTick}
            label="What moved the portfolio in the period"
            empty="Two days of valuations in this period are needed to show what moved it."
          />
        </Card>
        <Card title="Market Value by Month" action={<span className="text-xs text-ink-muted">{c}</span>}>
          <ValueChart points={monthEnds(data.valueLine)} currency={c} empty="Your portfolio's value appears here once it has been valued." />
        </Card>
      </div>
    </div>
  );
}

type Row = { label: string; value: number | null; inside?: Row[] };

function MetricRow({ row, level = 0 }: { row: Row; level?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <li className="border-t border-line px-4 py-2.5" style={{ paddingLeft: `${16 + level * 14}px` }}>
        <button type="button" disabled={!row.inside} onClick={() => setOpen((was) => !was)} className="flex w-full items-start gap-2 text-left disabled:cursor-default">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-muted">{row.label}</span>
            <span className="block text-sm font-semibold text-ink tabular-nums" title={row.value === null ? NOT_SENT : undefined}>
              {row.value === null ? "—" : exact(row.value)}
            </span>
          </span>
          {row.inside && <ChevronRight aria-hidden="true" className={`mt-2 size-4 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`} />}
        </button>
      </li>
      {open && row.inside?.map((one) => <MetricRow key={one.label} row={one} level={level + 1} />)}
    </>
  );
}

function Explainer({ data }: { data: PortfolioInsights }) {
  const told = data.explained;
  if (!told) {
    return (
      <Card title="Explainer">
        <p className="py-8 text-center text-sm text-ink-muted">Two days of valuations in this period are needed to explain how your portfolio moved.</p>
      </Card>
    );
  }
  const columns: { title: string; value: number | null; rows: Row[] }[] = [
    {
      title: "Realised Earnings",
      value: null,
      rows: [
        { label: "Income", value: null },
        { label: "Expense", value: null },
        { label: "Realised trading profit", value: null },
      ],
    },
    {
      title: "Unrealised Earnings",
      value: told.earned,
      rows: [
        { label: "Accrued interest", value: null },
        { label: "Unrealised trading profit", value: told.earned },
      ],
    },
    {
      title: "FX Gain/Loss",
      value: null,
      rows: [
        { label: "Unrealised FX gain/loss", value: null },
        { label: "Realised FX gain/loss", value: null },
      ],
    },
    {
      title: "Funding/Transfer",
      value: told.funded,
      rows: [
        {
          label: "Net funds transfer",
          value: told.funded,
          inside: [
            { label: "Incoming funds", value: told.paidIn },
            { label: "Outgoing funds", value: told.paidOut },
          ],
        },
        { label: "Net securities transfer", value: null },
      ],
    },
  ];
  return (
    <div className="space-y-5">
      <Card title="Explainer">
        <BarChart
          bars={[
            { label: "Starting value", value: told.startingValue, colour: STEADY },
            { label: "Realised earnings", value: null },
            { label: "Unrealised earnings", value: told.earned, colour: told.earned >= 0 ? GAIN : LOSS },
            { label: "FX gain/loss", value: null },
            { label: "Funding/transfer", value: told.funded, colour: told.funded >= 0 ? GAIN : LOSS },
            { label: "Ending value", value: told.endingValue, colour: STEADY },
          ]}
          waterfall={{ totals: [0, 5] }}
          format={(value) => `${data.currency} ${exact(value)}`}
          tick={moneyTick}
          label="How the portfolio went from its starting value to its ending value"
          empty=""
        />
      </Card>
      <div>
        <h2 className="text-base font-bold text-ink">
          Metric Table <span className="ml-2 text-xs font-normal text-ink-muted">The values below reflect activity for the selected period only, not cumulative totals.</span>
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
          <div className="grid min-w-[900px] grid-cols-[180px_minmax(0,1fr)_180px]">
            <div className="flex flex-col items-center justify-center gap-1 border-r border-line p-4 text-center">
              <p className="text-sm font-semibold text-ink">Starting Value</p>
              <p className="text-lg font-bold text-ink tabular-nums">{exact(told.startingValue)}</p>
              <p className="text-3xs text-ink-muted">{told.startedOn}</p>
            </div>
            <div>
              <p className="border-b border-line py-3 text-center text-sm font-semibold text-ink">
                Value Changed <span className="ml-1 tabular-nums">{exact(told.changed)}</span>
              </p>
              <div className="grid grid-cols-4 divide-x divide-line">
                {columns.map((column) => (
                  <div key={column.title}>
                    <div className="bg-primary-50/60 px-4 py-3 text-center">
                      <p className="text-sm font-semibold text-ink">{column.title}</p>
                      <p className="text-lg font-bold text-ink tabular-nums" title={column.value === null ? NOT_SENT : undefined}>
                        {column.value === null ? "—" : exact(column.value)}
                      </p>
                    </div>
                    <ul>
                      {column.rows.map((row) => (
                        <MetricRow key={row.label} row={row} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 border-l border-line p-4 text-center">
              <p className="text-sm font-semibold text-ink">Ending Value</p>
              <p className="text-lg font-bold text-ink tabular-nums">{exact(told.endingValue)}</p>
              <p className="text-3xs text-ink-muted">{told.endedOn}</p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-muted">A dash means the figure is {NOT_SENT.toLowerCase()}.</p>
      </div>
    </div>
  );
}

function CashFlow({ data }: { data: PortfolioInsights }) {
  const month = (key: string) => new Date(`${key}-01`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  const biggest = Math.max(1, ...data.topFlows.map((one) => Math.abs(one.amount)));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Net Cash Flow by Month">
        <BarChart
          bars={data.cashByMonth.map((one) => ({ label: month(one.month), value: one.net, colour: one.net >= 0 ? "var(--color-brand-900)" : LOSS }))}
          format={(value) => `${data.currency} ${exact(value)}`}
          tick={moneyTick}
          label="Net money in or out each month"
          empty="No money has moved in or out yet."
        />
      </Card>
      <Card title="Top Cash Flow Movers">
        {data.topFlows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No money has moved in or out in this period.</p>
        ) : (
          <ul className="space-y-3">
            {data.topFlows.map((one, index) => (
              <li key={`${one.on}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)_8rem] items-center gap-3 text-xs">
                <span className="text-ink-muted">{new Date(one.on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span className="h-3 rounded-sm bg-canvas">
                  <span className="block h-3 rounded-sm" style={{ width: `${(Math.abs(one.amount) / biggest) * 100}%`, background: one.amount >= 0 ? GAIN : LOSS }} />
                </span>
                <span className="text-right font-semibold text-ink tabular-nums">
                  {one.currency} {exact(one.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-center gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: GAIN }} /> Cash inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: LOSS }} /> Cash outflow
          </span>
        </div>
      </Card>
    </div>
  );
}

function Holdings({ data }: { data: PortfolioInsights }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const totalChange = data.holdings.reduce((sum, one) => sum + (one.change ?? 0), 0);
  const total = data.holdings.reduce((sum, one) => sum + one.value, 0);
  const c = data.currency;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="bg-sidebar text-xs text-ink-soft">
              <th scope="col" className="rounded-l-lg px-3 py-2.5 font-semibold">Asset Class &gt; Security</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Market Price</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Net Gain/Loss - Change ({c})</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Market Value ({c})</th>
              <th scope="col" className="rounded-r-lg px-3 py-2.5 text-right font-semibold">Market Value Weight % ({c})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.holdings.map((group) => (
              <Fragment key={group.key}>
                <tr>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => toggle(group.key)} aria-expanded={open.has(group.key)} className="flex items-center gap-2 font-semibold text-ink">
                      <ChevronRight aria-hidden="true" className={`size-4 text-ink-muted transition-transform ${open.has(group.key) ? "rotate-90" : ""}`} />
                      {group.name}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right text-ink-muted" title={NOT_SENT}>-</td>
                  <td className="px-3 py-3 text-right tabular-nums">{group.change === null ? <span className="text-ink-muted">-</span> : <Tone value={group.change}>{exact(group.change)}</Tone>}</td>
                  <td className="px-3 py-3 text-right tabular-nums"><Tone value={group.value < 0 ? group.value : 0}>{exact(group.value)}</Tone></td>
                  <td className="px-3 py-3 text-right text-ink tabular-nums">{group.share.toFixed(2)}%</td>
                </tr>
                {open.has(group.key) &&
                  group.lines.map((line, index) => (
                    <tr key={`${group.key}-${index}`} className="bg-sidebar/60 text-ink-soft">
                      <td className="py-2 pr-3 pl-10">
                        <span className="block text-ink">{line.name}</span>
                        {line.detail && <span className="block text-xs text-ink-muted">{line.detail}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-muted">-</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.change === null ? <span className="text-ink-muted">-</span> : <Tone value={line.change}>{exact(line.change)}</Tone>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{exact(line.value)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.share.toFixed(2)}%</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
            <tr className="font-semibold italic">
              <td className="px-3 py-3 pl-9">TOTAL</td>
              <td className="px-3 py-3 text-right text-ink-muted">-</td>
              <td className="px-3 py-3 text-right tabular-nums"><Tone value={totalChange}>{exact(totalChange)}</Tone></td>
              <td className="px-3 py-3 text-right tabular-nums">{exact(total)}</td>
              <td className="px-3 py-3 text-right tabular-nums">100.00%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PortfolioPage() {
  const [params, setParams] = useSearchParams();
  const period = (PERIODS as readonly string[]).includes(params.get("period") ?? "") ? params.get("period")! : "YTD";
  const tab: TabId = TABS.some((one) => one.id === params.get("tab")) ? (params.get("tab") as TabId) : "overview";
  const insights = useInsights<PortfolioInsights, ApiError>({ period });

  const change = (key: string, value: string) =>
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance text-ink">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-muted">View performance, returns and portfolio allocation.</p>
        </div>
        {tab !== "overview" && (
          <Toggle label="Period" value={period} onChange={(next) => change("period", next)} options={PERIODS.map((one) => ({ id: one, label: one }))} />
        )}
      </div>

      <div role="tablist" aria-label="Portfolio" className="flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => change("tab", one.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap ${
              tab === one.id ? "border-primary-600 text-primary-700" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {one.label}
          </button>
        ))}
      </div>

      {insights.isError ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-access-none-ink">Your portfolio could not be loaded. Refresh the page to try again.</p>
      ) : !insights.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/60" />
      ) : (
        <>
          {tab === "overview" && <Overview data={insights.data} period={period} onPeriod={(next) => change("period", next)} />}
          {tab === "allocation" && <Allocation data={insights.data} />}
          {tab === "performance" && <Performance data={insights.data} />}
          {tab === "attribution" && <Attribution data={insights.data} />}
          {tab === "explainer" && <Explainer data={insights.data} />}
          {tab === "cashflow" && <CashFlow data={insights.data} />}
          {tab === "holdings" && <Holdings data={insights.data} />}
        </>
      )}
    </div>
  );
}
