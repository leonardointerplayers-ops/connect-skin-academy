"use client";

import Link from "next/link";
import { ChevronRight, ClipboardCheck, FileText, PlayCircle, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { SortableList } from "./sortable-list";
import { DuplicateButton } from "./item-actions";
import { duplicateLessonAction, duplicateModuleAction } from "@/actions/content";

interface ModuleRow {
  id: string;
  title: string;
  position: number;
  status: string;
  lessons_count: number;
  release_type: string;
  exam: { id: string; status: string } | null;
}

const RELEASE_LABEL: Record<string, string> = {
  immediate: "Liberação imediata",
  date: "Liberação por data",
  days_after_join: "Liberação após entrada",
};

export function CourseModulesList({ courseId, modules, canEdit }: { courseId: string; modules: ModuleRow[]; canEdit: boolean }) {
  return (
    <SortableList
      items={modules}
      kind="modules"
      parentId={courseId}
      disabled={!canEdit}
      render={(m, i) => (
        <div className="flex items-center gap-3 py-2.5 pr-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Link href={`/admin/conteudos/modulos/${m.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium hover:underline">{m.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {m.lessons_count} aula(s) · {RELEASE_LABEL[m.release_type]}
              {m.exam ? " · com prova" : " · sem prova"}
            </p>
          </Link>
          <StatusBadge status={m.status} className="hidden sm:inline-flex" />
          {canEdit && (
            <DuplicateButton
              size="icon-sm"
              label="Duplicar módulo"
              action={() => duplicateModuleAction(m.id)}
              hrefFor={(id) => `/admin/conteudos/modulos/${id}`}
            />
          )}
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      )}
    />
  );
}

interface LessonRow {
  id: string;
  title: string;
  status: string;
  is_required: boolean;
  video_id: string | null;
  activity_enabled: boolean;
  materials_count: number;
  estimated_minutes: number | null;
}

export function ModuleLessonsList({ moduleId, lessons, canEdit }: { moduleId: string; lessons: LessonRow[]; canEdit: boolean }) {
  return (
    <SortableList
      items={lessons}
      kind="lessons"
      parentId={moduleId}
      disabled={!canEdit}
      render={(l, i) => (
        <div className="flex items-center gap-3 py-2.5 pr-2">
          <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
          <Link href={`/admin/conteudos/aulas/${l.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium hover:underline">{l.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {l.video_id && (
                <span className="inline-flex items-center gap-1">
                  <PlayCircle className="size-3.5" /> vídeo
                </span>
              )}
              {l.materials_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3.5" /> {l.materials_count} material(is)
                </span>
              )}
              {l.activity_enabled && (
                <span className="inline-flex items-center gap-1">
                  <PenLine className="size-3.5" /> atividade
                </span>
              )}
              {l.estimated_minutes && <span>{l.estimated_minutes} min</span>}
            </div>
          </Link>
          {!l.is_required && <Badge variant="outline">Opcional</Badge>}
          <StatusBadge status={l.status} className="hidden sm:inline-flex" />
          {canEdit && (
            <DuplicateButton size="icon-sm" label="Duplicar aula" action={() => duplicateLessonAction(l.id)} hrefFor={(id) => `/admin/conteudos/aulas/${id}`} />
          )}
        </div>
      )}
    />
  );
}

export function ExamSummaryLink({ exam }: { exam: { id: string; title: string; status: string; questions: number } }) {
  return (
    <Link href={`/admin/avaliacoes/provas/${exam.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
      <ClipboardCheck className="size-5 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{exam.title}</p>
        <p className="text-xs text-muted-foreground">{exam.questions} questão(ões) vinculada(s)</p>
      </div>
      <StatusBadge status={exam.status} />
    </Link>
  );
}
