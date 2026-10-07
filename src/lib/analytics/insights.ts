import { computeHealthScore, type HealthScore } from "./health";
import type { LessonStats, ModuleStats, QuestionStats, UserLearningSummary } from "@/types/domain";

export type InsightSeverity = "positive" | "info" | "warning" | "critical";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail?: string;
  href?: string;
}

export interface FailedTwice {
  user_id: string;
  user_name: string;
  module_id: string;
  module_title: string;
  failures: number;
  passed: boolean;
}

export interface InsightContext {
  users: UserLearningSummary[];
  modules: (ModuleStats & { label: string })[];
  questions: QuestionStats[];
  lessons: LessonStats[];
  failedTwice: FailedTwice[];
  inactivityDays: number;
}

/** Ponto de extensão: no futuro um provedor de IA pode complementar as regras. */
export interface InsightProvider {
  generate(ctx: InsightContext): Promise<Insight[]> | Insight[];
}

const n = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const pct = (v: number) => `${Math.round(v)}%`;
const questionLabel = (q: { number: number }) => `Q-${String(q.number).padStart(3, "0")}`;

export function learners(users: UserLearningSummary[]) {
  return users.filter((u) => u.role_id === "collaborator" && u.status !== "inactive");
}

export function isInactive(u: UserLearningSummary, days: number) {
  return u.days_since_activity === null ? u.status === "active" : u.days_since_activity > days;
}

export interface TeamView {
  overdue: UserLearningSummary[];
  inactive: UserLearningSummary[];
  nearCompletion: UserLearningSummary[];
  lowPerformance: UserLearningSummary[];
  failedExam: FailedTwice[];
  excellent: UserLearningSummary[];
  neverAccessed: UserLearningSummary[];
  health: Map<string, HealthScore>;
}

export function buildTeamView(users: UserLearningSummary[], failed: FailedTwice[], inactivityDays: number): TeamView {
  const team = learners(users);
  const health = new Map(team.map((u) => [u.user_id, computeHealthScore(u)]));
  return {
    overdue: team.filter((u) => n(u.overdue_items) > 0).sort((a, b) => n(b.overdue_items) - n(a.overdue_items)),
    inactive: team
      .filter((u) => u.days_since_activity !== null && u.days_since_activity > inactivityDays)
      .sort((a, b) => n(b.days_since_activity) - n(a.days_since_activity)),
    neverAccessed: team.filter((u) => u.last_activity_at === null),
    nearCompletion: team
      .filter((u) => n(u.overall_percent) >= 75 && n(u.overall_percent) < 100)
      .sort((a, b) => n(b.overall_percent) - n(a.overall_percent)),
    lowPerformance: team
      .filter((u) => (u.avg_best_score !== null && n(u.avg_best_score) < 70) || health.get(u.user_id)?.level === "low")
      .sort((a, b) => (health.get(a.user_id)?.score ?? 0) - (health.get(b.user_id)?.score ?? 0)),
    failedExam: failed.filter((f) => !f.passed && f.failures >= 1).sort((a, b) => b.failures - a.failures),
    excellent: team
      .filter((u) => health.get(u.user_id)?.level === "excellent" && u.avg_best_score !== null && n(u.avg_best_score) >= 90)
      .sort((a, b) => n(b.avg_best_score) - n(a.avg_best_score)),
    health,
  };
}

/** Alertas individuais (pessoa + motivo), mais graves primeiro. */
export function buildAlerts(ctx: InsightContext, limit = 12): Insight[] {
  const alerts: Insight[] = [];
  for (const f of ctx.failedTwice.filter((x) => x.failures >= 2 && !x.passed)) {
    alerts.push({
      id: `failed-${f.user_id}-${f.module_id}`,
      severity: "critical",
      title: `${f.user_name} reprovou ${f.failures} vezes no ${f.module_title}.`,
      href: `/admin/colaboradores/${f.user_id}`,
    });
  }
  for (const u of learners(ctx.users)) {
    if (u.days_since_activity !== null && u.days_since_activity > ctx.inactivityDays) {
      alerts.push({
        id: `inactive-${u.user_id}`,
        severity: u.days_since_activity > ctx.inactivityDays * 2 ? "critical" : "warning",
        title: `${u.full_name} não acessa a plataforma há ${u.days_since_activity} dias.`,
        href: `/admin/colaboradores/${u.user_id}`,
      });
    }
    if (n(u.overdue_items) > 0) {
      alerts.push({
        id: `overdue-${u.user_id}`,
        severity: "warning",
        title: `${u.full_name} está com ${n(u.overdue_items)} prazo(s) vencido(s).`,
        href: `/admin/colaboradores/${u.user_id}`,
      });
    }
  }
  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, limit);
}

