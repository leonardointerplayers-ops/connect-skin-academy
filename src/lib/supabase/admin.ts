import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com Service Role — ignora RLS. Usar SOMENTE no servidor e apenas
 * depois de verificar permissões com requireAdmin()/assertAdmin().
 * Usos: convites (auth.admin), links de recuperação, registro de e-mails e
 * rotina diária (cron).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada (ver docs/SETUP.md).");
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
