import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCheck, Clock, Flame, GraduationCap, Layers, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/shared/page";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar, ProgressRing } from "@/components/shared/progress";
import { Timeline } from "@/components/shared/timeline";
import { AvatarEditor } from "@/components/shared/avatar-editor";
import { HealthBadge } from "@/components/admin/health-badge";
import { CollaboratorForm } from "@/components/admin/collaborator-form";
import { CollaboratorActions } from "@/components/admin/collaborator-actions";
import { getCollaborator, getUserModuleProgress, getUserTimeline, listGroups, listManagers } from "@/services/users";
import { updateCollaboratorAction } from "@/actions/users";
import { requireStaff } from "@/lib/auth/dal";
import { computeHealthScore, HEALTH_WEIGHTS } from "@/lib/analytics/health";
import { formatDate, formatDuration, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { publicStorageUrl } from "@/lib/env";
import { ROLE_LABELS } from "@/config/app";

export const metadata: Metadata = { title: "Colaborador" };

export default async function CollaboratorPage({ params }: PageProps<"/admin/colaboradores/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireStaff();
  const [data, modules, timeline, groups, managers] = await Promise.all([
    getCollaborator(id),
    getUserModuleProgress(id),
    getUserTimeline(id),
    listGroups(),
    listManagers(),
  ]);
  if (!data) notFound();
  const { profile, summary } = data;
  const health = summary ? computeHealthScore(summary) : undefined;
  const isAdmin = viewer.role_id === "admin";

  return (
    <>
      <PageHeader back={{ href: "/admin/colaboradores", label: "Colaboradores" }} title="Relatório individual" />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar name={profile.full_name} avatarPath={profile.avatar_path} className="size-16 text-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{profile.full_name}</h2>
              <StatusBadge status={profile.status} />
              {profile.role_id !== "collaborator" && <Badge variant="secondary">{ROLE_LABELS[profile.role_id]}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {[profile.job_title, profile.department, profile.area].filter(Boolean).join(" · ") || "Cargo não informado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.email} · Entrada {formatDate(profile.joined_at)} · Último acesso {formatRelative(summary?.last_activity_at)}
              {profile.manager_id && ` · Gestor: ${managers.find((m) => m.id === profile.manager_id)?.full_name ?? "—"}`}
            </p>
            {data.groups.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {data.groups.map((g) => (
                  <Badge key={g.id} variant="outline">
                    {g.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {isAdmin && <CollaboratorActions userId={profile.id} status={profile.status} isSelf={profile.id === viewer.id} />}
        </CardContent>
      </Card>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Desempenho</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          {isAdmin && <TabsTrigger value="edit">Cadastro</TabsTrigger>}
        </TabsList>

        <TabsContent value="report" className="mt-4 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="gap-0 py-0 sm:row-span-2">
              <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-5">
                <ProgressRing value={Number(summary?.overall_percent ?? 0)} size={120}>
                  <span className="text-2xl font-semibold tabular-nums">{formatPercent(summary?.overall_percent)}</span>
                  <span className="text-[11px] text-muted-foreground">da trilha</span>
                </ProgressRing>
                {profile.role_id === "collaborator" && <HealthBadge health={health} />}
              </CardContent>
            </Card>
            <StatCard label="Tempo estudado" value={formatDuration(summary?.time_studied_seconds)} icon={Clock} hint={`${summary?.active_days_30 ?? 0} dias ativos (30d)`} />
            <StatCard label="Aulas concluídas" value={formatNumber(summary?.lessons_completed ?? 0)} icon={BookCheck} />
            <StatCard label="Módulos concluídos" value={formatNumber(summary?.modules_completed ?? 0)} icon={Layers} />
            <StatCard label="Nota média" value={formatPercent(summary?.avg_best_score)} icon={Star} hint={`${summary?.exams_taken ?? 0} prova(s) realizadas`} />
            <StatCard
              label="Tentativas"
              value={formatNumber(summary?.exam_attempts ?? 0)}
              icon={GraduationCap}
              hint={summary?.avg_attempts_per_exam ? `${summary.avg_attempts_per_exam} por prova` : undefined}
            />
            <StatCard label="Sequência" value={`${profile.current_streak} dia(s)`} icon={Flame} hint={`Recorde: ${profile.longest_streak} · ${profile.total_points} pts`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Progresso por módulo</CardTitle>
              <CardDescription>Aulas, prova e histórico de tentativas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {modules.map((m) => (
                <div key={m.module_id} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/admin/relatorios/modulos/${m.module_id}`} className="text-sm font-medium hover:underline">
                      Módulo {String(m.position).padStart(2, "0")} — {m.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {m.lessons_completed}/{m.lessons_total || "—"} aulas · {formatPercent(m.percent)}
                    </span>
                  </div>
                  <ProgressBar value={m.percent} />
                  {m.attempts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.attempts.map((a) => (
                        <Badge
                          key={a.id}
                          variant="outline"
                          className={a.passed ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}
                        >
                          Tentativa {a.attempt_number} — {formatPercent(a.score_percent)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!modules.length && <p className="text-sm text-muted-foreground">Nenhum módulo publicado.</p>}
            </CardContent>
          </Card>

          {health && profile.role_id === "collaborator" && (
            <Card>
              <CardHeader>
                <CardTitle>Composição do Learning Health Score</CardTitle>
                <CardDescription>Indicador de engajamento educacional — não é avaliação profissional.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-5">
                {(
                  [
                    ["progress", "Progresso"],
                    ["recency", "Recência"],
                    ["pace", "Ritmo/prazos"],
                    ["grades", "Notas"],
                    ["attempts", "Tentativas"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {label} · peso {Math.round(HEALTH_WEIGHTS[key] * 100)}%
                    </p>
                    <ProgressBar value={health.factors[key]} size="sm" />
                    <p className="text-sm font-medium tabular-nums">{Math.round(health.factors[key])}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent>
              <Timeline events={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="edit" className="mt-4">
            <Card className="max-w-3xl">
              <CardHeader>
                <CardTitle>Cadastro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <AvatarEditor userId={profile.id} name={profile.full_name} avatarUrl={publicStorageUrl("avatars", profile.avatar_path)} />
                <CollaboratorForm
                  action={updateCollaboratorAction.bind(null, profile.id)}
                  profile={profile}
                  groups={groups}
                  selectedGroups={data.groups.map((g) => g.id)}
                  managers={managers}
                  mode="edit"
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
