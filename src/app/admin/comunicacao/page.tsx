import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page";
import { AnnouncementManager } from "@/components/admin/announcement-manager";
import { TestEmailButton } from "@/components/admin/test-email-button";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listGroups } from "@/services/users";
import { isEmailConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import type { Announcement } from "@/types/domain";

export const metadata: Metadata = { title: "Comunicação" };

const TEMPLATE_LABEL: Record<string, string> = {
  invite: "Convite",
  passwordReset: "Recuperação de senha",
  newModule: "Novo módulo",
  examPending: "Prova pendente",
  examResult: "Resultado",
  courseCompleted: "Curso concluído",
  studyReminder: "Lembrete de estudo",
  announcement: "Comunicado",
};

export default async function CommunicationPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: announcements }, groups, { data: logs }] = await Promise.all([
    supabase.from("announcements").select("*").is("deleted_at", null).order("publish_at", { ascending: false }).limit(100),
    listGroups(),
    supabase.from("email_logs").select("id, template, status, to_email, error, created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  const emailReady = isEmailConfigured();

  return (
    <>
      <PageHeader title="Comunicação" description="Comunicados, banners na Home, notificações internas e e-mails." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AnnouncementManager announcements={(announcements ?? []) as Announcement[]} groups={groups} emailReady={emailReady} />
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">E-mail (Resend)</CardTitle>
              <CardDescription>
                {emailReady
                  ? "Configurado. Convites, resultados, lembretes e comunicados são enviados automaticamente."
                  : "NÃO configurado. Nenhum e-mail é enviado; convites exibem o link para envio manual. Veja docs/EMAIL.md."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={emailReady ? "secondary" : "destructive"}>{emailReady ? "Ativo" : "Inativo"}</Badge>
              {emailReady && <TestEmailButton />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos e-mails</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id as string} title={(l.error as string | null) ?? undefined}>
                        <TableCell>
                          {TEMPLATE_LABEL[l.template as string] ?? (l.template as string)}
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(l.created_at as string)}</p>
                        </TableCell>
                        <TableCell className="max-w-36 truncate text-xs">{l.to_email as string}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "sent" ? "secondary" : l.status === "failed" ? "destructive" : "outline"}>
                            {l.status === "sent" ? "Enviado" : l.status === "failed" ? "Falhou" : "Não enviado"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
