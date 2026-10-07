"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, ensureOne, toActionError, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { assertObjectExists, removeObjects, signedUrl } from "@/lib/storage/server";
import { kindFromFileName, type MaterialKind } from "@/config/uploads";
import { searchMaterials } from "@/services/materials";
import { APP_CONFIG } from "@/config/app";

const uuid = z.uuid();
const MATERIAL_BUCKETS = ["lesson-materials", "documents"] as const;

const uploadedFileSchema = z.object({
  bucket: z.enum(MATERIAL_BUCKETS),
  path: z.string().min(3).max(500),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(200),
});

function revalidateMaterials(lessonId?: string) {
  revalidatePath("/admin/conteudos/biblioteca");
  revalidatePath("/admin/conteudos/materiais");
  if (lessonId) {
    revalidatePath(`/admin/conteudos/aulas/${lessonId}`);
    revalidatePath(`/aulas/${lessonId}`);
  }
}

/** Registra na biblioteca um arquivo já enviado ao Storage (opcionalmente anexando a uma aula). */
export async function registerMaterialAction(
  file: z.input<typeof uploadedFileSchema>,
  attachToLessonId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const f = uploadedFileSchema.parse(file);
    await assertObjectExists(f.bucket, f.path);
    const supabase = await createClient();
    const title = f.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || f.fileName;
    const created = ensureOne(
      await supabase
        .from("materials")
        .insert({
          title,
          kind: kindFromFileName(f.fileName),
          bucket: f.bucket,
          storage_path: f.path,
          file_name: f.fileName,
          mime_type: f.mime,
          size_bytes: f.size,
          uploaded_by: admin.id,
        })
        .select("id")
        .single(),
    );
    await logAudit("material.uploaded", "material", created.id, f.fileName, { size: f.size, bucket: f.bucket });
    if (attachToLessonId) await attach(uuid.parse(attachToLessonId), created.id);
    revalidateMaterials(attachToLessonId);
    return { ok: true, data: { id: created.id }, message: "Material adicionado." };
  } catch (err) {
    return toActionError(err);
  }
}

const linkSchema = z.object({
  title: z.string().trim().min(2).max(200),
  url: z.url("URL inválida.").refine((u) => /^https?:\/\//.test(u), "Use http(s)://"),
});

export async function createLinkMaterialAction(input: z.input<typeof linkSchema>, attachToLessonId?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const v = linkSchema.parse(input);
    const supabase = await createClient();
    const created = ensureOne(
      await supabase.from("materials").insert({ title: v.title, kind: "link", external_url: v.url, uploaded_by: admin.id }).select("id").single(),
    );
    await logAudit("material.created", "material", created.id, v.title, { url: v.url });
    if (attachToLessonId) await attach(uuid.parse(attachToLessonId), created.id);
    revalidateMaterials(attachToLessonId);
    return { ok: true, data: { id: created.id }, message: "Link adicionado." };
  } catch (err) {
    return toActionError(err);
  }
}

async function attach(lessonId: string, materialId: string) {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("lesson_materials")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  ensure(
    await supabase
      .from("lesson_materials")
      .upsert({ lesson_id: lessonId, material_id: materialId, position: (last?.position ?? 0) + 1 }, { onConflict: "lesson_id,material_id", ignoreDuplicates: true }),
  );
}

