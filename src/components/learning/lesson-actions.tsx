"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { MaterialIcon } from "@/components/shared/material-icon";
import { completeLessonAction, submitActivityAction } from "@/actions/learning";
import { getMaterialUrlAction } from "@/actions/materials";
import { MATERIAL_KIND_LABELS, formatBytes, type MaterialKind } from "@/config/uploads";

export function CompleteLessonButton({ lessonId, completed, blockedReason }: { lessonId: string; completed: boolean; blockedReason?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (completed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" /> Aula concluída
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Button
        size="lg"
        disabled={pending || Boolean(blockedReason)}
        onClick={() =>
          startTransition(async () => {
            const res = await completeLessonAction(lessonId);
            if (res.ok) {
              toast.success(res.message);
              router.refresh();
            } else toast.error(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Marcar como concluída
      </Button>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
    </div>
  );
}

export function ActivityForm({
  lessonId,
  title,
  instructions,
  requiresResponse,
  done,
  previousResponse,
}: {
  lessonId: string;
  title: string | null;
  instructions: string | null;
  requiresResponse: boolean;
  done: boolean;
  previousResponse: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof submitActivityAction>> | null, fd: FormData) => {
    const res = await submitActivityAction(lessonId, prev, fd);
    if (res.ok) router.refresh();
    return res;
  }, null);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-brand-accent">Atividade</p>
        <h3 className="font-semibold">{title || "Atividade prática"}</h3>
      </div>
      {instructions && <p className="whitespace-pre-line text-sm text-muted-foreground">{instructions}</p>}
      {done ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> Atividade concluída
          </p>
          {previousResponse && <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{previousResponse}</p>}
        </div>
      ) : (
        <form action={action} className="space-y-3">
          {requiresResponse ? (
            <Textarea name="response" rows={4} placeholder="Escreva sua resposta…" required minLength={3} maxLength={5000} />
          ) : (
            <input type="hidden" name="response" value="" />
          )}
          <FormMessage state={state} />
          <SubmitButton pendingText="Enviando…">{requiresResponse ? "Enviar resposta" : "Confirmar que realizei a atividade"}</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function MaterialsList({ materials }: { materials: { id: string; title: string; kind: string; size_bytes: number | null; external_url: string | null; description: string | null }[] }) {
  const [pending, startTransition] = useTransition();
  const open = (id: string, download: boolean) =>
    startTransition(async () => {
      const res = await getMaterialUrlAction(id, download);
      if (res.ok && res.data) {
        if (download) window.location.href = res.data.url;
        else window.open(res.data.url, "_blank", "noopener");
      } else if (!res.ok) toast.error(res.error);
    });

  return (
    <ul className="space-y-2">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <MaterialIcon kind={m.kind} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {MATERIAL_KIND_LABELS[m.kind as MaterialKind]}
              {m.size_bytes ? ` · ${formatBytes(m.size_bytes)}` : ""}
              {m.description ? ` · ${m.description}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Abrir" disabled={pending} onClick={() => open(m.id, false)}>
              <ExternalLink />
            </Button>
            {!m.external_url && (
              <Button variant="outline" size="icon-sm" aria-label="Baixar" disabled={pending} onClick={() => open(m.id, true)}>
                <Download />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
