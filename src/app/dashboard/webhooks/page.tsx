"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Check, Plus, Trash2, Webhook, Power, ShieldCheck } from "lucide-react";
import { WebhookVerifySnippet } from "@/components/dashboard/WebhookVerifySnippet";

type Webhook = {
  id: string;
  label: string;
  url: string;
  events: string;
  enabled: boolean;
  secretPrefix: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  createdAt: string;
};

type CreatedWebhook = {
  id: string;
  rawSecret: string;
  label: string;
};

/**
 * Webhooks page — client component.
 *
 * Fires `/api/dashboard/webhooks` on mount, renders a list of webhook
 * endpoints with the ability to create / toggle / delete. While loading,
 * shows skeleton rows. After a mutation, calls `reload()` to refresh.
 */
export default function WebhooksPage() {
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<CreatedWebhook | null>(null);
  const [busy, start] = useTransition();

  async function reload() {
    try {
      const res = await fetch("/api/dashboard/webhooks", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      const data = await res.json();
      setHooks(data.webhooks as Webhook[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks");
      setHooks([]);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(hook: Webhook) {
    start(async () => {
      const res = await fetch(`/api/dashboard/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !hook.enabled }),
      });
      if (res.ok) reload();
    });
  }

  async function remove(hook: Webhook) {
    if (!confirm(`Delete webhook "${hook.label}"? This cannot be undone.`)) {
      return;
    }
    start(async () => {
      const res = await fetch(`/api/dashboard/webhooks/${hook.id}`, {
        method: "DELETE",
      });
      if (res.ok) reload();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold">Webhooks</h1>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> New webhook
          </button>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Configure HTTP endpoints that Musicosy calls when events happen.
          Each webhook is signed with an HMAC-SHA256 secret. We recommend
          verifying signatures on receipt to ensure the request came from us.
        </p>
      </header>

      {error && (
        <div className="border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hooks === null ? (
        <SkeletonRows />
      ) : hooks.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <Webhook className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No webhooks configured</p>
          <p className="text-xs text-muted-foreground">
            Create a webhook to receive event notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hooks.map((h) => (
            <WebhookRow
              key={h.id}
              hook={h}
              busy={busy}
              onToggle={() => toggle(h)}
              onDelete={() => remove(h)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateWebhookModal
          onClose={() => setCreating(false)}
          onCreated={(w) => {
            setRevealed(w);
            setCreating(false);
            reload();
          }}
        />
      )}

      {revealed && (
        <RevealSecretModal
          created={revealed}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  );
}

function WebhookRow({
  hook,
  busy,
  onToggle,
  onDelete,
}: {
  hook: Webhook;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-semibold">{hook.label}</p>
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                hook.enabled ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  hook.enabled ? "bg-foreground" : "bg-muted-foreground"
                }`}
              />
              {hook.enabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {hook.url}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hook.events
              .split(",")
              .filter(Boolean)
              .map((ev) => (
                <code
                  key={ev}
                  className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {ev.trim()}
                </code>
              ))}
            <span className="font-mono text-[10px] text-muted-foreground">
              secret: whsec_{hook.secretPrefix}…
            </span>
          </div>
          {hook.lastDeliveryAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last delivery: {formatRel(hook.lastDeliveryAt)}
              {hook.lastDeliveryStatus !== null && (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className={
                      hook.lastDeliveryStatus >= 200 &&
                      hook.lastDeliveryStatus < 300
                        ? "text-foreground"
                        : "text-destructive"
                    }
                  >
                    HTTP {hook.lastDeliveryStatus}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggle}
            disabled={busy}
            title={hook.enabled ? "Disable" : "Enable"}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
          >
            <Power className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Delete"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-border p-4">
          <div className="h-4 w-40 animate-pulse bg-muted" />
          <div className="mt-2 h-3 w-full animate-pulse bg-muted" />
          <div className="mt-2 h-3 w-2/3 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  );
}

const EVENT_PRESETS = [
  "track.created",
  "track.updated",
  "track.deleted",
  "playlist.created",
  "playlist.updated",
  "user.followed",
  "user.unfollowed",
];

function CreateWebhookModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (w: CreatedWebhook) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("track.created,track.updated");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      setError("URL must start with http:// or https://");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          url: url.trim(),
          events: events.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create webhook");
        return;
      }
      onCreated({
        id: data.id,
        rawSecret: data.rawSecret,
        label: data.label,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create webhook">
      <div className="space-y-4">
        <div>
          <label className="label-mono block text-xs">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Track upload notifications"
            className="mt-1 h-10 w-full border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
          />
        </div>

        <div>
          <label className="label-mono block text-xs">Endpoint URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/webhooks/musicosy"
            className="mt-1 h-10 w-full border border-border bg-background px-3 font-mono text-xs focus:border-foreground focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Must be HTTPS in production. We POST JSON event payloads to this URL.
          </p>
        </div>

        <div>
          <label className="label-mono block text-xs">Events</label>
          <input
            value={events}
            onChange={(e) => setEvents(e.target.value)}
            className="mt-1 h-10 w-full border border-border bg-background px-3 font-mono text-xs focus:border-foreground focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {EVENT_PRESETS.map((ev) => (
              <button
                key={ev}
                type="button"
                onClick={() => {
                  const list = events
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (!list.includes(ev)) {
                    setEvents([...list, ev].join(","));
                  }
                }}
                className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:bg-background"
              >
                + {ev}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
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
            disabled={submitting}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create webhook"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RevealSecretModal({
  created,
  onClose,
}: {
  created: CreatedWebhook;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.rawSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal onClose={onClose} title="Webhook secret">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Webhook <strong className="text-foreground">{created.label}</strong>{" "}
          created. Use this secret to verify HMAC-SHA256 signatures on incoming
          payloads. Save it now — it won&apos;t be shown again.
        </p>
        <div className="rounded border border-foreground/30 bg-surface p-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-xs">
              {created.rawSecret}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded border border-border p-2 transition-colors hover:bg-background"
              title="Copy"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Signature verification snippet */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowVerify((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ShieldCheck className="size-3.5" />
            {showVerify ? "Hide verification code" : "Show signature verification code"}
          </button>
          {showVerify && (
            <WebhookVerifySnippet secret={created.rawSecret} />
          )}
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <button
            onClick={onClose}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            I&apos;ve saved it
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
