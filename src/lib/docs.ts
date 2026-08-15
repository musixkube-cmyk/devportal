import inventory from "@/data/inventory.json";

export type Feature = {
  name: string;
  slug: string;
  goal: string;
  actions: string[];
  routes: string;
  components: string;
  apis: string[];
  rules: string[];
};

export type Section = {
  title: string;
  slug: string;
  features: Feature[];
};

export const sections = inventory as Section[];

export const totalFeatures = sections.reduce((n, s) => n + s.features.length, 0);

export const totalEndpoints = sections.reduce(
  (n, s) => n + s.features.reduce((m, f) => m + f.apis.filter(isEndpoint).length, 0),
  0,
);

export function isEndpoint(api: string) {
  return /^(GET|POST|PUT|PATCH|DELETE|WS)\s/i.test(api);
}

export function parseEndpoint(api: string) {
  const [, method, path] = api.match(/^(\w+)\s+(.*)$/) ?? [];
  return { method: method ?? "GET", path: path ?? api };
}

export function getSection(slug: string) {
  return sections.find((s) => s.slug === slug);
}

export function getFeature(sectionSlug: string, featureSlug: string) {
  const section = getSection(sectionSlug);
  return {
    section,
    feature: section?.features.find((f) => f.slug === featureSlug),
  };
}

export function groupLabel(title: string) {
  const [group, name] = title.split(" - ").map((p) => p.trim());
  return { group: group ?? title, name: name ?? title };
}

export type SearchHit = {
  sectionSlug: string;
  sectionTitle: string;
  slug: string;
  name: string;
  goal: string;
  haystack: string;
};

export const searchIndex: SearchHit[] = sections.flatMap((s) =>
  s.features.map((f) => ({
    sectionSlug: s.slug,
    sectionTitle: s.title,
    slug: f.slug,
    name: f.name,
    goal: f.goal,
    haystack: [f.name, f.goal, f.routes, f.components, ...f.apis, ...f.actions]
      .join(" ")
      .toLowerCase(),
  })),
);

export function search(query: string, limit = 24): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return searchIndex
    .map((hit) => {
      let score = 0;
      for (const t of terms) {
        if (hit.name.toLowerCase().includes(t)) score += 3;
        else if (hit.haystack.includes(t)) score += 1;
        else return null;
      }
      return { hit, score };
    })
    .filter((r): r is { hit: SearchHit; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.hit);
}
