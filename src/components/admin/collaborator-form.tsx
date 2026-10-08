"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormMessage, SubmitButton } from "@/components/shared/form-bits";
import type { ActionResult } from "@/lib/actions";
import type { Profile } from "@/types/domain";

type InviteData = { userId?: string; inviteUrl?: string };
type Action = (prev: ActionResult<InviteData> | null, formData: FormData) => Promise<ActionResult<InviteData>>;

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function CollaboratorForm({
  action,
  profile,
  groups,
  selectedGroups = [],
  managers = [],
  mode,
}: {
  action: Action;
  profile?: Profile;
  groups: { id: string; name: string }[];
  selectedGroups?: string[];
  managers?: { id: string; full_name: string; role_id: string }[];
  mode: "create" | "edit";
}) {
  const [state, formAction] = useActionState(action, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const inviteUrl = state?.ok ? state.data?.inviteUrl : undefined;

  if (mode === "create" && state?.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        {inviteUrl && (
          <div className="space-y-2">
            <Label>Link de acesso (válido por 24 horas)</Label>
            <CopyLink url={inviteUrl} />
            <p className="text-xs text-muted-foreground">
              Configure o Resend (docs/EMAIL.md) para que os convites sejam enviados automaticamente.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/colaboradores/${state.data?.userId ?? ""}`}>Abrir colaborador</Link>
          </Button>
          <Button variant="outline" type="button" onClick={() => window.location.reload()}>
            Convidar outro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="full_name">Nome completo *</Label>
          <Input id="full_name" name="full_name" defaultValue={profile?.full_name} required />
          <FieldError errors={fe?.full_name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" name="email" type="email" defaultValue={profile?.email} required disabled={mode === "edit"} />
          {mode === "edit" && <input type="hidden" name="email" value={profile?.email} />}
          <FieldError errors={fe?.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} placeholder="(11) 99999-0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_title">Cargo</Label>
          <Input id="job_title" name="job_title" defaultValue={profile?.job_title ?? ""} placeholder="Promotor(a), Consultor(a)…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Departamento</Label>
          <Input id="department" name="department" defaultValue={profile?.department ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="area">Área</Label>
          <Input id="area" name="area" defaultValue={profile?.area ?? ""} placeholder="Regional, praça…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" defaultValue={profile?.company ?? "Connect Skin"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="joined_at">Data de entrada</Label>
          <Input id="joined_at" name="joined_at" type="date" defaultValue={profile?.joined_at ?? ""} />
          <p className="text-xs text-muted-foreground">Usada na liberação programada “X dias após entrada”.</p>
        </div>
        <div className="space-y-2">
          <Label>Papel</Label>
          <Select name="role_id" defaultValue={profile?.role_id ?? "collaborator"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collaborator">Colaborador</SelectItem>
              <SelectItem value="manager">Gestor (acompanha a própria equipe)</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Gestor responsável</Label>
          <Select name="manager_id" defaultValue={profile?.manager_id ?? "none"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem gestor</SelectItem>
              {managers
                .filter((m) => m.id !== profile?.id)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                    {m.role_id === "admin" ? " (admin)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O gestor acompanha esta pessoa (e a equipe dela) no painel. Para aparecer aqui, cadastre a pessoa com o papel “Gestor”.
          </p>
          <FieldError errors={fe?.manager_id} />
        </div>
        {mode === "edit" && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" defaultValue={profile?.status}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invited">Convidado</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo (sem acesso)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Grupos</legend>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
                <Checkbox name="group_ids" value={g.id} defaultChecked={selectedGroups.includes(g.id)} />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <FormMessage state={state && (!state.ok || mode === "edit") ? state : null} />
      <SubmitButton pendingText={mode === "create" ? "Criando acesso…" : "Salvando…"}>
        {mode === "create" ? "Cadastrar e enviar convite" : "Salvar alterações"}
      </SubmitButton>
    </form>
  );
}
