"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, PlayCircle, Trash2, Upload, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploader } from "@/components/shared/file-uploader";
import { setLessonVideoAction, updateVideoMetaAction } from "@/actions/content";
import { formatBytes } from "@/config/uploads";
import { formatClock } from "@/lib/format";
import type { Video } from "@/types/domain";

const PROVIDER_LABEL: Record<string, string> = {
  supabase: "Arquivo enviado (Supabase Storage)",
  external: "URL externa",
  youtube: "YouTube",
};

function parseDuration(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (!value.trim() || parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0) || null;
}

export function VideoManager({ lessonId, video, maxUploadLabel }: { lessonId: string; video: Video | null; maxUploadLabel: string }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [yt, setYt] = useState("");
  const [duration, setDuration] = useState(video?.duration_seconds ? formatClock(Number(video.duration_seconds)) : "");

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <div className="space-y-4">
      {video ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-start gap-3">
            <PlayCircle className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{PROVIDER_LABEL[video.provider] ?? video.provider}</p>
              <p className="truncate text-xs text-muted-foreground">
                {video.external_url ?? video.storage_path}
                {video.size_bytes ? ` · ${formatBytes(Number(video.size_bytes))}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remover vídeo" disabled={pending} onClick={() => run(() => setLessonVideoAction(lessonId, null))}>
              <Trash2 />
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-duration" className="text-xs">
                Duração (mm:ss)
              </Label>
              <Input id="v-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="12:30" className="h-8 w-28" />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => updateVideoMetaAction(video.id, { duration_seconds: parseDuration(duration) }))}
            >
              Salvar duração
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A duração é usada para medir o % assistido com segurança. Em uploads ela é detectada automaticamente.
          </p>
          {video.provider !== "youtube" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Thumbnail</Label>
              <FileUploader
                profile="videoThumbnail"
                compact
                buttonLabel={video.thumbnail_path ? "Trocar thumbnail" : "Enviar thumbnail"}
                onUploaded={async (f) => {
                  const res = await updateVideoMetaAction(video.id, { thumbnail_path: f.path });
                  if (!res.ok) throw new Error(res.error);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum vídeo vinculado. Escolha uma origem:</p>
      )}

      <Tabs defaultValue="upload">
        <TabsList className="w-full">
          <TabsTrigger value="upload">
            <Upload /> Upload
          </TabsTrigger>
          <TabsTrigger value="youtube">
            <MonitorPlay /> YouTube
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link2 /> URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="pt-2">
          <FileUploader
            profile="video"
            buttonLabel={video ? "Substituir por um arquivo de vídeo" : undefined}
            onUploaded={async (f) => {
              const res = await setLessonVideoAction(lessonId, {
                provider: "supabase",
                storage_path: f.path,
                title: f.fileName,
                size_bytes: f.size,
                mime_type: f.mime,
                duration_seconds: f.durationSeconds ?? null,
              });
              if (!res.ok) throw new Error(res.error);
              toast.success(res.message);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">{maxUploadLabel}. Para vídeos maiores use YouTube (não listado) — veja docs/STORAGE.md.</p>
        </TabsContent>
        <TabsContent value="youtube" className="space-y-2 pt-2">
          <Input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          <Button
            size="sm"
            disabled={pending || !yt}
            onClick={() => run(() => setLessonVideoAction(lessonId, { provider: "youtube", external_url: yt, duration_seconds: parseDuration(duration) }))}
          >
            Vincular vídeo do YouTube
          </Button>
          <p className="text-xs text-muted-foreground">Recomendado: vídeo “Não listado”. O progresso é medido pela API do player.</p>
        </TabsContent>
        <TabsContent value="url" className="space-y-2 pt-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/video.mp4" />
          <Button
            size="sm"
            disabled={pending || !url}
            onClick={() => run(() => setLessonVideoAction(lessonId, { provider: "external", external_url: url, duration_seconds: parseDuration(duration) }))}
          >
            Vincular URL
          </Button>
          <p className="text-xs text-muted-foreground">Link direto para um arquivo .mp4/.webm (https).</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
