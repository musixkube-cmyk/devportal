import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import {
  api,
  getDomain,
  getResource,
  type Endpoint,
} from "@/lib/api-reference";
import { DocsPager } from "@/components/docs/DocsPager";

export function generateStaticParams() {
  return api.domains.flatMap((d) =>
    d.resources.map((r) => ({ domain: d.slug, resource: r.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; resource: string }>;
}): Promise<Metadata> {
  const { domain, resource } = await params;
  const { domain: d, resource: r } = getResource(domain, resource);
  if (!d || !r) return { title: "Not found" };
  return {
    title: `${r.name} — ${d.name}`,
    description: `${r.name} resource reference: ${r.endpoints.length} endpoints with request/response schemas, parameters, and error codes.`,
  };
}

const METHOD_COLORS: Record<string, string> = {
  GET: "border-emerald-600/40 text-emerald-700 bg-emerald-50",
  POST: "border-blue-600/40 text-blue-700 bg-blue-50",
  PUT: "border-amber-600/40 text-amber-700 bg-amber-50",
  PATCH: "border-purple-600/40 text-purple-700 bg-purple-50",
  DELETE: "border-rose-600/40 text-rose-700 bg-rose-50",
  WS: "border-cyan-600/40 text-cyan-700 bg-cyan-50",
};

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ domain: string; resource: string }>;
}) {
  const { domain: domainSlug, resource: resourceSlug } = await params;
  const { domain, resource } = getResource(domainSlug, resourceSlug);
  if (!domain || !resource) notFound();

  // Linear prev/next across the whole API reference:
  //   prev = previous resource in this domain, or this domain page,
  //          or previous domain's last resource
  //   next = next resource in this domain, or next domain page,
  //          or undefined (end of reference)
  const domainIndex = api.domains.findIndex((d) => d.slug === domain.slug);
  const resourceIndex = domain.resources.findIndex(
    (r) => r.slug === resource.slug,
  );
  const prevResourceInDomain = domain.resources[resourceIndex - 1];
  const nextResourceInDomain = domain.resources[resourceIndex + 1];
  const prevDomain = api.domains[domainIndex - 1];
  const nextDomain = api.domains[domainIndex + 1];

  const prevItem = prevResourceInDomain
    ? {
        label: `${domain.name} · ${prevResourceInDomain.name}`,
        href: `/docs/api-reference/${domain.slug}/${prevResourceInDomain.slug}`,
      }
    : {
        label: domain.name,
        href: `/docs/api-reference/${domain.slug}`,
      };
  const nextItem = nextResourceInDomain
    ? {
        label: `${domain.name} · ${nextResourceInDomain.name}`,
        href: `/docs/api-reference/${domain.slug}/${nextResourceInDomain.slug}`,
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
        <ChevronRight className="size-3" />
        <Link
          href={`/docs/api-reference/${domain.slug}`}
          className="hover:text-foreground"
        >
          {domain.name}
        </Link>
      </nav>

      <p className="label-mono mt-6">{domain.name}</p>
      <h1 className="mt-1 text-3xl font-semibold lg:text-4xl">
        {resource.name}
      </h1>
      {resource.intro && (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {resource.intro.split("\n")[0]}
        </p>
      )}

      <div className="mt-10 space-y-12">
        {resource.endpoints.map((ep, i) => (
          <EndpointBlock key={i} ep={ep} />
        ))}
      </div>

      <DocsPager prev={prevItem} next={nextItem} />
    </div>
  );
}

function EndpointBlock({ ep }: { ep: Endpoint }) {
  const methodClass =
    METHOD_COLORS[ep.method] ?? "border-border text-muted-foreground";
  const anchor = `${ep.method}-${ep.path}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  return (
    <section id={anchor} className="scroll-mt-24">
      {/* Header with method badge + path */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-block w-fit border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${methodClass}`}
        >
          {ep.method}
        </span>
        <code className="font-mono text-sm font-medium break-all">
          {ep.path}
        </code>
      </div>
      <p className="mt-2 text-sm text-foreground/90">{ep.title}</p>

      {/* Meta badges */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {ep.auth && (
          <span>
            <span className="text-foreground/60">Auth:</span> {ep.auth}
          </span>
        )}
        {ep.idempotent && (
          <span>
            <span className="text-foreground/60">Idempotent:</span>{" "}
            {ep.idempotent}
          </span>
        )}
        {ep.rateLimit && (
          <span>
            <span className="text-foreground/60">Rate limit:</span>{" "}
            {ep.rateLimit}
          </span>
        )}
      </div>

      {/* Request body */}
      {ep.requestBody && (
        <div className="mt-5">
          <p className="label-mono mb-1.5">Request body</p>
          <pre className="overflow-x-auto border border-border bg-code p-4 font-mono text-[12.5px] leading-relaxed">
            {ep.requestBody}
          </pre>
        </div>
      )}

      {/* Body params table */}
      {ep.bodyParams.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-1.5">Body parameters</p>
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-3 py-2 text-left label-mono">Field</th>
                  <th className="px-3 py-2 text-left label-mono">Type</th>
                  <th className="px-3 py-2 text-left label-mono">Required</th>
                  <th className="px-3 py-2 text-left label-mono">Description</th>
                </tr>
              </thead>
              <tbody>
                {ep.bodyParams.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top font-mono text-[12px] font-medium">
                      {row.Field ?? row.field}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[12px] text-muted-foreground">
                      {row.Type ?? row.type}
                    </td>
                    <td className="px-3 py-2 align-top text-[12px] text-muted-foreground">
                      {row.Required ?? row.required}
                    </td>
                    <td className="px-3 py-2 align-top text-[13px] text-foreground/80">
                      {row.Description ?? row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Query params table */}
      {ep.queryParams.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-1.5">Query parameters</p>
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-3 py-2 text-left label-mono">Parameter</th>
                  <th className="px-3 py-2 text-left label-mono">Type</th>
                  <th className="px-3 py-2 text-left label-mono">Default</th>
                  <th className="px-3 py-2 text-left label-mono">Description</th>
                </tr>
              </thead>
              <tbody>
                {ep.queryParams.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top font-mono text-[12px] font-medium">
                      {row.Parameter ?? row.parameter}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[12px] text-muted-foreground">
                      {row.Type ?? row.type}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[12px] text-muted-foreground">
                      {row.Default ?? row.default ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[13px] text-foreground/80">
                      {row.Description ?? row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Response */}
      {ep.responseBody && (
        <div className="mt-5">
          <p className="label-mono mb-1.5">Response</p>
          <pre className="overflow-x-auto border border-border bg-code p-4 font-mono text-[12.5px] leading-relaxed">
            {ep.responseBody}
          </pre>
        </div>
      )}

      {/* Error codes */}
      {ep.errorCodes.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-1.5">Error codes</p>
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-3 py-2 text-left label-mono">Code</th>
                  <th className="px-3 py-2 text-left label-mono">HTTP</th>
                  <th className="px-3 py-2 text-left label-mono">Description</th>
                </tr>
              </thead>
              <tbody>
                {ep.errorCodes.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top font-mono text-[12px] font-medium">
                      {row.Code ?? row.code}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[12px] text-muted-foreground">
                      {row.HTTP ?? row.http}
                    </td>
                    <td className="px-3 py-2 align-top text-[13px] text-foreground/80">
                      {row.Description ?? row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