export async function attachMaterialAction(lessonId: string, materialId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    await attach(uuid.parse(lessonId), uuid.parse(materialId));
    await logAudit("material.attached", "lesson", lessonId, null, { material: materialId });
    revalidateMaterials(lessonId);
    return { ok: true, message: "Material anexado à aula." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function detachMaterialAction(lessonId: string, materialId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    ensure(await supabase.from("lesson_materials").delete().eq("lesson_id", uuid.parse(lessonId)).eq("material_id", uuid.parse(materialId)));
    await logAudit("material.detached", "lesson", lessonId, null, { material: materialId });
    revalidateMaterials(lessonId);
    return { ok: true, message: "Material removido da aula (continua na biblioteca)." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function renameMaterialAction(materialId: string, title: string, description?: string | null): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(materialId);
    const t = z.string().trim().min(1).max(200).parse(title);
    const supabase = await createClient();
    const { data: before } = await supabase.from("materials").select("title").eq("id", id).single();
    ensure(await supabase.from("materials").update({ title: t, description: description?.trim() || null }).eq("id", id));
    await logAudit("material.renamed", "material", id, t, { title: { from: before?.title, to: t } });
    revalidateMaterials();
    return { ok: true, message: "Material atualizado." };
  } catch (err) {
    return toActionError(err);
  }
}

/** Substitui o arquivo mantendo o mesmo material (e os vínculos com aulas). */
export async function replaceMaterialFileAction(materialId: string, file: z.input<typeof uploadedFileSchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(materialId);
    const f = uploadedFileSchema.parse(file);
    await assertObjectExists(f.bucket, f.path);
    const supabase = await createClient();
    const { data: before } = await supabase.from("materials").select("bucket, storage_path, file_name").eq("id", id).single();
    ensure(
      await supabase
        .from("materials")
        .update({ bucket: f.bucket, storage_path: f.path, file_name: f.fileName, mime_type: f.mime, size_bytes: f.size, kind: kindFromFileName(f.fileName), external_url: null })
        .eq("id", id),
    );
    if (before?.bucket && before.storage_path && before.storage_path !== f.path) await removeObjects(before.bucket, [before.storage_path]);
    await logAudit("material.replaced", "material", id, f.fileName, { from: before?.file_name, to: f.fileName });
    revalidateMaterials();
    return { ok: true, message: "Arquivo substituído. As aulas já usam a nova versão." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setMaterialStatusAction(materialId: string, status: "active" | "archived"): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(materialId);
    const supabase = await createClient();
    ensure(await supabase.from("materials").update({ status }).eq("id", id));
    await logAudit(status === "archived" ? "material.archived" : "material.restored", "material", id, null);
    revalidateMaterials();
    return { ok: true, message: status === "archived" ? "Material arquivado (oculto para colaboradores)." : "Material reativado." };
  } catch (err) {
    return toActionError(err);
  }
}

/** Exclusão definitiva do arquivo; o registro fica marcado como excluído para histórico. */
export async function deleteMaterialAction(materialId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = uuid.parse(materialId);
    const supabase = await createClient();
    const { data: m } = await supabase.from("materials").select("bucket, storage_path, title").eq("id", id).single();
    ensure(await supabase.from("lesson_materials").delete().eq("material_id", id));
    ensure(await supabase.from("materials").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id));
    if (m?.bucket && m.storage_path) await removeObjects(m.bucket, [m.storage_path]);
    await logAudit("material.deleted", "material", id, m?.title ?? null);
    revalidateMaterials();
    return { ok: true, message: "Material excluído." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function searchMaterialsAction(term: string, excludeIds: string[]) {
  await assertAdmin();
  return searchMaterials(z.string().max(80).parse(term), z.array(uuid).max(200).parse(excludeIds));
}

/** URL temporária para visualizar/baixar um material (RLS decide o acesso). */
export async function getMaterialUrlAction(materialId: string, download = false): Promise<ActionResult<{ url: string; kind: MaterialKind }>> {
  try {
    await assertUser();
    const id = uuid.parse(materialId);
    const supabase = await createClient();
    const { data: m } = await supabase.from("materials").select("bucket, storage_path, external_url, file_name, kind").eq("id", id).maybeSingle();
    if (!m) return { ok: false, error: "Material indisponível." };
    if (m.external_url) return { ok: true, data: { url: m.external_url, kind: m.kind } };
    const url = await signedUrl(m.bucket!, m.storage_path!, APP_CONFIG.signedUrlTtl.material, download ? (m.file_name ?? true) : undefined);
    if (!url) return { ok: false, error: "Não foi possível gerar o link do arquivo." };
    return { ok: true, data: { url, kind: m.kind } };
  } catch (err) {
    return toActionError(err);
  }
}
