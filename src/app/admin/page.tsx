import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Target,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/page";
import { ActivityChart, HorizontalPercentBars } from "@/components/charts/charts";
import { InsightList } from "@/components/admin/insight-list";
import { TeamViewTabs } from "@/components/admin/team-view";
import { getDashboardData } from "@/services/analytics";
import { getCurrentProfile } from "@/lib/auth/dal";
import { firstName, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { HEALTH_LABELS } from "@/lib/analytics/health";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const [profile, data] = await Promise.all([getCurrentProfile(), getDashboardData()]);
  const { kpis } = data;
  const isAdmin = profile?.role_id === "admin";

  return (
    <>
      <PageHeader
        eyebrow="Desenvolvimento da equipe"
        title={`Olá, ${firstName(profile?.full_name)} 👋`}
        description="Visão consolidada de engajamento, aprendizado e conclusão da equipe."
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/admin/colaboradores/novo">
                <UserPlus /> Convidar colaborador
              </Link>
            </Button>
          )
        }
      />

      {kpis.collaborators === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum colaborador cadastrado"
          description="Convide a equipe para começar a acompanhar acessos, progresso e resultados."
          action={
            isAdmin && (
              <Button asChild>
                <Link href="/admin/colaboradores/novo">
                  <UserPlus /> Convidar colaborador
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Colaboradores" value={formatNumber(kpis.collaborators)} icon={Users} hint={`${kpis.invited} aguardando 1º acesso`} />
            <StatCard label="Ativos" value={formatNumber(kpis.active)} icon={UserCheck} tone="success" />
            <StatCard label="Conclusão média" value={formatPercent(kpis.avgCompletion)} icon={Target} />
            <StatCard label="Nota média" value={formatPercent(kpis.avgScore)} icon={GraduationCap} hint="Melhor nota por prova" />
            <StatCard label="Provas realizadas" value={formatNumber(kpis.examsTaken)} icon={ClipboardCheck} />
          </section>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Taxa de acesso" value={formatPercent(kpis.accessRate)} icon={Activity} hint="Acessaram nos últimos 30 dias" />
            <StatCard
              label="Atrasados"
              value={formatNumber(kpis.overdue)}
              icon={AlarmClock}
              tone={kpis.overdue ? "warning" : "default"}
              hint="Com prazo vencido"
            />
            <StatCard label="Tempo médio de estudo" value={formatDuration(kpis.avgStudySeconds)} icon={Clock} hint="Por colaborador" />
            <Card className="gap-0 py-0">
              <CardContent className="space-y-2 p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Learning Health</p>
                {(["excellent", "attention", "low"] as const).map((level) => (
                  <div key={level} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2.5 rounded-full",
                          level === "excellent" ? "bg-success" : level === "attention" ? "bg-warning" : "bg-destructive",
                        )}
                      />
                      {HEALTH_LABELS[level].label}
                    </span>
                    <span className="font-semibold tabular-nums">{data.healthCounts[level]}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Insights automáticos</CardTitle>
                <CardDescription>Gerados por regras a partir dos dados reais da plataforma.</CardDescription>
              </CardHeader>
              <CardContent>
                <InsightList items={data.insights.slice(0, 8)} empty="Ainda não há dados suficientes para gerar insights." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alertas</CardTitle>
                <CardDescription>Colaboradores que precisam de atenção agora.</CardDescription>
              </CardHeader>
              <CardContent>
                <InsightList items={data.alerts} empty="Nenhum alerta. Equipe em dia! ✓" />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Engajamento — últimos 30 dias</CardTitle>
                <CardDescription>Colaboradores com atividade de estudo por dia.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityChart data={data.activity} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Conclusão por módulo</CardTitle>
                <CardDescription>% dos matriculados que concluíram.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.modules.length ? (
                  <HorizontalPercentBars
                    label="Concluíram"
                    data={data.modules.map((m) => ({
                      name: `M${String(m.position).padStart(2, "0")} ${m.title}`.slice(0, 26),
                      value: Number(m.enrolled) ? (Number(m.completed) / Number(m.enrolled)) * 100 : 0,
                      detail: `${m.completed} de ${m.enrolled} concluíram`,
                    }))}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum módulo publicado.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" id="equipe">
              <CardHeader>
                <CardTitle>Visão da equipe</CardTitle>
                <CardDescription>Quem precisa de atenção e quem está se destacando.</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamViewTabs view={data.teamView} inactivityDays={data.ctx.inactivityDays} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Módulos com maior dificuldade</CardTitle>
                <CardDescription>Menor taxa de aprovação nas provas.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.hardestModules.length ? (
                  <ul className="space-y-3">
                    {data.hardestModules.map((m) => (
                      <li key={m.module_id}>
                        <Link href={`/admin/relatorios/modulos/${m.module_id}`} className="-mx-2 block rounded-md px-2 py-2 hover:bg-muted/60">
                          <p className="text-sm font-medium">{m.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Aprovação {formatPercent(m.approval_rate)} · nota média {formatPercent(m.avg_best_score)} ·{" "}
                            {m.avg_attempts ?? "—"} tentativas/pessoa
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma prova realizada ainda.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
