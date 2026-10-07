import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { CourseForm } from "@/components/admin/course-form";
import { CourseModulesList } from "@/components/admin/content-lists";
import { QuickCreate } from "@/components/admin/quick-create";
import { DeleteButton } from "@/components/admin/item-actions";
import { getCourseAdmin } from "@/services/content";
import { listGroups } from "@/services/users";
import { createModuleAction, deleteCourseAction } from "@/actions/content";

export const metadata: Metadata = { title: "Editar trilha" };

export default async function CourseEditorPage({ params }: PageProps<"/admin/conteudos/trilhas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, groups] = await Promise.all([getCourseAdmin(id), listGroups()]);
  if (!data) notFound();
  const { course, modules } = data;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/conteudos/trilhas", label: "Trilhas" }}
        eyebrow="Trilha"
        title={course.title}
        actions={
          <DeleteButton
            action={deleteCourseAction.bind(null, course.id)}
            title="Excluir esta trilha?"
            description="A trilha sai do ar para todos. Progresso, provas e certificados já emitidos são preservados no histórico."
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseForm course={course} groups={groups} selectedGroups={data.groupIds} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Módulos</CardTitle>
              <CardDescription>Arraste para definir a ordem da trilha.</CardDescription>
            </div>
            <QuickCreate action={createModuleAction.bind(null, course.id)} label="Novo módulo" placeholder="Ex.: Entenda o Negócio" />
          </CardHeader>
          <CardContent>
            {modules.length ? (
              <CourseModulesList courseId={course.id} modules={modules} canEdit />
            ) : (
              <EmptyState icon={Layers} title="Nenhum módulo" description="Adicione o primeiro módulo da trilha." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
