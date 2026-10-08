import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, ListChecks, RotateCcw, Shuffle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";
import { StartExamButton } from "@/components/learning/start-exam-button";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/lib/auth/dal";
import { formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Exam, ExamAttempt } from "@/types/domain";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Prova" };

export default async function ExamIntroPage({ params }: PageProps<"/provas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const claims = await getSessionClaims();
  const { data: exam } = await supabase
    .from("exams")
    .select("*, module:modules(id, title, position), exam_questions(count)")
    .eq("id", id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!exam) {
    return <EmptyState icon={Lock} title="Prova indisponível" description="Esta prova ainda não foi liberada para você." action={<Button asChild variant="outline"><Link href="/provas">Voltar</Link></Button>} />;
  }
  const e = exam as Exam & { module: { id: string; title: string; position: number }; exam_questions: { count: number }[] };
  const { data: attemptsData } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", id)
    .eq("user_id", claims?.userId ?? "")
    .order("attempt_number");
  const attempts = (attemptsData ?? []) as ExamAttempt[];
  const open = attempts.find((a) => a.status === "in_progress");
  const done = attempts.filter((a) => a.status !== "in_progress");
  const passed = done.some((a) => a.passed);
  const exhausted = e.max_attempts !== null && done.length >= e.max_attempts;
  // exam_questions só é legível por staff; para o colaborador vale question_count.
  const questionCount = e.question_count ?? (e.exam_questions?.[0]?.count || null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/modulos/${e.module.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Módulo {String(e.module.position).padStart(2, "0")} · {e.module.title}
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{e.title}</h1>
        {e.description && <p className="text-muted-foreground">{e.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ...(questionCount ? [{ icon: ListChecks, label: "Questões", value: questionCount }] : []),
          { icon: Target, label: "Nota mínima", value: `${e.passing_score}%` },
          { icon: RotateCcw, label: "Tentativas", value: e.max_attempts ? `${done.length}/${e.max_attempts}` : `${done.length}/∞` },
          { icon: Clock, label: "Tempo", value: e.time_limit_minutes ? `${e.time_limit_minutes} min` : "Livre" },
        ].map((s) => (
          <Card key={s.label} className="gap-1 py-4">
            <CardContent className="space-y-1 px-4">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="text-lg font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {e.instructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instruções</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line text-muted-foreground">{e.instructions}</CardContent>
        </Card>
      )}

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {e.time_limit_minutes && <li>• O cronômetro começa ao iniciar e a prova é enviada automaticamente quando o tempo acabar.</li>}
        <li>• Suas respostas são salvas automaticamente enquanto você responde.</li>
        {e.shuffle_questions && (
          <li className="flex items-center gap-1">
            • <Shuffle className="size-3.5" /> As questões aparecem em ordem aleatória a cada tentativa.
          </li>
        )}
        <li>• Todas as tentativas ficam registradas no seu histórico.</li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {passed ? (
          <p className="inline-flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-5" /> Você já foi aprovado nesta prova.
          </p>
        ) : open ? (
          <Button size="lg" asChild>
            <Link href={`/provas/tentativa/${open.id}`}>Retomar tentativa {open.attempt_number}</Link>
          </Button>
        ) : exhausted ? (
          <p className="text-sm text-destructive">Você utilizou todas as tentativas. Procure o gestor para orientação.</p>
        ) : (
          <StartExamButton examId={e.id} label={done.length ? `Iniciar tentativa ${done.length + 1}` : "Iniciar prova"} />
        )}
      </div>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de tentativas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {done.map((a) => (
                <li key={a.id}>
                  <Link href={`/provas/resultado/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline">
                    <span>
                      Tentativa {a.attempt_number} <span className="text-xs text-muted-foreground">· {formatDateTime(a.submitted_at)}</span>
                    </span>
                    <span className={cn("font-semibold tabular-nums", a.passed ? "text-success" : "text-destructive")}>{formatPercent(a.score_percent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
