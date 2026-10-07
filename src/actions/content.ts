"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, ensureOne, toActionError, type ActionResult } from "@/lib/actions";
import { courseSchema, lessonSchema, moduleSchema, videoSourceSchema, youtubeIdFromUrl } from "@/lib/validation/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { diff, logAudit } from "@/lib/audit";
import { assertObjectExists } from "@/lib/storage/server";
import { emailNewModuleLater, enrolledUserIds, notifyUsers } from "@/lib/notify";

const uuid = z.uuid();

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function revalidateContent() {
  revalidatePath("/admin/conteudos", "layout");
  revalidatePath("/inicio");
  revalidatePath("/trilhas", "layout");
}

// ---------------------------------------------------------------------------
// Trilhas
// ---------------------------------------------------------------------------

export async function createCourseAction(formData: FormData) {
  const admin = await assertAdmin();
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const supabase = await createClient();
  const { data: last } = await supabase.from("courses").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const created = ensureOne(
    await supabase
      .from("courses")
      .insert({ title, status: "draft", position: (last?.position ?? 0) + 1, created_by: admin.id, updated_by: admin.id })
      .select("id")
      .single(),
  );
  await logAudit("course.created", "course", created.id, title);
  redirect(`/admin/conteudos/trilhas/${created.id}`);
}

export async function updateCourseAction(courseId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = uuid.parse(courseId);
    const input = courseSchema.parse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
      description: formData.get("description"),
      category: formData.get("category"),
      cover_path: formData.get("cover_path"),
      thumbnail_path: formData.get("thumbnail_path"),
      status: formData.get("status"),
      require_sequential: checkbox(formData, "require_sequential"),
      certificate_enabled: checkbox(formData, "certificate_enabled"),
      workload_hours: formData.get("workload_hours"),
      due_days: formData.get("due_days"),
      audience: formData.get("audience"),
      group_ids: formData.getAll("group_ids").map(String),
    });
    const supabase = await createClient();
    const { data: before } = await supabase.from("courses").select("*").eq("id", id).single();
    const { group_ids, ...fields } = input;
    const publishedNow = fields.status === "published" && before?.status !== "published";
    const patch = {
      ...fields,
      updated_by: admin.id,
      ...(publishedNow && !before?.published_at ? { published_at: new Date().toISOString() } : {}),
    };
    ensure(await supabase.from("courses").update(patch).eq("id", id));

    ensure(await supabase.from("course_groups").delete().eq("course_id", id));
    if (fields.audience === "groups" && group_ids.length) {
      ensure(await supabase.from("course_groups").insert(group_ids.map((group_id) => ({ course_id: id, group_id }))));
    }
    if (fields.status === "published") await supabase.rpc("fn_admin_sync_enrollments");

    await logAudit(publishedNow ? "course.published" : "course.updated", "course", id, fields.title, diff(before, patch));
    if (publishedNow) {
      const users = await enrolledUserIds(id);
      await notifyUsers(users, { type: "course_published", title: "🎓 Nova trilha disponível", body: fields.title, link: `/trilhas/${id}` });
    }
    revalidateContent();
    return { ok: true, message: publishedNow ? "Trilha publicada e colaboradores matriculados." : "Trilha salva." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(courseId);
    const supabase = await createClient();
    ensure(await supabase.from("courses").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    await logAudit("course.deleted", "course", id, null);
    revalidateContent();
  } catch (err) {
    return toActionError(err);
  }
  redirect("/admin/conteudos/trilhas");
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

export async function createModuleAction(courseId: string, formData: FormData) {
  const admin = await assertAdmin();
  const cid = uuid.parse(courseId);
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", cid)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const created = ensureOne(
    await supabase
      .from("modules")
      .insert({ course_id: cid, title, status: "draft", position: (last?.position ?? 0) + 1, created_by: admin.id, updated_by: admin.id })
      .select("id")
      .single(),
  );
  await logAudit("module.created", "module", created.id, title);
  redirect(`/admin/conteudos/modulos/${created.id}`);
}

