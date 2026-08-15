import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api, getAppendix } from "@/lib/api-reference";
import { Markdown } from "@/components/docs/Markdown";

export function generateStaticParams() {
  return Object.values(api.appendices).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getAppendix(slug);
  if (!a) return { title: "Not found" };
  return { title: a.title };
}

export default async function AppendixPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getAppendix(slug);
  if (!a) notFound();

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
        <Link href="/docs#appendices" className="hover:text-foreground">
          Appendices
        </Link>
      </nav>

      <h1 className="mt-6 text-3xl font-semibold lg:text-4xl">{a.title}</h1>

      <div className="mt-6">
        <Markdown>{a.markdown}</Markdown>
      </div>
    </div>
  );
}
