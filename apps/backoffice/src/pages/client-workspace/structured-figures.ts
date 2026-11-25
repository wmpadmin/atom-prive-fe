import type { SpEvent, SpFileLine, SpIssuer, SpScenarioSet } from "@atomprive/api-client/backoffice";
import type { FigureDetail } from "./figure-panel";
import { asSent, compact, fullDay, signedMoney, withAmount } from "./structured-format";

/**
 * The side panel's breakdowns the Structured Products screens share (25 Nov 2026): a bank Excel line, something falling
 * due, an issuer and a scenario. Each is laid out from the screen's own figures; nothing is worked out here.
 */

/** What every Structured Products screen carries that these breakdowns read. */
type Screen = {
  currency: string;
  source: string;
  fileLines: SpFileLine[];
  issuerLimit: number | null;
  issuerLimitPercent: number | null;
  notes: { id: string; label: string; issuer: string; notional: number; mtm: number }[];
};

/** One bank Excel line, every cell as the sheet states it. */
export function lineFigure(data: Screen, line: SpFileLine): FigureDetail {
  const cur = data.currency;
  return {
    label: "Bank holdings Excel line",
    value: line.marketValueUsd == null ? "—" : compact(line.marketValueUsd, cur),
    note: `As ${line.bank}'s sheet states it. Terms, levels and events are not in the sheet.`,
    facts: [
      { label: "ISIN", value: line.isin ?? "—" },
      { label: "Currency", value: line.currency ?? "—" },
      { label: "Holding", value: line.holding == null ? "—" : asSent(line.holding) },
      { label: "Cost price", value: line.costPrice == null ? "—" : asSent(line.costPrice) },
      { label: "Last price", value: line.lastPrice == null ? "—" : asSent(line.lastPrice) },
      { label: "Maturity", value: line.maturity ?? "—" },
      { label: "P&L", value: line.pnlUsd == null ? "—" : signedMoney(line.pnlUsd, cur) },
      { label: "P&L %", value: line.pnlPercent == null ? "—" : `${line.pnlPercent.toFixed(2)}%` },
      { label: "Product type", value: line.productType ?? "—" },
      { label: "Sub-asset class", value: line.subAssetClass ?? "—" },
      { label: "Issuer", value: line.issuer ?? "—" },
      { label: "Geography", value: line.geography ?? "—" },
    ],
  };
}

/** Something falling due, as its row reads, with the note it falls on. */
export function eventFigure(data: Screen, one: SpEvent, label: string): FigureDetail {
  const note = data.notes.find((each) => each.id === one.noteId);
  return {
    label,
    value: fullDay(one.on),
    note: `${one.title} · ${withAmount(one.detail, one.amount, data.currency)}`,
    facts: [{ label: "Expected", value: one.status }, ...(note ? [{ label: "Note", value: note.label }, { label: "Issuer", value: note.issuer }] : [])],
  };
}

/** One issuer, the notes (or lines) it owes, and the limit it is held to. */
export function issuerFigure(data: Screen, one: SpIssuer): FigureDetail {
  const cur = data.currency;
  const excel = data.source === "EXCEL";
  const limit = data.issuerLimit == null ? "The client's policy sets no single-issuer limit."
    : data.issuerLimitPercent != null ? `Against the policy's single-issuer limit of ${data.issuerLimitPercent}% of net worth, ${compact(data.issuerLimit, cur)}.`
      : `Against an issuer limit of ${compact(data.issuerLimit, cur)}.`;
  return {
    label: "Issuer exposure",
    value: compact(one.mtm, cur),
    note: excel ? "The sheets' Market value USD for this issuer; ratings, CDS and the limit are not in the sheets." : limit,
    facts: excel ? [{ label: "Share of book", value: `${one.share.toFixed(1)}%` }] : [
      { label: "Rating", value: one.rating ?? "—" }, { label: "5Y CDS", value: one.cdsBp == null ? "—" : `${one.cdsBp} bp` },
      { label: "Share of book", value: `${one.share.toFixed(1)}%` }, { label: "Limit", value: one.withinLimit == null ? "No limit set" : one.withinLimit ? "Within limit" : "Over limit" },
    ],
    table: excel
      ? { columns: ["Line", "Bank", "Market value"], rows: data.fileLines.filter((line) => (line.issuer ?? "Not stated") === one.issuer)
        .map((line) => [line.name, line.bank, line.marketValueUsd == null ? null : compact(line.marketValueUsd, cur)]) }
      : { columns: ["Note", "Notional", "MTM"], rows: data.notes.filter((note) => note.issuer === one.issuer).map((note) => [note.label, compact(note.notional, cur), compact(note.mtm, cur)]) },
  };
}

/** One note's change for one shock, and the same note across every shock; or every note for one shock, for the book. */
export function scenarioFigure(currency: string, title: string, set: SpScenarioSet, row: SpScenarioSet["rows"][number] | null, at: number): FigureDetail {
  const amounts = row ? row.amounts : set.book;
  const write = (value: number | null | undefined) => (value == null ? "—" : signedMoney(value, currency));
  return {
    label: `${title} · ${set.label}`,
    value: write(amounts[at]),
    note: set.lead,
    chart: { title: `${row?.label ?? "Book"} across the shocks`, kind: "grouped-bar", format: "money", currency,
      data: { shape: "series", categories: set.moves, series: [{ name: row?.label ?? "Book", values: amounts.map((one) => one ?? null) }] } },
    table: row ? { columns: ["Shock", "Change"], rows: set.moves.map((move, each) => [move, write(amounts[each])]) }
      : { title: `Every note at ${set.moves[at]}`, columns: ["Note", "Change"], rows: set.rows.map((one) => [one.label, write(one.amounts[at])]),
        total: ["Book", write(set.book[at])] },
  };
}
