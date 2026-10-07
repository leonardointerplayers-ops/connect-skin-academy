import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { ExamForm } from "@/components/admin/exam-form";
import { ExamQuestions } from "@/components/admin/exam-questions";
import { ExamDuplicate } from "@/components/admin/exam-duplicate";
import { DeleteButton } from "@/components/admin/item-actions";
import { getExamAdmin, listQuestionCategories } from "@/services/exams";
import { listModulesAdmin } from "@/services/content";
import { deleteExamAction } from "@/actions/exams";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar prova" };

export default async function ExamEditorPage({ params }: PageProps<"/admin/avaliacoes/provas/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [data, categories, modules, { data: examModules }] = await Promise.all([
    getExamAdmin(id),
    listQuestionCategories(),
    listModulesAdmin(),
    supabase.from("exams").select("module_id").is("deleted_at", null),
  ]);
  if (!data) notFound();
  const { exam, questions } = data;
  const withExam = new Set((examModules ?? []).map((e) => e.module_id as string));
  const moduleOptions = modules.map((m) => ({ id: m.id, title: m.title, position: m.position }));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/avaliacoes/provas", label: "Provas" }}
        eyebrow={`Módulo ${String(exam.module.position).padStart(2, "0")} · ${exam.module.title}`}
        title={exam.title}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/relatorios/modulos/${exam.module.id}`}>
                <BarChart3 /> Desempenho
              </Link>
            </Button>
            <ExamDuplicate
              examId={exam.id}
              modules={modules.filter((m) => !withExam.has(m.id)).map((m) => ({ id: m.id, label: `${m.course.title} › ${m.title}` }))}
            />
            <DeleteButton
              action={deleteExamAction.bind(null, exam.id)}
              title="Excluir esta prova?"
              description="A prova sai do módulo. As tentativas já realizadas continuam no histórico e nos relatórios."
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <ExamForm exam={exam} categories={categories} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Questões ({questions.length})</CardTitle>
            <CardDescription>
              {exam.selection_mode === "random"
                ? "Prova dinâmica: as questões abaixo formam o conjunto do sorteio (vazio = banco inteiro)."
                : "Arraste para definir a ordem (quando a randomização estiver desligada)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExamQuestions examId={exam.id} questions={questions} modules={moduleOptions} categories={categories} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
