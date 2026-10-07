import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { LessonForm } from "@/components/admin/lesson-form";
import { VideoManager } from "@/components/admin/video-manager";
import { LessonMaterials } from "@/components/admin/lesson-materials";
import { DeleteButton, DuplicateButton } from "@/components/admin/item-actions";
import { getLessonAdmin } from "@/services/content";
import { deleteLessonAction, duplicateLessonAction } from "@/actions/content";
import { UPLOAD_PROFILES } from "@/config/uploads";

export const metadata: Metadata = { title: "Editar aula" };

export default async function LessonEditorPage({ params }: PageProps<"/admin/conteudos/aulas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getLessonAdmin(id);
  if (!data) notFound();
  const { lesson, materials } = data;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/conteudos/modulos/${lesson.module.id}`, label: lesson.module.title }}
        eyebrow="Aula"
        title={lesson.title}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/aulas/${lesson.id}`} target="_blank">
                <Eye /> Visualizar
              </Link>
            </Button>
            <DuplicateButton action={duplicateLessonAction.bind(null, lesson.id)} hrefPrefix="/admin/conteudos/aulas/" />
            <DeleteButton
              action={deleteLessonAction.bind(null, lesson.id)}
              title="Excluir esta aula?"
              description="A aula sai do ar. O progresso já registrado pelos colaboradores é preservado no histórico."
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <CardContent>
            <LessonForm lesson={lesson} hasVideo={Boolean(lesson.video_id)} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vídeo</CardTitle>
              <CardDescription>Upload, YouTube ou URL externa.</CardDescription>
            </CardHeader>
            <CardContent>
              <VideoManager lessonId={lesson.id} video={lesson.video && !("deleted_at" in lesson.video && lesson.video.deleted_at) ? lesson.video : null} maxUploadLabel={UPLOAD_PROFILES.video.label} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Materiais</CardTitle>
              <CardDescription>Arraste para ordenar. Os arquivos ficam na biblioteca e podem ser reutilizados.</CardDescription>
            </CardHeader>
            <CardContent>
              <LessonMaterials lessonId={lesson.id} materials={materials} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
