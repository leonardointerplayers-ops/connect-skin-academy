/**
 * Learning Health Score — indicador de ENGAJAMENTO EDUCACIONAL (0–100).
 * Não é avaliação de desempenho profissional.
 *
 *   Progresso 35% • Recência 25% • Conclusões/ritmo 10% • Notas 20% • Tentativas 10%
 *   🟢 Excelente ≥ 70 • 🟡 Atenção 40–69 • 🔴 Baixo engajamento < 40
 */

export type HealthLevel = "excellent" | "attention" | "low";

export interface HealthInput {
  overall_percent: number | string | null;
  days_since_activity: number | null;
  modules_completed: number | string | null;
  overdue_items: number | string | null;
  exams_taken: number | string | null;
  avg_best_score: number | string | null;
  avg_attempts_per_exam: number | string | null;
}

export interface HealthScore {
  score: number;
  level: HealthLevel;
  factors: { progress: number; recency: number; pace: number; grades: number; attempts: number };
}

export const HEALTH_WEIGHTS = { progress: 0.35, recency: 0.25, pace: 0.1, grades: 0.2, attempts: 0.1 } as const;

export const HEALTH_LABELS: Record<HealthLevel, { label: string; emoji: string }> = {
  excellent: { label: "Excelente", emoji: "🟢" },
  attention: { label: "Atenção", emoji: "🟡" },
  low: { label: "Baixo engajamento", emoji: "🔴" },
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

export function recencyScore(days: number | null): number {
  if (days === null) return 0;
  if (days <= 3) return 100;
  if (days <= 7) return 75;
  if (days <= 14) return 45;
  if (days <= 30) return 20;
  return 5;
}

export function attemptsScore(avgAttempts: number | null): number {
  if (avgAttempts === null) return 70;
  if (avgAttempts <= 1) return 100;
  if (avgAttempts <= 2) return 70;
  if (avgAttempts <= 3) return 45;
  return 25;
}

export function healthLevel(score: number): HealthLevel {
  if (score >= 70) return "excellent";
  if (score >= 40) return "attention";
  return "low";
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const progress = Math.max(0, Math.min(100, num(input.overall_percent) ?? 0));
  const recency = recencyScore(num(input.days_since_activity));
  const overdue = num(input.overdue_items) ?? 0;
  const modules = num(input.modules_completed) ?? 0;
  const pace = overdue > 0 ? 20 : modules > 0 ? 100 : 60;
  const examsTaken = num(input.exams_taken) ?? 0;
  const avgScore = num(input.avg_best_score);
  const grades = examsTaken === 0 || avgScore === null ? 70 : Math.max(0, Math.min(100, avgScore));
  const attempts = attemptsScore(num(input.avg_attempts_per_exam));

  const score = Math.round(
    progress * HEALTH_WEIGHTS.progress +
      recency * HEALTH_WEIGHTS.recency +
      pace * HEALTH_WEIGHTS.pace +
      grades * HEALTH_WEIGHTS.grades +
      attempts * HEALTH_WEIGHTS.attempts,
  );

  return { score, level: healthLevel(score), factors: { progress, recency, pace, grades, attempts } };
}
