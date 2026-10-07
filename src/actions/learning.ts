"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, toActionError, type ActionResult } from "@/lib/actions";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";

const uuid = z.uuid();

export interface CompletionResult {
  completed: boolean;
  missing: string[];
  module_completed?: boolean;
  course_completed?: boolean;
}

function revalidateLearner(lessonId?: string) {
  revalidatePath("/inicio");
  revalidatePath("/trilhas", "layout");
  revalidatePath("/modulos", "layout");
  if (lessonId) revalidatePath(`/aulas/${lessonId}`);
}

async function emailCourseCompletion(lessonOrModuleCourseId: string | null) {
  if (!lessonOrModuleCourseId) return;
  const profile = await assertUser();
  after(async () => {
    const supabase = await createClient();
    const { data: course } = await supabase.from("courses").select("title").eq("id", lessonOrModuleCourseId).maybeSingle();
    await sendEmail({
      to: profile.email,
      template: "courseCompleted",
      userId: profile.id,
      content: emailTemplates.courseCompleted({ name: profile.full_name, courseTitle: course?.title ?? "Trilha", url: `${publicEnv.appUrl}/certificados` }),
    });
  });
}

export async function trackLessonViewAction(lessonId: string): Promise<void> {
  try {
    await assertUser();
    const supabase = await createClient();
    await supabase.rpc("fn_track_lesson_view", { p_lesson: uuid.parse(lessonId) });
  } catch {
    // Telemetria nunca deve quebrar a aula.
  }
}

export async function trackStudyTimeAction(lessonId: string, seconds: number): Promise<void> {
  try {
    await assertUser();
    const supabase = await createClient();
    await supabase.rpc("fn_track_study_time", { p_lesson: uuid.parse(lessonId), p_seconds: Math.max(0, Math.min(60, Math.round(seconds))) });
  } catch {}
}

export async function trackVideoAction(
  lessonId: string,
  position: number,
  duration: number | null,
): Promise<ActionResult<{ percent: number; videoCompleted: boolean; lessonCompleted: boolean; courseCompleted: boolean }>> {
  try {
    await assertUser();
    const supabase = await createClient();
    const data = ensure(
      await supabase.rpc("fn_track_video", {
        p_lesson: uuid.parse(lessonId),
        p_position: Math.max(0, Number(position) || 0),
        p_duration: duration && Number.isFinite(duration) ? duration : null,
      }),
    ) as { tracked: boolean; percent?: number; video_completed?: boolean; lesson?: CompletionResult & { course_id?: string } };
    const lessonCompleted = Boolean(data.lesson?.completed);
    if (lessonCompleted) revalidateLearner(lessonId);
    if (data.lesson?.course_completed) await emailCourseCompletion(await courseIdOfLesson(lessonId));
    return {
      ok: true,
      data: {
        percent: Number(data.percent ?? 0),
        videoCompleted: Boolean(data.video_completed),
        lessonCompleted,
        courseCompleted: Boolean(data.lesson?.course_completed),
      },
    };
  } catch (err) {
    return toActionError(err);
  }
}

async function courseIdOfLesson(lessonId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select("module:modules(course_id)").eq("id", lessonId).maybeSingle();
  return (data as unknown as { module: { course_id: string } | null } | null)?.module?.course_id ?? null;
}

export async function completeLessonAction(lessonId: string): Promise<ActionResult<CompletionResult>> {
  try {
    await assertUser();
    const id = uuid.parse(lessonId);
    const supabase = await createClient();
    const result = ensure(await supabase.rpc("fn_complete_lesson", { p_lesson: id })) as CompletionResult;
    if (result.course_completed) await emailCourseCompletion(await courseIdOfLesson(id));
    revalidateLearner(id);
    if (!result.completed) {
      const reasons = result.missing.map((m) => (m === "video" ? "assistir ao vídeo até o mínimo exigido" : "concluir a atividade"));
      return { ok: false, error: `Para concluir, falta: ${reasons.join(" e ")}.` };
    }
    return { ok: true, data: result, message: result.course_completed ? "🎓 Trilha concluída!" : result.module_completed ? "🏆 Módulo concluído!" : "Aula concluída!" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function submitActivityAction(lessonId: string, _prev: ActionResult<CompletionResult> | null, formData: FormData): Promise<ActionResult<CompletionResult>> {
  try {
    await assertUser();
    const id = uuid.parse(lessonId);
    const response = z.string().max(5000).optional().parse(formData.get("response") ?? undefined);
    const supabase = await createClient();
    const result = ensure(await supabase.rpc("fn_submit_activity", { p_lesson: id, p_response: response ?? "" })) as CompletionResult;
    if (result.course_completed) await emailCourseCompletion(await courseIdOfLesson(id));
    revalidateLearner(id);
    return {
      ok: true,
      data: result,
      message: result.completed ? "Atividade registrada e aula concluída!" : "Atividade registrada. Assista ao vídeo até o mínimo exigido para concluir a aula.",
    };
  } catch (err) {
    return toActionError(err);
  }
}
