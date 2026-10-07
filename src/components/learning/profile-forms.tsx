"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { updateOwnProfileAction } from "@/actions/users";
import { changePasswordAction } from "@/actions/auth";

export function OwnProfileForm({ fullName, phone }: { fullName: string; phone: string | null }) {
  const [state, action] = useActionState(updateOwnProfileAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
        <FieldError errors={fe?.full_name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <FieldError errors={fe?.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirme</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        <FieldError errors={fe?.confirm} />
      </div>
      <FormMessage state={state && (state.ok || !state.fieldErrors) ? state : null} />
      <SubmitButton variant="outline" pendingText="Alterando…">
        Alterar senha
      </SubmitButton>
    </form>
  );
}
