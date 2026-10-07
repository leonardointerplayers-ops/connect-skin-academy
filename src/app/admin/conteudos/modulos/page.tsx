import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { listModulesAdmin } from "@/services/content";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Módulos" };

const RELEASE: Record<string, string> = { immediate: "Imediata", date: "Por data", days_after_join: "Após entrada" };

export default async function ModulesAdminPage() {
  const modules = await listModulesAdmin();
  return (
    <>
      <PageHeader title="Módulos" description="Todos os módulos de todas as trilhas. Para criar um módulo, abra a trilha." />
      {modules.length === 0 ? (
        <EmptyState icon={Layers} title="Nenhum módulo" description="Crie módulos dentro de uma trilha." />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Módulo</TableHead>
                  <TableHead>Trilha</TableHead>
                  <TableHead>Aulas</TableHead>
                  <TableHead className="hidden md:table-cell">Liberação</TableHead>
                  <TableHead className="hidden md:table-cell">Prazo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/conteudos/modulos/${m.id}`} className="font-medium hover:underline">
                        {String(m.position).padStart(2, "0")} · {m.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.course.title}</TableCell>
                    <TableCell className="tabular-nums">{m.lessons_count}</TableCell>
                    <TableCell className="hidden md:table-cell">{RELEASE[m.release_type]}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(m.due_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
