import type { NextConfig } from "next";
import redirects from "./src/data/domain-redirects.json";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // 308 permanent redirects from old "d1".."d27" URL slugs to the new
  // SEO-friendly kebab-case slugs (e.g. /docs/api-reference/d1 ->
  // /docs/api-reference/identity-and-social-graph). Preserves any
  // inbound links, search-index entries, and bookmarks.
  async redirects() {
    return redirects;
  },
};

export default nextConfig;
