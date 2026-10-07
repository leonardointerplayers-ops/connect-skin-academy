import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/config/app";
import type { Material } from "@/types/domain";

export interface LibraryItem extends Material {
  uploader: { full_name: string } | null;
  usages: { lesson_id: string; lesson_title: string; module_title: string }[];
}

export async function listLibrary(filters: { q?: string; kind?: string; status?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = APP_CONFIG.pageSize;
  let q = supabase
    .from("materials")
    .select(
      "*, uploader:profiles!materials_uploaded_by_fkey(full_name), lesson_materials(lesson:lessons(id, title, deleted_at, module:modules(title)))",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (filters.q) {
    const term = filters.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
    if (term) q = q.or(`title.ilike.%${term}%,file_name.ilike.%${term}%`);
  }
  if (filters.kind) q = q.eq("kind", filters.kind);
  q = q.eq("status", filters.status === "archived" ? "archived" : "active");
  const from = (page - 1) * pageSize;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as (Material & {
    uploader: { full_name: string } | null;
    lesson_materials: { lesson: { id: string; title: string; deleted_at: string | null; module: { title: string } | null } | null }[];
  })[]).map(({ lesson_materials, ...m }) => ({
    ...m,
    usages: lesson_materials
      .map((lm) => lm.lesson)
      .filter((l): l is NonNullable<typeof l> => Boolean(l && !l.deleted_at))
      .map((l) => ({ lesson_id: l.id, lesson_title: l.title, module_title: l.module?.title ?? "" })),
  })) as LibraryItem[];

  return { rows, total: count ?? 0, page, pageSize };
}

/** Busca rápida para anexar materiais existentes em uma aula. */
export async function searchMaterials(term: string, excludeIds: string[] = []) {
  const supabase = await createClient();
  let q = supabase.from("materials").select("id, title, kind, file_name, size_bytes, external_url").is("deleted_at", null).eq("status", "active");
  const t = term.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
  if (t) q = q.or(`title.ilike.%${t}%,file_name.ilike.%${t}%`);
  const { data } = await q.order("created_at", { ascending: false }).limit(30);
  return ((data ?? []) as Pick<Material, "id" | "title" | "kind" | "file_name" | "size_bytes" | "external_url">[]).filter(
    (m) => !excludeIds.includes(m.id),
  );
}

export async function listLessonMaterialLinks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_materials")
    .select("position, lesson:lessons!inner(id, title, deleted_at, module:modules(title, position)), material:materials!inner(id, title, kind, size_bytes, deleted_at, status)")
    .is("lesson.deleted_at", null)
    .is("material.deleted_at", null)
    .limit(1000);
  return (data ?? []) as unknown as {
    position: number;
    lesson: { id: string; title: string; module: { title: string; position: number } | null };
    material: { id: string; title: string; kind: string; size_bytes: number | null; status: string };
  }[];
}
