import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, isStaffRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { toCSV, toXLSX, type Column } from "@/lib/export";
import { computeHealthScore, HEALTH_LABELS } from "@/lib/analytics/health";
import { logAudit } from "@/lib/audit";
import { listCollaborators } from "@/services/users";
import { ROLE_LABELS, STATUS_LABELS } from "@/config/app";
import type { UserLearningSummary } from "@/types/domain";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);

type Report = { name: string; rows: Record<string, unknown>[]; columns: Column<Record<string, unknown>>[] };

async function usersReport(sp: URLSearchParams): Promise<Report> {
  // Reaproveita os filtros da tela de colaboradores (sem paginação).
  const all: UserLearningSummary[] = [];
  for (let page = 1; page < 100; page++) {
    const r = await listCollaborators({
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      department: sp.get("department") ?? undefined,
      group: sp.get("group") ?? undefined,
      role: sp.get("role") ?? undefined,
      page,
    });
    all.push(...r.rows);
    if (all.length >= r.total || r.rows.length === 0) break;
  }
  const columns: Column<UserLearningSummary>[] = [
    { header: "Nome", value: (u) => u.full_name, width: 30 },
    { header: "E-mail", value: (u) => u.email, width: 30 },
    { header: "Cargo", value: (u) => u.job_title },
    { header: "Departamento", value: (u) => u.department },
    { header: "Área", value: (u) => u.area },
    { header: "Papel", value: (u) => ROLE_LABELS[u.role_id] },
    { header: "Status", value: (u) => STATUS_LABELS[u.status] },
    { header: "Entrada", value: (u) => u.joined_at },
    { header: "Último acesso", value: (u) => date(u.last_activity_at) },
    { header: "Dias sem acesso", value: (u) => u.days_since_activity },
    { header: "Progresso (%)", value: (u) => num(u.overall_percent) },
    { header: "Aulas concluídas", value: (u) => num(u.lessons_completed) },
    { header: "Módulos concluídos", value: (u) => num(u.modules_completed) },
    { header: "Trilhas concluídas", value: (u) => num(u.courses_completed) },
    { header: "Provas realizadas", value: (u) => num(u.exams_taken) },
    { header: "Tentativas", value: (u) => num(u.exam_attempts) },
    { header: "Nota média (%)", value: (u) => num(u.avg_best_score) },
    { header: "Tempo estudado (min)", value: (u) => Math.round(Number(u.time_studied_seconds ?? 0) / 60) },
    { header: "Prazos vencidos", value: (u) => num(u.overdue_items) },
    { header: "Pontos", value: (u) => u.total_points },
    {
      header: "Learning Health",
      value: (u) => {
        if (u.role_id !== "collaborator") return null;
        const h = computeHealthScore(u);
        return `${HEALTH_LABELS[h.level].label} (${h.score})`;
      },
    },
  ];
  return { name: "Colaboradores", rows: all as unknown as Record<string, unknown>[], columns: columns as unknown as Column<Record<string, unknown>>[] };
}

async function progressReport(): Promise<Report> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("module_progress")
    .select("percent, status, lessons_completed, lessons_total, best_score, exam_passed, started_at, completed_at, profile:profiles(full_name, email, department), module:modules(title, position, course:courses(title))")
    .limit(20000);
  type R = {
    percent: number; status: string; lessons_completed: number; lessons_total: number; best_score: number | null; exam_passed: boolean | null;
    started_at: string | null; completed_at: string | null;
    profile: { full_name: string; email: string; department: string | null } | null;
    module: { title: string; position: number; course: { title: string } | null } | null;
  };
  const columns: Column<R>[] = [
    { header: "Colaborador", value: (r) => r.profile?.full_name, width: 30 },
    { header: "E-mail", value: (r) => r.profile?.email, width: 30 },
    { header: "Departamento", value: (r) => r.profile?.department },
    { header: "Trilha", value: (r) => r.module?.course?.title, width: 28 },
    { header: "Módulo", value: (r) => (r.module ? `${String(r.module.position).padStart(2, "0")} · ${r.module.title}` : ""), width: 32 },
    { header: "Aulas", value: (r) => `${r.lessons_completed}/${r.lessons_total}` },
    { header: "Progresso (%)", value: (r) => num(r.percent) },
    { header: "Status", value: (r) => ({ not_started: "Não iniciado", in_progress: "Em andamento", completed: "Concluído" })[r.status] ?? r.status },
    { header: "Melhor nota (%)", value: (r) => num(r.best_score) },
    { header: "Prova aprovada", value: (r) => r.exam_passed },
    { header: "Início", value: (r) => date(r.started_at) },
    { header: "Conclusão", value: (r) => date(r.completed_at) },
  ];
  return { name: "Progresso", rows: (data ?? []) as unknown as Record<string, unknown>[], columns: columns as unknown as Column<Record<string, unknown>>[] };
}

