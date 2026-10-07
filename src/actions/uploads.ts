"use server";

import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { toActionError, type ActionResult } from "@/lib/actions";
import { UPLOAD_PROFILES, validateUpload, type UploadProfileId } from "@/config/uploads";
import { bucketFor, buildObjectPath } from "@/lib/storage/server";

const requestSchema = z.object({
  profile: z.enum(Object.keys(UPLOAD_PROFILES) as [UploadProfileId, ...UploadProfileId[]]),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(200),
  ownerId: z.uuid().optional(),
});

export interface UploadTicket {
  bucket: string;
  path: string;
  signedUrl: string;
  mime: string;
}

/**
 * Valida o arquivo (extensão, MIME, tamanho) e devolve uma URL de upload
 * assinada. O navegador envia o arquivo direto ao Storage (com barra de
 * progresso) — o servidor da aplicação não trafega o binário.
 */
export async function requestUploadAction(input: z.input<typeof requestSchema>): Promise<ActionResult<UploadTicket>> {
  try {
    const req = requestSchema.parse(input);
    const profile = req.profile === "avatar" ? await assertUser() : await assertAdmin();

    let ownerId = req.ownerId;
    if (req.profile === "avatar") {
      if (ownerId && ownerId !== profile.id && profile.role_id !== "admin") {
        return { ok: false, error: "Você só pode alterar a própria foto." };
      }
      ownerId = ownerId ?? profile.id;
    }

    const check = validateUpload(req.profile, { name: req.fileName, size: req.size, type: req.type });
    if (!check.ok) return { ok: false, error: check.error };

    const bucket = bucketFor(req.profile);
    const path = buildObjectPath(req.profile, req.fileName, ownerId);
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) {
      return { ok: false, error: "Não foi possível preparar o upload. Verifique se os buckets foram criados (003_storage.sql)." };
    }
    return { ok: true, data: { bucket, path, signedUrl: data.signedUrl, mime: check.mime } };
  } catch (err) {
    return toActionError(err);
  }
}
