import { ApiError } from "@atomprive/api-client";
import { useListAssetClasses, type AssetClassRow } from "@atomprive/api-client/backoffice";

/**
 * The firm's own list of asset classes (A3.5 #6). It used to be compiled into both sides of the platform; it
 * is read from the API now, so a class the firm adds reaches every screen without a release.
 */
export function useAssetClasses() {
  const listed = useListAssetClasses<AssetClassRow[], ApiError>({
    // It changes a few times a year at most, and every portfolio screen asks for it.
    query: { staleTime: 5 * 60 * 1000 },
  });
  const all = listed.data ?? [];
  return {
    /** Every class the firm has ever listed, in its own order. What a holding may already name. */
    all,
    /** The classes a model is built from: everything still in use. */
    inUse: all.filter((one) => one.retiredAt === null),
    names: Object.fromEntries(all.map((one) => [one.code, one.name])) as Record<string, string>,
    shortNames: Object.fromEntries(all.map((one) => [one.code, one.shortName])) as Record<string, string>,
    isPending: listed.isPending,
    isError: listed.isError,
    error: listed.error,
  };
}

/**
 * The colours a class is drawn in. Taken by position in the firm's own order rather than by code, because the
 * firm can add a class the platform has never heard of; past the end of the palette it starts again, which is
 * why a chart never relies on colour alone to say which class a slice is.
 */
const PALETTE = [
  "bg-primary-600",
  "bg-sky-400",
  "bg-amber-400",
  "bg-violet-500",
  "bg-slate-300",
  "bg-emerald-500",
  "bg-rose-400",
  "bg-teal-500",
  "bg-indigo-400",
  "bg-orange-400",
];

/**
 * The same colours again, as ink a chart can be drawn in.
 *
 * <p>Tailwind's classes cannot be handed to an SVG fill, and a chart drawn from a different palette than
 * the bars beside it would say two different things about the same class on one screen. Same order, same
 * hues, read by position exactly as the classes are.
 */
export const INK = [
  "#2563eb",
  "#38bdf8",
  "#fbbf24",
  "#8b5cf6",
  "#cbd5e1",
  "#10b981",
  "#fb7185",
  "#14b8a6",
  "#818cf8",
  "#fb923c",
];

/** What to draw a class in, where a class is drawn rather than written. */
export function inkFor(code: string, all: { code: string }[]) {
  const at = all.findIndex((one) => one.code === code);
  return INK[(at < 0 ? all.length : at) % INK.length];
}

export function barFor(code: string, all: { code: string }[]) {
  const at = all.findIndex((one) => one.code === code);
  return PALETTE[(at < 0 ? all.length : at) % PALETTE.length];
}

/** What to call a class whose code a screen has, falling back to the code for one no longer listed. */
export function nameOf(code: string, names: Record<string, string>) {
  return names[code] ?? code;
}
