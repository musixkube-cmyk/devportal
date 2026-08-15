"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * WebhookVerifySnippet — shows how to verify HMAC-SHA256 webhook signatures.
 *
 * Musicosy signs every webhook delivery with HMAC-SHA256 using the
 * webhook's `whsec_...` secret. The signature is sent in the
 * `X-Musicosy-Signature` header as a hex-encoded string.
 *
 * This component renders tabbed code examples (Node.js / Python / Go)
 * that recipients can paste into their webhook handler to verify
 * signatures. The `secret` prop is interpolated into the code so users
 * can test immediately after creating a webhook.
 *
 * When `secret` is undefined, we substitute `whsec_YOUR_SECRET` as a
 * placeholder.
 */

type Lang = "node" | "python" | "go";

const TABS: { id: Lang; label: string }[] = [
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
];

export function WebhookVerifySnippet({ secret }: { secret?: string }) {
  const [active, setActive] = useState<Lang>("node");
  const [copied, setCopied] = useState(false);

  const signingSecret =
    secret && secret.startsWith("whsec_") ? secret : "whsec_YOUR_SECRET";

  const snippets: Record<Lang, string> = {
    node: `// Node.js (Express) — verify Musicosy webhook signature
import crypto from "node:crypto";

app.post("/webhooks/musicosy", (req, res) => {
  const signature = req.headers["x-musicosy-signature"];
  if (!signature) {
    return res.status(401).send("Missing signature");
  }

  // Raw body is required — use express.raw() for this route
  const rawBody = req.body; // Buffer

  const expected = crypto
    .createHmac("sha256", "${signingSecret}")
    .update(rawBody)
    .digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).send("Invalid signature");
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  console.log("Received event:", event.type);

  // TODO: handle the event
  res.status(200).send("OK");
});`,
    python: `# Python (Flask) — verify Musicosy webhook signature
import hmac
import hashlib
from flask import Flask, request, abort

app = Flask(__name__)

@app.route("/webhooks/musicosy", methods=["POST"])
def webhook():
    signature = request.headers.get("X-Musicosy-Signature")
    if not signature:
        abort(401)

    # Raw body is required — do not parse JSON before verifying
    raw_body = request.get_data()

    expected = hmac.new(
        b"${signingSecret}",
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    if not hmac.compare_digest(signature, expected):
        abort(401)

    event = request.get_json()
    print(f"Received event: {event['type']}")

    # TODO: handle the event
    return "OK", 200`,
    go: `// Go (net/http) — verify Musicosy webhook signature
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
)

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	signature := r.Header.Get("X-Musicosy-Signature")
	if signature == "" {
		http.Error(w, "Missing signature", 401)
		return
	}

	// Read raw body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", 400)
		return
	}

	mac := hmac.New(sha256.New, []byte("${signingSecret}"))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expected)) {
		http.Error(w, "Invalid signature", 401)
		return
	}

	// TODO: parse JSON body and handle the event
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}`,
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippets[active]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface px-2">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`border-b-2 px-3 py-2 font-mono text-xs transition-colors ${
                active === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          title="Copy"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono whitespace-pre">{snippets[active]}</code>
      </pre>
    </div>
  );
}
