import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { isEmailConfigured, publicEnv } from "@/lib/env";

/** IDs dos colaboradores matriculados (ativos) em uma trilha. */
export async function enrolledUserIds(courseId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("enrollments").select("user_id").eq("course_id", courseId).eq("status", "active");
  return (data ?? []).map((r) => r.user_id as string);
}

/** Cria notificações internas para vários usuários (admin via RLS). */
export async function notifyUsers(
  userIds: string[],
  n: { type: string; title: string; body?: string | null; link?: string | null },
) {
  if (!userIds.length) return;
  const supabase = await createClient();
  const rows = userIds.map((user_id) => ({ user_id, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null }));
  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("notifications").insert(rows.slice(i, i + 500));
  }
}

/** Envia e-mail de "novo módulo" depois da resposta (não bloqueia o admin). */
export function emailNewModuleLater(userIds: string[], moduleTitle: string, moduleId: string) {
  if (!userIds.length || !isEmailConfigured()) return;
  after(async () => {
    const admin = createAdminClient();
    const { data: people } = await admin
      .from("profiles")
      .select("id, email, full_name, status")
      .in("id", userIds)
      .eq("status", "active");
    for (const p of people ?? []) {
      await sendEmail({
        to: p.email as string,
        template: "newModule",
        userId: p.id as string,
        content: emailTemplates.newModule({
          name: (p.full_name as string) || (p.email as string),
          moduleTitle,
          url: `${publicEnv.appUrl}/modulos/${moduleId}`,
        }),
      });
    }
  });
}
