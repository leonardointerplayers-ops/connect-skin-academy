"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, ensureOne, toActionError, type ActionResult } from "@/lib/actions";
import { diff, logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { isEmailConfigured, publicEnv } from "@/lib/env";
import { notifyUsers } from "@/lib/notify";

const uuid = z.uuid();

const announcementSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(160),
  body: z.string().trim().min(2, "Escreva a mensagem.").max(5000),
  image_path: z.string().max(500).optional().nullable().transform((v) => v || null),
  link_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || v.startsWith("/") || /^https?:\/\//.test(v), "Use um link https:// ou um caminho interno (/trilhas)."),
  link_label: z.string().trim().max(60).optional().nullable().transform((v) => v || null),
  priority: z.enum(["low", "normal", "high"]),
  status: z.enum(["draft", "published", "archived"]),
  show_banner: z.boolean(),
  publish_at: z.string().optional().nullable().transform((v) => (v ? new Date(v.length <= 16 ? `${v}:00-03:00` : v).toISOString() : new Date().toISOString())),
  expires_at: z.string().optional().nullable().transform((v) => (v ? new Date(v.length <= 16 ? `${v}:00-03:00` : v).toISOString() : null)),
});

export async function saveAnnouncementAction(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const input = announcementSchema.parse({
      title: formData.get("title"),
      body: formData.get("body"),
      image_path: formData.get("image_path"),
      link_url: formData.get("link_url"),
      link_label: formData.get("link_label"),
      priority: formData.get("priority"),
      status: formData.get("status"),
      show_banner: formData.get("show_banner") === "on",
      publish_at: formData.get("publish_at"),
      expires_at: formData.get("expires_at"),
    });
    const supabase = await createClient();
    if (id) {
      const aid = uuid.parse(id);
      const { data: before } = await supabase.from("announcements").select("*").eq("id", aid).single();
      ensure(await supabase.from("announcements").update(input).eq("id", aid));
      await logAudit(input.status === "published" && before?.status !== "published" ? "announcement.published" : "announcement.updated", "announcement", aid, input.title, diff(before, input));
    } else {
      const created = ensureOne(await supabase.from("announcements").insert({ ...input, created_by: admin.id }).select("id").single());
      await logAudit("announcement.created", "announcement", created.id, input.title);
    }
    revalidatePath("/admin/comunicacao");
    revalidatePath("/comunicados");
    revalidatePath("/inicio");
    return { ok: true, message: "Comunicado salvo." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const aid = uuid.parse(id);
    const supabase = await createClient();
    ensure(await supabase.from("announcements").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", aid));
    await logAudit("announcement.deleted", "announcement", aid, null);
    revalidatePath("/admin/comunicacao");
    revalidatePath("/comunicados");
    revalidatePath("/inicio");
    return { ok: true, message: "Comunicado removido." };
  } catch (err) {
    return toActionError(err);
  }
}

/** Dispara notificação interna (e opcionalmente e-mail) de um comunicado. */
export async function broadcastAnnouncementAction(id: string, opts: { groupId?: string | null; email: boolean }): Promise<ActionResult> {
  try {
    await assertAdmin();
    const aid = uuid.parse(id);
    const supabase = await createClient();
    const { data: a } = await supabase.from("announcements").select("*").eq("id", aid).single();
    if (!a || a.status !== "published") return { ok: false, error: "Publique o comunicado antes de enviar." };

    let q = supabase.from("profiles").select("id, email, full_name").eq("status", "active").is("deleted_at", null);
    if (opts.groupId) {
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", uuid.parse(opts.groupId));
      q = q.in("id", (members ?? []).map((m) => m.user_id as string).concat("00000000-0000-0000-0000-000000000000"));
    }
    const { data: people } = await q;
    const list = (people ?? []) as { id: string; email: string; full_name: string }[];
    await notifyUsers(
      list.map((p) => p.id),
      { type: "announcement", title: `📢 ${a.title}`, body: a.body.slice(0, 200), link: "/comunicados" },
    );

    let emailNote = "";
    if (opts.email) {
      if (!isEmailConfigured()) {
        emailNote = " E-mails NÃO enviados: Resend não configurado.";
      } else {
        after(async () => {
          for (const p of list) {
            await sendEmail({
              to: p.email,
              template: "announcement",
              userId: p.id,
              content: emailTemplates.announcement({ title: a.title, body: a.body, url: `${publicEnv.appUrl}/comunicados` }),
            });
          }
        });
        emailNote = ` E-mails sendo enviados para ${list.length} pessoa(s).`;
      }
    }
    await logAudit("announcement.broadcast", "announcement", aid, a.title, { recipients: list.length, email: opts.email });
    return { ok: true, message: `Notificação enviada para ${list.length} colaborador(es).${emailNote}` };
  } catch (err) {
    return toActionError(err);
  }
}

/** Envia um e-mail de teste para o próprio administrador (valida a configuração do Resend). */
export async function sendTestEmailAction(): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    if (!isEmailConfigured()) return { ok: false, error: "RESEND_API_KEY e RESEND_FROM_EMAIL não estão configurados no servidor." };
    const res = await sendEmail({
      to: admin.email,
      template: "announcement",
      userId: admin.id,
      content: emailTemplates.announcement({
        title: "Teste de e-mail",
        body: "Se você recebeu esta mensagem, o envio de e-mails da Connect Skin Academy está funcionando.",
        url: publicEnv.appUrl,
      }),
    });
    return res.status === "sent" ? { ok: true, message: `E-mail de teste enviado para ${admin.email}.` } : { ok: false, error: `Falha no envio: ${res.error}` };
  } catch (err) {
    return toActionError(err);
  }
}
