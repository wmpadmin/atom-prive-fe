import type { ExportColumn, ReportPanel } from "@atomprive/api-client/backoffice";
import { getListExportUrl, getListReportUrl } from "@atomprive/api-client/backoffice";
import { useState } from "react";
import { saveApiPost } from "../../lib/download";
import { clip, numberOf, ReportMenu } from "./report";

/** The most rows the PDF prints; the workbook takes up to {@link SHEET_ROWS} × {@link SHEETS}. */
const PDF_ROWS = 5_000;
const PANEL_ROWS = 300;
const SHEET_ROWS = 5_000;
const SHEETS = 20;

/**
 * Report on a whole list — every page, as filtered — as PDF or Excel. The rows are the list's own export (the CSV the
 * server already makes, with its permission check and filters), so the file holds exactly what Export held; the
 * server lays it out on the letterhead or in a workbook and puts it on the audit trail.
 *
 * <p>`columns` names the headings the PDF keeps, in that order, when the export has more than a page can hold
 * (twelve at most); Excel always takes every column.
 */
export function ListReportButton({ list, load, filters, columns }: {
  list: string;
  /** The list's export, as CSV text. */
  load: () => Promise<string>;
  /** What the list is filtered to, said in a line — "Status: Active · Search: rahul". */
  filters?: string;
  columns?: string[];
}) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(kind: "pdf" | "excel") {
    setProblem(null);
    setBusy(kind);
    try {
      const [head = [], ...body] = parseCsv(await load()).filter((row) => row.some((cell) => cell.trim()));
      if (head.length === 0 || body.length === 0) throw new Error("There is nothing in this list to report.");
      const day = new Date().toISOString().slice(0, 10);
      const name = `${list} — ${day}`.replace(/[\\/:*?"<>|]/g, " ");
      const counted = `${body.length.toLocaleString("en-GB")} ${body.length === 1 ? "row" : "rows"}`;
      const numeric = head.map((_, at) => body.some((row) => row[at]?.trim()) && body.every((row) => !row[at]?.trim() || figure(row[at]!) != null));
      if (kind === "pdf") {
        const keep = pdfColumns(head, columns);
        const rows = body.slice(0, PDF_ROWS).map((row) => keep.map((at) => clip(row[at] ?? "", 300)));
        const panels: ReportPanel[] = [];
        for (let from = 0; from < rows.length; from += PANEL_ROWS) {
          panels.push({
            title: clip(rows.length > PANEL_ROWS ? `Rows ${from + 1}–${Math.min(from + PANEL_ROWS, rows.length)}` : list, 60), place: "BOTTOM",
            pairs: [], bars: [], columns: keep.map((at) => clip(head[at] || `Column ${at + 1}`, 60)), rows: rows.slice(from, from + PANEL_ROWS),
            alignRight: keep.flatMap((at, place) => (numeric[at] ? [place] : [])),
          });
        }
        const cut = body.length > PDF_ROWS ? ` · first ${PDF_ROWS.toLocaleString("en-GB")} printed, Excel has all` : "";
        await saveApiPost(getListReportUrl(), {
          screen: clip(list, 60), status: null, subtitle: clip(filters || "The whole list, every page.", 300), asOf: clip(counted + cut, 120),
          figures: [], panels,
        }, `${name}.pdf`);
      } else {
        const width = Math.min(head.length, 30);
        const kinds: ExportColumn[] = head.slice(0, width).map((label, at) => ({ label: clip(label || `Column ${at + 1}`, 120), kind: numeric[at] ? "NUMBER" : "TEXT" }));
        const sheets = [];
        for (let from = 0; from < body.length && sheets.length < SHEETS; from += SHEET_ROWS) {
          sheets.push({
            name: clip(body.length > SHEET_ROWS ? `${list} ${sheets.length + 1}` : list, 80), columns: kinds,
            rows: body.slice(from, from + SHEET_ROWS).map((row) => ({
              cells: kinds.map((_, at) => (numeric[at] && row[at]?.trim() ? String(figure(row[at]!)) : clip(row[at] ?? "", 500))), level: 0, strong: false,
            })),
          });
        }
        await saveApiPost(getListExportUrl(), { tab: clip(list, 80), about: [filters || "The whole list, every page.", counted].map((one) => clip(one, 300)), sheets }, `${name}.xlsx`);
      }
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "The report could not be made.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ReportMenu busy={busy} problem={problem} onPick={(kind) => void run(kind)}
      excel="Every column, figures as numbers" />
  );
}

/** What a list is filtered to, said in a line: the filters that are set, by name — or nothing when none is. */
export function saidFilters(set: Record<string, string | null | undefined>) {
  const said = Object.entries(set).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => `${label}: ${/^[A-Z0-9_]+$/.test(value) ? sentence(value) : value}`);
  return said.length ? `Filtered — ${said.join(" · ")}` : undefined;
}

/** A code as words: "PORTFOLIO_MANAGER" as "Portfolio manager". */
function sentence(code: string) {
  const words = code.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A cell as a figure, where it is written as one ("1,204", "-3.5", "12%"); null for anything else — a phone number
 * ("+971 50 …"), a code with leading zeros, a date — which stays as written.
 */
function figure(value: string) {
  const plain = value.trim();
  return /^-?(0|[1-9]\d{0,2}(,\d{3})*|[1-9]\d*)(\.\d+)?%?$/.test(plain) ? numberOf(plain) : null;
}

/** Which columns the PDF prints: the named ones where given, otherwise the first twelve. */
function pdfColumns(head: string[], wanted?: string[]) {
  const named = (wanted ?? []).map((one) => head.findIndex((label) => label.trim().toLowerCase() === one.toLowerCase())).filter((at) => at >= 0);
  return (named.length ? named : head.map((_, at) => at)).slice(0, 12);
}

/** CSV as the server writes it (RFC 4180): quoted cells may hold commas, quotes doubled, and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let at = 0; at < source.length; at++) {
    const char = source[at]!;
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') { cell += '"'; at++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[at + 1] === "\n") at++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
