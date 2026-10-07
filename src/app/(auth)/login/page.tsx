import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  link: "O link é inválido ou expirou. Solicite um novo.",
  inactive: "Seu acesso está desativado. Procure o administrador da plataforma.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h2>
        <p className="text-sm text-muted-foreground">Entre com o e-mail e a senha cadastrados.</p>
      </div>
      {!isSupabaseConfigured() && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          Supabase ainda não configurado. Preencha <code>.env.local</code> conforme <code>docs/SETUP.md</code>.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      <LoginForm next={next} />
      <p className="text-center text-xs text-muted-foreground">
        O acesso é feito por convite. Não recebeu? Fale com o administrador.
      </p>
    </div>
  );
}
