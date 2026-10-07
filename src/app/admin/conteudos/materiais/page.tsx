import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { MaterialIcon } from "@/components/shared/material-icon";
import { listLessonMaterialLinks } from "@/services/materials";
import { formatBytes } from "@/config/uploads";

export const metadata: Metadata = { title: "Materiais por aula" };

export default async function MaterialsByLessonPage() {
  const links = await listLessonMaterialLinks();
  const byModule = new Map<string, { position: number; lessons: Map<string, { id: string; title: string; items: typeof links }> }>();
  for (const l of links) {
    const moduleTitle = l.lesson.module?.title ?? "Sem módulo";
    const mod = byModule.get(moduleTitle) ?? { position: l.lesson.module?.position ?? 99, lessons: new Map() };
    const lesson = mod.lessons.get(l.lesson.id) ?? { id: l.lesson.id, title: l.lesson.title, items: [] };
    lesson.items.push(l);
    mod.lessons.set(l.lesson.id, lesson);
    byModule.set(moduleTitle, mod);
  }
  const modules = [...byModule.entries()].sort((a, b) => a[1].position - b[1].position);

  return (
    <>
      <PageHeader
        title="Materiais por aula"
        description="Visão dos materiais anexados em cada aula. Para anexar, abra a aula; para gerenciar arquivos, use a Biblioteca."
      />
      {modules.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum material anexado" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {modules.map(([title, mod]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-base">
                  {String(mod.position).padStart(2, "0")} · {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...mod.lessons.values()].map((lesson) => (
                  <div key={lesson.id} className="space-y-2">
                    <Link href={`/admin/conteudos/aulas/${lesson.id}`} className="text-sm font-medium hover:underline">
                      {lesson.title}
                    </Link>
                    <ul className="space-y-1.5">
                      {lesson.items
                        .sort((a, b) => a.position - b.position)
                        .map((i) => (
                          <li key={i.material.id} className="flex items-center gap-2 text-sm">
                            <MaterialIcon kind={i.material.kind} className="size-7" />
                            <span className="min-w-0 flex-1 truncate">{i.material.title}</span>
                            <span className="text-xs text-muted-foreground">{formatBytes(i.material.size_bytes)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
