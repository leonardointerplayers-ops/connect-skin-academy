"use client";

import { useActionState, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "./form-fields";
import { ImageField } from "./image-field";
import { updateModuleAction } from "@/actions/content";
import type { Module } from "@/types/domain";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  // Exibe no horário de Brasília (UTC-3).
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function ModuleForm({
  module,
  competencies,
  selectedCompetencies,
}: {
  module: Module;
  competencies: { id: string; name: string }[];
  selectedCompetencies: string[];
}) {
  const [state, action] = useActionState(updateModuleAction.bind(null, module.id), null);
  const [release, setRelease] = useState(module.release_type);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <TextField name="title" label="Nome do módulo *" defaultValue={module.title} errors={fe?.title} required />
          <TextAreaField name="description" label="Descrição" defaultValue={module.description} rows={4} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="category" label="Categoria" defaultValue={module.category} />
            <TextField name="points" label="Pontos ao concluir" type="number" min={0} defaultValue={module.points} />
            <TextField name="due_date" label="Prazo de conclusão" type="date" defaultValue={module.due_date} hint="Opcional." />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <SelectField
              name="release_type"
              label="Liberação"
              value={release}
              onValueChange={(v) => setRelease(v as Module["release_type"])}
              options={[
                { value: "immediate", label: "Imediata" },
                { value: "date", label: "Em uma data" },
                { value: "days_after_join", label: "X dias após a entrada do colaborador" },
              ]}
            />
            {release === "date" && (
              <TextField name="release_at" label="Data e hora (Brasília)" type="datetime-local" defaultValue={toLocalInput(module.release_at)} errors={fe?.release_at} />
            )}
            {release === "days_after_join" && (
              <TextField name="release_days" label="Dias após a entrada" type="number" min={0} defaultValue={module.release_days} errors={fe?.release_days} />
            )}
            <p className="text-xs text-muted-foreground">
              Se a trilha exigir conclusão sequencial, o módulo também só abre depois que o anterior for concluído.
            </p>
          </div>

          {competencies.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Competências desenvolvidas</legend>
              <div className="flex flex-wrap gap-2">
                {competencies.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
                    <Checkbox name="competency_ids" value={c.id} defaultChecked={selectedCompetencies.includes(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <div className="space-y-4">
          <SelectField name="status" label="Status" defaultValue={module.status} options={STATUS_OPTIONS} />
          <ImageField name="cover_path" label="Capa" profile="moduleCover" bucket="module-covers" defaultPath={module.cover_path} />
          <ImageField name="thumbnail_path" label="Thumbnail" profile="moduleCover" bucket="module-covers" defaultPath={module.thumbnail_path} aspect="aspect-square" />
          <ImageField name="featured_image_path" label="Imagem de destaque" profile="moduleCover" bucket="module-covers" defaultPath={module.featured_image_path} aspect="aspect-[3/1]" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar módulo</SubmitButton>
    </form>
  );
}
