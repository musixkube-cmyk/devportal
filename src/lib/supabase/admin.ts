import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses Row Level Security — DO NOT use in browser code.
 *
 * Use cases:
 *  - Reading/writing app data on behalf of a user whose session we've already
 *    verified (we trust the JWT, we don't need RLS to enforce it).
 *  - Looking up users by id (admin operations).
 *
 * Never expose this client to the browser. The service role key is only ever
 * read from process.env on the server.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local on the server.",
    );
  }
  return createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // We don't auto-persist the service role's session — it's stateless.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
