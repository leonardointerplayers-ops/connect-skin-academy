import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Target, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/shared/page";
import { ProgressBar } from "@/components/shared/progress";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getLessonStats, getModuleStats, getQuestionStats, getUserSummaries } from "@/services/analytics";
import { createClient } from "@/lib/supabase/server";
import { learners } from "@/lib/analytics/insights";
import { formatDuration, formatPercent, formatRelative } from "@/lib/format";
import { QuestionTable } from "@/components/admin/question-table";

export const metadata: Metadata = { title: "Relatório do módulo" };

const n = (v: unknown) => Number(v ?? 0);

export default async function ModuleReportPage({ params }: PageProps<"/admin/relatorios/modulos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const modules = await getModuleStats();
  const m = modules.find((x) => x.module_id === id);
  if (!m) notFound();

  const supabase = await createClient();
  const [lessons, questions, users, { data: progress }, { data: attempts }, { data: enrollments }] = await Promise.all([
    getLessonStats(),
    m.exam_id ? getQuestionStats(m.exam_id) : Promise.resolve([]),
    getUserSummaries(),
    supabase.from("module_progress").select("user_id, percent, status, best_score, exam_passed, lessons_completed, lessons_total").eq("module_id", id),
    m.exam_id
      ? supabase.from("exam_attempts").select("user_id, passed").eq("exam_id", m.exam_id).neq("status", "in_progress")
      : Promise.resolve({ data: [] as { user_id: string; passed: boolean }[] }),
    supabase.from("enrollments").select("user_id").eq("course_id", m.course_id).neq("status", "cancelled"),
  ]);

  const enrolled = new Set((enrollments ?? []).map((e) => e.user_id as string));
  const progMap = new Map((progress ?? []).map((p) => [p.user_id as string, p]));
  const attemptsByUser = new Map<string, { total: number; passed: boolean }>();
  for (const a of (attempts ?? []) as { user_id: string; passed: boolean }[]) {
    const e = attemptsByUser.get(a.user_id) ?? { total: 0, passed: false };
    e.total += 1;
    e.passed ||= Boolean(a.passed);
    attemptsByUser.set(a.user_id, e);
  }
  const people = learners(users)
    .filter((u) => enrolled.has(u.user_id))
    .map((u) => ({ u, p: progMap.get(u.user_id), a: attemptsByUser.get(u.user_id) }))
    .sort((x, y) => n(x.p?.percent) - n(y.p?.percent));
  const moduleLessons = lessons.filter((l) => l.module_id === id).sort((a, b) => a.position - b.position);
  const worstQuestion = [...questions].filter((q) => n(q.total_answers) > 0).sort((a, b) => n(a.pct_correct) - n(b.pct_correct))[0];
  const pending = n(m.enrolled) - n(m.completed);

  return (
    <>
      <PageHeader back={{ href: "/admin/relatorios", label: "Relatórios" }} eyebrow={m.course_title} title={m.label} />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Colaboradores" value={n(m.enrolled)} icon={Users} />
          <StatCard label="Concluíram" value={n(m.completed)} icon={CheckCircle2} tone="success" />
          <StatCard label="Pendentes" value={pending} icon={Clock} tone={pending ? "warning" : "default"} />
          <StatCard label="Nota média" value={formatPercent(m.avg_best_score)} icon={Target} hint="Melhor tentativa" />
          <StatCard label="Taxa de aprovação" value={formatPercent(m.approval_rate)} icon={Target} hint={m.avg_attempts ? `${m.avg_attempts} tentativas/pessoa` : undefined} />
        </section>

        {worstQuestion && (
          <Card className="border-destructive/30">
            <CardContent className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold">
                  Questão com maior erro: Q-{String(worstQuestion.number).padStart(3, "0")} — {formatPercent(worstQuestion.pct_correct)} de acerto
                </p>
                <p className="text-sm text-muted-foreground">{worstQuestion.statement}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {worstQuestion.total_answers} respostas · {worstQuestion.correct} acertos · {worstQuestion.wrong} erros. Considere reforçar este
                  conteúdo nas aulas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Colaboradores</CardTitle>
              <CardDescription>Do menor para o maior progresso.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-32">Progresso</TableHead>
                    <TableHead>Prova</TableHead>
                    <TableHead className="hidden sm:table-cell">Acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map(({ u, p, a }) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <Link href={`/admin/colaboradores/${u.user_id}`} className="flex items-center gap-2">
                          <UserAvatar name={u.full_name} avatarPath={u.avatar_path} className="size-7" />
                          <span className="max-w-40 truncate hover:underline">{u.full_name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={n(p?.percent)} size="sm" />
                          <span className="w-9 text-right text-xs tabular-nums">{Math.round(n(p?.percent))}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a ? (
                          <Badge variant="outline" className={a.passed ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}>
                            {a.passed ? `Aprovado · ${formatPercent(p?.best_score)}` : `Reprovado ${a.total}×`}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não fez</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatRelative(u.last_activity_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aulas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aula</TableHead>
                      <TableHead className="text-right">Acessos</TableHead>
                      <TableHead className="text-right">Concluíram</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Vídeo (média)</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Tempo médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moduleLessons.map((l) => (
                      <TableRow key={l.lesson_id}>
                        <TableCell className="max-w-48 truncate">{l.title}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(l.total_views)}</TableCell>
                        <TableCell className="text-right tabular-nums">{n(l.completions)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatPercent(l.avg_video_percent)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatDuration(l.avg_time_seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Questões da prova</CardTitle>
                  <CardDescription>Ordenadas pela menor taxa de acerto.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <QuestionTable questions={questions} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
