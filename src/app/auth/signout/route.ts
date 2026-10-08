import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    await logAudit("auth.logout", "session", data.claims.sub as string, null);
  }
  await supabase.auth.signOut();

  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  const reason = request.nextUrl.searchParams.get("reason");
  if (reason === "inactive" || reason === "noprofile") target.searchParams.set("error", reason);
  return NextResponse.redirect(target, { status: 303 });
}

export const POST = signOut;
// GET usado apenas no redirecionamento automático de contas desativadas.
export const GET = signOut;
