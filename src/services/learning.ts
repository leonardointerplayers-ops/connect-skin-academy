import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/lib/auth/dal";

async function myId() {
  return (await getSessionClaims())?.userId ?? "00000000-0000-0000-0000-000000000000";
}
import type {
  Announcement,
  Badge,
  Course,
  CourseProgress,
  Exam,
  ExamAttempt,
  Lesson,
  LessonProgress,
  Material,
  Module,
  ModuleState,
  OutlineModule,
  Video,
} from "@/types/domain";

/** Leituras do colaborador. A RLS garante que só o conteúdo liberado retorna. */

export const getMyCourses = cache(async () => {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getClaims();
  const uid = (me?.claims?.sub as string | undefined) ?? "";
  const [{ data: courses }, { data: progress }, { data: enrollments }] = await Promise.all([
    supabase.from("courses").select("*").eq("status", "published").is("deleted_at", null).order("position"),
    supabase.from("course_progress").select("*").eq("user_id", uid),
    supabase.from("enrollments").select("course_id, due_date, status").eq("user_id", uid),
  ]);
  const prog = new Map(((progress ?? []) as CourseProgress[]).filter((p) => p.user_id === uid).map((p) => [p.course_id, p]));
  const enr = new Map((enrollments ?? []).map((e) => [e.course_id as string, e as { due_date: string | null; status: string }]));
  return ((courses ?? []) as Course[]).map((c) => ({ ...c, progress: prog.get(c.id) ?? null, due_date: enr.get(c.id)?.due_date ?? null }));
});

export const getCourseOutline = cache(async (courseId: string): Promise<OutlineModule[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_course_outline", { p_course: courseId });
  if (error) return [];
  return ((data ?? []) as OutlineModule[]).map((m) => ({ ...m, percent: Number(m.percent), lessons_total: Number(m.lessons_total) }));
});

export async function getContinueLesson() {
  const supabase = await createClient();
  const uid = await myId();
  const { data: recent } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status, video_percent, last_viewed_at, lesson:lessons(id, title, module:modules(id, title, position))")
    .eq("user_id", uid)
    .order("last_viewed_at", { ascending: false })
    .limit(10);

  type Row = {
    lesson_id: string;
    status: string;
    video_percent: number;
    lesson: { id: string; title: string; module: { id: string; title: string; position: number } | null } | null;
  };
  const rows = ((recent ?? []) as unknown as Row[]).filter((r) => r.lesson);
  const inProgress = rows.find((r) => r.status === "in_progress");
  if (inProgress?.lesson) {
    return { lessonId: inProgress.lesson.id, title: inProgress.lesson.title, module: inProgress.lesson.module, percent: Number(inProgress.video_percent), resumed: true };
  }

  // Próxima aula não concluída, na ordem da trilha.
  const courses = await getMyCourses();
  const outlines = await Promise.all(courses.map((c) => getCourseOutline(c.id)));
  const candidates = outlines.flat().filter((m) => m.state === "unlocked" && m.status !== "completed");
  if (!candidates.length) return null;

  // Duas consultas no total, em vez de duas por módulo.
  const moduleIds = candidates.map((m) => m.id);
  const [{ data: lessons }, { data: done }] = await Promise.all([
    supabase.from("lessons").select("id, title, position, module_id").in("module_id", moduleIds).eq("status", "published").is("deleted_at", null),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", uid).in("module_id", moduleIds).eq("status", "completed"),
  ]);
  const doneSet = new Set((done ?? []).map((d) => d.lesson_id as string));
  for (const m of candidates) {
    const next = (lessons ?? [])
      .filter((l) => l.module_id === m.id && !doneSet.has(l.id as string))
      .sort((a, b) => (a.position as number) - (b.position as number))[0];
    if (next) return { lessonId: next.id as string, title: next.title as string, module: { id: m.id, title: m.title, position: m.position }, percent: 0, resumed: false };
  }
  return null;
}

