import type { ValuationPoint } from "@atomprive/api-client/backoffice";
import { formatDate } from "../../lib/labels";
import type { FigureDetail } from "../client-workspace/figure-panel";
import { nameOf } from "./asset-classes";

/** Money as a statement writes it: grouped thousands, two decimal places. */
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * One day on file as the side panel shows it: what it was worth, split by asset class, and each sub-asset the
 * day kept inside its class. A class the day kept no lines for is one line of its own.
 */
export function valuationDayFigure(point: ValuationPoint, currency: string, names: Record<string, string>, label = "Day on file"): FigureDetail {
  const whole = point.underManagement;
  const share = (value: number) => (whole === 0 ? "—" : `${((value / whole) * 100).toFixed(2)}%`);
  const classes = Object.entries(point.holdings ?? {}).filter(([, value]) => Math.abs(value) > 0.005).sort(([, a], [, b]) => b - a);
  const rows = classes.flatMap(([code, value]) => {
    const inside = Object.entries(point.lines?.[code] ?? {}).sort(([, a], [, b]) => b - a);
    return inside.length
      ? inside.map(([line, worth]) => [line, nameOf(code, names), money(worth, currency), share(worth)])
      : [[nameOf(code, names), nameOf(code, names), money(value, currency), share(value)]];
  });
  return {
    label,
    value: money(whole, currency),
    note: point.asRecorded
      ? `Recorded as ${money(point.asRecorded.underManagement, point.asRecorded.currency)} and converted at that day's rate.`
      : "What the portfolio was worth on the day, by asset class and sub-asset.",
    facts: [
      { label: "Day", value: formatDate(point.valuedOn) },
      { label: "Classes", value: String(classes.length) },
    ],
    chart: classes.length
      ? { title: "By asset class", data: { shape: "shares", items: classes.map(([code, value]) => ({ name: nameOf(code, names), value })) }, kind: "donut", format: "money", currency }
      : undefined,
    table: rows.length ? { title: "What it held", columns: ["Holding", "Asset class", "Worth", "Share"], rows, total: ["Total", "", money(whole, currency), "100%"] } : undefined,
  };
}
