import "server-only";
import { createClient } from "@/lib/supabase/server";

type Changes = Record<string, unknown> | null;

/**
 * Registra um evento de auditoria (quem, quando, o quê). O autor é sempre o
 * usuário autenticado (auth.uid() dentro de fn_log_event).
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId?: string | null,
  summary?: string | null,
  changes?: Changes,
) {
  try {
    const supabase = await createClient();
    await supabase.rpc("fn_log_event", {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_summary: summary ?? null,
      p_changes: changes ?? null,
    });
  } catch (err) {
    console.error("[audit] falha ao registrar", action, err);
  }
}

/** Retorna apenas os campos que mudaram: { campo: { de, para } }. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown>): Changes {
  if (!before) return { created: after };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    if (key === "updated_at" || key === "updated_by") continue;
    const prev = before[key];
    if (JSON.stringify(prev ?? null) !== JSON.stringify(value ?? null)) {
      changes[key] = { from: prev ?? null, to: value ?? null };
    }
  }
  return Object.keys(changes).length ? changes : null;
}
