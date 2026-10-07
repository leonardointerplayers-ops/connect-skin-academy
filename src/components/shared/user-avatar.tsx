import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { publicStorageUrl } from "@/lib/env";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  avatarPath,
  className,
}: {
  name: string | null | undefined;
  avatarPath?: string | null;
  className?: string;
}) {
  const src = publicStorageUrl("avatars", avatarPath);
  return (
    <Avatar className={cn("size-9", className)}>
      {src && <AvatarImage src={src} alt={name ?? ""} className="object-cover" />}
      <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
