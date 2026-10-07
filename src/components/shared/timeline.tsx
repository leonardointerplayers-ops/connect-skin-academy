import { Award, BookCheck, CircleX, GraduationCap, Layers, Trophy } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/services/users";

const ICONS = {
  lesson: { icon: BookCheck, className: "bg-secondary text-secondary-foreground" },
  module: { icon: Layers, className: "bg-primary text-primary-foreground" },
  exam_passed: { icon: Trophy, className: "bg-success/15 text-success" },
  exam_failed: { icon: CircleX, className: "bg-destructive/10 text-destructive" },
  course: { icon: GraduationCap, className: "bg-brand-accent text-brand-accent-foreground" },
  badge: { icon: Award, className: "bg-warning/20 text-warning-foreground" },
  joined: { icon: BookCheck, className: "bg-muted text-muted-foreground" },
} as const;

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {events.map((e, i) => {
        const s = ICONS[e.kind];
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3">
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", s.className)}>
              <s.icon className="size-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
              <p className="text-sm font-medium">{e.title}</p>
              {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
