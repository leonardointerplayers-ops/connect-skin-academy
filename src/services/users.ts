import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/config/app";
import type { Profile, UserLearningSummary } from "@/types/domain";

export interface CollaboratorFilters {
  q?: string;
  status?: string;
  department?: string;
  group?: string;
  role?: string;
  page?: number;
}

/** Remove caracteres com significado especial nos filtros do PostgREST. */
function sanitizeSearch(q: string) {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
}

export async function listCollaborators(filters: CollaboratorFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = APP_CONFIG.pageSize;
  let query = supabase.from("v_user_learning_summary").select("*", { count: "exact" });

  if (filters.q) {
    const q = sanitizeSearch(filters.q);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,job_title.ilike.%${q}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.department) query = query.eq("department", filters.department);
  if (filters.role) query = query.eq("role_id", filters.role);
  if (filters.group) {
    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", filters.group);
    const ids = (members ?? []).map((m) => m.user_id as string);
    query = query.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.order("full_name").range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as UserLearningSummary[], total: count ?? 0, page, pageSize };
}

export async function listDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("department").not("department", "is", null).is("deleted_at", null);
  return [...new Set((data ?? []).map((d) => d.department as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getCollaborator(userId: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: summary }, { data: groups }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("v_user_learning_summary").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("group_members").select("group_id, group:groups(id, name)").eq("user_id", userId),
  ]);
  if (!profile) return null;
  return {
    profile: profile as Profile,
    summary: summary as UserLearningSummary | null,
    groups: ((groups ?? []) as unknown as { group: { id: string; name: string } | null }[])
      .map((g) => g.group)
      .filter((g): g is { id: string; name: string } => Boolean(g)),
  };
}

export interface TimelineEvent {
  at: string;
  kind: "lesson" | "module" | "exam_passed" | "exam_failed" | "course" | "badge" | "joined";
  title: string;
  detail?: string;
}

/** Linha do tempo de aprendizagem montada a partir dos registros de progresso. */
export async function getUserTimeline(userId: string, limit = 40): Promise<TimelineEvent[]> {
  const supabase = await createClient();
  const [lessons, modules, attempts, courses, badges] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("completed_at, lesson:lessons(title)")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit),
    supabase
      .from("module_progress")
      .select("completed_at, module:modules(title)")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase
      .from("exam_attempts")
      .select("submitted_at, score_percent, passed, attempt_number, exam:exams(title)")
      .eq("user_id", userId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(limit),
    supabase
      .from("course_progress")
      .select("completed_at, course:courses(title)")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase.from("user_badges").select("awarded_at, badge:badges(name, icon)").eq("user_id", userId),
  ]);

  type Rel<T> = T | null;
  const events: TimelineEvent[] = [];
  for (const r of (lessons.data ?? []) as unknown as { completed_at: string; lesson: Rel<{ title: string }> }[]) {
    events.push({ at: r.completed_at, kind: "lesson", title: "Aula concluída", detail: r.lesson?.title });
  }
  for (const r of (modules.data ?? []) as unknown as { completed_at: string; module: Rel<{ title: string }> }[]) {
    events.push({ at: r.completed_at, kind: "module", title: "Módulo concluído", detail: r.module?.title });
  }
  for (const r of (attempts.data ?? []) as unknown as {
    submitted_at: string;
    score_percent: number;
    passed: boolean;
    attempt_number: number;
    exam: Rel<{ title: string }>;
  }[]) {
    events.push({
      at: r.submitted_at,
      kind: r.passed ? "exam_passed" : "exam_failed",
      title: r.passed ? "Prova aprovada" : "Prova realizada (reprovado)",
      detail: `${r.exam?.title ?? "Prova"} — ${Number(r.score_percent)}% · tentativa ${r.attempt_number}`,
    });
  }
  for (const r of (courses.data ?? []) as unknown as { completed_at: string; course: Rel<{ title: string }> }[]) {
    events.push({ at: r.completed_at, kind: "course", title: "Trilha concluída", detail: r.course?.title });
  }
  for (const r of (badges.data ?? []) as unknown as { awarded_at: string; badge: Rel<{ name: string; icon: string }> }[]) {
    events.push({ at: r.awarded_at, kind: "badge", title: "Conquista", detail: r.badge ? `${r.badge.icon} ${r.badge.name}` : undefined });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface UserModuleProgressRow {
  module_id: string;
  title: string;
  position: number;
  course_title: string;
  percent: number;
  lessons_completed: number;
  lessons_total: number;
  status: string;
  best_score: number | null;
  exam_passed: boolean | null;
  attempts: { attempt_number: number; score_percent: number | null; passed: boolean | null; submitted_at: string | null; id: string }[];
}

export async function getUserModuleProgress(userId: string): Promise<UserModuleProgressRow[]> {
  const supabase = await createClient();
  const [{ data: modules }, { data: progress }, { data: attempts }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, title, position, course:courses!inner(title, position, status)")
      .eq("status", "published")
      .is("deleted_at", null),
    supabase.from("module_progress").select("*").eq("user_id", userId),
    supabase
      .from("exam_attempts")
      .select("id, attempt_number, score_percent, passed, submitted_at, exam:exams(module_id)")
      .eq("user_id", userId)
      .neq("status", "in_progress")
      .order("attempt_number"),
  ]);

  const progressMap = new Map((progress ?? []).map((p) => [p.module_id as string, p]));
  const attemptsByModule = new Map<string, UserModuleProgressRow["attempts"]>();
  for (const a of (attempts ?? []) as unknown as (UserModuleProgressRow["attempts"][number] & { exam: { module_id: string } | null })[]) {
    if (!a.exam) continue;
    const list = attemptsByModule.get(a.exam.module_id) ?? [];
    list.push({ id: a.id, attempt_number: a.attempt_number, score_percent: a.score_percent, passed: a.passed, submitted_at: a.submitted_at });
    attemptsByModule.set(a.exam.module_id, list);
  }

  return ((modules ?? []) as unknown as { id: string; title: string; position: number; course: { title: string; position: number } }[])
    .sort((a, b) => a.course.position - b.course.position || a.position - b.position)
    .map((m) => {
      const p = progressMap.get(m.id);
      return {
        module_id: m.id,
        title: m.title,
        position: m.position,
        course_title: m.course.title,
        percent: Number(p?.percent ?? 0),
        lessons_completed: p?.lessons_completed ?? 0,
        lessons_total: p?.lessons_total ?? 0,
        status: p?.status ?? "not_started",
        best_score: p?.best_score === null || p?.best_score === undefined ? null : Number(p.best_score),
        exam_passed: p?.exam_passed ?? null,
        attempts: attemptsByModule.get(m.id) ?? [],
      };
    });
}

export async function listGroups() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, description, created_at, group_members(count)")
    .is("deleted_at", null)
    .order("name");
  return ((data ?? []) as unknown as { id: string; name: string; description: string | null; group_members: { count: number }[] }[]).map(
    (g) => ({ id: g.id, name: g.name, description: g.description, members: g.group_members?.[0]?.count ?? 0 }),
  );
}

export async function getGroupMembers(groupId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("user_id, profile:profiles(id, full_name, email, job_title, avatar_path, status)")
    .eq("group_id", groupId);
  return ((data ?? []) as unknown as { profile: Pick<Profile, "id" | "full_name" | "email" | "job_title" | "avatar_path" | "status"> | null }[])
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

export async function listAllPeople() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .is("deleted_at", null)
    .neq("status", "inactive")
    .order("full_name");
  return (data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "status">[];
}
