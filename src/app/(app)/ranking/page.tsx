import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { UserAvatar } from "@/components/shared/user-avatar";
import { requireUser } from "@/lib/auth/dal";
import { getSettings } from "@/services/settings";
import { createClient } from "@/lib/supabase/server";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ranking" };

const CRITERIA: Record<string, string> = {
  points: "pontos",
  completions: "módulos concluídos",
  scores: "nota média",
  streak: "maior sequência de estudos",
};

export default async function RankingPage() {
  const profile = await requireUser();
  const settings = await getSettings();
  if (!settings.ranking_enabled) {
    return <EmptyState icon={Trophy} title="Ranking desativado" description="O ranking interno não está ativo no momento." />;
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_ranking", { p_limit: 50 });
  const rows = (data ?? []) as {
    user_id: string;
    full_name: string;
    avatar_path: string | null;
    total_points: number;
    modules_completed: number;
    avg_score: number | null;
    longest_streak: number;
    rank_position: number;
  }[];

  return (
    <>
      <PageHeader
        title="Ranking"
        description={`Classificação por ${CRITERIA[settings.ranking_criteria]}. É uma forma de celebrar a evolução — não um indicador de desempenho profissional.`}
      />
      <Card className="py-0">
        <CardContent className="p-2">
          <ol className="divide-y">
            {rows.map((r) => (
              <li key={r.user_id} className={cn("flex items-center gap-3 rounded-lg px-3 py-3", r.user_id === profile.id && "bg-secondary")}>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    r.rank_position === 1 ? "bg-warning text-warning-foreground" : r.rank_position <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.rank_position}
                </span>
                <UserAvatar name={r.full_name} avatarPath={r.avatar_path} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.full_name}
                  {r.user_id === profile.id && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                </span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {settings.ranking_criteria === "completions"
                    ? `${r.modules_completed} mód.`
                    : settings.ranking_criteria === "scores"
                      ? formatPercent(r.avg_score)
                      : settings.ranking_criteria === "streak"
                        ? `${r.longest_streak}d`
                        : `${r.total_points} pts`}
                </span>
              </li>
            ))}
            {rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Sem dados ainda.</li>}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
