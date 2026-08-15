import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Compass, Code2, Layers, KeyRound } from "lucide-react";
import { api } from "@/lib/api-reference";

export const metadata: Metadata = {
  title: "Musicosy API Documentation",
  description:
    "Musicosy platform API reference: 27 domains, 163 resources, 399 endpoints with full request/response schemas, params, and error codes.",
};

export default function Landing() {
  const { stats } = api;

  const cards = [
    {
      href: "/docs/getting-started/quickstart",
      icon: Compass,
      label: "Getting Started",
      desc: "Quickstart, authentication, API conventions, rate limits, and file uploads.",
    },
    {
      href: "/docs/guides/shared-state-machines",
      icon: BookOpen,
      label: "Guides",
      desc: "Shared state machines and the domain ownership matrix.",
    },
    {
      href: "/docs/api-reference",
      icon: Code2,
      label: "API Reference",
      desc: `${stats.domains} domains, ${stats.resources} resources, ${stats.endpoints} endpoints with request/response schemas.`,
    },
    {
      href: "/docs/appendices/feature-index",
      icon: Layers,
      label: "Appendices",
      desc: "UI components, modals, and the feature-to-domain cross-reference index.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center border border-foreground font-mono text-[11px] font-bold">
              M
            </span>
            <span className="font-display text-sm font-semibold">Musicosy</span>
          </Link>
          <nav className="flex items-center gap-5 text-xs">
            <Link
              href="/docs"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/docs/api-reference"
              className="font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              API Reference
            </Link>
            <Link
              href="/docs/appendices/feature-index"
              className="border border-foreground px-3 py-1.5 font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              Feature inventory
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 grid-paper opacity-30" />
        <div className="relative mx-auto w-full max-w-[1100px] px-6 py-20 lg:px-10 lg:py-28">
          <p className="label-mono">Musicosy API · v1.0.0</p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl">
            The complete Musicosy platform reference.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
            Bounded domains, API contracts, modal specifications, UI component
            classification, and the full feature inventory — in one searchable
            place for every team building Musicosy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/docs/getting-started/quickstart"
              className="inline-flex items-center gap-2 bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              Get started <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs/getting-started/authentication"
              className="inline-flex items-center gap-2 border border-foreground px-4 py-2.5 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              <KeyRound className="size-4" />
              Get your API key
            </Link>
            <Link
              href="/docs/api-reference"
              className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
            >
              Browse API reference
            </Link>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Domains", stats.domains],
              ["Resources", stats.resources],
              ["Endpoints", stats.endpoints],
              ["Getting Started", `${stats.gettingStartedPages} pages`],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="border border-border p-4"
              >
                <dt className="label-mono">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">
                  {value as string | number}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1100px] px-6 py-20 lg:px-10">
        <div className="grid gap-6 sm:grid-cols-2">
          {cards.map(({ href, icon: I, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group block border border-border p-6 transition-colors hover:bg-surface lg:p-8"
            >
              <I className="size-5 text-muted-foreground" />
              <h2 className="mt-3 font-display text-lg font-semibold">
                {label}
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
      </section>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-8 font-mono text-[11px] text-muted-foreground lg:px-10">
          Musicosy Developer Portal · v2 · Architecture &amp; API reference
        </div>
      </footer>
    </div>
  );
}
