import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { createOrUpdateShareLink, getShareLink } from "@/lib/reportShareTokens";
import { getAbsoluteUrl } from "@/lib/site";

export const runtime = "nodejs";

const BodySchema = z.object({
  roleTitle: z.string().trim().min(1),
  include: z.string(),
  interviewSections: z.string(),
});

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const roleTitle = url.searchParams.get("role");
  if (!roleTitle) {
    return Response.json({ error: "Missing role." }, { status: 400 });
  }

  const link = await getShareLink({ userId: user.id, roleTitle });
  if (!link) {
    return Response.json({ url: null });
  }
  return Response.json({ url: getAbsoluteUrl(`/hub/share/${link.token}`), revoked: link.revoked });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token } = await createOrUpdateShareLink({
    userId: user.id,
    roleTitle: parsed.data.roleTitle,
    include: parsed.data.include,
    interviewSections: parsed.data.interviewSections,
  });

  return Response.json({ url: getAbsoluteUrl(`/hub/share/${token}`) });
}
