import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileQuestion, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect, Pagination, SearchInput } from "@/components/shared/list-controls";
import { listQuestionCategories, listQuestions } from "@/services/exams";
import { listModulesAdmin } from "@/services/content";
import { requireAdmin } from "@/lib/auth/dal";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/config/app";

export const metadata: Metadata = { title: "Banco de questões" };

export default async function QuestionsPage({ searchParams }: PageProps<"/admin/avaliacoes/questoes">) {
  await requireAdmin();
  const sp = await searchParams;
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const [result, categories, modules] = await Promise.all([
    listQuestions({ q: s(sp.q), category: s(sp.category), difficulty: s(sp.difficulty), type: s(sp.type), module: s(sp.module), status: s(sp.status), page: Number(s(sp.page) ?? 1) || 1 }),
    listQuestionCategories(),
    listModulesAdmin(),
  ]);

  return (
    <>
      <PageHeader
        title="Banco de questões"
        description="Questões reutilizáveis entre provas, com categoria, dificuldade, pontuação e explicação."
        actions={
          <Button asChild>
            <Link href="/admin/avaliacoes/questoes/nova">
              <Plus /> Nova questão
            </Link>
          </Button>
        }
      />
      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap">
              <SearchInput placeholder="Texto ou nº da questão" />
              <FilterSelect param="category" placeholder="Todas as categorias" options={categories.map((c) => ({ value: c, label: c }))} />
              <FilterSelect param="difficulty" placeholder="Todas as dificuldades" options={Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }))} />
              <FilterSelect
                param="type"
                placeholder="Todos os tipos"
                options={(["single_choice", "true_false", "multiple_choice"] as const).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
              />
              <FilterSelect param="module" placeholder="Todos os módulos" options={modules.map((m) => ({ value: m.id, label: `${String(m.position).padStart(2, "0")} · ${m.title}` }))} />
            </div>
          </Suspense>
          {result.rows.length === 0 ? (
            <EmptyState icon={FileQuestion} title="Nenhuma questão encontrada" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Nº</TableHead>
                      <TableHead>Pergunta</TableHead>
                      <TableHead className="hidden md:table-cell">Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Dificuldade</TableHead>
                      <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Provas</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">Q-{String(q.number).padStart(3, "0")}</TableCell>
                        <TableCell>
                          <Link href={`/admin/avaliacoes/questoes/${q.id}`} className="line-clamp-2 max-w-xl hover:underline">
                            {q.statement}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{QUESTION_TYPE_LABELS[q.type]}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{q.category ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell tabular-nums">{q.exam_questions.length}</TableCell>
                        <TableCell>
                          <StatusBadge status={q.status} />
                        </TableCell>
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
