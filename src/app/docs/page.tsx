import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Compass, Code2, Layers } from "lucide-react";
import { api } from "@/lib/api-reference";

export const metadata: Metadata = {
  title: "Musicosy API Documentation",
  description:
    "Musicosy platform API reference: 27 domains, 163 resources, 399 endpoints with full request/response schemas, params, and error codes.",
};

export default function DocsHome() {
  const { stats } = api;

  const cards = [
    {
      href: "/docs/getting-started/quickstart",
      icon: Compass,
      title: "Getting Started",
      desc: "Quickstart, authentication, API conventions, rate limits, and file uploads.",
    },
    {
      href: "/docs/guides/shared-state-machines",
      icon: BookOpen,
      title: "Guides",
      desc: "Shared state machines and the domain ownership matrix.",
    },
    {
      href: "/docs/api-reference/d1",
      icon: Code2,
      title: "API Reference",
      desc: `${stats.domains} domains, ${stats.resources} resources, ${stats.endpoints} endpoints with request/response schemas.`,
    },
    {
      href: "/docs/appendices/ui-components",
      icon: Layers,
      title: "Appendices",
      desc: "UI components, modals, and the feature-to-domain cross-reference index.",
    },
  ];

  return (
    <div className="w-full">
      <p className="label-mono">Musicosy API · v1.0.0</p>
      <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">
        Musicosy API Documentation
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Programmatic access to the Musicosy platform — identity, content,
        commerce, distribution, analytics, and more. Base URL{" "}
        <code className="font-mono text-sm">
          https://api.musicosy.com/v1
        </code>
        .
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Domains", stats.domains],
          ["Resources", stats.resources],
          ["Endpoints", stats.endpoints],
          ["Getting Started", `${stats.gettingStartedPages} pages`],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-border p-4">
            <dt className="label-mono">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">
              {value as string | number}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {cards.map(({ href, icon: I, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group block border border-border p-6 transition-colors hover:bg-surface"
          >
            <I className="size-5 text-muted-foreground" />
            <h2 className="mt-3 font-display text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-transform group-hover:translate-x-1">
              Open <ArrowRight className="size-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
