import type { Instrumentation } from "next";

/** Registra erros de servidor em audit_logs (action = system.error) para diagnóstico. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const message = err instanceof Error ? err.message : String(err);
    const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
    const stack = err instanceof Error ? (err.stack ?? "").split("\n").slice(0, 8).join("\n") : null;
    await fetch(`${url}/rest/v1/audit_logs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        action: "system.error",
        entity_type: context.routeType,
        entity_id: context.routePath,
        summary: message.slice(0, 500),
        changes: { path: request.path, method: request.method, digest, stack, renderSource: context.renderSource ?? null },
      }),
    });
  } catch {
    // nunca propagar erro do registrador
  }
};
