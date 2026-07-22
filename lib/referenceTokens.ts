import { randomBytes } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

const TOKEN_BYTES = 32;
const DEFAULT_VALIDITY_DAYS = 14;

export type TokenValidation =
  | { valid: true; refereeId: string }
  | { valid: false; reason: "not_found" | "expired" | "used" };

function getValidityDays(): number {
  const raw = Number(process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_VALIDITY_DAYS;
}

export async function createRefereeToken(refereeId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + getValidityDays() * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("reference_tokens").insert({
    token,
    reference_id: refereeId,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create reference token: ${error.message}`);
  }

  return token;
}

export async function validateRefereeToken(token: string): Promise<TokenValidation> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_tokens")
    .select("reference_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, reason: "not_found" };
  }
  if (data.used_at) {
    return { valid: false, reason: "used" };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, refereeId: data.reference_id };
}

export async function consumeRefereeToken(token: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("reference_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  if (error) {
    throw new Error(`Failed to consume reference token: ${error.message}`);
  }
}
