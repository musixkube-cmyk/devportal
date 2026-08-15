// Public re-exports for the four Supabase client shapes used across the app.

export { createBrowserClient } from "./client";
export { createServerClient } from "./server"; // async — await it
export { createMiddlewareClient } from "./middleware";
export { createAdminClient } from "./admin";
export { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_COOKIE_NAME } from "./env";
