const PAGE_SIZE = 1000;

/** PostgREST caps each request at 1000 rows — page until the full result set is loaded. */
export async function fetchAllPages<T>(
  runQuery: (range: { from: number; to: number }) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await runQuery({ from, to: from + PAGE_SIZE - 1 });
    if (error) throw new Error(error.message);

    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
