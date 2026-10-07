// Cria (ou promove) o primeiro administrador da plataforma.
//
// Uso:
//   npm run create-admin -- admin@suaempresa.com.br "Nome Completo"
//
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY de .env.local.
// Gera um link de definição de senha (válido por 24h) e o imprime no terminal.
import { createClient } from "@supabase/supabase-js";

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!email || !email.includes("@")) {
  console.error('Uso: npm run create-admin -- admin@empresa.com.br "Nome Completo"');
  process.exit(1);
}
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const normalized = email.trim().toLowerCase();

const { data: existing } = await admin.from("profiles").select("id").eq("email", normalized).maybeSingle();
let userId = existing?.id;
let link;

if (!userId) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: normalized,
    options: { data: { full_name: fullName || normalized.split("@")[0] } },
  });
  if (error) {
    console.error("Erro ao criar usuário:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  link = data.properties.hashed_token;
  console.log("✓ Usuário criado no Supabase Auth.");
} else {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: normalized });
  if (error) {
    console.error("Erro ao gerar link:", error.message);
    process.exit(1);
  }
  link = data.properties.hashed_token;
  console.log("✓ Usuário já existia.");
}

const patch = { role_id: "admin" };
if (fullName) patch.full_name = fullName;
const { error: upErr } = await admin.from("profiles").update(patch).eq("id", userId);
if (upErr) {
  console.error("Erro ao promover a administrador:", upErr.message, "\nVocê executou as migrações 001→004?");
  process.exit(1);
}
await admin.from("audit_logs").insert({ action: "user.promoted_admin", entity_type: "profile", entity_id: userId, summary: "via scripts/create-admin.mjs" });

const type = existing ? "recovery" : "invite";
console.log(`✓ ${normalized} agora é administrador.\n`);
console.log("Abra o link abaixo para definir a senha (válido por 24h, uso único):\n");
console.log(`${appUrl}/auth/confirm?token_hash=${link}&type=${type}&next=/definir-senha\n`);
