"use client";

import { useEffect, useState } from "react";

/**
 * Module-level cache for /api/me.
 *
 * Why: the dashboard shell calls this on every mount. Without a cache, every
 * client-side navigation back to /dashboard/* would re-fire the request even
 * though the user object hasn't changed. With the cache, the hook returns
 * the cached user synchronously on the next mount — the shell renders
 * instantly with the user's email already in place.
 *
 * Invalidation: we never invalidate this in-session. The user object only
 * changes on sign-in / sign-out / profile update, all of which trigger a
 * full page reload (sign-out button navigates away; profile update calls
 * supabase.auth.updateUser which mutates the cookie).
 */
type CachedUser = {
  id: string;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown>;
};

let cached: CachedUser | null = null;
let inflight: Promise<CachedUser | null> | null = null;

async function fetchUser(): Promise<CachedUser | null> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const user = data.user as CachedUser | null;
      if (user) cached = user;
      return user;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Allows sign-out / profile update to clear the cache. */
export function invalidateCurrentUser() {
  cached = null;
  inflight = null;
}

/**
 * Client hook that resolves the current user from /api/me.
 *
 * Returns:
 *   - { user: CachedUser, loading: false }  if we have data (cached or fresh)
 *   - { user: null,     loading: true  }  on first mount, before fetch resolves
 *   - { user: null,     loading: false }  if the user is signed out
 *
 * The shell should render INSTANTLY with `loading: true` and a skeleton in
 * the header — do NOT block the shell on this hook.
 */
export function useCurrentUser() {
  const [state, setState] = useState<{
    user: CachedUser | null;
    loading: boolean;
  }>(() => ({
    // Sync init from cache — if we already have the user, no loading flash.
    user: cached,
    loading: cached === null,
  }));

  useEffect(() => {
    let cancelled = false;
    fetchUser().then((user) => {
      if (cancelled) return;
      setState({ user, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export type { CachedUser };
