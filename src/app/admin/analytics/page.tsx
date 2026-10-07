import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarDays, Clock, LogOut, RotateCcw, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatCard } from "@/components/shared/page";
import { ActivityChart, ColumnChart, HorizontalPercentBars } from "@/components/charts/charts";
import { InsightList } from "@/components/admin/insight-list";
import { TeamViewTabs } from "@/components/admin/team-view";
import { HealthBadge } from "@/components/admin/health-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { bucketize, getCompetencyMatrix, getDashboardData } from "@/services/analytics";
import { learners } from "@/lib/analytics/insights";
import { formatDuration, formatPercent, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const n = (v: unknown) => Number(v ?? 0);

export default async function AnalyticsPage() {
  const [data, matrix] = await Promise.all([getDashboardData(), getCompetencyMatrix()]);
  const { ctx, teamView } = data;
  const team = learners(ctx.users);
  const total = team.length || 1;

  const active7 = team.filter((u) => u.days_since_activity !== null && u.days_since_activity <= 7).length;
  const avgActiveDays = team.reduce((s, u) => s + n(u.active_days_30), 0) / total;
  const started = ctx.lessons.reduce((s, l) => s + n(l.unique_viewers), 0);
  const abandoned = ctx.lessons.reduce((s, l) => s + n(l.abandoned), 0);
  const attempted = ctx.modules.reduce((s, m) => s + n(m.users_attempted), 0);
  const passed = ctx.modules.reduce((s, m) => s + n(m.users_passed), 0);
  const totalAttempts = ctx.modules.reduce((s, m) => s + n(m.total_attempts), 0);

  const progressDist = bucketize(team.map((u) => n(u.overall_percent)), [
    { name: "0%", min: 0, max: 0 },
    { name: "1–25%", min: 0.01, max: 25 },
    { name: "26–50%", min: 25.01, max: 50 },
    { name: "51–75%", min: 50.01, max: 75 },
    { name: "76–99%", min: 75.01, max: 99.99 },
    { name: "100%", min: 100, max: 100 },
  ]);
  const scoreDist = bucketize(
    team.filter((u) => u.avg_best_score !== null).map((u) => n(u.avg_best_score)),
    [
      { name: "< 50%", min: 0, max: 49.99 },
      { name: "50–69%", min: 50, max: 69.99 },
      { name: "70–89%", min: 70, max: 89.99 },
      { name: "≥ 90%", min: 90, max: 100 },
    ],
  );
  const hardestQuestions = [...ctx.questions]
    .filter((q) => n(q.total_answers) > 0)
    .sort((a, b) => n(a.pct_correct) - n(b.pct_correct))
    .slice(0, 8);
  const lessonsByViews = [...ctx.lessons].sort((a, b) => n(b.total_views) - n(a.total_views));
  const healthSorted = team
    .map((u) => ({ u, h: teamView.health.get(u.user_id)! }))
    .sort((a, b) => a.h.score - b.h.score);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Inteligência sobre engajamento, aprendizado, conclusão e dificuldades da equipe — calculada a partir dos dados reais da plataforma."
      />

      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Ativos (7 dias)" value={`${active7}/${team.length}`} icon={Activity} />
          <StatCard label="Frequência" value={`${avgActiveDays.toFixed(1).replace(".", ",")} d`} icon={CalendarDays} hint="Dias ativos em 30 (média)" />
          <StatCard label="Tempo médio" value={formatDuration(data.kpis.avgStudySeconds)} icon={Clock} hint="Estudo por colaborador" />
          <StatCard label="Aprovação" value={attempted ? formatPercent((passed / attempted) * 100) : "—"} icon={Target} hint="Pessoas aprovadas / que tentaram" />
          <StatCard label="Tentativas" value={attempted ? (totalAttempts / attempted).toFixed(2).replace(".", ",") : "—"} icon={RotateCcw} hint="Média por pessoa/prova" />
          <StatCard label="Abandono" value={started ? formatPercent((abandoned / started) * 100) : "—"} icon={LogOut} tone={started && abandoned / started > 0.25 ? "warning" : "default"} hint="Aulas iniciadas e paradas há +7d" />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Insights automáticos</CardTitle>
              <CardDescription>Regras aplicadas aos dados atuais.</CardDescription>
            </CardHeader>
            <CardContent>
              <InsightList items={data.insights} empty="Sem dados suficientes ainda." />
            </CardContent>
          </Card>
          <Card id="equipe">
            <CardHeader>
              <CardTitle>Visão da equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamViewTabs view={teamView} inactivityDays={ctx.inactivityDays} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Engajamento diário</CardTitle>
              <CardDescription>Colaboradores com atividade de estudo por dia (30 dias).</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityChart data={data.activity} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de progresso</CardTitle>
              <CardDescription>Colaboradores por faixa de conclusão.</CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnChart data={progressDist} label="Colaboradores" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de notas</CardTitle>
              <CardDescription>Nota média (melhor tentativa por prova).</CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnChart data={scoreDist} label="Colaboradores" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aprovação por módulo</CardTitle>
              <CardDescription>% aprovados entre quem fez a prova.</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalPercentBars
                label="Aprovação"
                data={ctx.modules
                  .filter((m) => m.exam_id)
                  .map((m) => ({
                    name: `M${String(m.position).padStart(2, "0")} ${m.title}`.slice(0, 24),
                    value: n(m.approval_rate),
                    detail: `${n(m.users_passed)} de ${n(m.users_attempted)} aprovados`,
                  }))}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle>Questões com maior erro</CardTitle>
                <CardDescription>Conteúdos que precisam de reforço.</CardDescription>
              </div>
              <Link href="/admin/relatorios/questoes" className="text-sm font-medium text-primary hover:underline">
                Ver todas
              </Link>
            </CardHeader>
            <CardContent>
              {hardestQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma prova realizada ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {hardestQuestions.map((q) => (
                    <li key={`${q.question_id}-${q.exam_id}`} className="space-y-1">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <Link href={`/admin/avaliacoes/questoes/${q.question_id}`} className="line-clamp-2 hover:underline">
                          <span className="font-mono text-xs text-muted-foreground">Q-{String(q.number).padStart(3, "0")} </span>
                          {q.statement}
                        </Link>
                        <span className={cn("shrink-0 font-semibold tabular-nums", n(q.pct_correct) < 60 ? "text-destructive" : "")}>{formatPercent(q.pct_correct)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {q.total_answers} respostas · {q.correct} acertos · {q.wrong} erros
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aulas: acesso e abandono</CardTitle>
              <CardDescription>Mais e menos acessadas.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aula</TableHead>
                    <TableHead className="text-right">Acessos</TableHead>
                    <TableHead className="text-right">Concluíram</TableHead>
                    <TableHead className="text-right">Abandono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...lessonsByViews.slice(0, 5), ...lessonsByViews.slice(-3).filter((l) => !lessonsByViews.slice(0, 5).includes(l))].map((l) => (
                    <TableRow key={l.lesson_id}>
                      <TableCell className="max-w-56 truncate">{l.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.total_views)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.completions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.unique_viewers) ? formatPercent((n(l.abandoned) / n(l.unique_viewers)) * 100) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Learning Health Score</CardTitle>
            <CardDescription>
              Indicador de engajamento educacional (progresso 35% · recência 25% · ritmo 10% · notas 20% · tentativas 10%). Não é avaliação
              profissional.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Engajamento</TableHead>
                  <TableHead className="text-right">Progresso</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Nota média</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Tentativas/prova</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthSorted.map(({ u, h }) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <Link href={`/admin/colaboradores/${u.user_id}`} className="flex items-center gap-2">
                        <UserAvatar name={u.full_name} avatarPath={u.avatar_path} className="size-7" />
                        <span className="font-medium hover:underline">{u.full_name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <HealthBadge health={h} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(u.overall_percent)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPercent(u.avg_best_score)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{u.avg_attempts_per_exam ?? "—"}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{formatRelative(u.last_activity_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {matrix.competencies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Matriz de competências</CardTitle>
              <CardDescription>Colaborador × competência: média do progresso nos módulos que desenvolvem cada competência.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-muted-foreground">Colaborador</th>
                    {matrix.competencies.map((c) => (
                      <th key={c.id} className="px-1 text-center font-medium text-muted-foreground">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 font-semibold">Média da equipe</td>
                    {matrix.teamAvg.map((v, i) => (
                      <td key={i} className="rounded bg-secondary py-1.5 text-center font-semibold tabular-nums">
                        {Math.round(v)}%
                      </td>
                    ))}
                  </tr>
                  {matrix.rows.map((r) => (
                    <tr key={r.user.user_id}>
                      <td className="max-w-40 truncate py-1">{r.user.full_name}</td>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          className="rounded py-1.5 text-center tabular-nums"
                          style={{ backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(v * 0.55)}%, var(--muted))`, color: v > 60 ? "var(--primary-foreground)" : undefined }}
                          title={`${r.user.full_name} · ${matrix.competencies[i].name}: ${Math.round(v)}%`}
                        >
                          {Math.round(v)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
