import { ApiError } from "@atomprive/api-client";
import {
  useGetClientWorkspaceCollectibles,
  type ClientCollectibles,
  type CoItem,
  type CoKpi,
} from "@atomprive/api-client/backoffice";
import { Alert, cn } from "@atomprive/ui";
import { Car, FileText, Frame, Gem, MapPin, Sailboat, Watch, Wine, X, type LucideIcon } from "lucide-react";
import { createElement, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../lib/labels";
import { Chart, ink } from "../book/overview-charts";

/**
 * A client's Collectibles & Real Assets register, laid out section by section as the firm's 10 Nov design draws it.
 * The items are the client's assets owned outright in the six collectible categories — the same rows Owned outright
 * counts on every other screen — and every figure, from the register value and cover to the documentation share and
 * what falls due, is worked out on the server. Photos are the design's placeholders. The items, appraisals, insurance,
 * carrying costs and provenance are demo figures, which the page says. A client whose figures come only from their
 * bank's files holds no collectibles in them, so every card is not in bank file. Read only.
 */
export function ClientCollectiblesPage() {
  const { customerId = "" } = useParams();
  const co = useGetClientWorkspaceCollectibles<ClientCollectibles, ApiError>(customerId);
  const data = co.data;
  const [filter, setFilter] = useState("ALL");

  if (co.isError) return <Alert tone="danger">{co.error.message}</Alert>;
  if (!data) return <p className="py-16 text-center text-sm text-ink-muted">Reading the register…</p>;
  const file = data.bankFile;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">
          Portfolio Management / <Link to="/client-directory" className="hover:text-primary-700">Clients</Link> / {data.name} / Collectibles &amp; Real Assets
        </p>
        <h1 className="mt-1 text-[1.625rem] leading-tight font-bold">Collectibles &amp; Real Assets</h1>
        <p className="mt-1 text-sm text-ink-muted">Register of yachts, art, cars, watches, wine and jewellery · valuations, provenance, custody and insurance</p>
      </header>

      <Kpis data={data} />
      {!file && data.otherNote && <p className="-mt-2 text-xs text-ink-muted">{data.otherNote}.</p>}
      <Tiles data={data} filter={filter} onFilter={setFilter} />
      <Register data={data} filter={filter} onFilter={setFilter} />
      {/* Paired by height: the chart beside the obligations (the chart grows to match), the two tables together. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ValueCard data={data} />
        <ObligationsCard data={data} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <InsuranceCard data={data} />
        <LocationsCard data={data} />
      </div>

      <footer className="flex flex-wrap justify-between gap-2 pt-2 text-2xs text-ink-muted">
        <span>
          {file ? "Values in the bank's own currencies, unconverted" : `Values in ${data.currency} unless stated`}; market data as of {day(data.asOf)} close.
          {!file && data.note && ` ${data.note}`}
        </span>
        <span>atom privé · Portfolio Management · Internal use only</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const CATEGORIES: { key: string; label: string; short: string; icon: LucideIcon }[] = [
  { key: "YACHT", label: "Yacht", short: "Yacht", icon: Sailboat },
  { key: "ART", label: "Fine art", short: "Art", icon: Frame },
  { key: "CARS", label: "Classic cars", short: "Cars", icon: Car },
  { key: "WATCHES", label: "Watches", short: "Watches", icon: Watch },
  { key: "WINE", label: "Wine", short: "Wine", icon: Wine },
  { key: "JEWELLERY", label: "Jewellery", short: "Jewellery", icon: Gem },
];

const iconOf = (key: string) => CATEGORIES.find((one) => one.key === key)?.icon ?? FileText;

const KPI_LABELS = ["Register value", "Items", "Insured value", "Appraisals due · 120 days", "Carrying cost · annual", "Documentation"];

function Kpis({ data }: { data: ClientCollectibles }) {
  const kpis: (CoKpi | null)[] = data.bankFile ? KPI_LABELS.map(() => null) : data.kpis;
  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
      {kpis.map((one, at) => (
        <div key={one?.key ?? KPI_LABELS[at]} className="rounded-2xl border border-line bg-white px-4 py-3.5">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one?.label ?? KPI_LABELS[at]}</p>
          {!one ? <div className="mt-2"><NotInFile /></div> : (
            <>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">{kpiValue(one, data.currency)}</p>
              {one.detail && (
                <p className="mt-1 text-xs text-ink-muted">
                  {one.detail}
                  {one.extra && <> <span className={cn("font-semibold", one.extraTone === "UP" ? "text-emerald-700" : "text-red-700")}>{one.extra}</span></>}
                  {one.after && <> {one.after}</>}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Tiles({ data, filter, onFilter }: { data: ClientCollectibles; filter: string; onFilter: (key: string) => void }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
      {CATEGORIES.map((category) => {
        const one = data.categories.find((tile) => tile.key === category.key);
        const Icon = category.icon;
        const selected = filter === category.key;
        return (
          <button key={category.key} type="button" disabled={data.bankFile || !one || one.count === 0}
            onClick={() => onFilter(selected ? "ALL" : category.key)} aria-pressed={selected}
            className={cn("rounded-2xl border bg-white px-4 py-3 text-left disabled:cursor-default",
              selected ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-muted")}>
            <span className="flex items-start justify-between">
              <span className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{category.label}</span>
              <Icon className="size-4 text-ink-muted" aria-hidden="true" />
            </span>
            {data.bankFile || !one ? <span className="mt-2 block"><NotInFile /></span> : (
              <>
                <span className="mt-1 block text-xl font-bold tabular-nums">{compact(one.value, data.currency)}</span>
                <span className="mt-1.5 block h-1 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-1 rounded-full bg-ink" style={{ width: `${Math.min(100, one.sharePercent ?? 0)}%` }} />
                </span>
                <span className="mt-1.5 flex items-start justify-between gap-2 text-xs">
                  <span className="min-w-0 text-ink-muted">{one.countLine}</span>
                  {one.gainPercent != null && <span className={cn("font-semibold tabular-nums", toneOf(one.gainPercent))}>{signed(one.gainPercent)}%</span>}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

function Register({ data, filter, onFilter }: { data: ClientCollectibles; filter: string; onFilter: (key: string) => void }) {
  const [view, setView] = useState<"GALLERY" | "TABLE">("GALLERY");
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const items = data.items.filter((one) => filter === "ALL" || one.category === filter);
  const open = picked === null ? null : data.items.find((one) => one.id === picked) ?? items[0] ?? null;

  if (data.bankFile) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card title="Asset Register"><FileBlock /></Card>
        <Card title="Item record"><FileBlock /></Card>
      </div>
    );
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
      <Card title="Asset Register" lead="Sorted by value · click an item to open its record">
        {data.items.length === 0 ? <Empty>No collectibles on the register.</Empty> : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Segmented value={filter} onChange={onFilter}
                options={[["ALL", `All ${data.items.length}`], ...CATEGORIES.filter((c) => data.items.some((one) => one.category === c.key)).map((c) => [c.key, c.short] as [string, string])]} />
              <Segmented value={view} onChange={(next) => setView(next as "GALLERY" | "TABLE")} options={[["GALLERY", "Gallery"], ["TABLE", "Table"]]} />
            </div>
            {view === "GALLERY" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((one) => (
                  <button key={one.id} type="button" onClick={() => setPicked(one.id)}
                    className={cn("overflow-hidden rounded-xl border text-left", open?.id === one.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink-muted")}>
                    <Photo category={one.category} tall />
                    <span className="block p-3">
                      <span className="block font-semibold">{one.name}</span>
                      <span className="block text-xs text-ink-muted">{one.line ?? one.categoryLabel}</span>
                      <span className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-lg font-bold tabular-nums">{compact(one.value, data.currency)}</span>
                        {one.gainPercent != null && <span className={cn("text-sm font-semibold tabular-nums", toneOf(one.gainPercent))}>{signed(one.gainPercent)}%</span>}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
                        <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{one.location ?? "—"}</span></span>
                        <Status item={one} />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                      <th scope="col" className="py-2 pr-2">Item</th>
                      <th scope="col" className="px-2 py-2">Location</th>
                      <th scope="col" className="px-2 py-2 text-right">Value</th>
                      <th scope="col" className="px-2 py-2 text-right">Cost</th>
                      <th scope="col" className="px-2 py-2 text-right">Gain</th>
                      <th scope="col" className="py-2 pl-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((one) => (
                      <tr key={one.id} onClick={() => setPicked(one.id)} className={cn("cursor-pointer hover:bg-slate-50", open?.id === one.id && "bg-primary-50")}>
                        <th scope="row" className="py-2 pr-2 text-left">
                          <span className="block font-semibold">{one.name}</span>
                          <span className="block text-xs font-normal text-ink-muted">{one.categoryLabel}</span>
                        </th>
                        <td className="px-2 py-2 text-xs">{one.location ?? "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{compact(one.value, data.currency)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{one.cost == null ? "—" : compact(one.cost, data.currency)}</td>
                        <td className={cn("px-2 py-2 text-right tabular-nums", toneOf(one.gainPercent))}>{one.gainPercent == null ? "—" : `${signed(one.gainPercent)}%`}</td>
                        <td className="py-2 pl-2"><Status item={one} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
      <ItemPanel item={open} currency={data.currency} onClose={() => setPicked(null)} />
    </div>
  );
}

function ItemPanel({ item, currency, onClose }: { item: CoItem | null; currency: string; onClose: () => void }) {
  const option = useMemo(() => {
    const colours = ink();
    const points = item?.history ?? [];
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (value: number) => compact(value, currency) },
      xAxis: { type: "category", boundaryGap: false, data: points.map((one) => one.on.slice(0, 4)), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: [{ type: "line", data: points.map((one) => one.value), symbol: "circle", symbolSize: 5, areaStyle: { color: colours.canvas, opacity: 0.6 },
        lineStyle: { color: colours.text, width: 1.5 }, itemStyle: { color: colours.text } }],
    };
  }, [item, currency]);
  if (!item) {
    return <Card title="Item record"><Empty>Click an item to open its record.</Empty></Card>;
  }
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{item.categoryLabel}</p>
          <h2 className="mt-0.5 text-xl font-bold">{item.name}</h2>
          {item.line && <p className="text-xs text-ink-muted">{item.line}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-line p-1 text-ink-muted hover:text-ink" aria-label="Close the record">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((at) => <Photo key={at} category={item.category} />)}</div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-b border-line pb-4">
        <Figure label="Current value" value={compact(item.value, currency)} />
        <Figure label="Cost" value={item.cost == null ? "—" : compact(item.cost, currency)} />
        <Figure label="Gain" value={item.gainPercent == null ? "—" : `${signed(item.gainPercent)}%`} tone={toneOf(item.gainPercent)} />
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Field label="Serial no." value={item.reference} />
        <Field label="Owner entity" value={item.owner} />
        <Field label="Valuation method" value={item.valuationMethod} />
        <Field label="Last appraisal" value={item.lastAppraisal ? `${day(item.lastAppraisal)}${item.valuer ? ` · ${item.valuer}` : ""}` : null} />
        <Field label="Next appraisal" value={item.nextAppraisal ? day(item.nextAppraisal) : null} />
        <Field label="Location" value={[item.location, item.custody].filter(Boolean).join(" · ") || null} />
        <Field label="Insurance" value={[item.policyRef && `Policy ${item.policyRef}`, item.coverType].filter(Boolean).join(" · ") || null} />
        <Field label="Insured value" value={item.insured == null ? "Uninsured" : `${exact(item.insured, currency)}${item.coveragePercent == null ? "" : ` · ${item.coveragePercent.toFixed(0)}%`}`} />
        <Field label="Annual premium" value={item.premium == null ? null : exact(item.premium, currency)} />
      </dl>

      {item.history.length > 1 && (
        <>
          <p className="mt-5 text-3xs font-semibold tracking-wider text-ink-muted uppercase">Valuation history</p>
          <Chart option={option} height={150} label={`Appraised values of ${item.name}`} />
        </>
      )}

      <p className="mt-5 text-3xs font-semibold tracking-wider text-ink-muted uppercase">Provenance &amp; events</p>
      {item.events.length === 0 ? <p className="mt-2 text-xs text-ink-muted">None recorded.</p> : (
        <ol className="mt-2 space-y-3 border-l border-line pl-4">
          {item.events.map((one, at) => (
            <li key={`${one.on}-${at}`} className="relative">
              <span className={cn("absolute top-1 -left-[1.3rem] size-2.5 rounded-full border-2 border-ink", at === item.events.length - 1 ? "bg-ink" : "bg-white")} aria-hidden="true" />
              <p className="text-xs text-ink-muted tabular-nums">{day(one.on)}</p>
              <p className="text-sm font-semibold">{one.title}</p>
              {one.detail && <p className="text-xs text-ink-muted">{one.detail}</p>}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 text-3xs font-semibold tracking-wider text-ink-muted uppercase">Documents · {item.documents.length} of {item.documentsExpected}</p>
      <ul className="mt-2 divide-y divide-line text-sm">
        {item.documents.map((one) => (
          <li key={one.name} className="flex items-center justify-between gap-2 py-1.5">
            <span className="flex min-w-0 items-center gap-2"><FileText className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" /><span className="truncate">{one.name}</span></span>
            <span className="text-xs whitespace-nowrap text-ink-muted">{one.format}{one.sizeKb != null && ` · ${(one.sizeKb / 1024).toFixed(1)} MB`}</span>
          </li>
        ))}
        {item.documents.length < item.documentsExpected && (
          <li className="py-1.5 text-xs text-amber-700">{item.documentsExpected - item.documents.length} expected document{item.documentsExpected - item.documents.length === 1 ? "" : "s"} not on file</li>
        )}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const SERIES: [keyof Omit<ClientCollectibles["years"][number], "year">, string][] = [
  ["yacht", "Yacht"], ["art", "Fine art"], ["cars", "Classic cars"], ["watches", "Watches"], ["wine", "Wine"], ["jewellery", "Jewellery"],
];

/** The categories' fills, the yacht in the page's own ink so it reads in either theme. */
function fillsOf(text: string) {
  return [text, "#9a7b4f", "#d6c7a6", "#9b1c1c", "#e7dfcf", "#6b6358"];
}

function ValueCard({ data }: { data: ClientCollectibles }) {
  const fills = fillsOf(ink().text);
  const option = useMemo(() => {
    const colours = ink();
    const series = fillsOf(colours.text);
    return {
      textStyle: { fontFamily: colours.font },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => compact(value, data.currency) },
      xAxis: { type: "category", data: data.years.map((one) => one.year), axisLabel: { color: colours.muted, fontSize: 10 } },
      yAxis: { type: "value", splitNumber: 4, axisLabel: { color: colours.muted, formatter: (value: number) => compact(value, data.currency) },
        splitLine: { lineStyle: { color: colours.line } } },
      series: SERIES.map(([key, name], at) => ({ type: "bar", name, stack: "register", barMaxWidth: 36,
        data: data.years.map((one) => one[key]), itemStyle: { color: series[at] } })),
    };
  }, [data.years, data.currency]);
  return (
    <Card title="Register Value Over Time" lead={data.bankFile ? undefined : "Year-end appraised values · demo series"}>
      {data.bankFile ? <FileBlock /> : data.years.length === 0 ? <Empty>Nothing on the register.</Empty> : (
        <>
          {/* As tall as the obligations beside it: no blank space under the key. */}
          <div className="relative min-h-[260px] flex-1">
            <div className="absolute inset-0">
              <Chart option={option} label="Register value at each year end by category" />
            </div>
          </div>
          {/* The key is the page's own list rather than the chart's, so however narrow the card it wraps below the axis. */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {SERIES.map(([key, name], at) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs border border-line" style={{ background: fills[at] }} aria-hidden="true" />{name}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function InsuranceCard({ data }: { data: ClientCollectibles }) {
  const rows = data.insuranceTotal ? [...data.insurance, data.insuranceTotal] : data.insurance;
  return (
    <Card title="Insurance Coverage" lead={data.bankFile ? undefined : "Insured values vs latest appraisals"} flush>
      {data.bankFile ? <div className="px-5"><FileBlock /></div> : rows.length === 0 ? <Empty>Nothing to insure.</Empty> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                <th scope="col" className="py-2 pr-2 pl-5">Category</th>
                <th scope="col" className="px-2 py-2 text-right">Market</th>
                <th scope="col" className="px-2 py-2 text-right">Insured</th>
                <th scope="col" className="px-2 py-2 text-right">Cover</th>
                <th scope="col" className="px-2 py-2">Policy</th>
                <th scope="col" className="py-2 pr-5 pl-2">Renewal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((one) => (
                <tr key={one.key} className={cn(one.key === "TOTAL" && "font-semibold")}>
                  <th scope="row" className="py-2 pr-2 pl-5 text-left font-medium whitespace-nowrap">{one.label}</th>
                  <td className="px-2 py-2 text-right tabular-nums">{compact(one.market, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{compact(one.insured, data.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {one.coverPercent == null ? "—" : one.underInsured
                      ? <Pill tone="bg-red-50 text-red-700">{one.coverPercent.toFixed(0)}%</Pill> : `${one.coverPercent.toFixed(0)}%`}
                  </td>
                  <td className="px-2 py-2 text-xs">{one.policy ?? ""}</td>
                  <td className="py-2 pr-5 pl-2 text-xs whitespace-nowrap tabular-nums">{one.renewal ? day(one.renewal) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LocationsCard({ data }: { data: ClientCollectibles }) {
  return (
    <Card title="Locations & Custody" lead={data.bankFile ? undefined : "Where each asset physically sits"}>
      {data.bankFile ? <FileBlock /> : data.locations.length === 0 ? <Empty>Nothing on the register.</Empty> : (
        <ul className="divide-y divide-line">
          {data.locations.map((one) => (
            <li key={one.name} className="flex items-center gap-3 py-2.5">
              <MapPin className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{one.name}</span>
                <span className="block text-xs text-ink-muted">{one.line}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{compact(one.value, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ObligationsCard({ data }: { data: ClientCollectibles }) {
  return (
    <Card title="Upcoming Obligations" lead={data.bankFile ? undefined : "Appraisals, services, surveys and policy renewals · next 12 months"}>
      {data.bankFile ? <FileBlock /> : data.obligations.length === 0 ? <Empty>Nothing falls due in the next 12 months.</Empty> : (
        <ul className="divide-y divide-line">
          {data.obligations.map((one, at) => (
            <li key={`${one.on}-${at}`} className="flex gap-4 py-2.5">
              <span className="w-20 shrink-0 text-xs text-ink-muted tabular-nums">{month(one.on)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{one.title}</span>
                <span className="mt-1 inline-block"><Pill tone="bg-amber-50 text-amber-800">{one.tag}</Pill></span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */

const STATUS_TONE: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700",
  WARN: "bg-amber-50 text-amber-800",
  DANGER: "bg-red-50 text-red-700",
};

function Status({ item }: { item: CoItem }) {
  return <Pill tone={STATUS_TONE[item.statusTone] ?? "bg-slate-100 text-ink-soft"}>{item.status}</Pill>;
}

function Photo({ category, tall }: { category: string; tall?: boolean }) {
  return (
    // The theme's own fill and muted ink, so it follows the app's light/dark choice rather than the computer's.
    <span className={cn("flex flex-col items-center justify-center gap-1.5 bg-slate-100 text-ink-muted", tall ? "h-32" : "h-20 rounded-lg")} aria-hidden="true">
      {createElement(iconOf(category), { className: "size-5" })}
      <span className="text-3xs font-semibold tracking-widest">PHOTO</span>
    </span>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (next: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap rounded-lg border border-line p-0.5 text-xs font-semibold">
      {options.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
          className={cn("rounded-md px-2.5 py-1", value === key ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-ink-muted hover:text-ink")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className={cn("text-xl font-bold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="font-medium break-words">{value ?? "—"}</dd>
    </div>
  );
}

function Card({ title, lead, flush, children }: { title: string; lead?: string; flush?: boolean; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white", flush ? "py-5" : "p-5")}>
      <div className={cn("mb-3", flush && "px-5")}>
        <h2 className="text-lg font-bold">{title}</h2>
        {lead && <p className="mt-0.5 text-xs text-ink-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap", tone)}>{children}</span>;
}

/** Where a bank-file client's files hold nothing; on one line, as every card here has room for it. */
function NotInFile() {
  return (
    <span className="inline-block w-fit rounded-sm border border-dashed border-line px-1 text-left text-3xs leading-tight font-medium whitespace-nowrap text-ink-muted">
      not in bank file
    </span>
  );
}

function FileBlock() {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center"><NotInFile /></p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function kpiValue(one: CoKpi, currency: string) {
  if (one.value == null) return "—";
  if (one.unit === "PERCENT") return `${one.value.toFixed(0)}%`;
  if (one.unit === "COUNT") return one.value.toLocaleString("en-US");
  return compact(one.value, currency);
}

/** A date as the page prints it; nothing, or something that is not a date, prints as a dash rather than throwing. */
function day(value: string | null | undefined) {
  if (value == null || value === "" || Number.isNaN(new Date(value).getTime())) return "—";
  return formatDate(value);
}

function month(value: string) {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function compact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  }
}

function exact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function toneOf(value: number | null | undefined) {
  if (value == null) return undefined;
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : undefined;
}
