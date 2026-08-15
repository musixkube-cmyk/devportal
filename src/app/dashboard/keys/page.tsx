"use client";

import { KeysList } from "@/components/dashboard/KeysList";

/**
 * API Keys page — client component.
 *
 * The page itself is a thin shell. It does NOT fetch on the server. The
 * `KeysList` component manages its own data: it fires `GET /api/dashboard/keys`
 * on mount via `useEffect` and shows skeleton rows while loading.
 *
 * Server-render phase: ~0ms (just JSX). The keys list fills in once the
 * Supabase RLS query resolves (~200-400ms typical).
 */
export default function KeysPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-8">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold">API Keys</h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Long-lived server-to-server credentials for the Musicosy API. Use a
          separate key per environment (production, staging, CI). Keys are
          hashed at rest — the raw{" "}
          <code className="font-mono text-foreground">sk_live_…</code> value
          is shown <strong className="text-foreground">once</strong> when you
          create a key. Store it in a secret manager.
        </p>
      </header>

      <KeysList />
    </div>
  );
}
