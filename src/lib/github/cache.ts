/**
 * Dead-simple in-memory TTL cache.
 *
 * v1 scope: this lives in the Node process that runs the route handlers, so a
 * dashboard reload within the TTL window is served from memory and never touches
 * the GitHub API. It is intentionally NOT durable — restart the server and the
 * cache is empty. That is fine for a single-user dashboard and keeps us well
 * inside GitHub's 5000 points/hour GraphQL budget.
 *
 * Swap this for Redis / unstable_cache if you ever deploy multi-instance.
 */

interface Entry<T> {
  value: T;
  /** epoch ms after which the entry is stale. */
  expiresAt: number;
}

// Module-level map => shared across requests for the lifetime of the process.
const store = new Map<string, Entry<unknown>>();

/** Default time-to-live for cached GitHub responses (minutes). */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Return a cached value for `key`, or run `fn`, cache its result, and return it.
 * Concurrent callers with the same key share a single in-flight promise so we
 * don't fire N identical GraphQL queries on a cold cache.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await fn();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Drop everything (used by tests and the manual "refresh" button). */
export function clearCache(): void {
  store.clear();
  inflight.clear();
}

/** Introspection for a debug endpoint / tests. */
export function cacheStats() {
  const now = Date.now();
  let fresh = 0;
  for (const entry of store.values()) if (entry.expiresAt > now) fresh += 1;
  return { total: store.size, fresh, stale: store.size - fresh };
}
