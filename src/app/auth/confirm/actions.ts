"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation/auth";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email", "signup", "email_change"];

/**
 * Valida o link de convite/recuperação. Roda só quando a PESSOA clica em
 * "Continuar" (POST) — pré-visualizações de WhatsApp/Teams/antivírus fazem
 * apenas GET e não consomem o token de uso único.
 */
export async function confirmLinkAction(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const code = String(formData.get("code") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""), "/definir-senha");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && OTP_TYPES.includes(type)) {
    // Encerra qualquer sessão anterior neste navegador (ex.: o admin testando o link).
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    if (error) console.error("[auth/confirm] verifyOtp", error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  redirect(ok ? next : "/login?error=link");
}
