import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-wide.png"
      alt="Connect Skin by NIVEA • Eucerin"
      width={635}
      height={288}
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-lg font-bold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      S
      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand-accent ring-2 ring-background" />
    </span>
  );
}
