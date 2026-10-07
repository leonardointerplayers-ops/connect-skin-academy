import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { CoverImage } from "@/components/shared/cover-image";
import { QuickCreate } from "@/components/admin/quick-create";
import { listCoursesAdmin } from "@/services/content";
import { createCourseAction } from "@/actions/content";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Trilhas" };

export default async function CoursesAdminPage() {
  const courses = await listCoursesAdmin();
  return (
    <>
      <PageHeader
        title="Trilhas"
        description="Programas de formação. Cada trilha reúne módulos, aulas e provas."
        actions={<QuickCreate action={createCourseAction} label="Nova trilha" placeholder="Ex.: Onboarding Connect Skin" />}
      />
      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhuma trilha criada" description="Crie a primeira trilha para organizar os módulos." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c, i) => (
            <Link key={c.id} href={`/admin/conteudos/trilhas/${c.id}`} className="group">
              <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
                <CoverImage bucket="course-covers" path={c.thumbnail_path ?? c.cover_path} alt={c.title} className="aspect-[16/8]" label={String(i + 1).padStart(2, "0")} />
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug group-hover:underline">{c.title}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{c.subtitle}</p>}
                  <p className="text-xs text-muted-foreground">
                    {c.modules_count} módulo(s) · atualizada {formatRelative(c.updated_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
