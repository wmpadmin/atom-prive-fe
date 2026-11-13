import type { ExportColumn, ExportRow, ExportSheet, ReportBar, ReportFigure, ReportPair, ReportPanel } from "@atomprive/api-client/backoffice";
import { getBookScreenExportUrl, getBookScreenReportUrl, getClientScreenReportUrl, getExportClientOverviewUrl } from "@atomprive/api-client/backoffice";
import { Button, cn } from "@atomprive/ui";
import * as echarts from "echarts/core";
import { ChevronDown, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { saveApiPost } from "../../lib/download";

/**
 * Report on a client's screen, as PDF or Excel: what the screen shows, in the reader's own cards, order and chart
 * types, read off the page as drawn — the figures are not worked out again, so the file cannot disagree with the
 * screen. The server lays the PDF out on the firm's letterhead and writes the workbook, and puts both on the audit
 * trail.
 *
 * <p>Each card on the screen carries `data-report-card` (set by the layout grid). From it are read: key figures (a
 * `data-figure-strip`'s tiles, or one `data-figure`), each chart's figures from the chart itself, each table as
 * it stands, and otherwise the card's lines as label and value.
 */
export function ReportButton() {
  const { customerId = "" } = useParams();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  async function run(kind: "pdf" | "excel") {
    setOpen(false);
    setProblem(null);
    setBusy(kind);
    try {
      const read = readScreen(box.current);
      if (read.panels.length === 0 && read.figures.length === 0) throw new Error("There is nothing on this screen to report yet.");
      const day = new Date().toISOString().slice(0, 10);
      // A client's screen is reported as theirs; a screen of the whole book (no client in view) as the book's.
      const book = !customerId;
      const name = (book ? `${read.screen} — ${day}` : `${read.client} — ${read.screen} — ${day}`).replace(/[\\/:*?"<>|]/g, " ");
      if (kind === "pdf") {
        await saveApiPost(book ? getBookScreenReportUrl() : getClientScreenReportUrl(customerId), {
          screen: read.screen, status: null, subtitle: read.subtitle, asOf: read.asOf,
          figures: read.figures.slice(0, 24),
          panels: (read.panels.length ? read.panels : [{ ...EMPTY, title: "Key figures", pairs: [] }]).slice(0, 40),
        }, `${name}.pdf`);
      } else {
        await saveApiPost(book ? getBookScreenExportUrl() : getExportClientOverviewUrl(customerId), {
          tab: read.screen, about: [read.subtitle, read.asOf].filter(Boolean).slice(0, 8), sheets: sheetsOf(read).slice(0, 20),
        }, `${name}.xlsx`);
      }
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "The report could not be made.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={box} data-report-ignore className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((now) => !now)} aria-haspopup="menu" aria-expanded={open} disabled={busy !== null}>
        <FileDown aria-hidden="true" />
        {busy ? "Preparing…" : "Report"}
        <ChevronDown aria-hidden="true" className={cn("transition", open && "rotate-180")} />
      </Button>
      {open && (
        <div role="menu" aria-label="Report" className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <ReportItem icon={FileText} tone="text-red-600" label="Download PDF" lead="On the firm's letterhead, ready to print" onClick={() => void run("pdf")} />
          <ReportItem icon={FileSpreadsheet} tone="text-emerald-600" label="Download Excel" lead="One sheet per card, figures as numbers" onClick={() => void run("excel")} />
          <p className="px-2.5 pt-1.5 pb-1 text-2xs text-ink-muted">The cards on your screen, as you have them. Recorded in the audit log.</p>
        </div>
      )}
      {problem && <p role="alert" className="absolute top-full right-0 mt-1.5 w-64 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{problem}</p>}
    </div>
  );
}

function ReportItem({ icon: Icon, tone, label, lead, onClick }: { icon: typeof FileText; tone: string; label: string; lead: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-canvas">
      <Icon className={cn("mt-0.5 size-4.5 shrink-0", tone)} aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-muted">{lead}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Reading the screen                                                                                            */

const EMPTY: Omit<ReportPanel, "title" | "place"> = { pairs: [], bars: [], columns: [], rows: [], alignRight: [] };

/** One panel and, for Excel, the figures behind it as numbers where the screen holds them. */
type Read = { panel: ReportPanel; sheet: { columns: ExportColumn[]; rows: (string | number | null)[][] } };

type Screen = { screen: string; client: string; subtitle: string; asOf: string; figures: ReportFigure[]; panels: ReportPanel[]; sheets: { name: string; read: Read }[] };

/** Everything the screen holding this element shows, read as the report and the workbook take it. */
function readScreen(from: HTMLElement | null): Screen {
  const main = from?.closest("main") ?? document.querySelector("main") ?? document.body;
  const heading = main.querySelector("h1");
  const header = heading?.closest("header") ?? heading?.parentElement;
  const said = [...(header?.querySelectorAll("p") ?? [])].filter((one) => !one.closest("[data-report-ignore]")).map(text);
  const crumbs = (said.find((one) => one.includes(" / ")) ?? "").split(" / ");
  // The breadcrumb ends with the client and the screen ("… / Rohan D. Family / Client Overview"); the heading is
  // the screen's own, except on a client's overview, which is headed with their name.
  const named = text(heading) || "Report";
  const client = crumbs.length >= 3 ? crumbs[crumbs.length - 2]! : named;
  const screen = crumbs.length >= 3 ? crumbs[crumbs.length - 1]! : named;
  const lead = said.filter((one) => one && !one.includes(" / "));
  const footer = text(main.querySelector("footer span"));
  const figures: ReportFigure[] = [];
  const panels: ReportPanel[] = [];
  const sheets: Screen["sheets"] = [];

  for (const card of main.querySelectorAll<HTMLElement>("[data-report-card]")) {
    const title = text(card.querySelector("h2, h3")) || card.dataset.reportTitle || "Card";
    const place = card.dataset.reportWide === "true" ? "BOTTOM" : "LEFT";
    // Key figures: tiles of a strip, or one figure on its own.
    const strips = [...card.querySelectorAll<HTMLElement>("[data-figure-strip], [data-figure]")];
    for (const strip of strips) {
      const tiles = strip.hasAttribute("data-figure") ? [strip] : [...strip.children].filter((one): one is HTMLElement => one instanceof HTMLElement);
      for (const tile of tiles) {
        const lines = linesOf(tile);
        if (lines.length >= 1) figures.push({ label: clip(lines[0]!, 60), value: lines[1] ? clip(lines[1], 60) : null, note: lines.length > 2 ? clip(lines.slice(2).join(" · "), 80) : null, change: null });
      }
    }
    const reads: Read[] = [];
    for (const chart of card.querySelectorAll<HTMLElement>("[role=img]")) {
      const instance = echarts.getInstanceByDom(chart);
      const read = instance ? fromChart(instance.getOption() as Option) : null;
      if (read) reads.push(read);
    }
    const charted = reads.length > 0;
    for (const table of card.querySelectorAll<HTMLTableElement>("table")) {
      // A table with no headings beside a chart is the chart's legend: the chart already gave its figures.
      if (table.closest("[data-figure-strip]") || (charted && !table.tHead)) continue;
      const read = fromTable(table);
      if (read) reads.push(read);
    }
    if (reads.length === 0 && strips.length === 0) {
      const read = fromLines(card, title);
      if (read) reads.push(read);
    }
    reads.forEach((read, at) => {
      const named = reads.length > 1 ? `${title} · ${at + 1}` : title;
      const panel = { ...read.panel, title: clip(named, 60), place } as ReportPanel;
      panels.push(panel);
      sheets.push({ name: named, read });
    });
  }
  return {
    screen: clip(screen, 60), client, subtitle: clip(lead[0] ?? "", 300), asOf: clip(footer, 120),
    figures, panels, sheets,
  };
}

type Option = {
  series?: { type?: string; name?: string; silent?: boolean; data?: unknown[] }[];
  xAxis?: { type?: string; data?: unknown[] }[];
  yAxis?: { type?: string; data?: unknown[] }[];
  radar?: { indicator?: { name?: string }[] }[];
  tooltip?: { valueFormatter?: (value: number) => string }[];
};

/** A chart's own figures: parts of a whole as bars, anything over categories as a table. */
function fromChart(option: Option): Read | null {
  const format = option.tooltip?.find((one) => typeof one?.valueFormatter === "function")?.valueFormatter ?? plainNumber;
  const series = (option.series ?? []).filter((one) => !one.silent);
  if (series.length === 0) return null;
  const first = series[0]!;
  const valued = (one: unknown) => (typeof one === "number" ? one : typeof one === "object" && one && "value" in one ? Number((one as { value: unknown }).value) : Number(one));
  const named = (one: unknown, at: number) => (typeof one === "object" && one && "name" in one ? String((one as { name: unknown }).name) : `Item ${at + 1}`);

  // Parts of a whole: a pie, a funnel, a treemap, or the branches of a mind map.
  if (["pie", "funnel", "treemap", "tree"].includes(first.type ?? "")) {
    const items = (first.type === "tree" ? ((first.data?.[0] as { children?: unknown[] })?.children ?? []) : (first.data ?? []))
      .map((one, at) => ({ name: named(one, at), value: valued(one) })).filter((one) => Number.isFinite(one.value));
    if (items.length === 0) return null;
    const total = items.reduce((sum, one) => sum + Math.abs(one.value), 0) || 1;
    const bars: ReportBar[] = items.slice(0, 30).map((one) => ({ label: clip(one.name, 60), share: round((Math.abs(one.value) / total) * 100), amount: clip(format(one.value), 40) }));
    return {
      panel: { ...EMPTY, title: "", place: "LEFT", bars },
      sheet: { columns: [col("Item"), col("Value", "NUMBER"), col("Share", "PERCENT")], rows: items.map((one) => [one.name, round(one.value), round((Math.abs(one.value) / total) * 100)]) },
    };
  }
  if (first.type === "gauge") {
    const one = first.data?.[0];
    return { panel: { ...EMPTY, title: "", place: "LEFT", pairs: [{ label: clip(named(one, 0), 60), value: clip(format(valued(one)), 300), tone: "PLAIN" }] },
      sheet: { columns: [col("Figure"), col("Value", "NUMBER")], rows: [[named(one, 0), round(valued(one))]] } };
  }
  // Anything over categories: the categories down the side, a column per series.
  const axis = option.xAxis?.find((one) => one?.type === "category") ?? option.yAxis?.find((one) => one?.type === "category");
  const categories = (axis?.data ?? []).map((one) => (typeof one === "object" && one && "value" in one ? String((one as { value: unknown }).value) : String(one)));
  if (categories.length === 0) {
    if (first.type === "scatter") {
      const points = series.flatMap((one) => (one.data ?? []).map((item, at) => ({ name: named(item, at), value: (item as { value?: number[] }).value ?? (Array.isArray(item) ? (item as number[]) : []) })));
      const width = Math.max(2, ...points.map((one) => one.value.length));
      // Named after the chart's own axes where it names them.
      const axes = [(option.xAxis?.[0] as { name?: string } | undefined)?.name, (option.yAxis?.[0] as { name?: string } | undefined)?.name, "Size"];
      const heads = ["", ...Array.from({ length: width }, (_, at) => axes[at] || `Value ${at + 1}`)];
      return tableRead(heads, points.map((one) => [one.name, ...Array.from({ length: width }, (_, at) => (Number.isFinite(one.value[at]) ? one.value[at]! : null))]), plainNumber);
    }
    if (first.type === "radar") {
      const names = (option.radar?.[0]?.indicator ?? []).map((one) => one.name ?? "");
      const rows = names.map((name, at) => [name, ...series.flatMap((one) => (one.data ?? []).map((item) => (item as { value?: number[] }).value?.[at] ?? null))]);
      const heads = ["", ...series.flatMap((one) => (one.data ?? []).map((item, at) => named(item, at)))];
      return tableRead(heads, rows, format);
    }
    return null;
  }
  const heads = ["", ...series.map((one, at) => one.name || `Series ${at + 1}`)];
  const rows = categories.map((category, at) => [category, ...series.map((one) => {
    const value = valued(one.data?.[at]);
    return Number.isFinite(value) ? value : null;
  })]);
  return tableRead(heads, rows, format);
}

function tableRead(heads: string[], rows: (string | number | null)[][], format: (value: number) => string): Read {
  const columns = heads.slice(0, 12).map((one, at) => clip(one || (at === 0 ? "Item" : `Column ${at + 1}`), 60));
  return {
    panel: {
      ...EMPTY, title: "", place: "LEFT", columns,
      rows: rows.slice(0, 300).map((row) => row.slice(0, 12).map((cell) => (cell == null ? "—" : typeof cell === "number" ? clip(format(cell), 300) : clip(cell, 300)))),
      alignRight: columns.map((_, at) => at).filter((at) => at > 0),
    },
    sheet: { columns: columns.map((one, at) => col(one, at === 0 ? "TEXT" : "NUMBER")), rows: rows.map((row) => row.slice(0, 12).map((cell) => (typeof cell === "number" ? round(cell) : cell))) },
  };
}

/** A table as it stands: its headings and rows, the figures right-aligned and, for Excel, read back as numbers. */
function fromTable(table: HTMLTableElement): Read | null {
  const head = [...(table.tHead?.rows[0]?.cells ?? [])].map(text);
  const body = [...table.tBodies].flatMap((one) => [...one.rows]).map((row) => [...row.cells].map(cellText)).filter((row) => row.some(Boolean));
  if (body.length === 0) return null;
  const width = Math.min(12, Math.max(head.length, ...body.map((row) => row.length)));
  const columns = Array.from({ length: width }, (_, at) => clip(head[at] || (at === 0 ? "Item" : `Column ${at + 1}`), 60));
  const numeric = columns.map((_, at) => body.filter((row) => row[at]).every((row) => numberOf(row[at]!) != null) && body.some((row) => row[at]));
  return {
    panel: { ...EMPTY, title: "", place: "LEFT", columns, rows: body.slice(0, 300).map((row) => columns.map((_, at) => clip(row[at] ?? "", 300))), alignRight: numeric.flatMap((yes, at) => (yes ? [at] : [])) },
    sheet: {
      columns: columns.map((one, at) => col(one, numeric[at] ? (percentColumn(body, at) ? "PERCENT" : "NUMBER") : "TEXT")),
      rows: body.map((row) => columns.map((_, at) => (numeric[at] ? numberOf(row[at] ?? "") : row[at] ?? ""))),
    },
  };
}

/**
 * A card of lines (shares drawn in the page's own markup, status rows, links, a log). Each line is a name and what
 * follows it; where every line carries an amount (or a share), the card is a whole in parts and prints as bars, as
 * a chart of it would.
 */
function fromLines(card: HTMLElement, title: string): Read | null {
  const header = card.querySelector("h2, h3")?.parentElement;
  const skip = new Set([title, text(header?.querySelector("p"))].filter(Boolean));
  const listed = [...card.querySelectorAll<HTMLElement>("li, [role=row], dl > div, dl > a")];
  const tiles = tilesOf(card, header);
  // Tiles that each hold a small list of their own (a family and its figures) are the items, not those lists.
  const items = tiles.length >= 2 && listed.length > 0 && tiles.every((tile) => listed.some((one) => tile.contains(one))) ? tiles
    : listed.length ? listed : tiles;
  let groups: { label: string; values: string[] }[];
  if (items.length) {
    // An avatar's initials are not the item's name.
    groups = items.map((one) => linesOf(one).filter((line) => !/^[A-Z]{1,2}$/.test(line))).filter((one) => one.length > 0)
      .map((one) => ({ label: one[0]!, values: one.slice(1) }));
  } else {
    // A name, then the figures that belong to it, until the next name.
    groups = [];
    for (const line of linesOf(card).filter((one) => !skip.has(one))) {
      const last = groups[groups.length - 1];
      if (numberOf(line) != null && last) last.values.push(line);
      else groups.push({ label: line, values: [] });
    }
  }
  groups = groups.filter((one) => !skip.has(one.label));
  if (groups.length === 0) return null;

  // An amount of money (a currency, or K / M / B), not a ratio or a count, is what a whole is made of.
  const amountOf = (values: string[]) => values.find((one) => numberOf(one) != null && !one.trim().endsWith("%") && /[$€£₹¥]|\b[A-Z]{3}\b|\d[KMB]$/.test(one.trim()));
  const shareOf = (values: string[]) => values.find((one) => one.trim().endsWith("%") && numberOf(one) != null);
  // Parts of a whole are a name with its amount and share, no more: a line carrying more is a record, not a part.
  if (groups.length >= 2 && groups.every((one) => one.values.length <= 2 && (amountOf(one.values) || shareOf(one.values)))) {
    const amounts = groups.map((one) => numberOf(amountOf(one.values) ?? "") ?? 0);
    const total = amounts.reduce((sum, one) => sum + Math.abs(one), 0);
    const shares = groups.map((one, at) => {
      const said = shareOf(one.values);
      return said ? numberOf(said)! : total > 0 ? (Math.abs(amounts[at]!) / total) * 100 : 0;
    });
    const bars: ReportBar[] = groups.slice(0, 30).map((one, at) => ({ label: clip(one.label, 60), share: round(shares[at]!), amount: amountOf(one.values) ? clip(amountOf(one.values)!, 40) : null }));
    return {
      panel: { ...EMPTY, title: "", place: "LEFT", bars },
      sheet: { columns: [col("Item"), col("Value", "NUMBER"), col("Share", "PERCENT")], rows: groups.map((one, at) => [one.label, amountOf(one.values) ? round(amounts[at]!) : null, round(shares[at]!)]) },
    };
  }
  // A line with nothing after it is written in full on the right, so a long one wraps rather than running over.
  const pairs: ReportPair[] = groups.slice(0, 40).map((one) => (one.values.length
    ? { label: clip(one.label, 60), value: clip(one.values.join(" · "), 300), tone: "PLAIN" as const }
    : { label: "•", value: clip(one.label, 300), tone: "PLAIN" as const }));
  return { panel: { ...EMPTY, title: "", place: "LEFT", pairs }, sheet: { columns: [col("Item"), col("Value")], rows: pairs.map((one) => [one.label, one.value ?? ""]) } };
}

/**
 * A card drawn as tiles (a heading, a figure and a line in each) rather than as a list: the container whose children
 * all carry two lines or more, the most of them — each child is one item.
 */
function tilesOf(card: HTMLElement, header: Element | null | undefined): HTMLElement[] {
  let best: HTMLElement[] = [];
  for (const box of card.querySelectorAll<HTMLElement>("div, ul, section")) {
    if (header?.contains(box)) continue;
    const kids = [...box.children].filter((one): one is HTMLElement => one instanceof HTMLElement && linesOf(one).length >= 2);
    if (kids.length >= 2 && kids.length === box.children.length && kids.length > best.length) best = kids;
  }
  return best;
}

/** The workbook: the key figures first, then a sheet a card. */
function sheetsOf(read: Screen): ExportSheet[] {
  const sheets: ExportSheet[] = [];
  if (read.figures.length) {
    sheets.push({ name: "Key figures", columns: [col("Figure"), col("Value"), col("Note")], rows: read.figures.map((one) => row([one.label, one.value ?? "", one.note ?? ""])) });
  }
  for (const one of read.sheets) {
    sheets.push({ name: clip(one.name, 60), columns: one.read.sheet.columns, rows: one.read.sheet.rows.map((cells) => row(cells)) });
  }
  return sheets;
}

/* ------------------------------------------------------------------------------------------------------------ */

function text(element: Element | null | undefined) {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A cell as read on screen: its lines once each, side by side — a name and the line under it, not run together. */
function cellText(cell: HTMLElement) {
  const lines = [...new Set(linesOf(cell))];
  // An avatar's initials before a name are not part of it.
  const said = lines.length > 1 ? lines.filter((one) => !/^[A-Z]{1,2}$/.test(one)) : lines;
  return said.join(" · ");
}

function linesOf(element: HTMLElement) {
  return (element.innerText || element.textContent || "").split("\n").map((one) => one.trim()).filter(Boolean);
}

/** What the letterhead's fonts can print: a true minus, ≤ and arrows written plainly. */
function printable(value: string) {
  return value.replace(/[−–—]/g, "-").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/▲|↑/g, "+").replace(/▼|↓/g, "-")
    .replace(/→/g, "->").replace(/←/g, "<-").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function clip(value: string, most: number) {
  const plain = printable(value);
  return plain.length > most ? `${plain.slice(0, most - 3)}...` : plain;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function plainNumber(value: number) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function col(label: string, kind: ExportColumn["kind"] = "TEXT"): ExportColumn {
  return { label, kind };
}

function row(cells: (string | number | null | undefined)[]): ExportRow {
  return { cells: cells.map((one) => (one == null ? "" : typeof one === "number" ? String(one) : one)), level: 0, strong: false };
}

/** "$1.42M", "−3.2%", "1,204", "+0.6 pp" as a number; null for words. Compact amounts come back as the screen rounded them. */
function numberOf(value: string): number | null {
  const cleaned = value.replace(/[−–]/g, "-").replace(/[,\s]/g, "").replace(/^[A-Z]{3}|[A-Z]{3}$/g, "").replace(/[$€£₹¥]|pp$|bps$/gi, "");
  const match = /^([+-]?\d+(?:\.\d+)?)([KMBT%×x])?$/i.exec(cleaned);
  if (!match) return null;
  const scale: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const unit = match[2]?.toUpperCase();
  return Number(match[1]) * (unit && scale[unit] ? scale[unit]! : 1);
}

function percentColumn(rows: string[][], at: number) {
  return rows.filter((row) => row[at]).every((row) => row[at]!.trim().endsWith("%"));
}
