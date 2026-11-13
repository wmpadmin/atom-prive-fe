import { ApiError } from "@atomprive/api-client";
import { useListOwnCards, type Breaks, type OwnCard } from "@atomprive/api-client/backoffice";
import { cn } from "@atomprive/ui";
import { useMemo } from "react";
import { CardSettingsContext } from "./card-settings";
import { CardMenu } from "./custom-view";
import { KindChart, type ChartData, type ChartKind } from "./chart-kinds";

/**
 * The cards a member of staff builds for themselves through Customize view's "Add new card", and the figures a
 * screen offers them. A screen lists what it already reads for the client in view — shares of a whole, a series by
 * month or class, one figure against the client's own limit — and an own card draws one of them as its reader chose.
 * Nothing is computed here: an own card is the screen's own figure, drawn another way.
 */

/** One figure a screen offers for a card of the reader's own. */
export type Figure = {
  label: string;
  /** The heading it is listed under in "What do you want to report on?". */
  group: string;
  /** The kinds it can be drawn as, the one a new card starts on first. */
  kinds: ChartKind[];
  format: (value: number) => string;
  /** The figure for the client in view; null where they have none. */
  data: ChartData | null;
  /** For one figure, the client's own limit from their IPS, where the policy sets one. */
  policy?: { value: number; label: string } | null;
};

/** What a screen offers, by the name a card keeps. */
export type Figures = Record<string, Figure>;

/** The layout's name for an own card: kept with the screen's own cards in the reader's layout. */
export const OWN = "own:";

/** What an own card is set to, saved or still being built. */
export type OwnCardDraft = Pick<OwnCard, "title" | "note" | "source" | "chart" | "palette" | "breaks">;

/** The reader's own cards on a screen. */
export function useOwnCards(key: string) {
  const query = useListOwnCards<OwnCard[], ApiError>(key, { query: { staleTime: 5 * 60_000 } });
  return query.data ?? [];
}

/** The shape a figure is drawn from: shares and series as they are, one figure as a gauge. */
export function shapeLabel(figure: Figure) {
  return figure.data?.shape === "shares" ? "shares" : figure.data?.shape === "series" ? "over time or class" : "one figure";
}

/** Red to green, for two to five bands; reversed where high is bad. */
const BANDS: Record<number, string[]> = {
  2: ["#dc2626", "#16a34a"],
  3: ["#dc2626", "#f59e0b", "#16a34a"],
  4: ["#dc2626", "#f59e0b", "#84cc16", "#16a34a"],
  5: ["#dc2626", "#ea580c", "#f59e0b", "#84cc16", "#16a34a"],
};

/**
 * Where a gauge's colours change for this client: the points the reader set, or from the client's own limit — red
 * below it, amber up to twice it, green beyond, four times it at the dial's end.
 */
export function breakPoints(breaks: Breaks | null | undefined, figure: Figure): number[] | null {
  if (!breaks) return null;
  if (breaks.basis === "POLICY") {
    const limit = figure.policy?.value;
    return limit == null || limit <= 0 ? null : [0, limit, limit * 2, limit * 4];
  }
  const points = breaks.points.map(Number).filter((one) => Number.isFinite(one));
  return points.length >= 2 && points.every((one, at) => at === 0 || one > points[at - 1]!) ? points : null;
}

/** The figure as the card draws it: a gauge with the reader's bands, or the figure as the screen has it. */
export function drawn(figure: Figure, breaks: Breaks | null | undefined): ChartData | null {
  const data = figure.data;
  if (!data || data.shape !== "gauge") return data;
  const points = breakPoints(breaks, figure);
  if (!points) return data;
  const colours = BANDS[points.length - 1] ?? BANDS[3]!;
  const ordered = breaks?.reversed ? [...colours].reverse() : colours;
  return {
    ...data,
    min: points[0],
    max: points[points.length - 1]!,
    target: figure.policy?.value ?? data.target,
    bands: points.slice(1).map((to, at) => ({ to, colour: ordered[at]! })),
  };
}

