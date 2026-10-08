"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, ensureOne, toActionError, type ActionResult } from "@/lib/actions";
import { examSchema, questionSchema, type QuestionInput } from "@/lib/validation/exams";
import { diff, logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { enrolledUserIds, notifyUsers } from "@/lib/notify";

const uuid = z.uuid();
const checkbox = (fd: FormData, name: string) => fd.get(name) === "on" || fd.get(name) === "true";

function revalidateExams(examId?: string) {
  revalidatePath("/admin/avaliacoes", "layout");
  revalidatePath("/provas", "layout");
  revalidatePath("/modulos", "layout");
  if (examId) revalidatePath(`/admin/avaliacoes/provas/${examId}`);
}

// ---------------------------------------------------------------------------
// Provas (admin)
// ---------------------------------------------------------------------------

export async function createExamAction(formData: FormData) {
  const moduleRaw = String(formData.get("module_id") ?? "");
  let target: string;
  try {
    const admin = await assertAdmin();
    const moduleId = uuid.parse(moduleRaw);
    const title = z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(160).parse(formData.get("title"));
    const supabase = await createClient();
    const res = await supabase
      .from("exams")
      .insert({ module_id: moduleId, title, status: "draft", created_by: admin.id, updated_by: admin.id })
      .select("id")
      .single();
    if (res.error) throw res.error;
    await logAudit("exam.created", "exam", res.data.id, title);
    target = `/admin/avaliacoes/provas/${res.data.id}`;
  } catch (err) {
    const message = toActionError(err).error;
    target = `/admin/avaliacoes/provas/nova?modulo=${encodeURIComponent(moduleRaw)}&erro=${encodeURIComponent(message)}`;
  }
  redirect(target);
}

export async function updateExamAction(examId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = uuid.parse(examId);
    const input = examSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      instructions: formData.get("instructions"),
      passing_score: formData.get("passing_score"),
      question_count: formData.get("question_count"),
      max_attempts: formData.get("max_attempts"),
      time_limit_minutes: formData.get("time_limit_minutes"),
      selection_mode: formData.get("selection_mode"),
      random_categories: formData.getAll("random_categories").map(String),
      random_difficulties: formData.getAll("random_difficulties").map(String),
      shuffle_questions: checkbox(formData, "shuffle_questions"),
      shuffle_options: checkbox(formData, "shuffle_options"),
      show_result: checkbox(formData, "show_result"),
      show_answers: formData.get("show_answers"),
      show_explanations: checkbox(formData, "show_explanations"),
      is_required: checkbox(formData, "is_required"),
      points: formData.get("points"),
      status: formData.get("status"),
    });
    const supabase = await createClient();
    const { data: before } = await supabase.from("exams").select("*, module:modules(id, title, course_id, status)").eq("id", id).single();

    if (input.status === "published") {
      const { count } = await supabase.from("exam_questions").select("question_id", { count: "exact", head: true }).eq("exam_id", id);
      if (input.selection_mode === "fixed" && !count) {
        return { ok: false, error: "Vincule pelo menos uma questão antes de publicar a prova." };
      }
    }

    const publishedNow = input.status === "published" && before?.status !== "published";
    const patch = { ...input, updated_by: admin.id, ...(publishedNow ? { published_at: new Date().toISOString() } : {}) };
    ensure(await supabase.from("exams").update(patch).eq("id", id));

    const { module: mod, ...beforeFields } = (before ?? {}) as Record<string, unknown> & { module?: { id: string; title: string; course_id: string; status: string } };
    if (before && (before.status !== input.status || before.is_required !== input.is_required || before.passing_score !== input.passing_score)) {
      await supabase.rpc("fn_admin_recalc_module", { p_module: before.module_id });
    }
    await logAudit(publishedNow ? "exam.published" : "exam.updated", "exam", id, input.title, diff(beforeFields, patch));

    if (publishedNow && mod?.status === "published") {
      const users = await enrolledUserIds(mod.course_id);
      await notifyUsers(users, { type: "exam_published", title: "📝 Prova disponível", body: `A prova "${input.title}" do módulo "${mod.title}" está disponível.`, link: `/provas/${id}` });
    }
    revalidateExams(id);
    return { ok: true, message: publishedNow ? "Prova publicada." : "Prova salva." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteExamAction(examId: string): Promise<ActionResult> {
  let moduleId: string | undefined;
  try {
    await assertAdmin();
    const id = uuid.parse(examId);
    const supabase = await createClient();
    const { data } = await supabase.from("exams").select("module_id, title").eq("id", id).single();
    moduleId = data?.module_id;
    ensure(await supabase.from("exams").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    if (moduleId) await supabase.rpc("fn_admin_recalc_module", { p_module: moduleId });
    await logAudit("exam.deleted", "exam", id, data?.title ?? null);
    revalidateExams();
  } catch (err) {
    return toActionError(err);
  }
  redirect(moduleId ? `/admin/conteudos/modulos/${moduleId}` : "/admin/avaliacoes/provas");
}

export async function duplicateExamAction(examId: string, targetModuleId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const id = ensure(await supabase.rpc("fn_admin_duplicate_exam", { p_exam: uuid.parse(examId), p_target_module: uuid.parse(targetModuleId) })) as string;
    revalidateExams();
    return { ok: true, data: { id }, message: "Prova duplicada como rascunho." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function linkQuestionsAction(examId: string, questionIds: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(examId);
    const ids = z.array(uuid).min(1).max(200).parse(questionIds);
    const supabase = await createClient();
    const { data: last } = await supabase.from("exam_questions").select("position").eq("exam_id", id).order("position", { ascending: false }).limit(1).maybeSingle();
    const start = (last?.position ?? 0) + 1;
    ensure(
      await supabase
        .from("exam_questions")
        .upsert(ids.map((question_id, i) => ({ exam_id: id, question_id, position: start + i })), { onConflict: "exam_id,question_id", ignoreDuplicates: true }),
    );
    await logAudit("exam.questions_linked", "exam", id, null, { count: ids.length });
    revalidateExams(id);
    return { ok: true, message: `${ids.length} questão(ões) vinculada(s).` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function unlinkQuestionAction(examId: string, questionId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    ensure(await supabase.from("exam_questions").delete().eq("exam_id", uuid.parse(examId)).eq("question_id", uuid.parse(questionId)));
    await logAudit("exam.question_unlinked", "exam", examId, null, { question: questionId });
    revalidateExams(examId);
    return { ok: true, message: "Questão removida da prova (continua no banco)." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function searchQuestionsForExamAction(examId: string, term: string) {
  await assertAdmin();
  const supabase = await createClient();
  const { data: linked } = await supabase.from("exam_questions").select("question_id").eq("exam_id", uuid.parse(examId));
  const exclude = new Set((linked ?? []).map((l) => l.question_id as string));
  let q = supabase.from("questions").select("id, number, statement, type, category, difficulty, status").is("deleted_at", null).neq("type", "essay");
  const t = z.string().max(80).parse(term).replace(/[%,()*\\]/g, " ").trim();
  if (/^\d+$/.test(t)) q = q.eq("number", Number(t));
  else if (t) q = q.ilike("statement", `%${t}%`);
  const { data } = await q.order("number", { ascending: false }).limit(40);
  return (data ?? []).filter((x) => !exclude.has(x.id as string)) as { id: string; number: number; statement: string; type: string; category: string | null; difficulty: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Banco de questões (admin)
// ---------------------------------------------------------------------------

export async function saveQuestionAction(questionId: string | null, input: QuestionInput, linkToExamId?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const q = questionSchema.parse(input);
    const supabase = await createClient();
    const { options, ...fields } = q;
    let id: string;

    if (questionId) {
      id = uuid.parse(questionId);
      const { data: before } = await supabase.from("questions").select("*, question_options(id)").eq("id", id).single();
      const { count: answers } = await supabase.from("exam_answers").select("id", { count: "exact", head: true }).eq("question_id", id);
      const existingIds = new Set(((before?.question_options ?? []) as { id: string }[]).map((o) => o.id));
      const keptIds = new Set(options.filter((o) => o.id).map((o) => o.id!));
      const removed = [...existingIds].filter((x) => !keptIds.has(x));
      if (answers && (removed.length || options.some((o) => !o.id))) {
        return {
          ok: false,
          error: "Esta questão já foi respondida em provas. Para incluir ou remover alternativas, duplique a questão — assim o histórico é preservado.",
        };
      }
      ensure(await supabase.from("questions").update({ ...fields, updated_by: admin.id }).eq("id", id));
      if (removed.length) ensure(await supabase.from("question_options").delete().in("id", removed));
      for (const [i, o] of options.entries()) {
        if (o.id && existingIds.has(o.id)) {
          ensure(await supabase.from("question_options").update({ text: o.text, is_correct: o.is_correct, position: i + 1 }).eq("id", o.id));
        } else {
          ensure(await supabase.from("question_options").insert({ question_id: id, text: o.text, is_correct: o.is_correct, position: i + 1 }));
        }
      }
      const { question_options: _o, ...beforeFields } = (before ?? {}) as Record<string, unknown>;
      void _o;
      await logAudit("question.updated", "question", id, fields.statement.slice(0, 80), diff(beforeFields, fields));
    } else {
      const created = ensureOne(await supabase.from("questions").insert({ ...fields, created_by: admin.id, updated_by: admin.id }).select("id").single());
      id = created.id as string;
      ensure(await supabase.from("question_options").insert(options.map((o, i) => ({ question_id: id, text: o.text, is_correct: o.is_correct, position: i + 1 }))));
      await logAudit("question.created", "question", id, fields.statement.slice(0, 80));
    }

    if (linkToExamId) {
      const exam = uuid.parse(linkToExamId);
      const { data: last } = await supabase.from("exam_questions").select("position").eq("exam_id", exam).order("position", { ascending: false }).limit(1).maybeSingle();
      await supabase.from("exam_questions").upsert({ exam_id: exam, question_id: id, position: (last?.position ?? 0) + 1 }, { onConflict: "exam_id,question_id", ignoreDuplicates: true });
    }
    revalidateExams(linkToExamId);
    revalidatePath(`/admin/avaliacoes/questoes/${id}`);
    return { ok: true, data: { id }, message: "Questão salva." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function duplicateQuestionAction(questionId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const supabase = await createClient();
    const { data: q } = await supabase.from("questions").select("*, question_options(*)").eq("id", uuid.parse(questionId)).single();
    if (!q) return { ok: false, error: "Questão não encontrada." };
    const created = ensureOne(
      await supabase
        .from("questions")
        .insert({
          statement: q.statement,
          type: q.type,
          category: q.category,
          difficulty: q.difficulty,
          explanation: q.explanation,
          points: q.points,
          module_id: q.module_id,
          status: "draft",
          created_by: admin.id,
          updated_by: admin.id,
        })
        .select("id")
        .single(),
    );
    const opts = ((q.question_options ?? []) as { text: string; is_correct: boolean; position: number }[]).map((o) => ({
      question_id: created.id,
      text: o.text,
      is_correct: o.is_correct,
      position: o.position,
    }));
    if (opts.length) ensure(await supabase.from("question_options").insert(opts));
    await logAudit("question.duplicated", "question", created.id, null, { source: questionId });
    revalidateExams();
    return { ok: true, data: { id: created.id as string }, message: "Questão duplicada como rascunho." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveQuestionAction(questionId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(questionId);
    const supabase = await createClient();
    const { count } = await supabase.from("exam_answers").select("id", { count: "exact", head: true }).eq("question_id", id);
    if (count) {
      // Mantém o histórico: apenas arquiva e remove das provas.
      ensure(await supabase.from("questions").update({ status: "archived" }).eq("id", id));
    } else {
      ensure(await supabase.from("questions").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    }
    ensure(await supabase.from("exam_questions").delete().eq("question_id", id));
    await logAudit(count ? "question.archived" : "question.deleted", "question", id, null);
    revalidateExams();
  } catch (err) {
    return toActionError(err);
  }
  redirect("/admin/avaliacoes/questoes");
}

// ---------------------------------------------------------------------------
// Colaborador: realizar prova
// ---------------------------------------------------------------------------

export async function startExamAction(examId: string): Promise<ActionResult> {
  let attemptId: string;
  try {
    await assertUser();
    const supabase = await createClient();
    attemptId = ensure(await supabase.rpc("fn_start_exam", { p_exam: uuid.parse(examId) })) as string;
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/provas/tentativa/${attemptId}`);
}

export async function saveAnswerAction(attemptId: string, questionId: string, optionIds: string[]): Promise<ActionResult> {
  try {
    await assertUser();
    const supabase = await createClient();
    ensure(
      await supabase.rpc("fn_save_answer", {
        p_attempt: uuid.parse(attemptId),
        p_question: uuid.parse(questionId),
        p_option_ids: z.array(uuid).max(20).parse(optionIds),
      }),
    );
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function submitExamAction(attemptId: string, answers: Record<string, string[]>): Promise<ActionResult> {
  let id: string;
  try {
    const profile = await assertUser();
    id = uuid.parse(attemptId);
    const parsed = z.record(z.uuid(), z.array(uuid).max(20)).parse(answers);
    const supabase = await createClient();
    const result = ensure(await supabase.rpc("fn_submit_exam", { p_attempt: id, p_answers: parsed })) as {
      already_graded?: boolean;
      score_percent?: number;
      passed?: boolean;
      course_completed?: boolean;
    };

    if (!result.already_graded) {
      after(async () => {
        const sb = await createClient();
        const { data: a } = await sb.from("exam_attempts").select("attempt_number, exam:exams(title, max_attempts, show_result, module:modules(course:courses(title)))").eq("id", id).single();
        const exam = (a as unknown as {
          attempt_number: number;
          exam: { title: string; max_attempts: number | null; show_result: boolean; module: { course: { title: string } | null } | null } | null;
        } | null)?.exam;
        if (exam?.show_result) {
          await sendEmail({
            to: profile.email,
            template: "examResult",
            userId: profile.id,
            content: emailTemplates.examResult({
              name: profile.full_name,
              examTitle: exam.title,
              score: Number(result.score_percent ?? 0),
              passed: Boolean(result.passed),
              attempt: a?.attempt_number ?? 1,
              maxAttempts: exam.max_attempts,
              url: `${publicEnv.appUrl}/provas/resultado/${id}`,
            }),
          });
        }
        if (result.course_completed) {
          await sendEmail({
            to: profile.email,
            template: "courseCompleted",
            userId: profile.id,
            content: emailTemplates.courseCompleted({ name: profile.full_name, courseTitle: exam?.module?.course?.title ?? "sua trilha", url: `${publicEnv.appUrl}/certificados` }),
          });
        }
      });
    }
    revalidatePath("/inicio");
    revalidatePath("/provas", "layout");
    revalidatePath("/modulos", "layout");
    revalidatePath("/trilhas", "layout");
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/provas/resultado/${id}`);
}
