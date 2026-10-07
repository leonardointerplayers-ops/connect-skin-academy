import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Diagnóstico de configuração (sem expor segredos): Supabase alcançável,
 * migrações executadas e quantidade de usuários. Usado no setup inicial.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const report: Record<string, unknown> = {
    supabaseProject: url ? new URL(url).hostname.split(".")[0] : null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 12)}…` : null,
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    cronSecret: Boolean(process.env.CRON_SECRET),
    email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
  };

  try {
    const settings = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      cache: "no-store",
    });
    report.authReachable = settings.status;
  } catch (err) {
    report.authReachable = String(err);
  }

  try {
    const admin = createAdminClient();
    const [{ count: courses, error: e1 }, { count: profiles, error: e2 }, { data: admins }, users] = await Promise.all([
      admin.from("courses").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("status").eq("role_id", "admin"),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    report.migrations = e1 ? `erro: ${e1.code} ${e1.message}` : `ok (${courses} trilha(s))`;
    report.profiles = e2 ? `erro: ${e2.code}` : profiles;
    report.admins = (admins ?? []).length;
    report.authUsers = users.error ? `erro: ${users.error.message}` : users.data.users.length;
    report.authUsersConfirmed = users.error ? null : users.data.users.filter((u) => u.email_confirmed_at).length;
  } catch (err) {
    report.adminError = err instanceof Error ? err.message : String(err);
  }

  const token = new URL(request.url).searchParams.get("token");
  if (token && process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
    try {
      const { data } = await createAdminClient()
        .from("audit_logs")
        .select("created_at, entity_id, summary, changes")
        .eq("action", "system.error")
        .order("created_at", { ascending: false })
        .limit(10);
      report.recentErrors = data;
      const { data: actions } = await createAdminClient()
        .from("audit_logs")
        .select("created_at, action, entity_type, summary")
        .neq("action", "system.error")
        .order("created_at", { ascending: false })
        .limit(25);
      report.recentActions = actions;
    } catch {}
  }

  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
