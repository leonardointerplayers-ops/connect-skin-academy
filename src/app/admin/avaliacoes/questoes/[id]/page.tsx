import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { QuestionPageClient } from "@/components/admin/question-page-client";
import { DeleteButton, DuplicateButton } from "@/components/admin/item-actions";
import { getQuestion, getQuestionStats, listQuestionCategories } from "@/services/exams";
import { listModulesAdmin } from "@/services/content";
import { archiveQuestionAction, duplicateQuestionAction } from "@/actions/exams";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Questão" };

export default async function QuestionPage({ params }: PageProps<"/admin/avaliacoes/questoes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, categories, modules, stats] = await Promise.all([getQuestion(id), listQuestionCategories(), listModulesAdmin(), getQuestionStats(id)]);
  if (!data) notFound();
  const { question, answersCount } = data;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/avaliacoes/questoes", label: "Banco de questões" }}
        eyebrow={`Q-${String(question.number).padStart(3, "0")}`}
        title="Editar questão"
        actions={
          <>
            <DuplicateButton action={duplicateQuestionAction.bind(null, question.id)} hrefPrefix="/admin/avaliacoes/questoes/" />
            <DeleteButton
              label={answersCount ? "Arquivar" : "Excluir"}
              action={archiveQuestionAction.bind(null, question.id)}
              title={answersCount ? "Arquivar questão?" : "Excluir questão?"}
              description={
                answersCount
                  ? "A questão já foi respondida: será arquivada e removida das provas, preservando o histórico de respostas."
                  : "A questão será removida do banco e das provas."
              }
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent>
            <QuestionPageClient
              question={question}
              modules={modules.map((m) => ({ id: m.id, title: m.title, position: m.position }))}
              categories={categories}
              answersCount={answersCount}
            />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Desempenho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.total ? (
              <>
                <p>
                  <strong className="tabular-nums">{stats.total}</strong> respostas
                </p>
                <p>
                  <span className="text-success">{stats.correct} acertos</span> · <span className="text-destructive">{stats.wrong} erros</span>
                </p>
                <p className="text-2xl font-semibold tabular-nums">{formatPercent(stats.pct)} de acerto</p>
              </>
            ) : (
              <p className="text-muted-foreground">Ainda não respondida.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
