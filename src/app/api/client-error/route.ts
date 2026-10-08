import { NextResponse, type NextRequest } from "next/server";
import { getSessionClaims } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

/** Recebe erros do navegador (telas de erro) e registra em audit_logs para diagnóstico. */
export async function POST(request: NextRequest) {
  const claims = await getSessionClaims();
  if (!claims) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = (await request.json()) as { message?: string; digest?: string; path?: string; stack?: string };
    await createAdminClient()
      .from("audit_logs")
      .insert({
        actor_id: claims.userId,
        action: "system.client_error",
        entity_type: "browser",
        entity_id: String(body.path ?? "").slice(0, 300),
        summary: String(body.message ?? "").slice(0, 500),
        changes: { digest: body.digest ?? null, stack: String(body.stack ?? "").slice(0, 2000), ua: request.headers.get("user-agent") },
      });
  } catch {}
  return NextResponse.json({ ok: true });
}
