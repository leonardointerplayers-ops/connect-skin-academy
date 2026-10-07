import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { ProgressBar } from "@/components/shared/progress";
import { getModuleStats } from "@/services/analytics";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios" };

const EXPORTS = [
  { id: "users", title: "Usuários", description: "Cadastro, acesso, progresso, notas e Learning Health." },
  { id: "progress", title: "Progresso", description: "Progresso por colaborador × módulo." },
  { id: "grades", title: "Notas", description: "Melhor nota e tentativas por colaborador × prova." },
  { id: "exams", title: "Provas", description: "Todas as tentativas (histórico completo)." },
  { id: "completions", title: "Conclusões", description: "Conclusão de trilhas e certificados." },
];

export default async function ReportsPage() {
  const modules = await getModuleStats();
  return (
    <>
      <PageHeader title="Relatórios" description="Relatórios por módulo, por questão e exportações em CSV/Excel." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatório por módulo</CardTitle>
            <CardDescription>Quem concluiu, quem está pendente, notas, aprovação e questões com mais erros.</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <ul className="divide-y">
              {modules.map((m) => (
                <li key={m.module_id}>
                  <Link href={`/admin/relatorios/modulos/${m.module_id}`} className="flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-muted/50">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate text-sm font-medium">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={Number(m.enrolled) ? (Number(m.completed) / Number(m.enrolled)) * 100 : 0} size="sm" />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {m.completed}/{m.enrolled}
                        </span>
                      </div>
                    </div>
                    <div className="hidden w-40 text-right text-xs text-muted-foreground sm:block">
                      Aprovação {formatPercent(m.approval_rate)}
                      <br />
                      Nota média {formatPercent(m.avg_best_score)}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Relatório por questão</CardTitle>
              <CardDescription>Total de respostas, acertos, erros e % de acerto de cada questão.</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/relatorios/questoes">Abrir</Link>
            </Button>
          </CardHeader>
        </Card>

        <div>
          <h2 className="mb-3 font-semibold">Exportações</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {EXPORTS.map((e) => (
              <Card key={e.id} className="py-0">
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/export/${e.id}?format=xlsx`}>
                        <FileSpreadsheet /> Excel
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/api/export/${e.id}?format=csv`}>
                        <FileText /> CSV
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
