import { httpFile } from "@atomprive/api-client";
import type { ExportColumn, ExportSheet, ReportPanel } from "@atomprive/api-client/portal";
import { getOwnExportUrl, getOwnReportUrl } from "@atomprive/api-client/portal";
import { useState } from "react";
import { ExportMenu } from "./holdings-page";

/** One part of a screen as the report takes it: label and value lines, parts of a whole, or a table. */
export type Section = { title: string; wide?: boolean } & (
  | { pairs: [string, string][] }
  | { parts: { label: string; value: number }[]; format: (value: number) => string }
  | { head: string[]; rows: (string | number | null)[][]; format?: (value: number) => string }
);

/** A screen as the report takes it: what it is, its key figures, then its sections in the order shown. */
export type Report = { screen: string; subtitle: string; figures: { label: string; value: string; note?: string }[]; sections: Section[] };

const PANEL_ROWS = 300;

/**
 * Export on a portal screen, as PDF or Excel: the screen's own figures, as it holds them, sent to be laid out on the
 * firm's letterhead or in a workbook — not worked out again, so the file cannot disagree with the screen. Each file
 * is recorded as the client's own in the firm's audit log.
 */
export function ReportExport({ build }: { build: () => Report | null }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(format: "pdf" | "xlsx") {
    const report = build();
    if (!report) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = format === "pdf" ? pdfOf(report) : excelOf(report);
      const blob = await httpFile(format === "pdf" ? getOwnReportUrl() : getOwnExportUrl(), {
        method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${report.screen} ${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      // Revoking straight away can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(href), 1_000);
    } catch {
      setProblem("The file could not be made. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <ExportMenu formats={["pdf", "xlsx"]} busy={busy} onPick={(format) => void run(format as "pdf" | "xlsx")} />
      {problem && <p role="alert" className="absolute top-full right-0 z-30 mt-2 w-56 rounded-lg bg-access-none-bg px-3 py-2 text-xs text-access-none-ink">{problem}</p>}
    </div>
  );
}

function pdfOf(report: Report) {
  const panels: ReportPanel[] = [];
  for (const section of report.sections) {
    const base = { title: clip(section.title, 60), place: section.wide ? "BOTTOM" : "LEFT", pairs: [], bars: [], columns: [], rows: [], alignRight: [] } as ReportPanel;
    if ("pairs" in section) {
      panels.push({ ...base, pairs: section.pairs.slice(0, 40).map(([label, value]) => ({ label: clip(label || "•", 60), value: clip(value, 300), tone: "PLAIN" })) });
    } else if ("parts" in section) {
      const total = section.parts.reduce((sum, one) => sum + Math.abs(one.value), 0) || 1;
      panels.push({ ...base, bars: section.parts.slice(0, 30).map((one) => ({ label: clip(one.label, 60), share: round((Math.abs(one.value) / total) * 100), amount: clip(section.format(one.value), 40) })) });
    } else {
      const format = section.format ?? plain;
      const width = Math.min(section.head.length, 12);
      const numeric = section.head.slice(0, width).map((_, at) => section.rows.some((row) => typeof row[at] === "number"));
      const rows = section.rows.map((row) => row.slice(0, width).map((cell) => clip(cell == null ? "" : typeof cell === "number" ? format(cell) : cell, 300)));
      for (let from = 0; from < Math.max(rows.length, 1) && panels.length < 40; from += PANEL_ROWS) {
        panels.push({
          ...base, title: clip(from === 0 ? section.title : `${section.title} (continued)`, 60), place: "BOTTOM",
          columns: section.head.slice(0, width).map((one) => clip(one || " ", 60)), rows: rows.slice(from, from + PANEL_ROWS),
          alignRight: numeric.flatMap((yes, at) => (yes ? [at] : [])),
        });
      }
    }
  }
  return {
    screen: clip(report.screen, 60), status: null, subtitle: clip(report.subtitle, 300), asOf: clip(`As at ${new Date().toLocaleDateString("en-GB", { dateStyle: "medium" })}`, 120),
    figures: report.figures.slice(0, 24).map((one) => ({ label: clip(one.label, 60), value: clip(one.value, 60), note: one.note ? clip(one.note, 80) : null, change: null })),
    panels: (panels.length ? panels : [{ title: "Key figures", place: "LEFT", pairs: [], bars: [], columns: [], rows: [], alignRight: [] } as ReportPanel]).slice(0, 40),
  };
}

function excelOf(report: Report) {
  const sheets: ExportSheet[] = [];
  const line = (cells: (string | number | null)[]) => ({ cells: cells.map((one) => (one == null ? "" : typeof one === "number" ? String(round(one)) : clip(one, 500))), level: 0, strong: false });
  const col = (label: string, kind: ExportColumn["kind"] = "TEXT"): ExportColumn => ({ label: clip(label || "Item", 120), kind });
  if (report.figures.length) {
    sheets.push({ name: "Key figures", columns: [col("Figure"), col("Value"), col("Note")], rows: report.figures.map((one) => line([one.label, one.value, one.note ?? ""])) });
  }
  for (const section of report.sections) {
    const name = clip(section.title, 80);
    if ("pairs" in section) {
      sheets.push({ name, columns: [col("Item"), col("Value")], rows: section.pairs.map(([label, value]) => line([label, value])) });
    } else if ("parts" in section) {
      const total = section.parts.reduce((sum, one) => sum + Math.abs(one.value), 0) || 1;
      sheets.push({ name, columns: [col("Item"), col("Value", "MONEY"), col("Share %", "PERCENT")],
        rows: section.parts.map((one) => line([one.label, one.value, (Math.abs(one.value) / total) * 100])) });
    } else {
      const width = Math.min(section.head.length, 30);
      const numeric = section.head.slice(0, width).map((_, at) => section.rows.some((row) => typeof row[at] === "number"));
      sheets.push({ name, columns: section.head.slice(0, width).map((one, at) => col(one || `Column ${at + 1}`, numeric[at] ? "NUMBER" : "TEXT")),
        rows: section.rows.slice(0, 5_000).map((row) => line(row.slice(0, width))) });
    }
  }
  return { tab: clip(report.screen, 80), about: [report.subtitle].filter(Boolean).map((one) => clip(one, 300)), sheets: sheets.slice(0, 20) };
}

/** What the letterhead's fonts can print: a true minus, dashes and arrows written plainly. */
function clip(value: string, most: number) {
  const plain = value.replace(/[−–—]/g, "-").replace(/→/g, "->").replace(/←/g, "<-").replace(/…/g, "...").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  return plain.length > most ? `${plain.slice(0, most - 3)}...` : plain;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function plain(value: number) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