/** Insights da equipe gerados por regras sobre dados reais. */
export const ruleBasedInsights: InsightProvider = {
  generate(ctx) {
    const out: Insight[] = [];
    const team = learners(ctx.users);
    const total = team.length;
    if (total === 0) return out;

    const inactive = team.filter((u) => u.days_since_activity !== null && u.days_since_activity > ctx.inactivityDays);
    if (inactive.length) {
      out.push({
        id: "inactive",
        severity: inactive.length / total >= 0.2 ? "critical" : "warning",
        title: `${inactive.length} colaborador${inactive.length > 1 ? "es não acessam" : " não acessa"} a plataforma há mais de ${ctx.inactivityDays} dias.`,
        href: "/admin/analytics#equipe",
      });
    }

    const never = team.filter((u) => u.last_activity_at === null);
    if (never.length) {
      out.push({
        id: "never",
        severity: "info",
        title: `${never.length} colaborador${never.length > 1 ? "es ainda não acessaram" : " ainda não acessou"} a plataforma desde o convite.`,
        href: "/admin/colaboradores?status=invited",
      });
    }

    const overdue = team.filter((u) => n(u.overdue_items) > 0);
    if (overdue.length) {
      out.push({
        id: "overdue",
        severity: "warning",
        title: `${overdue.length} colaborador${overdue.length > 1 ? "es estão" : " está"} com prazos de conclusão vencidos.`,
        href: "/admin/analytics#equipe",
      });
    }

    for (const m of ctx.modules.filter((x) => n(x.enrolled) > 0)) {
      const rate = (n(m.completed) / n(m.enrolled)) * 100;
      if (rate >= 85) {
        out.push({ id: `done-${m.module_id}`, severity: "positive", title: `${pct(rate)} da equipe concluiu o ${m.label}.`, detail: `${n(m.completed)} de ${n(m.enrolled)} colaboradores.` });
      } else if (n(m.completed) > 0) {
        out.push({ id: `done-${m.module_id}`, severity: "info", title: `${n(m.completed)} de ${n(m.enrolled)} colaboradores concluíram o ${m.label}.` });
      }
    }

    const withAttempts = ctx.modules.filter((m) => n(m.users_attempted) >= 3 && m.approval_rate !== null);
    if (withAttempts.length >= 2) {
      const worst = [...withAttempts].sort((a, b) => n(a.approval_rate) - n(b.approval_rate))[0];
      out.push({
        id: `worst-approval-${worst.module_id}`,
        severity: n(worst.approval_rate) < 70 ? "warning" : "info",
        title: `O ${worst.label} possui a menor taxa de aprovação (${pct(n(worst.approval_rate))}).`,
        href: `/admin/relatorios/modulos/${worst.module_id}`,
      });
    }

    for (const m of ctx.modules.filter((x) => n(x.users_attempted) >= 3)) {
      const struggling = n(m.users_attempted) - n(m.users_passed);
      const share = (struggling / n(m.users_attempted)) * 100;
      if (share >= 40) {
        out.push({
          id: `struggle-${m.module_id}`,
          severity: "critical",
          title: `${pct(share)} dos colaboradores que fizeram a prova do ${m.label} ainda não foram aprovados.`,
          detail: "Considere reforçar o conteúdo ou revisar as questões com mais erros.",
          href: `/admin/relatorios/modulos/${m.module_id}`,
        });
      }
    }

    const hardQuestions = ctx.questions
      .filter((q) => n(q.total_answers) >= 5 && q.pct_correct !== null && n(q.pct_correct) < 60)
      .sort((a, b) => n(a.pct_correct) - n(b.pct_correct))
      .slice(0, 3);
    for (const q of hardQuestions) {
      out.push({
        id: `question-${q.question_id}-${q.exam_id}`,
        severity: n(q.pct_correct) < 45 ? "critical" : "warning",
        title: `A questão ${questionLabel(q)} possui apenas ${pct(n(q.pct_correct))} de acerto.`,
        detail: q.statement.length > 120 ? `${q.statement.slice(0, 117)}…` : q.statement,
        href: `/admin/relatorios/questoes?exam=${q.exam_id}`,
      });
    }

    const abandoned = ctx.lessons
      .filter((l) => n(l.unique_viewers) >= 5 && n(l.abandoned) / n(l.unique_viewers) >= 0.3)
      .sort((a, b) => n(b.abandoned) / n(b.unique_viewers) - n(a.abandoned) / n(a.unique_viewers))[0];
    if (abandoned) {
      out.push({
        id: `abandon-${abandoned.lesson_id}`,
        severity: "warning",
        title: `A aula "${abandoned.title}" tem ${pct((n(abandoned.abandoned) / n(abandoned.unique_viewers)) * 100)} de abandono.`,
        detail: "Colaboradores começaram e não concluíram há mais de 7 dias.",
      });
    }

    const near = team.filter((u) => n(u.overall_percent) >= 75 && n(u.overall_percent) < 100);
    if (near.length) {
      out.push({ id: "near", severity: "positive", title: `${near.length} colaborador${near.length > 1 ? "es estão" : " está"} próximo${near.length > 1 ? "s" : ""} de concluir a trilha.` });
    }

    const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  },
};
