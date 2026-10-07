"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Loader2, Send, Square, SquareCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProgressBar } from "@/components/shared/progress";
import { saveAnswerAction, submitExamAction } from "@/actions/exams";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttemptPayload } from "@/types/domain";

export function ExamRunner({ attempt }: { attempt: AttemptPayload }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(attempt.answers ?? {});
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [saving, setSaving] = useState(0);
  const submittedRef = useRef(false);

  // Diferença entre o relógio do servidor e o do aparelho.
  const [offset] = useState(() => new Date(attempt.server_now).getTime() - Date.now());
  const deadline = attempt.expires_at ? new Date(attempt.expires_at).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(() => (deadline ? Math.max(0, (deadline - (Date.now() + offset)) / 1000) : null));

  const questions = attempt.questions;
  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => (answers[x.id] ?? []).length > 0).length, [answers, questions]);

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startSubmit(async () => {
      const res = await submitExamAction(attempt.attempt_id, answers);
      if (res && !res.ok) {
        submittedRef.current = false;
        toast.error(res.error);
      }
    });
  }, [answers, attempt.attempt_id]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const left = Math.max(0, (deadline - (Date.now() + offset)) / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        toast.warning("O tempo acabou. Enviando suas respostas…");
        submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, offset, submit]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function choose(optionId: string) {
    const current = answers[q.id] ?? [];
    const next =
      q.type === "multiple_choice"
        ? current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId]
        : [optionId];
    setAnswers((prev) => ({ ...prev, [q.id]: next }));
    setSaving((s) => s + 1);
    void saveAnswerAction(attempt.attempt_id, q.id, next).then((res) => {
      setSaving((s) => s - 1);
      if (!res.ok) toast.error(res.error);
    });
  }

  if (!q) return null;
  const selected = answers[q.id] ?? [];
  const lowTime = remaining !== null && remaining < 60;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="sticky top-14 z-20 -mx-4 space-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold">{attempt.exam_title}</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-xs text-muted-foreground sm:inline">{saving > 0 ? "Salvando…" : "Respostas salvas"}</span>
            {remaining !== null && (
              <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono tabular-nums", lowTime ? "bg-destructive/10 text-destructive" : "bg-muted")}>
                <Clock className="size-3.5" /> {formatClock(remaining)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={(answeredCount / questions.length) * 100} size="sm" />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {answeredCount}/{questions.length}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Questão {index + 1} de {questions.length}
          {q.type === "multiple_choice" && " · marque todas as corretas"}
        </p>
        <h2 className="text-lg font-semibold leading-snug whitespace-pre-line">{q.statement}</h2>
        <ul className="space-y-2" role={q.type === "multiple_choice" ? "group" : "radiogroup"}>
          {q.options.map((o, i) => {
            const isOn = selected.includes(o.id);
            const Icon = q.type === "multiple_choice" ? (isOn ? SquareCheck : Square) : isOn ? CheckCircle2 : Circle;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role={q.type === "multiple_choice" ? "checkbox" : "radio"}
                  aria-checked={isOn}
                  onClick={() => choose(o.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-sm transition-colors",
                    isOn ? "border-primary bg-secondary/60 ring-1 ring-primary" : "hover:bg-muted/60",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-5 shrink-0", isOn ? "text-primary" : "text-muted-foreground")} />
                  <span>
                    <span className="mr-1.5 font-semibold text-muted-foreground">{String.fromCharCode(65 + i)})</span>
                    {o.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <ChevronLeft /> Anterior
        </Button>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Próxima <ChevronRight />
          </Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />} Finalizar prova
          </Button>
        )}
      </div>

      <nav aria-label="Ir para questão" className="flex flex-wrap gap-1.5">
        {questions.map((x, i) => {
          const done = (answers[x.id] ?? []).length > 0;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "size-9 rounded-lg border text-xs font-semibold tabular-nums",
                i === index && "ring-2 ring-primary",
                done ? "border-primary/40 bg-secondary text-secondary-foreground" : "text-muted-foreground",
              )}
              aria-label={`Questão ${i + 1}${done ? " (respondida)" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar a prova?</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount < questions.length ? (
                <span className="flex items-start gap-2 text-warning-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Você deixou {questions.length - answeredCount} questão(ões) sem resposta. Elas contarão como erro.
                </span>
              ) : (
                "Todas as questões foram respondidas. Depois de enviar não é possível alterar."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Enviar respostas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