export async function updateModuleAction(moduleId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = uuid.parse(moduleId);
    const input = moduleSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      cover_path: formData.get("cover_path"),
      thumbnail_path: formData.get("thumbnail_path"),
      featured_image_path: formData.get("featured_image_path"),
      status: formData.get("status"),
      release_type: formData.get("release_type"),
      release_at: formData.get("release_at"),
      release_days: formData.get("release_days"),
      due_date: formData.get("due_date"),
      points: formData.get("points"),
      competency_ids: formData.getAll("competency_ids").map(String),
    });
    const supabase = await createClient();
    const { data: before } = await supabase.from("modules").select("*").eq("id", id).single();
    const { competency_ids, ...fields } = input;
    const publishedNow = fields.status === "published" && before?.status !== "published";
    const patch = {
      ...fields,
      release_at: fields.release_type === "date" ? fields.release_at : null,
      release_days: fields.release_type === "days_after_join" ? fields.release_days : null,
      updated_by: admin.id,
      ...(publishedNow && !before?.published_at ? { published_at: new Date().toISOString() } : {}),
    };
    ensure(await supabase.from("modules").update(patch).eq("id", id));

    ensure(await supabase.from("module_competencies").delete().eq("module_id", id));
    if (competency_ids.length) {
      ensure(await supabase.from("module_competencies").insert(competency_ids.map((competency_id) => ({ module_id: id, competency_id }))));
    }

    if (before && before.status !== fields.status) {
      // Mudança de publicação altera o total de módulos das trilhas.
      await supabase.rpc("fn_admin_recalc_module", { p_module: id });
    }

    await logAudit(publishedNow ? "module.published" : "module.updated", "module", id, fields.title, diff(before, patch));

    if (publishedNow && !before?.published_at && fields.release_type === "immediate") {
      const users = await enrolledUserIds(before.course_id);
      await notifyUsers(users, {
        type: "module_released",
        title: "📚 Novo módulo liberado",
        body: `O módulo "${fields.title}" já está disponível.`,
        link: `/modulos/${id}`,
      });
      emailNewModuleLater(users, fields.title, id);
    }
    revalidateContent();
    return { ok: true, message: publishedNow ? "Módulo publicado." : "Módulo salvo." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteModuleAction(moduleId: string): Promise<ActionResult> {
  let courseId: string | undefined;
  try {
    await assertAdmin();
    const id = uuid.parse(moduleId);
    const supabase = await createClient();
    const { data } = await supabase.from("modules").select("course_id, title").eq("id", id).single();
    courseId = data?.course_id;
    ensure(await supabase.from("modules").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    await supabase.rpc("fn_admin_recalc_module", { p_module: id });
    await logAudit("module.deleted", "module", id, data?.title ?? null);
    revalidateContent();
  } catch (err) {
    return toActionError(err);
  }
  redirect(courseId ? `/admin/conteudos/trilhas/${courseId}` : "/admin/conteudos/modulos");
}

export async function duplicateModuleAction(moduleId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const id = ensure(await supabase.rpc("fn_admin_duplicate_module", { p_module: uuid.parse(moduleId) })) as string;
    revalidateContent();
    return { ok: true, data: { id }, message: "Módulo duplicado como rascunho (com aulas e prova)." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Aulas
// ---------------------------------------------------------------------------

export async function createLessonAction(moduleId: string, formData: FormData) {
  const admin = await assertAdmin();
  const mid = uuid.parse(moduleId);
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const supabase = await createClient();
  const [{ data: last }, { data: settings }] = await Promise.all([
    supabase.from("lessons").select("position").eq("module_id", mid).is("deleted_at", null).order("position", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("app_settings").select("default_video_completion_percent").maybeSingle(),
  ]);
  const created = ensureOne(
    await supabase
      .from("lessons")
      .insert({
        module_id: mid,
        title,
        status: "draft",
        position: (last?.position ?? 0) + 1,
        min_video_percent: settings?.default_video_completion_percent ?? 90,
        created_by: admin.id,
        updated_by: admin.id,
      })
      .select("id")
      .single(),
  );
  await logAudit("lesson.created", "lesson", created.id, title);
  redirect(`/admin/conteudos/aulas/${created.id}`);
}

export async function updateLessonAction(lessonId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = uuid.parse(lessonId);
    const input = lessonSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      content_html: formData.get("content_html"),
      status: formData.get("status"),
      is_required: checkbox(formData, "is_required"),
      video_required: checkbox(formData, "video_required"),
      min_video_percent: formData.get("min_video_percent"),
      activity_enabled: checkbox(formData, "activity_enabled"),
      activity_title: formData.get("activity_title"),
      activity_instructions: formData.get("activity_instructions"),
      activity_requires_response: checkbox(formData, "activity_requires_response"),
      estimated_minutes: formData.get("estimated_minutes"),
      points: formData.get("points"),
    });
    const supabase = await createClient();
    const { data: before } = await supabase.from("lessons").select("*, module:modules(id, title, course_id, status)").eq("id", id).single();
    const publishedNow = input.status === "published" && before?.status !== "published";
    const patch = {
      ...input,
      content_html: sanitizeRichText(input.content_html),
      updated_by: admin.id,
      ...(publishedNow && !before?.published_at ? { published_at: new Date().toISOString() } : {}),
    };
    ensure(await supabase.from("lessons").update(patch).eq("id", id));

    const rulesChanged =
      before &&
      (before.status !== input.status ||
        before.is_required !== input.is_required ||
        before.video_required !== input.video_required ||
        before.activity_enabled !== input.activity_enabled);
    if (rulesChanged) await supabase.rpc("fn_admin_recalc_module", { p_module: before.module_id });

    const { module: _m, ...beforeFields } = (before ?? {}) as Record<string, unknown>;
    void _m;
    await logAudit(publishedNow ? "lesson.published" : "lesson.updated", "lesson", id, input.title, diff(beforeFields, { ...patch, content_html: patch.content_html ? "[conteúdo]" : null }));

    const mod = before?.module as { id: string; title: string; course_id: string; status: string } | undefined;
    if (publishedNow && !before?.published_at && mod?.status === "published") {
      const users = await enrolledUserIds(mod.course_id);
      await notifyUsers(users, {
        type: "lesson_published",
        title: "▶️ Nova aula disponível",
        body: `"${input.title}" foi adicionada ao módulo "${mod.title}".`,
        link: `/aulas/${id}`,
      });
    }
    revalidateContent();
    revalidatePath(`/aulas/${id}`);
    return { ok: true, message: publishedNow ? "Aula publicada." : "Aula salva." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteLessonAction(lessonId: string): Promise<ActionResult> {
  let moduleId: string | undefined;
  try {
    await assertAdmin();
    const id = uuid.parse(lessonId);
    const supabase = await createClient();
    const { data } = await supabase.from("lessons").select("module_id, title").eq("id", id).single();
    moduleId = data?.module_id;
    ensure(await supabase.from("lessons").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    if (moduleId) await supabase.rpc("fn_admin_recalc_module", { p_module: moduleId });
    await logAudit("lesson.deleted", "lesson", id, data?.title ?? null);
    revalidateContent();
  } catch (err) {
    return toActionError(err);
  }
  redirect(moduleId ? `/admin/conteudos/modulos/${moduleId}` : "/admin/conteudos/aulas");
}

export async function duplicateLessonAction(lessonId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const id = ensure(await supabase.rpc("fn_admin_duplicate_lesson", { p_lesson: uuid.parse(lessonId), p_target_module: null })) as string;
    revalidateContent();
    return { ok: true, data: { id }, message: "Aula duplicada como rascunho." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Vídeo da aula
// ---------------------------------------------------------------------------

export async function setLessonVideoAction(lessonId: string, source: z.input<typeof videoSourceSchema> | null): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = uuid.parse(lessonId);
    const supabase = await createClient();
    const { data: lesson } = await supabase.from("lessons").select("video_id, module_id, title").eq("id", id).single();
    if (!lesson) return { ok: false, error: "Aula não encontrada." };

    if (!source) {
      ensure(await supabase.from("lessons").update({ video_id: null }).eq("id", id));
      if (lesson.video_id) await supabase.from("videos").update({ deleted_at: new Date().toISOString() }).eq("id", lesson.video_id);
      await logAudit("lesson.video_removed", "lesson", id, lesson.title);
    } else {
      const v = videoSourceSchema.parse(source);
      const row: Record<string, unknown> = { provider: v.provider, title: v.title, uploaded_by: admin.id, duration_seconds: v.duration_seconds ?? null, status: "ready" };
      if (v.provider === "supabase") {
        await assertObjectExists("video-assets", v.storage_path);
        Object.assign(row, { storage_bucket: "video-assets", storage_path: v.storage_path, size_bytes: v.size_bytes ?? null, mime_type: v.mime_type ?? null });
      } else if (v.provider === "youtube") {
        const ytId = youtubeIdFromUrl(v.external_url);
        if (!ytId) return { ok: false, error: "Não reconheci o link do YouTube. Use o link do vídeo (youtube.com/watch?v=… ou youtu.be/…)." };
        Object.assign(row, { external_url: v.external_url, provider_asset_id: ytId });
      } else {
        if (!/\.(mp4|webm|m4v|mov)(\?|$)/i.test(v.external_url)) {
          return { ok: false, error: "A URL externa deve apontar diretamente para um arquivo de vídeo (.mp4 ou .webm)." };
        }
        Object.assign(row, { external_url: v.external_url });
      }
      const video = ensureOne(await supabase.from("videos").insert(row).select("id").single());
      ensure(await supabase.from("lessons").update({ video_id: video.id }).eq("id", id));
      if (lesson.video_id) await supabase.from("videos").update({ deleted_at: new Date().toISOString() }).eq("id", lesson.video_id);
      await logAudit("lesson.video_set", "lesson", id, lesson.title, { provider: v.provider });
    }
    await supabase.rpc("fn_admin_recalc_module", { p_module: lesson.module_id });
    revalidatePath(`/admin/conteudos/aulas/${id}`);
    revalidatePath(`/aulas/${id}`);
    return { ok: true, message: source ? "Vídeo vinculado à aula." : "Vídeo removido." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateVideoMetaAction(
  videoId: string,
  meta: { duration_seconds?: number | null; thumbnail_path?: string | null; title?: string | null },
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(videoId);
    const input = z
      .object({
        duration_seconds: z.number().positive().max(43200).nullable().optional(),
        thumbnail_path: z.string().max(500).nullable().optional(),
        title: z.string().max(200).nullable().optional(),
      })
      .parse(meta);
    if (input.thumbnail_path) await assertObjectExists("video-assets", input.thumbnail_path);
    const supabase = await createClient();
    ensure(await supabase.from("videos").update(input).eq("id", id));
    revalidatePath("/admin/conteudos", "layout");
    return { ok: true, message: "Vídeo atualizado." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Ordenação (drag & drop)
// ---------------------------------------------------------------------------

const reorderKinds = z.enum(["courses", "modules", "lessons", "exam_questions", "lesson_materials", "question_options"]);

export async function reorderAction(kind: z.infer<typeof reorderKinds>, parentId: string | null, ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    ensure(
      await supabase.rpc("fn_admin_reorder", {
        p_kind: reorderKinds.parse(kind),
        p_parent: parentId ? uuid.parse(parentId) : null,
        p_ids: z.array(uuid).max(500).parse(ids),
      }),
    );
    await logAudit("content.reordered", kind, parentId, null, { count: ids.length });
    revalidateContent();
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
