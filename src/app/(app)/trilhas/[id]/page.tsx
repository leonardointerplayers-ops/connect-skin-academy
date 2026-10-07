import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Clock, GraduationCap, ListOrdered } from "lucide-react";
import { ModuleCard } from "@/components/learning/module-card";
import { ProgressRing } from "@/components/shared/progress";
import { CoverImage } from "@/components/shared/cover-image";
import { getCourseOutline, getMyCourses } from "@/services/learning";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Trilha" };

export default async function CoursePage({ params }: PageProps<"/trilhas/[id]">) {
  const { id } = await params;
  const courses = await getMyCourses();
  const course = courses.find((c) => c.id === id);
  if (!course) notFound();
  const outline = await getCourseOutline(id);
  const percent = Number(course.progress?.percent ?? 0);

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-primary text-primary-foreground">
        {course.cover_path && (
          <div className="absolute inset-0 opacity-25">
            <CoverImage bucket="course-covers" path={course.cover_path} alt="" className="size-full" sizes="100vw" />
          </div>
        )}
        <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full border-[22px] border-brand-accent/40" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">Trilha de formação</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
            {course.description && <p className="text-sm leading-relaxed text-primary-foreground/80">{course.description}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-primary-foreground/80">
              <span className="inline-flex items-center gap-1.5">
                <ListOrdered className="size-3.5" /> {outline.length} módulos
              </span>
              {course.workload_hours && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {Number(course.workload_hours)}h
                </span>
              )}
              {course.require_sequential && <span>Conclusão sequencial</span>}
              {course.certificate_enabled && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" /> Certificado ao concluir
                </span>
              )}
              {course.due_date && course.progress?.status !== "completed" && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" /> Prazo {formatDate(course.due_date)}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 self-center rounded-2xl bg-background p-3 text-foreground">
            <ProgressRing value={percent} size={112}>
              <span className="text-2xl font-semibold tabular-nums">{Math.round(percent)}%</span>
              <span className="text-[11px] text-muted-foreground">concluído</span>
            </ProgressRing>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {outline.map((m, i) => (
          <ModuleCard key={m.id} module={m} index={i} />
        ))}
      </div>
    </>
  );
}
