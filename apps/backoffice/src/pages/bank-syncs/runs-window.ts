/** The start of today, as the log is asked for it. */
export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** A day ago, as the log is asked for it: the window the log's own 24-hour counts cover. */
export function aDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