async function examsReport(sp: URLSearchParams): Promise<Report> {
  const supabase = await createClient();
  let q = supabase
    .from("exam_attempts")
    .select("attempt_number, status, score_percent, passed, correct_count, wrong_count, time_spent_seconds, started_at, submitted_at, profile:profiles(full_name, email, department), exam:exams(title, passing_score)")
    .neq("status", "in_progress")
    .order("submitted_at", { ascending: false })
    .limit(20000);
  const exam = sp.get("exam");
  if (exam && /^[0-9a-f-]{36}$/i.test(exam)) q = q.eq("exam_id", exam);
  const { data } = await q;
  type R = {
    attempt_number: number; status: string; score_percent: number | null; passed: boolean | null; correct_count: number | null; wrong_count: number | null;
    time_spent_seconds: number | null; started_at: string; submitted_at: string | null;
    profile: { full_name: string; email: string; department: string | null } | null;
    exam: { title: string; passing_score: number } | null;
  };
  const columns: Column<R>[] = [
    { header: "Colaborador", value: (r) => r.profile?.full_name, width: 30 },
    { header: "E-mail", value: (r) => r.profile?.email, width: 30 },
    { header: "Departamento", value: (r) => r.profile?.department },
    { header: "Prova", value: (r) => r.exam?.title, width: 32 },
    { header: "Tentativa", value: (r) => r.attempt_number },
    { header: "Nota (%)", value: (r) => num(r.score_percent) },
    { header: "Nota mínima (%)", value: (r) => r.exam?.passing_score },
    { header: "Aprovado", value: (r) => r.passed },
    { header: "Acertos", value: (r) => r.correct_count },
    { header: "Erros", value: (r) => r.wrong_count },
    { header: "Tempo (min)", value: (r) => (r.time_spent_seconds ? Math.round(r.time_spent_seconds / 60) : null) },
    { header: "Situação", value: (r) => (r.status === "expired" ? "Tempo esgotado" : "Enviada") },
    { header: "Enviada em", value: (r) => date(r.submitted_at) },
  ];
  return { name: "Provas", rows: (data ?? []) as unknown as Record<string, unknown>[], columns: columns as unknown as Column<Record<string, unknown>>[] };
}

async function gradesReport(): Promise<Report> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_attempts")
    .select("user_id, exam_id, score_percent, passed, profile:profiles(full_name, email), exam:exams(title)")
    .neq("status", "in_progress")
    .limit(20000);
  type A = { user_id: string; exam_id: string; score_percent: number | null; passed: boolean | null; profile: { full_name: string; email: string } | null; exam: { title: string } | null };
  const map = new Map<string, { name: string; email: string; exam: string; best: number; attempts: number; passed: boolean }>();
  for (const a of (data ?? []) as unknown as A[]) {
    const k = `${a.user_id}:${a.exam_id}`;
    const e = map.get(k) ?? { name: a.profile?.full_name ?? "", email: a.profile?.email ?? "", exam: a.exam?.title ?? "", best: 0, attempts: 0, passed: false };
    e.best = Math.max(e.best, Number(a.score_percent ?? 0));
    e.attempts += 1;
    e.passed ||= Boolean(a.passed);
    map.set(k, e);
  }
  type R = { name: string; email: string; exam: string; best: number; attempts: number; passed: boolean };
  const columns: Column<R>[] = [
    { header: "Colaborador", value: (r) => r.name, width: 30 },
    { header: "E-mail", value: (r) => r.email, width: 30 },
    { header: "Prova", value: (r) => r.exam, width: 32 },
    { header: "Melhor nota (%)", value: (r) => r.best },
    { header: "Tentativas", value: (r) => r.attempts },
    { header: "Aprovado", value: (r) => r.passed },
  ];
  return { name: "Notas", rows: [...map.values()] as unknown as Record<string, unknown>[], columns: columns as unknown as Column<Record<string, unknown>>[] };
}

async function completionsReport(): Promise<Report> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_progress")
    .select("user_id, course_id, percent, status, modules_completed, modules_total, completed_at, profile:profiles(full_name, email, department), course:courses(title)")
    .limit(20000);
  const { data: certs } = await supabase.from("certificates").select("user_id, course_id, code, issued_at");
  const certMap = new Map((certs ?? []).map((c) => [`${c.user_id}:${c.course_id}`, c.code as string]));
  type R = {
    user_id: string; course_id: string;
    percent: number; status: string; modules_completed: number; modules_total: number; completed_at: string | null;
    profile: { full_name: string; email: string; department: string | null } | null; course: { title: string } | null;
  };
  const columns: Column<R>[] = [
    { header: "Colaborador", value: (r) => r.profile?.full_name, width: 30 },
    { header: "E-mail", value: (r) => r.profile?.email, width: 30 },
    { header: "Departamento", value: (r) => r.profile?.department },
    { header: "Trilha", value: (r) => r.course?.title, width: 30 },
    { header: "Módulos", value: (r) => `${r.modules_completed}/${r.modules_total}` },
    { header: "Progresso (%)", value: (r) => num(r.percent) },
    { header: "Concluída", value: (r) => r.status === "completed" },
    { header: "Data de conclusão", value: (r) => date(r.completed_at) },
    { header: "Certificado", value: (r) => certMap.get(`${r.user_id}:${r.course_id}`) ?? null },
  ];
  return { name: "Conclusões", rows: (data ?? []) as unknown as Record<string, unknown>[], columns: columns as unknown as Column<Record<string, unknown>>[] };
}

const REPORTS: Record<string, (sp: URLSearchParams) => Promise<Report>> = {
  users: usersReport,
  progress: progressReport,
  exams: examsReport,
  grades: gradesReport,
  completions: completionsReport,
};

export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[report]">) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaffRole(profile.role_id) || profile.status === "inactive") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const { report } = await ctx.params;
  const build = REPORTS[report];
  if (!build) return NextResponse.json({ error: "Relatório inexistente." }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const { name, rows, columns } = await build(sp);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}-${stamp}.${format}`;
  await logAudit("report.exported", "report", report, `${name} (${format})`, { rows: rows.length });

  if (format === "csv") {
    return new NextResponse(toCSV(rows, columns), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
    });
  }
  const buf = await toXLSX(name, rows, columns);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
