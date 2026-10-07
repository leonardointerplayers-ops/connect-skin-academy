import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthLinkType = "invite" | "recovery";

/**
 * Gera um link seguro de convite/recuperação sem disparar o e-mail padrão do
 * Supabase. O link aponta para /auth/confirm (verifyOtp com token_hash), que
 * cria a sessão e leva o usuário a /definir-senha.
 *
 * - "invite": cria o usuário no Auth (o trigger cria o perfil).
 * - "recovery": usuário já existente (reenvio de convite ou "esqueci minha senha").
 */
export async function generateAuthLink(type: AuthLinkType, email: string, metadata?: Record<string, unknown>) {
  const admin = createAdminClient();
  const result =
    type === "invite"
      ? await admin.auth.admin.generateLink({ type: "invite", email, options: { data: metadata } })
      : await admin.auth.admin.generateLink({ type: "recovery", email });

  if (result.error || !result.data?.properties?.hashed_token) {
    return { ok: false as const, error: result.error?.message ?? "Não foi possível gerar o link." };
  }

  const url = new URL("/auth/confirm", publicEnv.appUrl);
  url.searchParams.set("token_hash", result.data.properties.hashed_token);
  url.searchParams.set("type", type);
  url.searchParams.set("next", "/definir-senha");

  return { ok: true as const, url: url.toString(), userId: result.data.user.id };
}
