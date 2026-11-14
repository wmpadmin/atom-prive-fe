/** Every page of a paged list, read in turn — what a whole-list report is made from. */
export async function everyPage<T>(read: (page: number) => Promise<{ items: T[]; totalItems: number }>): Promise<T[]> {
  const rows: T[] = [];
  for (let at = 0; ; at++) {
    const one = await read(at);
    rows.push(...one.items);
    if (one.items.length === 0 || rows.length >= one.totalItems) return rows;
  }
}

/** Rows as CSV, every field quoted and any quote of its own doubled. */
export function toCsv(head: string[], rows: (string | number | null | undefined)[][]) {
  const line = (cells: (string | number | null | undefined)[]) => cells.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",");
  return [line(head), ...rows.map(line)].join("\r\n");
}
