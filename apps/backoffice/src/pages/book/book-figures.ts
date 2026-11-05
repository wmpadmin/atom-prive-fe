/** A figure in full, to the cent, as the client list shows it. */
export function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A figure shortened for a tile or an axis: 97.9M, 120.1K, -22.1M. */
export function short(amount: number) {
  const size = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (size >= 1e9) return `${sign}${(size / 1e9).toFixed(1)}B`;
  if (size >= 1e6) return `${sign}${(size / 1e6).toFixed(1)}M`;
  if (size >= 1e3) return `${sign}${(size / 1e3).toFixed(1)}K`;
  return `${sign}${size.toFixed(0)}`;
}

/** A percentage with its sign, so a return that fell reads as falling: +1.24%, -0.55%. */
export function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** yyyy-mm-dd for a day, in the reader's own calendar rather than UTC's. */
export function isoDay(day: Date) {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

/** 5M, 97.25M, 120.1K, 0.00 — a figure written short enough for an axis or a tooltip. */
export function axisMoney(value: number) {
  const size = Math.abs(value);
  const [unit, mark] = size >= 1e9 ? [1e9, "B"] : size >= 1e6 ? [1e6, "M"] : size >= 1e3 ? [1e3, "K"] : [1, ""];
  // As many decimals as the tick itself has, up to three, so ticks a quarter-million apart read 97M, 97.25M,
  // 97.5M rather than all rounding to the same 97.3M. Ticks are multiples of their step, so no two match.
  const figure = (value / unit).toFixed(unit === 1 ? 2 : 3);
  return `${unit === 1 ? figure : figure.replace(/\.?0+$/, "")}${mark}`;
}
