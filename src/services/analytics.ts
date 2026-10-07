import "server-only";
import { cache } from "react";
import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/services/settings";
import { buildAlerts, buildTeamView, learners, ruleBasedInsights, type FailedTwice, type InsightContext } from "@/lib/analytics/insights";
import type { LessonStats, ModuleStats, QuestionStats, UserLearningSummary } from "@/types/domain";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export const getUserSummaries = cache(async (): Promise<UserLearningSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_user_learning_summary").select("*").order("full_name");
  if (error) throw error;
  return ((data ?? []) as UserLearningSummary[]).map((u) => ({
    ...u,
    overall_percent: num(u.overall_percent),
    avg_best_score: u.avg_best_score === null ? null : num(u.avg_best_score),
    avg_attempts_per_exam: u.avg_attempts_per_exam === null ? null : num(u.avg_attempts_per_exam),
    time_studied_seconds: num(u.time_studied_seconds),
    overdue_items: num(u.overdue_items),
  }));
});

export const getModuleStats = cache(async (): Promise<(ModuleStats & { label: string; course_title: string })[]> => {
  const supabase = await createClient();
  const [{ data: stats, error }, { data: courses }] = await Promise.all([
    supabase.from("v_module_stats").select("*").eq("status", "published").order("position"),
    supabase.from("courses").select("id, title, position").is("deleted_at", null),
  ]);
  if (error) throw error;
  const courseMap = new Map((courses ?? []).map((c) => [c.id as string, c as { id: string; title: string; position: number }]));
  return ((stats ?? []) as ModuleStats[])
    .sort((a, b) => (courseMap.get(a.course_id)?.position ?? 0) - (courseMap.get(b.course_id)?.position ?? 0) || a.position - b.position)
    .map((m) => ({
      ...m,
      label: `Módulo ${String(m.position).padStart(2, "0")} — ${m.title}`,
      course_title: courseMap.get(m.course_id)?.title ?? "",
    }));
});

export async function getQuestionStats(examId?: string): Promise<QuestionStats[]> {
  const supabase = await createClient();
  let q = supabase.from("v_question_stats").select("*").order("pct_correct", { ascending: true });
  if (examId) q = q.eq("exam_id", examId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as QuestionStats[];
}

export const getLessonStats = cache(async (): Promise<LessonStats[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_lesson_stats").select("*").eq("status", "published");
  if (error) throw error;
  return (data ?? []) as LessonStats[];
});

/** Reprovações por colaborador × módulo (para alertas). */
export const getExamFailures = cache(async (): Promise<FailedTwice[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_attempts")
    .select("user_id, passed, exam:exams(module_id, module:modules(title, position)), profile:profiles(full_name)")
    .neq("status", "in_progress")
    .limit(5000);

  const map = new Map<string, FailedTwice>();
  for (const row of (data ?? []) as unknown as {
    user_id: string;
    passed: boolean | null;
    exam: { module_id: string; module: { title: string; position: number } | null } | null;
    profile: { full_name: string } | null;
  }[]) {
    if (!row.exam) continue;
    const key = `${row.user_id}:${row.exam.module_id}`;
    const entry =
      map.get(key) ??
      ({
        user_id: row.user_id,
        user_name: row.profile?.full_name ?? "Colaborador",
        module_id: row.exam.module_id,
        module_title: row.exam.module ? `Módulo ${String(row.exam.module.position).padStart(2, "0")}` : "módulo",
        failures: 0,
        passed: false,
      } satisfies FailedTwice);
    if (row.passed) entry.passed = true;
    else entry.failures += 1;
    map.set(key, entry);
  }
  return [...map.values()];
});

/** Usuários ativos e minutos estudados por dia (últimos N dias). */
export async function getActivitySeries(days = 30) {
  const supabase = await createClient();
  const since = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const { data } = await supabase
    .from("daily_activity")
    .select("activity_date, user_id, seconds_studied")
    .gte("activity_date", since)
    .limit(10000);

  const byDay = new Map<string, { users: Set<string>; seconds: number }>();
  for (const row of data ?? []) {
    const d = row.activity_date as string;
    const entry = byDay.get(d) ?? { users: new Set<string>(), seconds: 0 };
    entry.users.add(row.user_id as string);
    entry.seconds += num(row.seconds_studied);
    byDay.set(d, entry);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
    const entry = byDay.get(date);
    return { date, activeUsers: entry?.users.size ?? 0, minutes: Math.round((entry?.seconds ?? 0) / 60) };
  });
}

