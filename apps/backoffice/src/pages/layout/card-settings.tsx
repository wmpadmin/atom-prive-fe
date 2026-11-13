import { createContext, use } from "react";
import type { ChartKind } from "./chart-kinds";

/** The colours a card's chart is drawn in: the app's own, or green, amber and red. */
export type Palette = "theme" | "traffic";

/**
 * What the reader set for one card through Add card, handed to the card itself: their own name and line for it, the
 * colours of its chart, and — in Add card's preview only — the chart type being tried before it is saved.
 */
export type CardSettings = {
  /** Their own name for the card, or null for the card's own. */
  title: string | null;
  /** A line of their own under the title, or null for the card's own. */
  note: string | null;
  palette: Palette;
  /** A chart type being previewed, not yet saved. */
  chart?: ChartKind | null;
};

export const CardSettingsContext = createContext<CardSettings | null>(null);

/** The reader's settings for the card being drawn; null outside a screen of cards. */
export function useCardSettings() {
  return use(CardSettingsContext);
}

/** The card's title and lead as the reader set them, or as the card has them. */
export function useCardLabel<Lead = string>(title: string, lead?: Lead) {
  const own = use(CardSettingsContext);
  return { title: own?.title ?? title, lead: own?.note ?? lead };
}
