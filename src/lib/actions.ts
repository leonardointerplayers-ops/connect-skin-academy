import "server-only";
import { z } from "zod";
import { ActionError } from "@/lib/auth/dal";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };


/** Converte erros conhecidos (Zod, ActionError, Postgres) em mensagens úteis. */
export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: err.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
  }
  if (err instanceof ActionError) {
    return { ok: false, error: err.message };
  }
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return { ok: false, error: translateDbError(err.message, (err as { code?: string }).code) };
  }
  console.error("[action] erro inesperado", err);
  return { ok: false, error: "Não foi possível concluir a operação. Tente novamente." };
}

export function translateDbError(message: string, code?: string): string {
  if (code === "23505" || message.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (code === "23503") return "Este item está vinculado a outros registros.";
  if (code === "42501" || message.includes("row-level security")) return "Você não tem permissão para esta ação.";
  if (code === "PGRST116") return "Registro não encontrado.";
  // Mensagens de RAISE EXCEPTION das funções SQL já estão em português.
  if (code === "P0001") return message;
  return message.length < 200 ? message : "Erro ao acessar o banco de dados.";
}

/** Lança se o Supabase devolveu erro. */
export function ensure<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    throw new ActionError(translateDbError(result.error.message, result.error.code));
  }
  return result.data;
}

export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Como ensure(), mas exige um registro (ex.: insert(...).select().single()). */
export function ensureOne<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  const data = ensure(result);
  if (data === null || data === undefined) throw new ActionError("Registro não encontrado.");
  return data as NonNullable<T>;
}
