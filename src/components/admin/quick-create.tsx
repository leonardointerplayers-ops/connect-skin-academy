"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import type { ActionResult } from "@/lib/actions";

/** Diálogo "Novo X" que pede só o título e redireciona para o editor. */
export function QuickCreate({
  action,
  label,
  description,
  placeholder,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  label: string;
  description?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qc-title">Título</Label>
            <Input id="qc-title" name="title" required minLength={2} maxLength={160} placeholder={placeholder} autoFocus />
          </div>
          <FormMessage state={state} />
          <DialogFooter>
            <SubmitButton pendingText="Criando…">Criar e editar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
