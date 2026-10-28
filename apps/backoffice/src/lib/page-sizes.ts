import { preference } from "./preferences";

/** The rows-per-page choices every table offers, so they all behave the same. */
export const PAGE_SIZES: readonly number[] = [10, 25, 50];

/** What a table shows when nobody has said otherwise. */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * How many rows this reader wants a table to start with.
 *
 * <p>A function rather than a constant because it is theirs to set, and a constant read at import time
 * would be whatever it was when the tab was opened. Pass it to {@code useState} unapplied — React calls it
 * once, on the first render, which is exactly when a table decides how long it is.
 */
export function defaultPageSize() {
  return preference("pageSize");
}
