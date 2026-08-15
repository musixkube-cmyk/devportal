import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api-reference";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Musicosy API reference — 27 bounded domains with resources, endpoints, request/response schemas, and error codes.",
};

export default function ApiReferenceHome() {
  const firstDomain = api.domains[0];

  return (
    <div className="w-full">
      <p className="label-mono">Reference</p>
      <h1 className="mt-2 text-3xl font-semibold lg:text-4xl">API Reference</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        The Musicosy API is decomposed into {api.stats.domains} bounded
        domains. Each domain owns its resources and exposes versioned
        endpoints at <code className="font-mono text-sm">/v1/*</code>. Pick a
        domain to browse its resources and endpoints.
      </p>

      <div className="mt-8 divide-y divide-border border-y border-border">
        {api.domains.map((d) => (
          <Link
            key={d.slug}
            href={`/docs/api-reference/${d.slug}`}
            className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-medium">{d.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {d.owner} · {d.resources.length} resources ·{" "}
                {d.resources.reduce((n, r) => n + r.endpoints.length, 0)}{" "}
                endpoints
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      <DocsPager
        next={
          firstDomain && {
            label: firstDomain.name,
            href: `/docs/api-reference/${firstDomain.slug}`,
          }
        }
      />
    </div>
  );
}
