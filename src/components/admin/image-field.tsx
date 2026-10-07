"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/shared/file-uploader";
import type { UploadProfileId } from "@/config/uploads";
import { cn } from "@/lib/utils";

function publicUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/${bucket}/${path}` : "";
}

/** Upload de imagem pública (capa/thumbnail) que grava o caminho num input oculto. */
export function ImageField({
  name,
  label,
  profile,
  bucket,
  defaultPath,
  aspect = "aspect-[16/9]",
  hint,
}: {
  name: string;
  label: string;
  profile: UploadProfileId;
  bucket: string;
  defaultPath?: string | null;
  aspect?: string;
  hint?: string;
}) {
  const [path, setPath] = useState(defaultPath ?? "");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={path} />
      <div className={cn("relative overflow-hidden rounded-lg border bg-muted", aspect)}>
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicUrl(bucket, path)} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="size-6" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
        {path && (
          <Button type="button" size="icon-xs" variant="secondary" className="absolute right-2 top-2" onClick={() => setPath("")} aria-label="Remover imagem">
            <X />
          </Button>
        )}
      </div>
      <FileUploader profile={profile} compact buttonLabel={path ? "Trocar imagem" : "Enviar imagem"} onUploaded={(f) => setPath(f.path)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
