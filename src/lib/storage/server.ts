import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/config/app";
import { PUBLIC_BUCKETS, UPLOAD_PROFILES, getExtension, type BucketId, type UploadProfileId } from "@/config/uploads";
import { ActionError } from "@/lib/auth/dal";

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Caminho único e previsível: <prefixo>/<aaaa-mm>/<uuid>-<nome>.<ext> */
export function buildObjectPath(profileId: UploadProfileId, fileName: string, ownerId?: string): string {
  const ext = getExtension(fileName);
  const base = slugify(fileName.replace(/\.[^.]+$/, "")) || "arquivo";
  const id = crypto.randomUUID();
  if (profileId === "avatar") {
    if (!ownerId) throw new ActionError("Usuário do avatar não informado.");
    return `${ownerId}/${id}.${ext}`;
  }
  const prefix: Record<UploadProfileId, string> = {
    courseCover: "courses",
    moduleCover: "modules",
    announcementImage: "announcements",
    avatar: "",
    material: "materials",
    document: "documents",
    video: "videos",
    videoThumbnail: "thumbnails",
  };
  const month = new Date().toISOString().slice(0, 7);
  return `${prefix[profileId]}/${month}/${id}-${base}.${ext}`;
}

export function bucketFor(profileId: UploadProfileId): BucketId {
  return UPLOAD_PROFILES[profileId].bucket;
}

export function isPublicBucket(bucket: string): boolean {
  return (PUBLIC_BUCKETS as readonly string[]).includes(bucket);
}

/** Confirma que o objeto foi realmente enviado ao Storage antes de gravar metadados. */
export async function assertObjectExists(bucket: string, path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).exists(path);
  if (error || !data) throw new ActionError("Arquivo não encontrado no armazenamento. Envie novamente.");
}

export async function signedUrl(
  bucket: string,
  path: string,
  ttlSeconds: number = APP_CONFIG.signedUrlTtl.material,
  download?: string | boolean,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds, download ? { download } : undefined);
  if (error) return null;
  return data.signedUrl;
}

export async function removeObjects(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove(paths);
}
