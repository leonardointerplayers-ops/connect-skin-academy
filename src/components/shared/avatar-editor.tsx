"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/shared/file-uploader";
import { UserAvatarClient } from "@/components/layout/user-avatar-client";
import { updateAvatarAction } from "@/actions/users";

export function AvatarEditor({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-4">
      <UserAvatarClient name={name} src={avatarUrl} className="size-16 text-lg" />
      <div className="flex flex-wrap items-center gap-2">
        <FileUploader
          profile="avatar"
          ownerId={userId}
          compact
          buttonLabel={avatarUrl ? "Trocar foto" : "Enviar foto"}
          onUploaded={async (file) => {
            const res = await updateAvatarAction(userId, file.path);
            if (res.ok) toast.success(res.message);
            else throw new Error(res.error);
          }}
        />
        {avatarUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await updateAvatarAction(userId, null);
                if (res.ok) toast.success("Foto removida.");
                else toast.error(res.error);
              })
            }
          >
            <Trash2 /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
