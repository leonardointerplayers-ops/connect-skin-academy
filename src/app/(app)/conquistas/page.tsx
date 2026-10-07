import type { Metadata } from "next";
import { Award, Flame, Lock, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/shared/page";
import { requireUser } from "@/lib/auth/dal";
import { getMyBadges } from "@/services/learning";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conquistas" };

const REASONS: Record<string, string> = {
  lesson_completed: "Aula concluída",
  module_completed: "Módulo concluído",
  exam_passed: "Aprovação em prova",
  badge: "Conquista desbloqueada",
};

export default async function AchievementsPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const [badges, { data: events }] = await Promise.all([
    getMyBadges(),
    supabase.from("point_events").select("id, points, reason, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(15),
  ]);
  const earned = badges.filter((b) => b.awarded_at).length;

  return (
    <>
      <PageHeader title="Conquistas" description="Seu reconhecimento por aprender com constância. Pontos e badges não são avaliação de desempenho." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pontos" value={profile.total_points} icon={Star} />
        <StatCard label="Badges" value={`${earned}/${badges.length}`} icon={Award} />
        <StatCard label="Sequência atual" value={`${profile.current_streak}d`} icon={Flame} tone={profile.current_streak >= 3 ? "success" : "default"} />
        <StatCard label="Maior sequência" value={`${profile.longest_streak}d`} icon={Flame} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {badges.map((b) => (
            <Card key={b.id} className={cn("py-0", !b.awarded_at && "opacity-60")}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-2xl", b.awarded_at ? "bg-secondary" : "bg-muted grayscale")}>
                  {b.awarded_at ? b.icon : <Lock className="size-5 text-muted-foreground" />}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold leading-snug">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                  <p className="text-xs font-medium text-primary">
                    {b.awarded_at ? `Conquistado em ${formatDate(b.awarded_at)}` : `+${b.points} pts ao desbloquear`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Últimos pontos</CardTitle>
          </CardHeader>
          <CardContent>
            {!events?.length ? (
              <p className="text-sm text-muted-foreground">Conclua aulas para começar a pontuar.</p>
            ) : (
              <ul className="divide-y">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {REASONS[e.reason as string] ?? e.reason}
                      <span className="block text-xs text-muted-foreground">{formatRelative(e.created_at as string)}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-success">+{e.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
