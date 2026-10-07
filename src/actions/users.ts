"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, ensureOne, toActionError, type ActionResult } from "@/lib/actions";
import { collaboratorSchema, collaboratorUpdateSchema, groupSchema, ownProfileSchema } from "@/lib/validation/users";
import { generateAuthLink } from "@/lib/auth/links";
import { sendEmail, type EmailStatus } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { diff, logAudit } from "@/lib/audit";
import { assertObjectExists, removeObjects } from "@/lib/storage/server";

function parseCollaboratorForm(formData: FormData) {
  return {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    job_title: formData.get("job_title") ?? undefined,
    department: formData.get("department") ?? undefined,
    area: formData.get("area") ?? undefined,
    company: formData.get("company") ?? undefined,
    role_id: formData.get("role_id") ?? undefined,
    joined_at: formData.get("joined_at") ?? undefined,
    status: formData.get("status") ?? undefined,
    group_ids: formData.getAll("group_ids").map(String).filter(Boolean),
  };
}

async function syncGroups(userId: string, groupIds: string[]) {
  const supabase = await createClient();
  ensure(await supabase.from("group_members").delete().eq("user_id", userId));
  if (groupIds.length) {
    ensure(await supabase.from("group_members").insert(groupIds.map((group_id) => ({ group_id, user_id: userId }))));
  }
  // Trilhas restritas a grupos: matricula conforme novos grupos.
  await supabase.rpc("fn_admin_sync_enrollments");
}

export interface InviteResult {
  userId: string;
  emailStatus: EmailStatus;
  inviteUrl?: string;
}

