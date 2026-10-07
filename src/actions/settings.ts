"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, toActionError, type ActionResult } from "@/lib/actions";
import { diff, logAudit } from "@/lib/audit";

const settingsSchema = z.object({
  platform_name: z.string().trim().min(2).max(80),
  company_name: z.string().trim().min(2).max(80),
  ranking_enabled: z.boolean(),
  ranking_criteria: z.enum(["points", "completions", "scores", "streak"]),
  inactivity_alert_days: z.coerce.number().int().min(1).max(90),
  default_video_completion_percent: z.coerce.number().int().min(1).max(100),
  reminder_emails_enabled: z.boolean(),
});

export async function updateSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const input = settingsSchema.parse({
      platform_name: formData.get("platform_name"),
      company_name: formData.get("company_name"),
      ranking_enabled: formData.get("ranking_enabled") === "on",
      ranking_criteria: formData.get("ranking_criteria"),
      inactivity_alert_days: formData.get("inactivity_alert_days"),
      default_video_completion_percent: formData.get("default_video_completion_percent"),
      reminder_emails_enabled: formData.get("reminder_emails_enabled") === "on",
    });
    const supabase = await createClient();
    const { data: before } = await supabase.from("app_settings").select("*").maybeSingle();
    ensure(await supabase.from("app_settings").update({ ...input, updated_by: admin.id, updated_at: new Date().toISOString() }).eq("id", true));
    await logAudit("settings.updated", "settings", "app", null, diff(before, input));
    revalidatePath("/", "layout");
    return { ok: true, message: "Configurações salvas." };
  } catch (err) {
    return toActionError(err);
  }
}

const competencySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
});

export async function saveCompetencyAction(id: string | null, input: z.input<typeof competencySchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const v = competencySchema.parse(input);
    const supabase = await createClient();
    if (id) ensure(await supabase.from("competencies").update(v).eq("id", z.uuid().parse(id)));
    else ensure(await supabase.from("competencies").insert(v));
    await logAudit(id ? "competency.updated" : "competency.created", "competency", id, v.name);
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Competência salva." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCompetencyAction(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    ensure(await supabase.from("competencies").delete().eq("id", z.uuid().parse(id)));
    await logAudit("competency.deleted", "competency", id, null);
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Competência removida." };
  } catch (err) {
    return toActionError(err);
  }
}

const badgeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
  icon: z.string().trim().min(1).max(8),
  rule_value: z.coerce.number().int().min(1).max(10000),
  points: z.coerce.number().int().min(0).max(10000),
  active: z.boolean(),
});

export async function updateBadgeAction(id: string, input: z.input<typeof badgeSchema>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const v = badgeSchema.parse(input);
    const supabase = await createClient();
    ensure(await supabase.from("badges").update(v).eq("id", z.uuid().parse(id)));
    await logAudit("badge.updated", "badge", id, v.name, v);
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Conquista atualizada." };
  } catch (err) {
    return toActionError(err);
  }
}
