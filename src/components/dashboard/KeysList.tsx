"use client";

import { useState, useTransition } from "react";
import { Copy, Check, KeyRound, Plus, RotateCcw, Trash2 } from "lucide-react";

type ApiKeyRow = {
  id: string;
  label: string;
  prefix: string;
  lastFour: string | null;
  scopes: string;
  revokedAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type CreatedKey = {
  id: string;
  rawSecret: string; // shown only here
  label: string;
};

export function KeysList({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [busy, start] = useTransition();

  function refresh() {
    start(async () => {
      const res = await fetch("/api/dashboard/keys", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    });
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone. Any service still using it will lose access immediately.")) {
      return;
    }
    start(async () => {
      const res = await fetch(`/api/dashboard/keys/${id}/revoke`, { method: "POST" });
      if (res.ok) refresh();
    });
  }

  async function roll(id: string) {
    if (!confirm("Roll this API key? A new secret will be generated and the old one will stop working immediately.")) {
      return;
    }
    start(async () => {
      const res = await fetch(`/api/dashboard/keys/${id}/roll`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRevealed({ id: data.id, rawSecret: data.rawSecret, label: data.label });
        refresh();
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between border border-border p-4">
        <div>
          <p className="font-display text-sm font-semibold">Your keys</p>
          <p className="text-xs text-muted-foreground">
            Keys are prefixed <code className="font-mono">sk_live_</code>. Treat them like passwords.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" /> Create key
        </button>
      </div>

      {/* Table */}
      {keys.length === 0 ? (
        <div className="border border-border border-t-0 p-12 text-center">
          <KeyRound className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No API keys yet</p>
          <p className="text-xs text-muted-foreground">Create your first key to start calling the Musicosy API.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-2.5 text-left label-mono">Label</th>
                <th className="px-4 py-2.5 text-left label-mono">Key</th>
                <th className="px-4 py-2.5 text-left label-mono">Status</th>
                <th className="px-4 py-2.5 text-left label-mono">Last used</th>
                <th className="px-4 py-2.5 text-left label-mono">Created</th>
                <th className="px-4 py-2.5 text-right label-mono">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{k.label}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs">
                      sk_live_{k.prefix}
                      {k.lastFour ? `…${k.lastFour}` : ""}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    {k.revokedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-foreground">
                        <span className="size-1.5 rounded-full bg-foreground" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {k.lastUsedAt ? formatRel(k.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(k.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!k.revokedAt && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => roll(k.id)}
                          disabled={busy}
                          title="Roll key (generates new secret, invalidates old)"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        <button
                          onClick={() => revoke(k.id)}
                          disabled={busy}
                          title="Revoke permanently"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <CreateKeyModal
          onClose={() => setCreating(false)}
          onCreated={(k) => {
            setRevealed(k);
            setCreating(false);
            refresh();
          }}
        />
      )}

      {/* Reveal modal */}
      {revealed && (
        <RevealModal
          created={revealed}
          onClose={() => setRevealed(null)}
        />
      )}
    </>
  );
}

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (k: CreatedKey) => void;
}) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState("read:all,write:all");
  const [expiry, setExpiry] = useState("never");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const expiresAt =
        expiry === "never" ? null :
        expiry === "30d" ? new Date(Date.now() + 30 * 86400_000).toISOString() :
        expiry === "90d" ? new Date(Date.now() + 90 * 86400_000).toISOString() :
        null;
      const res = await fetch("/api/dashboard/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), scopes, expiresAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create key");
        return;
      }
      onCreated({ id: data.id, rawSecret: data.rawSecret, label: data.label });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create API key">
      <div className="space-y-4">
        <div>
          <label className="label-mono block text-xs">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Production backend"
            className="mt-1 h-10 w-full border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">Helps you identify this key later. Visible to your team.</p>
        </div>

        <div>
          <label className="label-mono block text-xs">Scopes</label>
          <input
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            className="mt-1 h-10 w-full border border-border bg-background px-3 font-mono text-xs focus:border-foreground focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Comma-separated. Use <code className="font-mono">read:all,write:all</code> for full access.
          </p>
        </div>

        <div>
          <label className="label-mono block text-xs">Expiry</label>
          <div className="mt-1 flex gap-2">
            {[
              { v: "never", l: "Never" },
              { v: "30d", l: "30 days" },
              { v: "90d", l: "90 days" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setExpiry(o.v)}
                className={`flex-1 border px-3 py-2 text-xs font-medium transition-colors ${
                  expiry === o.v
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-surface"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            onClick={onClose}
            className="border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!label.trim() || submitting}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RevealModal({ created, onClose }: { created: CreatedKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  // rawSecret already includes the `sk_live_` prefix (see generateApiKey)
  const full = created.rawSecret;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal onClose={onClose} title="Key created">
      <div className="space-y-4">
        <div className="rounded border border-foreground/30 bg-surface p-3">
          <p className="label-mono text-xs text-muted-foreground">{created.label}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-xs">{full}</code>
            <button
              onClick={copy}
              className="shrink-0 rounded border border-border p-2 transition-colors hover:bg-background"
              title="Copy"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Copy this now.</strong> For security, the full key is never shown again. If you lose it, you'll need to roll the key to generate a new one.
        </p>
        <div className="flex justify-end border-t border-border pt-4">
          <button
            onClick={onClose}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            I've saved it
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-border bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}
