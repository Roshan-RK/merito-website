import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";

export class ReauthRequiredError extends Error {
  constructor() {
    super("Your session is too old for this action. Sign out and sign back in with a fresh magic link, then retry.");
    this.name = "ReauthRequiredError";
  }
}

/** Parse ADMIN_EMAIL (comma-separated list of one or more emails) into a normalized allowlist. */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL;
  if (!raw) {
    throw new Error("Admin area is not configured (ADMIN_EMAIL missing).");
  }
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    throw new Error("Admin area is not configured (ADMIN_EMAIL missing).");
  }
  return emails;
}

export async function requireAdmin() {
  const adminEmails = getAdminEmails();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login?next=/admin");
  }

  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    notFound();
  }

  return user;
}

const RECENT_AUTH_MAX_AGE_MINUTES = 30;

/**
 * For destructive actions (ban/delete/refund): requires a magic-link sign-in
 * within the last 30 min, not just a valid session — Supabase refresh tokens
 * keep sessions alive indefinitely, so session validity alone doesn't bound
 * how long ago the admin actually proved identity. Call inside the route's
 * existing try/catch alongside enforceAdminRateLimit, after requireAdmin().
 */
export function assertRecentAuth(admin: { last_sign_in_at?: string }, maxAgeMinutes: number = RECENT_AUTH_MAX_AGE_MINUTES) {
  const lastSignInAt = admin.last_sign_in_at ? new Date(admin.last_sign_in_at).getTime() : NaN;
  if (Number.isNaN(lastSignInAt)) {
    throw new ReauthRequiredError();
  }

  const ageMinutes = (Date.now() - lastSignInAt) / 60_000;
  if (ageMinutes > maxAgeMinutes) {
    throw new ReauthRequiredError();
  }
}
