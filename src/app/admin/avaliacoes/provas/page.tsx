import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { listExamsAdmin } from "@/services/exams";
import { requireAdmin } from "@/lib/auth/dal";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Provas" };

export default async function ExamsAdminPage() {
  await requireAdmin();
  const exams = await listExamsAdmin();
  return (
    <>
      <PageHeader
        title="Provas"
        description="Uma prova por módulo. Configure nota mínima, tentativas, tempo, randomização e feedback."
        actions={
          <Button asChild>
            <Link href="/admin/avaliacoes/provas/nova">
              <Plus /> Nova prova
            </Link>
          </Button>
        }
      />
      {exams.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma prova criada" />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Prova</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Questões</TableHead>
                  <TableHead className="hidden md:table-cell">Nota mín.</TableHead>
                  <TableHead className="hidden md:table-cell">Realizaram</TableHead>
                  <TableHead className="hidden lg:table-cell">Aprovação</TableHead>
                  <TableHead className="hidden lg:table-cell">Nota média</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/avaliacoes/provas/${e.id}`} className="font-medium hover:underline">
                        {e.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {e.selection_mode === "random" ? `Dinâmica · sorteia ${e.question_count}` : "Fixa"}
                        {e.is_required ? " · obrigatória" : " · opcional"}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {String(e.module.position).padStart(2, "0")} · {e.module.title}
                    </TableCell>
                    <TableCell className="tabular-nums">{e.questions}</TableCell>
                    <TableCell className="hidden md:table-cell">{e.passing_score}%</TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">{e.usersAttempted}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.usersAttempted ? formatPercent((e.usersPassed / e.usersAttempted) * 100) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatPercent(e.avgScore)}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
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
