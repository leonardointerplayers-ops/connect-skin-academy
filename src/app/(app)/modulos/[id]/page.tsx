import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle, ClipboardCheck, Clock, FileText, Lock, PenLine, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoverImage } from "@/components/shared/cover-image";
import { ProgressBar } from "@/components/shared/progress";
import { EmptyState } from "@/components/shared/page";
import { getModuleForLearner } from "@/services/learning";
import { lockLabel } from "@/components/learning/module-card";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Módulo" };

export default async function ModulePage({ params }: PageProps<"/modulos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getModuleForLearner(id);
  if (!data) notFound();
  const { module: mod, state, lessons, exam, attempts, progress, competencies } = data;
  const locked = state.state !== "unlocked";
  const percent = Number(progress?.percent ?? 0);
  const firstPending = lessons.find((l) => l.progress?.status !== "completed");
  const submitted = attempts.filter((a) => a.status !== "in_progress");
  const passed = submitted.some((a) => a.passed);
  const attemptsLeft = exam?.max_attempts ? exam.max_attempts - submitted.length : null;
  const requiredDone = lessons.filter((l) => l.is_required).every((l) => l.progress?.status === "completed");

  return (
    <>
      <Link href={`/trilhas/${mod.course.id}`} className="mb-4 inline-flex text-sm text-muted-foreground hover:text-foreground">
        ← {mod.course.title}
      </Link>
      <div className="relative mb-6 overflow-hidden rounded-2xl">
        <CoverImage bucket="module-covers" path={mod.featured_image_path ?? mod.cover_path} alt={mod.title} className="aspect-[16/7] sm:aspect-[16/5]" label={String(mod.position).padStart(2, "0")} priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white sm:p-7">
          <p className="text-xs font-medium uppercase tracking-wider text-white/75">Módulo {String(mod.position).padStart(2, "0")}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{mod.title}</h1>
          {!locked && (
            <div className="flex max-w-md items-center gap-3">
              <ProgressBar value={percent} className="bg-white/25" />
              <span className="text-sm font-semibold tabular-nums">{formatPercent(percent)}</span>
            </div>
          )}
        </div>
      </div>

      {locked ? (
        <EmptyState icon={Lock} title="Módulo bloqueado" description={lockLabel(state)} action={<Button asChild variant="outline"><Link href={`/trilhas/${mod.course.id}`}>Voltar para a trilha</Link></Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {mod.description && <p className="text-muted-foreground">{mod.description}</p>}
            {firstPending && (
              <Button size="lg" asChild>
                <Link href={`/aulas/${firstPending.id}`}>
                  <PlayCircle /> {percent > 0 ? "Continuar" : "Começar"}: {firstPending.title}
                </Link>
              </Button>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Aulas</CardTitle>
                <CardDescription>
                  {progress?.lessons_completed ?? 0} de {lessons.length} concluídas
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3">
                {lessons.length === 0 ? (
                  <p className="px-3 text-sm text-muted-foreground">As aulas deste módulo serão publicadas em breve.</p>
                ) : (
                  <ol className="divide-y">
                    {lessons.map((l, i) => {
                      const done = l.progress?.status === "completed";
                      return (
                        <li key={l.id}>
                          <Link href={`/aulas/${l.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/60">
                            {done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-muted-foreground/40" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                <span className="text-muted-foreground">{i + 1}. </span>
                                {l.title}
                              </p>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                {l.video_id && (
                                  <span className="inline-flex items-center gap-1">
                                    <PlayCircle className="size-3.5" /> vídeo
                                    {l.progress && !done && Number(l.progress.video_percent) > 0 && ` · ${Math.round(Number(l.progress.video_percent))}%`}
                                  </span>
                                )}
                                {l.materials > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="size-3.5" /> {l.materials} material(is)
                                  </span>
                                )}
                                {l.activity_enabled && (
                                  <span className="inline-flex items-center gap-1">
                                    <PenLine className="size-3.5" /> atividade
                                  </span>
                                )}
                                {l.estimated_minutes && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3.5" /> {l.estimated_minutes} min
                                  </span>
                                )}
                              </div>
                            </div>
                            {!l.is_required && <Badge variant="outline">Opcional</Badge>}
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {exam && (
              <Card className={passed ? "border-success/40" : undefined}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-5 text-brand-accent" />
                    <CardTitle className="text-base">{exam.title}</CardTitle>
                  </div>
                  <CardDescription>
                    Nota mínima {exam.passing_score}%{exam.is_required ? " · obrigatória" : " · opcional"}
                    {exam.time_limit_minutes ? ` · ${exam.time_limit_minutes} min` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {passed ? (
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                      <CheckCircle2 className="size-4" /> Aprovado · melhor nota {formatPercent(Math.max(...submitted.map((a) => Number(a.score_percent ?? 0))))}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {submitted.length} tentativa(s) usada(s)
                      {exam.max_attempts ? ` de ${exam.max_attempts}` : ""}
                    </p>
                  )}
                  <Button className="w-full" variant={passed ? "outline" : "default"} asChild disabled={!passed && attemptsLeft === 0}>
                    <Link href={`/provas/${exam.id}`}>{passed ? "Ver resultados" : requiredDone ? "Fazer a prova" : "Ver prova"}</Link>
                  </Button>
                  {!passed && !requiredDone && <p className="text-xs text-muted-foreground">Recomendado concluir as aulas antes da prova.</p>}
                </CardContent>
              </Card>
            )}
            {competencies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competências desenvolvidas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {competencies.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {mod.due_date && (
              <Card className="py-4">
                <CardContent className="text-sm">
                  Prazo de conclusão: <strong>{formatDate(mod.due_date)}</strong>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
