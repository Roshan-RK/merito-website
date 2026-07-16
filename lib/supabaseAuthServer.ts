import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabaseAuth";

/**
 * Cookie-aware, RLS-respecting client for Server Components and Route
 * Handlers. Create a fresh one per request — never cache/share across
 * requests, since it carries per-request cookie state.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component during render, where cookies
          // can't be set. Safe to ignore here — proxy.ts refreshes the
          // session on every request, so an expired write here doesn't
          // strand the user; Route Handlers (which CAN set cookies) are
          // where session writes actually need to succeed.
        }
      },
    },
  });
}
