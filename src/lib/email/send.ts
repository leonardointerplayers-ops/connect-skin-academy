import "server-only";
import { Resend } from "resend";
import { isEmailConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailContent, EmailTemplateId } from "./templates";

export type EmailStatus = "sent" | "skipped" | "failed";

export interface SendEmailResult {
  status: EmailStatus;
  error?: string;
  id?: string;
}

let resend: Resend | null = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Envia um e-mail via Resend e registra o resultado em email_logs.
 * Se o Resend não estiver configurado, NÃO finge que enviou: retorna
 * status "skipped" e o chamador decide o que mostrar ao usuário.
 */
export async function sendEmail(opts: {
  to: string;
  template: EmailTemplateId;
  content: EmailContent;
  userId?: string | null;
}): Promise<SendEmailResult> {
  let result: SendEmailResult;

  if (!isEmailConfigured()) {
    result = { status: "skipped", error: "RESEND_API_KEY/RESEND_FROM_EMAIL não configurados." };
  } else {
    try {
      const { data, error } = await getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: opts.to,
        subject: opts.content.subject,
        html: opts.content.html,
        text: opts.content.text,
      });
      result = error ? { status: "failed", error: error.message } : { status: "sent", id: data?.id };
    } catch (err) {
      result = { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    await createAdminClient().from("email_logs").insert({
      user_id: opts.userId ?? null,
      to_email: opts.to,
      template: opts.template,
      subject: opts.content.subject,
      status: result.status,
      provider_message_id: result.id ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    console.error("[email] falha ao registrar log", err);
  }

  if (result.status === "failed") console.error("[email] falha no envio", opts.template, result.error);
  return result;
}
