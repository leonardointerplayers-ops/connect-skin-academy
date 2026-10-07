import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { FilterSelect, Pagination } from "@/components/shared/list-controls";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { APP_CONFIG } from "@/config/app";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION_GROUPS: Record<string, string> = {
  "auth.": "Login / logout / senha",
  "user.": "Colaboradores",
  "course.": "Trilhas",
  "module.": "Módulos",
  "lesson.": "Aulas",
  "material.": "Materiais",
  "exam.": "Provas",
  "question.": "Questões",
  "announcement.": "Comunicados",
  "settings.": "Configurações",
  "report.": "Exportações",
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireAdmin();
  const sp = await searchParams;
  const group = typeof sp.tipo === "string" ? sp.tipo : undefined;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const pageSize = APP_CONFIG.pageSize * 2;
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, entity_type, entity_id, summary, changes, created_at, actor:profiles(full_name)", { count: "exact" });
  if (group && group in ACTION_GROUPS) q = q.like("action", `${group}%`);
  const from = (page - 1) * pageSize;
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  const rows = (data ?? []) as unknown as {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: string | null;
    changes: Record<string, unknown> | null;
    created_at: string;
    actor: { full_name: string } | null;
  }[];

  return (
    <>
      <PageHeader title="Auditoria" description="Quem fez o quê e quando: logins, criações, alterações, exclusões, publicações, uploads, provas e conclusões." />
      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="pb-4">
              <FilterSelect param="tipo" placeholder="Todos os eventos" options={Object.entries(ACTION_GROUPS).map(([value, label]) => ({ value, label }))} />
            </div>
          </Suspense>
          {rows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhum evento registrado" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Quando</TableHead>
                      <TableHead>Quem</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                        <TableCell className="text-sm">{r.actor?.full_name ?? "Sistema"}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.action}</code>
                        </TableCell>
                        <TableCell className="max-w-md">
                          {r.summary && <p className="truncate text-sm">{r.summary}</p>}
                          {r.changes && (
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer">alterações</summary>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{JSON.stringify(r.changes, null, 2)}</pre>
                            </details>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Suspense>
                <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
              </Suspense>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
