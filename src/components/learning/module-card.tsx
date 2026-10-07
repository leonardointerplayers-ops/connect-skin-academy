import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardCheck, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/shared/cover-image";
import { ProgressBar } from "@/components/shared/progress";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OutlineModule } from "@/types/domain";

export function lockLabel(m: Pick<OutlineModule, "state" | "release_at">) {
  if (m.state === "locked_date") return `Liberação em ${formatDateTime(m.release_at)}`;
  if (m.state === "locked_sequence") return "Conclua o módulo anterior para liberar";
  return null;
}

export function ModuleCard({ module: m, index }: { module: OutlineModule; index: number }) {
  const locked = m.state !== "unlocked";
  const done = m.status === "completed";
  const content = (
    <Card className={cn("h-full gap-0 overflow-hidden py-0 transition-shadow", !locked && "hover:shadow-md", locked && "opacity-80")}>
      <div className="relative">
        <CoverImage bucket="module-covers" path={m.thumbnail_path ?? m.cover_path} alt={m.title} className="aspect-[16/7]" label={String(index + 1).padStart(2, "0")} />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
            <span className="flex size-11 items-center justify-center rounded-full bg-background shadow">
              <Lock className="size-5 text-muted-foreground" />
            </span>
          </div>
        )}
        {done && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground">
            <CheckCircle2 className="size-3.5" /> Concluído
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Módulo {String(index + 1).padStart(2, "0")}</p>
          <h3 className="font-semibold leading-snug">{m.title}</h3>
        </div>
        {locked ? (
          <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> {lockLabel(m)}
          </p>
        ) : (
          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {m.lessons_completed}/{m.lessons_total} aulas
                {m.exam && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <ClipboardCheck className="size-3.5" /> {m.exam.passed ? "prova aprovada" : "prova"}
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums text-foreground">{Math.round(m.percent)}%</span>
            </div>
            <ProgressBar value={m.percent} />
            {m.due_date && !done && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" /> Prazo: {formatDate(m.due_date)}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
  return locked ? <div aria-disabled>{content}</div> : <Link href={`/modulos/${m.id}`}>{content}</Link>;
}
