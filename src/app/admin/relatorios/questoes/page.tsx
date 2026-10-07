import type { Metadata } from "next";
import { Suspense } from "react";
import { FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { FilterSelect } from "@/components/shared/list-controls";
import { QuestionTable } from "@/components/admin/question-table";
import { getQuestionStats } from "@/services/analytics";
import { listExamsAdmin } from "@/services/exams";

export const metadata: Metadata = { title: "Relatório por questão" };

export default async function QuestionReportPage({ searchParams }: PageProps<"/admin/relatorios/questoes">) {
  const sp = await searchParams;
  const exam = typeof sp.exam === "string" && /^[0-9a-f-]{36}$/i.test(sp.exam) ? sp.exam : undefined;
  const [questions, exams] = await Promise.all([getQuestionStats(exam), listExamsAdmin()]);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/relatorios", label: "Relatórios" }}
        title="Relatório por questão"
        description="Identifique o que a equipe está errando para reforçar o conteúdo certo."
      />
      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="pb-4">
              <FilterSelect param="exam" placeholder="Todas as provas" options={exams.map((e) => ({ value: e.id, label: e.title }))} />
            </div>
          </Suspense>
          {questions.length === 0 ? (
            <EmptyState icon={FileQuestion} title="Sem respostas registradas" description="Os dados aparecem depois que os colaboradores fizerem as provas." />
          ) : (
            <div className="overflow-x-auto">
              <QuestionTable questions={questions} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
