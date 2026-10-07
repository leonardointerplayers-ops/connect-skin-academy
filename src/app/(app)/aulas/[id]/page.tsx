import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Circle, Clock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/learning/video-player";
import { LessonTelemetry } from "@/components/learning/lesson-telemetry";
import { ActivityForm, CompleteLessonButton, MaterialsList } from "@/components/learning/lesson-actions";
import { getLessonForLearner } from "@/services/learning";
import { getPlayback } from "@/lib/video/provider";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Aula" };

export default async function LessonPage({ params }: PageProps<"/aulas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getLessonForLearner(id);
  if (!data) redirect("/trilhas?bloqueado=1");
  const { lesson, materials, siblings, progress, exam } = data;
  const video = lesson.video && !(lesson.video as { deleted_at?: string | null }).deleted_at ? lesson.video : null;
  const playback = await getPlayback(video);

  const completed = progress?.status === "completed";
  const index = siblings.findIndex((s) => s.id === lesson.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const videoPending = Boolean(video && lesson.video_required && !progress?.video_completed_at);
  const activityPending = lesson.activity_enabled && !progress?.activity_completed_at;
  const blockedReason = videoPending
    ? `Assista pelo menos ${lesson.min_video_percent}% do vídeo para concluir.`
    : activityPending
      ? "Conclua a atividade abaixo para finalizar a aula."
      : undefined;

  return (
    <>
      <LessonTelemetry lessonId={lesson.id} />
      <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/modulos/${lesson.module.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Módulo {String(lesson.module.position).padStart(2, "0")} · {lesson.module.title}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          {playback ? (
            <VideoPlayer
              lessonId={lesson.id}
              source={playback}
              initialPosition={Number(progress?.video_position_seconds ?? 0)}
              initialPercent={Number(progress?.video_percent ?? 0)}
              minPercent={lesson.min_video_percent}
              alreadyCompleted={Boolean(progress?.video_completed_at)}
            />
          ) : video ? (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
              Vídeo indisponível no momento. Avise o administrador.
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {!lesson.is_required && <Badge variant="outline">Opcional</Badge>}
              {lesson.estimated_minutes && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> {lesson.estimated_minutes} min
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{lesson.title}</h1>
            {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
          </div>

          {lesson.content_html && (
            <article className="lesson-content max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content_html }} />
          )}

          {materials.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Materiais da aula</h2>
              <MaterialsList materials={materials} />
            </section>
          )}

          {lesson.activity_enabled && (
            <ActivityForm
              lessonId={lesson.id}
              title={lesson.activity_title}
              instructions={lesson.activity_instructions}
              requiresResponse={lesson.activity_requires_response}
              done={Boolean(progress?.activity_completed_at)}
              previousResponse={progress?.activity_response ?? null}
            />
          )}

          <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-start sm:justify-between">
            <CompleteLessonButton lessonId={lesson.id} completed={completed} blockedReason={blockedReason} />
            <div className="flex gap-2">
              {prev && (
                <Button variant="outline" asChild>
                  <Link href={`/aulas/${prev.id}`}>
                    <ChevronLeft /> Anterior
                  </Link>
                </Button>
              )}
              {next ? (
                <Button variant={completed ? "default" : "outline"} asChild>
                  <Link href={`/aulas/${next.id}`}>
                    Próxima aula <ChevronRight />
                  </Link>
                </Button>
              ) : exam ? (
                <Button variant={completed ? "default" : "outline"} asChild>
                  <Link href={`/provas/${exam.id}`}>
                    <ClipboardCheck /> Ir para a prova
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="text-sm">Aulas do módulo</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              <ol className="space-y-0.5">
                {siblings.map((s, i) => (
                  <li key={s.id}>
                    <Link
                      href={`/aulas/${s.id}`}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted",
                        s.id === lesson.id && "bg-secondary font-medium text-secondary-foreground",
                      )}
                    >
                      {s.completed ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : s.id === lesson.id ? (
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className="min-w-0">
                        <span className="text-xs text-muted-foreground">{i + 1}. </span>
                        {s.title}
                      </span>
                    </Link>
                  </li>
                ))}
                {exam && (
                  <li>
                    <Link href={`/provas/${exam.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                      <ClipboardCheck className="size-4 text-brand-accent" /> {exam.title}
                    </Link>
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
