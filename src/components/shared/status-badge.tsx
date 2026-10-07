import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/config/app";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  published: "bg-success/12 text-success border-success/25",
  active: "bg-success/12 text-success border-success/25",
  draft: "bg-muted text-muted-foreground border-border",
  invited: "bg-secondary text-secondary-foreground border-primary/20",
  archived: "bg-muted text-muted-foreground border-border line-through decoration-1",
  inactive: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONES[status], className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
