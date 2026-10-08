import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RoleId } from "@/types/domain";

/**
 * Data Access Layer de autenticação. Toda página e Server Action protegida
 * passa por aqui. O JWT é verificado com getClaims(); o perfil vem do banco
 * (RLS) e define o papel do usuário.
 */
export const getSessionClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { userId: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? null };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", claims.userId).maybeSingle();
  return (data as Profile | null) ?? null;
});

export function isStaffRole(role: RoleId | undefined | null) {
  return role === "admin" || role === "manager";
}

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    // Sessão válida sem perfil legível: encerrar a sessão evita loop /login <-> /.
    if (await getSessionClaims()) redirect("/auth/signout?reason=noprofile");
    redirect("/login");
  }
  if (profile.status === "inactive" || profile.deleted_at) redirect("/auth/signout?reason=inactive");
  return profile;
}

export async function requireStaff(): Promise<Profile> {
  const profile = await requireUser();
  if (!isStaffRole(profile.role_id)) redirect("/inicio");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role_id !== "admin") redirect(isStaffRole(profile.role_id) ? "/admin" : "/inicio");
  return profile;
}

export class ActionError extends Error {}

/** Para Server Actions: lança em vez de redirecionar. */
export async function assertUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.status === "inactive" || profile.deleted_at) {
    throw new ActionError("Sua sessão expirou. Entre novamente.");
  }
  return profile;
}

export async function assertAdmin(): Promise<Profile> {
  const profile = await assertUser();
  if (profile.role_id !== "admin") throw new ActionError("Apenas administradores podem realizar esta ação.");
  return profile;
}

export async function assertStaff(): Promise<Profile> {
  const profile = await assertUser();
  if (!isStaffRole(profile.role_id)) throw new ActionError("Acesso restrito à gestão.");
  return profile;
}
