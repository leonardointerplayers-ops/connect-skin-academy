import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { getCourseOutline, getMyCourses } from "@/services/learning";
import { formatPercent } from "@/lib/format";
import { lockLabel } from "@/components/learning/module-card";

export const metadata: Metadata = { title: "Provas" };

export default async function ExamsPage() {
  const courses = await getMyCourses();
  const rows = (
    await Promise.all(
      courses.map(async (c) => (await getCourseOutline(c.id)).filter((m) => m.exam).map((m) => ({ course: c.title, module: m }))),
    )
  ).flat();

  return (
    <>
      <PageHeader title="Provas" description="Avaliações dos módulos. Todas as tentativas ficam registradas no seu histórico." />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma prova pendente." description="As provas aparecem aqui quando os módulos forem publicados." />
      ) : (
        <div className="space-y-3">
          {rows.map(({ module: m }) => {
            const e = m.exam!;
            const locked = m.state !== "unlocked";
            const exhausted = !e.passed && e.max_attempts !== null && e.attempts_used >= e.max_attempts;
            const body = (
              <Card className="py-0 transition-shadow hover:shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${e.passed ? "bg-success/10 text-success" : "bg-secondary text-brand-accent"}`}>
                    {locked ? <Lock className="size-5 text-muted-foreground" /> : e.passed ? <CheckCircle2 className="size-5" /> : <ClipboardCheck className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Módulo {String(m.position).padStart(2, "0")} · {m.title}
                    </p>
                    {locked && <p className="text-xs text-muted-foreground">{lockLabel(m)}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {e.passed ? (
                      <Badge className="bg-success text-success-foreground">Aprovado · {formatPercent(e.best_score)}</Badge>
                    ) : exhausted ? (
                      <Badge variant="destructive">Tentativas esgotadas</Badge>
                    ) : e.attempts_used > 0 ? (
                      <Badge variant="outline">
                        {e.attempts_used}/{e.max_attempts ?? "∞"} · melhor {formatPercent(e.best_score)}
                      </Badge>
                    ) : (
                      !locked && <Badge variant="secondary">Pendente</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            return locked ? (
              <div key={e.id} className="opacity-75">
                {body}
              </div>
            ) : (
              <Link key={e.id} href={`/provas/${e.id}`} className="block">
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
