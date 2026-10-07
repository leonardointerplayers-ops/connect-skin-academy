"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, SubmitButton } from "@/components/shared/form-bits";

export function SetPasswordForm() {
  const [state, action] = useActionState(setPasswordAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
        <FieldError errors={fieldErrors?.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirme a senha</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" />
        <FieldError errors={fieldErrors?.confirm} />
      </div>
      <FormMessage state={state && !state.ok && !state.fieldErrors ? state : null} />
      <SubmitButton className="h-11 w-full" pendingText="Salvando…">
        Salvar senha e acessar
      </SubmitButton>
    </form>
  );
}
