import type { ExportRow } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { ChartColumnIncreasing, ChevronDown, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "../../lib/labels";
import { INK } from "../portfolios/asset-classes";
import { money } from "./book-figures";
import { WaterfallChart, type Step } from "./overview-charts";
import { column as col, row as exportRow, useExportSheet, type Part } from "./overview-export";
import { series } from "./overview-data";
import type { PanelContext } from "./overview-panels";

/** Why a figure is a dash, said once for each thing the custodian feed will bring. */
const NEEDS_CURRENCY = "Needs each holding's currency from the custodian feed";
const NOT_SENT = "Not sent by the custodian feed yet";

type Line = { label: string; value: number | null; why?: string; inside?: Line[] };
type Column = { title: string; value: number | null; lines: Line[] };

/** A category of transaction, and the finer ones it is made of, as the reference Explainer breaks them down. */
type Kind = { label: string; inside?: Kind[] };

const REALISED: Kind[] = [
  {
    label: "Income",
    inside: [
      { label: "Interest income", inside: [{ label: "Cash interest" }, { label: "Deposit interest" }] },
      {
        label: "Distributions",
        inside: [
          { label: "Dividend" },
          { label: "Coupon" },
          {
            label: "PE distributions",
            inside: [
              { label: "PE distributions – capital gain" },
              { label: "PE distributions – income" },
              { label: "Historical PE distributions" },
              { label: "PE distributions – others" },
              { label: "PE distribution – expense" },
            ],
          },
          { label: "Fund distributions" },
          { label: "Rent" },
          { label: "Other distributions" },
          { label: "Insurance payout" },
        ],
      },
      { label: "Misc income" },
    ],
  },
  {
    label: "Expense",
    inside: [
      { label: "Interest expense", inside: [{ label: "Margin interest" }, { label: "Loan cost" }] },
      { label: "Misc expenses" },
      { label: "Capital call – expense" },
      { label: "Capital call – expense outside commitment" },
    ],
  },
  {
    label: "Transaction adjustments",
    inside: [
      { label: "Transaction fee", inside: [{ label: "Other adjustments at purchase" }, { label: "Other adjustments at sale" }] },
      { label: "Accrued interest in transactions", inside: [{ label: "Accrued interest at purchase" }, { label: "Accrued interest at sale" }] },
    ],
  },
  { label: "Realised trading profit" },
  { label: "Currency transaction" },
  { label: "Contributions", inside: [{ label: "Other contributions" }] },
];

/**
 * A transaction category with nothing on file in these dates: its total is nought, which is what the
 * transactions on file come to, however finely it is broken down.
 */
function noneOnFile(kind: Kind): Line {
  return { label: kind.label, value: 0, inside: kind.inside?.map(noneOnFile) };
}

/**
 * How the portfolio got from its worth on the first day of the page's dates to its worth on the last, as the
 * firm's reference Explainer lays it out: the waterfall, then the same steps as a table, by what moved them or
 * by asset class.
 *
 * <p>What can be said today is said — the two worths, the money paid in or taken out, and the change that is
 * left, which is the holdings' own movement. A transaction category is what its transactions on file come to,
 * nought where there are none, as the reference shows it. Accrued interest and currency are not on file at
 * all, so they are a dash with the reason a point away, never a nought.
 */
export function ExplainerTab({ context }: { context: PanelContext }) {
  const { sources } = context;
  const { overview } = sources;
  const [by, setBy] = useState<"METRIC" | "CLASS">("METRIC");

  const read = useMemo(() => {
    const worth = series("NET_WORTH", overview, sources);
    if (worth.length < 2) return null;
    const first = worth[0]!;
    const last = worth[worth.length - 1]!;
    // Money that arrived after the first day's close and by the last's: that day's own flows are already in
    // the opening worth.
    const funded = (sources.cashflows?.items ?? [])
      .filter((one) => one.happenedOn > first.on && one.happenedOn <= last.on)
      .reduce((sum, one) => sum + one.amount, 0);
    const changed = last.value - first.value;
    return { first, last, changed, funded, earned: changed - funded };
  }, [overview, sources]);

  // The table's columns, by what moved the money or by asset class; drawn for the view chosen and exported for
  // both.
  const columnsOf = (view: "METRIC" | "CLASS", held: NonNullable<typeof read>): Column[] => {
    const paidIn = (sources.cashflows?.items ?? [])
      .filter((one) => one.happenedOn > held.first.on && one.happenedOn <= held.last.on && one.amount > 0)
      .reduce((sum, one) => sum + one.amount, 0);

    // Every class the client holds, as the reference lists every one in each column, largest first. The
    // holdings' movement is each class's own change; what the classes do not add up to is money that moved
    // within them, shown on its own rather than spread across them.
    const changes = new Map(overview.changeByAssetClass.map((one) => [one.assetClass, one.change]));
    const names = new Map(overview.byAssetClass.map((one) => [one.key, one.name]));
    overview.changeByAssetClass.forEach((one) => names.set(one.assetClass, one.name));
    // Loans are owed rather than held, so they are not among the classes; they are listed with them, as the
    // reference lists them, where the client has any. Carried at today's value, they have not moved.
    if (sources.loans?.loans.length) names.set("LOANS", "Loans");
    const classes = [...names.entries()].map(([key, name]) => ({ key, name, change: changes.get(key) ?? 0 }));
    const unsplit = held.earned - classes.reduce((sum, one) => sum + one.change, 0);
    const each = (value: (key: string) => number | null, why?: string) =>
      classes
        .map((one) => ({ label: one.name, value: value(one.key), why }))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.label.localeCompare(b.label));

    return view === "METRIC"
      ? [
          { title: "Realised earnings", value: 0, lines: REALISED.map(noneOnFile) },
          {
            title: "Unrealised earnings",
            value: held.earned,
            lines: [
              { label: "Accrued interest", value: null, why: NOT_SENT },
              { label: "Unrealised trading profit", value: held.earned },
            ],
          },
          {
            title: "FX gain/loss",
            value: null,
            lines: [
              { label: "Unrealised FX gain/loss", value: null, why: NEEDS_CURRENCY },
              { label: "Realised FX gain/loss", value: null, why: NEEDS_CURRENCY },
            ],
          },
          {
            title: "Funding/transfer",
            value: held.funded,
            lines: [
              {
                label: "Net funds transfer",
                value: held.funded,
                inside: [
                  { label: "Incoming funds", value: paidIn },
                  { label: "Outgoing funds", value: held.funded - paidIn },
                ],
              },
              {
                label: "Net securities transfer",
                value: 0,
                inside: [{ label: "Incoming securities", value: 0 }, { label: "Outgoing securities", value: 0 }],
              },
              { label: "Historical capital call", value: 0 },
              { label: "Historical PE distributions", value: 0 },
            ],
          },
        ]
      : [
          { title: "Realised earnings", value: 0, lines: each(() => 0) },
          {
            title: "Unrealised earnings",
            value: held.earned,
            lines: [
              ...each((key) => changes.get(key) ?? 0),
              ...(Math.abs(unsplit) > 0.005 ? [{ label: "Not split by asset class", value: unsplit }] : []),
            ],
          },
          { title: "FX gain/loss", value: null, lines: each(() => null, NEEDS_CURRENCY) },
          {
            title: "Funding/transfer",
            value: held.funded,
            // Cash flows are recorded against the portfolio, not a class.
            lines: [...each(() => 0), ...(Math.abs(held.funded) > 0.005 ? [{ label: "Not split by asset class", value: held.funded }] : [])],
          },
        ];
  };

  useExportSheet(() => {
    if (!read) return null;
    const sheet = (view: "METRIC" | "CLASS"): Part => {
      const rows: ExportRow[] = [exportRow(["Starting value", read.first.value], 0, true)];
      const add = (line: Line, level: number) => {
        rows.push(exportRow([line.label, line.value], level));
        line.inside?.forEach((one) => add(one, level + 1));
      };
      columnsOf(view, read).forEach((one) => {
        rows.push(exportRow([one.title, one.value], 0, true));
        one.lines.forEach((line) => add(line, 1));
      });
      rows.push(exportRow(["Value changed", read.changed], 0, true));
      rows.push(exportRow(["Ending value", read.last.value], 0, true));
      return {
        name: view === "METRIC" ? "Sub-metrics" : "Assets & accounts",
        columns: [col("Metric"), col(`Value (${overview.currency})`, "MONEY")],
        rows,
      };
    };
    return [sheet("METRIC"), sheet("CLASS")];
  });

  if (!read) {
    return (
      <div className="rounded-2xl border border-line bg-white px-5 py-12 text-center text-sm text-ink-muted">
        Two days of valuations in these dates are needed to explain how the portfolio moved.
      </div>
    );
  }

  const steps: Step[] = [
    { label: "Starting value", value: read.first.value, total: true },
    { label: "Realised earnings", value: 0 },
    { label: "Unrealised earnings", value: read.earned },
    { label: "FX gain/loss", value: null },
    { label: "Funding/transfer", value: read.funded },
    { label: "Ending value", value: read.last.value, total: true },
  ];

  const columns = columnsOf(by, read);

  return (
    <div className="space-y-4">
      <section aria-label="Starting to ending value" className="h-80 rounded-2xl border border-line bg-white px-5 py-4">
        <WaterfallChart steps={steps} format={money} label="Starting to ending value" />
      </section>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 className="text-base font-bold">Metric table</h2>
        <p className="text-xs text-ink-muted">The values below are for the selected dates only, not running totals.</p>
        <div role="radiogroup" aria-label="Break the table down by" className="ml-auto inline-flex rounded-lg bg-canvas p-1 text-sm">
          {(["METRIC", "CLASS"] as const).map((one) => (
            <button key={one} type="button" role="radio" aria-checked={by === one} onClick={() => setBy(one)}
              className={cn("rounded-md px-3 py-1", by === one ? "bg-white font-semibold text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
              {one === "METRIC" ? "Sub-metrics" : "Assets & accounts"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[11rem_minmax(0,1fr)_11rem]">
        <End label="Starting value" value={read.first.value} />
        <div className="border-line max-lg:border-y lg:border-x">
          <p className="flex items-center justify-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
            <Badge /> Value changed <Signed value={read.changed} />
          </p>
          <div className="grid items-start sm:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title} className="h-full border-line sm:[&:nth-child(odd)]:border-r xl:border-r xl:last:border-r-0">
                <div className="border-b border-line bg-canvas/60 px-3 py-3 text-center">
                  <p className="text-sm font-semibold text-ink-soft">{column.title}</p>
                  <p className="text-xl font-bold">{column.value === null ? <Dash /> : <Signed value={column.value} />}</p>
                </div>
                <ul>
                  {column.lines.map((line, index) => (
                    <Row key={line.label} line={line} depth={0} colour={INK[index % INK.length]!} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <End label="Ending value" value={read.last.value} />
      </div>

      <p className="text-xs text-ink-muted">
        Note: earnings, FX and funding are what happened between {formatDate(read.first.on)} and {formatDate(read.last.on)}, not
        running totals. Transactions are counted as they are on file; a dash is a figure the custodian feed will bring, and pointing
        at it says which. Until trades come from the feed, everything the holdings did is counted as unrealised. Owned assets and loans are carried at today&apos;s value, and the
        header&apos;s filter does not narrow this tab.
      </p>
    </div>
  );
}

/** One figure in a column, opening onto the finer ones it is made of where it has them. */
function Row({ line, depth, colour }: { line: Line; depth: number; colour?: string }) {
  const [open, setOpen] = useState(false);
  const inside = line.inside ?? [];
  return (
    <li className={cn(depth === 0 && "border-b border-line")}>
      <div className="flex items-start gap-2.5 px-3 py-2" style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}>
        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: colour ?? "transparent" }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-ink-muted" title={line.label}>{line.label}</span>
          {line.value === null ? (
            <span className="inline-flex items-center gap-1 text-sm text-ink-muted/70" title={line.why}>
              —
              <Info aria-hidden="true" className="size-3" />
              <span className="sr-only">{line.why}</span>
            </span>
          ) : (
            <span className="text-sm"><Signed value={line.value} /></span>
          )}
        </span>
        {inside.length > 0 && (
          <button type="button" aria-expanded={open} aria-label={`${open ? "Close" : "Open"} ${line.label}`} onClick={() => setOpen((was) => !was)}
            className="mt-1 rounded text-ink-muted hover:text-ink">
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <ul className="pb-1">
          {inside.map((one) => <Row key={one.label} line={one} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function End({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid content-center justify-items-center gap-1.5 px-4 py-6 text-center">
      <Badge />
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="text-xl font-bold tabular-nums">{money(value)}</span>
    </div>
  );
}

function Badge() {
  return (
    <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-primary-50 text-primary-600">
      <ChartColumnIncreasing className="size-3.5" />
    </span>
  );
}

function Signed({ value }: { value: number }) {
  return (
    <span className={cn("tabular-nums", value < 0 ? "text-danger" : value > 0 ? "text-emerald-700" : "text-ink")}>
      {value > 0 ? "+" : ""}{money(value)}
    </span>
  );
}

function Dash() {
  return <span className="text-ink-muted/70">—</span>;
}
