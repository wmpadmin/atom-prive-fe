/**
 * How the Security master shows a cell: as the file sent it, in the template's own units — a percentage in percent
 * points, a spread in bp, a (mn) column in millions. A number gets the decimals the template asks for (Last Price to
 * 2), never fewer than it was sent with, and the thousands grouped; a date is written the reader's way.
 */

/** The four asset classes, in the template's order, with the tone each is tagged in. */
export const ASSET_CLASSES = [
  { id: "EQUITY", label: "Equity", tone: "bg-primary-50 text-primary-700" },
  { id: "FIXED_INCOME", label: "Fixed Income", tone: "bg-emerald-50 text-emerald-700" },
  { id: "EQUITY_ETF", label: "Equity ETF", tone: "bg-violet-50 text-violet-700" },
  { id: "FIXED_INCOME_ETF", label: "Fixed Income ETF", tone: "bg-amber-50 text-amber-800" },
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number]["id"];

export function assetClassLabel(id: string | undefined): string {
  return ASSET_CLASSES.find((one) => one.id === id)?.label ?? id ?? "";
}

const NUMERIC = new Set(["NUMBER", "PERCENT", "MILLIONS", "INTEGER"]);

/** Whether a column's values line up on the right, as numbers do. */
export function isNumeric(type: string): boolean {
  return NUMERIC.has(type);
}

/** A cell for the screen, or null when the file left it blank. */
export function cellText(column: { key: string; type: string; decimals: number | null },
  value: string | undefined, day: (iso: string) => string): string | null {
  if (value == null || value === "") return null;
  if (column.key === "asset_class") return assetClassLabel(value);
  if (column.type === "DATE") return day(value);
  if (!isNumeric(column.type)) return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const sent = value.includes(".") ? value.split(".")[1]!.length : 0;
  const decimals = Math.max(column.type === "INTEGER" ? 0 : (column.decimals ?? 0), sent);
  return number.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Whether a column applies to a security's asset class; one that does not is left blank, with no "—" in it. */
export function applies(column: { appliesTo: string[] }, assetClass: string | undefined): boolean {
  return assetClass == null || column.appliesTo.includes(assetClass);
}

/** The template's bands (row 1) over the columns: each run of columns sharing a category, in order. */
export function bands<T extends { category: string }>(columns: T[]): { category: string; span: number }[] {
  const out: { category: string; span: number }[] = [];
  for (const column of columns) {
    const last = out[out.length - 1];
    if (last && last.category === column.category) last.span += 1;
    else out.push({ category: column.category, span: 1 });
  }
  return out;
}