export async function getModuleForLearner(moduleId: string) {
  const supabase = await createClient();
  const uid = await myId();
  const { data: mod } = await supabase.from("modules").select("*, course:courses(id, title, require_sequential)").eq("id", moduleId).maybeSingle();
  if (!mod) return null;
  const [{ data: state }, { data: lessons }, { data: progress }, { data: exam }, { data: competencies }, { data: mp }] = await Promise.all([
    supabase.rpc("fn_module_state", { p_module: moduleId }),
    supabase
      .from("lessons")
      .select("id, title, description, position, is_required, video_id, estimated_minutes, activity_enabled, lesson_materials(count)")
      .eq("module_id", moduleId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("position"),
    supabase.from("lesson_progress").select("lesson_id, status, video_percent, completed_at").eq("user_id", uid).eq("module_id", moduleId),
    supabase.from("exams").select("*").eq("module_id", moduleId).eq("status", "published").is("deleted_at", null).maybeSingle(),
    supabase.from("module_competencies").select("competency:competencies(name)").eq("module_id", moduleId),
    supabase.from("module_progress").select("*").eq("user_id", uid).eq("module_id", moduleId).maybeSingle(),
  ]);

  let attempts: ExamAttempt[] = [];
  if (exam) {
    const { data } = await supabase.from("exam_attempts").select("*").eq("user_id", uid).eq("exam_id", exam.id).order("attempt_number");
    attempts = (data ?? []) as ExamAttempt[];
  }
  const progressMap = new Map((progress ?? []).map((p) => [p.lesson_id as string, p as Pick<LessonProgress, "status" | "video_percent" | "completed_at">]));

  return {
    module: mod as Module & { course: { id: string; title: string; require_sequential: boolean } },
    state: ((state as { state: ModuleState; release_at: string | null } | null) ?? { state: "unavailable", release_at: null }),
    lessons: ((lessons ?? []) as unknown as (Pick<Lesson, "id" | "title" | "description" | "position" | "is_required" | "video_id" | "estimated_minutes" | "activity_enabled"> & {
      lesson_materials: { count: number }[];
    })[]).map((l) => ({ ...l, materials: l.lesson_materials?.[0]?.count ?? 0, progress: progressMap.get(l.id) ?? null })),
    exam: exam as Exam | null,
    attempts,
    progress: mp as { percent: number; status: string; lessons_completed: number; lessons_total: number } | null,
    competencies: ((competencies ?? []) as unknown as { competency: { name: string } | null }[]).map((c) => c.competency?.name).filter(Boolean) as string[],
  };
}

export async function getLessonForLearner(lessonId: string) {
  const supabase = await createClient();
  const uid = await myId();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, video:videos(*), module:modules(id, title, position, course_id, course:courses(id, title))")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return null;
  const typed = lesson as Lesson & {
    video: Video | null;
    module: { id: string; title: string; position: number; course_id: string; course: { id: string; title: string } | null };
  };
  const [{ data: materials }, { data: siblings }, { data: progress }, { data: siblingProgress }, { data: exam }] = await Promise.all([
    supabase.from("lesson_materials").select("position, material:materials(*)").eq("lesson_id", lessonId).order("position"),
    supabase.from("lessons").select("id, title, position, is_required").eq("module_id", typed.module_id).eq("status", "published").is("deleted_at", null).order("position"),
    supabase.from("lesson_progress").select("*").eq("user_id", uid).eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", uid).eq("module_id", typed.module_id),
    supabase.from("exams").select("id, title").eq("module_id", typed.module_id).eq("status", "published").is("deleted_at", null).maybeSingle(),
  ]);
  const doneSet = new Set((siblingProgress ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id as string));
  return {
    lesson: typed,
    materials: ((materials ?? []) as unknown as { material: Material | null }[]).map((m) => m.material).filter((m): m is Material => Boolean(m)),
    siblings: ((siblings ?? []) as { id: string; title: string; position: number; is_required: boolean }[]).map((s) => ({ ...s, completed: doneSet.has(s.id) })),
    progress: progress as LessonProgress | null,
    exam: exam as { id: string; title: string } | null,
  };
}

export async function getPendingExams() {
  const courses = await getMyCourses();
  const pending: { examId: string; examTitle: string; moduleId: string; moduleTitle: string; attemptsUsed: number; maxAttempts: number | null; ready: boolean }[] = [];
  for (const c of courses) {
    for (const m of await getCourseOutline(c.id)) {
      if (m.state !== "unlocked" || !m.exam || m.exam.passed) continue;
      if (m.exam.max_attempts !== null && m.exam.attempts_used >= m.exam.max_attempts) continue;
      pending.push({
        examId: m.exam.id,
        examTitle: m.exam.title,
        moduleId: m.id,
        moduleTitle: m.title,
        attemptsUsed: m.exam.attempts_used,
        maxAttempts: m.exam.max_attempts,
        ready: m.lessons_total > 0 && m.lessons_completed >= m.lessons_total,
      });
    }
  }
  return pending;
}

export async function getMyBadges() {
  const supabase = await createClient();
  const uid = await myId();
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from("badges").select("*").eq("active", true).order("points"),
    supabase.from("user_badges").select("badge_id, awarded_at").eq("user_id", uid).order("awarded_at", { ascending: false }),
  ]);
  const earned = new Map((mine ?? []).map((b) => [b.badge_id as string, b.awarded_at as string]));
  return ((all ?? []) as Badge[]).map((b) => ({ ...b, awarded_at: earned.get(b.id) ?? null }));
}

export async function getAnnouncements(limit = 10) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null)
    .lte("publish_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("priority", { ascending: true })
    .order("publish_at", { ascending: false })
    .limit(limit);
  const order = { high: 0, normal: 1, low: 2 } as const;
  return ((data ?? []) as Announcement[]).sort((a, b) => order[a.priority] - order[b.priority] || b.publish_at.localeCompare(a.publish_at));
}

export async function getMyStats() {
  const supabase = await createClient();
  const { data } = await supabase.from("v_user_learning_summary").select("*").eq("user_id", await myId()).maybeSingle();
  return data as import("@/types/domain").UserLearningSummary | null;
}
