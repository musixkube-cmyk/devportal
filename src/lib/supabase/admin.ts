import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IS_SUPABASE_CONFIGURED } from "./env";

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
 *
 * If the service-role key is missing, returns a no-op stub so the app
 * still loads — admin routes will see empty data.
 */
export function createAdminClient() {
  if (!IS_SUPABASE_CONFIGURED || !SUPABASE_SERVICE_ROLE_KEY) {
    return createNoOpAdminClient();
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

function createNoOpAdminClient() {
  return {
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: null }, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: async () => ({ data: { user: null }, error: null }),
        deleteUser: async () => ({ data: {}, error: null }),
      },
    },
    from: () => ({
      select: () => ({ data: [], error: null, single: async () => ({ data: null, error: null }) }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>;
}
