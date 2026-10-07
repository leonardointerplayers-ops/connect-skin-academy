import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { HealthBadge } from "./health-badge";
import { formatPercent, formatRelative } from "@/lib/format";
import type { TeamView } from "@/lib/analytics/insights";
import type { UserLearningSummary } from "@/types/domain";

function PersonRow({ user, view, right }: { user: UserLearningSummary; view: TeamView; right: React.ReactNode }) {
  return (
    <li>
      <Link href={`/admin/colaboradores/${user.user_id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60">
        <UserAvatar name={user.full_name} avatarPath={user.avatar_path} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[user.job_title, user.department].filter(Boolean).join(" · ") || user.email}
          </p>
        </div>
        <div className="hidden sm:block">
          <HealthBadge health={view.health.get(user.user_id)} showScore={false} />
        </div>
        <div className="w-28 text-right text-xs text-muted-foreground">{right}</div>
      </Link>
    </li>
  );
}

function List({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  if (!children.length) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y">{children.slice(0, 12)}</ul>;
}

export function TeamViewTabs({ view, inactivityDays }: { view: TeamView; inactivityDays: number }) {
  const tabs = [
    {
      id: "overdue",
      label: "Atrasados",
      count: view.overdue.length,
      content: (
        <List empty="Ninguém com prazo vencido. 🎉">
          {view.overdue.map((u) => (
            <PersonRow key={u.user_id} user={u} view={view} right={`${u.overdue_items} prazo(s) vencido(s)`} />
          ))}
        </List>
      ),
    },
    {
      id: "inactive",
      label: `Sem acesso há +${inactivityDays}d`,
      count: view.inactive.length + view.neverAccessed.length,
      content: (
        <List empty="Toda a equipe acessou recentemente.">
          {[...view.inactive, ...view.neverAccessed].map((u) => (
            <PersonRow
              key={u.user_id}
              user={u}
              view={view}
              right={u.last_activity_at ? `há ${u.days_since_activity} dias` : "nunca acessou"}
            />
          ))}
        </List>
      ),
    },
    {
      id: "near",
      label: "Próximos da conclusão",
      count: view.nearCompletion.length,
      content: (
        <List empty="Ninguém entre 75% e 99% no momento.">
          {view.nearCompletion.map((u) => (
            <PersonRow key={u.user_id} user={u} view={view} right={formatPercent(u.overall_percent)} />
          ))}
        </List>
      ),
    },
    {
      id: "low",
      label: "Baixo desempenho",
      count: view.lowPerformance.length,
      content: (
        <List empty="Nenhum colaborador com baixo desempenho.">
          {view.lowPerformance.map((u) => (
            <PersonRow
              key={u.user_id}
              user={u}
              view={view}
              right={u.avg_best_score !== null ? `nota média ${formatPercent(u.avg_best_score)}` : `${formatPercent(u.overall_percent)} concluído`}
            />
          ))}
        </List>
      ),
    },
    {
      id: "failed",
      label: "Reprovações",
      count: view.failedExam.length,
      content: view.failedExam.length ? (
        <ul className="divide-y">
          {view.failedExam.slice(0, 12).map((f) => (
            <li key={`${f.user_id}-${f.module_id}`}>
              <Link href={`/admin/colaboradores/${f.user_id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60">
                <span className="truncate text-sm font-medium">{f.user_name}</span>
                <span className="text-xs text-muted-foreground">
                  {f.failures}× no {f.module_title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma reprovação pendente.</p>
      ),
    },
    {
      id: "excellent",
      label: "Excelente desempenho",
      count: view.excellent.length,
      content: (
        <List empty="Ainda sem destaques — aparecem aqui notas médias ≥ 90% com bom engajamento.">
          {view.excellent.map((u) => (
            <PersonRow key={u.user_id} user={u} view={view} right={`nota média ${formatPercent(u.avg_best_score)}`} />
          ))}
        </List>
      ),
    },
  ];

  return (
    <Tabs defaultValue="overdue">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList className="w-max">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              {t.label}
              <span className="rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="mt-2">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function lastAccessLabel(u: UserLearningSummary) {
  return formatRelative(u.last_activity_at);
}
