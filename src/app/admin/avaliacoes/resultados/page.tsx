import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { FilterSelect, Pagination } from "@/components/shared/list-controls";
import { UserAvatar } from "@/components/shared/user-avatar";
import { listAttempts, listExamsAdmin } from "@/services/exams";
import { formatClock, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultados" };

export default async function ResultsPage({ searchParams }: PageProps<"/admin/avaliacoes/resultados">) {
  const sp = await searchParams;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const [result, exams] = await Promise.all([
    listAttempts({ exam: s(sp.exam), result: s(sp.result), page: Number(s(sp.page) ?? 1) || 1 }),
    listExamsAdmin(),
  ]);

  return (
    <>
      <PageHeader
        title="Resultados"
        description="Todas as tentativas realizadas. Todas são preservadas — nenhuma tentativa é sobrescrita."
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/export/exams?format=xlsx${s(sp.exam) ? `&exam=${s(sp.exam)}` : ""}`}>
              <Download /> Exportar
            </a>
          </Button>
        }
      />
      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="flex flex-col gap-2 pb-4 sm:flex-row">
              <FilterSelect param="exam" placeholder="Todas as provas" options={exams.map((e) => ({ value: e.id, label: e.title }))} />
              <FilterSelect
                param="result"
                placeholder="Todos os resultados"
                options={[
                  { value: "passed", label: "Aprovados" },
                  { value: "failed", label: "Reprovados" },
                ]}
              />
            </div>
          </Suspense>
          {result.rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="Nenhuma tentativa encontrada" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Prova</TableHead>
                      <TableHead>Tentativa</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead className="hidden md:table-cell">Acertos</TableHead>
                      <TableHead className="hidden md:table-cell">Tempo</TableHead>
                      <TableHead className="hidden lg:table-cell">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.profile ? (
                            <Link href={`/admin/colaboradores/${a.profile.id}`} className="flex items-center gap-2">
                              <UserAvatar name={a.profile.full_name} avatarPath={a.profile.avatar_path} className="size-7" />
                              <span className="font-medium hover:underline">{a.profile.full_name}</span>
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.exam?.title}</TableCell>
                        <TableCell className="tabular-nums">{a.attempt_number}ª</TableCell>
                        <TableCell>
                          <Link href={`/admin/avaliacoes/resultados/${a.id}`} className={cn("font-semibold tabular-nums hover:underline", a.passed ? "text-success" : "text-destructive")}>
                            {formatPercent(a.score_percent)}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell tabular-nums">
                          {a.correct_count}/{(a.correct_count ?? 0) + (a.wrong_count ?? 0)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell tabular-nums">{formatClock(a.time_spent_seconds ?? 0)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{formatDateTime(a.submitted_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Suspense>
                <Pagination page={result.page} pageSize={result.pageSize} total={result.total} />
              </Suspense>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
