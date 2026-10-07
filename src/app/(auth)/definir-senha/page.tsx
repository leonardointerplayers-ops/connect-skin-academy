import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Definir senha" };

export default async function SetPasswordPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=link");

  const firstAccess = profile.status === "invited";
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">
          {firstAccess ? `Olá, ${profile.full_name.split(" ")[0]} 👋` : "Crie uma nova senha"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {firstAccess
            ? "Para concluir seu acesso à Universidade Corporativa, crie sua senha."
            : `Defina a nova senha da conta ${profile.email}.`}
        </p>
      </div>
      <SetPasswordForm />
    </div>
  );
}
