import { File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Link2, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP = {
  pdf: { icon: FileText, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  spreadsheet: { icon: FileSpreadsheet, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  document: { icon: FileText, className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  presentation: { icon: Presentation, className: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  archive: { icon: FileArchive, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  image: { icon: FileImage, className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  video: { icon: FileVideo, className: "bg-secondary text-secondary-foreground" },
  link: { icon: Link2, className: "bg-secondary text-secondary-foreground" },
  other: { icon: File, className: "bg-muted text-muted-foreground" },
} as const;

export function MaterialIcon({ kind, className }: { kind: string; className?: string }) {
  const m = MAP[kind as keyof typeof MAP] ?? MAP.other;
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", m.className, className)}>
      <m.icon className="size-4.5" />
    </span>
  );
}
