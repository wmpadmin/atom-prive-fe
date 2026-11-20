import type { ReactNode } from "react";
import { Link } from "react-router";
import { KindChart, type ChartData, type ChartKind } from "../layout/chart-kinds";

/**
 * What a figure that is not a slice of the holdings is made of — a risk measure, a fee, a KPI tile — handed to the
 * breakdown panel by the screen that shows it, from that screen's own figures. The panel only lays it out: the
 * figure, how it is worked out, the facts beside it, a chart of its trend or its parts, the lines behind it, and the
 * screen that goes deeper.
 */
export type FigureDetail = {
  /** What kind of figure it is, over its name: "Risk measure", "Fees", "Private markets". */
  label: string;
  /** The figure as the screen shows it. */
  value?: string;
  /** How the figure is worked out, or what it is read from. */
  note?: string;
  /** A few figures beside it: its limit, its benchmark, its period. */
  facts?: { label: string; value: string }[];
  /** Its trend, or its parts, drawn as the screen's charts are. */
  chart?: { title: string; data: ChartData; kind: ChartKind; format: "money" | "percent" | "points" | "number"; currency?: string };
  /** The lines behind it. A cell that is a number is set right. */
  table?: {
    title?: string;
    columns: string[];
    rows: (string | number | null)[][];
    total?: (string | number | null)[];
    /** Where each line opens, by its place: a client's workspace, say. None, or null for a line, opens nothing. */
    links?: (string | null)[];
  };
  /**
   * The screen that goes deeper: by its path under the client ("risk", "performance") inside a client's workspace,
   * or a whole address ("/drift") from anywhere else.
   */
  link?: { to: string; label: string };
  /** Anything more the screen's own data cannot carry here, such as a model's clients read when the panel opens. */
  more?: ReactNode;
};

function formatter(kind: NonNullable<FigureDetail["chart"]>["format"], currency = "USD") {
  return (value: number) => {
    if (kind === "percent") return `${value.toFixed(1)}%`;
    if (kind === "points") return `${value > 0 ? "+" : ""}${value.toFixed(0)}`;
    if (kind === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(value);
    } catch {
      return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
  };
}

function cell(value: string | number | null) {
  if (value == null) return "—";
  return typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : value;
}

/** The panel's body for a figure: laid out as the other breakdowns are, from what the screen handed it. */
export function FigureBody({ customerId, figure, wide }: { customerId?: string; figure: FigureDetail; wide: boolean }) {
  const deeper = figure.link
    ? figure.link.to.startsWith("/") ? figure.link.to : `/client-workspace/${customerId ?? ""}/${figure.link.to}`
    : null;
  return (
    <div className="space-y-6">
      {(figure.value || figure.note) && (
        <div>
          {figure.value && <p className="text-3xl font-bold tabular-nums">{figure.value}</p>}
          {figure.note && <p className="mt-1 text-sm text-ink-muted">{figure.note}</p>}
        </div>
      )}

      {figure.link && deeper && (
        <Link to={deeper ?? "/"}
          className="inline-flex h-9 items-center rounded-xl bg-primary-600 px-4 text-sm font-semibold text-on-accent hover:bg-primary-700">
          {figure.link.label} →
        </Link>
      )}

      {figure.facts && figure.facts.length > 0 && (
        <dl className={wide ? "grid grid-cols-4 gap-3" : "grid grid-cols-2 gap-3"}>
          {figure.facts.map((one) => (
            <div key={one.label} className="rounded-xl border border-line px-4 py-3">
              <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{one.label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{one.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {figure.chart && (
        <section>
          <h3 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">{figure.chart.title}</h3>
          <KindChart data={figure.chart.data} kind={figure.chart.kind} format={formatter(figure.chart.format, figure.chart.currency)}
            height={wide ? 280 : 220} label={figure.chart.title} />
        </section>
      )}

      {figure.table && figure.table.rows.length > 0 && (
        <section>
          {figure.table.title && <h3 className="mb-2 text-2xs font-semibold tracking-wider text-ink-muted uppercase">{figure.table.title}</h3>}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-muted uppercase">
                  {figure.table.columns.map((name, index) => (
                    <th key={name} scope="col" className={index === 0 ? "py-2.5 pr-3 pl-4" : "px-3 py-2.5 text-right"}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {figure.table.rows.map((row, at) => {
                  const to = figure.table?.links?.[at] ?? null;
                  return (
                    <tr key={at} className={to ? "hover:bg-canvas" : undefined}>
                      {row.map((value, index) => (
                        <td key={index} className={index === 0 ? "py-2 pr-3 pl-4 font-medium" : "px-3 py-2 text-right whitespace-nowrap tabular-nums"}>
                          {index === 0 && to
                            ? <Link to={to} className="text-primary-700 hover:underline">{cell(value)}</Link>
                            : cell(value)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              {figure.table.total && (
                <tfoot>
                  <tr className="border-t-2 border-line font-bold">
                    {figure.table.total.map((value, index) => (
                      <td key={index} className={index === 0 ? "py-2.5 pr-3 pl-4" : "px-3 py-2.5 text-right whitespace-nowrap tabular-nums"}>
                        {cell(value)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {figure.more}
    </div>
  );
}
