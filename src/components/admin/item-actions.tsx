"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/actions";

export function DuplicateButton({
  action,
  hrefFor,
  label = "Duplicar",
  size = "sm",
}: {
  action: () => Promise<ActionResult<{ id: string }>>;
  hrefFor: (id: string) => string;
  label?: string;
  size?: "sm" | "icon-sm";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          const res = await action();
          if (res.ok && res.data) {
            toast.success(res.message);
            router.push(hrefFor(res.data.id));
          } else if (!res.ok) toast.error(res.error);
        })
      }
    >
      <Copy /> {size === "sm" && label}
    </Button>
  );
}

export function DeleteButton({
  action,
  title,
  description,
  label = "Excluir",
}: {
  action: () => Promise<ActionResult | undefined>;
  title: string;
  description: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm" disabled={pending}>
          <Trash2 /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const res = await action();
                if (res && !res.ok) toast.error(res.error);
              })
            }
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
