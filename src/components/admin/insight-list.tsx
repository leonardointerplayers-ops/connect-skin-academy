import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import type { Insight, InsightSeverity } from "@/lib/analytics/insights";
import { cn } from "@/lib/utils";

const STYLE: Record<InsightSeverity, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: AlertOctagon, className: "text-destructive", label: "Crítico" },
  warning: { icon: AlertTriangle, className: "text-warning-foreground dark:text-warning", label: "Atenção" },
  info: { icon: Info, className: "text-primary", label: "Informação" },
  positive: { icon: CheckCircle2, className: "text-success", label: "Positivo" },
};

export function InsightList({ items, empty = "Nada para destacar no momento." }: { items: Insight[]; empty?: string }) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const s = STYLE[item.severity];
        const body = (
          <div className="flex items-start gap-3 py-3">
            <s.icon className={cn("mt-0.5 size-4 shrink-0", s.className)} aria-label={s.label} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
            </div>
            {item.href && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          </div>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="-mx-2 block rounded-md px-2 hover:bg-muted/60">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