export async function inviteCollaboratorAction(
  _prev: ActionResult<Partial<InviteResult>> | null,
  formData: FormData,
): Promise<ActionResult<Partial<InviteResult>>> {
  try {
    await assertAdmin();
    const input = collaboratorSchema.parse(parseCollaboratorForm(formData));
    const supabase = await createClient();

    const { data: existing } = await supabase.from("profiles").select("id").eq("email", input.email).maybeSingle();
    if (existing) return { ok: false, error: "Já existe um usuário com este e-mail.", fieldErrors: { email: ["E-mail já cadastrado."] } };

    const link = await generateAuthLink("invite", input.email, { full_name: input.full_name });
    if (!link.ok) {
      return { ok: false, error: `Não foi possível criar o usuário no Supabase Auth: ${link.error}` };
    }

    ensure(
      await supabase
        .from("profiles")
        .update({
          full_name: input.full_name,
          phone: input.phone,
          job_title: input.job_title,
          department: input.department,
          area: input.area,
          company: input.company,
          role_id: input.role_id,
          ...(input.joined_at ? { joined_at: input.joined_at } : {}),
          invited_at: new Date().toISOString(),
        })
        .eq("id", link.userId),
    );
    await syncGroups(link.userId, input.group_ids);

    const email = await sendEmail({
      to: input.email,
      template: "invite",
      userId: link.userId,
      content: emailTemplates.invite({ name: input.full_name, url: link.url }),
    });

    await logAudit("user.invited", "profile", link.userId, input.full_name, { email: input.email, role: input.role_id, email_status: email.status });
    revalidatePath("/admin/colaboradores");

    return {
      ok: true,
      data: { userId: link.userId, emailStatus: email.status, inviteUrl: email.status === "sent" ? undefined : link.url },
      message:
        email.status === "sent"
          ? `Convite enviado para ${input.email}.`
          : "Usuário criado, mas o e-mail NÃO foi enviado. Copie o link abaixo e envie manualmente.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCollaboratorAction(
  userId: string,
  _prev: ActionResult<Partial<InviteResult>> | null,
  formData: FormData,
): Promise<ActionResult<Partial<InviteResult>>> {
  try {
    const admin = await assertAdmin();
    const id = z.uuid().parse(userId);
    const input = collaboratorUpdateSchema.parse(parseCollaboratorForm(formData));
    if (id === admin.id && input.role_id !== "admin") {
      return { ok: false, error: "Você não pode remover o seu próprio acesso de administrador." };
    }
    if (id === admin.id && input.status === "inactive") {
      return { ok: false, error: "Você não pode desativar a sua própria conta." };
    }

    const supabase = await createClient();
    const { data: before } = await supabase.from("profiles").select("*").eq("id", id).single();
    const patch = {
      full_name: input.full_name,
      phone: input.phone,
      job_title: input.job_title,
      department: input.department,
      area: input.area,
      company: input.company,
      role_id: input.role_id,
      status: input.status,
      ...(input.joined_at ? { joined_at: input.joined_at } : {}),
    };
    ensure(await supabase.from("profiles").update(patch).eq("id", id));
    await syncGroups(id, input.group_ids);

    await logAudit("user.updated", "profile", id, input.full_name, diff(before, patch));
    revalidatePath(`/admin/colaboradores/${id}`);
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: "Dados salvos." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setCollaboratorStatusAction(userId: string, status: "active" | "inactive"): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const id = z.uuid().parse(userId);
    if (id === admin.id) return { ok: false, error: "Você não pode alterar o status da sua própria conta." };
    const supabase = await createClient();
    ensure(await supabase.from("profiles").update({ status }).eq("id", id));
    await logAudit(status === "inactive" ? "user.deactivated" : "user.reactivated", "profile", id, null);
    revalidatePath(`/admin/colaboradores/${id}`);
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: status === "inactive" ? "Acesso desativado. O histórico foi preservado." : "Acesso reativado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resendInviteAction(userId: string): Promise<ActionResult<{ emailStatus: EmailStatus; inviteUrl?: string }>> {
  try {
    await assertAdmin();
    const id = z.uuid().parse(userId);
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("email, full_name, status").eq("id", id).single();
    if (!profile) return { ok: false, error: "Colaborador não encontrado." };
    if (profile.status === "inactive") return { ok: false, error: "Reative o colaborador antes de reenviar o acesso." };

    const link = await generateAuthLink("recovery", profile.email);
    if (!link.ok) return { ok: false, error: link.error };
    const email = await sendEmail({
      to: profile.email,
      template: "invite",
      userId: id,
      content: emailTemplates.invite({ name: profile.full_name, url: link.url }),
    });
    await supabase.from("profiles").update({ invited_at: new Date().toISOString() }).eq("id", id);
    await logAudit("user.invite_resent", "profile", id, profile.full_name, { email_status: email.status });
    return {
      ok: true,
      data: { emailStatus: email.status, inviteUrl: email.status === "sent" ? undefined : link.url },
      message: email.status === "sent" ? "Novo link de acesso enviado." : "E-mail NÃO enviado (Resend não configurado ou falhou). Copie o link.",
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAvatarAction(userId: string, path: string | null): Promise<ActionResult> {
  try {
    const profile = await assertUser();
    const id = z.uuid().parse(userId);
    if (id !== profile.id && profile.role_id !== "admin") return { ok: false, error: "Sem permissão." };
    if (path) {
      if (!path.startsWith(`${id}/`)) return { ok: false, error: "Caminho de arquivo inválido." };
      await assertObjectExists("avatars", path);
    }
    const supabase = await createClient();
    const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", id).single();
    ensure(await supabase.from("profiles").update({ avatar_path: path }).eq("id", id));
    if (before?.avatar_path && before.avatar_path !== path) await removeObjects("avatars", [before.avatar_path]);
    revalidatePath("/", "layout");
    return { ok: true, message: "Foto atualizada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateOwnProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const profile = await assertUser();
    const input = ownProfileSchema.parse({ full_name: formData.get("full_name"), phone: formData.get("phone") ?? undefined });
    const supabase = await createClient();
    ensure(await supabase.from("profiles").update(input).eq("id", profile.id));
    revalidatePath("/", "layout");
    return { ok: true, message: "Perfil atualizado." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export async function saveGroupAction(groupId: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const input = groupSchema.parse({ name: formData.get("name"), description: formData.get("description") ?? undefined });
    const supabase = await createClient();
    if (groupId) {
      ensure(await supabase.from("groups").update(input).eq("id", z.uuid().parse(groupId)));
      await logAudit("group.updated", "group", groupId, input.name);
    } else {
      const created = ensureOne(await supabase.from("groups").insert(input).select("id").single());
      await logAudit("group.created", "group", created?.id ?? null, input.name);
    }
    revalidatePath("/admin/grupos");
    return { ok: true, message: "Grupo salvo." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = z.uuid().parse(groupId);
    const supabase = await createClient();
    ensure(await supabase.from("group_members").delete().eq("group_id", id));
    ensure(await supabase.from("groups").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    await logAudit("group.deleted", "group", id, null);
    revalidatePath("/admin/grupos");
    return { ok: true, message: "Grupo removido." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setGroupMembersAction(groupId: string, userIds: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = z.uuid().parse(groupId);
    const ids = z.array(z.uuid()).max(1000).parse(userIds);
    const supabase = await createClient();
    ensure(await supabase.from("group_members").delete().eq("group_id", id));
    if (ids.length) ensure(await supabase.from("group_members").insert(ids.map((user_id) => ({ group_id: id, user_id }))));
    await supabase.rpc("fn_admin_sync_enrollments");
    await logAudit("group.members_updated", "group", id, null, { members: ids.length });
    revalidatePath("/admin/grupos");
    return { ok: true, message: "Membros atualizados." };
  } catch (err) {
    return toActionError(err);
  }
}
