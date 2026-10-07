"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { CheckField, SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "./form-fields";
import { RichTextEditor } from "./rich-text-editor";
import { updateLessonAction } from "@/actions/content";
import type { Lesson } from "@/types/domain";

export function LessonForm({ lesson, hasVideo }: { lesson: Lesson; hasVideo: boolean }) {
  const [state, action] = useActionState(updateLessonAction.bind(null, lesson.id), null);
  const [activity, setActivity] = useState(lesson.activity_enabled);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <TextField name="title" label="Título *" defaultValue={lesson.title} errors={fe?.title} required />
        <SelectField name="status" label="Status" defaultValue={lesson.status} options={STATUS_OPTIONS} />
      </div>
      <TextAreaField name="description" label="Descrição curta" defaultValue={lesson.description} rows={2} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Conteúdo</p>
        <RichTextEditor name="content_html" defaultValue={lesson.content_html} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="estimated_minutes" label="Duração estimada (min)" type="number" min={1} defaultValue={lesson.estimated_minutes} />
        <TextField name="points" label="Pontos ao concluir" type="number" min={0} defaultValue={lesson.points} />
        <TextField
          name="min_video_percent"
          label="% mínimo do vídeo"
          type="number"
          min={1}
          max={100}
          defaultValue={lesson.min_video_percent}
          hint="Exigir assistir X% para concluir."
          errors={fe?.min_video_percent}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField
          name="is_required"
          label="Aula obrigatória"
          description="Conta para a conclusão do módulo. Desmarque para aula opcional."
          defaultChecked={lesson.is_required}
        />
        <CheckField
          name="video_required"
          label="Vídeo obrigatório"
          description={hasVideo ? "Exige assistir ao % mínimo do vídeo." : "Sem vídeo vinculado: regra ignorada."}
          defaultChecked={lesson.video_required}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <CheckField
          name="activity_enabled"
          label="Atividade prática"
          description="O colaborador precisa concluir a atividade para finalizar a aula."
          checked={activity}
          onCheckedChange={setActivity}
        />
        {activity && (
          <div className="space-y-3">
            <TextField name="activity_title" label="Título da atividade" defaultValue={lesson.activity_title} />
            <TextAreaField name="activity_instructions" label="Instruções" defaultValue={lesson.activity_instructions} rows={4} />
            <CheckField
              name="activity_requires_response"
              label="Exigir resposta escrita"
              description="Sem esta opção, basta confirmar a realização."
              defaultChecked={lesson.activity_requires_response}
            />
          </div>
        )}
      </div>

      <FormMessage state={state} />
      <div className="sticky bottom-0 -mx-6 border-t bg-card/95 px-6 py-3 backdrop-blur">
        <SubmitButton pendingText="Salvando…">Salvar aula</SubmitButton>
      </div>
    </form>
  );
}
