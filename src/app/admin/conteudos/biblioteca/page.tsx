import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Library } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { FilterSelect, Pagination, SearchInput } from "@/components/shared/list-controls";
import { MaterialIcon } from "@/components/shared/material-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { LibraryRowActions, LibraryUpload } from "@/components/admin/library-row-actions";
import { listLibrary } from "@/services/materials";
import { MATERIAL_KIND_LABELS, formatBytes, type MaterialKind } from "@/config/uploads";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function LibraryPage({ searchParams }: PageProps<"/admin/conteudos/biblioteca">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const result = await listLibrary({ q: str(sp.q), kind: str(sp.kind), status: str(sp.status), page: Number(str(sp.page) ?? 1) || 1 });

  return (
    <>
      <PageHeader title="Biblioteca de materiais" description="Repositório central de arquivos. Um mesmo material pode ser usado em várias aulas." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="order-2 py-0 xl:order-1">
          <CardContent className="p-4">
            <Suspense>
              <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap">
                <SearchInput placeholder="Buscar por nome" />
                <FilterSelect param="kind" placeholder="Todos os tipos" options={Object.entries(MATERIAL_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
                <FilterSelect param="status" placeholder="Ativos" options={[{ value: "archived", label: "Arquivados" }]} />
              </div>
            </Suspense>
            {result.rows.length === 0 ? (
              <EmptyState icon={Library} title="Nenhum material" description="Envie arquivos ao lado ou anexe-os diretamente nas aulas." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden md:table-cell">Tipo</TableHead>
                        <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                        <TableHead className="hidden lg:table-cell">Módulo / Aula</TableHead>
                        <TableHead className="hidden lg:table-cell">Autor</TableHead>
                        <TableHead className="hidden md:table-cell">Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <MaterialIcon kind={m.kind} className="size-8" />
                              <div className="min-w-0">
                                <p className="max-w-64 truncate font-medium">{m.title}</p>
                                <p className="max-w-64 truncate text-xs text-muted-foreground">{m.file_name ?? m.external_url}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{MATERIAL_KIND_LABELS[m.kind as MaterialKind]}</TableCell>
                          <TableCell className="hidden sm:table-cell tabular-nums">{m.external_url ? "—" : formatBytes(m.size_bytes)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {m.usages.length === 0 ? (
                              <span className="text-muted-foreground">Não utilizado</span>
                            ) : (
                              <div className="space-y-0.5">
                                {m.usages.slice(0, 2).map((u) => (
                                  <Link key={u.lesson_id} href={`/admin/conteudos/aulas/${u.lesson_id}`} className="block max-w-56 truncate text-xs hover:underline">
                                    {u.module_title} › {u.lesson_title}
                                  </Link>
                                ))}
                                {m.usages.length > 2 && <span className="text-xs text-muted-foreground">+{m.usages.length - 2} aula(s)</span>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">{m.uploader?.full_name ?? "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                          <TableCell>
                            <StatusBadge status={m.status === "active" ? "active" : "archived"} />
                          </TableCell>
                          <TableCell>
                            <LibraryRowActions
                              material={{ id: m.id, title: m.title, description: m.description, status: m.status, external_url: m.external_url, usages: m.usages.length }}
                            />
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
        <Card className="order-1 h-fit xl:order-2">
          <CardHeader>
            <CardTitle>Enviar arquivos</CardTitle>
            <CardDescription>PDF, planilhas (XLSX, XLS, CSV), documentos (DOCX), apresentações (PPTX) e ZIP.</CardDescription>
          </CardHeader>
          <CardContent>
            <LibraryUpload />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
