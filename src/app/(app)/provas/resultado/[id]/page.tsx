import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AttemptResultView } from "@/components/learning/attempt-result";
import { StartExamButton } from "@/components/learning/start-exam-button";
import { getAttemptResult } from "@/services/exams";

export const metadata: Metadata = { title: "Resultado" };

export default async function ResultPage({ params }: PageProps<"/provas/resultado/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await getAttemptResult(id);
  if (!result) notFound();
  const canRetry =
    !result.history.some((h) => h.passed) &&
    (result.max_attempts === null || result.attempts_used < result.max_attempts) &&
    !result.history.some((h) => h.status === "in_progress");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resultado</p>
        <h1 className="text-2xl font-semibold tracking-tight">{result.exam_title}</h1>
      </div>
      <AttemptResultView
        result={result}
        actions={
          <>
            {canRetry && <StartExamButton examId={result.exam_id} label="Tentar novamente" />}
            <Button variant="outline" asChild>
              <Link href={`/modulos/${result.module_id}`}>Voltar ao módulo</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
