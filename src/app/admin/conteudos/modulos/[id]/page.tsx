import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { ModuleForm } from "@/components/admin/module-form";
import { ExamSummaryLink, ModuleLessonsList } from "@/components/admin/content-lists";
import { QuickCreate } from "@/components/admin/quick-create";
import { DeleteButton, DuplicateButton } from "@/components/admin/item-actions";
import { getModuleAdmin, listCompetencies } from "@/services/content";
import { createLessonAction, deleteModuleAction, duplicateModuleAction } from "@/actions/content";

export const metadata: Metadata = { title: "Editar módulo" };

export default async function ModuleEditorPage({ params }: PageProps<"/admin/conteudos/modulos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, competencies] = await Promise.all([getModuleAdmin(id), listCompetencies()]);
  if (!data) notFound();
  const { module: mod, lessons, exam } = data;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/conteudos/trilhas/${mod.course.id}`, label: mod.course.title }}
        eyebrow={`Módulo ${String(mod.position).padStart(2, "0")}`}
        title={mod.title}
        actions={
          <>
            <DuplicateButton action={duplicateModuleAction.bind(null, mod.id)} hrefFor={(nid) => `/admin/conteudos/modulos/${nid}`} />
            <DeleteButton
              action={deleteModuleAction.bind(null, mod.id)}
              title="Excluir este módulo?"
              description="O módulo e suas aulas saem do ar. Progresso e tentativas de prova já registrados são preservados."
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <ModuleForm module={mod} competencies={competencies} selectedCompetencies={data.competencyIds} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle>Aulas</CardTitle>
                <CardDescription>Arraste para reordenar.</CardDescription>
              </div>
              <QuickCreate action={createLessonAction.bind(null, mod.id)} label="Nova aula" placeholder="Ex.: Introdução" />
            </CardHeader>
            <CardContent>
              {lessons.length ? (
                <ModuleLessonsList moduleId={mod.id} lessons={lessons} canEdit />
              ) : (
                <EmptyState icon={PlayCircle} title="Nenhuma aula" description="Adicione a primeira aula deste módulo." />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Prova do módulo</CardTitle>
              <CardDescription>Uma prova por módulo. Pode ser obrigatória para concluir.</CardDescription>
            </CardHeader>
            <CardContent>
              {exam ? (
                <ExamSummaryLink exam={{ id: exam.id, title: exam.title, status: exam.status, questions: exam.exam_questions?.[0]?.count ?? 0 }} />
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/admin/avaliacoes/provas/nova?modulo=${mod.id}`}>
                    <ClipboardPlus /> Criar prova
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
