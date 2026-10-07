"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft } from "lucide-react";
import { requestPasswordResetAction } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, SubmitButton } from "@/components/shared/form-bits";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Esqueci minha senha</h2>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail. Enviaremos um link para você criar uma nova senha.
        </p>
      </div>
      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          <FieldError errors={fieldErrors?._ ?? fieldErrors?.email} />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="h-11 w-full" pendingText="Enviando…">
          Enviar link
        </SubmitButton>
      </form>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>
    </div>
  );
}
