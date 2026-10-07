"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/shared/progress";
import { requestUploadAction } from "@/actions/uploads";
import { UPLOAD_PROFILES, formatBytes, validateUpload, type UploadProfileId } from "@/config/uploads";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  bucket: string;
  path: string;
  fileName: string;
  size: number;
  mime: string;
  /** Duração detectada no navegador (somente vídeos). */
  durationSeconds?: number;
}

type ItemState =
  | { status: "uploading"; progress: number }
  | { status: "done" }
  | { status: "error"; error: string };

interface Item {
  id: string;
  file: File;
  state: ItemState;
}

function putWithProgress(url: string, file: File, mime: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Falha no envio (HTTP ${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (body.message?.includes("mime")) message = "Tipo de arquivo não permitido pelo armazenamento.";
        else if (body.message?.toLowerCase().includes("size") || xhr.status === 413) message = "Arquivo maior que o limite do armazenamento.";
        else if (body.message) message = body.message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Falha de rede durante o envio."));
    xhr.send(file);
  });
}

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : undefined);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    video.src = url;
  });
}

export function FileUploader({
  profile,
  ownerId,
  multiple = false,
  onUploaded,
  className,
  compact = false,
  buttonLabel,
}: {
  profile: UploadProfileId;
  ownerId?: string;
  multiple?: boolean;
  onUploaded: (file: UploadedFile) => void | Promise<void>;
  className?: string;
  compact?: boolean;
  buttonLabel?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const rules = UPLOAD_PROFILES[profile];

  const update = (id: string, state: ItemState) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, state } : i)));

  async function upload(item: Item) {
    const { file, id } = item;
    const check = validateUpload(profile, file);
    if (!check.ok) return update(id, { status: "error", error: check.error });
    update(id, { status: "uploading", progress: 0 });
    try {
      const ticket = await requestUploadAction({ profile, fileName: file.name, size: file.size, type: file.type, ownerId });
      if (!ticket.ok || !ticket.data) throw new Error(ticket.ok ? "Falha ao preparar upload." : ticket.error);
      const durationPromise = profile === "video" ? readVideoDuration(file) : Promise.resolve(undefined);
      await putWithProgress(ticket.data.signedUrl, file, ticket.data.mime, (p) => update(id, { status: "uploading", progress: p }));
      await onUploaded({
        bucket: ticket.data.bucket,
        path: ticket.data.path,
        fileName: file.name,
        size: file.size,
        mime: ticket.data.mime,
        durationSeconds: await durationPromise,
      });
      update(id, { status: "done" });
    } catch (err) {
      update(id, { status: "error", error: err instanceof Error ? err.message : "Falha no envio." });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, multiple ? 20 : 1);
    const newItems = files.map((file) => ({ id: crypto.randomUUID(), file, state: { status: "uploading", progress: 0 } as ItemState }));
    setItems((prev) => (multiple ? [...newItems, ...prev] : newItems));
    newItems.forEach((it) => void upload(it));
    if (inputRef.current) inputRef.current.value = "";
  }

  const accept = rules.extensions.map((e) => `.${e}`).join(",");

  return (
    <div className={cn("space-y-3", className)}>
      {compact ? (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <FileUp /> {buttonLabel ?? "Enviar arquivo"}
        </Button>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40",
          )}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{buttonLabel ?? "Arraste ou clique para enviar"}</span>
          <span className="text-xs text-muted-foreground">{rules.label}</span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={(e) => addFiles(e.target.files)}
      />
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card px-3 py-2.5">
              <div className="flex items-center gap-2">
                {item.state.status === "uploading" && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
                {item.state.status === "done" && <CheckCircle2 className="size-4 shrink-0 text-success" />}
                {item.state.status === "error" && <XCircle className="size-4 shrink-0 text-destructive" />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
                {item.state.status === "error" && (
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Tentar novamente" onClick={() => void upload(item)}>
                    <RotateCcw />
                  </Button>
                )}
              </div>
              {item.state.status === "uploading" && (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={item.state.progress} size="sm" />
                  <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{Math.round(item.state.progress)}%</span>
                </div>
              )}
              {item.state.status === "error" && <p className="mt-1 text-xs text-destructive">{item.state.error}</p>}
              {item.state.status === "done" && <p className="mt-1 text-xs text-success">Enviado com sucesso.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
