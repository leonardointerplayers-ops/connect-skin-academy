"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MailPlus, UserCheck, UserX } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resendInviteAction, setCollaboratorStatusAction } from "@/actions/users";
import { CopyLink } from "./collaborator-form";

export function CollaboratorActions({ userId, status, isSelf }: { userId: string; status: string; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "inactive" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await resendInviteAction(userId);
              if (!res.ok) return void toast.error(res.error);
              if (res.data?.inviteUrl) {
                setLink(res.data.inviteUrl);
                toast.warning(res.message);
              } else toast.success(res.message);
            })
          }
        >
          <MailPlus /> {status === "invited" ? "Reenviar convite" : "Enviar link de nova senha"}
        </Button>
      )}
      {!isSelf &&
        (status === "inactive" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setCollaboratorStatusAction(userId, "active");
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            <UserCheck /> Reativar acesso
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={pending}>
                <UserX /> Desativar acesso
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desativar o acesso deste colaborador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ele não conseguirá mais entrar na plataforma. Todo o histórico de progresso, provas e certificados é
                  preservado e o acesso pode ser reativado a qualquer momento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setCollaboratorStatusAction(userId, "inactive");
                      if (res.ok) toast.success(res.message);
                      else toast.error(res.error);
                    })
                  }
                >
                  Desativar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}

      <Dialog open={Boolean(link)} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de acesso</DialogTitle>
            <DialogDescription>
              O e-mail não foi enviado (Resend não configurado ou falhou). Envie este link ao colaborador por um canal
              seguro. Ele expira em 1 hora.
            </DialogDescription>
          </DialogHeader>
          {link && <CopyLink url={link} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
