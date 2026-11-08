/** Native retained-minute navigation produces the same paired UTC bounds as direct links. */
export function workspaceQuery<T extends { from?: string; to?: string; window?: string }>(query: T): T {
  if (query.window === undefined) {
    if (query.from === "" && query.to === "") { const { from: _from, to: _to, ...rest } = query; return rest as T; }
    return query;
  }
  const { from: _from, to: _to, ...rest } = query;
  if (query.window === "") return rest as T;
  const parts = typeof query.window === "string" ? query.window.split("|") : [];
  // Keep malformed selection visibly invalid in the authoritative backend reader.
  return { ...rest, from: parts.length === 2 ? parts[0] : "invalid", to: parts.length === 2 ? parts[1] : "invalid" } as T;
}
