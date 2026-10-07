"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckField, SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "./form-fields";
import { ImageField } from "./image-field";
import { broadcastAnnouncementAction, deleteAnnouncementAction, saveAnnouncementAction } from "@/actions/communication";
import type { Announcement } from "@/types/domain";

function toLocal(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);
}

function AnnouncementDialog({ announcement, trigger }: { announcement?: Announcement; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof saveAnnouncementAction>> | null, fd: FormData) => {
    const res = await saveAnnouncementAction(announcement?.id ?? null, prev, fd);
    if (res.ok) {
      toast.success(res.message);
      setOpen(false);
    }
    return res;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement ? "Editar comunicado" : "Novo comunicado"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <TextField name="title" label="Título *" defaultValue={announcement?.title} errors={fe?.title} required />
          <TextAreaField name="body" label="Mensagem *" defaultValue={announcement?.body} rows={5} errors={fe?.body} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="link_url" label="Link" defaultValue={announcement?.link_url} placeholder="https://… ou /trilhas" errors={fe?.link_url} />
            <TextField name="link_label" label="Texto do botão" defaultValue={announcement?.link_label} placeholder="Saiba mais" />
            <SelectField
              name="priority"
              label="Prioridade"
              defaultValue={announcement?.priority ?? "normal"}
              options={[
                { value: "high", label: "Alta" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Baixa" },
              ]}
            />
            <SelectField name="status" label="Status" defaultValue={announcement?.status ?? "published"} options={STATUS_OPTIONS} />
            <TextField name="publish_at" label="Publicar em" type="datetime-local" defaultValue={toLocal(announcement?.publish_at ?? null)} hint="Vazio = agora." />
            <TextField name="expires_at" label="Expira em" type="datetime-local" defaultValue={toLocal(announcement?.expires_at ?? null)} hint="Opcional." />
          </div>
          <CheckField name="show_banner" label="Exibir como banner na Home" description='Ex.: "Novo módulo disponível", "Prazo para conclusão: 20/10".' defaultChecked={announcement?.show_banner} />
          <ImageField name="image_path" label="Imagem" profile="announcementImage" bucket="course-covers" defaultPath={announcement?.image_path} aspect="aspect-[3/1]" />
          <FormMessage state={state && !state.ok ? state : null} />
          <DialogFooter>
            <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastDialog({ announcement, groups, emailReady }: { announcement: Announcement; groups: { id: string; name: string }[]; emailReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState("all");
  const [email, setEmail] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={announcement.status !== "published"}>
          <Send /> Enviar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar “{announcement.title}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Destinatários</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores ativos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    Grupo: {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} disabled={!emailReady} />
            Também enviar por e-mail {!emailReady && <span className="text-xs text-muted-foreground">(Resend não configurado)</span>}
          </label>
          <p className="text-xs text-muted-foreground">Plano gratuito do Resend: até 100 e-mails/dia e 3.000/mês.</p>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await broadcastAnnouncementAction(announcement.id, { groupId: group === "all" ? null : group, email });
                if (res.ok) {
                  toast.success(res.message);
                  setOpen(false);
                } else toast.error(res.error);
              })
            }
          >
            <Send /> Enviar notificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementManager({
  announcements,
  groups,
  emailReady,
}: {
  announcements: Announcement[];
  groups: { id: string; name: string }[];
  emailReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      <AnnouncementDialog
        trigger={
          <Button>
            <Plus /> Novo comunicado
          </Button>
        }
      />
      {announcements.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
          <Megaphone className="mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">Nenhum comunicado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="py-0">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    <StatusBadge status={a.status} />
                    {a.priority === "high" && <Badge className="bg-brand-accent text-brand-accent-foreground">Alta</Badge>}
                    {a.show_banner && <Badge variant="secondary">Banner</Badge>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                  <p className="text-xs text-muted-foreground">
                    Publicação {new Date(a.publish_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    {a.expires_at && ` · expira ${new Date(a.expires_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <BroadcastDialog announcement={a} groups={groups} emailReady={emailReady} />
                  <AnnouncementDialog
                    announcement={a}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Editar">
                        <Pencil />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Excluir"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Remover este comunicado?")) return;
                      startTransition(async () => {
                        const res = await deleteAnnouncementAction(a.id);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.error);
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
