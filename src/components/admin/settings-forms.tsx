"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { CheckField, SelectField, TextField } from "./form-fields";
import { deleteCompetencyAction, saveCompetencyAction, updateBadgeAction, updateSettingsAction } from "@/actions/settings";
import type { AppSettings, Badge } from "@/types/domain";

const RULE_LABEL: Record<string, string> = {
  first_module: "Módulos concluídos ≥",
  course_completed: "Trilhas concluídas ≥",
  streak_days: "Dias seguidos ≥",
  lessons_completed: "Aulas concluídas ≥",
  high_score: "Nota em prova ≥ (%)",
  first_exam_passed: "Provas aprovadas ≥",
};

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action] = useActionState(updateSettingsAction, null);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="platform_name" label="Nome da plataforma" defaultValue={settings.platform_name} required />
        <TextField name="company_name" label="Empresa" defaultValue={settings.company_name} required />
        <TextField
          name="inactivity_alert_days"
          label="Alerta de inatividade (dias)"
          type="number"
          min={1}
          max={90}
          defaultValue={settings.inactivity_alert_days}
          hint="Usado em alertas, insights e lembretes."
        />
        <TextField
          name="default_video_completion_percent"
          label="% padrão de vídeo para concluir"
          type="number"
          min={1}
          max={100}
          defaultValue={settings.default_video_completion_percent}
          hint="Aplicado às novas aulas (padrão 90%)."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField
          name="ranking_enabled"
          label="Ranking interno"
          description="Exibe a classificação para os colaboradores. Não deve ser o único indicador de desempenho."
          defaultChecked={settings.ranking_enabled}
        />
        <CheckField
          name="reminder_emails_enabled"
          label="E-mails de lembrete de estudo"
          description="Enviados pela rotina diária a quem está inativo."
          defaultChecked={settings.reminder_emails_enabled}
        />
      </div>
      <SelectField
        name="ranking_criteria"
        label="Critério do ranking"
        defaultValue={settings.ranking_criteria}
        options={[
          { value: "points", label: "Pontos" },
          { value: "completions", label: "Conclusões (módulos)" },
          { value: "scores", label: "Notas" },
          { value: "streak", label: "Sequência de estudos" },
        ]}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar configurações</SubmitButton>
    </form>
  );
}

export function CompetencyManager({ competencies }: { competencies: { id: string; name: string; description: string | null }[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {competencies.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-sm">{c.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remover"
              disabled={pending}
              onClick={() => confirm(`Remover a competência "${c.name}"?`) && run(() => deleteCompetencyAction(c.id))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {competencies.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nenhuma competência.</li>}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await saveCompetencyAction(null, { name });
            if (r.ok) setName("");
            return r;
          });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova competência" />
        <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2}>
          <Plus /> Adicionar
        </Button>
      </form>
    </div>
  );
}

function BadgeRow({ badge }: { badge: Badge }) {
  const [v, setV] = useState({ name: badge.name, description: badge.description ?? "", icon: badge.icon, rule_value: String(badge.rule_value), points: String(badge.points), active: badge.active });
  const [pending, startTransition] = useTransition();
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[56px_1fr_120px_90px_auto_auto] sm:items-center">
      <Input value={v.icon} onChange={(e) => setV({ ...v, icon: e.target.value })} className="text-center text-lg" aria-label="Ícone" />
      <div className="space-y-1">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Nome" />
        <Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="h-7 text-xs" aria-label="Descrição" />
      </div>
      <label className="space-y-1 text-[11px] text-muted-foreground">
        {RULE_LABEL[badge.rule_type]}
        <Input type="number" min={1} value={v.rule_value} onChange={(e) => setV({ ...v, rule_value: e.target.value })} />
      </label>
      <label className="space-y-1 text-[11px] text-muted-foreground">
        Pontos
        <Input type="number" min={0} value={v.points} onChange={(e) => setV({ ...v, points: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} /> Ativa
      </label>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Salvar conquista"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await updateBadgeAction(badge.id, { ...v, rule_value: Number(v.rule_value), points: Number(v.points) });
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
          })
        }
      >
        <Save />
      </Button>
    </li>
  );
}

export function BadgeManager({ badges }: { badges: Badge[] }) {
  return (
    <ul className="divide-y">
      {badges.map((b) => (
        <BadgeRow key={b.id} badge={b} />
      ))}
    </ul>
  );
}
