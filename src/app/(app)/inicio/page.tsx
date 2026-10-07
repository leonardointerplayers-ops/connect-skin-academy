import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  BookCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Flame,
  Megaphone,
  PartyPopper,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/shared/progress";
import { SectionTitle } from "@/components/shared/page";
import { requireUser } from "@/lib/auth/dal";
import {
  getAnnouncements,
  getContinueLesson,
  getCourseOutline,
  getMyBadges,
  getMyCourses,
  getMyStats,
  getPendingExams,
} from "@/services/learning";
import { firstName, formatDate, formatDuration, formatRelative } from "@/lib/format";
import { publicStorageUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const profile = await requireUser();
  const [courses, continueLesson, pendingExams, badges, announcements, stats] = await Promise.all([
    getMyCourses(),
    getContinueLesson(),
    getPendingExams(),
    getMyBadges(),
    getAnnouncements(6),
    getMyStats(),
  ]);
  const mainCourse = courses.find((c) => c.progress?.status !== "completed") ?? courses[0];
  const outline = mainCourse ? await getCourseOutline(mainCourse.id) : [];
  const overall = Number(stats?.overall_percent ?? 0);
  const earned = badges.filter((b) => b.awarded_at).sort((a, b) => (b.awarded_at ?? "").localeCompare(a.awarded_at ?? ""));
  const banners = announcements.filter((a) => a.show_banner).slice(0, 2);
  const allDone = courses.length > 0 && courses.every((c) => c.progress?.status === "completed");
  const dueSoon = courses.find((c) => c.due_date && c.progress?.status !== "completed");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Olá, {firstName(profile.full_name)} 👋</h1>
        <p className="text-muted-foreground">
          {allDone ? "Você concluiu todas as trilhas disponíveis. Parabéns!" : "Que bom te ver por aqui. Vamos continuar evoluindo?"}
        </p>
      </header>

      {(banners.length > 0 || dueSoon) && (
        <div className="space-y-2">
          {banners.map((b) => (
            <Link
              key={b.id}
              href={b.link_url ?? "/comunicados"}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm hover:bg-muted/50",
                b.priority === "high" ? "border-brand-accent/40 bg-brand-accent/5" : "bg-card",
              )}
            >
              <Megaphone className={cn("size-4 shrink-0", b.priority === "high" ? "text-brand-accent" : "text-primary")} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{b.title}</span>
                <span className="hidden text-muted-foreground sm:inline"> — {b.body.slice(0, 110)}{b.body.length > 110 ? "…" : ""}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
          {dueSoon?.due_date && (
            <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <CalendarClock className="size-4 shrink-0" />
              <span>
                Prazo para concluir <strong>{dueSoon.title}</strong>: {formatDate(dueSoon.due_date)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
            {continueLesson ? (
              <>
                <div className="min-w-0 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-brand-accent">
                    <Sparkles className="size-3.5" /> {continueLesson.resumed ? "Continue de onde parou" : "Próxima aula"}
                  </p>
                  <h2 className="text-xl font-semibold leading-snug">{continueLesson.title}</h2>
                  {continueLesson.module && (
                    <p className="text-sm text-muted-foreground">
                      Módulo {String(continueLesson.module.position).padStart(2, "0")} · {continueLesson.module.title}
                    </p>
                  )}
                  {continueLesson.percent > 0 && (
                    <div className="flex max-w-xs items-center gap-2 pt-1">
                      <ProgressBar value={continueLesson.percent} size="sm" />
                      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(continueLesson.percent)}% do vídeo</span>
                    </div>
                  )}
                </div>
                <Button size="lg" className="shrink-0" asChild>
                  <Link href={`/aulas/${continueLesson.lessonId}`}>
                    <PlayCircle /> {continueLesson.resumed ? "Continuar" : "Começar"}
                  </Link>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <PartyPopper className="size-8 text-brand-accent" />
                <div>
                  <p className="font-semibold">{courses.length ? "Parabéns! Você concluiu tudo." : "Você ainda não possui nenhum curso."}</p>
                  <p className="text-sm text-muted-foreground">
                    {courses.length ? "Novos conteúdos aparecerão aqui." : "Assim que uma trilha for liberada, ela aparecerá aqui."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Minha evolução</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-5">
            <ProgressRing value={overall} size={104}>
              <span className="text-2xl font-semibold tabular-nums">{Math.round(overall)}%</span>
              <span className="text-[10px] text-muted-foreground">geral</span>
            </ProgressRing>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <BookCheck className="size-4 text-muted-foreground" /> {stats?.lessons_completed ?? 0} aulas
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> {formatDuration(stats?.time_studied_seconds)}
              </li>
              <li className="flex items-center gap-2">
                <Flame className="size-4 text-brand-accent" /> {profile.current_streak} dia(s) seguidos
              </li>
              <li className="flex items-center gap-2">
                <Award className="size-4 text-muted-foreground" /> {profile.total_points} pontos
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {mainCourse && outline.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link href={`/trilhas/${mainCourse.id}`} className="text-sm font-medium text-primary hover:underline">
                Ver trilha
              </Link>
            }
          >
            Minha trilha · {mainCourse.title}
          </SectionTitle>
          <Card className="py-2">
            <CardContent className="px-2">
              <ul className="divide-y">
                {outline.map((m, i) => (
                  <li key={m.id}>
                    <Link
                      href={m.state === "unlocked" ? `/modulos/${m.id}` : `/trilhas/${mainCourse.id}`}
                      className="flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-muted/50"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                          m.status === "completed" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {m.status === "completed" ? "✓" : String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{m.title}</p>
                          <span className="text-sm font-semibold tabular-nums">{Math.round(m.percent)}%</span>
                        </div>
                        <ProgressBar value={m.percent} size="sm" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximas atividades</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma prova pendente.</p>
            ) : (
              <ul className="space-y-2">
                {pendingExams.slice(0, 4).map((e) => (
                  <li key={e.examId}>
                    <Link href={`/provas/${e.examId}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                      <ClipboardCheck className="size-5 shrink-0 text-brand-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.examTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.ready ? "Pronta para fazer" : "Conclua as aulas antes"} · tentativa {e.attemptsUsed + 1}
                          {e.maxAttempts ? ` de ${e.maxAttempts}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Conquistas</CardTitle>
            <Link href="/conquistas" className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {earned.length === 0 ? (
              <p className="text-sm text-muted-foreground">Conclua aulas e módulos para desbloquear conquistas.</p>
            ) : (
              <ul className="space-y-2">
                {earned.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-lg">{b.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(b.awarded_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Comunicados</CardTitle>
            <Link href="/comunicados" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum comunicado no momento.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex gap-3">
                    {a.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicStorageUrl("course-covers", a.image_path) ?? ""} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                        <Megaphone className="size-4 text-primary" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link href="/comunicados" className="line-clamp-1 text-sm font-medium hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatRelative(a.publish_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