/** One card of the reader's own, drawn from the screen's figure for the client in view. */
export function OwnCardView({ card, figure, className }: { card: OwnCardDraft; figure: Figure | undefined; className?: string }) {
  const data = useMemo(() => (figure ? drawn(figure, card.breaks) : null), [figure, card.breaks]);
  const kind = (figure?.kinds.includes(card.chart as ChartKind) ? card.chart : figure?.kinds[0]) as ChartKind | undefined;
  const points = figure ? breakPoints(card.breaks, figure) : null;
  const settings = useMemo(() => ({ title: null, note: null, palette: card.palette === "traffic" ? "traffic" as const : "theme" as const }), [card.palette]);
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line bg-white p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{card.title || "New card"}</h2>
          {card.note && <p className="mt-0.5 text-xs text-ink-muted">{card.note}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-3xs font-bold text-primary-700">Your card</span>
          <CardMenu />
        </span>
      </div>
      {!figure ? (
        <p className="py-8 text-center text-sm text-ink-muted">This card's figure is not on this screen any more.</p>
      ) : !data || !kind ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nothing on file for this client yet.</p>
      ) : (
        <CardSettingsContext.Provider value={settings}>
          <KindChart data={data} kind={kind} format={figure.format} height={kind === "number" ? undefined : 240} label={card.title || figure.label} />
          {points && (kind === "gauge" || kind === "number") && (
            <p className="mt-1 flex justify-between text-2xs text-ink-muted tabular-nums">
              {points.map((one, at) => <span key={at}>{figure.format(one)}{at === 1 && card.breaks?.basis === "POLICY" ? " limit" : ""}</span>)}
            </p>
          )}
        </CardSettingsContext.Provider>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Building a screen's list of figures                                                                          */

const SHARE_KINDS: ChartKind[] = ["donut", "horizontal-bar", "treemap", "bar", "table"];

/** Parts of a whole, such as holdings by currency. */
export function sharesFigure(label: string, group: string, rows: { name: string; value: number }[], format: (value: number) => string,
  kinds: ChartKind[] = SHARE_KINDS): Figure {
  const kept = rows.filter((one) => Number.isFinite(one.value));
  return { label, group, kinds, format, data: kept.length ? { shape: "shares", items: kept.map((one) => ({ name: one.name, value: one.value })) } : null };
}

/** Figures across categories or months, one series or several. */
export function seriesFigure(label: string, group: string, categories: string[], series: { name: string; values: (number | null)[] }[],
  format: (value: number) => string, kinds: ChartKind[]): Figure {
  return { label, group, kinds, format, data: categories.length && series.length ? { shape: "series", categories, series } : null };
}

/** One figure, drawn large or on a dial; {@code policy} is the client's own limit where their IPS sets one. */
export function singleFigure(label: string, group: string, value: number | null | undefined, format: (value: number) => string,
  options: { max?: number; target?: number | null; policy?: Figure["policy"]; gauge?: boolean } = {}): Figure {
  const max = options.max ?? (Math.abs(value ?? 0) * 2 || 1);
  return {
    label, group, format, policy: options.policy ?? null,
    kinds: options.gauge ? ["gauge", "number", "table"] : ["number", "table"],
    data: value == null ? null : { shape: "gauge", name: label, value, max, target: options.target ?? null },
  };
}

/** A screen's key figures, each one offered as a figure of its own under its key; a percentage may also be a dial. */
export function kpiFigures(list: { key: string; label: string; value: number | null; unit: string }[],
  format: (unit: string) => (value: number) => string, group = "Key figures"): Figures {
  return Object.fromEntries(list.filter((one) => one.value != null).map((one) => [
    `kpi.${one.key.toLowerCase()}`,
    singleFigure(one.label, group, one.value, format(one.unit), { gauge: one.unit === "PERCENT", max: one.unit === "PERCENT" ? Math.max(100, Math.abs(one.value ?? 0)) : undefined }),
  ]));
}
