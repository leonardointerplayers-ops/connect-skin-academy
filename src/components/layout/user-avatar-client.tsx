"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatarClient({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      {src && <AvatarImage src={src} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
