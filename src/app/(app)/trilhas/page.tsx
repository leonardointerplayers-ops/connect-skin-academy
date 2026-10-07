import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { CoverImage } from "@/components/shared/cover-image";
import { ProgressBar } from "@/components/shared/progress";
import { getMyCourses } from "@/services/learning";
import { formatDate, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Minha trilha" };

export default async function CoursesPage({ searchParams }: PageProps<"/trilhas">) {
  const [courses, sp] = await Promise.all([getMyCourses(), searchParams]);
  if (courses.length === 1 && !sp.bloqueado) redirect(`/trilhas/${courses[0].id}`);

  return (
    <>
      <PageHeader title="Minhas trilhas" description="Programas de formação disponíveis para você." />
      {sp.bloqueado && (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Esse conteúdo ainda não está liberado para você. Siga a ordem da trilha.
        </p>
      )}
      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Você ainda não possui nenhum curso." description="Assim que uma trilha for liberada para você, ela aparecerá aqui." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c, i) => (
            <Link key={c.id} href={`/trilhas/${c.id}`}>
              <Card className="h-full gap-0 overflow-hidden py-0 hover:shadow-md">
                <CoverImage bucket="course-covers" path={c.cover_path} alt={c.title} className="aspect-[16/8]" label={String(i + 1).padStart(2, "0")} />
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="font-semibold">{c.title}</h3>
                    {c.subtitle && <p className="text-sm text-muted-foreground">{c.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={Number(c.progress?.percent ?? 0)} />
                    <span className="text-xs font-semibold tabular-nums">{formatPercent(c.progress?.percent ?? 0)}</span>
                  </div>
                  {c.due_date && c.progress?.status !== "completed" && <p className="text-xs text-muted-foreground">Prazo: {formatDate(c.due_date)}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
