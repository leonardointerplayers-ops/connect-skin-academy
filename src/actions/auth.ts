"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema, safeNextPath, setPasswordSchema, signInSchema } from "@/lib/validation/auth";
import { toActionError, type ActionResult } from "@/lib/actions";
import { generateAuthLink } from "@/lib/auth/links";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { isEmailConfigured, publicEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit";

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let next = "/";
  try {
    const input = signInSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next") ?? undefined,
    });
    next = safeNextPath(input.next);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error || !data.user) {
      return { ok: false, error: "E-mail ou senha inválidos." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status, deleted_at")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || profile.status === "inactive" || profile.deleted_at) {
      await supabase.auth.signOut();
      return { ok: false, error: "Seu acesso está desativado. Procure o administrador da plataforma." };
    }
    if (profile.status === "invited") {
      await supabase.rpc("fn_activate_me");
    }
    await logAudit("auth.login", "session", data.user.id, null);
  } catch (err) {
    return toActionError(err);
  }
  redirect(next);
}

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const genericMessage =
    "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos.";
  try {
    const email = emailSchema.parse(formData.get("email"));

    if (isEmailConfigured()) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, status")
        .eq("email", email)
        .is("deleted_at", null)
        .maybeSingle();

      if (profile && profile.status !== "inactive") {
        const link = await generateAuthLink("recovery", email);
        if (link.ok) {
          await sendEmail({
            to: email,
            template: "passwordReset",
            userId: profile.id,
            content: emailTemplates.passwordReset({ name: profile.full_name || email, url: link.url }),
          });
        }
      }
    } else {
      // Sem Resend: usa o e-mail nativo do Supabase (limitado; ver docs/EMAIL.md).
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${publicEnv.appUrl}/auth/confirm?next=/definir-senha`,
      });
    }
    return { ok: true, message: genericMessage };
  } catch (err) {
    const parsed = toActionError(err);
    // Não revela se o e-mail existe; só mostra erro de validação.
    return parsed.fieldErrors ? parsed : { ok: true, message: genericMessage };
  }
}

export async function setPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const input = setPasswordSchema.parse({ password: formData.get("password"), confirm: formData.get("confirm") });
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) {
      return { ok: false, error: "Seu link expirou. Solicite um novo em “Esqueci minha senha”." };
    }
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("different from the old")
          ? "A nova senha precisa ser diferente da anterior."
          : "Não foi possível salvar a senha. Tente novamente.",
      };
    }
    await supabase.rpc("fn_activate_me");
    await logAudit("auth.password_set", "session", claims.claims.sub, null);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/");
}

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const input = setPasswordSchema.parse({ password: formData.get("password"), confirm: formData.get("confirm") });
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("different from the old")
          ? "A nova senha precisa ser diferente da atual."
          : error.message.includes("reauthentication")
            ? "Por segurança, saia e use “Esqueci minha senha” para trocar a senha."
            : "Não foi possível alterar a senha.",
      };
    }
    await logAudit("auth.password_set", "session", claims.claims.sub, null);
    return { ok: true, message: "Senha alterada com sucesso." };
  } catch (err) {
    return toActionError(err);
  }
}
