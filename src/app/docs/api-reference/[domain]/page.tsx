import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, ArrowRight } from "lucide-react";
import { api, getDomain } from "@/lib/api-reference";
import { DocsPager } from "@/components/docs/DocsPager";

export function generateStaticParams() {
  return api.domains.map((d) => ({ domain: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) return { title: "Not found" };
  return {
    title: d.name,
    description: `${d.name} domain reference: ${d.resources.length} resources with endpoints, request/response schemas, and error codes.`,
  };
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) notFound();

  const totalEndpoints = d.resources.reduce(
    (n, r) => n + r.endpoints.length,
    0,
  );

  // Linear prev/next across the whole API reference:
  //   prev = previous domain's last resource, or API Reference home
  //   next = first resource of this domain, or next domain, or none
  const domainIndex = api.domains.findIndex((x) => x.slug === d.slug);
  const prevDomain = api.domains[domainIndex - 1];
  const nextDomain = api.domains[domainIndex + 1];
  const firstResource = d.resources[0];
  const prevResource = prevDomain?.resources[prevDomain.resources.length - 1];

  const prevItem = prevResource
    ? {
        label: `${prevDomain.name} · ${prevResource.name}`,
        href: `/docs/api-reference/${prevDomain.slug}/${prevResource.slug}`,
      }
    : { label: "API Reference", href: "/docs/api-reference" };
  const nextItem = firstResource
    ? {
        label: `${d.name} · ${firstResource.name}`,
        href: `/docs/api-reference/${d.slug}/${firstResource.slug}`,
      }
    : nextDomain
      ? { label: nextDomain.name, href: `/docs/api-reference/${nextDomain.slug}` }
      : undefined;

  return (
    <div className="w-full">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted-foreground"
      >
        <Link href="/docs" className="hover:text-foreground">
          Docs
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href="/docs/api-reference"
          className="hover:text-foreground"
        >
          API Reference
        </Link>
      </nav>

      <p className="label-mono mt-6">Domain</p>
      <h1 className="mt-1 text-3xl font-semibold lg:text-4xl">{d.name}</h1>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="label-mono">Owner</dt>
          <dd className="mt-0.5 text-sm">{d.owner}</dd>
        </div>
        <div>
          <dt className="label-mono">Base path</dt>
          <dd className="mt-0.5 font-mono text-sm">{d.basePath}</dd>
        </div>
        <div>
          <dt className="label-mono">Endpoints</dt>
          <dd className="mt-0.5 text-sm">
            {d.resources.length} resources · {totalEndpoints} endpoints
          </dd>
        </div>
      </dl>

      <h2 className="mt-10 text-lg font-semibold">Resources</h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {d.resources.map((r) => (
          <Link
            key={r.slug}
            href={`/docs/api-reference/${d.slug}/${r.slug}`}
            className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-medium">{r.name}</p>
              {r.intro && (
                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                  {r.intro.split("\n")[0]}
                </p>
              )}
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {r.endpoints.length} endpoints
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      <DocsPager prev={prevItem} next={nextItem} />
    </div>
  );
}
