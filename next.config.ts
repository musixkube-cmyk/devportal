import type { NextConfig } from "next";
import redirects from "./src/data/domain-redirects.json";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the IM gateway's preview-chat and preview-<bot-id> hostnames to
  // load /_next/* (JS chunks, HMR websocket) from the dev server. Without
  // this, Next.js 16 blocks cross-origin /_next/* requests, the dashboard
  // page never hydrates, the fetch to /api/dashboard/keys never fires, and
  // the user sees only the SSR skeleton forever ("API key does not render").
  allowedDevOrigins: [
    "preview-chat-*.space-z.ai",
    "preview-*.space-z.ai",
    "*.space-z.ai",
    "localhost",
    "127.0.0.1",
    "21.0.16.199",
  ],
  // 308 permanent redirects from old "d1".."d27" URL slugs to the new
  // SEO-friendly kebab-case slugs (e.g. /docs/api-reference/d1 ->
  // /docs/api-reference/identity-and-social-graph). Preserves any
  // inbound links, search-index entries, and bookmarks.
  async redirects() {
    return redirects;
  },
};

export default nextConfig;
