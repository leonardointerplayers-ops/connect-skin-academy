import type { Metadata } from "next";
import { BookCheck, ClipboardCheck, Clock, GraduationCap, Layers, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/shared/page";
import { AvatarEditor } from "@/components/shared/avatar-editor";
import { ChangePasswordForm, OwnProfileForm } from "@/components/learning/profile-forms";
import { requireUser } from "@/lib/auth/dal";
import { getMyStats } from "@/services/learning";
import { publicStorageUrl } from "@/lib/env";
import { formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { ROLE_LABELS } from "@/config/app";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const profile = await requireUser();
  const stats = await getMyStats();

  const info: [string, string | null][] = [
    ["Cargo", profile.job_title],
    ["Área", profile.area],
    ["Departamento", profile.department],
    ["Empresa", profile.company],
    ["E-mail", profile.email],
    ["Entrada", formatDate(profile.joined_at)],
    ["Perfil de acesso", ROLE_LABELS[profile.role_id]],
  ];

  return (
    <>
      <PageHeader title="Meu perfil" />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <AvatarEditor userId={profile.id} name={profile.full_name} avatarUrl={publicStorageUrl("avatars", profile.avatar_path)} />
              <div>
                <h2 className="text-lg font-semibold">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground">{profile.job_title ?? "—"}</p>
              </div>
              <dl className="space-y-2 text-sm">
                {info.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate text-right font-medium">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">Cargo, área e departamento são mantidos pelo administrador.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <OwnProfileForm fullName={profile.full_name} phone={profile.phone} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Segurança</CardTitle>
              <CardDescription>Mínimo de 8 caracteres, com letras e números.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">Estatísticas</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <StatCard label="Cursos" value={`${stats?.courses_completed ?? 0}/${stats?.courses_enrolled ?? 0}`} icon={GraduationCap} hint="concluídos / matriculados" />
            <StatCard label="Módulos concluídos" value={formatNumber(stats?.modules_completed ?? 0)} icon={Layers} />
            <StatCard label="Aulas concluídas" value={formatNumber(stats?.lessons_completed ?? 0)} icon={BookCheck} />
            <StatCard label="Provas realizadas" value={formatNumber(stats?.exams_taken ?? 0)} icon={ClipboardCheck} hint={`${stats?.exam_attempts ?? 0} tentativa(s)`} />
            <StatCard label="Nota média" value={formatPercent(stats?.avg_best_score)} icon={Star} />
            <StatCard label="Tempo estudado" value={formatDuration(stats?.time_studied_seconds)} icon={Clock} />
          </div>
        </div>
      </div>
    </>
  );
}