export async function getExamsTakenCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("exam_attempts").select("id", { count: "exact", head: true }).neq("status", "in_progress");
  return count ?? 0;
}

export async function getInsightContext(): Promise<InsightContext> {
  const [users, modules, questions, lessons, failedTwice, settings] = await Promise.all([
    getUserSummaries(),
    getModuleStats(),
    getQuestionStats(),
    getLessonStats(),
    getExamFailures(),
    getSettings(),
  ]);
  return { users, modules, questions, lessons, failedTwice, inactivityDays: settings.inactivity_alert_days };
}

export async function getDashboardData() {
  const [ctx, examsTaken, activity] = await Promise.all([getInsightContext(), getExamsTakenCount(), getActivitySeries(30)]);
  const team = learners(ctx.users);
  const total = team.length;
  const scored = team.filter((u) => u.avg_best_score !== null);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const accessed30 = team.filter((u) => u.days_since_activity !== null && u.days_since_activity <= 30).length;
  const teamView = buildTeamView(ctx.users, ctx.failedTwice, ctx.inactivityDays);

  const modulesWithExam = ctx.modules.filter((m) => num(m.users_attempted) > 0);
  const hardestModules = [...modulesWithExam]
    .sort((a, b) => num(a.approval_rate) - num(b.approval_rate) || num(a.avg_best_score) - num(b.avg_best_score))
    .slice(0, 3);

  const healthCounts = { excellent: 0, attention: 0, low: 0 };
  for (const h of teamView.health.values()) healthCounts[h.level]++;

  return {
    kpis: {
      collaborators: total,
      active: team.filter((u) => u.status === "active").length,
      invited: team.filter((u) => u.status === "invited").length,
      avgCompletion: avg(team.map((u) => num(u.overall_percent))),
      avgScore: avg(scored.map((u) => num(u.avg_best_score))),
      examsTaken,
      accessRate: total ? (accessed30 / total) * 100 : null,
      overdue: teamView.overdue.length,
      totalStudySeconds: team.reduce((s, u) => s + num(u.time_studied_seconds), 0),
      avgStudySeconds: total ? team.reduce((s, u) => s + num(u.time_studied_seconds), 0) / total : 0,
    },
    modules: ctx.modules,
    hardestModules,
    healthCounts,
    teamView,
    alerts: buildAlerts(ctx),
    insights: await ruleBasedInsights.generate(ctx),
    activity,
    ctx,
  };
}

/** Matriz colaborador × competência (média do % dos módulos ligados à competência). */
export async function getCompetencyMatrix() {
  const supabase = await createClient();
  const [{ data: comps }, { data: links }, { data: progress }, users] = await Promise.all([
    supabase.from("competencies").select("id, name").order("name"),
    supabase.from("module_competencies").select("module_id, competency_id, module:modules!inner(status, deleted_at)").eq("module.status", "published").is("module.deleted_at", null),
    supabase.from("module_progress").select("user_id, module_id, percent").limit(20000),
    getUserSummaries(),
  ]);
  const team = learners(users);
  const modulesByComp = new Map<string, string[]>();
  for (const l of (links ?? []) as { module_id: string; competency_id: string }[]) {
    modulesByComp.set(l.competency_id, [...(modulesByComp.get(l.competency_id) ?? []), l.module_id]);
  }
  const pct = new Map((progress ?? []).map((p) => [`${p.user_id}:${p.module_id}`, Number(p.percent)]));
  const competencies = ((comps ?? []) as { id: string; name: string }[]).filter((c) => modulesByComp.has(c.id));
  const rows = team.map((u) => ({
    user: u,
    values: competencies.map((c) => {
      const mods = modulesByComp.get(c.id) ?? [];
      return mods.reduce((s, m) => s + (pct.get(`${u.user_id}:${m}`) ?? 0), 0) / mods.length;
    }),
  }));
  const teamAvg = competencies.map((_, i) => (rows.length ? rows.reduce((s, r) => s + r.values[i], 0) / rows.length : 0));
  return { competencies, rows, teamAvg };
}

export function bucketize(values: number[], buckets: { name: string; min: number; max: number }[]) {
  return buckets.map((b) => ({ name: b.name, value: values.filter((v) => v >= b.min && v <= b.max).length }));
}
