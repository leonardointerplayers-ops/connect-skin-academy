import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { isEmailConfigured, publicEnv } from "@/lib/env";

export const maxDuration = 60;

/**
 * Rotina diária (Vercel Cron — ver vercel.json). Protegida por CRON_SECRET.
 * 1. Notifica módulos liberados por data / dias após entrada.
 * 2. Lembrete de estudo para quem está há exatamente N ou 2N dias sem acessar.
 * 3. Aviso (único) de prova pendente para quem concluiu as aulas e não fez a prova.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary = { releases: 0, reminders: 0, examPending: 0, emails: 0, emailEnabled: isEmailConfigured() };

  // 1. Liberações programadas
  const { data: released } = await admin.rpc("fn_admin_notify_releases");
  summary.releases = Number(released ?? 0);

  const { data: settings } = await admin.from("app_settings").select("inactivity_alert_days, reminder_emails_enabled").maybeSingle();
  const days = settings?.inactivity_alert_days ?? 7;

  // 2. Lembretes de estudo
  const { data: inactive } = await admin
    .from("v_user_learning_summary")
    .select("user_id, full_name, email, days_since_activity, overall_percent, status, role_id")
    .eq("role_id", "collaborator")
    .eq("status", "active")
    .in("days_since_activity", [days, days * 2])
    .lt("overall_percent", 100);

  for (const u of inactive ?? []) {
    const { error } = await admin.from("notifications").insert({
      user_id: u.user_id,
      type: "study_reminder",
      title: "Sentimos sua falta 👋",
      body: `Faz ${u.days_since_activity} dias desde seu último acesso. Que tal continuar sua trilha hoje?`,
      link: "/inicio",
      dedupe_key: `reminder:${new Date().toISOString().slice(0, 10)}`,
    });
    if (error) continue;
    summary.reminders++;
    if (settings?.reminder_emails_enabled !== false) {
      const r = await sendEmail({
        to: u.email,
        template: "studyReminder",
        userId: u.user_id,
        content: emailTemplates.studyReminder({ name: u.full_name, days: u.days_since_activity, percent: Number(u.overall_percent), url: `${publicEnv.appUrl}/inicio` }),
      });
      if (r.status === "sent") summary.emails++;
    }
  }

  // 3. Provas pendentes (aulas concluídas, prova não aprovada, sem tentativa em andamento)
  const { data: ready } = await admin
    .from("module_progress")
    .select("user_id, module_id, lessons_completed, lessons_total, exam_passed, profile:profiles!inner(email, full_name, status)")
    .eq("exam_required", true)
    .eq("exam_passed", false)
    .eq("profile.status", "active");

  type Row = { user_id: string; module_id: string; lessons_completed: number; lessons_total: number; profile: { email: string; full_name: string } };
  for (const r of (ready ?? []) as unknown as Row[]) {
    if (r.lessons_total === 0 || r.lessons_completed < r.lessons_total) continue;
    const { data: exam } = await admin
      .from("exams")
      .select("id, title, max_attempts")
      .eq("module_id", r.module_id)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (!exam) continue;
    const { count } = await admin.from("exam_attempts").select("id", { count: "exact", head: true }).eq("exam_id", exam.id).eq("user_id", r.user_id);
    if (count) continue; // já tentou: lembrete só para quem ainda não começou

    const { error } = await admin.from("notifications").insert({
      user_id: r.user_id,
      type: "exam_pending",
      title: "📝 Prova pendente",
      body: `Você concluiu as aulas. Falta a prova "${exam.title}".`,
      link: `/provas/${exam.id}`,
      dedupe_key: `exam_pending:${exam.id}`,
    });
    if (error) continue; // já avisado antes
    summary.examPending++;
    const sent = await sendEmail({
      to: r.profile.email,
      template: "examPending",
      userId: r.user_id,
      content: emailTemplates.examPending({ name: r.profile.full_name, exams: [exam.title], url: `${publicEnv.appUrl}/provas/${exam.id}` }),
    });
    if (sent.status === "sent") summary.emails++;
  }

  await admin.from("audit_logs").insert({ action: "cron.daily", entity_type: "system", summary: JSON.stringify(summary) });
  return NextResponse.json({ ok: true, ...summary });
}
