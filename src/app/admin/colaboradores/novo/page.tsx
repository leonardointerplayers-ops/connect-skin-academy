import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { CollaboratorForm } from "@/components/admin/collaborator-form";
import { inviteCollaboratorAction } from "@/actions/users";
import { requireAdmin } from "@/lib/auth/dal";
import { listGroups } from "@/services/users";
import { isEmailConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Adicionar colaborador" };

export default async function NewCollaboratorPage() {
  await requireAdmin();
  const groups = await listGroups();
  return (
    <>
      <PageHeader title="Adicionar colaborador" back={{ href: "/admin/colaboradores", label: "Colaboradores" }} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados do colaborador</CardTitle>
          <CardDescription>
            O usuário é criado no Supabase Auth e recebe um e-mail “Você foi convidado para a Universidade Corporativa” com o
            botão <strong>ACESSAR PLATAFORMA</strong> para definir a própria senha. Nenhuma senha é enviada por e-mail.
            {!isEmailConfigured() && (
              <span className="mt-2 block rounded-md bg-warning/15 px-3 py-2 text-warning-foreground">
                Resend não configurado: o link de acesso será exibido aqui para você enviar manualmente.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollaboratorForm action={inviteCollaboratorAction} groups={groups} mode="create" />
        </CardContent>
      </Card>
    </>
  );
}
