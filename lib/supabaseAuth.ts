import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).");
  }

  return { url, anonKey };
}

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

/** Browser client for client components (e.g. the login page). */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
