"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * CodeSnippet — tabbed code examples for the dashboard.
 *
 * Renders a small tab bar (curl / JS / Python) with a copy button. The
 * `secret` prop is interpolated into the code so users can copy a
 * ready-to-paste command immediately after creating or rolling a key.
 *
 * When `secret` is undefined or masked, we substitute `sk_live_YOUR_KEY`
 * so the snippet is still useful as a template.
 *
 * Usage:
 *   <CodeSnippet secret="sk_live_abc123..." />
 *   <CodeSnippet />  // shows template with sk_live_YOUR_KEY placeholder
 */

type Lang = "curl" | "js" | "python";

const TABS: { id: Lang; label: string }[] = [
  { id: "curl", label: "curl" },
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export function CodeSnippet({
  secret,
  endpoint = "/v1/_meta",
  method = "GET",
  title,
}: {
  secret?: string;
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  title?: string;
}) {
  const [active, setActive] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);

  const key = secret && /^sk_(live|test)_/.test(secret) ? secret : "sk_live_YOUR_KEY";
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://api.musicosy.com";
  // For consumer API calls, use the canonical external URL. For dev,
  // window.location.origin works (Next.js routes /api/v1/* to the gateway).
  const url = `${baseUrl}${endpoint}`;

  const snippets: Record<Lang, string> = {
    curl: `curl -X ${method} ${url} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Accept: application/json"`,
    js: `// npm install node-fetch (Node 18+ has fetch built-in)
const res = await fetch("${url}", {
  method: "${method}",
  headers: {
    "Authorization": "Bearer ${key}",
    "Accept": "application/json",
  },
});

if (!res.ok) {
  const err = await res.json();
  throw new Error(\`[\${err.error.code}] \${err.error.message}\`);
}

const data = await res.json();
console.log(data);`,
    python: `# pip install requests
import requests

resp = requests.${pyMethod(method)}(
    "${url}",
    headers={
        "Authorization": "Bearer ${key}",
        "Accept": "application/json",
    },
)

if not resp.ok:
    err = resp.json()
    raise Exception(f"[{err['error']['code']}] {err['error']['message']}")

data = resp.json()
print(data)`,
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippets[active]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore — clipboard may be blocked in some contexts */
    }
  }

  return (
    <div className="border border-border">
      {/* Tab bar */}
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

      {/* Code */}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono">{snippets[active]}</code>
      </pre>

      {title && (
        <div className="border-t border-border bg-surface px-4 py-2">
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      )}
    </div>
  );
}

function pyMethod(method: string): string {
  // Map HTTP method to requests.<verb>
  switch (method) {
    case "GET":
      return "get";
    case "POST":
      return "post";
    case "PUT":
      return "put";
    case "PATCH":
      return "patch";
    case "DELETE":
      return "delete";
    default:
      return "get";
  }
}
