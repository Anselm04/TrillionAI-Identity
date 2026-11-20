// Keyset pagination: continue even if the provider silently caps a page.
export async function collectPages<T>(fetchPage: (after: string | null) => Promise<readonly T[]>, key: (row: T) => string): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const page = await fetchPage(after);
    if (page.length === 0) return rows;
    for (const row of page) {
      const id = key(row);
      if (!id || (after !== null && id <= after)) throw new Error("invalid_pagination_order");
      rows.push(row);
      after = id;
    }
  }
}
