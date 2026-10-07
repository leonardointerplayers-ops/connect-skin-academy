import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/config/app";
import type { AttemptPayload, AttemptResult, Exam, Question } from "@/types/domain";

export async function listExamsAdmin() {
  const supabase = await createClient();
  const [{ data: exams }, { data: stats }] = await Promise.all([
    supabase
      .from("exams")
      .select("*, module:modules!inner(id, title, position, deleted_at, course:courses(title)), exam_questions(count)")
      .is("deleted_at", null)
      .is("module.deleted_at", null),
    supabase.from("v_exam_stats").select("*"),
  ]);
  const statMap = new Map((stats ?? []).map((s) => [s.exam_id as string, s]));
  return ((exams ?? []) as unknown as (Exam & {
    module: { id: string; title: string; position: number; course: { title: string } | null };
    exam_questions: { count: number }[];
  })[])
    .map((e) => {
      const s = statMap.get(e.id);
      return {
        ...e,
        questions: e.exam_questions?.[0]?.count ?? 0,
        attempts: Number(s?.total_attempts ?? 0),
        usersAttempted: Number(s?.users_attempted ?? 0),
        usersPassed: Number(s?.users_passed ?? 0),
        avgScore: s?.avg_score === null || s?.avg_score === undefined ? null : Number(s.avg_score),
      };
    })
    .sort((a, b) => a.module.position - b.module.position);
}

export async function getExamAdmin(id: string) {
  const supabase = await createClient();
  const [{ data: exam }, { data: links }] = await Promise.all([
    supabase.from("exams").select("*, module:modules(id, title, position, course_id)").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("exam_questions")
      .select("position, question:questions(*, question_options(*))")
      .eq("exam_id", id)
      .order("position"),
  ]);
  if (!exam) return null;
  return {
    exam: exam as Exam & { module: { id: string; title: string; position: number; course_id: string } },
    questions: ((links ?? []) as unknown as { question: Question | null }[])
      .map((l) => l.question)
      .filter((q): q is Question => Boolean(q && !(q as unknown as { deleted_at: string | null }).deleted_at)),
  };
}

export interface QuestionFilters {
  q?: string;
  category?: string;
  difficulty?: string;
  type?: string;
  module?: string;
  status?: string;
  page?: number;
}

export async function listQuestions(filters: QuestionFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = APP_CONFIG.pageSize;
  let q = supabase
    .from("questions")
    .select("*, question_options(id, is_correct), module:modules(title, position), exam_questions(exam_id)", { count: "exact" })
    .is("deleted_at", null);
  if (filters.q) {
    const t = filters.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
    if (/^\d+$/.test(t)) q = q.eq("number", Number(t));
    else if (t) q = q.ilike("statement", `%${t}%`);
  }
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.difficulty) q = q.eq("difficulty", filters.difficulty);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.module) q = q.eq("module_id", filters.module);
  if (filters.status) q = q.eq("status", filters.status);
  const from = (page - 1) * pageSize;
  const { data, count } = await q.order("number", { ascending: false }).range(from, from + pageSize - 1);
  return {
    rows: (data ?? []) as unknown as (Question & {
      module: { title: string; position: number } | null;
      exam_questions: { exam_id: string }[];
    })[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listQuestionCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("category").not("category", "is", null).is("deleted_at", null);
  return [...new Set((data ?? []).map((d) => d.category as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getQuestion(id: string) {
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("questions").select("*, question_options(*)").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("exam_answers").select("id", { count: "exact", head: true }).eq("question_id", id),
  ]);
  if (!data) return null;
  const q = data as Question;
  q.question_options = (q.question_options ?? []).sort((a, b) => a.position - b.position);
  return { question: q, answersCount: count ?? 0 };
}

export async function listAttempts(filters: { exam?: string; result?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = APP_CONFIG.pageSize;
  let q = supabase
    .from("exam_attempts")
    .select("*, exam:exams(title, module:modules(title, position)), profile:profiles(id, full_name, avatar_path, department)", { count: "exact" })
    .neq("status", "in_progress");
  if (filters.exam) q = q.eq("exam_id", filters.exam);
  if (filters.result === "passed") q = q.eq("passed", true);
  if (filters.result === "failed") q = q.eq("passed", false);
  const from = (page - 1) * pageSize;
  const { data, count } = await q.order("submitted_at", { ascending: false }).range(from, from + pageSize - 1);
  return {
    rows: (data ?? []) as unknown as {
      id: string;
      attempt_number: number;
      score_percent: number | null;
      passed: boolean | null;
      submitted_at: string;
      time_spent_seconds: number | null;
      correct_count: number | null;
      wrong_count: number | null;
      status: string;
      exam: { title: string; module: { title: string; position: number } | null } | null;
      profile: { id: string; full_name: string; avatar_path: string | null; department: string | null } | null;
    }[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAttemptForTaking(attemptId: string): Promise<AttemptPayload | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_get_attempt", { p_attempt: attemptId });
  if (error) return null;
  return data as AttemptPayload;
}

export async function getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_get_attempt_result", { p_attempt: attemptId });
  if (error) return null;
  return data as AttemptResult;
}

export async function getQuestionStats(questionId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("v_question_stats").select("total_answers, correct, wrong").eq("question_id", questionId);
  const total = (data ?? []).reduce((s, r) => s + Number(r.total_answers), 0);
  const correct = (data ?? []).reduce((s, r) => s + Number(r.correct), 0);
  return { total, correct, wrong: total - correct, pct: total ? (correct / total) * 100 : null };
}
