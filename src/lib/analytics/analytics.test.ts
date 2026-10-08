import { describe, expect, it } from "vitest";
import { computeHealthScore, recencyScore } from "./health";
import { buildAlerts, buildTeamView, ruleBasedInsights, type InsightContext } from "./insights";
import type { UserLearningSummary } from "@/types/domain";

function user(overrides: Partial<UserLearningSummary>): UserLearningSummary {
  return {
    user_id: crypto.randomUUID(),
    full_name: "Colaborador",
    email: "c@empresa.com",
    job_title: null,
    department: null,
    area: null,
    company: null,
    avatar_path: null,
    role_id: "collaborator",
    status: "active",
    joined_at: "2026-09-01",
    activated_at: "2026-09-01",
    last_seen_at: null,
    total_points: 0,
    current_streak: 0,
    longest_streak: 0,
    overall_percent: 0,
    courses_completed: 0,
    courses_enrolled: 1,
    modules_completed: 0,
    lessons_completed: 0,
    lessons_started: 0,
    exam_attempts: 0,
    exams_taken: 0,
    exams_passed: 0,
    failed_attempts: 0,
    avg_best_score: null,
    avg_attempts_per_exam: null,
    time_studied_seconds: 0,
    active_days_30: 0,
    last_activity_at: null,
    days_since_activity: null,
    overdue_items: 0,
    next_due_date: null,
    manager_id: null,
    ...overrides,
  };
}

describe("Learning Health Score", () => {
  it("é excelente para quem estuda, conclui e tira boas notas", () => {
    const h = computeHealthScore({ overall_percent: 90, days_since_activity: 1, modules_completed: 3, overdue_items: 0, exams_taken: 3, avg_best_score: 95, avg_attempts_per_exam: 1 });
    expect(h.level).toBe("excellent");
    expect(h.score).toBeGreaterThanOrEqual(90);
  });

  it("é baixo para quem nunca acessou e está atrasado", () => {
    const h = computeHealthScore({ overall_percent: 0, days_since_activity: null, modules_completed: 0, overdue_items: 2, exams_taken: 0, avg_best_score: null, avg_attempts_per_exam: null });
    expect(h.level).toBe("low");
  });

  it("pede atenção para progresso médio e recência fraca", () => {
    const h = computeHealthScore({ overall_percent: 50, days_since_activity: 12, modules_completed: 1, overdue_items: 0, exams_taken: 1, avg_best_score: 70, avg_attempts_per_exam: 2 });
    expect(h.level).toBe("attention");
  });

  it("aceita números vindos do Postgres como string", () => {
    const h = computeHealthScore({ overall_percent: "100.00", days_since_activity: 0, modules_completed: "4", overdue_items: "0", exams_taken: "4", avg_best_score: "100.00", avg_attempts_per_exam: "1.00" });
    expect(h.score).toBe(100);
  });

  it("recência decai com os dias", () => {
    expect(recencyScore(0)).toBeGreaterThan(recencyScore(5));
    expect(recencyScore(5)).toBeGreaterThan(recencyScore(10));
    expect(recencyScore(40)).toBeLessThan(recencyScore(20));
  });
});

describe("Insights e alertas", () => {
  const ctx: InsightContext = {
    users: [
      user({ full_name: "João", days_since_activity: 10, last_activity_at: "2026-09-27" }),
      user({ full_name: "Ana", overall_percent: 80, days_since_activity: 1, last_activity_at: "2026-10-06" }),
      user({ full_name: "Bia", overdue_items: 1, days_since_activity: 2, last_activity_at: "2026-10-05" }),
      user({ full_name: "Caio" }),
      user({ full_name: "Admin", role_id: "admin" }),
    ],
    modules: [
      { module_id: "m1", course_id: "c", title: "A", label: "Módulo 01", position: 1, status: "published", enrolled: 4, completed: 4, in_progress: 0, avg_percent: 100, exam_id: "e1", users_attempted: 4, users_passed: 4, total_attempts: 4, avg_best_score: 90, avg_score: 90, approval_rate: 100, avg_attempts: 1, users_failed_twice: 0 },
      { module_id: "m2", course_id: "c", title: "B", label: "Módulo 02", position: 2, status: "published", enrolled: 4, completed: 1, in_progress: 3, avg_percent: 50, exam_id: "e2", users_attempted: 4, users_passed: 2, total_attempts: 7, avg_best_score: 60, avg_score: 55, approval_rate: 50, avg_attempts: 1.75, users_failed_twice: 1 },
    ],
    questions: [
      { question_id: "q7", number: 7, statement: "Qual plataforma…?", type: "single_choice", category: null, difficulty: "medium", module_id: "m2", exam_id: "e2", total_answers: 10, correct: 4, wrong: 6, pct_correct: 40 },
    ],
    lessons: [],
    failedTwice: [{ user_id: "u-maria", user_name: "Maria", module_id: "m2", module_title: "Módulo 02", failures: 2, passed: false }],
    inactivityDays: 7,
  };

  it("gera os insights esperados a partir dos dados", () => {
    const titles = (ruleBasedInsights.generate(ctx) as { title: string }[]).map((i) => i.title);
    expect(titles).toContain("1 colaborador não acessa a plataforma há mais de 7 dias.");
    expect(titles).toContain("100% da equipe concluiu o Módulo 01.");
    expect(titles).toContain("O Módulo 02 possui a menor taxa de aprovação (50%).");
    expect(titles).toContain("A questão Q-007 possui apenas 40% de acerto.");
    expect(titles).toContain("50% dos colaboradores que fizeram a prova do Módulo 02 ainda não foram aprovados.");
    expect(titles.some((t) => t.startsWith("1 colaborador ainda não acessou"))).toBe(true);
  });

  it("gera alertas individuais com os mais graves primeiro", () => {
    const alerts = buildAlerts(ctx);
    expect(alerts[0].title).toBe("Maria reprovou 2 vezes no Módulo 02.");
    expect(alerts.map((a) => a.title)).toContain("João não acessa a plataforma há 10 dias.");
  });

  it("monta a visão da equipe ignorando administradores", () => {
    const view = buildTeamView(ctx.users, ctx.failedTwice, 7);
    expect(view.inactive.map((u) => u.full_name)).toEqual(["João"]);
    expect(view.nearCompletion.map((u) => u.full_name)).toEqual(["Ana"]);
    expect(view.overdue.map((u) => u.full_name)).toEqual(["Bia"]);
    expect(view.neverAccessed.map((u) => u.full_name)).toEqual(["Caio"]);
    expect(view.health.size).toBe(4);
  });
});
