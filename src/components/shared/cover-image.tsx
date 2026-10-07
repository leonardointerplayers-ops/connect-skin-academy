import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { publicStorageUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Capa com fallback elegante (gradiente da marca + número/ícone). */
export function CoverImage({
  bucket,
  path,
  alt,
  className,
  label,
  sizes = "(max-width: 768px) 100vw, 400px",
  priority,
}: {
  bucket: "course-covers" | "module-covers";
  path: string | null | undefined;
  alt: string;
  className?: string;
  label?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const src = publicStorageUrl(bucket, path);
  return (
    <div className={cn("relative overflow-hidden bg-primary", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary via-primary to-[oklch(0.28_0.12_275)]">
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full border-[14px] border-brand-accent/40" />
          {label ? (
            <span className="relative font-serif text-5xl font-bold text-primary-foreground/90">{label}</span>
          ) : (
            <GraduationCap className="relative size-10 text-primary-foreground/80" />
          )}
        </div>
      )}
    </div>
  );
}
