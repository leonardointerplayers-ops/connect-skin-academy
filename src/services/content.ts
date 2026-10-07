import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Course, Exam, Lesson, Material, Module, Video } from "@/types/domain";

/** Leituras do painel administrativo (staff enxerga rascunhos via RLS). */

export async function listCoursesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*, modules(count)")
    .is("deleted_at", null)
    .order("position");
  return ((data ?? []) as unknown as (Course & { modules: { count: number }[] })[]).map((c) => ({
    ...c,
    modules_count: c.modules?.[0]?.count ?? 0,
  }));
}

export async function getCourseAdmin(id: string) {
  const supabase = await createClient();
  const [{ data: course }, { data: modules }, { data: groups }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("modules")
      .select("*, lessons(count), exams(id, status, deleted_at)")
      .eq("course_id", id)
      .is("deleted_at", null)
      .order("position")
      .order("created_at"),
    supabase.from("course_groups").select("group_id").eq("course_id", id),
  ]);
  if (!course) return null;
  return {
    course: course as Course,
    modules: ((modules ?? []) as unknown as (Module & {
      lessons: { count: number }[];
      exams: { id: string; status: string; deleted_at: string | null }[];
    })[]).map((m) => ({
      ...m,
      lessons_count: m.lessons?.[0]?.count ?? 0,
      exam: m.exams?.find((e) => !e.deleted_at) ?? null,
    })),
    groupIds: (groups ?? []).map((g) => g.group_id as string),
  };
}

export async function listModulesAdmin(courseId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("modules")
    .select("*, course:courses!inner(id, title, position, deleted_at), lessons(count)")
    .is("deleted_at", null)
    .is("course.deleted_at", null);
  if (courseId) q = q.eq("course_id", courseId);
  const { data } = await q.order("position");
  return ((data ?? []) as unknown as (Module & { course: { id: string; title: string; position: number }; lessons: { count: number }[] })[])
    .map((m) => ({ ...m, lessons_count: m.lessons?.[0]?.count ?? 0 }))
    .sort((a, b) => a.course.position - b.course.position || a.position - b.position);
}

export async function getModuleAdmin(id: string) {
  const supabase = await createClient();
  const [{ data: mod }, { data: lessons }, { data: exam }, { data: comps }] = await Promise.all([
    supabase.from("modules").select("*, course:courses(id, title)").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("lessons")
      .select("id, title, description, status, position, is_required, video_id, activity_enabled, estimated_minutes, lesson_materials(count)")
      .eq("module_id", id)
      .is("deleted_at", null)
      .order("position")
      .order("created_at"),
    supabase.from("exams").select("*, exam_questions(count)").eq("module_id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("module_competencies").select("competency_id").eq("module_id", id),
  ]);
  if (!mod) return null;
  return {
    module: mod as Module & { course: { id: string; title: string } },
    lessons: ((lessons ?? []) as unknown as (Pick<Lesson, "id" | "title" | "description" | "status" | "position" | "is_required" | "video_id" | "activity_enabled" | "estimated_minutes"> & {
      lesson_materials: { count: number }[];
    })[]).map((l) => ({ ...l, materials_count: l.lesson_materials?.[0]?.count ?? 0 })),
    exam: exam as (Exam & { exam_questions: { count: number }[] }) | null,
    competencyIds: (comps ?? []).map((c) => c.competency_id as string),
  };
}

export async function listLessonsAdmin(filters: { moduleId?: string; q?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("lessons")
    .select("id, title, status, position, is_required, video_id, updated_at, module:modules!inner(id, title, position, deleted_at, course:courses(title))")
    .is("deleted_at", null)
    .is("module.deleted_at", null);
  if (filters.moduleId) q = q.eq("module_id", filters.moduleId);
  if (filters.q) q = q.ilike("title", `%${filters.q.replace(/[%,()*\\]/g, " ").slice(0, 80)}%`);
  const { data } = await q.order("position").limit(300);
  return ((data ?? []) as unknown as (Pick<Lesson, "id" | "title" | "status" | "position" | "is_required" | "video_id" | "updated_at"> & {
    module: { id: string; title: string; position: number; course: { title: string } | null };
  })[]).sort((a, b) => a.module.position - b.module.position || a.position - b.position);
}

export async function getLessonAdmin(id: string) {
  const supabase = await createClient();
  const [{ data: lesson }, { data: materials }] = await Promise.all([
    supabase
      .from("lessons")
      .select("*, video:videos(*), module:modules(id, title, course_id, course:courses(title))")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("lesson_materials")
      .select("position, material:materials(*)")
      .eq("lesson_id", id)
      .order("position"),
  ]);
  if (!lesson) return null;
  return {
    lesson: lesson as Lesson & { video: Video | null; module: { id: string; title: string; course_id: string; course: { title: string } | null } },
    materials: ((materials ?? []) as unknown as { position: number; material: Material | null }[])
      .map((m) => m.material)
      .filter((m): m is Material => Boolean(m && !("deleted_at" in m && (m as { deleted_at: string | null }).deleted_at))),
  };
}

export async function listCompetencies() {
  const supabase = await createClient();
  const { data } = await supabase.from("competencies").select("id, name, description").order("name");
  return (data ?? []) as { id: string; name: string; description: string | null }[];
}
