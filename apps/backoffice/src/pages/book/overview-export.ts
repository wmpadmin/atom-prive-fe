import type { ExportColumn, ExportColumnKind, ExportRow, ExportSheet } from "@atomprive/api-client/backoffice";
import { getExportClientOverviewUrl } from "@atomprive/api-client/backoffice";
import { createContext, useContext, useEffect } from "react";
import { saveApiPost } from "../../lib/download";

/**
 * Exporting a client's screen to Excel.
 *
 * <p>Each panel says what it draws — the same rows, in the same order and currency, that are on the screen —
 * and the page asks for whichever panels the reader wants. The figures are worked out once, by the panel that
 * draws them; the export only writes them down, so the file cannot disagree with the screen.
 */

/** A sheet's worth of what a panel draws. A panel drawing more than one table names each. */
export type Part = { name?: string; columns: ExportColumn[]; rows: ExportRow[] };

/** What a panel hands over when asked; nothing while it has nothing drawn. */
export type Builder = () => Part | Part[] | null;

type Entry = { name: string; build: Builder };

/** Every panel on the page that can be exported, by its id, in the order they were drawn. */
export class ExportRegistry {
  private readonly entries = new Map<string, Entry>();

  set(id: string, name: string, build: Builder | null) {
    if (build) this.entries.set(id, { name, build });
    else this.entries.delete(id);
  }

  /** The panels that can be exported now, for the reader to choose from. */
  list(): { id: string; name: string }[] {
    return [...this.entries.entries()].map(([id, entry]) => ({ id, name: entry.name }));
  }

  /** The chosen panels as sheets, each named after its panel. */
  sheets(ids: string[]): ExportSheet[] {
    return ids.flatMap((id) => {
      const entry = this.entries.get(id);
      const drawn = entry?.build();
      if (!entry || !drawn) return [];
      const parts = Array.isArray(drawn) ? drawn : [drawn];
      return parts.map((part) => ({ name: part.name ? `${entry.name} – ${part.name}` : entry.name, columns: part.columns, rows: part.rows }));
    });
  }
}

export const ExportRegistryContext = createContext<ExportRegistry | null>(null);

/** Exports the given panels, as the page knows whose they are, which tab and what the figures are. */
export const ExportActionContext = createContext<((ids: string[]) => void) | null>(null);

/** The panel a builder belongs to: its id on the page and the name its sheet is given. */
export const ExportSlot = createContext<{ id: string; name: string } | null>(null);

/**
 * Hands the panel's current rows to the page's registry. Registered afresh on every draw, so what is exported is
 * what was last drawn, and taken away when the panel goes.
 */
export function useExportSheet(build: Builder) {
  const registry = useContext(ExportRegistryContext);
  const slot = useContext(ExportSlot);
  useEffect(() => {
    if (!registry || !slot) return;
    registry.set(slot.id, slot.name, build);
  });
  useEffect(() => {
    if (!registry || !slot) return;
    return () => registry.set(slot.id, slot.name, null);
  }, [registry, slot]);
}

/** Downloads the chosen sheets as one workbook. */
export function downloadWorkbook(customerId: string, client: string, tab: string, about: string[], sheets: ExportSheet[]) {
  const day = new Date().toISOString().slice(0, 10);
  const filename = `${client} — ${tab} — ${day}.xlsx`.replace(/[\\/:*?"<>|]/g, " ");
  return saveApiPost(getExportClientOverviewUrl(customerId), { tab, about, sheets }, filename);
}

/** A column, by what it holds. */
export function column(label: string, kind: ExportColumnKind = "TEXT"): ExportColumn {
  return { label, kind };
}

/** A row, its cells as text: a figure as a plain number, a figure not on file as nothing. */
export function row(cells: (string | number | null | undefined)[], level = 0, strong = false): ExportRow {
  return {
    cells: cells.map((one) => (one === null || one === undefined ? "" : typeof one === "number" ? String(Math.round(one * 10_000) / 10_000) : one)),
    level,
    strong,
  };
}
