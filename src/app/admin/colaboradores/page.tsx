import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { FilterSelect, Pagination, SearchInput } from "@/components/shared/list-controls";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress";
import { HealthBadge } from "@/components/admin/health-badge";
import { listCollaborators, listDepartments, listGroups, listManagers } from "@/services/users";
import { computeHealthScore } from "@/lib/analytics/health";
import { getCurrentProfile } from "@/lib/auth/dal";
import { formatPercent, formatRelative } from "@/lib/format";
import { ROLE_LABELS } from "@/config/app";

export const metadata: Metadata = { title: "Colaboradores" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CollaboratorsPage({ searchParams }: PageProps<"/admin/colaboradores">) {
  const sp = await searchParams;
  const filters = {
    q: str(sp.q),
    status: str(sp.status),
    department: str(sp.department),
    group: str(sp.group),
    role: str(sp.role),
    manager: str(sp.manager),
    page: Number(str(sp.page) ?? 1) || 1,
  };
  const [profile, result, departments, groups, managers] = await Promise.all([
    getCurrentProfile(),
    listCollaborators(filters),
    listDepartments(),
    listGroups(),
    listManagers(),
  ]);
  const isAdmin = profile?.role_id === "admin";
  const managerName = new Map(managers.map((m) => [m.id, m.full_name]));
  const exportQuery = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title={isAdmin ? "Colaboradores" : "Minha equipe"}
        description={isAdmin ? "Cadastro, acesso e acompanhamento individual da equipe." : "Pessoas que se reportam a você (direta ou indiretamente)."}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/export/users?format=xlsx&${exportQuery}`}>
                <Download /> Exportar
              </a>
            </Button>
            {isAdmin && (
              <Button asChild>
                <Link href="/admin/colaboradores/novo">
                  <UserPlus /> Adicionar colaborador
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Card className="py-0">
        <CardContent className="p-4">
          <Suspense>
            <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:flex-wrap">
              <SearchInput placeholder="Nome, e-mail ou cargo" />
              <FilterSelect
                param="status"
                placeholder="Todos os status"
                options={[
                  { value: "active", label: "Ativos" },
                  { value: "invited", label: "Convidados" },
                  { value: "inactive", label: "Inativos" },
                ]}
              />
              <FilterSelect param="department" placeholder="Todos os departamentos" options={departments.map((d) => ({ value: d, label: d }))} />
              <FilterSelect param="group" placeholder="Todos os grupos" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
              <FilterSelect param="role" placeholder="Todos os papéis" options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
              {isAdmin && (
                <FilterSelect
                  param="manager"
                  placeholder="Todos os gestores"
                  options={[{ value: "none", label: "Sem gestor" }, ...managers.map((m) => ({ value: m.id, label: m.full_name }))]}
                />
              )}
            </div>
          </Suspense>

          {result.rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filters.q || filters.status || filters.department || filters.group ? "Nenhum resultado" : "Nenhum colaborador cadastrado"}
              description="Ajuste os filtros ou adicione um colaborador."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="hidden md:table-cell">Departamento</TableHead>
                      <TableHead className="hidden xl:table-cell">Gestor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Progresso</TableHead>
                      <TableHead className="hidden lg:table-cell">Nota média</TableHead>
                      <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
                      <TableHead className="hidden xl:table-cell">Engajamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <Link href={`/admin/colaboradores/${u.user_id}`} className="flex items-center gap-3">
                            <UserAvatar name={u.full_name} avatarPath={u.avatar_path} className="size-8" />
                            <div className="min-w-0">
                              <p className="truncate font-medium hover:underline">{u.full_name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {u.job_title ?? u.email}
                                {u.role_id !== "collaborator" && ` · ${ROLE_LABELS[u.role_id]}`}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{u.department ?? "—"}</TableCell>
                        <TableCell className="hidden xl:table-cell text-muted-foreground">{u.manager_id ? (managerName.get(u.manager_id) ?? "—") : "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ProgressBar value={Number(u.overall_percent)} size="sm" />
                            <span className="w-10 text-right text-xs tabular-nums">{formatPercent(u.overall_percent)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell tabular-nums">{formatPercent(u.avg_best_score)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{formatRelative(u.last_activity_at)}</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {u.role_id === "collaborator" ? <HealthBadge health={computeHealthScore(u)} /> : "—"}
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
