import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api, getGuide } from "@/lib/api-reference";
import { Markdown } from "@/components/docs/Markdown";
import { DocsPager } from "@/components/docs/DocsPager";

export function generateStaticParams() {
  return api.guides.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getGuide(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getGuide(slug);
  if (!page) notFound();

  const index = api.guides.findIndex((p) => p.slug === slug);
  const prev = api.guides[index - 1];
  const next = api.guides[index + 1];

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
        <Link href="/docs#guides" className="hover:text-foreground">
          Guides
        </Link>
      </nav>

      <h1 className="mt-6 text-3xl font-semibold lg:text-4xl">{page.title}</h1>

      <div className="mt-6">
        <Markdown>{page.markdown}</Markdown>
      </div>

      <DocsPager
        prev={prev ? { label: prev.title, href: `/docs/guides/${prev.slug}` } : undefined}
        next={next ? { label: next.title, href: `/docs/guides/${next.slug}` } : undefined}
      />
    </div>
  );
}
