import { HEALTH_LABELS, type HealthScore } from "@/lib/analytics/health";
import { cn } from "@/lib/utils";

export function HealthBadge({ health, showScore = true }: { health: HealthScore | undefined; showScore?: boolean }) {
  if (!health) return <span className="text-xs text-muted-foreground">—</span>;
  const { label } = HEALTH_LABELS[health.level];
  return (
    <span
      title={`Learning Health Score: ${health.score}/100 — indicador de engajamento, não de desempenho profissional.`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        health.level === "excellent" && "border-success/30 bg-success/10 text-success",
        health.level === "attention" && "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
        health.level === "low" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          health.level === "excellent" && "bg-success",
          health.level === "attention" && "bg-warning",
          health.level === "low" && "bg-destructive",
        )}
      />
      {label}
      {showScore && <span className="tabular-nums opacity-70">{health.score}</span>}
    </span>
  );
}
