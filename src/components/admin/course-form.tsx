"use client";

import { useActionState, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { CheckField, SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "./form-fields";
import { ImageField } from "./image-field";
import { updateCourseAction } from "@/actions/content";
import type { Course } from "@/types/domain";

export function CourseForm({
  course,
  groups,
  selectedGroups,
}: {
  course: Course;
  groups: { id: string; name: string }[];
  selectedGroups: string[];
}) {
  const [state, action] = useActionState(updateCourseAction.bind(null, course.id), null);
  const [audience, setAudience] = useState(course.audience);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <TextField name="title" label="Título *" defaultValue={course.title} errors={fe?.title} required />
          <TextField name="subtitle" label="Subtítulo" defaultValue={course.subtitle} />
          <TextAreaField name="description" label="Descrição" defaultValue={course.description} rows={4} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="category" label="Categoria" defaultValue={course.category} />
            <TextField name="workload_hours" label="Carga horária (h)" type="number" step="0.5" min={0} defaultValue={course.workload_hours} hint="Aparece no certificado." />
            <TextField name="due_days" label="Prazo (dias)" type="number" min={1} defaultValue={course.due_days} hint="Após a matrícula. Vazio = sem prazo." errors={fe?.due_days} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckField
              name="require_sequential"
              label="Exigir conclusão sequencial"
              description="O módulo seguinte só abre após concluir o anterior."
              defaultChecked={course.require_sequential}
            />
            <CheckField
              name="certificate_enabled"
              label="Emitir certificado"
              description="Gerado automaticamente ao concluir todos os módulos."
              defaultChecked={course.certificate_enabled}
            />
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <SelectField
              name="audience"
              label="Quem pode acessar"
              value={audience}
              onValueChange={(v) => setAudience(v as Course["audience"])}
              options={[
                { value: "all", label: "Todos os colaboradores" },
                { value: "groups", label: "Somente grupos selecionados" },
              ]}
            />
            {audience === "groups" && (
              <div className="flex flex-wrap gap-2">
                {groups.length === 0 && <p className="text-sm text-muted-foreground">Crie grupos em Gestão → Grupos.</p>}
                {groups.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
                    <Checkbox name="group_ids" value={g.id} defaultChecked={selectedGroups.includes(g.id)} />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <SelectField name="status" label="Status" defaultValue={course.status} options={STATUS_OPTIONS} />
          <ImageField name="cover_path" label="Capa" profile="courseCover" bucket="course-covers" defaultPath={course.cover_path} hint="Recomendado 1600×900." />
          <ImageField name="thumbnail_path" label="Thumbnail" profile="courseCover" bucket="course-covers" defaultPath={course.thumbnail_path} aspect="aspect-square" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar trilha</SubmitButton>
    </form>
  );
}
