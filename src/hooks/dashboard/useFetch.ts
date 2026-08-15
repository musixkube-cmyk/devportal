"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Generic data-fetching hook for the dashboard.
 *
 * Pattern:
 *   const { data, error, loading, reload } = useFetch("/api/dashboard/keys");
 *
 * Behavior:
 *   - On mount: fires fetch, returns { loading: true, data: null }
 *   - On resolve: returns { loading: false, data, error: null }
 *   - On reject: returns { loading: false, data: null, error }
 *   - `reload()` re-fires the same fetch
 *
 * Why this exists instead of using SWR/Tanstack Query:
 *   - The dashboard only has 4 pages, each with 1-2 endpoints. A 60-line
 *     hook is simpler than pulling in another dep + cache layer.
 *   - Module-level cache below handles the "navigate back → instant render"
 *     case for free.
 *
 * NOT a replacement for SWR in larger apps — but fine for this scope.
 */

type CacheEntry<T> = {
  data: T;
  ts: number;
};

// Per-key cache. Key is the URL string. Survives navigation, dies on full
// page reload (which is what we want — sign-out / sign-in flushes it).
const cache = new Map<string, CacheEntry<unknown>>();
// Per-key in-flight promise. Prevents duplicate concurrent fetches.
const inflight = new Map<string, Promise<unknown>>();

async function doFetch<T>(url: string): Promise<T> {
  // Cache hit? Return synchronously.
  const cached = cache.get(url) as CacheEntry<T> | undefined;
  if (cached) return cached.data;

  // Already fetching? Piggyback on the existing promise.
  const existing = inflight.get(url) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as T;
      cache.set(url, { data, ts: Date.now() });
      return data;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, p);
  return p;
}

export function useFetch<T>(url: string | null) {
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>(() => {
    if (!url) return { data: null, error: null, loading: false };
    const cached = cache.get(url) as CacheEntry<T> | undefined;
    return {
      data: cached?.data ?? null,
      error: null,
      loading: cached === undefined,
    };
  });

  const reload = useCallback(() => {
    if (!url) return;
    // Bypass cache for forced reloads.
    cache.delete(url);
    setState((s) => ({ ...s, loading: true, error: null }));
    doFetch<T>(url)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err: Error) =>
        setState({ data: null, error: err.message, loading: false }),
      );
  }, [url]);

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    doFetch<T>(url)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err: Error) => {
        if (!cancelled)
          setState({ data: null, error: err.message, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { ...state, reload };
}

/** Invalidate cache for a specific URL — call after mutations. */
export function invalidate(url: string) {
  cache.delete(url);
}

/** Invalidate everything — call on sign-out. */
export function invalidateAll() {
  cache.clear();
}
