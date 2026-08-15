import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import {
  sections,
  totalFeatures,
  totalEndpoints,
  isEndpoint,
  parseEndpoint,
  groupLabel,
} from "@/lib/docs";

export const metadata: Metadata = {
  title: "Feature Index · Musicosy Docs",
  description:
    "Complete 296-feature inventory across 15 surfaces — routes, components, API endpoints, and permission rules per feature.",
};

export default function FeatureIndexPage() {
  const groups = new Map<string, typeof sections>();
  for (const s of sections) {
    const { group } = groupLabel(s.title);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(s);
  }

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
        <ChevronRight className="size-3" />
        <span className="text-foreground">Feature Index</span>
      </nav>

      <p className="label-mono mt-6">Appendix</p>
      <h1 className="mt-2 text-3xl font-semibold lg:text-4xl">Feature Index</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        The complete inventory of {totalFeatures} product features across{" "}
        {sections.length} surfaces — grouped by product context. Each feature
        lists its user-facing actions, route, UI components, API endpoints, and
        permission rules.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Features", totalFeatures],
          ["Surfaces", sections.length],
          ["Endpoints", totalEndpoints],
          ["Contexts", groups.size],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-border p-4">
            <dt className="label-mono">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">
              {value as string | number}
            </dd>
          </div>
        ))}
      </dl>

      {/* Quick-jump chips for each context group */}
      <div className="mt-10 flex flex-wrap gap-2">
        {Array.from(groups.keys()).map((g) => (
          <a
            key={g}
            href={`#${slugify(g)}`}
            className="border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            {g}
          </a>
        ))}
      </div>

      {/* Sections, grouped by context */}
      <div className="mt-12 space-y-16">
        {Array.from(groups.entries()).map(([group, secs]) => {
          const groupFeatureCount = secs.reduce(
            (n, s) => n + s.features.length,
            0,
          );
          return (
            <section key={group} id={slugify(group)} className="scroll-mt-24">
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <h2 className="font-display text-xl font-semibold">{group}</h2>
                <span className="label-mono">
                  {groupFeatureCount} features · {secs.length} surfaces
                </span>
              </div>

              <div className="mt-6 space-y-10">
                {secs.map((s) => {
                  const { name } = groupLabel(s.title);
                  return (
                    <div key={s.slug}>
                      <div className="flex items-baseline gap-3">
                        <h3 className="font-display text-base font-semibold">
                          {name}
                        </h3>
                        <span className="label-mono">
                          {s.features.length} features
                        </span>
                      </div>

                      <div className="mt-3 divide-y divide-border border-y border-border">
                        {s.features.map((f) => {
                          const endpoints = f.apis.filter(isEndpoint);
                          return (
                            <div
                              key={f.slug}
                              className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-8"
                            >
                              <div className="min-w-0">
                                <h4 className="font-display text-sm font-semibold text-foreground">
                                  {f.name}
                                </h4>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                  {f.goal}
                                </p>
                                {f.routes && (
                                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                                    <span className="text-foreground/60">
                                      route ·{" "}
                                    </span>
                                    {f.routes}
                                  </p>
                                )}
                              </div>

                              <div className="min-w-0 space-y-3 text-xs">
                                {f.actions.length > 0 && (
                                  <DetailRow
                                    label="Actions"
                                    items={f.actions}
                                  />
                                )}
                                {endpoints.length > 0 && (
                                  <DetailRow
                                    label="Endpoints"
                                    items={endpoints.map((e) => {
                                      const { method, path } = parseEndpoint(e);
                                      return `${method} ${path}`;
                                    })}
                                    mono
                                  />
                                )}
                                {f.components && (
                                  <DetailRow
                                    label="Components"
                                    items={f.components
                                      .split(",")
                                      .map((c) => c.trim())
                                      .filter(Boolean)}
                                    mono
                                  />
                                )}
                                {f.rules.length > 0 && (
                                  <DetailRow
                                    label="Rules"
                                    items={f.rules}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  items,
  mono,
}: {
  label: string;
  items: string[];
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
      <span className="label-mono pt-0.5">{label}</span>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className={
              mono
                ? "font-mono text-[11px] leading-relaxed text-muted-foreground"
                : "leading-relaxed text-muted-foreground"
            }
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
