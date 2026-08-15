"use client";

import { useState } from "react";
import { useCurrentUser, invalidateCurrentUser } from "@/hooks/dashboard/useCurrentUser";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Settings page — client component.
 *
 * Reads the current user from the shared `useCurrentUser()` cache (already
 * populated by the shell on mount, so this renders with data on first paint
 * — no flash, no skeleton for the read-only fields).
 *
 * Profile fields (display_name, company_name, website) are stored on the
 * Supabase auth user's `raw_user_meta_data` JSONB column. Edits go through
 * `supabase.auth.updateUser({ data })` which writes directly to auth.users
 * — no separate developer_profiles table needed, no sync.
 */
export default function SettingsPage() {
  const { user, loading } = useCurrentUser();

  const meta = (user?.metadata ?? {}) as {
    display_name?: string;
    company_name?: string;
    website?: string;
  };

  const [displayName, setDisplayName] = useState(meta.display_name ?? "");
  const [companyName, setCompanyName] = useState(meta.company_name ?? "");
  const [website, setWebsite] = useState(meta.website ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once user data resolves from cache, sync the local inputs.
  // (This only fires when the cached user arrives AFTER mount — e.g. on a
  // hard refresh where the cache is cold.)
  const [synced, setSynced] = useState(false);
  if (user && !synced) {
    setDisplayName(meta.display_name ?? "");
    setCompanyName(meta.company_name ?? "");
    setWebsite(meta.website ?? "");
    setSynced(true);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          company_name: companyName.trim(),
          website: website.trim(),
        },
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // Refresh the cached user so the header email/meta stays in sync.
      invalidateCurrentUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your developer profile and account details.
        </p>
      </header>

      {/* Read-only identity */}
      <section className="space-y-3">
        <h2 className="label-mono text-xs text-muted-foreground">
          Account identity
        </h2>
        <div className="border border-border">
          <dl className="divide-y divide-border">
            <Row
              label="Account email"
              value={
                loading
                  ? undefined
                  : (user?.email ?? "—")
              }
            />
            <Row
              label="Phone"
              value={loading ? undefined : (user?.phone ?? "—")}
            />
            <Row
              label="User ID"
              value={loading ? undefined : (user?.id ?? "—")}
              mono
            />
          </dl>
        </div>
      </section>

      {/* Editable profile fields */}
      <section className="space-y-3">
        <h2 className="label-mono text-xs text-muted-foreground">
          Developer profile
        </h2>
        <div className="border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Your name"
            />
            <Field
              label="Company"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Acme Music Co."
            />
            <Field
              label="Website"
              value={website}
              onChange={setWebsite}
              placeholder="https://example.com"
              mono
            />
          </div>

          {error && (
            <p className="mt-3 rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
            {saved && (
              <span className="text-xs text-foreground">Saved.</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Profile fields are stored on your Supabase auth user record. They
          update instantly and require no separate sync.
        </p>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="label-mono text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm text-foreground ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value === undefined ? (
          <span className="inline-block h-4 w-32 animate-pulse bg-muted" />
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="label-mono block text-xs">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 h-10 w-full border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </div>
  );
}
