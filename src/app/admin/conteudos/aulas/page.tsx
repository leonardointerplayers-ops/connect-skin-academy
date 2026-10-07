import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect, SearchInput } from "@/components/shared/list-controls";
import { listLessonsAdmin, listModulesAdmin } from "@/services/content";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Aulas" };

export default async function LessonsAdminPage({ searchParams }: PageProps<"/admin/conteudos/aulas">) {
  const sp = await searchParams;
  const moduleId = typeof sp.modulo === "string" ? sp.modulo : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [lessons, modules] = await Promise.all([listLessonsAdmin({ moduleId, q }), listModulesAdmin()]);

  return (
    <>
      <PageHeader title="Aulas" description="Todas as aulas. Para criar uma aula, abra o módulo." />
      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="flex flex-col gap-2 pb-4 sm:flex-row">
              <SearchInput placeholder="Buscar aula" />
              <FilterSelect
                param="modulo"
                placeholder="Todos os módulos"
                options={modules.map((m) => ({ value: m.id, label: `${String(m.position).padStart(2, "0")} · ${m.title}` }))}
              />
            </div>
          </Suspense>
          {lessons.length === 0 ? (
            <EmptyState icon={PlayCircle} title="Nenhuma aula encontrada" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aula</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="hidden md:table-cell">Vídeo</TableHead>
                    <TableHead className="hidden md:table-cell">Atualizada</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessons.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Link href={`/admin/conteudos/aulas/${l.id}`} className="font-medium hover:underline">
                          {l.title}
                        </Link>
                        {!l.is_required && (
                          <Badge variant="outline" className="ml-2">
                            Opcional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {String(l.module.position).padStart(2, "0")} · {l.module.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{l.video_id ? "Sim" : "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{formatRelative(l.updated_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
