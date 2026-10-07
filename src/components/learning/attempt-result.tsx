import { CheckCircle2, Circle, Clock, Lightbulb, RotateCcw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/shared/progress";
import { formatClock, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttemptResult } from "@/types/domain";

export function AttemptResultView({ result, actions }: { result: AttemptResult; actions?: React.ReactNode }) {
  const passed = Boolean(result.passed);
  const score = Number(result.score_percent ?? 0);
  const total = (result.correct_count ?? 0) + (result.wrong_count ?? 0);
  const attemptsLeft = result.max_attempts !== null ? result.max_attempts - result.attempts_used : null;

  return (
    <div className="space-y-6">
      <Card className={cn("overflow-hidden", result.show_result && (passed ? "border-success/40" : "border-destructive/30"))}>
        <CardContent className="flex flex-col items-center gap-6 py-2 text-center sm:flex-row sm:text-left">
          {result.show_result ? (
            <ProgressRing value={score} size={132} stroke={11}>
              <span className="text-3xl font-semibold tabular-nums">{formatPercent(score)}</span>
              <span className="text-[11px] text-muted-foreground">NOTA</span>
            </ProgressRing>
          ) : (
            <div className="flex size-32 items-center justify-center rounded-full bg-secondary text-sm text-muted-foreground">Enviada</div>
          )}
          <div className="flex-1 space-y-2">
            {result.show_result ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <p className={cn("flex items-center justify-center gap-2 text-2xl font-semibold sm:justify-start", passed ? "text-success" : "text-destructive")}>
                  {passed ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
                  {passed ? "APROVADO ✓" : "NÃO APROVADO"}
                </p>
                {!passed && <p className="text-sm text-muted-foreground">Você não atingiu a nota mínima de {result.passing_score}%.</p>}
              </>
            ) : (
              <p className="text-lg font-semibold">Prova enviada com sucesso.</p>
            )}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-1 text-sm sm:justify-start">
              {result.show_result && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success" /> {result.correct_count} acertos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <XCircle className="size-4 text-destructive" /> {result.wrong_count} erros
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-muted-foreground" /> {formatClock(result.time_spent_seconds ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="size-4 text-muted-foreground" /> Tentativa {result.attempt_number}
                {result.max_attempts ? ` de ${result.max_attempts}` : ""}
              </span>
            </div>
            {!passed && result.show_result && attemptsLeft !== null && (
              <p className="text-sm text-muted-foreground">
                {attemptsLeft > 0 ? `Você ainda tem ${attemptsLeft} tentativa(s).` : "Você utilizou todas as tentativas. Procure o gestor para orientação."}
              </p>
            )}
            {result.status === "expired" && <Badge variant="outline">Tempo esgotado — enviada automaticamente</Badge>}
          </div>
          {actions && <div className="flex flex-col gap-2">{actions}</div>}
        </CardContent>
      </Card>

      {result.history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de tentativas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {result.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    Tentativa {h.attempt_number}
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(h.submitted_at)}</span>
                  </span>
                  <span className={cn("font-semibold tabular-nums", h.passed ? "text-success" : h.status === "in_progress" ? "text-muted-foreground" : "text-destructive")}>
                    {h.status === "in_progress" ? "em andamento" : formatPercent(h.score_percent)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.show_result && (
        <section className="space-y-3">
          <h2 className="font-semibold">Revisão {total ? `(${total} questões)` : ""}</h2>
          {!result.review_allowed && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              As respostas corretas serão exibidas conforme as regras desta prova (ex.: após aprovação ou ao final das tentativas).
            </p>
          )}
          <ol className="space-y-3">
            {result.questions.map((q, i) => (
              <li key={q.id}>
                <Card className={cn("gap-3 py-4", q.is_correct ? "border-success/30" : "border-destructive/25")}>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      {q.is_correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground">{i + 1}. </span>
                        {q.statement}
                      </p>
                    </div>
                    {q.options && (
                      <ul className="space-y-1.5 pl-7">
                        {q.options.map((o) => {
                          const chosen = q.selected_option_ids.includes(o.id);
                          return (
                            <li
                              key={o.id}
                              className={cn(
                                "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                                o.is_correct && "border-success/40 bg-success/5",
                                chosen && !o.is_correct && "border-destructive/40 bg-destructive/5",
                              )}
                            >
                              {chosen ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />}
                              <span className="flex-1">{o.text}</span>
                              {o.is_correct && <span className="text-xs font-medium text-success">correta</span>}
                              {chosen && !o.is_correct && <span className="text-xs font-medium text-destructive">sua resposta</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {q.explanation && (
                      <div className="ml-7 flex gap-2 rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div>
                          <p className="font-medium">Por que essa resposta está correta?</p>
                          <p className="text-muted-foreground">{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
