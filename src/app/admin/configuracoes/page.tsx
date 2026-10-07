import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { BadgeManager, CompetencyManager, SettingsForm } from "@/components/admin/settings-forms";
import { requireAdmin } from "@/lib/auth/dal";
import { getSettings } from "@/services/settings";
import { listCompetencies } from "@/services/content";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/env";
import { UPLOAD_PROFILES, formatBytes } from "@/config/uploads";
import type { Badge } from "@/types/domain";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, competencies, { data: badges }] = await Promise.all([
    getSettings(),
    listCompetencies(),
    supabase.from("badges").select("*").order("points"),
  ]);

  const checks = [
    { label: "Supabase (URL + anon key)", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    { label: "Service Role Key (convites)", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "Resend (e-mails)", ok: isEmailConfigured() },
    { label: "URL pública (NEXT_PUBLIC_APP_URL)", ok: Boolean(process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) },
    { label: "Rotina diária (CRON_SECRET)", ok: Boolean(process.env.CRON_SECRET) },
  ];

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plataforma</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsForm settings={settings} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Conquistas (badges)</CardTitle>
              <CardDescription>Gamificação leve: ajuste nomes, ícones, regras e pontos.</CardDescription>
            </CardHeader>
            <CardContent>
              <BadgeManager badges={(badges ?? []) as Badge[]} />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integrações</CardTitle>
              <CardDescription>Estado real das variáveis de ambiente no servidor.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Competências</CardTitle>
              <CardDescription>Vinculadas aos módulos para a matriz colaborador × competência.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompetencyManager competencies={competencies} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limites de upload</CardTitle>
              <CardDescription>Definidos em src/config/uploads.ts e nos buckets (003_storage.sql).</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {Object.entries(UPLOAD_PROFILES).map(([k, p]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{p.bucket}</span>
                    <span className="tabular-nums">{formatBytes(p.maxBytes)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
